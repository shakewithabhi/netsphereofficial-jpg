package explore

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/bytebox/backend/internal/auth"
	"github.com/bytebox/backend/internal/common"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Routes(authMw *auth.Middleware) chi.Router {
	r := chi.NewRouter()

	// Feed routes (optional auth so non-logged-in users can browse)
	r.Group(func(r chi.Router) {
		r.Use(authMw.OptionalAuthenticate)
		r.Get("/feed", h.GetFeed)
		r.Get("/feed/trending", h.GetTrendingFeed)
		r.Get("/feed/category/{category}", h.GetCategoryFeed)
		r.Get("/search", h.SearchPosts)
		r.Get("/posts/{id}", h.GetPost)
		r.Get("/posts/{id}/related", h.GetRelatedPosts)
		r.Get("/posts/{id}/comments", h.ListComments)
		r.Get("/creators/{userId}", h.GetCreatorProfile)
		r.Get("/creators/{userId}/posts", h.GetCreatorPosts)
		r.Get("/tags", h.GetTrendingTags)
	})

	// Auth-required feed routes
	r.Group(func(r chi.Router) {
		r.Use(authMw.Authenticate)
		r.Get("/feed/foryou", h.GetForYouFeed)
		r.Get("/feed/subscriptions", h.GetSubscriptionFeed)
	})

	// Post CRUD (auth required)
	r.Group(func(r chi.Router) {
		r.Use(authMw.Authenticate)
		r.Post("/posts", h.CreatePost)
		r.Delete("/posts/{id}", h.DeletePost)
		r.Post("/posts/{id}/like", h.LikePost)
		r.Delete("/posts/{id}/like", h.UnlikePost)
		r.Post("/posts/{id}/view", h.RecordView)
		r.Post("/posts/{id}/comments", h.AddComment)
		r.Delete("/posts/{id}/comments/{commentId}", h.DeleteComment)
	})

	// Subscriptions (auth required)
	r.Group(func(r chi.Router) {
		r.Use(authMw.Authenticate)
		r.Post("/creators/{userId}/subscribe", h.Subscribe)
		r.Delete("/creators/{userId}/subscribe", h.Unsubscribe)
	})

	// History (auth required)
	r.Group(func(r chi.Router) {
		r.Use(authMw.Authenticate)
		r.Get("/history", h.GetWatchHistory)
	})

	// Reports (auth required)
	r.Group(func(r chi.Router) {
		r.Use(authMw.Authenticate)
		r.Post("/posts/{id}/report", h.ReportPost)
	})

	return r
}

// ── Helpers ──

func getViewerID(r *http.Request) uuid.UUID {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		return uuid.Nil
	}
	return claims.UserID
}

func requireUserID(r *http.Request) (uuid.UUID, error) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		return uuid.Nil, common.ErrUnauthorized("authentication required")
	}
	return claims.UserID, nil
}

func parseLimit(r *http.Request, defaultLimit, maxLimit int) int {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > maxLimit {
		limit = defaultLimit
	}
	return limit
}

// ── Feed Handlers ──

