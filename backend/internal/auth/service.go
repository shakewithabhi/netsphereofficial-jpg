package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"github.com/pquerna/otp/totp"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"

	"github.com/bytebox/backend/internal/common"
	"github.com/bytebox/backend/internal/platform/config"
)

// dummyHash is used for constant-time defense against user enumeration.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy-password-for-timing"), 12)

type googleTokenInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Aud           string `json:"aud"`
}

type Service struct {
	repo              *Repository
	jwt               *JWTManager
	audit             *common.AuditLogger
	rdb               *redis.Client
	bcryptCost        int
	quotaSize         int64
	googleClientID    string
	totpEncryptionKey string
}

func NewService(repo *Repository, jwt *JWTManager, audit *common.AuditLogger, rdb *redis.Client, cfg config.AppConfig, authCfg config.AuthConfig, googleClientID string) *Service {
	return &Service{
		repo:              repo,
		jwt:               jwt,
		audit:             audit,
		rdb:               rdb,
		bcryptCost:        authCfg.BcryptCost,
		quotaSize:         cfg.DefaultQuotaSize,
		googleClientID:    googleClientID,
		totpEncryptionKey: authCfg.TOTPEncryptionKey,
	}
}

// validatePasswordStrength enforces strict password complexity.
func validatePasswordStrength(password string) error {
	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, ch := range password {
		switch {
		case unicode.IsUpper(ch):
			hasUpper = true
		case unicode.IsLower(ch):
			hasLower = true
		case unicode.IsDigit(ch):
			hasDigit = true
		case unicode.IsPunct(ch) || unicode.IsSymbol(ch):
			hasSpecial = true
		}
	}
	if len(password) < 8 {
		return common.ErrBadRequest("password must be at least 8 characters")
	}
	if !hasUpper {
		return common.ErrBadRequest("password must contain at least one uppercase letter")
	}
	if !hasLower {
		return common.ErrBadRequest("password must contain at least one lowercase letter")
	}
	if !hasDigit {
		return common.ErrBadRequest("password must contain at least one digit")
	}
	if !hasSpecial {
		return common.ErrBadRequest("password must contain at least one special character")
	}
	return nil
}

// lockoutDuration returns the lockout duration based on the number of failed attempts.
func lockoutDuration(failedAttempts int) time.Duration {
	switch {
	case failedAttempts >= 15:
		return 1 * time.Hour
	case failedAttempts >= 10:
		return 30 * time.Minute
	default:
		return 5 * time.Minute
	}
}

func (s *Service) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))

	if err := validatePasswordStrength(req.Password); err != nil {
		return nil, err
	}

	exists, err := s.repo.EmailExists(ctx, email)
	if err != nil {
		return nil, common.ErrInternal("failed to check email")
	}
	if exists {
		return nil, common.ErrConflict("email already registered")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), s.bcryptCost)
	if err != nil {
		return nil, common.ErrInternal("failed to hash password")
	}

	user := &User{
		Email:        email,
		PasswordHash: string(hash),
		DisplayName:  strings.TrimSpace(req.DisplayName),
		StorageLimit: s.quotaSize,
		Plan:         "free",
		IsActive:     true,
	}

	if err := s.repo.CreateUser(ctx, user); err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return nil, common.ErrConflict("email already registered")
		}
		slog.Error("failed to create user", "error", err)
		return nil, common.ErrInternal("failed to create account")
	}

	s.audit.Log(ctx, &user.ID, common.AuditUserRegister, "user", &user.ID, nil, "")

	return s.generateAuthResponse(ctx, user, "", "", "", "")
}

