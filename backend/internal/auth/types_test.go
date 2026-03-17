package auth

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestUserToResponse(t *testing.T) {
	now := time.Now().Truncate(time.Second)
	lastLogin := now.Add(-1 * time.Hour)
	userID := uuid.New()

	user := &User{
		ID:            userID,
		Email:         "test@example.com",
		PasswordHash:  "hashed-password-should-not-appear",
		DisplayName:   "Test User",
		AvatarKey:     "avatars/test.png",
		StorageUsed:   1024 * 1024 * 100, // 100 MB
		StorageLimit:  1024 * 1024 * 1024 * 5,
		Plan:          "free",
		IsActive:      true,
		IsAdmin:       false,
		EmailVerified: true,
		GoogleID:      "google-id-should-not-appear",
		AuthProvider:  "google",
		TOTPEnabled:   true,
		LastLoginAt:   &lastLogin,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	resp := user.ToResponse()

	t.Run("maps basic fields", func(t *testing.T) {
		if resp.ID != userID {
			t.Errorf("ID = %v, want %v", resp.ID, userID)
		}
		if resp.Email != "test@example.com" {
			t.Errorf("Email = %q, want %q", resp.Email, "test@example.com")
		}
		if resp.DisplayName != "Test User" {
			t.Errorf("DisplayName = %q, want %q", resp.DisplayName, "Test User")
		}
		if resp.AvatarKey != "avatars/test.png" {
			t.Errorf("AvatarKey = %q, want %q", resp.AvatarKey, "avatars/test.png")
		}
	})

	t.Run("maps storage fields", func(t *testing.T) {
		if resp.StorageUsed != 1024*1024*100 {
			t.Errorf("StorageUsed = %d, want %d", resp.StorageUsed, 1024*1024*100)
		}
		if resp.StorageLimit != 1024*1024*1024*5 {
			t.Errorf("StorageLimit = %d, want %d", resp.StorageLimit, 1024*1024*1024*5)
		}
	})

	t.Run("maps plan and status fields", func(t *testing.T) {
		if resp.Plan != "free" {
			t.Errorf("Plan = %q, want %q", resp.Plan, "free")
		}
		if !resp.IsActive {
			t.Error("IsActive = false, want true")
		}
		if resp.IsAdmin {
			t.Error("IsAdmin = true, want false")
		}
		if !resp.EmailVerified {
			t.Error("EmailVerified = false, want true")
		}
	})

	t.Run("maps TOTP enabled to two factor enabled", func(t *testing.T) {
		if !resp.TwoFactorEnabled {
			t.Error("TwoFactorEnabled = false, want true (TOTPEnabled was true)")
		}
	})

	t.Run("maps time fields", func(t *testing.T) {
		if resp.LastLoginAt == nil {
			t.Fatal("LastLoginAt = nil, want non-nil")
		}
		if !resp.LastLoginAt.Equal(lastLogin) {
			t.Errorf("LastLoginAt = %v, want %v", *resp.LastLoginAt, lastLogin)
		}
		if !resp.CreatedAt.Equal(now) {
			t.Errorf("CreatedAt = %v, want %v", resp.CreatedAt, now)
		}
	})

	t.Run("nil last login", func(t *testing.T) {
		userNoLogin := &User{
			ID:    uuid.New(),
			Email: "nologin@example.com",
		}
		r := userNoLogin.ToResponse()
		if r.LastLoginAt != nil {
			t.Errorf("LastLoginAt = %v, want nil", r.LastLoginAt)
		}
	})
}
