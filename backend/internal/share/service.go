package share

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/bytebox/backend/internal/auth"
	"github.com/bytebox/backend/internal/common"
	"github.com/bytebox/backend/internal/file"
	"github.com/bytebox/backend/internal/folder"
	"github.com/bytebox/backend/internal/quota"
	"github.com/bytebox/backend/internal/storage"
)

type Service struct {
	repo         *Repository
	fileRepo     *file.Repository
	folderRepo   *folder.Repository
	store        *storage.Client
	quotaService *quota.Service
	baseURL      string // e.g., "https://byteboxapp.com"
}

func NewService(repo *Repository, fileRepo *file.Repository, folderRepo *folder.Repository, store *storage.Client, baseURL string) *Service {
	return &Service{repo: repo, fileRepo: fileRepo, folderRepo: folderRepo, store: store, baseURL: baseURL}
}

func (s *Service) SetQuotaService(qs *quota.Service) {
	s.quotaService = qs
}

func (s *Service) Create(ctx context.Context, claims *auth.TokenClaims, req CreateShareRequest) (*ShareResponse, error) {
	// Determine share type
	var shareType string
	if req.FileID != nil {
		shareType = "file"
	} else if req.FolderID != nil {
		shareType = "folder"
	} else {
		return nil, common.ErrBadRequest("file_id or folder_id is required")
	}

	// Validate ownership
	var fileInfo *file.File
	if shareType == "file" {
		f, err := s.fileRepo.GetByID(ctx, *req.FileID, claims.UserID)
		if err != nil || f == nil || f.TrashedAt != nil {
			return nil, common.ErrNotFound("file not found")
		}
		fileInfo = f
	} else {
		fd, err := s.folderRepo.GetByID(ctx, *req.FolderID, claims.UserID)
		if err != nil || fd == nil || fd.TrashedAt != nil {
			return nil, common.ErrNotFound("folder not found")
		}
	}

	// Generate short code
	code, err := generateCode()
	if err != nil {
		return nil, common.ErrInternal("failed to generate share code")
	}

	// Hash password if provided
	var passwordHash string
	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, common.ErrInternal("failed to hash password")
		}
		passwordHash = string(hash)
	}

	share := &Share{
		FileID:       req.FileID,
		FolderID:     req.FolderID,
		UserID:       claims.UserID,
		Code:         code,
		ShareType:    shareType,
		PasswordHash: passwordHash,
		ExpiresAt:    req.ExpiresAt,
		MaxDownloads: req.MaxDownloads,
	}

	if err := s.repo.Create(ctx, share); err != nil {
		slog.Error("failed to create share", "error", err)
		return nil, common.ErrInternal("failed to create share link")
	}

	return s.toResponse(share, fileInfo), nil
}

func (s *Service) List(ctx context.Context, claims *auth.TokenClaims) ([]ShareResponse, error) {
	shares, err := s.repo.ListByUser(ctx, claims.UserID)
	if err != nil {
		slog.Error("failed to list shares", "error", err)
		return nil, common.ErrInternal("failed to list shares")
	}

	result := make([]ShareResponse, len(shares))
	for i, sh := range shares {
		var f *file.File
		if sh.FileID != nil {
			f, _ = s.fileRepo.GetByID(ctx, *sh.FileID, claims.UserID)
		}
		result[i] = *s.toResponse(&sh, f)
	}
	return result, nil
}

func (s *Service) Update(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID, req UpdateShareRequest) error {
	share, err := s.repo.GetByID(ctx, id, claims.UserID)
	if err != nil || share == nil {
		return common.ErrNotFound("share not found")
	}

	var passwordHash *string
	if req.Password != nil {
		if *req.Password == "" {
			empty := ""
			passwordHash = &empty
		} else {
			hash, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
			if err != nil {
				return common.ErrInternal("failed to hash password")
			}
			h := string(hash)
			passwordHash = &h
		}
	}

	if err := s.repo.Update(ctx, id, claims.UserID, passwordHash, req.ExpiresAt, req.MaxDownloads, req.IsActive); err != nil {
		slog.Error("failed to update share", "error", err)
		return common.ErrInternal("failed to update share")
	}

	return nil
}

func (s *Service) Delete(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) error {
	if err := s.repo.Delete(ctx, id, claims.UserID); err != nil {
		return common.ErrNotFound("share not found")
	}
	return nil
}

// Public endpoints (no auth required)

