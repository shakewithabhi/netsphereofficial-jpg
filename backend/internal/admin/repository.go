package admin

import (
	"context"
	"encoding/json"
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

func (r *Repository) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	stats := &DashboardStats{}

	queries := []struct {
		query string
		dest  *int64
	}{
		{`SELECT COUNT(*) FROM users`, &stats.TotalUsers},
		{`SELECT COUNT(*) FROM users WHERE is_active = true`, &stats.ActiveUsers},
		{`SELECT COUNT(*) FROM files WHERE trashed_at IS NULL`, &stats.TotalFiles},
		{`SELECT COALESCE(SUM(storage_used), 0) FROM users`, &stats.TotalStorage},
		{`SELECT COUNT(*) FROM files WHERE created_at >= CURRENT_DATE`, &stats.UploadsToday},
		{`SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE`, &stats.NewUsersToday},
		{`SELECT COUNT(*) FROM files WHERE trashed_at IS NOT NULL`, &stats.TrashedFiles},
		{`SELECT COUNT(*) FROM upload_sessions WHERE status = 'active'`, &stats.ActiveUploads},
		{`SELECT COUNT(*) FROM file_comments`, &stats.TotalComments},
		{`SELECT COUNT(*) FROM file_stars`, &stats.TotalStars},
		{`SELECT COUNT(*) FROM notifications`, &stats.TotalNotifications},
		{`SELECT COUNT(*) FROM notifications WHERE read_at IS NULL`, &stats.UnreadNotifications},
		{`SELECT COUNT(*) FROM posts`, &stats.TotalPosts},
	}

	for _, q := range queries {
		if err := r.db.QueryRow(ctx, q.query).Scan(q.dest); err != nil {
			return nil, fmt.Errorf("dashboard stats: %w", err)
		}
	}

	return stats, nil
}

func (r *Repository) ListUsers(ctx context.Context, limit, offset int, search string) ([]AdminUserResponse, int64, error) {
	var total int64
	var countQuery string
	var countArgs []any

	if search != "" {
		countQuery = `SELECT COUNT(*) FROM users WHERE email ILIKE $1 OR display_name ILIKE $1`
		countArgs = []any{"%" + search + "%"}
	} else {
		countQuery = `SELECT COUNT(*) FROM users`
	}

	if err := r.db.QueryRow(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count users: %w", err)
	}

	var query string
	var args []any

	if search != "" {
		query = `
			SELECT u.id, u.email, u.display_name, u.storage_used, u.storage_limit,
			       u.plan, u.is_active, u.is_admin, u.email_verified, u.approval_status, u.last_login_at, u.created_at,
			       (SELECT COUNT(*) FROM files WHERE user_id = u.id AND trashed_at IS NULL) as file_count
			FROM users u
			WHERE u.email ILIKE $1 OR u.display_name ILIKE $1
			ORDER BY u.created_at DESC
			LIMIT $2 OFFSET $3`
		args = []any{"%" + search + "%", limit, offset}
	} else {
		query = `
			SELECT u.id, u.email, u.display_name, u.storage_used, u.storage_limit,
			       u.plan, u.is_active, u.is_admin, u.email_verified, u.approval_status, u.last_login_at, u.created_at,
			       (SELECT COUNT(*) FROM files WHERE user_id = u.id AND trashed_at IS NULL) as file_count
			FROM users u
			ORDER BY u.created_at DESC
			LIMIT $1 OFFSET $2`
		args = []any{limit, offset}
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var users []AdminUserResponse
	for rows.Next() {
		var u AdminUserResponse
		if err := rows.Scan(
			&u.ID, &u.Email, &u.DisplayName, &u.StorageUsed, &u.StorageLimit,
			&u.Plan, &u.IsActive, &u.IsAdmin, &u.EmailVerified, &u.ApprovalStatus, &u.LastLoginAt, &u.CreatedAt,
			&u.FileCount,
		); err != nil {
			return nil, 0, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, u)
	}

	return users, total, nil
}

func (r *Repository) GetUserByID(ctx context.Context, id uuid.UUID) (*AdminUserResponse, error) {
	query := `
		SELECT u.id, u.email, u.display_name, u.storage_used, u.storage_limit,
		       u.plan, u.is_active, u.is_admin, u.email_verified, u.approval_status, u.last_login_at, u.created_at,
		       (SELECT COUNT(*) FROM files WHERE user_id = u.id AND trashed_at IS NULL) as file_count
		FROM users u
		WHERE u.id = $1`

	u := &AdminUserResponse{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&u.ID, &u.Email, &u.DisplayName, &u.StorageUsed, &u.StorageLimit,
		&u.Plan, &u.IsActive, &u.IsAdmin, &u.EmailVerified, &u.ApprovalStatus, &u.LastLoginAt, &u.CreatedAt,
		&u.FileCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get user: %w", err)
	}
	return u, nil
}

func (r *Repository) UpdateUser(ctx context.Context, id uuid.UUID, req UpdateUserRequest) error {
	if req.Plan != nil {
		if _, err := r.db.Exec(ctx, `UPDATE users SET plan = $1 WHERE id = $2`, *req.Plan, id); err != nil {
			return fmt.Errorf("update plan: %w", err)
		}
	}
	if req.StorageLimit != nil {
		if _, err := r.db.Exec(ctx, `UPDATE users SET storage_limit = $1 WHERE id = $2`, *req.StorageLimit, id); err != nil {
			return fmt.Errorf("update storage limit: %w", err)
		}
	}
	if req.IsActive != nil {
		if _, err := r.db.Exec(ctx, `UPDATE users SET is_active = $1 WHERE id = $2`, *req.IsActive, id); err != nil {
			return fmt.Errorf("update is_active: %w", err)
		}
	}
	if req.IsAdmin != nil {
		if _, err := r.db.Exec(ctx, `UPDATE users SET is_admin = $1 WHERE id = $2`, *req.IsAdmin, id); err != nil {
			return fmt.Errorf("update is_admin: %w", err)
		}
	}
	return nil
}

func (r *Repository) BanUser(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE users SET is_active = false WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("ban user: %w", err)
	}
	// Delete all sessions
	_, err = r.db.Exec(ctx, `DELETE FROM sessions WHERE user_id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete sessions: %w", err)
	}
	return nil
}

func (r *Repository) GetPendingRegistrations(ctx context.Context, limit, offset int) ([]AdminUserResponse, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE approval_status = 'pending'`).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count pending: %w", err)
	}

	query := `
		SELECT u.id, u.email, u.display_name, u.storage_used, u.storage_limit,
		       u.plan, u.is_active, u.is_admin, u.email_verified, u.approval_status, u.last_login_at, u.created_at,
		       (SELECT COUNT(*) FROM files WHERE user_id = u.id AND trashed_at IS NULL) as file_count
		FROM users u
		WHERE u.approval_status = 'pending'
		ORDER BY u.created_at ASC
		LIMIT $1 OFFSET $2`

	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list pending: %w", err)
	}
	defer rows.Close()

	var users []AdminUserResponse
	for rows.Next() {
		var u AdminUserResponse
		if err := rows.Scan(
			&u.ID, &u.Email, &u.DisplayName, &u.StorageUsed, &u.StorageLimit,
			&u.Plan, &u.IsActive, &u.IsAdmin, &u.EmailVerified, &u.ApprovalStatus, &u.LastLoginAt, &u.CreatedAt,
			&u.FileCount,
		); err != nil {
			return nil, 0, fmt.Errorf("scan pending user: %w", err)
		}
		users = append(users, u)
	}

	return users, total, nil
}

