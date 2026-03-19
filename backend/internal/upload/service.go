package upload

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"strings"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"

	"github.com/bytebox/backend/internal/auth"
	"github.com/bytebox/backend/internal/common"
	"github.com/bytebox/backend/internal/file"
	"github.com/bytebox/backend/internal/media"
	"github.com/bytebox/backend/internal/quota"
	"github.com/bytebox/backend/internal/storage"
)

const (
	maxActiveUploads = 10
	sessionTTL       = 24 * time.Hour
	presignTTL       = 2 * time.Hour
	minChunkSize     = 5 * 1024 * 1024  // 5MB (S3 minimum)
	maxChunkSize     = 50 * 1024 * 1024 // 50MB
)

type Service struct {
	repo     *Repository
	fileRepo *file.Repository
	store    *storage.Client
	quota    *quota.Service
	queue    *asynq.Client
	rdb      *redis.Client
}

func NewService(repo *Repository, fileRepo *file.Repository, store *storage.Client, quotaSvc *quota.Service, queue *asynq.Client, rdb *redis.Client) *Service {
	return &Service{repo: repo, fileRepo: fileRepo, store: store, quota: quotaSvc, queue: queue, rdb: rdb}
}

// invalidateRootContentsCache removes the cached root folder listing for a user
// after a chunked upload completes and changes folder contents.
func (s *Service) invalidateRootContentsCache(ctx context.Context, userID uuid.UUID) {
	if s.rdb == nil {
		return
	}
	key := "folder:root:" + userID.String()
	if err := s.rdb.Del(ctx, key).Err(); err != nil {
		slog.Warn("failed to invalidate root contents cache from upload service", "error", err)
	}
}

func (s *Service) Init(ctx context.Context, claims *auth.TokenClaims, req InitUploadRequest) (*InitUploadResponse, error) {
	// Check active session limit
	count, err := s.repo.CountActiveSessions(ctx, claims.UserID)
	if err != nil {
		slog.Error("failed to count active sessions", "error", err)
		return nil, common.ErrInternal("failed to check upload sessions")
	}
	if count >= maxActiveUploads {
		return nil, common.ErrBadRequest(fmt.Sprintf("too many active uploads (max %d)", maxActiveUploads))
	}

	// Check storage quota
	check, err := s.quota.CheckUpload(ctx, claims.UserID, req.FileSize)
	if err != nil {
		slog.Error("failed to check quota", "error", err)
		return nil, common.ErrInternal("failed to check storage quota")
	}
	if !check.Allowed {
		return nil, common.ErrTooLarge(check.WarningMsg)
	}

	// Calculate chunk size
	chunkSize := calculateChunkSize(req.FileSize)
	totalChunks := int32((req.FileSize + chunkSize - 1) / chunkSize)

	// Generate storage key
	fileID := uuid.New()
	prefix := claims.UserID.String()[:2]
	storageKey := fmt.Sprintf("files/%s/%s/%s/%s", prefix, claims.UserID, fileID, req.Filename)

	// Create multipart upload
	mpu, err := s.store.CreateMultipartUpload(ctx, s.store.BucketFiles(), storageKey, req.MimeType)
	if err != nil {
		slog.Error("failed to create multipart upload", "error", err)
		return nil, common.ErrInternal("failed to initialize upload")
	}

	// Detect video files
	isVideo := strings.HasPrefix(req.MimeType, "video/")

	// Create session
	session := &Session{
		UserID:          claims.UserID,
		FolderID:        req.FolderID,
		Filename:        req.Filename,
		FileSize:        req.FileSize,
		MimeType:        req.MimeType,
		ChunkSize:       chunkSize,
		TotalChunks:     totalChunks,
		StorageKey:      storageKey,
		StorageUploadID: mpu.UploadID,
		IsVideo:         isVideo,
		Status:          "active",
		ExpiresAt:       time.Now().Add(sessionTTL),
	}

	if err := s.repo.CreateSession(ctx, session); err != nil {
		// Cleanup on failure
		s.store.AbortMultipartUpload(ctx, s.store.BucketFiles(), storageKey, mpu.UploadID)
		slog.Error("failed to create upload session", "error", err)
		return nil, common.ErrInternal("failed to initialize upload")
	}

	// Generate presigned URLs for all parts
	parts, err := s.generatePresignedURLs(ctx, storageKey, mpu.UploadID, totalChunks)
	if err != nil {
		slog.Error("failed to generate presigned URLs", "error", err)
		return nil, common.ErrInternal("failed to generate upload URLs")
	}

	return &InitUploadResponse{
		UploadID:    session.ID,
		ChunkSize:   chunkSize,
		TotalChunks: totalChunks,
		ExpiresAt:   session.ExpiresAt,
		Parts:       parts,
	}, nil
}