func (s *Service) Login(ctx context.Context, req LoginRequest, ip, userAgent, deviceName, deviceType string) (*AuthResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))

	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		slog.Error("failed to get user", "error", err)
		return nil, common.ErrInternal("login failed")
	}

	// Constant-time defense: run bcrypt even if user doesn't exist to prevent timing-based enumeration
	if user == nil {
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(req.Password))
		s.audit.Log(ctx, nil, common.AuditUserLoginFailed, "user", nil, map[string]any{"email": email, "reason": "unknown_email"}, ip)
		return nil, common.ErrUnauthorized("invalid email or password")
	}

	if !user.IsActive {
		return nil, common.ErrForbidden("account is disabled")
	}

	// Check account lockout
	if user.LockedUntil != nil && user.LockedUntil.After(time.Now()) {
		remaining := time.Until(*user.LockedUntil).Round(time.Second)
		return nil, common.ErrForbidden(fmt.Sprintf("account temporarily locked, try again in %s", remaining))
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		// Increment failed attempts and potentially lock account
		count, incrErr := s.repo.IncrementFailedAttempts(ctx, user.ID)
		if incrErr != nil {
			slog.Error("failed to increment failed attempts", "error", incrErr)
		}

		s.audit.Log(ctx, &user.ID, common.AuditUserLoginFailed, "user", &user.ID, map[string]any{"attempt": count}, ip)

		if count >= 5 {
			duration := lockoutDuration(count)
			until := time.Now().Add(duration)
			if lockErr := s.repo.LockAccount(ctx, user.ID, until); lockErr != nil {
				slog.Error("failed to lock account", "error", lockErr)
			}
			s.audit.Log(ctx, &user.ID, common.AuditUserAccountLocked, "user", &user.ID, map[string]any{"duration": duration.String(), "attempts": count}, ip)
			return nil, common.ErrForbidden(fmt.Sprintf("account locked due to too many failed attempts, try again in %s", duration.Round(time.Second)))
		}

		return nil, common.ErrUnauthorized("invalid email or password")
	}

	// Successful login: reset failed attempts
	if user.FailedLoginAttempts > 0 {
		if err := s.repo.ResetFailedAttempts(ctx, user.ID); err != nil {
			slog.Error("failed to reset failed attempts", "error", err)
		}
	}

	// Check if 2FA is enabled
	if user.TOTPEnabled {
		tempToken := uuid.New().String()
		if err := s.rdb.Set(ctx, "2fa:"+tempToken, user.ID.String(), 5*time.Minute).Err(); err != nil {
			slog.Error("failed to store 2fa temp token", "error", err)
			return nil, common.ErrInternal("login failed")
		}
		return &AuthResponse{
			RequiresTwoFactor: true,
			TempToken:         tempToken,
		}, nil
	}

	if err := s.repo.UpdateLastLogin(ctx, user.ID); err != nil {
		slog.Error("failed to update last login", "error", err)
	}

	s.audit.Log(ctx, &user.ID, common.AuditUserLogin, "user", &user.ID, map[string]any{"ip": ip, "device": deviceName}, ip)

	return s.generateAuthResponse(ctx, user, ip, userAgent, deviceName, deviceType)
}

func (s *Service) Refresh(ctx context.Context, req RefreshRequest, ip, userAgent, deviceName, deviceType string) (*AuthResponse, error) {
	session, err := s.repo.GetSessionByToken(ctx, req.RefreshToken)
	if err != nil {
		slog.Error("failed to get session", "error", err)
		return nil, common.ErrInternal("refresh failed")
	}
	if session == nil {
		return nil, common.ErrUnauthorized("invalid or expired refresh token")
	}

	// Rotate: delete old session
	if err := s.repo.DeleteSession(ctx, req.RefreshToken); err != nil {
		slog.Error("failed to delete old session", "error", err)
	}

	user, err := s.repo.GetUserByID(ctx, session.UserID)
	if err != nil || user == nil {
		return nil, common.ErrUnauthorized("user not found")
	}

	if !user.IsActive {
		return nil, common.ErrForbidden("account is disabled")
	}

	return s.generateAuthResponse(ctx, user, ip, userAgent, deviceName, deviceType)
}

func (s *Service) Logout(ctx context.Context, claims *TokenClaims, refreshToken string) error {
	if err := s.repo.DeleteSession(ctx, refreshToken); err != nil {
		slog.Error("failed to delete session", "error", err)
		return common.ErrInternal("logout failed")
	}

	if claims != nil {
		s.audit.Log(ctx, &claims.UserID, common.AuditUserLogout, "user", &claims.UserID, nil, "")
	}

	return nil
}

func (s *Service) GetProfile(ctx context.Context, claims *TokenClaims) (*UserResponse, error) {
	user, err := s.repo.GetUserByID(ctx, claims.UserID)
	if err != nil || user == nil {
		return nil, common.ErrNotFound("user not found")
	}
	resp := user.ToResponse()
	return &resp, nil
}

func (s *Service) UpdateProfile(ctx context.Context, claims *TokenClaims, req UpdateProfileRequest) (*UserResponse, error) {
	if err := s.repo.UpdateProfile(ctx, claims.UserID, strings.TrimSpace(req.DisplayName)); err != nil {
		slog.Error("failed to update profile", "error", err)
		return nil, common.ErrInternal("failed to update profile")
	}

	user, err := s.repo.GetUserByID(ctx, claims.UserID)
	if err != nil || user == nil {
		return nil, common.ErrNotFound("user not found")
	}
	resp := user.ToResponse()
	return &resp, nil
}

