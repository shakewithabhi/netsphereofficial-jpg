package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// hashToken returns the SHA-256 hex digest of a refresh token.
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// User operations

func (r *Repository) CreateUser(ctx context.Context, user *User) error {
	query := `
		INSERT INTO users (email, password_hash, display_name, storage_limit)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at`

	err := r.db.QueryRow(ctx, query,
		user.Email,
		user.PasswordHash,
		user.DisplayName,
		user.StorageLimit,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	query := `
		SELECT id, email, password_hash, COALESCE(display_name, ''), COALESCE(avatar_key, ''),
		       storage_used, storage_limit, plan, is_active, is_admin,
		       email_verified, totp_secret_encrypted, totp_enabled, totp_verified_at,
		       failed_login_attempts, locked_until, password_changed_at,
		       last_login_at, created_at, updated_at
		FROM users WHERE email = $1`

	user := &User{}
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.AvatarKey,
		&user.StorageUsed, &user.StorageLimit, &user.Plan, &user.IsActive, &user.IsAdmin,
		&user.EmailVerified, &user.TOTPSecretEncrypted, &user.TOTPEnabled, &user.TOTPVerifiedAt,
		&user.FailedLoginAttempts, &user.LockedUntil, &user.PasswordChangedAt,
		&user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get user by email: %w", err)
	}
	return user, nil
}

func (r *Repository) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	query := `
		SELECT id, email, password_hash, COALESCE(display_name, ''), COALESCE(avatar_key, ''),
		       storage_used, storage_limit, plan, is_active, is_admin,
		       email_verified, totp_secret_encrypted, totp_enabled, totp_verified_at,
		       failed_login_attempts, locked_until, password_changed_at,
		       last_login_at, created_at, updated_at
		FROM users WHERE id = $1`

	user := &User{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.AvatarKey,
		&user.StorageUsed, &user.StorageLimit, &user.Plan, &user.IsActive, &user.IsAdmin,
		&user.EmailVerified, &user.TOTPSecretEncrypted, &user.TOTPEnabled, &user.TOTPVerifiedAt,
		&user.FailedLoginAttempts, &user.LockedUntil, &user.PasswordChangedAt,
		&user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return user, nil
}

func (r *Repository) UpdateLastLogin(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE users SET last_login_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("update last login: %w", err)
	}
	return nil
}

func (r *Repository) UpdateProfile(ctx context.Context, userID uuid.UUID, displayName string) error {
	query := `UPDATE users SET display_name = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, displayName, userID)
	if err != nil {
		return fmt.Errorf("update profile: %w", err)
	}
	return nil
}

func (r *Repository) UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	query := `UPDATE users SET password_hash = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, passwordHash, userID)
	if err != nil {
		return fmt.Errorf("update password: %w", err)
	}
	return nil
}

func (r *Repository) GetUserByGoogleID(ctx context.Context, googleID string) (*User, error) {
	query := `
		SELECT id, email, password_hash, display_name, avatar_key,
		       storage_used, storage_limit, plan, is_active, is_admin,
		       email_verified, COALESCE(google_id, ''), COALESCE(auth_provider, 'email'),
		       last_login_at, created_at, updated_at
		FROM users WHERE google_id = $1`

	user := &User{}
	err := r.db.QueryRow(ctx, query, googleID).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.AvatarKey,
		&user.StorageUsed, &user.StorageLimit, &user.Plan, &user.IsActive, &user.IsAdmin,
		&user.EmailVerified, &user.GoogleID, &user.AuthProvider,
		&user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get user by google id: %w", err)
	}
	return user, nil
}

func (r *Repository) CreateGoogleUser(ctx context.Context, user *User) error {
	query := `
		INSERT INTO users (email, password_hash, display_name, storage_limit, google_id, auth_provider, email_verified)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at`

	err := r.db.QueryRow(ctx, query,
		user.Email,
		user.PasswordHash,
		user.DisplayName,
		user.StorageLimit,
		user.GoogleID,
		user.AuthProvider,
		user.EmailVerified,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create google user: %w", err)
	}
	return nil
}

func (r *Repository) LinkGoogleAccount(ctx context.Context, userID uuid.UUID, googleID string) error {
	query := `UPDATE users SET google_id = $1, auth_provider = 'google' WHERE id = $2`
	_, err := r.db.Exec(ctx, query, googleID, userID)
	if err != nil {
		return fmt.Errorf("link google account: %w", err)
	}
	return nil
}

