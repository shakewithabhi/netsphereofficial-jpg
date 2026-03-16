package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "bytebox_http_requests_total",
		Help: "Total number of HTTP requests",
	}, []string{"method", "path", "status"})

	httpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "bytebox_http_request_duration_seconds",
		Help:    "HTTP request duration in seconds",
		Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30},
	}, []string{"method", "path"})

	httpRequestsInFlight = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "bytebox_http_requests_in_flight",
		Help: "Current number of HTTP requests being processed",
	})

	uploadBytesTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "bytebox_upload_bytes_total",
		Help: "Total bytes uploaded",
	})

	activeUsersGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "bytebox_active_users",
		Help: "Number of active users (approximate)",
	})
)

func Metrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		httpRequestsInFlight.Inc()
		defer httpRequestsInFlight.Dec()

		ww := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(ww, r)

		duration := time.Since(start).Seconds()

		// Use chi route pattern for cleaner metrics (avoids high cardinality from UUIDs)
		routePattern := chi.RouteContext(r.Context()).RoutePattern()
		if routePattern == "" {
			routePattern = "unknown"
		}

		httpRequestsTotal.WithLabelValues(r.Method, routePattern, strconv.Itoa(ww.status)).Inc()
		httpRequestDuration.WithLabelValues(r.Method, routePattern).Observe(duration)
	})
}

// RecordUploadBytes records bytes uploaded for metrics
func RecordUploadBytes(bytes int64) {
	uploadBytesTotal.Add(float64(bytes))
}

// SetActiveUsers updates the active users gauge
func SetActiveUsers(count float64) {
	activeUsersGauge.Set(count)
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}
