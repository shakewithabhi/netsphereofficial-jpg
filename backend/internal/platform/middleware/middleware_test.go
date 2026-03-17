package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// dummyHandler is a simple handler that writes a 200 OK response.
var dummyHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
})

func TestCORS(t *testing.T) {
	t.Run("allowed origin gets CORS headers", func(t *testing.T) {
		handler := CORS([]string{"http://localhost:3000"})(dummyHandler)
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)

		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
			t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, "http://localhost:3000")
		}
		if got := rr.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
			t.Errorf("Access-Control-Allow-Credentials = %q, want %q", got, "true")
		}
		if rr.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", rr.Code, http.StatusOK)
		}
	})

	t.Run("disallowed origin does not get CORS headers", func(t *testing.T) {
		handler := CORS([]string{"http://localhost:3000"})(dummyHandler)
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Origin", "http://evil.com")
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)

		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("Access-Control-Allow-Origin = %q, want empty for disallowed origin", got)
		}
		if rr.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", rr.Code, http.StatusOK)
		}
	})

	t.Run("wildcard allows any origin", func(t *testing.T) {
		handler := CORS([]string{"*"})(dummyHandler)
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Origin", "http://anything.example.com")
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)

		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://anything.example.com" {
			t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, "http://anything.example.com")
		}
	})

	t.Run("OPTIONS preflight returns 204", func(t *testing.T) {
		handler := CORS([]string{"http://localhost:3000"})(dummyHandler)
		req := httptest.NewRequest(http.MethodOptions, "/api/files", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusNoContent {
			t.Errorf("status = %d, want %d for OPTIONS preflight", rr.Code, http.StatusNoContent)
		}
		if got := rr.Header().Get("Access-Control-Allow-Methods"); got == "" {
			t.Error("Access-Control-Allow-Methods should be set for preflight")
		}
		if got := rr.Header().Get("Access-Control-Max-Age"); got != "86400" {
			t.Errorf("Access-Control-Max-Age = %q, want %q", got, "86400")
		}
	})

	t.Run("OPTIONS preflight for disallowed origin returns 204 without CORS headers", func(t *testing.T) {
		handler := CORS([]string{"http://localhost:3000"})(dummyHandler)
		req := httptest.NewRequest(http.MethodOptions, "/api/files", nil)
		req.Header.Set("Origin", "http://evil.com")
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusNoContent {
			t.Errorf("status = %d, want %d", rr.Code, http.StatusNoContent)
		}
		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("Access-Control-Allow-Origin = %q, want empty for disallowed origin", got)
		}
	})

	t.Run("no Origin header means no CORS headers", func(t *testing.T) {
		handler := CORS([]string{"http://localhost:3000"})(dummyHandler)
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)

		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("Access-Control-Allow-Origin = %q, want empty when no Origin sent", got)
		}
	})

	t.Run("multiple allowed origins", func(t *testing.T) {
		origins := []string{"http://localhost:3000", "https://app.example.com"}
		handler := CORS(origins)(dummyHandler)

		// First origin
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
			t.Errorf("first origin: Access-Control-Allow-Origin = %q, want %q", got, "http://localhost:3000")
		}

		// Second origin
		req = httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Origin", "https://app.example.com")
		rr = httptest.NewRecorder()
		handler.ServeHTTP(rr, req)
		if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
			t.Errorf("second origin: Access-Control-Allow-Origin = %q, want %q", got, "https://app.example.com")
		}
	})
}

func TestSecurityHeaders(t *testing.T) {
	handler := SecurityHeaders(dummyHandler)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	expectedHeaders := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":       "DENY",
		"X-XSS-Protection":      "1; mode=block",
		"Referrer-Policy":        "strict-origin-when-cross-origin",
	}

	for header, want := range expectedHeaders {
		t.Run(header, func(t *testing.T) {
			got := rr.Header().Get(header)
			if got != want {
				t.Errorf("%s = %q, want %q", header, got, want)
			}
		})
	}

	if rr.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusOK)
	}
}