func (r *Repository) EmailExists(ctx context.Context, email string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`
	var exists bool
	err := r.db.QueryRow(ctx, query, email).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check email exists: %w", err)
	}
	return exists, nil
}

// Session operations

func (r *Repository) CreateSession(ctx context.Context, session *Session) error {
	query := `
		INSERT INTO sessions (user_id, refresh_token, device_name, device_type, ip_address, user_agent, expires_at)
		VALUES ($1, $2, $3, $4, $5::inet, $6, $7)
		RETURNING id, created_at`

	// Store hashed refresh token in DB
	tokenHash := hashToken(session.RefreshToken)

	// PostgreSQL INET type rejects empty string; use nil instead
	var ipAddr *string
	if session.IPAddress != "" {
		ipAddr = &session.IPAddress
	}

	err := r.db.QueryRow(ctx, query,
		session.UserID,
		tokenHash,
		session.DeviceName,
		session.DeviceType,
		ipAddr,
		session.UserAgent,
		session.ExpiresAt,
	).Scan(&session.ID, &session.CreatedAt)
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

func (r *Repository) GetSessionByToken(ctx context.Context, refreshToken string) (*Session, error) {
	query := `
		SELECT id, user_id, refresh_token, device_name, device_type,
		       ip_address::text, user_agent, expires_at, created_at
		FROM sessions
		WHERE refresh_token = $1 AND expires_at > NOW()`

	tokenHash := hashToken(refreshToken)

	session := &Session{}
	err := r.db.QueryRow(ctx, query, tokenHash).Scan(
		&session.ID, &session.UserID, &session.RefreshToken,
		&session.DeviceName, &session.DeviceType,
		&session.IPAddress, &session.UserAgent,
		&session.ExpiresAt, &session.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get session by token: %w", err)
	}
	return session, nil
}

func (r *Repository) DeleteSession(ctx context.Context, refreshToken string) error {
	query := `DELETE FROM sessions WHERE refresh_token = $1`
	tokenHash := hashToken(refreshToken)
	_, err := r.db.Exec(ctx, query, tokenHash)
	if err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

func (r *Repository) DeleteUserSessions(ctx context.Context, userID uuid.UUID) error {
	query := `DELETE FROM sessions WHERE user_id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("delete user sessions: %w", err)
	}
	return nil
}

func (r *Repository) ListUserSessions(ctx context.Context, userID uuid.UUID) ([]Session, error) {
	query := `
		SELECT id, user_id, refresh_token, device_name, device_type,
		       ip_address::text, user_agent, expires_at, created_at
		FROM sessions
		WHERE user_id = $1 AND expires_at > NOW()
		ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("list user sessions: %w", err)
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var s Session
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.RefreshToken,
			&s.DeviceName, &s.DeviceType,
			&s.IPAddress, &s.UserAgent,
			&s.ExpiresAt, &s.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan session: %w", err)
		}
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (r *Repository) DeleteSessionByID(ctx context.Context, id, userID uuid.UUID) error {
	query := `DELETE FROM sessions WHERE id = $1 AND user_id = $2`
	result, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("delete session by id: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("session not found")
	}
	return nil
}

func (r *Repository) DeleteExpiredSessions(ctx context.Context) (int64, error) {
	query := `DELETE FROM sessions WHERE expires_at < NOW()`
	result, err := r.db.Exec(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("delete expired sessions: %w", err)
	}
	return result.RowsAffected(), nil
}

// Account lockout operations

func (r *Repository) IncrementFailedAttempts(ctx context.Context, userID uuid.UUID) (int, error) {
	query := `UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1 RETURNING failed_login_attempts`
	var count int
	err := r.db.QueryRow(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("increment failed attempts: %w", err)
	}
	return count, nil
}

func (r *Repository) ResetFailedAttempts(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("reset failed attempts: %w", err)
	}
	return nil
}

func (r *Repository) LockAccount(ctx context.Context, userID uuid.UUID, until time.Time) error {
	query := `UPDATE users SET locked_until = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, until, userID)
	if err != nil {
		return fmt.Errorf("lock account: %w", err)
	}
	return nil
}

func (r *Repository) SetPasswordChangedAt(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE users SET password_changed_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("set password changed at: %w", err)
	}
	return nil
}

// 2FA operations

