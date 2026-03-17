package admin

import (
	"time"

	"github.com/google/uuid"
)

// Dashboard stats

type DashboardStats struct {
	TotalUsers      int64 `json:"total_users"`
	ActiveUsers     int64 `json:"active_users"`
	TotalFiles      int64 `json:"total_files"`
	TotalStorage    int64 `json:"total_storage_bytes"`
	UploadsToday    int64 `json:"uploads_today"`
	NewUsersToday   int64 `json:"new_users_today"`
	TrashedFiles    int64 `json:"trashed_files"`
	ActiveUploads   int64 `json:"active_uploads"`
}

// User management

type AdminUserResponse struct {
	ID             uuid.UUID  `json:"id"`
	Email          string     `json:"email"`
	DisplayName    string     `json:"display_name"`
	StorageUsed    int64      `json:"storage_used"`
	StorageLimit   int64      `json:"storage_limit"`
	Plan           string     `json:"plan"`
	IsActive       bool       `json:"is_active"`
	IsAdmin        bool       `json:"is_admin"`
	EmailVerified  bool       `json:"email_verified"`
	ApprovalStatus string     `json:"approval_status"`
	FileCount      int64      `json:"file_count"`
	LastLoginAt    *time.Time `json:"last_login_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

type UpdateUserRequest struct {
	Plan         *string `json:"plan,omitempty"`
	StorageLimit *int64  `json:"storage_limit,omitempty"`
	IsActive     *bool   `json:"is_active,omitempty"`
	IsAdmin      *bool   `json:"is_admin,omitempty"`
}

// Storage analytics

type StorageStats struct {
	TotalUsed       int64            `json:"total_used_bytes"`
	TotalAllocated  int64            `json:"total_allocated_bytes"`
	UserCount       int64            `json:"user_count"`
	AvgPerUser      int64            `json:"avg_per_user_bytes"`
	TopUsers        []TopUserStorage `json:"top_users"`
	ByPlan          []PlanStats      `json:"by_plan"`
}

type TopUserStorage struct {
	ID          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	StorageUsed int64     `json:"storage_used"`
	FileCount   int64     `json:"file_count"`
}

type PlanStats struct {
	Plan       string `json:"plan"`
	UserCount  int64  `json:"user_count"`
	TotalUsed  int64  `json:"total_used_bytes"`
}

// Extended analytics

type MimeTypeStats struct {
	MimeType  string `json:"mime_type"`
	FileCount int64  `json:"file_count"`
	TotalSize int64  `json:"total_size"`
}

type DailyUploadStats struct {
	Date       string `json:"date"`
	FileCount  int64  `json:"file_count"`
	TotalBytes int64  `json:"total_bytes"`
}

// Bulk user action
type BulkUserActionRequest struct {
	UserIDs []uuid.UUID `json:"user_ids" validate:"required,min=1"`
	Action  string      `json:"action" validate:"required,oneof=ban activate deactivate set_plan"`
	Plan    string      `json:"plan,omitempty"`
}

// Admin file listing
type AdminFileResponse struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	UserEmail string     `json:"user_email"`
	Name      string     `json:"name"`
	MimeType  string     `json:"mime_type"`
	Size      int64      `json:"size"`
	FolderID  *uuid.UUID `json:"folder_id"`
	TrashedAt *time.Time `json:"trashed_at"`
	CreatedAt time.Time  `json:"created_at"`
}

// Platform settings
type PlatformSettings struct {
	DefaultStorageLimitFree    int64  `json:"default_storage_limit_free"`
	DefaultStorageLimitPro     int64  `json:"default_storage_limit_pro"`
	DefaultStorageLimitPremium int64  `json:"default_storage_limit_premium"`
	MaxUploadSizeMB            int64  `json:"max_upload_size_mb"`
	MaintenanceMode            bool   `json:"maintenance_mode"`
	RequireApproval            bool   `json:"require_approval"`
	AllowRegistration          bool   `json:"allow_registration"`
}

// Signup trends
type DailySignupStats struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// Audit logs

type AuditLogEntry struct {
	ID           int64      `json:"id"`
	UserID       *uuid.UUID `json:"user_id"`
	UserEmail    *string    `json:"user_email"`
	Action       string     `json:"action"`
	ResourceType *string    `json:"resource_type"`
	ResourceID   *uuid.UUID `json:"resource_id"`
	Metadata     any        `json:"metadata"`
	IPAddress    *string    `json:"ip_address"`
	CreatedAt    time.Time  `json:"created_at"`
}
