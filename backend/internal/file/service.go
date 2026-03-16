package file

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"strings"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"

	"github.com/bytebox/backend/internal/auth"
	"github.com/bytebox/backend/internal/common"
	"github.com/bytebox/backend/internal/media"
	"github.com/bytebox/backend/internal/quota"
	"github.com/bytebox/backend/internal/storage"
)

type Service struct {
	repo          *Repository
	store         *storage.Client
	stream        *storage.StreamClient
	quota         *quota.Service
	queue         *asynq.Client
	maxUploadSize int64
}

func NewService(repo *Repository, store *storage.Client, stream *storage.StreamClient, quotaSvc *quota.Service, queue *asynq.Client, maxUploadSize int64) *Service {
	return &Service{
		repo:          repo,
		store:         store,
		stream:        stream,
		quota:         quotaSvc,
		queue:         queue,
		maxUploadSize: maxUploadSize,
	}
}

func (s *Service) Upload(ctx context.Context, claims *auth.TokenClaims, header *multipart.FileHeader, folderID *uuid.UUID) (*FileResponse, error) {
	// Check file size
	if header.Size > s.maxUploadSize {
		return nil, common.ErrTooLarge(fmt.Sprintf("file too large, max %dMB", s.maxUploadSize/(1024*1024)))
	}

	// Check storage quota
	check, err := s.quota.CheckUpload(ctx, claims.UserID, header.Size)
	if err != nil {
		slog.Error("failed to check quota", "error", err)
		return nil, common.ErrInternal("failed to check storage quota")
	}
	if !check.Allowed {
		return nil, common.ErrTooLarge(check.WarningMsg)
	}

	// Open file
	src, err := header.Open()
	if err != nil {
		return nil, common.ErrInternal("failed to open file")
	}
	defer src.Close()

	// Compute hash while reading
	hasher := sha256.New()
	tee := io.TeeReader(src, hasher)

	// Generate storage key
	fileID := uuid.New()
	prefix := claims.UserID.String()[:2]
	storageKey := fmt.Sprintf("files/%s/%s/%s/%s", prefix, claims.UserID, fileID, header.Filename)

	// Detect content type
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// Upload to storage
	if err := s.store.Upload(ctx, s.store.BucketFiles(), storageKey, tee, contentType, header.Size); err != nil {
		slog.Error("failed to upload to storage", "error", err)
		return nil, common.ErrInternal("failed to upload file")
	}

	contentHash := hex.EncodeToString(hasher.Sum(nil))

	// Create file record
	isVideo := strings.HasPrefix(contentType, "video/")
	file := &File{
		ID:          fileID,
		UserID:      claims.UserID,
		FolderID:    folderID,
		Name:        header.Filename,
		StorageKey:  storageKey,
		Size:        header.Size,
		MimeType:    contentType,
		ContentHash: contentHash,
		IsVideo:     isVideo,
	}

	// Check if a file with the same name already exists in this folder (versioning)
	existingFiles, _, err := s.repo.ListByFolder(ctx, claims.UserID, folderID, common.PaginationParams{Limit: 1000, Sort: "name", Order: "asc"})
	if err == nil {
		for _, ef := range existingFiles {
			if ef.Name == header.Filename {
				// Create a version entry for the existing file before replacing it
				latestVer, verErr := s.repo.GetLatestVersionNumber(ctx, ef.ID)
				if verErr != nil {
					slog.Error("failed to get latest version number", "error", verErr)
				} else {
					version := &FileVersion{
						FileID:        ef.ID,
						VersionNumber: latestVer + 1,
						StorageKey:    ef.StorageKey,
						Size:          ef.Size,
						ContentHash:   ef.ContentHash,
						CreatedBy:     claims.UserID,
					}
					if verErr := s.repo.CreateVersion(ctx, version); verErr != nil {
						slog.Error("failed to create version entry", "error", verErr)
					}
				}
				break
			}
		}
	}

	if err := s.repo.Create(ctx, file); err != nil {
		// Cleanup storage on DB failure
		s.store.Delete(ctx, s.store.BucketFiles(), storageKey)
		if strings.Contains(err.Error(), "duplicate key") {
			return nil, common.ErrConflict("file with this name already exists in this folder")
		}
		slog.Error("failed to create file record", "error", err)
		return nil, common.ErrInternal("failed to save file")
	}

	// Update storage used
	if err := s.quota.UpdateUsage(ctx, claims.UserID, header.Size); err != nil {
		slog.Error("failed to update storage used", "error", err)
	}

	// Enqueue thumbnail generation
	if s.queue != nil {
		task, err := media.NewThumbnailTask(file.ID, file.UserID, file.StorageKey, file.MimeType)
		if err == nil {
			if _, err := s.queue.Enqueue(task); err != nil {
				slog.Error("failed to enqueue thumbnail task", "error", err)
			}
		}

		// Enqueue virus scan
		scanTask, err := media.NewVirusScanTask(file.ID, file.StorageKey)
		if err == nil {
			if _, err := s.queue.Enqueue(scanTask); err != nil {
				slog.Error("failed to enqueue virus scan task", "error", err)
			}
		}

		// Enqueue video transcoding if this is a video file
		if isVideo {
			transcodeTask, err := media.NewTranscodeVideoTask(file.ID, file.UserID, file.StorageKey, file.Name)
			if err == nil {
				if _, err := s.queue.Enqueue(transcodeTask); err != nil {
					slog.Error("failed to enqueue transcode task", "error", err)
				}
			}
		}
	}

	resp := file.ToResponse()
	return &resp, nil
}

