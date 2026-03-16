package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/bytebox/backend/internal/common"
)

type contextKey string

const claimsKey contextKey = "claims"

type Middleware struct {
	jwt *JWTManager
}

func NewMiddleware(jwt *JWTManager) *Middleware {
	return &Middleware{jwt: jwt}
}

func (m *Middleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if header == "" {
			common.JSONError(w, common.ErrUnauthorized("missing authorization header"))
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			common.JSONError(w, common.ErrUnauthorized("invalid authorization format"))
			return
		}

		claims, err := m.jwt.ValidateAccessToken(parts[1])
		if err != nil {
			common.JSONError(w, common.ErrUnauthorized("invalid or expired token"))
			return
		}

		ctx := context.WithValue(r.Context(), claimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (m *Middleware) RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := GetClaims(r.Context())
		if claims == nil || !claims.IsAdmin {
			common.JSONError(w, common.ErrForbidden("admin access required"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func GetClaims(ctx context.Context) *TokenClaims {
	claims, ok := ctx.Value(claimsKey).(*TokenClaims)
	if !ok {
		return nil
	}
	return claims
}
