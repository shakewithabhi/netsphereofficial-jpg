package billing

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	razorpay "github.com/razorpay/razorpay-go"

	"github.com/bytebox/backend/internal/common"
)

// NotificationSender is an interface to avoid circular imports with the notification package.
type NotificationSender interface {
	Notify(ctx context.Context, userID uuid.UUID, notifType, title, message string, data map[string]interface{}) error
}

type Service struct {
	repo          *Repository
	rzpClient     *razorpay.Client
	keyID         string
	keySecret     string
	webhookSecret string
	appBaseURL    string
	notifier      NotificationSender
	auditLogger   *common.AuditLogger
}

// SetNotificationService injects the notification service after construction.
func (s *Service) SetNotificationService(n NotificationSender) {
	s.notifier = n
}

// SetAuditLogger injects the audit logger after construction.
func (s *Service) SetAuditLogger(a *common.AuditLogger) {
	s.auditLogger = a
}

func NewService(repo *Repository, keyID, keySecret, webhookSecret, appBaseURL string) *Service {
	client := razorpay.NewClient(keyID, keySecret)
	return &Service{
		repo:          repo,
		rzpClient:     client,
		keyID:         keyID,
		keySecret:     keySecret,
		webhookSecret: webhookSecret,
		appBaseURL:    appBaseURL,
	}
}

func (s *Service) GetSubscription(ctx context.Context, userID uuid.UUID) (*SubscriptionResponse, error) {
	sub, err := s.repo.GetSubscriptionByUserID(ctx, userID)
	if err != nil {
		slog.Error("failed to get subscription", "error", err)
		return nil, common.ErrInternal("failed to get subscription")
	}
	if sub == nil {
		// User has no subscription record — they're on the free plan
		return &SubscriptionResponse{
			Plan:   "free",
			Status: "active",
		}, nil
	}
	resp := sub.ToResponse()
	return &resp, nil
}

func (s *Service) CreateOrder(ctx context.Context, userID uuid.UUID, email string, req CreateOrderRequest) (*OrderResponse, error) {
	plan := GetPlan(req.Plan)
	if plan == nil {
		return nil, common.ErrBadRequest("invalid plan")
	}
	if plan.RazorpayPlanID == "" && plan.PriceMonthly == 0 {
		return nil, common.ErrBadRequest("plan not available for purchase")
	}

	// Check if user already has an active subscription
	existing, err := s.repo.GetSubscriptionByUserID(ctx, userID)
	if err != nil {
		slog.Error("failed to check existing subscription", "error", err)
		return nil, common.ErrInternal("failed to create order")
	}
	if existing != nil && existing.Status == "active" && existing.Plan != "free" {
		return nil, common.ErrConflict("already have an active subscription — cancel current plan first to change plans")
	}

	receipt := fmt.Sprintf("order_%s_%s", userID.String()[:8], req.Plan)

	orderData := map[string]interface{}{
		"amount":   plan.PriceMonthly,
		"currency": "INR",
		"receipt":  receipt,
		"notes": map[string]interface{}{
			"user_id": userID.String(),
			"plan":    req.Plan,
			"email":   email,
		},
	}

	order, err := s.rzpClient.Order.Create(orderData, nil)
	if err != nil {
		slog.Error("failed to create razorpay order", "error", err)
		return nil, common.ErrInternal("failed to create order")
	}

	orderID, _ := order["id"].(string)
	amount, _ := order["amount"].(float64)
	currency, _ := order["currency"].(string)

	return &OrderResponse{
		OrderID:  orderID,
		KeyID:    s.keyID,
		Amount:   int64(amount),
		Currency: currency,
	}, nil
}