func (h *Handler) GetFeed(w http.ResponseWriter, r *http.Request) {
	params := FeedParams{
		Limit:    parseLimit(r, 20, 50),
		Cursor:   r.URL.Query().Get("cursor"),
		Sort:     r.URL.Query().Get("sort"),
		Category: r.URL.Query().Get("category"),
		Tag:      r.URL.Query().Get("tag"),
	}

	posts, hasMore, err := h.service.GetFeed(r.Context(), params, getViewerID(r))
	if err != nil {
		slog.Error("failed to get feed", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get feed"))
		return
	}

	nextCursor := ""
	if hasMore && len(posts) > 0 {
		nextCursor = posts[len(posts)-1].CreatedAt.Format("2006-01-02T15:04:05.999999Z07:00")
	}

	common.JSONPaginated(w, posts, nextCursor, hasMore)
}

func (h *Handler) GetTrendingFeed(w http.ResponseWriter, r *http.Request) {
	limit := parseLimit(r, 20, 50)

	posts, err := h.service.GetTrendingFeed(r.Context(), limit, getViewerID(r))
	if err != nil {
		slog.Error("failed to get trending feed", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get trending feed"))
		return
	}

	common.JSON(w, http.StatusOK, posts)
}

func (h *Handler) GetForYouFeed(w http.ResponseWriter, r *http.Request) {
	userID, err := requireUserID(r)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	limit := parseLimit(r, 20, 50)

	posts, err := h.service.GetForYouFeed(r.Context(), userID, limit)
	if err != nil {
		slog.Error("failed to get for you feed", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get for you feed"))
		return
	}

	common.JSON(w, http.StatusOK, posts)
}

func (h *Handler) GetSubscriptionFeed(w http.ResponseWriter, r *http.Request) {
	userID, err := requireUserID(r)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	limit := parseLimit(r, 20, 50)
	cursor := r.URL.Query().Get("cursor")

	posts, hasMore, err := h.service.GetSubscriptionFeed(r.Context(), userID, limit, cursor)
	if err != nil {
		slog.Error("failed to get subscription feed", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get subscription feed"))
		return
	}

	nextCursor := ""
	if hasMore && len(posts) > 0 {
		nextCursor = posts[len(posts)-1].CreatedAt.Format("2006-01-02T15:04:05.999999Z07:00")
	}

	common.JSONPaginated(w, posts, nextCursor, hasMore)
}

func (h *Handler) GetCategoryFeed(w http.ResponseWriter, r *http.Request) {
	category := chi.URLParam(r, "category")
	if !ValidCategories[category] {
		common.JSONError(w, common.ErrBadRequest("invalid category"))
		return
	}

	limit := parseLimit(r, 20, 50)
	cursor := r.URL.Query().Get("cursor")

	posts, hasMore, err := h.service.GetCategoryFeed(r.Context(), category, limit, cursor, getViewerID(r))
	if err != nil {
		slog.Error("failed to get category feed", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get category feed"))
		return
	}

	nextCursor := ""
	if hasMore && len(posts) > 0 {
		nextCursor = posts[len(posts)-1].CreatedAt.Format("2006-01-02T15:04:05.999999Z07:00")
	}

	common.JSONPaginated(w, posts, nextCursor, hasMore)
}

func (h *Handler) SearchPosts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		common.JSONError(w, common.ErrBadRequest("query parameter 'q' is required"))
		return
	}

	limit := parseLimit(r, 20, 50)

	posts, err := h.service.SearchPosts(r.Context(), q, limit, getViewerID(r))
	if err != nil {
		slog.Error("failed to search posts", "error", err)
		common.JSONError(w, common.ErrInternal("failed to search posts"))
		return
	}

	common.JSON(w, http.StatusOK, posts)
}

// ── Post Handlers ──

func (h *Handler) CreatePost(w http.ResponseWriter, r *http.Request) {
	userID, err := requireUserID(r)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	var req CreatePostRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	post, err := h.service.CreatePost(r.Context(), userID, req)
	if err != nil {
		slog.Error("failed to create post", "error", err)
		common.JSONError(w, common.ErrBadRequest(err.Error()))
		return
	}

	resp, err := h.service.toResponse(r.Context(), post)
	if err != nil {
		common.JSONError(w, common.ErrInternal("failed to create response"))
		return
	}

	common.JSON(w, http.StatusCreated, resp)
}

func (h *Handler) GetPost(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid post id"))
		return
	}

	resp, err := h.service.GetPost(r.Context(), id, getViewerID(r))
	if err != nil {
		slog.Error("failed to get post", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get post"))
		return
	}
	if resp == nil {
		common.JSONError(w, common.ErrNotFound("post not found"))
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) DeletePost(w http.ResponseWriter, r *http.Request) {
	userID, err := requireUserID(r)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid post id"))
		return
	}

	if err := h.service.DeletePost(r.Context(), id, userID); err != nil {
		slog.Error("failed to delete post", "error", err)
		common.JSONError(w, common.ErrBadRequest(err.Error()))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "post deleted"})
}

func (h *Handler) LikePost(w http.ResponseWriter, r *http.Request) {
	userID, err := requireUserID(r)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid post id"))
		return
	}

	if err := h.service.LikePost(r.Context(), id, userID); err != nil {
		slog.Error("failed to like post", "error", err)
		common.JSONError(w, common.ErrInternal("failed to like post"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "post liked"})
}

func (h *Handler) UnlikePost(w http.ResponseWriter, r *http.Request) {
	userID, err := requireUserID(r)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid post id"))
		return
	}

	if err := h.service.UnlikePost(r.Context(), id, userID); err != nil {
		slog.Error("failed to unlike post", "error", err)
		common.JSONError(w, common.ErrInternal("failed to unlike post"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "post unliked"})
}

func (h *Handler) RecordView(w http.ResponseWriter, r *http.Request) {
	userID := getViewerID(r)

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid post id"))
		return
	}

	var req RecordViewRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	if err := h.service.RecordView(r.Context(), id, userID, req.DurationSeconds); err != nil {
		slog.Error("failed to record view", "error", err)
		common.JSONError(w, common.ErrInternal("failed to record view"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "view recorded"})
}

func (h *Handler) GetRelatedPosts(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid post id"))
		return
	}

	limit := parseLimit(r, 10, 30)

	posts, err := h.service.GetRelatedPosts(r.Context(), id, limit, getViewerID(r))
	if err != nil {
		slog.Error("failed to get related posts", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get related posts"))
		return
	}

	common.JSON(w, http.StatusOK, posts)
}

// ── Comment Handlers ──

func (h *Handler) ListComments(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid post id"))
		return
	}

	limit := parseLimit(r, 50, 100)

	comments, err := h.service.ListComments(r.Context(), id, limit)
	if err != nil {
		slog.Error("failed to list comments", "error", err)
		common.JSONError(w, common.ErrInternal("failed to list comments"))
		return
	}

	common.JSON(w, http.StatusOK, comments)
}

func (h *Handler) AddComment(w http.ResponseWriter, r *http.Request) {
	userID, err := requireUserID(r)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid post id"))
		return
	}

	var req CreateCommentRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	comment, err := h.service.AddComment(r.Context(), id, userID, req)
	if err != nil {
		slog.Error("failed to add comment", "error", err)
		common.JSONError(w, common.ErrBadRequest(err.Error()))
		return
	}

	common.JSON(w, http.StatusCreated, PostCommentResponse{
		ID:               comment.ID,
		PostID:           comment.PostID,
		UserID:           comment.UserID,
		Content:          comment.Content,
		LikeCount:        comment.LikeCount,
		UserName:         comment.UserName,
		UserAvatarInitial: comment.UserAvatarInitial,
		CreatedAt:        comment.CreatedAt,
	})
}

