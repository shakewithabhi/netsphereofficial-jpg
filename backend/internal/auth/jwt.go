package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/bytebox/backend/internal/platform/config"
)

type JWTManager struct {
	accessSecret  []byte
	refreshSecret []byte
	accessTTL     time.Duration
	refreshTTL    time.Duration
}

func NewJWTManager(cfg config.AuthConfig) *JWTManager {
	return &JWTManager{
		accessSecret:  []byte(cfg.AccessTokenSecret),
		refreshSecret: []byte(cfg.RefreshTokenSecret),
		accessTTL:     cfg.AccessTokenTTL,
		refreshTTL:    cfg.RefreshTokenTTL,
	}
}

type accessClaims struct {
	Email   string `json:"email"`
	Plan    string `json:"plan"`
	IsAdmin bool   `json:"is_admin"`
	jwt.RegisteredClaims
}

func (m *JWTManager) GenerateAccessToken(claims TokenClaims) (string, error) {
	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims{
		Email:   claims.Email,
		Plan:    claims.Plan,
		IsAdmin: claims.IsAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   claims.UserID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(m.accessTTL)),
			ID:        uuid.New().String(),
		},
	})

	signed, err := token.SignedString(m.accessSecret)
	if err != nil {
		return "", fmt.Errorf("sign access token: %w", err)
	}
	return signed, nil
}

func (m *JWTManager) ValidateAccessToken(tokenStr string) (*TokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &accessClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return m.accessSecret, nil
	})
	if err != nil {
		return nil, fmt.Errorf("parse access token: %w", err)
	}

	claims, ok := token.Claims.(*accessClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid access token")
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID in token: %w", err)
	}

	return &TokenClaims{
		UserID:  userID,
		Email:   claims.Email,
		Plan:    claims.Plan,
		IsAdmin: claims.IsAdmin,
	}, nil
}

func (m *JWTManager) GenerateRefreshToken() (string, time.Time, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", time.Time{}, fmt.Errorf("generate refresh token: %w", err)
	}
	token := hex.EncodeToString(bytes)
	expiresAt := time.Now().Add(m.refreshTTL)
	return token, expiresAt, nil
}

func (m *JWTManager) AccessTTLSeconds() int64 {
	return int64(m.accessTTL.Seconds())
}