func (s *Service) GetByID(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) (*FileResponse, error) {
	file, err := s.repo.GetByID(ctx, id, claims.UserID)
	if err != nil {
		slog.Error("failed to get file", "error", err)
		return nil, common.ErrInternal("failed to get file")
	}
	if file == nil || file.TrashedAt != nil {
		return nil, common.ErrNotFound("file not found")
	}
	resp := file.ToResponse()
	return &resp, nil
}

func (s *Service) Download(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) (*DownloadResponse, error) {
	file, err := s.repo.GetByID(ctx, id, claims.UserID)
	if err != nil || file == nil || file.TrashedAt != nil {
		return nil, common.ErrNotFound("file not found")
	}

	url, err := s.store.PresignGetURL(ctx, s.store.BucketFiles(), file.StorageKey, s.store.PresignExpiry())
	if err != nil {
		slog.Error("failed to generate download URL", "error", err)
		return nil, common.ErrInternal("failed to generate download URL")
	}

	resp := &DownloadResponse{
		URL:       url,
		ExpiresIn: int64(s.store.PresignExpiry().Seconds()),
	}

	// Include video streaming info if available
	if file.IsVideo {
		resp.IsVideo = true
		resp.HLSURL = file.HLSURL
		resp.VideoThumbnailURL = file.VideoThumbnailURL
	}

	return resp, nil
}

func (s *Service) GetStreamInfo(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) (*DownloadResponse, error) {
	file, err := s.repo.GetByID(ctx, id, claims.UserID)
	if err != nil || file == nil || file.TrashedAt != nil {
		return nil, common.ErrNotFound("file not found")
	}
	if !file.IsVideo {
		return nil, common.ErrBadRequest("file is not a video")
	}
	if file.StreamStatus != "ready" {
		return nil, common.ErrBadRequest(fmt.Sprintf("video is not ready for streaming (status: %s)", file.StreamStatus))
	}

	return &DownloadResponse{
		IsVideo:           true,
		HLSURL:            file.HLSURL,
		VideoThumbnailURL: file.VideoThumbnailURL,
	}, nil
}

func (s *Service) ListByFolder(ctx context.Context, claims *auth.TokenClaims, folderID *uuid.UUID, params common.PaginationParams) ([]FileResponse, bool, error) {
	files, hasMore, err := s.repo.ListByFolder(ctx, claims.UserID, folderID, params)
	if err != nil {
		slog.Error("failed to list files", "error", err)
		return nil, false, common.ErrInternal("failed to list files")
	}

	result := make([]FileResponse, len(files))
	for i, f := range files {
		result[i] = f.ToResponse()
	}
	return result, hasMore, nil
}

