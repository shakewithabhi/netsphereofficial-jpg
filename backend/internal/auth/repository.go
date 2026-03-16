package auth

import (
	"context"
	"errors"
	"fmt"

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
		SELECT id, email, password_hash, display_name, avatar_key,
		       storage_used, storage_limit, plan, is_active, is_admin,
		       email_verified, last_login_at, created_at, updated_at
		FROM users WHERE email = $1`

	user := &User{}
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.AvatarKey,
		&user.StorageUsed, &user.StorageLimit, &user.Plan, &user.IsActive, &user.IsAdmin,
		&user.EmailVerified, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
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
		SELECT id, email, password_hash, display_name, avatar_key,
		       storage_used, storage_limit, plan, is_active, is_admin,
		       email_verified, last_login_at, created_at, updated_at
		FROM users WHERE id = $1`

	user := &User{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.DisplayName, &user.AvatarKey,
		&user.StorageUsed, &user.StorageLimit, &user.Plan, &user.IsActive, &user.IsAdmin,
		&user.EmailVerified, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
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

	err := r.db.QueryRow(ctx, query,
		session.UserID,
		session.RefreshToken,
		session.DeviceName,
		session.DeviceType,
		session.IPAddress,
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

	session := &Session{}
	err := r.db.QueryRow(ctx, query, refreshToken).Scan(
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
	_, err := r.db.Exec(ctx, query, refreshToken)
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