func (s *Service) VerifyPayment(ctx context.Context, userID uuid.UUID, req VerifyPaymentRequest) error {
	// Verify the payment signature using HMAC-SHA256
	// Signature is computed over: order_id|payment_id
	message := req.RazorpayOrderID + "|" + req.RazorpayPaymentID
	if !s.verifySignature(message, req.RazorpaySignature, s.keySecret) {
		return common.ErrUnauthorized("invalid payment signature")
	}

	// Fetch order details from Razorpay to get plan info
	order, err := s.rzpClient.Order.Fetch(req.RazorpayOrderID, nil, nil)
	if err != nil {
		slog.Error("failed to fetch razorpay order", "error", err)
		return common.ErrInternal("failed to verify payment")
	}

	notes, _ := order["notes"].(map[string]interface{})
	planKey, _ := notes["plan"].(string)
	if planKey == "" {
		return common.ErrBadRequest("missing plan information in order")
	}

	plan := GetPlan(planKey)
	if plan == nil {
		return common.ErrBadRequest("invalid plan in order")
	}

	now := time.Now()
	periodEnd := now.AddDate(0, 1, 0) // 1 month from now

	// Upsert subscription
	existing, _ := s.repo.GetSubscriptionByUserID(ctx, userID)
	if existing != nil {
		existing.Plan = planKey
		existing.RazorpayCustomerID = req.RazorpayPaymentID
		existing.RazorpaySubscriptionID = req.RazorpayOrderID
		existing.Status = "active"
		existing.CurrentPeriodStart = &now
		existing.CurrentPeriodEnd = &periodEnd
		if err := s.repo.UpdateSubscription(ctx, existing.ID, "active", &now, &periodEnd); err != nil {
			slog.Error("failed to update subscription", "error", err)
			return common.ErrInternal("failed to update subscription")
		}
		if err := s.repo.UpdateSubscriptionPlan(ctx, existing.ID, planKey, "active"); err != nil {
			slog.Error("failed to update subscription plan", "error", err)
		}
	} else {
		sub := &Subscription{
			UserID:                 userID,
			Plan:                   planKey,
			RazorpayCustomerID:     req.RazorpayPaymentID,
			RazorpaySubscriptionID: req.RazorpayOrderID,
			Status:                 "active",
			CurrentPeriodStart:     &now,
			CurrentPeriodEnd:       &periodEnd,
		}
		if err := s.repo.CreateSubscription(ctx, sub); err != nil {
			slog.Error("failed to create subscription", "error", err)
			return common.ErrInternal("failed to create subscription")
		}
	}

	// Update user plan and storage limit
	if err := s.repo.UpdateUserPlan(ctx, userID, planKey, plan.SoftStorageLimit); err != nil {
		slog.Error("failed to update user plan", "error", err)
		return common.ErrInternal("failed to update user plan")
	}

	// Send notification about plan change
	if s.notifier != nil {
		s.notifier.Notify(ctx, userID, "plan_change",
			"Plan upgraded",
			fmt.Sprintf("Your plan has been upgraded to %s", plan.Name),
			map[string]interface{}{"plan": planKey},
		)
	}

	// Audit log for plan change
	if s.auditLogger != nil {
		s.auditLogger.Log(ctx, &userID, common.AuditPlanChange, "subscription", nil,
			map[string]any{"plan": planKey, "action": "payment_verified"}, "")
	}

	slog.Info("payment verified and subscription activated", "user_id", userID, "plan", planKey)
	return nil
}

func (s *Service) CancelSubscription(ctx context.Context, userID uuid.UUID) error {
	sub, err := s.repo.GetSubscriptionByUserID(ctx, userID)
	if err != nil {
		slog.Error("failed to get subscription", "error", err)
		return common.ErrInternal("failed to cancel subscription")
	}
	if sub == nil || sub.RazorpaySubscriptionID == "" {
		return common.ErrBadRequest("no active subscription to cancel")
	}
	if sub.Status != "active" {
		return common.ErrBadRequest("subscription is not active")
	}

	// Mark as cancelled locally
	previousPlan := sub.Plan
	freePlan := GetPlan("free")
	if err := s.repo.UpdateSubscriptionPlan(ctx, sub.ID, "free", "cancelled"); err != nil {
		slog.Error("failed to update subscription status", "error", err)
		return common.ErrInternal("failed to cancel subscription")
	}
	if err := s.repo.UpdateUserPlan(ctx, sub.UserID, "free", freePlan.SoftStorageLimit); err != nil {
		slog.Error("failed to downgrade user plan", "error", err)
		return common.ErrInternal("failed to downgrade user plan")
	}

	// Send notification about cancellation
	if s.notifier != nil {
		s.notifier.Notify(ctx, sub.UserID, "plan_change",
			"Subscription cancelled",
			"Your subscription has been cancelled and your plan has been reverted to Free",
			map[string]interface{}{"plan": "free", "previous_plan": previousPlan},
		)
	}

	// Audit log for cancellation
	if s.auditLogger != nil {
		s.auditLogger.Log(ctx, &sub.UserID, common.AuditPlanChange, "subscription", &sub.ID,
			map[string]any{"plan": "free", "previous_plan": previousPlan, "action": "subscription_cancelled"}, "")
	}

	slog.Info("subscription cancelled", "user_id", sub.UserID)
	return nil
}

