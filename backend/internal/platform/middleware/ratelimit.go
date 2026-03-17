package middleware

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strconv"
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
			key := fmt.Sprintf("rl:%s:%d", keyFunc(r), time.Now().Unix()/int64(window.Seconds()))

			count, err := rl.increment(r.Context(), key, window)
			if err != nil {
				// If Redis is down, allow the request but log the issue
				next.ServeHTTP(w, r)
				return
			}

			// Set rate limit headers
			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(maxRequests))
			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(max(0, maxRequests-int(count))))

			if int(count) > maxRequests {
				w.Header().Set("Retry-After", strconv.Itoa(int(window.Seconds())))
				http.Error(w, `{"success":false,"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
				return
			}

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

// ByIP returns the client IP (without port) as rate limit key
func ByIP(r *http.Request) string {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		ip = r.RemoteAddr
	}
	return "ip:" + ip
}

// ByUserOrIP returns user ID if authenticated, otherwise IP
func ByUserOrIP(r *http.Request) string {
	if uid := r.Context().Value("user_id"); uid != nil {
		return fmt.Sprintf("user:%v", uid)
	}
	return "ip:" + r.RemoteAddr
}
