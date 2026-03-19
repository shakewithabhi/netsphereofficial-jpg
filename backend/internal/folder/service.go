package folder

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/bytebox/backend/internal/auth"
	"github.com/bytebox/backend/internal/common"
	"github.com/bytebox/backend/internal/file"
	"github.com/bytebox/backend/internal/storage"
)

const rootContentsCacheTTL = 15 * time.Second

type Service struct {
	repo     *Repository
	fileRepo *file.Repository
	store    *storage.Client
	rdb      *redis.Client
}

func NewService(repo *Repository, fileRepo *file.Repository, store *storage.Client, rdb *redis.Client) *Service {
	return &Service{repo: repo, fileRepo: fileRepo, store: store, rdb: rdb}
}

func rootContentsCacheKey(userID uuid.UUID) string {
	return "folder:root:" + userID.String()
}

// invalidateRootContents removes the cached root folder listing for a user.
func (s *Service) invalidateRootContents(ctx context.Context, userID uuid.UUID) {
	if s.rdb == nil {
		return
	}
	if err := s.rdb.Del(ctx, rootContentsCacheKey(userID)).Err(); err != nil {
		slog.Warn("failed to invalidate root contents cache", "user_id", userID, "error", err)
	}
}

func (s *Service) Create(ctx context.Context, claims *auth.TokenClaims, req CreateFolderRequest) (*FolderResponse, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, common.ErrBadRequest("folder name is required")
	}

	// Check name doesn't already exist in parent
	exists, err := s.repo.NameExists(ctx, claims.UserID, req.ParentID, name)
	if err != nil {
		slog.Error("failed to check folder name", "error", err)
		return nil, common.ErrInternal("failed to create folder")
	}
	if exists {
		return nil, common.ErrConflict("folder with this name already exists")
	}

	// Build path
	parentPath, err := s.repo.GetParentPath(ctx, req.ParentID, claims.UserID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, common.ErrNotFound("parent folder not found")
		}
		slog.Error("failed to get parent path", "error", err)
		return nil, common.ErrInternal("failed to create folder")
	}

	path := parentPath
	if path == "/" {
		path = "/" + name
	} else {
		path = parentPath + "/" + name
	}

	folder := &Folder{
		UserID:   claims.UserID,
		ParentID: req.ParentID,
		Name:     name,
		Path:     path,
	}

	if err := s.repo.Create(ctx, folder); err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return nil, common.ErrConflict("folder with this name already exists")
		}
		slog.Error("failed to create folder", "error", err)
		return nil, common.ErrInternal("failed to create folder")
	}

	s.invalidateRootContents(ctx, claims.UserID)

	resp := folder.ToResponse()
	return &resp, nil
}

func (s *Service) GetByID(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) (*FolderResponse, error) {
	folder, err := s.repo.GetByID(ctx, id, claims.UserID)
	if err != nil {
		slog.Error("failed to get folder", "error", err)
		return nil, common.ErrInternal("failed to get folder")
	}
	if folder == nil {
		return nil, common.ErrNotFound("folder not found")
	}
	if folder.TrashedAt != nil {
		return nil, common.ErrNotFound("folder not found")
	}
	resp := folder.ToResponse()
	return &resp, nil
}

type FolderContentsResult struct {
	Folders []FolderResponse      `json:"folders"`
	Files   []file.FileResponse   `json:"files"`
}

func (s *Service) ListContents(ctx context.Context, claims *auth.TokenClaims, parentID *uuid.UUID, params common.PaginationParams) (*FolderContentsResult, error) {
	// If parentID is specified, verify it exists and belongs to user
	if parentID != nil {
		folder, err := s.repo.GetByID(ctx, *parentID, claims.UserID)
		if err != nil {
			slog.Error("failed to get folder", "error", err)
			return nil, common.ErrInternal("failed to list folder")
		}
		if folder == nil || folder.TrashedAt != nil {
			return nil, common.ErrNotFound("folder not found")
		}
	}

	// For root folder listing with default pagination, try Redis cache
	isRootDefault := parentID == nil && params.Cursor == "" && params.Sort == "name" && params.Order == "asc"
	if isRootDefault && s.rdb != nil {
		key := rootContentsCacheKey(claims.UserID)
		data, err := s.rdb.Get(ctx, key).Bytes()
		if err == nil {
			var cached FolderContentsResult
			if err := json.Unmarshal(data, &cached); err == nil {
				return &cached, nil
			}
		}
	}

	folders, err := s.repo.ListByParent(ctx, claims.UserID, parentID)
	if err != nil {
		slog.Error("failed to list folders", "error", err)
		return nil, common.ErrInternal("failed to list folders")
	}

	folderResponses := make([]FolderResponse, len(folders))
	for i, f := range folders {
		folderResponses[i] = f.ToResponse()
	}

	files, _, err := s.fileRepo.ListByFolder(ctx, claims.UserID, parentID, params)
	if err != nil {
		slog.Error("failed to list files", "error", err)
		return nil, common.ErrInternal("failed to list files")
	}

	fileResponses := make([]file.FileResponse, len(files))
	fileIDs := make([]uuid.UUID, len(files))
	for i, f := range files {
		fileResponses[i] = f.ToResponse()
		fileIDs[i] = f.ID
		// Enrich thumbnail URL with presigned URL
		if fileResponses[i].ThumbnailKey != "" {
			if url, err := s.store.PresignGetURL(ctx, s.store.BucketThumbs(), fileResponses[i].ThumbnailKey, 24*time.Hour); err == nil {
				fileResponses[i].ThumbnailURL = url
			}
		}
	}
	// Enrich share codes
	if shareCodes, err := s.fileRepo.GetShareCodes(ctx, claims.UserID, fileIDs); err == nil {
		for i := range fileResponses {
			if code, ok := shareCodes[fileResponses[i].ID]; ok {
				fileResponses[i].ShareCode = code
			}
		}
	}

	result := &FolderContentsResult{
		Folders: folderResponses,
		Files:   fileResponses,
	}

	// Cache root folder result in Redis (best-effort)
	if isRootDefault && s.rdb != nil {
		if data, err := json.Marshal(result); err == nil {
			if err := s.rdb.Set(ctx, rootContentsCacheKey(claims.UserID), data, rootContentsCacheTTL).Err(); err != nil {
				slog.Warn("failed to cache root contents", "error", err)
			}
		}
	}

	return result, nil
}

