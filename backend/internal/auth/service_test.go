package auth

import (
	"testing"
	"time"
)

func TestValidatePasswordStrength(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  bool
		errMsg   string
	}{
		{
			name:     "too short",
			password: "Ab1!",
			wantErr:  true,
			errMsg:   "password must be at least 8 characters",
		},
		{
			name:     "missing uppercase",
			password: "abcdefg1!",
			wantErr:  true,
			errMsg:   "password must contain at least one uppercase letter",
		},
		{
			name:     "missing lowercase",
			password: "ABCDEFG1!",
			wantErr:  true,
			errMsg:   "password must contain at least one lowercase letter",
		},
		{
			name:     "missing digit",
			password: "Abcdefgh!",
			wantErr:  true,
			errMsg:   "password must contain at least one digit",
		},
		{
			name:     "missing special character",
			password: "Abcdefg1",
			wantErr:  true,
			errMsg:   "password must contain at least one special character",
		},
		{
			name:     "valid password",
			password: "Abcdefg1!",
			wantErr:  false,
		},
		{
			name:     "valid password with multiple specials",
			password: "P@ssw0rd!#",
			wantErr:  false,
		},
		{
			name:     "exactly 8 characters and valid",
			password: "Abcdef1!",
			wantErr:  false,
		},
		{
			name:     "empty password",
			password: "",
			wantErr:  true,
			errMsg:   "password must be at least 8 characters",
		},
		{
			name:     "7 characters with all requirements",
			password: "Ab1!xyz",
			wantErr:  true,
			errMsg:   "password must be at least 8 characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validatePasswordStrength(tt.password)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error but got nil")
				}
				if err.Error() != "400: "+tt.errMsg {
					t.Errorf("expected error message %q, got %q", tt.errMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("expected no error but got: %v", err)
				}
			}
		})
	}
}

func TestLockoutDuration(t *testing.T) {
	tests := []struct {
		name           string
		failedAttempts int
		want           time.Duration
	}{
		{
			name:           "default tier - 0 attempts",
			failedAttempts: 0,
			want:           5 * time.Minute,
		},
		{
			name:           "default tier - 5 attempts",
			failedAttempts: 5,
			want:           5 * time.Minute,
		},
		{
			name:           "default tier - 9 attempts",
			failedAttempts: 9,
			want:           5 * time.Minute,
		},
		{
			name:           "30 min tier - exactly 10 attempts",
			failedAttempts: 10,
			want:           30 * time.Minute,
		},
		{
			name:           "30 min tier - 14 attempts",
			failedAttempts: 14,
			want:           30 * time.Minute,
		},
		{
			name:           "1 hour tier - exactly 15 attempts",
			failedAttempts: 15,
			want:           1 * time.Hour,
		},
		{
			name:           "1 hour tier - 20 attempts",
			failedAttempts: 20,
			want:           1 * time.Hour,
		},
		{
			name:           "1 hour tier - 100 attempts",
			failedAttempts: 100,
			want:           1 * time.Hour,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := lockoutDuration(tt.failedAttempts)
			if got != tt.want {
				t.Errorf("lockoutDuration(%d) = %v, want %v", tt.failedAttempts, got, tt.want)
			}
		})
	}
}