func (s *Service) GetPublicInfo(ctx context.Context, code string) (*PublicShareResponse, error) {
	share, err := s.repo.GetByCode(ctx, code)
	if err != nil || share == nil {
		return nil, common.ErrNotFound("share not found")
	}

	if err := s.validateShare(share); err != nil {
		return nil, err
	}

	resp := &PublicShareResponse{
		ShareType:      share.ShareType,
		HasPassword:    share.PasswordHash != "",
		DownloadCount:  int64(share.DownloadCount),
		AppDownloadURL: "https://byteboxapp.com/download",
		ExpiresAt:      share.ExpiresAt,
	}

	if share.ShareType == "file" {
		f, err := s.fileRepo.GetByID(ctx, *share.FileID, share.UserID)
		if err != nil || f == nil || f.TrashedAt != nil {
			return nil, common.ErrNotFound("file no longer available")
		}
		resp.FileName = f.Name
		resp.FileSize = f.Size
		resp.MimeType = f.MimeType
		resp.IsVideo = f.IsVideo
		resp.IsImage = strings.HasPrefix(f.MimeType, "image/")
		resp.VideoThumbnailURL = f.VideoThumbnailURL
		resp.ThumbnailURL = f.ThumbnailKey
		resp.PreviewAvailable = f.IsVideo || strings.HasPrefix(f.MimeType, "image/")
	} else {
		fd, err := s.folderRepo.GetByID(ctx, *share.FolderID, share.UserID)
		if err != nil || fd == nil || fd.TrashedAt != nil {
			return nil, common.ErrNotFound("folder no longer available")
		}
		count, err := s.repo.CountFolderFiles(ctx, *share.FolderID)
		if err != nil {
			slog.Error("failed to count folder files", "error", err)
			return nil, common.ErrInternal("failed to get folder info")
		}
		resp.FolderName = fd.Name
		resp.ItemCount = count
	}

	return resp, nil
}

func (s *Service) GetPublicFolderContents(ctx context.Context, code, password string) (*PublicFolderContentsResponse, error) {
	share, err := s.repo.GetByCode(ctx, code)
	if err != nil || share == nil {
		return nil, common.ErrNotFound("share not found")
	}

	if err := s.validateShare(share); err != nil {
		return nil, err
	}

	if share.ShareType != "folder" {
		return nil, common.ErrBadRequest("this share is not a folder")
	}

	// Check password
	if share.PasswordHash != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(share.PasswordHash), []byte(password)); err != nil {
			return nil, common.ErrUnauthorized("incorrect password")
		}
	}

	// Get folder name
	fd, err := s.folderRepo.GetByID(ctx, *share.FolderID, share.UserID)
	if err != nil || fd == nil || fd.TrashedAt != nil {
		return nil, common.ErrNotFound("folder no longer available")
	}

	// Get files in folder
	files, err := s.repo.GetFolderContents(ctx, *share.FolderID)
	if err != nil {
		slog.Error("failed to get folder contents", "error", err)
		return nil, common.ErrInternal("failed to get folder contents")
	}

	fileResponses := make([]file.FileResponse, len(files))
	for i, f := range files {
		fileResponses[i] = f.ToResponse()
	}

	return &PublicFolderContentsResponse{
		FolderName: fd.Name,
		Files:      fileResponses,
	}, nil
}

func (s *Service) DownloadPublic(ctx context.Context, code, password string, fileID *uuid.UUID) (*ShareDownloadResponse, error) {
	share, err := s.repo.GetByCode(ctx, code)
	if err != nil || share == nil {
		return nil, common.ErrNotFound("share not found")
	}

	if err := s.validateShare(share); err != nil {
		return nil, err
	}

	// Check password
	if share.PasswordHash != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(share.PasswordHash), []byte(password)); err != nil {
			return nil, common.ErrUnauthorized("incorrect password")
		}
	}

	var f *file.File

	if share.ShareType == "file" {
		// Direct file share
		f, err = s.fileRepo.GetByID(ctx, *share.FileID, share.UserID)
		if err != nil || f == nil || f.TrashedAt != nil {
			return nil, common.ErrNotFound("file no longer available")
		}
	} else {
		// Folder share: require fileID to specify which file
		if fileID == nil {
			return nil, common.ErrBadRequest("file_id is required for folder share downloads")
		}
		// Verify the file belongs to the shared folder
		f, err = s.fileRepo.GetByID(ctx, *fileID, share.UserID)
		if err != nil || f == nil || f.TrashedAt != nil {
			return nil, common.ErrNotFound("file not found in shared folder")
		}
		if f.FolderID == nil || *f.FolderID != *share.FolderID {
			return nil, common.ErrNotFound("file not found in shared folder")
		}
	}

	// Generate presigned URL
	expiry := s.store.PresignExpiry()
	url, err := s.store.PresignGetURL(ctx, s.store.BucketFiles(), f.StorageKey, expiry)
	if err != nil {
		slog.Error("failed to generate download URL", "error", err)
		return nil, common.ErrInternal("failed to generate download URL")
	}

	// Increment download count
	s.repo.IncrementDownload(ctx, share.ID)

	resp := &ShareDownloadResponse{
		URL:       url,
		ExpiresIn: int64(expiry.Seconds()),
	}

	// Include video streaming info if available
	if f.IsVideo {
		resp.IsVideo = true
		resp.HLSURL = f.HLSURL
		resp.VideoThumbnailURL = f.VideoThumbnailURL
	}

	return resp, nil
}