func (s *Service) Rename(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID, req RenameFolderRequest) (*FolderResponse, error) {
	name := strings.TrimSpace(req.Name)

	folder, err := s.repo.GetByID(ctx, id, claims.UserID)
	if err != nil || folder == nil || folder.TrashedAt != nil {
		return nil, common.ErrNotFound("folder not found")
	}

	exists, err := s.repo.NameExists(ctx, claims.UserID, folder.ParentID, name)
	if err != nil {
		return nil, common.ErrInternal("failed to rename folder")
	}
	if exists {
		return nil, common.ErrConflict("folder with this name already exists")
	}

	if err := s.repo.Rename(ctx, id, claims.UserID, name); err != nil {
		slog.Error("failed to rename folder", "error", err)
		return nil, common.ErrInternal("failed to rename folder")
	}

	s.invalidateRootContents(ctx, claims.UserID)

	updated, _ := s.repo.GetByID(ctx, id, claims.UserID)
	if updated == nil {
		return nil, common.ErrNotFound("folder not found")
	}
	resp := updated.ToResponse()
	return &resp, nil
}

func (s *Service) Move(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID, req MoveFolderRequest) (*FolderResponse, error) {
	folder, err := s.repo.GetByID(ctx, id, claims.UserID)
	if err != nil || folder == nil || folder.TrashedAt != nil {
		return nil, common.ErrNotFound("folder not found")
	}

	// Prevent moving into itself
	if req.ParentID != nil && *req.ParentID == id {
		return nil, common.ErrBadRequest("cannot move folder into itself")
	}

	parentPath, err := s.repo.GetParentPath(ctx, req.ParentID, claims.UserID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, common.ErrNotFound("destination folder not found")
		}
		return nil, common.ErrInternal("failed to move folder")
	}

	newPath := parentPath
	if newPath == "/" {
		newPath = "/" + folder.Name
	} else {
		newPath = parentPath + "/" + folder.Name
	}

	if err := s.repo.Move(ctx, id, claims.UserID, req.ParentID, newPath); err != nil {
		slog.Error("failed to move folder", "error", err)
		return nil, common.ErrInternal("failed to move folder")
	}

	s.invalidateRootContents(ctx, claims.UserID)

	updated, _ := s.repo.GetByID(ctx, id, claims.UserID)
	if updated == nil {
		return nil, common.ErrNotFound("folder not found")
	}
	resp := updated.ToResponse()
	return &resp, nil
}

func (s *Service) Trash(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) error {
	if err := s.repo.Trash(ctx, id, claims.UserID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			return common.ErrNotFound("folder not found")
		}
		slog.Error("failed to trash folder", "error", err)
		return common.ErrInternal("failed to trash folder")
	}
	s.invalidateRootContents(ctx, claims.UserID)
	return nil
}

func (s *Service) Restore(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) error {
	if err := s.repo.Restore(ctx, id, claims.UserID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			return common.ErrNotFound("folder not found")
		}
		slog.Error("failed to restore folder", "error", err)
		return common.ErrInternal("failed to restore folder")
	}
	s.invalidateRootContents(ctx, claims.UserID)
	return nil
}

func (s *Service) Delete(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) error {
	storageKeys, err := s.repo.Delete(ctx, id, claims.UserID)
	if err != nil {
		slog.Error("failed to delete folder", "error", err)
		return common.ErrInternal("failed to delete folder")
	}

	// Delete files from storage
	for _, key := range storageKeys {
		if err := s.store.Delete(ctx, s.store.BucketFiles(), key); err != nil {
			slog.Error("failed to delete file from storage",
				"key", key,
				"error", fmt.Errorf("delete from storage: %w", err),
			)
		}
	}

	s.invalidateRootContents(ctx, claims.UserID)

	return nil
}
