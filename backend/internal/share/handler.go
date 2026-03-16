package share

import (
	"net/http"

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

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()

	// Authenticated routes
	r.Post("/", h.Create)
	r.Get("/", h.List)
	r.Put("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)

	return r
}

// PublicRoutes returns routes that don't require authentication
func (h *Handler) PublicRoutes() chi.Router {
	r := chi.NewRouter()

	r.Get("/{code}", h.GetPublicInfo)
	r.Post("/{code}/download", h.DownloadPublic)
	r.Get("/{code}/contents", h.GetPublicFolderContents)

	return r
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	var req CreateShareRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	resp, err := h.service.Create(r.Context(), claims, req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusCreated, resp)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	shares, err := h.service.List(r.Context(), claims)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{"shares": shares})
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid share id"))
		return
	}

	var req UpdateShareRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	if err := h.service.Update(r.Context(), claims, id, req); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "share updated"})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid share id"))
		return
	}

	if err := h.service.Delete(r.Context(), claims, id); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "share deleted"})
}

// Public handlers (no auth)

func (h *Handler) GetPublicInfo(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	resp, err := h.service.GetPublicInfo(r.Context(), code)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) DownloadPublic(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	var req DownloadShareRequest
	// Password is optional, so don't error on empty body
	common.DecodeAndValidate(r, &req)

	// Parse optional file_id for folder shares
	var fileID *uuid.UUID
	if req.FileID != "" {
		parsed, err := uuid.Parse(req.FileID)
		if err != nil {
			common.JSONError(w, common.ErrBadRequest("invalid file_id"))
			return
		}
		fileID = &parsed
	}

	resp, err := h.service.DownloadPublic(r.Context(), code, req.Password, fileID)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) GetPublicFolderContents(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	// Password can be passed via query param or header for GET requests
	password := r.URL.Query().Get("password")
	if password == "" {
		password = r.Header.Get("X-Share-Password")
	}

	resp, err := h.service.GetPublicFolderContents(r.Context(), code, password)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}