func (s *Service) ChangePassword(ctx context.Context, claims *TokenClaims, req ChangePasswordRequest) error {
	if err := validatePasswordStrength(req.NewPassword); err != nil {
		return err
	}

	user, err := s.repo.GetUserByID(ctx, claims.UserID)
	if err != nil || user == nil {
		return common.ErrNotFound("user not found")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.OldPassword)); err != nil {
		return common.ErrUnauthorized("incorrect current password")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), s.bcryptCost)
	if err != nil {
		return common.ErrInternal("failed to hash password")
	}

	if err := s.repo.UpdatePassword(ctx, claims.UserID, string(hash)); err != nil {
		slog.Error("failed to update password", "error", err)
		return common.ErrInternal("failed to change password")
	}

	if err := s.repo.SetPasswordChangedAt(ctx, claims.UserID); err != nil {
		slog.Error("failed to set password changed at", "error", err)
	}

	// Invalidate all sessions on password change
	if err := s.repo.DeleteUserSessions(ctx, claims.UserID); err != nil {
		slog.Error("failed to delete user sessions", "error", err)
	}

	s.audit.Log(ctx, &claims.UserID, common.AuditPasswordChanged, "user", &claims.UserID, nil, "")

	return nil
}

func (s *Service) ListSessions(ctx context.Context, claims *TokenClaims) ([]SessionResponse, error) {
	sessions, err := s.repo.ListUserSessions(ctx, claims.UserID)
	if err != nil {
		slog.Error("failed to list sessions", "error", err)
		return nil, common.ErrInternal("failed to list sessions")
	}

	result := make([]SessionResponse, len(sessions))
	for i, sess := range sessions {
		result[i] = SessionResponse{
			ID:         sess.ID,
			DeviceName: sess.DeviceName,
			DeviceType: sess.DeviceType,
			IPAddress:  sess.IPAddress,
			UserAgent:  sess.UserAgent,
			ExpiresAt:  sess.ExpiresAt,
			CreatedAt:  sess.CreatedAt,
		}
	}
	return result, nil
}

func (s *Service) RevokeSession(ctx context.Context, claims *TokenClaims, sessionID uuid.UUID) error {
	if err := s.repo.DeleteSessionByID(ctx, sessionID, claims.UserID); err != nil {
		return common.ErrNotFound("session not found")
	}

	s.audit.Log(ctx, &claims.UserID, common.AuditSessionRevoked, "session", &sessionID, nil, "")

	return nil
}

func (s *Service) Enable2FA(ctx context.Context, claims *TokenClaims) (*Enable2FAResponse, error) {
	user, err := s.repo.GetUserByID(ctx, claims.UserID)
	if err != nil || user == nil {
		return nil, common.ErrNotFound("user not found")
	}

	if user.TOTPEnabled {
		return nil, common.ErrBadRequest("two-factor authentication is already enabled")
	}

	// Generate TOTP key
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "ByteBox",
		AccountName: user.Email,
	})
	if err != nil {
		slog.Error("failed to generate totp key", "error", err)
		return nil, common.ErrInternal("failed to generate 2FA secret")
	}

	// Encrypt and store the secret
	encrypted, err := encryptTOTPSecret(s.totpEncryptionKey, key.Secret())
	if err != nil {
		slog.Error("failed to encrypt totp secret", "error", err)
		return nil, common.ErrInternal("failed to setup 2FA")
	}

	if err := s.repo.SetTOTPSecret(ctx, claims.UserID, encrypted); err != nil {
		slog.Error("failed to store totp secret", "error", err)
		return nil, common.ErrInternal("failed to setup 2FA")
	}

	// Generate recovery codes
	var codes []string
	var codeHashes []string
	for i := 0; i < 8; i++ {
		code, err := generateRecoveryCode()
		if err != nil {
			return nil, common.ErrInternal("failed to generate recovery codes")
		}
		codes = append(codes, code)
		codeHashes = append(codeHashes, hashRecoveryCode(code))
	}

	if err := s.repo.CreateRecoveryCodes(ctx, claims.UserID, codeHashes); err != nil {
		slog.Error("failed to store recovery codes", "error", err)
		return nil, common.ErrInternal("failed to setup 2FA")
	}

	return &Enable2FAResponse{
		Secret:      key.Secret(),
		QRCodeURL:   key.URL(),
		BackupCodes: codes,
	}, nil
}

