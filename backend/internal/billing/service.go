package billing

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	stripe "github.com/stripe/stripe-go/v81"
	checkoutsession "github.com/stripe/stripe-go/v81/checkout/session"
	portalsession "github.com/stripe/stripe-go/v81/billingportal/session"
	stripesub "github.com/stripe/stripe-go/v81/subscription"
	"github.com/stripe/stripe-go/v81/webhook"

	"github.com/bytebox/backend/internal/common"
)

// NotificationSender is an interface to avoid circular imports with the notification package.
type NotificationSender interface {
	Notify(ctx context.Context, userID uuid.UUID, notifType, title, message string, data map[string]interface{}) error
}

type Service struct {
	repo           *Repository
	stripeKey      string
	webhookSecret  string
	appBaseURL     string
	notifier       NotificationSender
	auditLogger    *common.AuditLogger
}

// SetNotificationService injects the notification service after construction.
func (s *Service) SetNotificationService(n NotificationSender) {
	s.notifier = n
}

// SetAuditLogger injects the audit logger after construction.
func (s *Service) SetAuditLogger(a *common.AuditLogger) {
	s.auditLogger = a
}

func NewService(repo *Repository, stripeKey, webhookSecret, appBaseURL string) *Service {
	stripe.Key = stripeKey
	return &Service{
		repo:          repo,
		stripeKey:     stripeKey,
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

func (s *Service) CreateCheckoutSession(ctx context.Context, userID uuid.UUID, email string, req CreateCheckoutRequest) (*CheckoutResponse, error) {
	plan := GetPlan(req.Plan)
	if plan == nil {
		return nil, common.ErrBadRequest("invalid plan")
	}
	if plan.StripePriceID == "" {
		return nil, common.ErrBadRequest("plan not available for purchase")
	}

	// Check if user already has an active subscription
	existing, err := s.repo.GetSubscriptionByUserID(ctx, userID)
	if err != nil {
		slog.Error("failed to check existing subscription", "error", err)
		return nil, common.ErrInternal("failed to create checkout")
	}
	if existing != nil && existing.Status == "active" && existing.Plan != "free" {
		return nil, common.ErrConflict("already have an active subscription — use the billing portal to change plans")
	}

	params := &stripe.CheckoutSessionParams{
		Mode: stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(plan.StripePriceID),
				Quantity: stripe.Int64(1),
			},
		},
		CustomerEmail: stripe.String(email),
		SuccessURL:    stripe.String(fmt.Sprintf("%s/billing/success?session_id={CHECKOUT_SESSION_ID}", s.appBaseURL)),
		CancelURL:     stripe.String(fmt.Sprintf("%s/billing/cancel", s.appBaseURL)),
		Metadata: map[string]string{
			"user_id": userID.String(),
			"plan":    req.Plan,
		},
	}

	session, err := checkoutsession.New(params)
	if err != nil {
		slog.Error("failed to create checkout session", "error", err)
		return nil, common.ErrInternal("failed to create checkout session")
	}

	return &CheckoutResponse{CheckoutURL: session.URL}, nil
}

func (s *Service) CreateBillingPortal(ctx context.Context, userID uuid.UUID) (*BillingPortalResponse, error) {
	sub, err := s.repo.GetSubscriptionByUserID(ctx, userID)
	if err != nil {
		slog.Error("failed to get subscription", "error", err)
		return nil, common.ErrInternal("failed to create billing portal")
	}
	if sub == nil || sub.StripeCustomerID == "" {
		return nil, common.ErrBadRequest("no active subscription — subscribe to a plan first")
	}

	params := &stripe.BillingPortalSessionParams{
		Customer:  stripe.String(sub.StripeCustomerID),
		ReturnURL: stripe.String(fmt.Sprintf("%s/billing", s.appBaseURL)),
	}

	session, err := portalsession.New(params)
	if err != nil {
		slog.Error("failed to create billing portal session", "error", err)
		return nil, common.ErrInternal("failed to create billing portal")
	}

	return &BillingPortalResponse{PortalURL: session.URL}, nil
}

func (s *Service) CancelSubscription(ctx context.Context, userID uuid.UUID) error {
	sub, err := s.repo.GetSubscriptionByUserID(ctx, userID)
	if err != nil {
		slog.Error("failed to get subscription", "error", err)
		return common.ErrInternal("failed to cancel subscription")
	}
	if sub == nil || sub.StripeSubscriptionID == "" {
		return common.ErrBadRequest("no active subscription to cancel")
	}
	if sub.Status != "active" {
		return common.ErrBadRequest("subscription is not active")
	}

	params := &stripe.SubscriptionCancelParams{}
	_, err = stripesub.Cancel(sub.StripeSubscriptionID, params)
	if err != nil {
		slog.Error("failed to cancel stripe subscription", "error", err)
		return common.ErrInternal("failed to cancel subscription")
	}

	// Mark as cancelled locally (webhook will also handle this)
	if err := s.repo.UpdateSubscriptionPlan(ctx, sub.ID, sub.Plan, "cancelled"); err != nil {
		slog.Error("failed to update subscription status", "error", err)
	}

	return nil
}

