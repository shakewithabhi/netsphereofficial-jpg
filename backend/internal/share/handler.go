package share

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

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
	r.Post("/{code}/save", h.SaveToStorage)

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

	// If browser request, serve HTML page
	accept := r.Header.Get("Accept")
	if strings.Contains(accept, "text/html") {
		h.serveSharePage(w, code, resp)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) DownloadPublic(w http.ResponseWriter, r *http.Request) {
	// Require authentication — anonymous downloads are not allowed
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "unauthorized",
			"message": "Please login or create an account to download this file",
		})
		return
	}

	code := chi.URLParam(r, "code")

	var req DownloadShareRequest
	// Password is optional, so don't error on empty body
	common.DecodeAndValidate(r, &req)

	// Check if user has saved the file to their storage first
	hasSaved, err := h.service.HasUserSavedFile(r.Context(), claims.UserID, code)
	if err != nil {
		common.JSONError(w, err)
		return
	}
	if !hasSaved {
		common.JSON(w, http.StatusForbidden, map[string]string{
			"error":   "forbidden",
			"message": "Please save this file to your storage before downloading",
		})
		return
	}

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

func (h *Handler) PreviewPublic(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	// Password can be passed via query param or header for GET requests
	password := r.URL.Query().Get("password")
	if password == "" {
		password = r.Header.Get("X-Share-Password")
	}

	resp, err := h.service.PreviewPublic(r.Context(), code, password)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusOK, resp)
}

func (h *Handler) SaveToStorage(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r.Context())
	if claims == nil {
		common.JSONError(w, common.ErrUnauthorized("login required to save files"))
		return
	}

	code := chi.URLParam(r, "code")

	// Get password from body
	var body struct {
		Password string     `json:"password"`
		FolderID *uuid.UUID `json:"folder_id"`
	}
	if r.Body != nil {
		json.NewDecoder(r.Body).Decode(&body)
	}

	req := SaveToStorageRequest{
		FolderID: body.FolderID,
	}

	resp, err := h.service.SaveToStorage(r.Context(), claims, code, body.Password, req)
	if err != nil {
		common.JSONError(w, err)
		return
	}

	common.JSON(w, http.StatusCreated, resp)
}

func (h *Handler) serveSharePage(w http.ResponseWriter, code string, info *PublicShareResponse) {
	name := info.FileName
	if name == "" {
		name = info.FolderName
	}
	size := ""
	if info.FileSize > 0 {
		switch {
		case info.FileSize >= 1073741824:
			size = fmt.Sprintf("%.1f GB", float64(info.FileSize)/1073741824)
		case info.FileSize >= 1048576:
			size = fmt.Sprintf("%.1f MB", float64(info.FileSize)/1048576)
		case info.FileSize >= 1024:
			size = fmt.Sprintf("%.1f KB", float64(info.FileSize)/1024)
		default:
			size = fmt.Sprintf("%d B", info.FileSize)
		}
	}

	icon := "description"
	if info.ShareType == "folder" {
		icon = "folder"
	} else if strings.HasPrefix(info.MimeType, "image/") {
		icon = "image"
	} else if strings.HasPrefix(info.MimeType, "video/") {
		icon = "videocam"
	} else if strings.HasPrefix(info.MimeType, "audio/") {
		icon = "music_note"
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s - ByteBox</title>
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#fff;border-radius:24px;padding:48px 32px;max-width:400px;width:90%%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
.logo{font-size:28px;font-weight:700;color:#6200EE;margin-bottom:32px}
.icon-wrap{width:80px;height:80px;border-radius:20px;background:#F3E8FD;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
.icon-wrap .material-icons{font-size:40px;color:#6200EE}
.name{font-size:18px;font-weight:600;margin-bottom:4px;word-break:break-all}
.size{font-size:14px;color:#666;margin-bottom:24px}
.btn{display:block;width:100%%;padding:14px;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;margin-bottom:10px;text-decoration:none}
.btn-primary{background:#6200EE;color:#fff}
.btn-primary:hover{background:#5000CC}
.btn-outline{background:transparent;border:2px solid #6200EE;color:#6200EE;text-align:center}
.footer{margin-top:24px;font-size:12px;color:#999}
</style>
</head>
<body>
<div class="card">
<div class="logo">ByteBox</div>
<div class="icon-wrap"><span class="material-icons">%s</span></div>
<div class="name">%s</div>
<div class="size">%s</div>
<button class="btn btn-primary" onclick="download()">Download</button>
<a class="btn btn-outline" href="bytebox://share/%s">Open in App</a>
<div class="footer">Shared via ByteBox</div>
</div>
<script>
async function download(){
try{const r=await fetch('/api/v1/s/%s/download',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
const j=await r.json();if(j.data&&j.data.url)window.location.href=j.data.url;else if(j.url)window.location.href=j.url;
else alert('Download failed');}catch(e){alert('Download failed: '+e.message)}}
</script>
</body></html>`, name, icon, name, size, code, code)
}
