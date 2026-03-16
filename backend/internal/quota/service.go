package quota

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bytebox/backend/internal/billing"
)

type QuotaCheck struct {
	Allowed    bool   `json:"allowed"`
	Warning    bool   `json:"warning"`
	WarningMsg string `json:"warning_msg,omitempty"`
}

type PoolStatus struct {
	TotalCapacity int64   `json:"total_capacity"`
	UsedCapacity  int64   `json:"used_capacity"`
	UsagePercent  float64 `json:"usage_percent"`
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

// CheckUpload determines whether a user can upload a file of the given size.
// Logic:
//   - Global pool >= 95% full → hard reject
//   - User > 3x soft limit → hard reject
//   - User > soft limit → allow with warning
//   - Otherwise → allow
func (s *Service) CheckUpload(ctx context.Context, userID uuid.UUID, fileSize int64) (*QuotaCheck, error) {
	// Get global pool usage
	pool, err := s.GetPoolStatus(ctx)
	if err != nil {
		return nil, fmt.Errorf("check pool: %w", err)
	}

	if pool.UsagePercent >= 95 {
		return &QuotaCheck{Allowed: false, WarningMsg: "storage capacity is full, please try again later"}, nil
	}

	// Get user's current usage and soft limit
	var storageUsed int64
	var softLimit *int64
	var plan string

	err = s.db.QueryRow(ctx,
		`SELECT u.storage_used, u.soft_storage_limit, COALESCE(sub.plan, 'free')
		 FROM users u
		 LEFT JOIN subscriptions sub ON sub.user_id = u.id AND sub.status = 'active'
		 WHERE u.id = $1`, userID,
	).Scan(&storageUsed, &softLimit, &plan)
	if err != nil {
		return nil, fmt.Errorf("get user storage: %w", err)
	}

	// Determine effective soft limit
	effectiveLimit := getSoftLimit(plan, softLimit)

	newUsage := storageUsed + fileSize

	// Hard reject if > 3x soft limit
	if newUsage > effectiveLimit*3 {
		return &QuotaCheck{
			Allowed:    false,
			WarningMsg: "storage limit exceeded, please upgrade your plan or free up space",
		}, nil
	}

	// Warning if > soft limit
	if newUsage > effectiveLimit {
		return &QuotaCheck{
			Allowed:    true,
			Warning:    true,
			WarningMsg: "you are approaching your storage limit, consider upgrading your plan",
		}, nil
	}

	return &QuotaCheck{Allowed: true}, nil
}

// UpdateUsage atomically updates both user storage_used and global pool used_capacity.
func (s *Service) UpdateUsage(ctx context.Context, userID uuid.UUID, delta int64) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`UPDATE users SET storage_used = storage_used + $1 WHERE id = $2`,
		delta, userID,
	)
	if err != nil {
		return fmt.Errorf("update user storage: %w", err)
	}

	_, err = tx.Exec(ctx,
		`UPDATE storage_pool SET used_capacity = used_capacity + $1, updated_at = NOW() WHERE id = 1`,
		delta,
	)
	if err != nil {
		return fmt.Errorf("update pool: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

func (s *Service) GetPoolStatus(ctx context.Context) (*PoolStatus, error) {
	var total, used int64
	err := s.db.QueryRow(ctx, `SELECT total_capacity, used_capacity FROM storage_pool WHERE id = 1`).Scan(&total, &used)
	if err != nil {
		return nil, fmt.Errorf("get pool status: %w", err)
	}

	pct := float64(0)
	if total > 0 {
		pct = float64(used) / float64(total) * 100
	}

	return &PoolStatus{
		TotalCapacity: total,
		UsedCapacity:  used,
		UsagePercent:  pct,
	}, nil
}

func (s *Service) UpdatePoolCapacity(ctx context.Context, totalCapacity int64) error {
	_, err := s.db.Exec(ctx,
		`UPDATE storage_pool SET total_capacity = $1, updated_at = NOW() WHERE id = 1`,
		totalCapacity,
	)
	if err != nil {
		return fmt.Errorf("update pool capacity: %w", err)
	}
	slog.Info("storage pool capacity updated", "total_capacity", totalCapacity)
	return nil
}

// getSoftLimit returns the effective soft limit for a user based on plan and override.
func getSoftLimit(plan string, override *int64) int64 {
	if override != nil {
		return *override
	}

	p := billing.GetPlan(plan)
	if p != nil {
		return p.SoftStorageLimit
	}

	// Default fallback: 10GB
	return 10 * billing.GB
}
