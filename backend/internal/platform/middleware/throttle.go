package middleware

import (
	"io"
	"net/http"
	"time"

	"github.com/bytebox/backend/internal/auth"
)

// SpeedLimits defines download speed limits in bytes per second per plan.
var SpeedLimits = map[string]int64{
	"free":    1 * 1024 * 1024,  // 1 MB/s
	"pro":     10 * 1024 * 1024, // 10 MB/s
	"premium": 0,                // unlimited
}

// throttledWriter wraps an http.ResponseWriter and enforces a speed limit.
type throttledWriter struct {
	w         http.ResponseWriter
	limit     int64 // bytes per second
	written   int64
	startTime time.Time
}

func (tw *throttledWriter) Header() http.Header        { return tw.w.Header() }
func (tw *throttledWriter) WriteHeader(code int)        { tw.w.WriteHeader(code) }
func (tw *throttledWriter) Flush()                      {
	if f, ok := tw.w.(http.Flusher); ok {
		f.Flush()
	}
}

func (tw *throttledWriter) Write(p []byte) (int, error) {
	if tw.limit <= 0 {
		return tw.w.Write(p) // unlimited
	}

	n, err := tw.w.Write(p)
	tw.written += int64(n)

	// Calculate how long we should have taken
	elapsed := time.Since(tw.startTime)
	expectedDuration := time.Duration(float64(tw.written) / float64(tw.limit) * float64(time.Second))

	if expectedDuration > elapsed {
		time.Sleep(expectedDuration - elapsed)
	}

	return n, err
}

// Ensure throttledWriter implements io.Writer for io.Copy compatibility.
var _ io.Writer = (*throttledWriter)(nil)

// DownloadThrottle is middleware that throttles download responses based on user plan.
// For free users downloads are limited to 1 MB/s, pro to 10 MB/s, premium is unlimited.
func DownloadThrottle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := auth.GetClaims(r.Context())
		plan := "free"
		if claims != nil && claims.Plan != "" {
			plan = claims.Plan
		}

		limit, ok := SpeedLimits[plan]
		if !ok {
			limit = SpeedLimits["free"]
		}

		if limit == 0 {
			next.ServeHTTP(w, r)
			return
		}

		tw := &throttledWriter{w: w, limit: limit, startTime: time.Now()}
		next.ServeHTTP(tw, r)
	})
}
