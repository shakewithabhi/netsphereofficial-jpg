package billing

import (
	"time"

	"github.com/google/uuid"
)

// Plan configuration

type PlanConfig struct {
	Name             string `json:"name"`
	SoftStorageLimit int64  `json:"soft_storage_limit"`
	PriceMonthly     int64  `json:"price_monthly"` // in paise (4900 = ₹49)
	RazorpayPlanID   string `json:"-"`
}

// Domain models

type Subscription struct {
	ID                     uuid.UUID
	UserID                 uuid.UUID
	Plan                   string
	RazorpayCustomerID     string
	RazorpaySubscriptionID string
	Status                 string // active, cancelled, past_due
	CurrentPeriodStart     *time.Time
	CurrentPeriodEnd       *time.Time
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

// Response types

type SubscriptionResponse struct {
	ID                 uuid.UUID  `json:"id"`
	Plan               string     `json:"plan"`
	Status             string     `json:"status"`
	CurrentPeriodStart *time.Time `json:"current_period_start,omitempty"`
	CurrentPeriodEnd   *time.Time `json:"current_period_end,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}

func (s *Subscription) ToResponse() SubscriptionResponse {
	return SubscriptionResponse{
		ID:                 s.ID,
		Plan:               s.Plan,
		Status:             s.Status,
		CurrentPeriodStart: s.CurrentPeriodStart,
		CurrentPeriodEnd:   s.CurrentPeriodEnd,
		CreatedAt:          s.CreatedAt,
	}
}

type PlanResponse struct {
	Key              string `json:"key"`
	Name             string `json:"name"`
	SoftStorageLimit int64  `json:"soft_storage_limit"`
	PriceMonthly     int64  `json:"price_monthly"`
}

// Request types

type CreateOrderRequest struct {
	Plan string `json:"plan" validate:"required,oneof=pro premium"`
}

type VerifyPaymentRequest struct {
	RazorpayPaymentID string `json:"razorpay_payment_id" validate:"required"`
	RazorpayOrderID   string `json:"razorpay_order_id" validate:"required"`
	RazorpaySignature string `json:"razorpay_signature" validate:"required"`
}

// Response types for order

type OrderResponse struct {
	OrderID  string `json:"order_id"`
	KeyID    string `json:"key_id"`
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}
