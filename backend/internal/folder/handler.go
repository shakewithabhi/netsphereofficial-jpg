package folder

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

	r.Post("/", h.Create)
	r.Get("/{id}/contents", h.ListContents)
	r.Get("/root/contents", h.ListRootContents)
	r.Get("/{id}", h.GetByID)
	r.Put("/{id}", h.Rename)
	r.Post("/{id}/move", h.Move)
	r.Post("/{id}/trash", h.Trash)
	r.Post("/{id}/restore", h.Restore)
	r.Delete("/{id}", h.Delete)

	return r
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	var req CreateFolderRequest
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

func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid folder id"))
		return
	}

	resp, err := h.service.GetByID(r.Context(), claims, id)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) ListContents(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid folder id"))
		return
	}

	folders, err := h.service.ListContents(r.Context(), claims, &id)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{
		"folders": folders,
	})
}

func (h *Handler) ListRootContents(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	folders, err := h.service.ListContents(r.Context(), claims, nil)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]any{
		"folders": folders,
	})
}

func (h *Handler) Rename(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid folder id"))
		return
	}

	var req RenameFolderRequest
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
		common.JSONError(w, common.ErrBadRequest("invalid folder id"))
		return
	}

	var req MoveFolderRequest
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

func (h *Handler) Trash(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid folder id"))
		return
	}

	if err := h.service.Trash(r.Context(), claims, id); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "folder trashed"})
}

func (h *Handler) Restore(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid folder id"))
		return
	}

	if err := h.service.Restore(r.Context(), claims, id); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "folder restored"})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		common.JSONError(w, common.ErrBadRequest("invalid folder id"))
		return
	}

	if err := h.service.Delete(r.Context(), claims, id); err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, map[string]string{"message": "folder permanently deleted"})
}