func (s *Service) Status(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) (*UploadStatusResponse, error) {
	session, err := s.repo.GetSession(ctx, id, claims.UserID)
	if err != nil || session == nil {
		return nil, common.ErrNotFound("upload session not found")
	}

	parts, err := s.repo.GetCompletedParts(ctx, session.ID)
	if err != nil {
		slog.Error("failed to get completed parts", "error", err)
		return nil, common.ErrInternal("failed to get upload status")
	}

	completedParts := make([]int32, len(parts))
	for i, p := range parts {
		completedParts[i] = p.PartNumber
	}

	return &UploadStatusResponse{
		UploadID:        session.ID,
		Status:          session.Status,
		TotalChunks:     session.TotalChunks,
		CompletedChunks: session.CompletedChunks,
		CompletedParts:  completedParts,
		ExpiresAt:       session.ExpiresAt,
	}, nil
}

func (s *Service) CompletePart(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID, req CompletePartRequest) error {
	session, err := s.repo.GetSession(ctx, id, claims.UserID)
	if err != nil || session == nil {
		return common.ErrNotFound("upload session not found")
	}
	if session.Status != "active" {
		return common.ErrBadRequest("upload session is not active")
	}
	if req.PartNumber > session.TotalChunks {
		return common.ErrBadRequest("invalid part number")
	}

	part := &Part{
		SessionID:  session.ID,
		PartNumber: req.PartNumber,
		ETag:       req.ETag,
		Size:       req.Size,
	}

	if err := s.repo.AddPart(ctx, part); err != nil {
		slog.Error("failed to add part", "error", err)
		return common.ErrInternal("failed to record completed part")
	}

	return nil
}

func (s *Service) Finalize(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) (*file.FileResponse, error) {
	session, err := s.repo.GetSession(ctx, id, claims.UserID)
	if err != nil || session == nil {
		return nil, common.ErrNotFound("upload session not found")
	}
	if session.Status != "active" {
		return nil, common.ErrBadRequest("upload session is not active")
	}

	// Get all completed parts
	parts, err := s.repo.GetCompletedParts(ctx, session.ID)
	if err != nil {
		slog.Error("failed to get completed parts", "error", err)
		return nil, common.ErrInternal("failed to finalize upload")
	}
	if int32(len(parts)) != session.TotalChunks {
		return nil, common.ErrBadRequest(fmt.Sprintf("expected %d parts, got %d", session.TotalChunks, len(parts)))
	}

	// Mark as finalizing
	s.repo.UpdateStatus(ctx, session.ID, "finalizing")

	// Complete multipart upload
	completedParts := make([]storage.CompletedPart, len(parts))
	for i, p := range parts {
		completedParts[i] = storage.CompletedPart{
			PartNumber: p.PartNumber,
			ETag:       p.ETag,
		}
	}

	if err := s.store.CompleteMultipartUpload(ctx, s.store.BucketFiles(), session.StorageKey, session.StorageUploadID, completedParts); err != nil {
		s.repo.UpdateStatus(ctx, session.ID, "active")
		slog.Error("failed to complete multipart upload", "error", err)
		return nil, common.ErrInternal("failed to finalize upload")
	}

	// Create file record
	fileID := uuid.New()
	f := &file.File{
		ID:         fileID,
		UserID:     session.UserID,
		FolderID:   session.FolderID,
		Name:       session.Filename,
		StorageKey: session.StorageKey,
		Size:       session.FileSize,
		MimeType:   session.MimeType,
		IsVideo:    session.IsVideo,
	}

	if err := s.fileRepo.Create(ctx, f); err != nil {
		slog.Error("failed to create file record", "error", err)
		return nil, common.ErrInternal("failed to save file")
	}

	// Update storage used
	if err := s.quota.UpdateUsage(ctx, claims.UserID, session.FileSize); err != nil {
		slog.Error("failed to update storage used", "error", err)
	}

	// Mark session completed and clean up
	s.repo.UpdateStatus(ctx, session.ID, "completed")

	// Invalidate root folder contents cache
	s.invalidateRootContentsCache(ctx, claims.UserID)

	// Enqueue background tasks
	if s.queue != nil {
		// Enqueue thumbnail generation
		task, err := media.NewThumbnailTask(f.ID, f.UserID, f.StorageKey, f.MimeType)
		if err == nil {
			if _, err := s.queue.Enqueue(task); err != nil {
				slog.Error("failed to enqueue thumbnail task", "error", err)
			}
		}

		// Enqueue virus scan
		scanTask, err := media.NewVirusScanTask(f.ID, f.StorageKey)
		if err == nil {
			if _, err := s.queue.Enqueue(scanTask); err != nil {
				slog.Error("failed to enqueue virus scan task", "error", err)
			}
		}

		// Enqueue video transcoding if this is a video file
		if session.IsVideo {
			transcodeTask, err := media.NewTranscodeVideoTask(f.ID, f.UserID, f.StorageKey, f.Name)
			if err == nil {
				if _, err := s.queue.Enqueue(transcodeTask); err != nil {
					slog.Error("failed to enqueue transcode task", "error", err)
				}
			}
		}
	}

	resp := f.ToResponse()
	return &resp, nil
}

