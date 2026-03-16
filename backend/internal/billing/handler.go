package billing

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/bytebox/backend/internal/auth"
	"github.com/bytebox/backend/internal/common"
)

type Handler struct {
	service    *Service
	middleware *auth.Middleware
}

func NewHandler(service *Service, middleware *auth.Middleware) *Handler {
	return &Handler{
		service:    service,
		middleware: middleware,
	}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public routes
	r.Get("/plans", h.ListPlans)
	r.Post("/webhook", h.HandleWebhook)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(h.middleware.Authenticate)
		r.Get("/subscription", h.GetSubscription)
		r.Post("/checkout", h.CreateCheckout)
		r.Post("/portal", h.CreateBillingPortal)
		r.Post("/cancel", h.CancelSubscription)
	})

	return r
}

func (h *Handler) ListPlans(w http.ResponseWriter, r *http.Request) {
	plans := ListPlans()
	common.JSON(w, http.StatusOK, map[string]any{"plans": plans})
}

func (h *Handler) GetSubscription(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	resp, err := h.service.GetSubscription(r.Context(), claims.UserID)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) CreateCheckout(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	var req CreateCheckoutRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	resp, err := h.service.CreateCheckoutSession(r.Context(), claims.UserID, claims.Email, req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) CreateBillingPortal(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	resp, err := h.service.CreateBillingPortal(r.Context(), claims.UserID)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) CancelSubscription(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	if err := h.service.CancelSubscription(r.Context(), claims.UserID); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "subscription cancelled"})
}

func (h *Handler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	if err := h.service.HandleWebhook(r); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "webhook processed"})
}
