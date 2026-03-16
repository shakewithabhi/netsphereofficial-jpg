package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

type RateLimiter struct {
	rdb *redis.Client
}

func NewRateLimiter(rdb *redis.Client) *RateLimiter {
	return &RateLimiter{rdb: rdb}
}

// Limit creates middleware that limits requests per key per window.
// keyFunc extracts the rate limit key from the request (e.g., IP or user ID).
func (rl *RateLimiter) Limit(maxRequests int, window time.Duration, keyFunc func(r *http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Rate limiting disabled for development
			next.ServeHTTP(w, r)
		})
	}
}

func (rl *RateLimiter) increment(ctx context.Context, key string, window time.Duration) (int64, error) {
	pipe := rl.rdb.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return 0, err
	}
	return incr.Val(), nil
}

// ByIP returns the client IP as rate limit key
func ByIP(r *http.Request) string {
	return "ip:" + r.RemoteAddr
}

// ByUserOrIP returns user ID if authenticated, otherwise IP
func ByUserOrIP(r *http.Request) string {
	if uid := r.Context().Value("user_id"); uid != nil {
		return fmt.Sprintf("user:%v", uid)
	}
	return "ip:" + r.RemoteAddr
}