func (h *Handler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	userID, err := requireUserID(r)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	commentID, err := uuid.Parse(chi.URLParam(r, "commentId"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid comment id"))
		return
	}

	if err := h.service.DeleteComment(r.Context(), commentID, userID); err != nil {
		slog.Error("failed to delete comment", "error", err)
		common.JSONError(w, common.ErrBadRequest(err.Error()))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "comment deleted"})
}

// ── Subscription Handlers ──

func (h *Handler) Subscribe(w http.ResponseWriter, r *http.Request) {
	userID, err := requireUserID(r)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	creatorID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid user id"))
		return
	}

	if err := h.service.Subscribe(r.Context(), userID, creatorID); err != nil {
		slog.Error("failed to subscribe", "error", err)
		common.JSONError(w, common.ErrBadRequest(err.Error()))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "subscribed"})
}

func (h *Handler) Unsubscribe(w http.ResponseWriter, r *http.Request) {
	userID, err := requireUserID(r)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	creatorID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid user id"))
		return
	}

	if err := h.service.Unsubscribe(r.Context(), userID, creatorID); err != nil {
		slog.Error("failed to unsubscribe", "error", err)
		common.JSONError(w, common.ErrInternal("failed to unsubscribe"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "unsubscribed"})
}

func (h *Handler) GetCreatorProfile(w http.ResponseWriter, r *http.Request) {
	creatorID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid user id"))
		return
	}

	profile, err := h.service.GetCreatorProfile(r.Context(), creatorID, getViewerID(r))
	if err != nil {
		slog.Error("failed to get creator profile", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get creator profile"))
		return
	}
	if profile == nil {
		common.JSONError(w, common.ErrNotFound("creator not found"))
		return
	}

	common.JSON(w, http.StatusOK, profile)
}

func (h *Handler) GetCreatorPosts(w http.ResponseWriter, r *http.Request) {
	creatorID, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid user id"))
		return
	}

	limit := parseLimit(r, 20, 50)

	posts, err := h.service.GetCreatorPosts(r.Context(), creatorID, limit, getViewerID(r))
	if err != nil {
		slog.Error("failed to get creator posts", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get creator posts"))
		return
	}

	common.JSON(w, http.StatusOK, posts)
}

// ── History Handler ──

func (h *Handler) GetWatchHistory(w http.ResponseWriter, r *http.Request) {
	userID, err := requireUserID(r)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	limit := parseLimit(r, 20, 100)

	posts, err := h.service.GetWatchHistory(r.Context(), userID, limit)
	if err != nil {
		slog.Error("failed to get watch history", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get watch history"))
		return
	}

	common.JSON(w, http.StatusOK, posts)
}

// ── Report Handler ──

func (h *Handler) ReportPost(w http.ResponseWriter, r *http.Request) {
	userID, err := requireUserID(r)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid post id"))
		return
	}

	var req ReportRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	if err := h.service.ReportPost(r.Context(), id, userID, req); err != nil {
		slog.Error("failed to report post", "error", err)
		common.JSONError(w, common.ErrInternal("failed to report post"))
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "post reported"})
}

// ── Tags Handler ──

func (h *Handler) GetTrendingTags(w http.ResponseWriter, r *http.Request) {
	limit := parseLimit(r, 20, 50)

	tags, err := h.service.GetTrendingTags(r.Context(), limit)
	if err != nil {
		slog.Error("failed to get trending tags", "error", err)
		common.JSONError(w, common.ErrInternal("failed to get trending tags"))
		return
	}

	common.JSON(w, http.StatusOK, tags)
}
