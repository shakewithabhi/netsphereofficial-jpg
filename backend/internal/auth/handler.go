package auth

import (
	"net"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/bytebox/backend/internal/common"
)

type Handler struct {
	service    *Service
	middleware *Middleware
}

func NewHandler(service *Service, middleware *Middleware) *Handler {
	return &Handler{
		service:    service,
		middleware: middleware,
	}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public routes
	r.Post("/register", h.Register)
	r.Post("/login", h.Login)
	r.Post("/google", h.GoogleLogin)
	r.Post("/refresh", h.Refresh)
	r.Post("/2fa/verify-login", h.VerifyTwoFactorLogin)
	r.Post("/forgot-password", h.ForgotPassword)
	r.Post("/reset-password", h.ResetPassword)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(h.middleware.Authenticate)
		r.Post("/logout", h.Logout)
		r.Get("/me", h.GetProfile)
		r.Put("/me", h.UpdateProfile)
		r.Post("/change-password", h.ChangePassword)
		r.Get("/sessions", h.ListSessions)
		r.Delete("/sessions/{id}", h.RevokeSession)
		r.Post("/2fa/enable", h.Enable2FA)
		r.Post("/2fa/verify", h.Verify2FA)
		r.Post("/2fa/disable", h.Disable2FA)
	})

	return r
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	resp, err := h.service.Register(r.Context(), req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusCreated, resp)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	ip := r.RemoteAddr
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ip = forwarded
	}

	resp, err := h.service.Login(
		r.Context(),
		req,
		ip,
		r.UserAgent(),
		r.Header.Get("X-Device-Name"),
		r.Header.Get("X-Device-Type"),
	)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	var req GoogleLoginRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	ip := r.RemoteAddr
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ip = forwarded
	}

	resp, err := h.service.GoogleLogin(
		r.Context(),
		req,
		ip,
		r.UserAgent(),
		r.Header.Get("X-Device-Name"),
		r.Header.Get("X-Device-Type"),
	)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	ip := r.RemoteAddr
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ip = forwarded
	}

	resp, err := h.service.Refresh(
		r.Context(),
		req,
		ip,
		r.UserAgent(),
		r.Header.Get("X-Device-Name"),
		r.Header.Get("X-Device-Type"),
	)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	claims := GetClaims(r.Context())

	var req RefreshRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	if err := h.service.Logout(r.Context(), claims, req.RefreshToken); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	claims := GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	resp, err := h.service.GetProfile(r.Context(), claims)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims := GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	var req UpdateProfileRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	resp, err := h.service.UpdateProfile(r.Context(), claims, req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims := GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	var req ChangePasswordRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	if err := h.service.ChangePassword(r.Context(), claims, req); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "password changed"})
}

func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	claims := GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	sessions, err := h.service.ListSessions(r.Context(), claims)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{"sessions": sessions})
}

func (h *Handler) Enable2FA(w http.ResponseWriter, r *http.Request) {
	claims := GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	resp, err := h.service.Enable2FA(r.Context(), claims)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) Verify2FA(w http.ResponseWriter, r *http.Request) {
	claims := GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	var req Verify2FARequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	if err := h.service.Verify2FA(r.Context(), claims, req); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "two-factor authentication enabled"})
}

func (h *Handler) Disable2FA(w http.ResponseWriter, r *http.Request) {
	claims := GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	var req Disable2FARequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	if err := h.service.Disable2FA(r.Context(), claims, req); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "two-factor authentication disabled"})
}

func (h *Handler) VerifyTwoFactorLogin(w http.ResponseWriter, r *http.Request) {
	var req TwoFactorLoginRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	ip := r.RemoteAddr
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		ip = forwarded
	}

	resp, err := h.service.VerifyTwoFactorLogin(
		r.Context(),
		req,
		ip,
		r.UserAgent(),
		r.Header.Get("X-Device-Name"),
		r.Header.Get("X-Device-Type"),
	)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req ForgotPasswordRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	resp, err := h.service.ForgotPassword(r.Context(), req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	if err := h.service.ResetPassword(r.Context(), req); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "password has been reset"})
}

func (h *Handler) RevokeSession(w http.ResponseWriter, r *http.Request) {
	claims := GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid session id"))
		return
	}

	if err := h.service.RevokeSession(r.Context(), claims, id); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "session revoked"})
}
