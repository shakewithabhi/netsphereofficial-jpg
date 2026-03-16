package batch

import (
	"net/http"

	"github.com/go-chi/chi/v5"

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
	r.Post("/move", h.BatchMove)
	r.Post("/trash", h.BatchTrash)
	r.Post("/delete", h.BatchDelete)
	r.Post("/download", h.BatchDownload)
	return r
}

func (h *Handler) BatchMove(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	var req BatchMoveRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	result, err := h.service.BatchMove(r.Context(), claims, req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, result)
}

func (h *Handler) BatchTrash(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	var req BatchTrashRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	result, err := h.service.BatchTrash(r.Context(), claims, req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, result)
}

func (h *Handler) BatchDelete(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	var req BatchDeleteRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	result, err := h.service.BatchDelete(r.Context(), claims, req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, result)
}

func (h *Handler) BatchDownload(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("unauthorized"))
		return
	}

	var req BatchDownloadRequest
	if err := common.DecodeAndValidate(r, &req); err != nil {
		common.JSONError(w, err)
		return
	}

	if err := h.service.BatchDownload(r.Context(), claims, req, w); err != nil {
		common.JSONError(w, err)
	}
}