func (r *Repository) UpdateApprovalStatus(ctx context.Context, userID uuid.UUID, status string) error {
	_, err := r.db.Exec(ctx, `UPDATE users SET approval_status = $1 WHERE id = $2`, status, userID)
	if err != nil {
		return fmt.Errorf("update approval status: %w", err)
	}
	return nil
}

func (r *Repository) GetStorageStats(ctx context.Context) (*StorageStats, error) {
	stats := &StorageStats{}

	// Totals
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(storage_used), 0), COALESCE(SUM(storage_limit), 0), COUNT(*)
		FROM users`).Scan(&stats.TotalUsed, &stats.TotalAllocated, &stats.UserCount)
	if err != nil {
		return nil, fmt.Errorf("storage totals: %w", err)
	}

	if stats.UserCount > 0 {
		stats.AvgPerUser = stats.TotalUsed / stats.UserCount
	}

	// Top 10 users by storage
	rows, err := r.db.Query(ctx, `
		SELECT u.id, u.email, u.storage_used,
		       (SELECT COUNT(*) FROM files WHERE user_id = u.id AND trashed_at IS NULL) as file_count
		FROM users u
		ORDER BY u.storage_used DESC
		LIMIT 10`)
	if err != nil {
		return nil, fmt.Errorf("top users: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var t TopUserStorage
		if err := rows.Scan(&t.ID, &t.Email, &t.StorageUsed, &t.FileCount); err != nil {
			return nil, fmt.Errorf("scan top user: %w", err)
		}
		stats.TopUsers = append(stats.TopUsers, t)
	}

	// By plan
	planRows, err := r.db.Query(ctx, `
		SELECT plan, COUNT(*), COALESCE(SUM(storage_used), 0)
		FROM users GROUP BY plan ORDER BY plan`)
	if err != nil {
		return nil, fmt.Errorf("plan stats: %w", err)
	}
	defer planRows.Close()

	for planRows.Next() {
		var p PlanStats
		if err := planRows.Scan(&p.Plan, &p.UserCount, &p.TotalUsed); err != nil {
			return nil, fmt.Errorf("scan plan: %w", err)
		}
		stats.ByPlan = append(stats.ByPlan, p)
	}

	return stats, nil
}

func (r *Repository) ListAuditLogs(ctx context.Context, limit, offset int, action, userID string) ([]AuditLogEntry, int64, error) {
	var total int64
	var countArgs []any
	countQuery := `SELECT COUNT(*) FROM audit_logs WHERE 1=1`
	argIdx := 1

	if action != "" {
		countQuery += fmt.Sprintf(` AND action = $%d`, argIdx)
		countArgs = append(countArgs, action)
		argIdx++
	}
	if userID != "" {
		countQuery += fmt.Sprintf(` AND user_id = $%d`, argIdx)
		countArgs = append(countArgs, userID)
		argIdx++
	}

	if err := r.db.QueryRow(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count audit logs: %w", err)
	}

	query := `
		SELECT a.id, a.user_id, u.email, a.action, a.resource_type, a.resource_id,
		       a.metadata, a.ip_address::text, a.created_at
		FROM audit_logs a
		LEFT JOIN users u ON u.id = a.user_id
		WHERE 1=1`
	args := make([]any, 0, len(countArgs)+2)
	argIdx = 1

	if action != "" {
		query += fmt.Sprintf(` AND a.action = $%d`, argIdx)
		args = append(args, action)
		argIdx++
	}
	if userID != "" {
		query += fmt.Sprintf(` AND a.user_id = $%d`, argIdx)
		args = append(args, userID)
		argIdx++
	}

	query += fmt.Sprintf(` ORDER BY a.created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list audit logs: %w", err)
	}
	defer rows.Close()

	var logs []AuditLogEntry
	for rows.Next() {
		var entry AuditLogEntry
		var metaJSON []byte
		if err := rows.Scan(
			&entry.ID, &entry.UserID, &entry.UserEmail, &entry.Action,
			&entry.ResourceType, &entry.ResourceID,
			&metaJSON, &entry.IPAddress, &entry.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan audit log: %w", err)
		}
		if metaJSON != nil {
			json.Unmarshal(metaJSON, &entry.Metadata)
		}
		logs = append(logs, entry)
	}

	return logs, total, nil
}

