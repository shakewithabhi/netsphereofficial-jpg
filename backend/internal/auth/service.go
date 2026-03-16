package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/bytebox/backend/internal/common"
	"github.com/bytebox/backend/internal/platform/config"
)

type googleTokenInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Aud           string `json:"aud"`
}

type Service struct {
	repo           *Repository
	jwt            *JWTManager
	bcryptCost     int
	quotaSize      int64
	googleClientID string
}

func NewService(repo *Repository, jwt *JWTManager, cfg config.AppConfig, authCfg config.AuthConfig, googleClientID string) *Service {
	return &Service{
		repo:           repo,
		jwt:            jwt,
		bcryptCost:     authCfg.BcryptCost,
		quotaSize:      cfg.DefaultQuotaSize,
		googleClientID: googleClientID,
	}
}

func (s *Service) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))

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

	return s.generateAuthResponse(ctx, user, "", "", "", "")
}

func (s *Service) Login(ctx context.Context, req LoginRequest, ip, userAgent, deviceName, deviceType string) (*AuthResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))

	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		slog.Error("failed to get user", "error", err)
		return nil, common.ErrInternal("login failed")
	}
	if user == nil {
		return nil, common.ErrUnauthorized("invalid email or password")
	}

	if !user.IsActive {
		return nil, common.ErrForbidden("account is disabled")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, common.ErrUnauthorized("invalid email or password")
	}

	if err := s.repo.UpdateLastLogin(ctx, user.ID); err != nil {
		slog.Error("failed to update last login", "error", err)
	}

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

func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	if err := s.repo.DeleteSession(ctx, refreshToken); err != nil {
		slog.Error("failed to delete session", "error", err)
		return common.ErrInternal("logout failed")
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

	// Invalidate all sessions on password change
	if err := s.repo.DeleteUserSessions(ctx, claims.UserID); err != nil {
		slog.Error("failed to delete user sessions", "error", err)
	}

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
	return nil
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
