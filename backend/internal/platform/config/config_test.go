package config

import (
	"testing"
)

func TestParseCORSOrigins(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: nil,
		},
		{
			name:     "single origin",
			input:    "http://localhost:3000",
			expected: []string{"http://localhost:3000"},
		},
		{
			name:     "multiple origins",
			input:    "http://localhost:3000,https://example.com,https://app.example.com",
			expected: []string{"http://localhost:3000", "https://example.com", "https://app.example.com"},
		},
		{
			name:     "whitespace trimming",
			input:    " http://localhost:3000 , https://example.com , https://app.example.com ",
			expected: []string{"http://localhost:3000", "https://example.com", "https://app.example.com"},
		},
		{
			name:     "trailing comma ignored",
			input:    "http://localhost:3000,",
			expected: []string{"http://localhost:3000"},
		},
		{
			name:     "only commas and whitespace",
			input:    " , , ",
			expected: nil,
		},
		{
			name:     "wildcard",
			input:    "*",
			expected: []string{"*"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseCORSOrigins(tt.input)
			if len(got) != len(tt.expected) {
				t.Fatalf("parseCORSOrigins(%q) returned %d items, want %d: got %v", tt.input, len(got), len(tt.expected), got)
			}
			for i := range got {
				if got[i] != tt.expected[i] {
					t.Errorf("parseCORSOrigins(%q)[%d] = %q, want %q", tt.input, i, got[i], tt.expected[i])
				}
			}
		})
	}
}

func TestDatabaseConfigDSN(t *testing.T) {
	tests := []struct {
		name     string
		config   DatabaseConfig
		expected string
	}{
		{
			name: "standard config",
			config: DatabaseConfig{
				Host:     "localhost",
				Port:     5432,
				User:     "bytebox",
				Password: "secret",
				Name:     "bytebox_db",
				SSLMode:  "disable",
			},
			expected: "postgres://bytebox:secret@localhost:5432/bytebox_db?sslmode=disable",
		},
		{
			name: "production config with ssl",
			config: DatabaseConfig{
				Host:     "db.example.com",
				Port:     5433,
				User:     "admin",
				Password: "p@ssw0rd",
				Name:     "prod_db",
				SSLMode:  "require",
			},
			expected: "postgres://admin:p@ssw0rd@db.example.com:5433/prod_db?sslmode=require",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.config.DSN()
			if got != tt.expected {
				t.Errorf("DSN() = %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestRedisConfigAddr(t *testing.T) {
	tests := []struct {
		name     string
		config   RedisConfig
		expected string
	}{
		{
			name: "default config",
			config: RedisConfig{
				Host: "localhost",
				Port: 6379,
			},
			expected: "localhost:6379",
		},
		{
			name: "custom host and port",
			config: RedisConfig{
				Host: "redis.example.com",
				Port: 6380,
			},
			expected: "redis.example.com:6380",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.config.Addr()
			if got != tt.expected {
				t.Errorf("Addr() = %q, want %q", got, tt.expected)
			}
		})
	}
}