func (r *Repository) GetMimeTypeStats(ctx context.Context) ([]MimeTypeStats, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			CASE
				WHEN mime_type LIKE 'image/%' THEN 'Images'
				WHEN mime_type LIKE 'video/%' THEN 'Videos'
				WHEN mime_type LIKE 'audio/%' THEN 'Audio'
				WHEN mime_type LIKE 'application/pdf' THEN 'PDFs'
				WHEN mime_type LIKE 'text/%' THEN 'Text'
				ELSE 'Other'
			END as category,
			COUNT(*) as file_count,
			COALESCE(SUM(size), 0) as total_size
		FROM files WHERE trashed_at IS NULL
		GROUP BY category
		ORDER BY total_size DESC`)
	if err != nil {
		return nil, fmt.Errorf("mime stats: %w", err)
	}
	defer rows.Close()

	var stats []MimeTypeStats
	for rows.Next() {
		var s MimeTypeStats
		if err := rows.Scan(&s.MimeType, &s.FileCount, &s.TotalSize); err != nil {
			return nil, fmt.Errorf("scan mime stat: %w", err)
		}
		stats = append(stats, s)
	}
	return stats, nil
}

func (r *Repository) GetDailyUploadStats(ctx context.Context, days int) ([]DailyUploadStats, error) {
	rows, err := r.db.Query(ctx, `
		SELECT date_trunc('day', created_at)::date::text as day,
		       COUNT(*) as file_count,
		       COALESCE(SUM(size), 0) as total_bytes
		FROM files
		WHERE created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
		GROUP BY day
		ORDER BY day`, days)
	if err != nil {
		return nil, fmt.Errorf("daily uploads: %w", err)
	}
	defer rows.Close()

	var stats []DailyUploadStats
	for rows.Next() {
		var s DailyUploadStats
		if err := rows.Scan(&s.Date, &s.FileCount, &s.TotalBytes); err != nil {
			return nil, fmt.Errorf("scan daily stat: %w", err)
		}
		stats = append(stats, s)
	}
	return stats, nil
}

func (r *Repository) BulkUpdateUsers(ctx context.Context, ids []uuid.UUID, action string, plan string) (int64, error) {
	var query string
	var args []any

	switch action {
	case "ban":
		query = `UPDATE users SET is_active = false WHERE id = ANY($1)`
		args = []any{ids}
	case "activate":
		query = `UPDATE users SET is_active = true WHERE id = ANY($1)`
		args = []any{ids}
	case "deactivate":
		query = `UPDATE users SET is_active = false WHERE id = ANY($1)`
		args = []any{ids}
	case "set_plan":
		query = `UPDATE users SET plan = $2 WHERE id = ANY($1)`
		args = []any{ids, plan}
	default:
		return 0, fmt.Errorf("unknown action: %s", action)
	}

	tag, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk update: %w", err)
	}
	return tag.RowsAffected(), nil
}

func (r *Repository) GetUserActivity(ctx context.Context, userID uuid.UUID, limit, offset int) ([]AuditLogEntry, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM audit_logs WHERE user_id = $1`, userID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count user activity: %w", err)
	}

	rows, err := r.db.Query(ctx, `
		SELECT a.id, a.user_id, u.email, a.action, a.resource_type, a.resource_id,
		       a.metadata, a.ip_address::text, a.created_at
		FROM audit_logs a
		LEFT JOIN users u ON u.id = a.user_id
		WHERE a.user_id = $1
		ORDER BY a.created_at DESC
		LIMIT $2 OFFSET $3`, userID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list user activity: %w", err)
	}
	defer rows.Close()

	var logs []AuditLogEntry
	for rows.Next() {
		var entry AuditLogEntry
		var metaJSON []byte
		if err := rows.Scan(
			&entry.ID, &entry.UserID, &entry.UserEmail, &entry.Action,
			&entry.ResourceType, &entry.ResourceID,
			&metaJSON, &entry.IPAddress, &entry.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan activity: %w", err)
		}
		if metaJSON != nil {
			json.Unmarshal(metaJSON, &entry.Metadata)
		}
		logs = append(logs, entry)
	}

	return logs, total, nil
}