func (s *Service) HandleWebhook(r *http.Request) error {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return common.ErrBadRequest("failed to read request body")
	}

	event, err := webhook.ConstructEvent(body, r.Header.Get("Stripe-Signature"), s.webhookSecret)
	if err != nil {
		slog.Error("webhook signature verification failed", "error", err)
		return common.ErrUnauthorized("invalid webhook signature")
	}

	ctx := r.Context()

	switch event.Type {
	case "checkout.session.completed":
		return s.handleCheckoutCompleted(ctx, &event)
	case "customer.subscription.updated":
		return s.handleSubscriptionUpdated(ctx, &event)
	case "customer.subscription.deleted":
		return s.handleSubscriptionDeleted(ctx, &event)
	case "invoice.payment_failed":
		return s.handlePaymentFailed(ctx, &event)
	default:
		slog.Debug("unhandled webhook event", "type", event.Type)
	}

	return nil
}

func (s *Service) handleCheckoutCompleted(ctx context.Context, event *stripe.Event) error {
	session, ok := event.Data.Object["id"].(string)
	if !ok {
		return common.ErrBadRequest("invalid checkout session data")
	}

	// Retrieve the full session to get metadata
	params := &stripe.CheckoutSessionParams{}
	params.AddExpand("subscription")
	cs, err := checkoutsession.Get(session, params)
	if err != nil {
		slog.Error("failed to retrieve checkout session", "error", err)
		return common.ErrInternal("failed to process checkout")
	}

	userIDStr, ok := cs.Metadata["user_id"]
	if !ok {
		slog.Error("checkout session missing user_id metadata")
		return common.ErrBadRequest("missing user_id in metadata")
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return common.ErrBadRequest("invalid user_id in metadata")
	}

	planKey, ok := cs.Metadata["plan"]
	if !ok {
		return common.ErrBadRequest("missing plan in metadata")
	}

	plan := GetPlan(planKey)
	if plan == nil {
		return common.ErrBadRequest("invalid plan in metadata")
	}

	var periodStart, periodEnd *time.Time
	if cs.Subscription != nil {
		start := time.Unix(cs.Subscription.CurrentPeriodStart, 0)
		end := time.Unix(cs.Subscription.CurrentPeriodEnd, 0)
		periodStart = &start
		periodEnd = &end
	}

	// Upsert subscription: delete existing if any, then create
	existing, _ := s.repo.GetSubscriptionByUserID(ctx, userID)
	if existing != nil {
		// Update existing subscription
		existing.Plan = planKey
		existing.StripeCustomerID = cs.Customer.ID
		existing.StripeSubscriptionID = cs.Subscription.ID
		existing.Status = "active"
		existing.CurrentPeriodStart = periodStart
		existing.CurrentPeriodEnd = periodEnd
		if err := s.repo.UpdateSubscription(ctx, existing.ID, "active", periodStart, periodEnd); err != nil {
			slog.Error("failed to update subscription", "error", err)
			return common.ErrInternal("failed to update subscription")
		}
		if err := s.repo.UpdateSubscriptionPlan(ctx, existing.ID, planKey, "active"); err != nil {
			slog.Error("failed to update subscription plan", "error", err)
		}
	} else {
		sub := &Subscription{
			UserID:               userID,
			Plan:                 planKey,
			StripeCustomerID:     cs.Customer.ID,
			StripeSubscriptionID: cs.Subscription.ID,
			Status:               "active",
			CurrentPeriodStart:   periodStart,
			CurrentPeriodEnd:     periodEnd,
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
			map[string]any{"plan": planKey, "action": "checkout_completed"}, "")
	}

	slog.Info("checkout completed", "user_id", userID, "plan", planKey)
	return nil
}

