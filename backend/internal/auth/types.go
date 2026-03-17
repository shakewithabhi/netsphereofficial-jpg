package auth

import (
	"time"

	"github.com/google/uuid"
)

// Request types

type RegisterRequest struct {
	Email       string `json:"email" validate:"required,email,max=255"`
	Password    string `json:"password" validate:"required,min=8,max=128"`
	DisplayName string `json:"display_name" validate:"omitempty,max=100"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8,max=128"`
}

type UpdateProfileRequest struct {
	DisplayName string `json:"display_name" validate:"omitempty,max=100"`
}

type GoogleLoginRequest struct {
	IDToken string `json:"id_token" validate:"required"`
}

// 2FA request types

type Enable2FAResponse struct {
	Secret      string   `json:"secret"`
	QRCodeURL   string   `json:"qr_code_url"`
	BackupCodes []string `json:"backup_codes"`
}

type Verify2FARequest struct {
	Code string `json:"code" validate:"required,len=6,numeric"`
}

type Disable2FARequest struct {
	Code string `json:"code" validate:"required"`
}

type TwoFactorLoginRequest struct {
	TempToken string `json:"temp_token" validate:"required"`
	Code      string `json:"code" validate:"required"`
}

type TwoFactorLoginResponse struct {
	RequiresTwoFactor bool   `json:"requires_two_factor"`
	TempToken         string `json:"temp_token"`
}

// Response types

type AuthResponse struct {
	User         UserResponse `json:"user,omitempty"`
	AccessToken  string       `json:"access_token,omitempty"`
	RefreshToken string       `json:"refresh_token,omitempty"`
	ExpiresIn    int64        `json:"expires_in,omitempty"` // seconds

	// 2FA challenge fields (present when 2FA is enabled and not yet verified)
	RequiresTwoFactor bool   `json:"requires_two_factor,omitempty"`
	TempToken         string `json:"temp_token,omitempty"`
}

type UserResponse struct {
	ID            uuid.UUID  `json:"id"`
	Email         string     `json:"email"`
	DisplayName   string     `json:"display_name,omitempty"`
	AvatarKey     string     `json:"avatar_key,omitempty"`
	StorageUsed   int64      `json:"storage_used"`
	StorageLimit  int64      `json:"storage_limit"`
	Plan          string     `json:"plan"`
	IsActive      bool       `json:"is_active"`
	IsAdmin       bool       `json:"is_admin"`
	EmailVerified    bool       `json:"email_verified"`
	TwoFactorEnabled bool       `json:"two_factor_enabled"`
	LastLoginAt      *time.Time `json:"last_login_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
}

// Domain models

type User struct {
	ID            uuid.UUID
	Email         string
	PasswordHash  string
	DisplayName   string
	AvatarKey     string
	StorageUsed   int64
	StorageLimit  int64
	Plan          string
	IsActive      bool
	IsAdmin       bool
	EmailVerified       bool
	GoogleID            string
	AuthProvider        string
	TOTPSecretEncrypted []byte
	TOTPEnabled         bool
	TOTPVerifiedAt      *time.Time
	FailedLoginAttempts int
	LockedUntil         *time.Time
	PasswordChangedAt   *time.Time
	LastLoginAt         *time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:            u.ID,
		Email:         u.Email,
		DisplayName:   u.DisplayName,
		AvatarKey:     u.AvatarKey,
		StorageUsed:   u.StorageUsed,
		StorageLimit:  u.StorageLimit,
		Plan:          u.Plan,
		IsActive:      u.IsActive,
		IsAdmin:       u.IsAdmin,
		EmailVerified:    u.EmailVerified,
		TwoFactorEnabled: u.TOTPEnabled,
		LastLoginAt:      u.LastLoginAt,
		CreatedAt:        u.CreatedAt,
	}
}

type Session struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	RefreshToken string
	DeviceName   string
	DeviceType   string
	IPAddress    string
	UserAgent    string
	ExpiresAt    time.Time
	CreatedAt    time.Time
}

type SessionResponse struct {
	ID         uuid.UUID `json:"id"`
	DeviceName string    `json:"device_name,omitempty"`
	DeviceType string    `json:"device_type,omitempty"`
	IPAddress  string    `json:"ip_address,omitempty"`
	UserAgent  string    `json:"user_agent,omitempty"`
	ExpiresAt  time.Time `json:"expires_at"`
	CreatedAt  time.Time `json:"created_at"`
}

// Password reset request types

type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8,max=128"`
}

// JWT claims

type TokenClaims struct {
	UserID  uuid.UUID `json:"sub"`
	Email   string    `json:"email"`
	Plan    string    `json:"plan"`
	IsAdmin bool      `json:"is_admin"`
}