func (r *Repository) ListFiles(ctx context.Context, limit, offset int, search, userID, mimeFilter string) ([]AdminFileResponse, int64, error) {
	var total int64
	countQuery := `SELECT COUNT(*) FROM files f JOIN users u ON u.id = f.user_id WHERE 1=1`
	var countArgs []any
	argIdx := 1

	if search != "" {
		countQuery += fmt.Sprintf(` AND f.name ILIKE $%d`, argIdx)
		countArgs = append(countArgs, "%"+search+"%")
		argIdx++
	}
	if userID != "" {
		countQuery += fmt.Sprintf(` AND f.user_id = $%d`, argIdx)
		countArgs = append(countArgs, userID)
		argIdx++
	}
	if mimeFilter != "" {
		countQuery += fmt.Sprintf(` AND f.mime_type LIKE $%d`, argIdx)
		countArgs = append(countArgs, mimeFilter+"%")
		argIdx++
	}

	if err := r.db.QueryRow(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count files: %w", err)
	}

	query := `
		SELECT f.id, f.user_id, u.email, f.name, f.mime_type, f.size, f.folder_id, f.trashed_at, f.created_at
		FROM files f
		JOIN users u ON u.id = f.user_id
		WHERE 1=1`
	args := make([]any, 0)
	argIdx = 1

	if search != "" {
		query += fmt.Sprintf(` AND f.name ILIKE $%d`, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if userID != "" {
		query += fmt.Sprintf(` AND f.user_id = $%d`, argIdx)
		args = append(args, userID)
		argIdx++
	}
	if mimeFilter != "" {
		query += fmt.Sprintf(` AND f.mime_type LIKE $%d`, argIdx)
		args = append(args, mimeFilter+"%")
		argIdx++
	}

	query += fmt.Sprintf(` ORDER BY f.created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list files: %w", err)
	}
	defer rows.Close()

	var files []AdminFileResponse
	for rows.Next() {
		var f AdminFileResponse
		if err := rows.Scan(&f.ID, &f.UserID, &f.UserEmail, &f.Name, &f.MimeType, &f.Size, &f.FolderID, &f.TrashedAt, &f.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan file: %w", err)
		}
		files = append(files, f)
	}

	return files, total, nil
}

func (r *Repository) AdminDeleteFile(ctx context.Context, fileID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM files WHERE id = $1`, fileID)
	if err != nil {
		return fmt.Errorf("delete file: %w", err)
	}
	return nil
}

func (r *Repository) GetSettings(ctx context.Context) (*PlatformSettings, error) {
	settings := &PlatformSettings{
		DefaultStorageLimitFree:    5 * 1024 * 1024 * 1024,
		DefaultStorageLimitPro:     50 * 1024 * 1024 * 1024,
		DefaultStorageLimitPremium: 200 * 1024 * 1024 * 1024,
		MaxUploadSizeMB:            500,
		MaintenanceMode:            false,
		RequireApproval:            false,
		AllowRegistration:          true,
	}

	rows, err := r.db.Query(ctx, `SELECT key, value FROM platform_settings`)
	if err != nil {
		// Table may not exist yet, return defaults
		return settings, nil
	}
	defer rows.Close()

	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			continue
		}
		switch key {
		case "default_storage_limit_free":
			fmt.Sscanf(value, "%d", &settings.DefaultStorageLimitFree)
		case "default_storage_limit_pro":
			fmt.Sscanf(value, "%d", &settings.DefaultStorageLimitPro)
		case "default_storage_limit_premium":
			fmt.Sscanf(value, "%d", &settings.DefaultStorageLimitPremium)
		case "max_upload_size_mb":
			fmt.Sscanf(value, "%d", &settings.MaxUploadSizeMB)
		case "maintenance_mode":
			settings.MaintenanceMode = value == "true"
		case "require_approval":
			settings.RequireApproval = value == "true"
		case "allow_registration":
			settings.AllowRegistration = value == "true"
		}
	}

	return settings, nil
}

func (r *Repository) UpdateSettings(ctx context.Context, settings *PlatformSettings) error {
	pairs := map[string]string{
		"default_storage_limit_free":    fmt.Sprintf("%d", settings.DefaultStorageLimitFree),
		"default_storage_limit_pro":     fmt.Sprintf("%d", settings.DefaultStorageLimitPro),
		"default_storage_limit_premium": fmt.Sprintf("%d", settings.DefaultStorageLimitPremium),
		"max_upload_size_mb":            fmt.Sprintf("%d", settings.MaxUploadSizeMB),
		"maintenance_mode":              fmt.Sprintf("%v", settings.MaintenanceMode),
		"require_approval":              fmt.Sprintf("%v", settings.RequireApproval),
		"allow_registration":            fmt.Sprintf("%v", settings.AllowRegistration),
	}

	for key, value := range pairs {
		_, err := r.db.Exec(ctx, `
			INSERT INTO platform_settings (key, value) VALUES ($1, $2)
			ON CONFLICT (key) DO UPDATE SET value = $2`, key, value)
		if err != nil {
			return fmt.Errorf("update setting %s: %w", key, err)
		}
	}
	return nil
}

