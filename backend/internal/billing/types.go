package billing

import (
	"time"

	"github.com/google/uuid"
)

// Plan configuration

type PlanConfig struct {
	Name             string `json:"name"`
	SoftStorageLimit int64  `json:"soft_storage_limit"`
	PriceMonthly     int64  `json:"price_monthly"` // in cents
	StripePriceID    string `json:"-"`
}

// Domain models

type Subscription struct {
	ID                   uuid.UUID
	UserID               uuid.UUID
	Plan                 string
	StripeCustomerID     string
	StripeSubscriptionID string
	Status               string // active, cancelled, past_due
	CurrentPeriodStart   *time.Time
	CurrentPeriodEnd     *time.Time
	CreatedAt            time.Time
	UpdatedAt            time.Time
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

type CreateCheckoutRequest struct {
	Plan string `json:"plan" validate:"required,oneof=pro premium"`
}

// Checkout / portal responses

type CheckoutResponse struct {
	CheckoutURL string `json:"checkout_url"`
}

type BillingPortalResponse struct {
	PortalURL string `json:"portal_url"`
}