func (s *Service) HandleWebhook(r *http.Request) error {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return common.ErrBadRequest("failed to read request body")
	}

	// Verify Razorpay webhook signature
	signature := r.Header.Get("X-Razorpay-Signature")
	if !s.verifySignature(string(body), signature, s.webhookSecret) {
		slog.Error("webhook signature verification failed")
		return common.ErrUnauthorized("invalid webhook signature")
	}

	ctx := r.Context()

	var event map[string]interface{}
	if err := json.Unmarshal(body, &event); err != nil {
		return common.ErrBadRequest("invalid webhook payload")
	}

	eventType, _ := event["event"].(string)

	switch eventType {
	case "payment.captured":
		return s.handlePaymentCaptured(ctx, event)
	case "subscription.cancelled":
		return s.handleSubscriptionCancelled(ctx, event)
	case "payment.failed":
		return s.handlePaymentFailed(ctx, event)
	default:
		slog.Debug("unhandled webhook event", "type", eventType)
	}

	return nil
}

func (s *Service) handlePaymentCaptured(ctx context.Context, event map[string]interface{}) error {
	payload, _ := event["payload"].(map[string]interface{})
	paymentEntity, _ := payload["payment"].(map[string]interface{})
	payment, _ := paymentEntity["entity"].(map[string]interface{})

	orderID, _ := payment["order_id"].(string)
	if orderID == "" {
		slog.Warn("payment.captured event without order_id")
		return nil
	}

	// Fetch order to get plan info from notes
	order, err := s.rzpClient.Order.Fetch(orderID, nil, nil)
	if err != nil {
		slog.Error("failed to fetch order for webhook", "error", err)
		return common.ErrInternal("failed to process payment")
	}

	notes, _ := order["notes"].(map[string]interface{})
	userIDStr, _ := notes["user_id"].(string)
	planKey, _ := notes["plan"].(string)

	if userIDStr == "" || planKey == "" {
		slog.Warn("payment.captured missing user_id or plan in order notes")
		return nil
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		slog.Error("invalid user_id in order notes", "error", err)
		return common.ErrBadRequest("invalid user_id in order notes")
	}

	plan := GetPlan(planKey)
	if plan == nil {
		return common.ErrBadRequest("invalid plan in order notes")
	}

	now := time.Now()
	periodEnd := now.AddDate(0, 1, 0)

	paymentID, _ := payment["id"].(string)

	existing, _ := s.repo.GetSubscriptionByUserID(ctx, userID)
	if existing != nil {
		if err := s.repo.UpdateSubscription(ctx, existing.ID, "active", &now, &periodEnd); err != nil {
			slog.Error("failed to update subscription via webhook", "error", err)
			return common.ErrInternal("failed to update subscription")
		}
		if err := s.repo.UpdateSubscriptionPlan(ctx, existing.ID, planKey, "active"); err != nil {
			slog.Error("failed to update subscription plan via webhook", "error", err)
		}
	} else {
		sub := &Subscription{
			UserID:                 userID,
			Plan:                   planKey,
			RazorpayCustomerID:     paymentID,
			RazorpaySubscriptionID: orderID,
			Status:                 "active",
			CurrentPeriodStart:     &now,
			CurrentPeriodEnd:       &periodEnd,
		}
		if err := s.repo.CreateSubscription(ctx, sub); err != nil {
			slog.Error("failed to create subscription via webhook", "error", err)
			return common.ErrInternal("failed to create subscription")
		}
	}

	if err := s.repo.UpdateUserPlan(ctx, userID, planKey, plan.SoftStorageLimit); err != nil {
		slog.Error("failed to update user plan via webhook", "error", err)
		return common.ErrInternal("failed to update user plan")
	}

	if s.notifier != nil {
		s.notifier.Notify(ctx, userID, "plan_change",
			"Plan upgraded",
			fmt.Sprintf("Your plan has been upgraded to %s", plan.Name),
			map[string]interface{}{"plan": planKey},
		)
	}

	if s.auditLogger != nil {
		s.auditLogger.Log(ctx, &userID, common.AuditPlanChange, "subscription", nil,
			map[string]any{"plan": planKey, "action": "payment_captured_webhook"}, "")
	}

	slog.Info("payment captured via webhook", "user_id", userID, "plan", planKey)
	return nil
}