func (r *Repository) ListComments(ctx context.Context, limit, offset int, search string) ([]AdminComment, int64, error) {
	var total int64
	var countArgs []any
	countQuery := `SELECT COUNT(*) FROM file_comments fc JOIN files f ON fc.file_id = f.id JOIN users u ON fc.user_id = u.id WHERE 1=1`

	if search != "" {
		countQuery += ` AND (fc.content ILIKE $1 OR u.email ILIKE $1)`
		countArgs = append(countArgs, "%"+search+"%")
	}

	if err := r.db.QueryRow(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count comments: %w", err)
	}

	query := `
		SELECT fc.id, fc.file_id, f.name, fc.user_id, u.email, fc.content, fc.created_at
		FROM file_comments fc
		JOIN files f ON fc.file_id = f.id
		JOIN users u ON fc.user_id = u.id
		WHERE 1=1`
	var args []any
	argIdx := 1

	if search != "" {
		query += fmt.Sprintf(` AND (fc.content ILIKE $%d OR u.email ILIKE $%d)`, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	query += fmt.Sprintf(` ORDER BY fc.created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list comments: %w", err)
	}
	defer rows.Close()

	var comments []AdminComment
	for rows.Next() {
		var c AdminComment
		if err := rows.Scan(&c.ID, &c.FileID, &c.FileName, &c.UserID, &c.UserEmail, &c.Content, &c.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan comment: %w", err)
		}
		comments = append(comments, c)
	}

	return comments, total, nil
}

func (r *Repository) DeleteComment(ctx context.Context, commentID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM file_comments WHERE id = $1`, commentID)
	if err != nil {
		return fmt.Errorf("delete comment: %w", err)
	}
	return nil
}

func (r *Repository) GetCommentsCount(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM file_comments`).Scan(&count); err != nil {
		return 0, fmt.Errorf("comments count: %w", err)
	}
	return count, nil
}

func (r *Repository) GetStarredCount(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM file_stars`).Scan(&count); err != nil {
		return 0, fmt.Errorf("starred count: %w", err)
	}
	return count, nil
}

func (r *Repository) GetMostStarredFiles(ctx context.Context, limit int) ([]MostStarredFile, error) {
	rows, err := r.db.Query(ctx, `
		SELECT f.id, f.name, f.mime_type, u.email, COUNT(fs.user_id) as star_count
		FROM files f
		JOIN file_stars fs ON f.id = fs.file_id
		JOIN users u ON f.user_id = u.id
		GROUP BY f.id, f.name, f.mime_type, u.email
		ORDER BY star_count DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("most starred files: %w", err)
	}
	defer rows.Close()

	var files []MostStarredFile
	for rows.Next() {
		var f MostStarredFile
		if err := rows.Scan(&f.ID, &f.Name, &f.MimeType, &f.OwnerEmail, &f.StarCount); err != nil {
			return nil, fmt.Errorf("scan starred file: %w", err)
		}
		files = append(files, f)
	}
	return files, nil
}

func (r *Repository) GetAdSettings(ctx context.Context) (*AdSettings, error) {
	settings := &AdSettings{}

	rows, err := r.db.Query(ctx, `SELECT key, value FROM platform_settings WHERE key LIKE 'ad_%'`)
	if err != nil {
		return settings, nil
	}
	defer rows.Close()

	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			continue
		}
		switch key {
		case "ad_ads_enabled":
			settings.AdsEnabled = value == "true"
		case "ad_banner_ad_unit_id":
			settings.BannerAdUnitID = value
		case "ad_interstitial_ad_unit_id":
			settings.InterstitialAdID = value
		case "ad_rewarded_ad_unit_id":
			settings.RewardedAdID = value
		case "ad_frequency":
			fmt.Sscanf(value, "%d", &settings.AdFrequency)
		case "ad_web_ad_client":
			settings.WebAdClient = value
		case "ad_web_banner_slot":
			settings.WebBannerSlot = value
		case "ad_web_sidebar_slot":
			settings.WebSidebarSlot = value
		}
	}

	return settings, nil
}

func (r *Repository) UpdateAdSettings(ctx context.Context, settings *AdSettings) error {
	pairs := map[string]string{
		"ad_ads_enabled":            fmt.Sprintf("%v", settings.AdsEnabled),
		"ad_banner_ad_unit_id":      settings.BannerAdUnitID,
		"ad_interstitial_ad_unit_id": settings.InterstitialAdID,
		"ad_rewarded_ad_unit_id":    settings.RewardedAdID,
		"ad_frequency":              fmt.Sprintf("%d", settings.AdFrequency),
		"ad_web_ad_client":          settings.WebAdClient,
		"ad_web_banner_slot":        settings.WebBannerSlot,
		"ad_web_sidebar_slot":       settings.WebSidebarSlot,
	}

	for key, value := range pairs {
		_, err := r.db.Exec(ctx, `
			INSERT INTO platform_settings (key, value) VALUES ($1, $2)
			ON CONFLICT (key) DO UPDATE SET value = $2`, key, value)
		if err != nil {
			return fmt.Errorf("update ad setting %s: %w", key, err)
		}
	}
	return nil
}

func (r *Repository) GetAdAnalytics(ctx context.Context) (*AdAnalytics, error) {
	analytics := &AdAnalytics{}

	rows, err := r.db.Query(ctx, `SELECT plan, COUNT(*) FROM users WHERE is_active = true GROUP BY plan ORDER BY plan`)
	if err != nil {
		return nil, fmt.Errorf("ad analytics plan distribution: %w", err)
	}
	defer rows.Close()

	var totalActive int64
	for rows.Next() {
		var pc PlanCount
		if err := rows.Scan(&pc.Plan, &pc.Count); err != nil {
			return nil, fmt.Errorf("scan plan count: %w", err)
		}
		analytics.PlanDistribution = append(analytics.PlanDistribution, pc)
		totalActive += pc.Count

		if pc.Plan == "free" {
			analytics.TotalFreeUsers = pc.Count
		} else {
			analytics.TotalPaidUsers += pc.Count
		}
	}

	if totalActive > 0 {
		analytics.FreeUserPercentage = float64(analytics.TotalFreeUsers) / float64(totalActive) * 100
	}

	// Estimate impressions: free_users * 10 (avg daily sessions) * 3 (avg ads per session)
	analytics.EstimatedImpressions = analytics.TotalFreeUsers * 10 * 3

	// Estimate revenue: impressions * 0.002 (avg CPM $2)
	analytics.RevenueEstimate = float64(analytics.EstimatedImpressions) * 0.002

	return analytics, nil
}

func (r *Repository) GetSignupTrends(ctx context.Context, days int) ([]DailySignupStats, error) {
	rows, err := r.db.Query(ctx, `
		SELECT date_trunc('day', created_at)::date::text as day, COUNT(*) as count
		FROM users
		WHERE created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
		GROUP BY day
		ORDER BY day`, days)
	if err != nil {
		return nil, fmt.Errorf("signup trends: %w", err)
	}
	defer rows.Close()

	var stats []DailySignupStats
	for rows.Next() {
		var s DailySignupStats
		if err := rows.Scan(&s.Date, &s.Count); err != nil {
			return nil, fmt.Errorf("scan signup stat: %w", err)
		}
		stats = append(stats, s)
	}
	return stats, nil
}

// ── Post Moderation ──

func (r *Repository) ListPosts(ctx context.Context, limit, offset int, search, status string) ([]AdminPost, int64, error) {
	var total int64
	countQuery := `SELECT COUNT(*) FROM posts p JOIN users u ON u.id = p.user_id WHERE 1=1`
	var countArgs []any
	argIdx := 1

	if status != "" {
		countQuery += fmt.Sprintf(` AND p.status = $%d`, argIdx)
		countArgs = append(countArgs, status)
		argIdx++
	}
	if search != "" {
		countQuery += fmt.Sprintf(` AND (p.caption ILIKE $%d OR u.email ILIKE $%d)`, argIdx, argIdx)
		countArgs = append(countArgs, "%"+search+"%")
		argIdx++
	}

	if err := r.db.QueryRow(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count posts: %w", err)
	}

	query := `
		SELECT p.id, p.user_id, u.email, u.display_name, p.caption,
		       COALESCE(p.tags, '{}'), COALESCE(p.view_count, 0), COALESCE(p.like_count, 0),
		       p.status, COALESCE(f.name, ''), COALESCE(f.mime_type, ''), p.created_at
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		WHERE 1=1`
	args := make([]any, 0)
	argIdx = 1

	if status != "" {
		query += fmt.Sprintf(` AND p.status = $%d`, argIdx)
		args = append(args, status)
		argIdx++
	}
	if search != "" {
		query += fmt.Sprintf(` AND (p.caption ILIKE $%d OR u.email ILIKE $%d)`, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	query += fmt.Sprintf(` ORDER BY p.created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list posts: %w", err)
	}
	defer rows.Close()

	var posts []AdminPost
	for rows.Next() {
		var p AdminPost
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.UserEmail, &p.UserName, &p.Caption,
			&p.Tags, &p.ViewCount, &p.LikeCount,
			&p.Status, &p.FileName, &p.MimeType, &p.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan post: %w", err)
		}
		posts = append(posts, p)
	}

	return posts, total, nil
}