func (r *Repository) SetTOTPSecret(ctx context.Context, userID uuid.UUID, encrypted []byte) error {
	query := `UPDATE users SET totp_secret_encrypted = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, encrypted, userID)
	if err != nil {
		return fmt.Errorf("set totp secret: %w", err)
	}
	return nil
}

func (r *Repository) EnableTOTP(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE users SET totp_enabled = true, totp_verified_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("enable totp: %w", err)
	}
	return nil
}

func (r *Repository) DisableTOTP(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE users SET totp_enabled = false, totp_secret_encrypted = NULL, totp_verified_at = NULL WHERE id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("disable totp: %w", err)
	}
	return nil
}

func (r *Repository) CreateRecoveryCodes(ctx context.Context, userID uuid.UUID, codeHashes []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Delete existing codes
	_, err = tx.Exec(ctx, `DELETE FROM recovery_codes WHERE user_id = $1`, userID)
	if err != nil {
		return fmt.Errorf("delete old recovery codes: %w", err)
	}

	// Insert new codes
	for _, hash := range codeHashes {
		_, err = tx.Exec(ctx,
			`INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)`,
			userID, hash,
		)
		if err != nil {
			return fmt.Errorf("insert recovery code: %w", err)
		}
	}

	return tx.Commit(ctx)
}

func (r *Repository) UseRecoveryCode(ctx context.Context, userID uuid.UUID, codeHash string) (bool, error) {
	query := `UPDATE recovery_codes SET used_at = NOW() WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL`
	result, err := r.db.Exec(ctx, query, userID, codeHash)
	if err != nil {
		return false, fmt.Errorf("use recovery code: %w", err)
	}
	return result.RowsAffected() > 0, nil
}

// Password reset token operations

func (r *Repository) CreatePasswordResetToken(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) error {
	query := `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`
	_, err := r.db.Exec(ctx, query, userID, tokenHash, expiresAt)
	if err != nil {
		return fmt.Errorf("create password reset token: %w", err)
	}
	return nil
}

func (r *Repository) GetPasswordResetToken(ctx context.Context, tokenHash string) (uuid.UUID, uuid.UUID, error) {
	query := `
		SELECT id, user_id
		FROM password_reset_tokens
		WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL`

	var id, userID uuid.UUID
	err := r.db.QueryRow(ctx, query, tokenHash).Scan(&id, &userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, uuid.Nil, nil
		}
		return uuid.Nil, uuid.Nil, fmt.Errorf("get password reset token: %w", err)
	}
	return id, userID, nil
}

func (r *Repository) MarkPasswordResetTokenUsed(ctx context.Context, tokenID uuid.UUID) error {
	query := `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, tokenID)
	if err != nil {
		return fmt.Errorf("mark password reset token used: %w", err)
	}
	return nil
}

func (r *Repository) CountUnusedRecoveryCodes(ctx context.Context, userID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL`
	var count int
	err := r.db.QueryRow(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count unused recovery codes: %w", err)
	}
	return count, nil
}

// Email verification operations

func (r *Repository) SetVerificationToken(ctx context.Context, userID uuid.UUID, token string) error {
	query := `UPDATE users SET verification_token = $1, verification_sent_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, token, userID)
	if err != nil {
		return fmt.Errorf("set verification token: %w", err)
	}
	return nil
}

func (r *Repository) GetUserByVerificationToken(ctx context.Context, token string) (*User, error) {
	query := `
		SELECT id, email, password_hash, COALESCE(display_name, ''), COALESCE(avatar_key, ''),
		       storage_used, storage_limit, plan, is_active, is_admin,
		       email_verified, totp_secret_encrypted, totp_enabled, totp_verified_at,
		       failed_login_attempts, locked_until, password_changed_at,
		       last_login_at, created_at, updated_at
		FROM users WHERE verification_token = $1`

	user := &User{}
	err := r.db.QueryRow(ctx, query, token).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.AvatarKey,
		&user.StorageUsed, &user.StorageLimit, &user.Plan, &user.IsActive, &user.IsAdmin,
		&user.EmailVerified, &user.TOTPSecretEncrypted, &user.TOTPEnabled, &user.TOTPVerifiedAt,
		&user.FailedLoginAttempts, &user.LockedUntil, &user.PasswordChangedAt,
		&user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get user by verification token: %w", err)
	}
	return user, nil
}

func (r *Repository) VerifyEmail(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE users SET email_verified = true, verification_token = NULL WHERE id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("verify email: %w", err)
	}
	return nil
}

// Avatar operations

func (r *Repository) UpdateAvatarKey(ctx context.Context, userID uuid.UUID, avatarKey string) error {
	query := `UPDATE users SET avatar_key = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, avatarKey, userID)
	if err != nil {
		return fmt.Errorf("update avatar key: %w", err)
	}
	return nil
}

// Approval status operations

func (r *Repository) SetApprovalStatus(ctx context.Context, userID uuid.UUID, status string) error {
	query := `UPDATE users SET approval_status = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, status, userID)
	if err != nil {
		return fmt.Errorf("set approval status: %w", err)
	}
	return nil
}

func (r *Repository) GetApprovalStatus(ctx context.Context, userID uuid.UUID) (string, error) {
	query := `SELECT approval_status FROM users WHERE id = $1`
	var status string
	err := r.db.QueryRow(ctx, query, userID).Scan(&status)
	if err != nil {
		return "", fmt.Errorf("get approval status: %w", err)
	}
	return status, nil
}