func (s *Service) handleSubscriptionUpdated(ctx context.Context, event *stripe.Event) error {
	stripeSubID, _ := event.Data.Object["id"].(string)
	if stripeSubID == "" {
		return common.ErrBadRequest("missing subscription id")
	}

	sub, err := s.repo.GetSubscriptionByStripeID(ctx, stripeSubID)
	if err != nil {
		slog.Error("failed to get subscription by stripe id", "error", err)
		return common.ErrInternal("failed to process subscription update")
	}
	if sub == nil {
		slog.Warn("received update for unknown subscription", "stripe_subscription_id", stripeSubID)
		return nil
	}

	status, _ := event.Data.Object["status"].(string)
	var periodStart, periodEnd *time.Time
	if startUnix, ok := event.Data.Object["current_period_start"].(float64); ok {
		t := time.Unix(int64(startUnix), 0)
		periodStart = &t
	}
	if endUnix, ok := event.Data.Object["current_period_end"].(float64); ok {
		t := time.Unix(int64(endUnix), 0)
		periodEnd = &t
	}

	mappedStatus := mapStripeStatus(status)
	if err := s.repo.UpdateSubscription(ctx, sub.ID, mappedStatus, periodStart, periodEnd); err != nil {
		slog.Error("failed to update subscription", "error", err)
		return common.ErrInternal("failed to update subscription")
	}

	// Detect plan upgrade/downgrade from Stripe items
	if items, ok := event.Data.Object["items"].(map[string]interface{}); ok {
		if data, ok := items["data"].([]interface{}); ok && len(data) > 0 {
			if item, ok := data[0].(map[string]interface{}); ok {
				if price, ok := item["price"].(map[string]interface{}); ok {
					if priceID, ok := price["id"].(string); ok {
						newPlan := s.planKeyFromPriceID(priceID)
						if newPlan != "" && newPlan != sub.Plan {
							plan := GetPlan(newPlan)
							if plan != nil {
								if err := s.repo.UpdateSubscriptionPlan(ctx, sub.ID, newPlan, mappedStatus); err != nil {
									slog.Error("failed to update subscription plan on update", "error", err)
								}
								if err := s.repo.UpdateUserPlan(ctx, sub.UserID, newPlan, plan.SoftStorageLimit); err != nil {
									slog.Error("failed to update user plan on subscription update", "error", err)
								}
								if s.notifier != nil {
									s.notifier.Notify(ctx, sub.UserID, "plan_change",
										"Plan changed",
										fmt.Sprintf("Your plan has been changed to %s", plan.Name),
										map[string]interface{}{"plan": newPlan, "previous_plan": sub.Plan},
									)
								}
								if s.auditLogger != nil {
									s.auditLogger.Log(ctx, &sub.UserID, common.AuditPlanChange, "subscription", &sub.ID,
										map[string]any{"plan": newPlan, "previous_plan": sub.Plan, "action": "subscription_updated"}, "")
								}
							}
						}
					}
				}
			}
		}
	}

	slog.Info("subscription updated", "subscription_id", sub.ID, "status", mappedStatus)
	return nil
}

func (s *Service) planKeyFromPriceID(priceID string) string {
	for key, plan := range Plans {
		if plan.StripePriceID == priceID {
			return key
		}
	}
	return ""
}

func (s *Service) handleSubscriptionDeleted(ctx context.Context, event *stripe.Event) error {
	stripeSubID, _ := event.Data.Object["id"].(string)
	if stripeSubID == "" {
		return common.ErrBadRequest("missing subscription id")
	}

	sub, err := s.repo.GetSubscriptionByStripeID(ctx, stripeSubID)
	if err != nil {
		slog.Error("failed to get subscription by stripe id", "error", err)
		return common.ErrInternal("failed to process subscription deletion")
	}
	if sub == nil {
		slog.Warn("received delete for unknown subscription", "stripe_subscription_id", stripeSubID)
		return nil
	}

	// Downgrade to free
	previousPlan := sub.Plan
	freePlan := GetPlan("free")
	if err := s.repo.UpdateSubscriptionPlan(ctx, sub.ID, "free", "cancelled"); err != nil {
		slog.Error("failed to update subscription to free", "error", err)
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
			map[string]any{"plan": "free", "previous_plan": previousPlan, "action": "subscription_deleted"}, "")
	}

	slog.Info("subscription deleted, downgraded to free", "user_id", sub.UserID)
	return nil
}

func (s *Service) handlePaymentFailed(ctx context.Context, event *stripe.Event) error {
	subObj, ok := event.Data.Object["subscription"].(string)
	if !ok || subObj == "" {
		slog.Warn("payment failed event without subscription id")
		return nil
	}

	sub, err := s.repo.GetSubscriptionByStripeID(ctx, subObj)
	if err != nil {
		slog.Error("failed to get subscription by stripe id", "error", err)
		return common.ErrInternal("failed to process payment failure")
	}
	if sub == nil {
		slog.Warn("payment failed for unknown subscription", "stripe_subscription_id", subObj)
		return nil
	}

	if err := s.repo.UpdateSubscription(ctx, sub.ID, "past_due", sub.CurrentPeriodStart, sub.CurrentPeriodEnd); err != nil {
		slog.Error("failed to mark subscription as past_due", "error", err)
		return common.ErrInternal("failed to update subscription status")
	}

	// Notify user about payment failure
	if s.notifier != nil {
		s.notifier.Notify(ctx, sub.UserID, "payment_failed",
			"Payment failed",
			"Your subscription payment has failed. Please update your payment method to avoid service interruption.",
			map[string]interface{}{"plan": sub.Plan},
		)
	}

	slog.Info("subscription marked past_due due to payment failure", "subscription_id", sub.ID)
	return nil
}

func mapStripeStatus(status string) string {
	switch status {
	case "active", "trialing":
		return "active"
	case "canceled", "unpaid":
		return "cancelled"
	case "past_due":
		return "past_due"
	default:
		return status
	}
}