func (r *Repository) DeletePost(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM posts WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete post: %w", err)
	}
	return nil
}

func (r *Repository) UpdatePostStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := r.db.Exec(ctx, `UPDATE posts SET status = $1 WHERE id = $2`, status, id)
	if err != nil {
		return fmt.Errorf("update post status: %w", err)
	}
	return nil
}

func (r *Repository) GetPostsCount(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM posts`).Scan(&count); err != nil {
		return 0, fmt.Errorf("posts count: %w", err)
	}
	return count, nil
}

// ── Per-User Storage Breakdown ──

func (r *Repository) GetUserStorageBreakdown(ctx context.Context, userID uuid.UUID) (*UserStorageBreakdown, error) {
	breakdown := &UserStorageBreakdown{}

	err := r.db.QueryRow(ctx, `
		SELECT u.id, u.email, u.display_name, u.plan, u.storage_used, u.storage_limit,
		       (SELECT COUNT(*) FROM files WHERE user_id = u.id AND trashed_at IS NULL)
		FROM users u WHERE u.id = $1`, userID).Scan(
		&breakdown.UserID, &breakdown.Email, &breakdown.DisplayName,
		&breakdown.Plan, &breakdown.StorageUsed, &breakdown.StorageLimit,
		&breakdown.FileCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get user storage breakdown: %w", err)
	}

	rows, err := r.db.Query(ctx, `
		SELECT
			CASE
				WHEN mime_type LIKE 'image/%' THEN 'images'
				WHEN mime_type LIKE 'video/%' THEN 'videos'
				WHEN mime_type LIKE 'audio/%' THEN 'audio'
				WHEN mime_type LIKE 'application/pdf' OR mime_type LIKE 'application/msword%'
				     OR mime_type LIKE 'application/vnd.openxmlformats%' OR mime_type LIKE 'text/%' THEN 'documents'
				ELSE 'other'
			END as category,
			COUNT(*) as count,
			COALESCE(SUM(size), 0) as total_size
		FROM files
		WHERE user_id = $1 AND trashed_at IS NULL
		GROUP BY category
		ORDER BY total_size DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("user category usage: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var c UserCategoryUsage
		if err := rows.Scan(&c.Category, &c.Count, &c.Size); err != nil {
			return nil, fmt.Errorf("scan category usage: %w", err)
		}
		breakdown.Categories = append(breakdown.Categories, c)
	}

	return breakdown, nil
}

