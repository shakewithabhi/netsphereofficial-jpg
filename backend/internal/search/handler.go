package search

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/bytebox/backend/internal/auth"
	"github.com/bytebox/backend/internal/common"
)

type Handler struct {
	meili *MeiliClient
}

func NewHandler(meili *MeiliClient) *Handler {
	return &Handler{meili: meili}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/files", h.SearchFiles)

	return r
}

func (h *Handler) SearchFiles(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	q := r.URL.Query().Get("q")
	if q == "" {
		common.JSONError(w, common.ErrBadRequest("search query 'q' is required"))
		return
	}

	filters := SearchFilters{
		MimeType: r.URL.Query().Get("mime_type"),
		FolderID: r.URL.Query().Get("folder_id"),
		Sort:     r.URL.Query().Get("sort"),
	}

	if v := r.URL.Query().Get("min_size"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			filters.MinSize = n
		}
	}
	if v := r.URL.Query().Get("max_size"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			filters.MaxSize = n
		}
	}

	result, err := h.meili.Search(r.Context(), claims.UserID.String(), q, filters)
	if err != nil {
		common.JSONError(w, common.ErrInternal("search failed"))
		return
	}

	common.JSON(w, http.StatusOK, result)
}
