package common

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditLogger struct {
	db *pgxpool.Pool
}

func NewAuditLogger(db *pgxpool.Pool) *AuditLogger {
	return &AuditLogger{db: db}
}

func (a *AuditLogger) Log(ctx context.Context, userID *uuid.UUID, action, resourceType string, resourceID *uuid.UUID, metadata map[string]any, ipAddress string) {
	var metaJSON []byte
	if metadata != nil {
		metaJSON, _ = json.Marshal(metadata)
	}

	query := `
		INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6::inet)`

	var ip *string
	if ipAddress != "" {
		ip = &ipAddress
	}

	_, err := a.db.Exec(ctx, query, userID, action, resourceType, resourceID, metaJSON, ip)
	if err != nil {
		slog.Error("failed to write audit log", "action", action, "error", err)
	}
}

// Common audit actions
const (
	AuditUserRegister    = "user.register"
	AuditUserLogin       = "user.login"
	AuditUserLogout      = "user.logout"
	AuditFileCopy        = "file.copy"
	AuditFileUpload      = "file.upload"
	AuditFileDownload    = "file.download"
	AuditFileDelete      = "file.delete"
	AuditFileTrash       = "file.trash"
	AuditFileRestore     = "file.restore"
	AuditFolderCreate    = "folder.create"
	AuditFolderDelete    = "folder.delete"
	AuditShareCreate     = "share.create"
	AuditShareDelete     = "share.delete"
	AuditShareDownload   = "share.download"
	AuditUserLoginFailed   = "user.login_failed"
	AuditUserAccountLocked = "user.account_locked"
	AuditPasswordChanged   = "user.password_changed"
	AuditSessionRevoked    = "user.session_revoked"
	Audit2FAEnabled        = "user.2fa_enabled"
	Audit2FADisabled       = "user.2fa_disabled"
	Audit2FALoginVerified  = "user.2fa_login_verified"
	AuditAdminUserUpdate   = "admin.user.update"
	AuditAdminUserBan      = "admin.user.ban"
)
