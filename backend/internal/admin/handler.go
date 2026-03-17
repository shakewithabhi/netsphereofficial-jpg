package admin

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/bytebox/backend/internal/common"
	"github.com/bytebox/backend/internal/quota"
)

type Handler struct {
	repo  *Repository
	quota *quota.Service
}

func NewHandler(repo *Repository, quotaSvc *quota.Service) *Handler {
	return &Handler{repo: repo, quota: quotaSvc}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/dashboard", h.Dashboard)
	r.Get("/users", h.ListUsers)
	r.Get("/users/{id}", h.GetUser)
	r.Put("/users/{id}", h.UpdateUser)
	r.Post("/users/{id}/ban", h.BanUser)
	r.Get("/storage/pool", h.GetStoragePool)
	r.Put("/storage/pool", h.UpdateStoragePool)
	r.Get("/storage/stats", h.StorageStats)
	r.Get("/storage/mime-stats", h.MimeTypeStats)
	r.Get("/storage/upload-trends", h.UploadTrends)
	r.Get("/audit-logs", h.AuditLogs)
	r.Get("/pending-registrations", h.PendingRegistrations)
	r.Post("/users/{id}/approve", h.ApproveUser)
	r.Post("/users/{id}/reject", h.RejectUser)

	return r
}

func (h *Handler) Dashboard(w http.ResponseWriter, r *http.Request) {
	stats, err := h.repo.GetDashboardStats(r.Context())
	if err != nil {
		slog.Error("failed to get dashboard stats", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get stats"))
		return
	}
	common.JSON(w, http.StatusOK, stats)
}

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}
	search := r.URL.Query().Get("search")

	users, total, err := h.repo.ListUsers(r.Context(), limit, offset, search)
	if err != nil {
		slog.Error("failed to list users", "error", err)
		common.JSONError(w, common.ErrInternal("failed to list users"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{
		"users":  users,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid user id"))
		return
	}

	user, err := h.repo.GetUserByID(r.Context(), id)
	if err != nil {
		slog.Error("failed to get user", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get user"))
		return
	}
	if user == nil {
		common.JSONError(w, common.ErrNotFound("user not found"))
		return
	}

	common.JSON(w, http.StatusOK, user)
}

func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid user id"))
		return
	}

	var req UpdateUserRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	if err := h.repo.UpdateUser(r.Context(), id, req); err != nil {
		slog.Error("failed to update user", "error", err)
		common.JSONError(w, common.ErrInternal("failed to update user"))
		return
	}

	user, _ := h.repo.GetUserByID(r.Context(), id)
	common.JSON(w, http.StatusOK, user)
}

func (h *Handler) BanUser(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid user id"))
		return
	}

	if err := h.repo.BanUser(r.Context(), id); err != nil {
		slog.Error("failed to ban user", "error", err)
		common.JSONError(w, common.ErrInternal("failed to ban user"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "user banned"})
}

func (h *Handler) PendingRegistrations(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	users, total, err := h.repo.GetPendingRegistrations(r.Context(), limit, offset)
	if err != nil {
		slog.Error("failed to list pending registrations", "error", err)
		common.JSONError(w, common.ErrInternal("failed to list pending registrations"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{
		"users":  users,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *Handler) ApproveUser(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid user id"))
		return
	}

	if err := h.repo.UpdateApprovalStatus(r.Context(), id, "approved"); err != nil {
		slog.Error("failed to approve user", "error", err)
		common.JSONError(w, common.ErrInternal("failed to approve user"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "user approved"})
}

func (h *Handler) RejectUser(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid user id"))
		return
	}

	if err := h.repo.UpdateApprovalStatus(r.Context(), id, "rejected"); err != nil {
		slog.Error("failed to reject user", "error", err)
		common.JSONError(w, common.ErrInternal("failed to reject user"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "user rejected"})
}

func (h *Handler) AuditLogs(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}
	action := r.URL.Query().Get("action")
	userID := r.URL.Query().Get("user_id")

	logs, total, err := h.repo.ListAuditLogs(r.Context(), limit, offset, action, userID)
	if err != nil {
		slog.Error("failed to list audit logs", "error", err)
		common.JSONError(w, common.ErrInternal("failed to list audit logs"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{
		"logs":   logs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *Handler) GetStoragePool(w http.ResponseWriter, r *http.Request) {
	pool, err := h.quota.GetPoolStatus(r.Context())
	if err != nil {
		slog.Error("failed to get storage pool", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get storage pool"))
		return
	}
	common.JSON(w, http.StatusOK, pool)
}

func (h *Handler) UpdateStoragePool(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TotalCapacity int64 `json:"total_capacity" validate:"required,gt=0"`
	}
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	if err := h.quota.UpdatePoolCapacity(r.Context(), req.TotalCapacity); err != nil {
		slog.Error("failed to update storage pool", "error", err)
		common.JSONError(w, common.ErrInternal("failed to update storage pool"))
		return
	}

	pool, _ := h.quota.GetPoolStatus(r.Context())
	common.JSON(w, http.StatusOK, pool)
}

func (h *Handler) StorageStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.repo.GetStorageStats(r.Context())
	if err != nil {
		slog.Error("failed to get storage stats", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get storage stats"))
		return
	}
	common.JSON(w, http.StatusOK, stats)
}

func (h *Handler) MimeTypeStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.repo.GetMimeTypeStats(r.Context())
	if err != nil {
		slog.Error("failed to get mime type stats", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get mime type stats"))
		return
	}
	common.JSON(w, http.StatusOK, stats)
}

func (h *Handler) UploadTrends(w http.ResponseWriter, r *http.Request) {
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 || days > 90 {
		days = 30
	}
	stats, err := h.repo.GetDailyUploadStats(r.Context(), days)
	if err != nil {
		slog.Error("failed to get upload trends", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get upload trends"))
		return
	}
	common.JSON(w, http.StatusOK, stats)
}