func (s *Service) PreviewPublic(ctx context.Context, code, password string) (*PreviewResponse, error) {
	share, err := s.repo.GetByCode(ctx, code)
	if err != nil || share == nil {
		return nil, common.ErrNotFound("share not found")
	}

	if err := s.validateShare(share); err != nil {
		return nil, err
	}

	if share.ShareType != "file" {
		return nil, common.ErrBadRequest("preview is only available for file shares")
	}

	// Check password
	if share.PasswordHash != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(share.PasswordHash), []byte(password)); err != nil {
			return nil, common.ErrUnauthorized("incorrect password")
		}
	}

	f, err := s.fileRepo.GetByID(ctx, *share.FileID, share.UserID)
	if err != nil || f == nil || f.TrashedAt != nil {
		return nil, common.ErrNotFound("file no longer available")
	}

	resp := &PreviewResponse{
		FileName: f.Name,
		FileSize: f.Size,
		MimeType: f.MimeType,
		IsVideo:  f.IsVideo,
		IsImage:  strings.HasPrefix(f.MimeType, "image/"),
	}

	if f.IsVideo {
		// Preview duration: 15 seconds for short videos (<5 min), 30 seconds for longer
		previewDuration := 15
		if f.VideoDurationSec >= 300 {
			previewDuration = 30
		}
		// Short-lived presigned URL for video preview
		presignExpiry := time.Duration(previewDuration+30) * time.Second // extra 30s buffer for loading
		url, err := s.store.PresignGetURL(ctx, s.store.BucketFiles(), f.StorageKey, presignExpiry)
		if err != nil {
			slog.Error("failed to generate preview URL", "error", err)
			return nil, common.ErrInternal("failed to generate preview URL")
		}
		resp.URL = url
		resp.PreviewDuration = previewDuration
		resp.VideoDurationSeconds = f.VideoDurationSec
		resp.HLSURL = f.HLSURL
		resp.VideoThumbnailURL = f.VideoThumbnailURL
		resp.RequiresLogin = true
	} else if strings.HasPrefix(f.MimeType, "image/") {
		// Images get a 60-second presigned URL
		url, err := s.store.PresignGetURL(ctx, s.store.BucketFiles(), f.StorageKey, 60*time.Second)
		if err != nil {
			slog.Error("failed to generate preview URL", "error", err)
			return nil, common.ErrInternal("failed to generate preview URL")
		}
		resp.URL = url
		resp.PreviewDuration = 0
		if f.ThumbnailKey != "" {
			thumbURL, err := s.store.PresignGetURL(ctx, s.store.BucketThumbs(), f.ThumbnailKey, 60*time.Second)
			if err == nil {
				resp.ThumbnailURL = thumbURL
			}
		}
	}
	// For other file types: no URL, just metadata

	return resp, nil
}