func (s *Service) Rename(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID, req RenameFileRequest) (*FileResponse, error) {
	name := strings.TrimSpace(req.Name)

	file, err := s.repo.GetByID(ctx, id, claims.UserID)
	if err != nil || file == nil || file.TrashedAt != nil {
		return nil, common.ErrNotFound("file not found")
	}

	if err := s.repo.Rename(ctx, id, claims.UserID, name); err != nil {
		slog.Error("failed to rename file", "error", err)
		return nil, common.ErrInternal("failed to rename file")
	}

	updated, _ := s.repo.GetByID(ctx, id, claims.UserID)
	if updated == nil {
		return nil, common.ErrNotFound("file not found")
	}
	resp := updated.ToResponse()
	return &resp, nil
}

func (s *Service) Move(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID, req MoveFileRequest) (*FileResponse, error) {
	file, err := s.repo.GetByID(ctx, id, claims.UserID)
	if err != nil || file == nil || file.TrashedAt != nil {
		return nil, common.ErrNotFound("file not found")
	}

	if err := s.repo.Move(ctx, id, claims.UserID, req.FolderID); err != nil {
		slog.Error("failed to move file", "error", err)
		return nil, common.ErrInternal("failed to move file")
	}

	updated, _ := s.repo.GetByID(ctx, id, claims.UserID)
	if updated == nil {
		return nil, common.ErrNotFound("file not found")
	}
	resp := updated.ToResponse()
	return &resp, nil
}

func (s *Service) Trash(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) error {
	if err := s.repo.Trash(ctx, id, claims.UserID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			return common.ErrNotFound("file not found")
		}
		slog.Error("failed to trash file", "error", err)
		return common.ErrInternal("failed to trash file")
	}
	return nil
}

func (s *Service) Restore(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) error {
	if err := s.repo.Restore(ctx, id, claims.UserID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			return common.ErrNotFound("file not found")
		}
		slog.Error("failed to restore file", "error", err)
		return common.ErrInternal("failed to restore file")
	}
	return nil
}

func (s *Service) Delete(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) error {
	file, err := s.repo.Delete(ctx, id, claims.UserID)
	if err != nil {
		return common.ErrNotFound("file not found")
	}

	// Delete from storage
	if err := s.store.Delete(ctx, s.store.BucketFiles(), file.StorageKey); err != nil {
		slog.Error("failed to delete from storage", "key", file.StorageKey, "error", err)
	}
	if file.ThumbnailKey != "" {
		if err := s.store.Delete(ctx, s.store.BucketThumbs(), file.ThumbnailKey); err != nil {
			slog.Error("failed to delete thumbnail", "key", file.ThumbnailKey, "error", err)
		}
	}
	// Delete from Bunny Stream if applicable
	if file.StreamVideoID != "" && s.stream != nil {
		if err := s.stream.DeleteVideo(ctx, file.StreamVideoID); err != nil {
			slog.Error("failed to delete video from cloudflare stream", "video_id", file.StreamVideoID, "error", err)
		}
	}

	// Update storage used
	if err := s.quota.UpdateUsage(ctx, claims.UserID, -file.Size); err != nil {
		slog.Error("failed to update storage used", "error", err)
	}

	return nil
}

func (s *Service) Search(ctx context.Context, claims *auth.TokenClaims, query string) ([]FileResponse, error) {
	if strings.TrimSpace(query) == "" {
		return []FileResponse{}, nil
	}

	files, err := s.repo.Search(ctx, claims.UserID, query, 50)
	if err != nil {
		slog.Error("failed to search files", "error", err)
		return nil, common.ErrInternal("failed to search files")
	}

	result := make([]FileResponse, len(files))
	for i, f := range files {
		result[i] = f.ToResponse()
	}
	return result, nil
}