func (r *Repository) GetTopStorageUsers(ctx context.Context, limit int) ([]UserStorageBreakdown, error) {
	rows, err := r.db.Query(ctx, `
		SELECT u.id, u.email, u.display_name, u.plan, u.storage_used, u.storage_limit,
		       (SELECT COUNT(*) FROM files WHERE user_id = u.id AND trashed_at IS NULL) as file_count
		FROM users u
		ORDER BY u.storage_used DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("top storage users: %w", err)
	}
	defer rows.Close()

	var users []UserStorageBreakdown
	for rows.Next() {
		var u UserStorageBreakdown
		if err := rows.Scan(&u.UserID, &u.Email, &u.DisplayName, &u.Plan, &u.StorageUsed, &u.StorageLimit, &u.FileCount); err != nil {
			return nil, fmt.Errorf("scan top storage user: %w", err)
		}
		users = append(users, u)
	}

	return users, nil
}

// ── Notification Management ──

func (r *Repository) ListNotifications(ctx context.Context, limit, offset int, userID string, notifType string) ([]AdminNotification, int64, error) {
	var total int64
	countQuery := `SELECT COUNT(*) FROM notifications n JOIN users u ON u.id = n.user_id WHERE 1=1`
	var countArgs []any
	argIdx := 1

	if userID != "" {
		countQuery += fmt.Sprintf(` AND n.user_id = $%d`, argIdx)
		countArgs = append(countArgs, userID)
		argIdx++
	}
	if notifType != "" {
		countQuery += fmt.Sprintf(` AND n.type = $%d`, argIdx)
		countArgs = append(countArgs, notifType)
		argIdx++
	}

	if err := r.db.QueryRow(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count notifications: %w", err)
	}

	query := `
		SELECT n.id, n.user_id, u.email, n.type, n.title, n.message,
		       CASE WHEN n.read_at IS NOT NULL THEN true ELSE false END as is_read,
		       n.created_at
		FROM notifications n
		JOIN users u ON u.id = n.user_id
		WHERE 1=1`
	args := make([]any, 0)
	argIdx = 1

	if userID != "" {
		query += fmt.Sprintf(` AND n.user_id = $%d`, argIdx)
		args = append(args, userID)
		argIdx++
	}
	if notifType != "" {
		query += fmt.Sprintf(` AND n.type = $%d`, argIdx)
		args = append(args, notifType)
		argIdx++
	}

	query += fmt.Sprintf(` ORDER BY n.created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()

	var notifs []AdminNotification
	for rows.Next() {
		var n AdminNotification
		if err := rows.Scan(&n.ID, &n.UserID, &n.UserEmail, &n.Type, &n.Title, &n.Message, &n.IsRead, &n.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan notification: %w", err)
		}
		notifs = append(notifs, n)
	}

	return notifs, total, nil
}

func (r *Repository) DeleteNotification(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM notifications WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete notification: %w", err)
	}
	return nil
}

func (r *Repository) SendBroadcastNotification(ctx context.Context, notifType, title, message string) (int64, error) {
	tag, err := r.db.Exec(ctx, `
		INSERT INTO notifications (id, user_id, type, title, message, created_at)
		SELECT gen_random_uuid(), id, $1, $2, $3, NOW()
		FROM users WHERE is_active = true`, notifType, title, message)
	if err != nil {
		return 0, fmt.Errorf("broadcast notification: %w", err)
	}
	return tag.RowsAffected(), nil
}