func (s *Service) SaveToStorage(ctx context.Context, claims *auth.TokenClaims, code, password string, req SaveToStorageRequest) (*file.FileResponse, error) {
	share, err := s.repo.GetByCode(ctx, code)
	if err != nil || share == nil {
		return nil, common.ErrNotFound("share not found")
	}

	if err := s.validateShare(share); err != nil {
		return nil, err
	}

	if share.ShareType != "file" {
		return nil, common.ErrBadRequest("save to storage is only available for file shares")
	}

	// Check password
	if share.PasswordHash != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(share.PasswordHash), []byte(password)); err != nil {
			return nil, common.ErrUnauthorized("incorrect password")
		}
	}

	// Get the source file
	f, err := s.fileRepo.GetByID(ctx, *share.FileID, share.UserID)
	if err != nil || f == nil || f.TrashedAt != nil {
		return nil, common.ErrNotFound("file no longer available")
	}

	// Check quota before saving
	if s.quotaService != nil {
		check, err := s.quotaService.CheckUpload(ctx, claims.UserID, f.Size)
		if err != nil {
			slog.Error("failed to check quota", "error", err)
			return nil, common.ErrInternal("failed to check storage quota")
		}
		if !check.Allowed {
			return nil, common.ErrBadRequest(check.WarningMsg)
		}
	}

	// Generate a new storage key for the copy
	newStorageKey := fmt.Sprintf("%s/%s/%s", claims.UserID.String(), uuid.New().String(), f.Name)

	// Copy the actual S3 object
	if err := s.store.Copy(ctx, s.store.BucketFiles(), f.StorageKey, newStorageKey); err != nil {
		slog.Error("failed to copy file in storage", "error", err)
		return nil, common.ErrInternal("failed to save file to your storage")
	}

	// Create a new file record for the current user
	newFile := &file.File{
		UserID:     claims.UserID,
		FolderID:   req.FolderID,
		Name:       f.Name,
		StorageKey: newStorageKey,
		Size:       f.Size,
		MimeType:   f.MimeType,
		IsVideo:    f.IsVideo,
	}

	if err := s.fileRepo.Create(ctx, newFile); err != nil {
		slog.Error("failed to create file record", "error", err)
		// Attempt to clean up the copied object
		_ = s.store.Delete(ctx, s.store.BucketFiles(), newStorageKey)
		return nil, common.ErrInternal("failed to save file record")
	}

	// Update storage usage
	if s.quotaService != nil {
		if err := s.quotaService.UpdateUsage(ctx, claims.UserID, f.Size); err != nil {
			slog.Error("failed to update storage usage", "error", err, "user_id", claims.UserID)
		}
	}

	resp := newFile.ToResponse()
	return &resp, nil
}

// HasUserSavedFile checks whether the given user has previously saved the shared file to their storage.
// It does this by looking for a file owned by the user that was copied from the share's source file
// (matching name and size).
func (s *Service) HasUserSavedFile(ctx context.Context, userID uuid.UUID, code string) (bool, error) {
	share, err := s.repo.GetByCode(ctx, code)
	if err != nil || share == nil {
		return false, common.ErrNotFound("share not found")
	}

	if share.ShareType != "file" || share.FileID == nil {
		// For folder shares, skip this check
		return true, nil
	}

	// Get the source file to know its name and size
	srcFile, err := s.fileRepo.GetByID(ctx, *share.FileID, share.UserID)
	if err != nil || srcFile == nil {
		return false, common.ErrNotFound("source file not found")
	}

	// Search the user's files for a matching name
	results, err := s.fileRepo.Search(ctx, userID, srcFile.Name, 1)
	if err != nil {
		return false, nil // fail open on search error
	}

	for _, f := range results {
		if f.Name == srcFile.Name && f.Size == srcFile.Size && f.TrashedAt == nil {
			return true, nil
		}
	}

	return false, nil
}

func (s *Service) validateShare(share *Share) error {
	if !share.IsActive {
		return common.ErrNotFound("share not found")
	}
	if share.ExpiresAt != nil && share.ExpiresAt.Before(time.Now()) {
		return common.ErrBadRequest("share link has expired")
	}
	if share.MaxDownloads != nil && share.DownloadCount >= *share.MaxDownloads {
		return common.ErrBadRequest("download limit reached")
	}
	return nil
}

func (s *Service) toResponse(share *Share, f *file.File) *ShareResponse {
	resp := &ShareResponse{
		ID:            share.ID,
		FileID:        share.FileID,
		FolderID:      share.FolderID,
		ShareType:     share.ShareType,
		Code:          share.Code,
		URL:           fmt.Sprintf("%s/s/%s", s.baseURL, share.Code),
		HasPassword:   share.PasswordHash != "",
		ExpiresAt:     share.ExpiresAt,
		MaxDownloads:  share.MaxDownloads,
		DownloadCount: share.DownloadCount,
		IsActive:      share.IsActive,
		CreatedAt:     share.CreatedAt,
	}
	if f != nil {
		resp.FileName = f.Name
		resp.FileSize = f.Size
		resp.MimeType = f.MimeType
	}
	return resp
}

func generateCode() (string, error) {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
