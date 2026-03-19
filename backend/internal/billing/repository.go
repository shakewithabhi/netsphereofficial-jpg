package billing

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateSubscription(ctx context.Context, sub *Subscription) error {
	query := `
		INSERT INTO subscriptions (user_id, plan, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at`

	err := r.db.QueryRow(ctx, query,
		sub.UserID,
		sub.Plan,
		sub.RazorpayCustomerID,
		sub.RazorpaySubscriptionID,
		sub.Status,
		sub.CurrentPeriodStart,
		sub.CurrentPeriodEnd,
	).Scan(&sub.ID, &sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create subscription: %w", err)
	}
	return nil
}

func (r *Repository) GetSubscriptionByUserID(ctx context.Context, userID uuid.UUID) (*Subscription, error) {
	query := `
		SELECT id, user_id, plan, stripe_customer_id, stripe_subscription_id,
		       status, current_period_start, current_period_end, created_at, updated_at
		FROM subscriptions WHERE user_id = $1`

	sub := &Subscription{}
	err := r.db.QueryRow(ctx, query, userID).Scan(
		&sub.ID, &sub.UserID, &sub.Plan, &sub.RazorpayCustomerID, &sub.RazorpaySubscriptionID,
		&sub.Status, &sub.CurrentPeriodStart, &sub.CurrentPeriodEnd, &sub.CreatedAt, &sub.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get subscription by user id: %w", err)
	}
	return sub, nil
}

func (r *Repository) GetSubscriptionByRazorpayID(ctx context.Context, razorpaySubID string) (*Subscription, error) {
	query := `
		SELECT id, user_id, plan, stripe_customer_id, stripe_subscription_id,
		       status, current_period_start, current_period_end, created_at, updated_at
		FROM subscriptions WHERE stripe_subscription_id = $1`

	sub := &Subscription{}
	err := r.db.QueryRow(ctx, query, razorpaySubID).Scan(
		&sub.ID, &sub.UserID, &sub.Plan, &sub.RazorpayCustomerID, &sub.RazorpaySubscriptionID,
		&sub.Status, &sub.CurrentPeriodStart, &sub.CurrentPeriodEnd, &sub.CreatedAt, &sub.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get subscription by razorpay id: %w", err)
	}
	return sub, nil
}

func (r *Repository) UpdateSubscription(ctx context.Context, id uuid.UUID, status string, periodStart, periodEnd *time.Time) error {
	query := `
		UPDATE subscriptions
		SET status = $1, current_period_start = $2, current_period_end = $3, updated_at = NOW()
		WHERE id = $4`

	result, err := r.db.Exec(ctx, query, status, periodStart, periodEnd, id)
	if err != nil {
		return fmt.Errorf("update subscription: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("subscription not found")
	}
	return nil
}

func (r *Repository) UpdateSubscriptionPlan(ctx context.Context, id uuid.UUID, plan, status string) error {
	query := `
		UPDATE subscriptions
		SET plan = $1, status = $2, updated_at = NOW()
		WHERE id = $3`

	result, err := r.db.Exec(ctx, query, plan, status, id)
	if err != nil {
		return fmt.Errorf("update subscription plan: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("subscription not found")
	}
	return nil
}

func (r *Repository) UpdateUserPlan(ctx context.Context, userID uuid.UUID, plan string, storageLimit int64) error {
	query := `UPDATE users SET plan = $1, storage_limit = $2, updated_at = NOW() WHERE id = $3`

	result, err := r.db.Exec(ctx, query, plan, storageLimit, userID)
	if err != nil {
		return fmt.Errorf("update user plan: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}
