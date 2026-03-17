package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Server      ServerConfig
	Database    DatabaseConfig
	Redis       RedisConfig
	Storage     StorageConfig
	CFStream    CFStreamConfig
	Auth        AuthConfig
	App         AppConfig
	Google      GoogleConfig
	Stripe      StripeConfig
	Meilisearch MeilisearchConfig
	Scanner     ScannerConfig
}

type CFStreamConfig struct {
	APIToken          string
	AccountID         string
	CustomerSubdomain string
	WebhookSecret     string
}

// Enabled returns true if Cloudflare Stream is configured.
func (c CFStreamConfig) Enabled() bool {
	return c.APIToken != "" && c.AccountID != ""
}

type MeilisearchConfig struct {
	Host   string
	APIKey string
}

type ScannerConfig struct {
	ClamAVEnabled bool
}

type GoogleConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

type ServerConfig struct {
	Host         string
	Port         int
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

type DatabaseConfig struct {
	Host            string
	Port            int
	User            string
	Password        string
	Name            string
	SSLMode         string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

func (c DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		c.User, c.Password, c.Host, c.Port, c.Name, c.SSLMode,
	)
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

func (c RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

type StorageConfig struct {
	Endpoint        string
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	BucketFiles     string
	BucketThumbs    string
	BucketTemp      string
	PresignExpiry   time.Duration
}

type AuthConfig struct {
	AccessTokenSecret  string
	RefreshTokenSecret string
	AccessTokenTTL     time.Duration
	RefreshTokenTTL    time.Duration
	BcryptCost         int
	TOTPEncryptionKey  string // 32-byte hex-encoded AES-256 key
}

type AppConfig struct {
	Environment      string   // development, staging, production
	BaseURL          string   // public-facing URL for share links
	DefaultQuotaSize int64    // bytes
	MaxUploadSize    int64    // bytes for simple upload
	CORSOrigins      []string // allowed CORS origins
	RequireApproval  bool     // require admin approval for new registrations
}

type StripeConfig struct {
	SecretKey      string
	WebhookSecret  string
	ProPriceID     string
	PremiumPriceID string
}

func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			Host:         getEnv("SERVER_HOST", "0.0.0.0"),
			Port:         getEnvInt("SERVER_PORT", 8080),
			ReadTimeout:  time.Duration(getEnvInt("SERVER_READ_TIMEOUT_SEC", 30)) * time.Second,
			WriteTimeout: time.Duration(getEnvInt("SERVER_WRITE_TIMEOUT_SEC", 60)) * time.Second,
			IdleTimeout:  time.Duration(getEnvInt("SERVER_IDLE_TIMEOUT_SEC", 120)) * time.Second,
		},
		Database: DatabaseConfig{
			Host:            getEnv("DB_HOST", "localhost"),
			Port:            getEnvInt("DB_PORT", 5432),
			User:            getEnv("DB_USER", "bytebox"),
			Password:        getEnv("DB_PASSWORD", "bytebox"),
			Name:            getEnv("DB_NAME", "bytebox"),
			SSLMode:         getEnv("DB_SSL_MODE", "disable"),
			MaxOpenConns:    getEnvInt("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getEnvInt("DB_MAX_IDLE_CONNS", 10),
			ConnMaxLifetime: time.Duration(getEnvInt("DB_CONN_MAX_LIFETIME_MIN", 30)) * time.Minute,
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnvInt("REDIS_PORT", 6379),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
		},
		Storage: StorageConfig{
			Endpoint:        getEnv("STORAGE_ENDPOINT", ""),
			Region:          getEnv("STORAGE_REGION", "us-east-1"),
			AccessKeyID:     getEnv("STORAGE_ACCESS_KEY_ID", ""),
			SecretAccessKey: getEnv("STORAGE_SECRET_ACCESS_KEY", ""),
			BucketFiles:     getEnv("STORAGE_BUCKET_FILES", "bytebox-files"),
			BucketThumbs:    getEnv("STORAGE_BUCKET_THUMBS", "bytebox-thumbnails"),
			BucketTemp:      getEnv("STORAGE_BUCKET_TEMP", "bytebox-temp"),
			PresignExpiry:   time.Duration(getEnvInt("STORAGE_PRESIGN_EXPIRY_MIN", 60)) * time.Minute,
		},
		Auth: AuthConfig{
			AccessTokenSecret:  getEnv("AUTH_ACCESS_TOKEN_SECRET", ""),
			RefreshTokenSecret: getEnv("AUTH_REFRESH_TOKEN_SECRET", ""),
			AccessTokenTTL:     time.Duration(getEnvInt("AUTH_ACCESS_TOKEN_TTL_MIN", 15)) * time.Minute,
			RefreshTokenTTL:    time.Duration(getEnvInt("AUTH_REFRESH_TOKEN_TTL_DAYS", 30)) * 24 * time.Hour,
			BcryptCost:         getEnvInt("AUTH_BCRYPT_COST", 12),
			TOTPEncryptionKey:  getEnv("AUTH_TOTP_ENCRYPTION_KEY", ""),
		},
		App: AppConfig{
			Environment:      getEnv("APP_ENV", "development"),
			BaseURL:          getEnv("APP_BASE_URL", "https://byteboxapp.com"),
			DefaultQuotaSize: int64(getEnvInt("APP_DEFAULT_QUOTA_GB", 5)) * 1024 * 1024 * 1024,
			MaxUploadSize:    int64(getEnvInt("APP_MAX_UPLOAD_SIZE_MB", 10)) * 1024 * 1024,
			CORSOrigins:      parseCORSOrigins(getEnv("CORS_ALLOWED_ORIGINS", "")),
			RequireApproval:  getEnvBool("REQUIRE_REGISTRATION_APPROVAL", false),
		},
		Google: GoogleConfig{
			ClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
			ClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
			RedirectURL:  getEnv("GOOGLE_REDIRECT_URL", ""),
		},
		Stripe: StripeConfig{
			SecretKey:      getEnv("STRIPE_SECRET_KEY", ""),
			WebhookSecret:  getEnv("STRIPE_WEBHOOK_SECRET", ""),
			ProPriceID:     getEnv("STRIPE_PRO_PRICE_ID", ""),
			PremiumPriceID: getEnv("STRIPE_PREMIUM_PRICE_ID", ""),
		},
		Meilisearch: MeilisearchConfig{
			Host:   getEnv("MEILISEARCH_HOST", ""),
			APIKey: getEnv("MEILISEARCH_API_KEY", ""),
		},
		Scanner: ScannerConfig{
			ClamAVEnabled: getEnvBool("CLAMAV_ENABLED", false),
		},
		CFStream: CFStreamConfig{
			APIToken:          getEnv("CF_STREAM_API_TOKEN", ""),
			AccountID:         getEnv("CF_STREAM_ACCOUNT_ID", ""),
			CustomerSubdomain: getEnv("CF_STREAM_CUSTOMER_SUBDOMAIN", ""),
			WebhookSecret:     getEnv("CF_STREAM_WEBHOOK_SECRET", ""),
		},
	}

	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("config validation: %w", err)
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.Auth.AccessTokenSecret == "" && c.App.Environment == "production" {
		return fmt.Errorf("AUTH_ACCESS_TOKEN_SECRET is required in production")
	}
	if c.Auth.RefreshTokenSecret == "" && c.App.Environment == "production" {
		return fmt.Errorf("AUTH_REFRESH_TOKEN_SECRET is required in production")
	}
	if c.Storage.Endpoint == "" && c.App.Environment == "production" {
		return fmt.Errorf("STORAGE_ENDPOINT is required in production")
	}
	if len(c.App.CORSOrigins) == 0 && c.App.Environment == "production" {
		return fmt.Errorf("CORS_ALLOWED_ORIGINS is required in production (comma-separated list of origins)")
	}

	// Set dev defaults for secrets
	if c.Auth.AccessTokenSecret == "" {
		c.Auth.AccessTokenSecret = "dev-access-secret-change-in-production"
	}
	if c.Auth.RefreshTokenSecret == "" {
		c.Auth.RefreshTokenSecret = "dev-refresh-secret-change-in-production"
	}

	// In development, allow all origins if not explicitly configured
	if len(c.App.CORSOrigins) == 0 {
		c.App.CORSOrigins = []string{"*"}
	}

	return nil
}

func parseCORSOrigins(val string) []string {
	if val == "" {
		return nil
	}
	var origins []string
	for _, o := range strings.Split(val, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	b, err := strconv.ParseBool(val)
	if err != nil {
		return fallback
	}
	return b
}

func getEnvInt(key string, fallback int) int {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return n
}