func (r *Repository) SendUserNotification(ctx context.Context, userID uuid.UUID, notifType, title, message string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO notifications (id, user_id, type, title, message, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`, userID, notifType, title, message)
	if err != nil {
		return fmt.Errorf("send user notification: %w", err)
	}
	return nil
}

// ── Revenue / Billing Dashboard ──

func (r *Repository) GetRevenueStats(ctx context.Context) (*RevenueStats, error) {
	stats := &RevenueStats{}

	planPrices := map[string]float64{
		"pro":     9.99,
		"premium": 19.99,
	}

	rows, err := r.db.Query(ctx, `
		SELECT plan, COUNT(*) FROM users
		WHERE is_active = true AND plan != 'free'
		GROUP BY plan ORDER BY plan`)
	if err != nil {
		return nil, fmt.Errorf("revenue plan stats: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var pr PlanRevenue
		if err := rows.Scan(&pr.Plan, &pr.UserCount); err != nil {
			return nil, fmt.Errorf("scan plan revenue: %w", err)
		}
		pr.PriceMonth = planPrices[pr.Plan]
		pr.Revenue = float64(pr.UserCount) * pr.PriceMonth
		stats.TotalPaidUsers += pr.UserCount
		stats.MonthlyRevenue += pr.Revenue
		stats.PlanRevenue = append(stats.PlanRevenue, pr)
	}

	changeRows, err := r.db.Query(ctx, `
		SELECT a.user_id, u.email,
		       COALESCE(a.metadata->>'old_plan', ''), COALESCE(a.metadata->>'new_plan', ''),
		       a.created_at
		FROM audit_logs a
		JOIN users u ON u.id = a.user_id
		WHERE a.action = 'plan_change'
		ORDER BY a.created_at DESC
		LIMIT 20`)
	if err != nil {
		return nil, fmt.Errorf("recent upgrades: %w", err)
	}
	defer changeRows.Close()

	for changeRows.Next() {
		var pc PlanChange
		if err := changeRows.Scan(&pc.UserID, &pc.Email, &pc.OldPlan, &pc.NewPlan, &pc.ChangedAt); err != nil {
			return nil, fmt.Errorf("scan plan change: %w", err)
		}
		stats.RecentUpgrades = append(stats.RecentUpgrades, pc)
	}

	var churnedCount int64
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT user_id) FROM audit_logs
		WHERE action = 'plan_change'
		  AND metadata->>'new_plan' = 'free'
		  AND created_at >= CURRENT_DATE - INTERVAL '30 days'`).Scan(&churnedCount)
	if err == nil && stats.TotalPaidUsers > 0 {
		stats.ChurnRate = float64(churnedCount) / float64(stats.TotalPaidUsers+churnedCount) * 100
	}

	return stats, nil
}

// ── System Health ──

func (r *Repository) CheckDBHealth(ctx context.Context) (int, int, int64, error) {
	start := time.Now()
	if err := r.db.Ping(ctx); err != nil {
		return 0, 0, 0, fmt.Errorf("db ping: %w", err)
	}
	latencyMs := time.Since(start).Milliseconds()

	poolStats := r.db.Stat()
	activeConns := int(poolStats.AcquiredConns())
	maxConns := int(poolStats.MaxConns())

	return activeConns, maxConns, latencyMs, nil
}

// ── Export helpers ──

func (r *Repository) ExportAllUsers(ctx context.Context) ([]AdminUserResponse, error) {
	query := `
		SELECT u.id, u.email, u.display_name, u.storage_used, u.storage_limit,
		       u.plan, u.is_active, u.is_admin, u.email_verified, u.approval_status, u.last_login_at, u.created_at,
		       (SELECT COUNT(*) FROM files WHERE user_id = u.id AND trashed_at IS NULL) as file_count
		FROM users u
		ORDER BY u.created_at DESC`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("export users: %w", err)
	}
	defer rows.Close()

	var users []AdminUserResponse
	for rows.Next() {
		var u AdminUserResponse
		if err := rows.Scan(
			&u.ID, &u.Email, &u.DisplayName, &u.StorageUsed, &u.StorageLimit,
			&u.Plan, &u.IsActive, &u.IsAdmin, &u.EmailVerified, &u.ApprovalStatus, &u.LastLoginAt, &u.CreatedAt,
			&u.FileCount,
		); err != nil {
			return nil, fmt.Errorf("scan export user: %w", err)
		}
		users = append(users, u)
	}
	return users, nil
}

func (r *Repository) ExportAllFiles(ctx context.Context) ([]AdminFileResponse, error) {
	query := `
		SELECT f.id, f.user_id, u.email, f.name, f.mime_type, f.size, f.folder_id, f.trashed_at, f.created_at
		FROM files f
		JOIN users u ON u.id = f.user_id
		ORDER BY f.created_at DESC`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("export files: %w", err)
	}
	defer rows.Close()

	var files []AdminFileResponse
	for rows.Next() {
		var f AdminFileResponse
		if err := rows.Scan(&f.ID, &f.UserID, &f.UserEmail, &f.Name, &f.MimeType, &f.Size, &f.FolderID, &f.TrashedAt, &f.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan export file: %w", err)
		}
		files = append(files, f)
	}
	return files, nil
}

func (r *Repository) ExportAllPosts(ctx context.Context) ([]AdminPost, error) {
	query := `
		SELECT p.id, p.user_id, u.email, u.display_name, p.caption,
		       COALESCE(p.tags, '{}'), COALESCE(p.view_count, 0), COALESCE(p.like_count, 0),
		       p.status, COALESCE(f.name, ''), COALESCE(f.mime_type, ''), p.created_at
		FROM posts p
		JOIN users u ON u.id = p.user_id
		LEFT JOIN files f ON f.id = p.file_id
		ORDER BY p.created_at DESC`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("export posts: %w", err)
	}
	defer rows.Close()

	var posts []AdminPost
	for rows.Next() {
		var p AdminPost
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.UserEmail, &p.UserName, &p.Caption,
			&p.Tags, &p.ViewCount, &p.LikeCount,
			&p.Status, &p.FileName, &p.MimeType, &p.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan export post: %w", err)
		}
		posts = append(posts, p)
	}
	return posts, nil
}