func (s *Service) handleSubscriptionCancelled(ctx context.Context, event map[string]interface{}) error {
	payload, _ := event["payload"].(map[string]interface{})
	subEntity, _ := payload["subscription"].(map[string]interface{})
	subscription, _ := subEntity["entity"].(map[string]interface{})

	subID, _ := subscription["id"].(string)
	if subID == "" {
		slog.Warn("subscription.cancelled event without subscription id")
		return nil
	}

	sub, err := s.repo.GetSubscriptionByRazorpayID(ctx, subID)
	if err != nil {
		slog.Error("failed to get subscription by razorpay id", "error", err)
		return common.ErrInternal("failed to process subscription cancellation")
	}
	if sub == nil {
		slog.Warn("received cancellation for unknown subscription", "razorpay_subscription_id", subID)
		return nil
	}

	previousPlan := sub.Plan
	freePlan := GetPlan("free")
	if err := s.repo.UpdateSubscriptionPlan(ctx, sub.ID, "free", "cancelled"); err != nil {
		slog.Error("failed to update subscription to free", "error", err)
	}
	if err := s.repo.UpdateUserPlan(ctx, sub.UserID, "free", freePlan.SoftStorageLimit); err != nil {
		slog.Error("failed to downgrade user plan", "error", err)
		return common.ErrInternal("failed to downgrade user plan")
	}

	if s.notifier != nil {
		s.notifier.Notify(ctx, sub.UserID, "plan_change",
			"Subscription cancelled",
			"Your subscription has been cancelled and your plan has been reverted to Free",
			map[string]interface{}{"plan": "free", "previous_plan": previousPlan},
		)
	}

	if s.auditLogger != nil {
		s.auditLogger.Log(ctx, &sub.UserID, common.AuditPlanChange, "subscription", &sub.ID,
			map[string]any{"plan": "free", "previous_plan": previousPlan, "action": "subscription_cancelled_webhook"}, "")
	}

	slog.Info("subscription cancelled via webhook, downgraded to free", "user_id", sub.UserID)
	return nil
}

func (s *Service) handlePaymentFailed(ctx context.Context, event map[string]interface{}) error {
	payload, _ := event["payload"].(map[string]interface{})
	paymentEntity, _ := payload["payment"].(map[string]interface{})
	payment, _ := paymentEntity["entity"].(map[string]interface{})

	orderID, _ := payment["order_id"].(string)
	if orderID == "" {
		slog.Warn("payment.failed event without order_id")
		return nil
	}

	// Try to find subscription by order ID
	sub, err := s.repo.GetSubscriptionByRazorpayID(ctx, orderID)
	if err != nil {
		slog.Error("failed to get subscription by razorpay id", "error", err)
		return common.ErrInternal("failed to process payment failure")
	}
	if sub == nil {
		slog.Warn("payment failed for unknown subscription", "razorpay_order_id", orderID)
		return nil
	}

	if err := s.repo.UpdateSubscription(ctx, sub.ID, "past_due", sub.CurrentPeriodStart, sub.CurrentPeriodEnd); err != nil {
		slog.Error("failed to mark subscription as past_due", "error", err)
		return common.ErrInternal("failed to update subscription status")
	}

	if s.notifier != nil {
		s.notifier.Notify(ctx, sub.UserID, "payment_failed",
			"Payment failed",
			"Your subscription payment has failed. Please retry payment to avoid service interruption.",
			map[string]interface{}{"plan": sub.Plan},
		)
	}

	slog.Info("subscription marked past_due due to payment failure", "subscription_id", sub.ID)
	return nil
}

// verifySignature verifies an HMAC-SHA256 signature.
func (s *Service) verifySignature(message, signature, secret string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(message))
	expectedMAC := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expectedMAC), []byte(signature))
}