func (s *Service) Cancel(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) error {
	session, err := s.repo.GetSession(ctx, id, claims.UserID)
	if err != nil || session == nil {
		return common.ErrNotFound("upload session not found")
	}
	if session.Status != "active" {
		return common.ErrBadRequest("upload session is not active")
	}

	// Abort multipart upload
	if err := s.store.AbortMultipartUpload(ctx, s.store.BucketFiles(), session.StorageKey, session.StorageUploadID); err != nil {
		slog.Error("failed to abort multipart upload", "error", err)
	}

	// Mark cancelled and delete
	s.repo.UpdateStatus(ctx, session.ID, "cancelled")
	s.repo.DeleteSession(ctx, session.ID)

	return nil
}

func (s *Service) RefreshURLs(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) (*RefreshURLsResponse, error) {
	session, err := s.repo.GetSession(ctx, id, claims.UserID)
	if err != nil || session == nil {
		return nil, common.ErrNotFound("upload session not found")
	}
	if session.Status != "active" {
		return nil, common.ErrBadRequest("upload session is not active")
	}

	parts, err := s.generatePresignedURLs(ctx, session.StorageKey, session.StorageUploadID, session.TotalChunks)
	if err != nil {
		slog.Error("failed to refresh presigned URLs", "error", err)
		return nil, common.ErrInternal("failed to refresh upload URLs")
	}

	return &RefreshURLsResponse{Parts: parts}, nil
}

// CleanupExpired aborts and deletes expired upload sessions. Called by worker.
func (s *Service) CleanupExpired(ctx context.Context) (int, error) {
	sessions, err := s.repo.ListExpiredSessions(ctx)
	if err != nil {
		return 0, err
	}

	cleaned := 0
	for _, sess := range sessions {
		if err := s.store.AbortMultipartUpload(ctx, s.store.BucketFiles(), sess.StorageKey, sess.StorageUploadID); err != nil {
			slog.Error("failed to abort expired upload", "session_id", sess.ID, "error", err)
		}
		s.repo.UpdateStatus(ctx, sess.ID, "expired")
		s.repo.DeleteSession(ctx, sess.ID)
		cleaned++
	}
	return cleaned, nil
}

func (s *Service) generatePresignedURLs(ctx context.Context, key, uploadID string, totalChunks int32) ([]PartPresignInfo, error) {
	parts := make([]PartPresignInfo, totalChunks)
	for i := int32(1); i <= totalChunks; i++ {
		url, err := s.store.PresignUploadPart(ctx, s.store.BucketFiles(), key, uploadID, i, presignTTL)
		if err != nil {
			return nil, err
		}
		parts[i-1] = PartPresignInfo{
			PartNumber: i,
			URL:        url,
		}
	}
	return parts, nil
}

func calculateChunkSize(fileSize int64) int64 {
	switch {
	case fileSize <= 100*1024*1024: // <= 100MB
		return minChunkSize // 5MB
	case fileSize <= 1024*1024*1024: // <= 1GB
		return 10 * 1024 * 1024 // 10MB
	case fileSize <= 5*1024*1024*1024: // <= 5GB
		return 25 * 1024 * 1024 // 25MB
	default:
		return maxChunkSize // 50MB
	}
}