func (s *Service) Verify2FA(ctx context.Context, claims *TokenClaims, req Verify2FARequest) error {
	user, err := s.repo.GetUserByID(ctx, claims.UserID)
	if err != nil || user == nil {
		return common.ErrNotFound("user not found")
	}

	if user.TOTPEnabled {
		return common.ErrBadRequest("two-factor authentication is already enabled")
	}

	if user.TOTPSecretEncrypted == nil {
		return common.ErrBadRequest("2FA setup not started, call enable first")
	}

	// Decrypt secret and validate code
	secret, err := decryptTOTPSecret(s.totpEncryptionKey, user.TOTPSecretEncrypted)
	if err != nil {
		slog.Error("failed to decrypt totp secret", "error", err)
		return common.ErrInternal("failed to verify 2FA")
	}

	if !totp.Validate(req.Code, secret) {
		return common.ErrBadRequest("invalid verification code")
	}

	if err := s.repo.EnableTOTP(ctx, claims.UserID); err != nil {
		slog.Error("failed to enable totp", "error", err)
		return common.ErrInternal("failed to enable 2FA")
	}

	s.audit.Log(ctx, &claims.UserID, common.Audit2FAEnabled, "user", &claims.UserID, nil, "")

	return nil
}

func (s *Service) Disable2FA(ctx context.Context, claims *TokenClaims, req Disable2FARequest) error {
	user, err := s.repo.GetUserByID(ctx, claims.UserID)
	if err != nil || user == nil {
		return common.ErrNotFound("user not found")
	}

	if !user.TOTPEnabled {
		return common.ErrBadRequest("two-factor authentication is not enabled")
	}

	// Validate with TOTP code or recovery code
	valid := false

	if len(req.Code) == 6 {
		secret, err := decryptTOTPSecret(s.totpEncryptionKey, user.TOTPSecretEncrypted)
		if err == nil {
			valid = totp.Validate(req.Code, secret)
		}
	}

	if !valid {
		// Try as recovery code
		codeHash := hashRecoveryCode(req.Code)
		used, err := s.repo.UseRecoveryCode(ctx, claims.UserID, codeHash)
		if err != nil {
			slog.Error("failed to check recovery code", "error", err)
		}
		valid = used
	}

	if !valid {
		return common.ErrBadRequest("invalid code")
	}

	if err := s.repo.DisableTOTP(ctx, claims.UserID); err != nil {
		slog.Error("failed to disable totp", "error", err)
		return common.ErrInternal("failed to disable 2FA")
	}

	s.audit.Log(ctx, &claims.UserID, common.Audit2FADisabled, "user", &claims.UserID, nil, "")

	return nil
}

func (s *Service) VerifyTwoFactorLogin(ctx context.Context, req TwoFactorLoginRequest, ip, userAgent, deviceName, deviceType string) (*AuthResponse, error) {
	// Look up temp token in Redis
	userIDStr, err := s.rdb.Get(ctx, "2fa:"+req.TempToken).Result()
	if err != nil {
		return nil, common.ErrUnauthorized("invalid or expired 2FA token")
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, common.ErrUnauthorized("invalid 2FA token")
	}

	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil || user == nil {
		return nil, common.ErrUnauthorized("user not found")
	}

	// Validate TOTP code or recovery code
	valid := false

	if len(req.Code) == 6 {
		secret, err := decryptTOTPSecret(s.totpEncryptionKey, user.TOTPSecretEncrypted)
		if err == nil {
			valid = totp.Validate(req.Code, secret)
		}
	}

	if !valid {
		// Try as recovery code
		codeHash := hashRecoveryCode(req.Code)
		used, err := s.repo.UseRecoveryCode(ctx, userID, codeHash)
		if err != nil {
			slog.Error("failed to check recovery code", "error", err)
		}
		valid = used
	}

	if !valid {
		return nil, common.ErrUnauthorized("invalid verification code")
	}

	// Delete temp token
	s.rdb.Del(ctx, "2fa:"+req.TempToken)

	if err := s.repo.UpdateLastLogin(ctx, user.ID); err != nil {
		slog.Error("failed to update last login", "error", err)
	}

	s.audit.Log(ctx, &user.ID, common.Audit2FALoginVerified, "user", &user.ID, map[string]any{"ip": ip, "device": deviceName}, ip)

	return s.generateAuthResponse(ctx, user, ip, userAgent, deviceName, deviceType)
}