func (s *Service) ListVersions(ctx context.Context, claims *auth.TokenClaims, fileID uuid.UUID) ([]FileVersionResponse, error) {
	file, err := s.repo.GetByID(ctx, fileID, claims.UserID)
	if err != nil || file == nil {
		return nil, common.ErrNotFound("file not found")
	}

	versions, err := s.repo.ListVersions(ctx, fileID)
	if err != nil {
		slog.Error("failed to list versions", "error", err)
		return nil, common.ErrInternal("failed to list versions")
	}

	result := make([]FileVersionResponse, len(versions))
	for i, v := range versions {
		result[i] = v.ToResponse()
	}
	return result, nil
}

func (s *Service) GetVersionDownloadURL(ctx context.Context, claims *auth.TokenClaims, fileID uuid.UUID, versionNumber int) (*DownloadResponse, error) {
	file, err := s.repo.GetByID(ctx, fileID, claims.UserID)
	if err != nil || file == nil {
		return nil, common.ErrNotFound("file not found")
	}

	version, err := s.repo.GetVersion(ctx, fileID, versionNumber)
	if err != nil || version == nil {
		return nil, common.ErrNotFound("version not found")
	}

	url, err := s.store.PresignGetURL(ctx, s.store.BucketFiles(), version.StorageKey, s.store.PresignExpiry())
	if err != nil {
		slog.Error("failed to generate download URL for version", "error", err)
		return nil, common.ErrInternal("failed to generate download URL")
	}

	return &DownloadResponse{
		URL:       url,
		ExpiresIn: int64(s.store.PresignExpiry().Seconds()),
	}, nil
}

func (s *Service) RestoreVersion(ctx context.Context, claims *auth.TokenClaims, fileID uuid.UUID, versionNumber int) (*FileResponse, error) {
	file, err := s.repo.GetByID(ctx, fileID, claims.UserID)
	if err != nil || file == nil {
		return nil, common.ErrNotFound("file not found")
	}

	version, err := s.repo.GetVersion(ctx, fileID, versionNumber)
	if err != nil || version == nil {
		return nil, common.ErrNotFound("version not found")
	}

	if err := s.repo.RestoreVersion(ctx, fileID, versionNumber); err != nil {
		slog.Error("failed to restore version", "error", err)
		return nil, common.ErrInternal("failed to restore version")
	}

	// Update storage used (delta between old and restored version)
	sizeDelta := version.Size - file.Size
	if sizeDelta != 0 {
		if err := s.quota.UpdateUsage(ctx, claims.UserID, sizeDelta); err != nil {
			slog.Error("failed to update storage used", "error", err)
		}
	}

	updated, _ := s.repo.GetByID(ctx, fileID, claims.UserID)
	if updated == nil {
		return nil, common.ErrNotFound("file not found")
	}
	resp := updated.ToResponse()
	return &resp, nil
}

func (s *Service) DeleteVersion(ctx context.Context, claims *auth.TokenClaims, fileID uuid.UUID, versionNumber int) error {
	file, err := s.repo.GetByID(ctx, fileID, claims.UserID)
	if err != nil || file == nil {
		return common.ErrNotFound("file not found")
	}

	version, err := s.repo.GetVersion(ctx, fileID, versionNumber)
	if err != nil || version == nil {
		return common.ErrNotFound("version not found")
	}

	// Delete from storage
	if err := s.store.Delete(ctx, s.store.BucketFiles(), version.StorageKey); err != nil {
		slog.Error("failed to delete version from storage", "key", version.StorageKey, "error", err)
	}

	// Delete from DB
	if err := s.repo.DeleteVersion(ctx, fileID, versionNumber); err != nil {
		slog.Error("failed to delete version", "error", err)
		return common.ErrInternal("failed to delete version")
	}

	return nil
}

func (s *Service) ListTrashed(ctx context.Context, claims *auth.TokenClaims) ([]FileResponse, error) {
	files, err := s.repo.ListTrashed(ctx, claims.UserID)
	if err != nil {
		slog.Error("failed to list trashed", "error", err)
		return nil, common.ErrInternal("failed to list trashed files")
	}

	result := make([]FileResponse, len(files))
	for i, f := range files {
		result[i] = f.ToResponse()
	}
	return result, nil
}
