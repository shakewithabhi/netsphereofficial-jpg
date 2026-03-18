package admin

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/bytebox/backend/internal/common"
	"github.com/bytebox/backend/internal/quota"
	"github.com/bytebox/backend/internal/storage"
)

var startTime = time.Now()

type Handler struct {
	repo    *Repository
	quota   *quota.Service
	rdb     *redis.Client
	storage *storage.Client
}

func NewHandler(repo *Repository, quotaSvc *quota.Service, rdb *redis.Client, store *storage.Client) *Handler {
	return &Handler{repo: repo, quota: quotaSvc, rdb: rdb, storage: store}
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
	r.Post("/users/bulk", h.BulkUserAction)
	r.Get("/users/{id}/activity", h.UserActivity)
	r.Get("/files", h.ListFiles)
	r.Delete("/files/{id}", h.DeleteFile)
	r.Get("/settings", h.GetSettings)
	r.Put("/settings", h.UpdateSettings)
	r.Get("/signup-trends", h.SignupTrends)

	// Comments moderation
	r.Get("/comments", h.ListComments)
	r.Delete("/comments/{id}", h.DeleteAdminComment)

	// Starred files
	r.Get("/starred-stats", h.StarredStats)

	// Ad settings & analytics
	r.Get("/ad-settings", h.GetAdSettings)
	r.Put("/ad-settings", h.UpdateAdSettings)
	r.Get("/ad-analytics", h.AdAnalytics)

	// Post moderation
	r.Get("/posts", h.ListPosts)
	r.Delete("/posts/{id}", h.DeleteAdminPost)
	r.Put("/posts/{id}/status", h.UpdatePostStatus)

	// Per-user storage breakdown
	r.Get("/users/{id}/storage", h.GetUserStorageBreakdown)
	r.Get("/storage/top-users", h.GetTopStorageUsers)

	// Notification management
	r.Get("/notifications", h.ListNotifications)
	r.Post("/notifications/send", h.SendNotification)
	r.Delete("/notifications/{id}", h.DeleteNotification)

	// Revenue dashboard
	r.Get("/revenue", h.GetRevenueStats)

	// System health
	r.Get("/health", h.SystemHealth)

	// Export reports
	r.Get("/export/users", h.ExportUsers)
	r.Get("/export/files", h.ExportFiles)
	r.Get("/export/posts", h.ExportPosts)
	r.Get("/export/notifications", h.ExportNotifications)
	r.Get("/export/revenue", h.ExportRevenue)
	r.Get("/export/analytics", h.ExportAnalytics)

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

func (h *Handler) BulkUserAction(w http.ResponseWriter, r *http.Request) {
	var req BulkUserActionRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	affected, err := h.repo.BulkUpdateUsers(r.Context(), req.UserIDs, req.Action, req.Plan)
	if err != nil {
		slog.Error("failed to bulk update users", "error", err)
		common.JSONError(w, common.ErrInternal("failed to bulk update users"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{"message": "bulk action completed", "affected": affected})
}

func (h *Handler) UserActivity(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid user id"))
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	logs, total, err := h.repo.GetUserActivity(r.Context(), id, limit, offset)
	if err != nil {
		slog.Error("failed to get user activity", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get user activity"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{"logs": logs, "total": total, "limit": limit, "offset": offset})
}

func (h *Handler) ListFiles(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}
	search := r.URL.Query().Get("search")
	userID := r.URL.Query().Get("user_id")
	mimeFilter := r.URL.Query().Get("mime")

	files, total, err := h.repo.ListFiles(r.Context(), limit, offset, search, userID, mimeFilter)
	if err != nil {
		slog.Error("failed to list files", "error", err)
		common.JSONError(w, common.ErrInternal("failed to list files"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{"files": files, "total": total, "limit": limit, "offset": offset})
}

func (h *Handler) DeleteFile(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	if err := h.repo.AdminDeleteFile(r.Context(), id); err != nil {
		slog.Error("failed to delete file", "error", err)
		common.JSONError(w, common.ErrInternal("failed to delete file"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "file deleted"})
}

func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.repo.GetSettings(r.Context())
	if err != nil {
		slog.Error("failed to get settings", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get settings"))
		return
	}
	common.JSON(w, http.StatusOK, settings)
}

func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var settings PlatformSettings
	if err := common.DecodeAndValidate(r, &settings); err != nil {
		common.JSONError(w, err)
		return
	}

	if err := h.repo.UpdateSettings(r.Context(), &settings); err != nil {
		slog.Error("failed to update settings", "error", err)
		common.JSONError(w, common.ErrInternal("failed to update settings"))
		return
	}

	common.JSON(w, http.StatusOK, settings)
}

func (h *Handler) SignupTrends(w http.ResponseWriter, r *http.Request) {
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 || days > 90 {
		days = 30
	}

	stats, err := h.repo.GetSignupTrends(r.Context(), days)
	if err != nil {
		slog.Error("failed to get signup trends", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get signup trends"))
		return
	}
	common.JSON(w, http.StatusOK, stats)
}

func (h *Handler) ListComments(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}
	search := r.URL.Query().Get("search")

	comments, total, err := h.repo.ListComments(r.Context(), limit, offset, search)
	if err != nil {
		slog.Error("failed to list comments", "error", err)
		common.JSONError(w, common.ErrInternal("failed to list comments"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{
		"comments": comments,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}

func (h *Handler) DeleteAdminComment(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid comment id"))
		return
	}

	if err := h.repo.DeleteComment(r.Context(), id); err != nil {
		slog.Error("failed to delete comment", "error", err)
		common.JSONError(w, common.ErrInternal("failed to delete comment"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "comment deleted"})
}

func (h *Handler) StarredStats(w http.ResponseWriter, r *http.Request) {
	totalStars, err := h.repo.GetStarredCount(r.Context())
	if err != nil {
		slog.Error("failed to get starred count", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get starred stats"))
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	mostStarred, err := h.repo.GetMostStarredFiles(r.Context(), limit)
	if err != nil {
		slog.Error("failed to get most starred files", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get starred stats"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{
		"total_stars":  totalStars,
		"most_starred": mostStarred,
	})
}

func (h *Handler) AdAnalytics(w http.ResponseWriter, r *http.Request) {
	analytics, err := h.repo.GetAdAnalytics(r.Context())
	if err != nil {
		slog.Error("failed to get ad analytics", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get ad analytics"))
		return
	}
	common.JSON(w, http.StatusOK, analytics)
}

func (h *Handler) GetAdSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.repo.GetAdSettings(r.Context())
	if err != nil {
		slog.Error("failed to get ad settings", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get ad settings"))
		return
	}
	common.JSON(w, http.StatusOK, settings)
}

func (h *Handler) UpdateAdSettings(w http.ResponseWriter, r *http.Request) {
	var req UpdateAdSettingsRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	current, err := h.repo.GetAdSettings(r.Context())
	if err != nil {
		slog.Error("failed to get current ad settings", "error", err)
		common.JSONError(w, common.ErrInternal("failed to update ad settings"))
		return
	}

	if req.AdsEnabled != nil {
		current.AdsEnabled = *req.AdsEnabled
	}
	if req.BannerAdUnitID != nil {
		current.BannerAdUnitID = *req.BannerAdUnitID
	}
	if req.InterstitialAdID != nil {
		current.InterstitialAdID = *req.InterstitialAdID
	}
	if req.RewardedAdID != nil {
		current.RewardedAdID = *req.RewardedAdID
	}
	if req.AdFrequency != nil {
		current.AdFrequency = *req.AdFrequency
	}
	if req.WebAdClient != nil {
		current.WebAdClient = *req.WebAdClient
	}
	if req.WebBannerSlot != nil {
		current.WebBannerSlot = *req.WebBannerSlot
	}
	if req.WebSidebarSlot != nil {
		current.WebSidebarSlot = *req.WebSidebarSlot
	}

	if err := h.repo.UpdateAdSettings(r.Context(), current); err != nil {
		slog.Error("failed to update ad settings", "error", err)
		common.JSONError(w, common.ErrInternal("failed to update ad settings"))
		return
	}

	common.JSON(w, http.StatusOK, current)
}

// ── 1. Post Moderation ──

func (h *Handler) ListPosts(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}
	search := r.URL.Query().Get("search")
	status := r.URL.Query().Get("status")

	posts, total, err := h.repo.ListPosts(r.Context(), limit, offset, search, status)
	if err != nil {
		slog.Error("failed to list posts", "error", err)
		common.JSONError(w, common.ErrInternal("failed to list posts"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{
		"posts":  posts,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *Handler) DeleteAdminPost(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid post id"))
		return
	}

	if err := h.repo.DeletePost(r.Context(), id); err != nil {
		slog.Error("failed to delete post", "error", err)
		common.JSONError(w, common.ErrInternal("failed to delete post"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "post deleted"})
}

func (h *Handler) UpdatePostStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid post id"))
		return
	}

	var req UpdatePostStatusRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	if err := h.repo.UpdatePostStatus(r.Context(), id, req.Status); err != nil {
		slog.Error("failed to update post status", "error", err)
		common.JSONError(w, common.ErrInternal("failed to update post status"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "post status updated"})
}

// ── 2. Per-User Storage Breakdown ──

func (h *Handler) GetUserStorageBreakdown(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid user id"))
		return
	}

	breakdown, err := h.repo.GetUserStorageBreakdown(r.Context(), id)
	if err != nil {
		slog.Error("failed to get user storage breakdown", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get user storage breakdown"))
		return
	}
	if breakdown == nil {
		common.JSONError(w, common.ErrNotFound("user not found"))
		return
	}

	common.JSON(w, http.StatusOK, breakdown)
}

func (h *Handler) GetTopStorageUsers(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	users, err := h.repo.GetTopStorageUsers(r.Context(), limit)
	if err != nil {
		slog.Error("failed to get top storage users", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get top storage users"))
		return
	}

	common.JSON(w, http.StatusOK, users)
}

// ── 3. Notification Management ──

func (h *Handler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}
	userID := r.URL.Query().Get("user_id")
	notifType := r.URL.Query().Get("type")

	notifs, total, err := h.repo.ListNotifications(r.Context(), limit, offset, userID, notifType)
	if err != nil {
		slog.Error("failed to list notifications", "error", err)
		common.JSONError(w, common.ErrInternal("failed to list notifications"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{
		"notifications": notifs,
		"total":         total,
		"limit":         limit,
		"offset":        offset,
	})
}

func (h *Handler) SendNotification(w http.ResponseWriter, r *http.Request) {
	var req SendNotificationRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	if req.UserID == nil {
		// Broadcast to all active users
		count, err := h.repo.SendBroadcastNotification(r.Context(), req.Type, req.Title, req.Message)
		if err != nil {
			slog.Error("failed to send broadcast notification", "error", err)
			common.JSONError(w, common.ErrInternal("failed to send broadcast notification"))
			return
		}
		common.JSON(w, http.StatusOK, map[string]any{"message": "broadcast notification sent", "recipients": count})
		return
	}

	if err := h.repo.SendUserNotification(r.Context(), *req.UserID, req.Type, req.Title, req.Message); err != nil {
		slog.Error("failed to send user notification", "error", err)
		common.JSONError(w, common.ErrInternal("failed to send notification"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "notification sent"})
}

func (h *Handler) DeleteNotification(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid notification id"))
		return
	}

	if err := h.repo.DeleteNotification(r.Context(), id); err != nil {
		slog.Error("failed to delete notification", "error", err)
		common.JSONError(w, common.ErrInternal("failed to delete notification"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "notification deleted"})
}

// ── 4. Revenue Dashboard ──

func (h *Handler) GetRevenueStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.repo.GetRevenueStats(r.Context())
	if err != nil {
		slog.Error("failed to get revenue stats", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get revenue stats"))
		return
	}
	common.JSON(w, http.StatusOK, stats)
}

// ── 5. System Health ──

func (h *Handler) SystemHealth(w http.ResponseWriter, r *http.Request) {
	health := SystemHealth{
		Status:        "healthy",
		Uptime:        int64(time.Since(startTime).Seconds()),
		GoVersion:     runtime.Version(),
		NumGoroutines: runtime.NumGoroutine(),
	}

	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	health.MemoryUsed = int64(memStats.Sys)
	health.MemoryAlloc = int64(memStats.Alloc)

	// Check DB health
	activeConns, maxConns, dbLatency, err := h.repo.CheckDBHealth(r.Context())
	if err != nil {
		health.Status = "degraded"
		health.Components = append(health.Components, ComponentHealth{Name: "database", Status: "down", Latency: 0})
	} else {
		health.DBConnections = activeConns
		health.DBMaxConns = maxConns
		health.Components = append(health.Components, ComponentHealth{Name: "database", Status: "up", Latency: dbLatency})
	}

	// Check Redis health
	if h.rdb != nil {
		start := time.Now()
		err := h.rdb.Ping(r.Context()).Err()
		latency := time.Since(start).Milliseconds()
		if err != nil {
			health.Status = "degraded"
			health.Components = append(health.Components, ComponentHealth{Name: "redis", Status: "down", Latency: 0})
		} else {
			health.Components = append(health.Components, ComponentHealth{Name: "redis", Status: "up", Latency: latency})
		}
	}

	// Check S3/MinIO health
	if h.storage != nil {
		start := time.Now()
		err := h.storage.HeadBucket(r.Context(), h.storage.BucketFiles())
		latency := time.Since(start).Milliseconds()
		if err != nil {
			health.Status = "degraded"
			health.Components = append(health.Components, ComponentHealth{Name: "storage", Status: "down", Latency: 0})
		} else {
			health.Components = append(health.Components, ComponentHealth{Name: "storage", Status: "up", Latency: latency})
		}
	}

	// If any component is down, mark overall status
	for _, c := range health.Components {
		if c.Status == "down" {
			health.Status = "degraded"
			break
		}
	}

	common.JSON(w, http.StatusOK, health)
}

// ── 6. Export Reports ──

func (h *Handler) ExportUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.repo.ExportAllUsers(r.Context())
	if err != nil {
		slog.Error("failed to export users", "error", err)
		common.JSONError(w, common.ErrInternal("failed to export users"))
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=users_export.csv")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	writer.Write([]string{"id", "email", "display_name", "plan", "storage_used", "storage_limit", "file_count", "is_active", "is_admin", "email_verified", "approval_status", "last_login_at", "created_at"})

	for _, u := range users {
		lastLogin := ""
		if u.LastLoginAt != nil {
			lastLogin = u.LastLoginAt.Format(time.RFC3339)
		}
		writer.Write([]string{
			u.ID.String(), u.Email, u.DisplayName, u.Plan,
			strconv.FormatInt(u.StorageUsed, 10), strconv.FormatInt(u.StorageLimit, 10),
			strconv.FormatInt(u.FileCount, 10),
			strconv.FormatBool(u.IsActive), strconv.FormatBool(u.IsAdmin), strconv.FormatBool(u.EmailVerified),
			u.ApprovalStatus, lastLogin, u.CreatedAt.Format(time.RFC3339),
		})
	}
}

func (h *Handler) ExportFiles(w http.ResponseWriter, r *http.Request) {
	files, err := h.repo.ExportAllFiles(r.Context())
	if err != nil {
		slog.Error("failed to export files", "error", err)
		common.JSONError(w, common.ErrInternal("failed to export files"))
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=files_export.csv")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	writer.Write([]string{"id", "user_id", "user_email", "name", "mime_type", "size", "folder_id", "trashed_at", "created_at"})

	for _, f := range files {
		folderID := ""
		if f.FolderID != nil {
			folderID = f.FolderID.String()
		}
		trashedAt := ""
		if f.TrashedAt != nil {
			trashedAt = f.TrashedAt.Format(time.RFC3339)
		}
		writer.Write([]string{
			f.ID.String(), f.UserID.String(), f.UserEmail, f.Name, f.MimeType,
			strconv.FormatInt(f.Size, 10), folderID, trashedAt, f.CreatedAt.Format(time.RFC3339),
		})
	}
}

func (h *Handler) ExportPosts(w http.ResponseWriter, r *http.Request) {
	posts, err := h.repo.ExportAllPosts(r.Context())
	if err != nil {
		slog.Error("failed to export posts", "error", err)
		common.JSONError(w, common.ErrInternal("failed to export posts"))
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=posts_export.csv")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	writer.Write([]string{"id", "user_id", "user_email", "user_name", "caption", "tags", "view_count", "like_count", "status", "file_name", "mime_type", "created_at"})

	for _, p := range posts {
		writer.Write([]string{
			p.ID.String(), p.UserID.String(), p.UserEmail, p.UserName, p.Caption,
			strings.Join(p.Tags, ";"),
			strconv.FormatInt(p.ViewCount, 10), strconv.FormatInt(p.LikeCount, 10),
			p.Status, p.FileName, p.MimeType, p.CreatedAt.Format(time.RFC3339),
		})
	}
}

func (h *Handler) ExportNotifications(w http.ResponseWriter, r *http.Request) {
	notifs, _, err := h.repo.ListNotifications(r.Context(), 100000, 0, "", "")
	if err != nil {
		slog.Error("failed to export notifications", "error", err)
		common.JSONError(w, common.ErrInternal("failed to export notifications"))
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=notifications_export.csv")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	writer.Write([]string{"id", "user_id", "user_email", "type", "title", "message", "is_read", "created_at"})

	for _, n := range notifs {
		writer.Write([]string{
			n.ID.String(), n.UserID.String(), n.UserEmail, n.Type, n.Title, n.Message,
			strconv.FormatBool(n.IsRead), n.CreatedAt.Format(time.RFC3339),
		})
	}
}

func (h *Handler) ExportRevenue(w http.ResponseWriter, r *http.Request) {
	stats, err := h.repo.GetRevenueStats(r.Context())
	if err != nil {
		slog.Error("failed to export revenue", "error", err)
		common.JSONError(w, common.ErrInternal("failed to export revenue"))
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=revenue_export.csv")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	writer.Write([]string{"metric", "value"})
	writer.Write([]string{"total_paid_users", strconv.FormatInt(stats.TotalPaidUsers, 10)})
	writer.Write([]string{"monthly_revenue", fmt.Sprintf("%.2f", stats.MonthlyRevenue)})
	writer.Write([]string{"churn_rate", fmt.Sprintf("%.2f", stats.ChurnRate)})

	writer.Write([]string{})
	writer.Write([]string{"plan", "user_count", "price_per_month", "revenue"})
	for _, pr := range stats.PlanRevenue {
		writer.Write([]string{
			pr.Plan, strconv.FormatInt(pr.UserCount, 10),
			fmt.Sprintf("%.2f", pr.PriceMonth), fmt.Sprintf("%.2f", pr.Revenue),
		})
	}

	writer.Write([]string{})
	writer.Write([]string{"user_id", "email", "old_plan", "new_plan", "changed_at"})
	for _, pc := range stats.RecentUpgrades {
		writer.Write([]string{
			pc.UserID.String(), pc.Email, pc.OldPlan, pc.NewPlan, pc.ChangedAt.Format(time.RFC3339),
		})
	}
}

func (h *Handler) ExportAnalytics(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	report := make(map[string]any)

	if dashStats, err := h.repo.GetDashboardStats(ctx); err == nil {
		report["dashboard"] = dashStats
	}
	if revenueStats, err := h.repo.GetRevenueStats(ctx); err == nil {
		report["revenue"] = revenueStats
	}
	if storageStats, err := h.repo.GetStorageStats(ctx); err == nil {
		report["storage"] = storageStats
	}
	if adAnalytics, err := h.repo.GetAdAnalytics(ctx); err == nil {
		report["ad_analytics"] = adAnalytics
	}

	// Top storage users
	if topUsers, err := h.repo.GetTopStorageUsers(ctx, 20); err == nil {
		report["top_storage_users"] = topUsers
	}

	report["generated_at"] = time.Now().Format(time.RFC3339)

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=analytics_export.json")
	w.WriteHeader(http.StatusOK)

	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	if err := enc.Encode(report); err != nil {
		slog.Error("failed to encode analytics export", "error", err)
	}
}