func (s *Service) GoogleLogin(ctx context.Context, req GoogleLoginRequest, ip, userAgent, deviceName, deviceType string) (*AuthResponse, error) {
	// Verify the Google ID token
	tokenInfo, err := s.verifyGoogleIDToken(req.IDToken)
	if err != nil {
		slog.Error("failed to verify google id token", "error", err)
		return nil, common.ErrUnauthorized("invalid google token")
	}

	if tokenInfo.Aud != s.googleClientID {
		slog.Error("google token audience mismatch", "expected", s.googleClientID, "got", tokenInfo.Aud)
		return nil, common.ErrUnauthorized("invalid google token")
	}

	email := strings.ToLower(strings.TrimSpace(tokenInfo.Email))

	// Look up user by Google ID first
	user, err := s.repo.GetUserByGoogleID(ctx, tokenInfo.Sub)
	if err != nil {
		slog.Error("failed to get user by google id", "error", err)
		return nil, common.ErrInternal("google login failed")
	}

	if user == nil {
		// Look up by email
		user, err = s.repo.GetUserByEmail(ctx, email)
		if err != nil {
			slog.Error("failed to get user by email", "error", err)
			return nil, common.ErrInternal("google login failed")
		}

		if user != nil {
			// Link Google account to existing user
			if err := s.repo.LinkGoogleAccount(ctx, user.ID, tokenInfo.Sub); err != nil {
				slog.Error("failed to link google account", "error", err)
				return nil, common.ErrInternal("google login failed")
			}
			user.GoogleID = tokenInfo.Sub
			user.AuthProvider = "google"
		} else {
			// Create new user
			displayName := tokenInfo.Name
			if displayName == "" {
				displayName = strings.Split(email, "@")[0]
			}

			user = &User{
				Email:         email,
				PasswordHash:  "",
				DisplayName:   displayName,
				StorageLimit:  s.quotaSize,
				Plan:          "free",
				IsActive:      true,
				EmailVerified: true,
				GoogleID:      tokenInfo.Sub,
				AuthProvider:  "google",
			}

			if err := s.repo.CreateGoogleUser(ctx, user); err != nil {
				if strings.Contains(err.Error(), "duplicate key") {
					return nil, common.ErrConflict("email already registered")
				}
				slog.Error("failed to create google user", "error", err)
				return nil, common.ErrInternal("failed to create account")
			}
		}
	}

	if !user.IsActive {
		return nil, common.ErrForbidden("account is disabled")
	}

	if err := s.repo.UpdateLastLogin(ctx, user.ID); err != nil {
		slog.Error("failed to update last login", "error", err)
	}

	return s.generateAuthResponse(ctx, user, ip, userAgent, deviceName, deviceType)
}

func (s *Service) verifyGoogleIDToken(idToken string) (*googleTokenInfo, error) {
	url := "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("request to google tokeninfo: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google tokeninfo returned status %d", resp.StatusCode)
	}

	var info googleTokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("decode google tokeninfo: %w", err)
	}

	if info.Sub == "" || info.Email == "" {
		return nil, fmt.Errorf("invalid google token: missing sub or email")
	}

	return &info, nil
}

func (s *Service) generateAuthResponse(ctx context.Context, user *User, ip, userAgent, deviceName, deviceType string) (*AuthResponse, error) {
	claims := TokenClaims{
		UserID:  user.ID,
		Email:   user.Email,
		Plan:    user.Plan,
		IsAdmin: user.IsAdmin,
	}

	accessToken, err := s.jwt.GenerateAccessToken(claims)
	if err != nil {
		return nil, common.ErrInternal("failed to generate token")
	}

	refreshToken, expiresAt, err := s.jwt.GenerateRefreshToken()
	if err != nil {
		return nil, common.ErrInternal("failed to generate refresh token")
	}

	session := &Session{
		UserID:       user.ID,
		RefreshToken: refreshToken,
		DeviceName:   deviceName,
		DeviceType:   deviceType,
		IPAddress:    ip,
		UserAgent:    userAgent,
		ExpiresAt:    expiresAt,
	}

	if err := s.repo.CreateSession(ctx, session); err != nil {
		slog.Error("failed to create session", "error", err)
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	return &AuthResponse{
		User:         user.ToResponse(),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    s.jwt.AccessTTLSeconds(),
	}, nil
}
