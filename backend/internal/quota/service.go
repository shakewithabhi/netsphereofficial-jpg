package quota

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/bytebox/backend/internal/billing"
)

const quotaCacheTTL = 30 * time.Second

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

// cachedQuotaInfo is the data we store in Redis for a user's quota check.
type cachedQuotaInfo struct {
	StorageUsed int64  `json:"storage_used"`
	SoftLimit   *int64 `json:"soft_limit"`
	Plan        string `json:"plan"`
}

type Service struct {
	db  *pgxpool.Pool
	rdb *redis.Client
}

func NewService(db *pgxpool.Pool, rdb *redis.Client) *Service {
	return &Service{db: db, rdb: rdb}
}

func quotaCacheKey(userID uuid.UUID) string {
	return "quota:" + userID.String()
}

// getQuotaInfo returns the user's storage_used, soft_storage_limit, and plan,
// using a 30-second Redis cache to avoid hitting the DB on every upload.
func (s *Service) getQuotaInfo(ctx context.Context, userID uuid.UUID) (*cachedQuotaInfo, error) {
	key := quotaCacheKey(userID)

	// Try Redis first
	if s.rdb != nil {
		data, err := s.rdb.Get(ctx, key).Bytes()
		if err == nil {
			var info cachedQuotaInfo
			if err := json.Unmarshal(data, &info); err == nil {
				return &info, nil
			}
		}
	}

	// Cache miss or Redis unavailable — query DB
	var info cachedQuotaInfo
	err := s.db.QueryRow(ctx,
		`SELECT u.storage_used, u.soft_storage_limit, COALESCE(sub.plan, 'free')
		 FROM users u
		 LEFT JOIN subscriptions sub ON sub.user_id = u.id AND sub.status = 'active'
		 WHERE u.id = $1`, userID,
	).Scan(&info.StorageUsed, &info.SoftLimit, &info.Plan)
	if err != nil {
		return nil, fmt.Errorf("get user storage: %w", err)
	}

	// Store in Redis (best-effort)
	if s.rdb != nil {
		if data, err := json.Marshal(info); err == nil {
			if err := s.rdb.Set(ctx, key, data, quotaCacheTTL).Err(); err != nil {
				slog.Warn("failed to cache quota info", "error", err)
			}
		}
	}

	return &info, nil
}

// InvalidateQuotaCache removes the cached quota data for a user.
// Called after storage usage changes so the next check reads fresh data.
func (s *Service) InvalidateQuotaCache(ctx context.Context, userID uuid.UUID) {
	if s.rdb == nil {
		return
	}
	if err := s.rdb.Del(ctx, quotaCacheKey(userID)).Err(); err != nil {
		slog.Warn("failed to invalidate quota cache", "user_id", userID, "error", err)
	}
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

	// Get user's current usage and soft limit (cached)
	info, err := s.getQuotaInfo(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Determine effective soft limit
	effectiveLimit := getSoftLimit(info.Plan, info.SoftLimit)

	newUsage := info.StorageUsed + fileSize

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
// It also invalidates the cached quota info so the next check reads fresh data.
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

	// Invalidate cached quota after successful DB update
	s.InvalidateQuotaCache(ctx, userID)

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
