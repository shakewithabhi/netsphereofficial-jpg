package file

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/bytebox/backend/internal/auth"
	"github.com/bytebox/backend/internal/common"
)

type Handler struct {
	service       *Service
	maxUploadSize int64
}

func NewHandler(service *Service, maxUploadSize int64) *Handler {
	return &Handler{
		service:       service,
		maxUploadSize: maxUploadSize,
	}
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Post("/upload", h.Upload)
	r.Get("/search", h.Search)
	r.Get("/trash", h.ListTrashed)
	r.Get("/starred", h.ListStarred)
	r.Get("/categories/summary", h.CategorySummary)
	r.Get("/category/{category}", h.ListByCategory)
	r.Get("/{id}", h.GetByID)
	r.Put("/{id}", h.Rename)
	r.Post("/{id}/copy", h.Copy)
	r.Post("/{id}/move", h.Move)
	r.Post("/{id}/star", h.Star)
	r.Delete("/{id}/star", h.Unstar)
	r.Post("/{id}/trash", h.Trash)
	r.Post("/{id}/restore", h.Restore)
	r.Delete("/{id}", h.Delete)
	r.Get("/{id}/comments", h.ListComments)
	r.Post("/{id}/comments", h.CreateComment)
	r.Put("/{id}/comments/{commentId}", h.UpdateComment)
	r.Delete("/{id}/comments/{commentId}", h.DeleteComment)
	r.Get("/{id}/download", h.Download)
	r.Get("/{id}/stream", h.Stream)
	r.Get("/{id}/versions", h.ListVersions)
	r.Get("/{id}/versions/{version}/download", h.DownloadVersion)
	r.Post("/{id}/versions/{version}/restore", h.RestoreVersion)
	r.Delete("/{id}/versions/{version}", h.DeleteVersion)

	return r
}

func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	// Limit request body
	r.Body = http.MaxBytesReader(w, r.Body, h.maxUploadSize+1024*1024) // extra 1MB for form overhead

	if err := r.ParseMultipartForm(h.maxUploadSize); err != nil {
		common.JSONError(w, common.ErrTooLarge("file too large"))
		return
	}
	defer r.MultipartForm.RemoveAll()

	file, header, err := r.FormFile("file")
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("file is required"))
		return
	}
	defer file.Close()

	// Optional folder_id
	var folderID *uuid.UUID
	if fid := r.FormValue("folder_id"); fid != "" {
		parsed, err := uuid.Parse(fid)
		if err != nil {
			common.JSONError(w, common.ErrBadRequest("invalid folder_id"))
			return
		}
		folderID = &parsed
	}

	resp, err := h.service.Upload(r.Context(), claims, header, folderID)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusCreated, resp)
}

func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	resp, err := h.service.GetByID(r.Context(), claims, id)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) Download(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	resp, err := h.service.Download(r.Context(), claims, id)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) Stream(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	resp, err := h.service.GetStreamInfo(r.Context(), claims, id)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) Rename(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	var req RenameFileRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	resp, err := h.service.Rename(r.Context(), claims, id, req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) Move(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	var req MoveFileRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	resp, err := h.service.Move(r.Context(), claims, id, req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) Copy(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	var req CopyFileRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	resp, err := h.service.Copy(r.Context(), claims, id, req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusCreated, resp)
}

func (h *Handler) Trash(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	if err := h.service.Trash(r.Context(), claims, id); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "file trashed"})
}

func (h *Handler) Restore(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	if err := h.service.Restore(r.Context(), claims, id); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "file restored"})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	if err := h.service.Delete(r.Context(), claims, id); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "file permanently deleted"})
}

func (h *Handler) ListTrashed(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	files, err := h.service.ListTrashed(r.Context(), claims)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{"files": files})
}

func (h *Handler) ListVersions(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	versions, err := h.service.ListVersions(r.Context(), claims, id)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{"versions": versions})
}

func (h *Handler) DownloadVersion(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	versionNumber, err := strconv.Atoi(chi.URLParam(r, "version"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid version number"))
		return
	}

	resp, err := h.service.GetVersionDownloadURL(r.Context(), claims, id, versionNumber)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) RestoreVersion(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	versionNumber, err := strconv.Atoi(chi.URLParam(r, "version"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid version number"))
		return
	}

	resp, err := h.service.RestoreVersion(r.Context(), claims, id, versionNumber)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) DeleteVersion(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	versionNumber, err := strconv.Atoi(chi.URLParam(r, "version"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid version number"))
		return
	}

	if err := h.service.DeleteVersion(r.Context(), claims, id, versionNumber); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "version deleted"})
}

func (h *Handler) ListByCategory(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	category := chi.URLParam(r, "category")
	if _, ok := CategoryMimePatterns[category]; !ok {
		common.JSONError(w, common.ErrBadRequest("invalid category, must be one of: images, videos, audio, documents"))
		return
	}

	params := common.ParsePagination(r)
	files, hasMore, err := h.service.ListByCategory(r.Context(), claims, category, params)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSONPaginated(w, files, "", hasMore)
}

func (h *Handler) CategorySummary(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	summary, err := h.service.GetCategorySummary(r.Context(), claims)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, summary)
}

func (h *Handler) ListStarred(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	files, err := h.service.ListStarred(r.Context(), claims)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{"files": files})
}

func (h *Handler) Star(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	if err := h.service.StarFile(r.Context(), claims, id); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "file starred"})
}

func (h *Handler) Unstar(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	if err := h.service.UnstarFile(r.Context(), claims, id); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "file unstarred"})
}

func (h *Handler) ListComments(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	comments, err := h.service.ListComments(r.Context(), claims, id)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{"comments": comments})
}

func (h *Handler) CreateComment(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	var req CreateCommentRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	resp, err := h.service.CreateComment(r.Context(), claims, id, req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusCreated, resp)
}

func (h *Handler) UpdateComment(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	commentID, err := uuid.Parse(chi.URLParam(r, "commentId"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid comment id"))
		return
	}

	var req UpdateCommentRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	resp, err := h.service.UpdateComment(r.Context(), claims, id, commentID, req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid file id"))
		return
	}

	commentID, err := uuid.Parse(chi.URLParam(r, "commentId"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid comment id"))
		return
	}

	if err := h.service.DeleteComment(r.Context(), claims, id, commentID); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "comment deleted"})
}

func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	q := r.URL.Query().Get("q")
	if q == "" {
		common.JSONError(w, common.ErrBadRequest("search query is required"))
		return
	}

	files, err := h.service.Search(r.Context(), claims, q)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{"files": files})
}
