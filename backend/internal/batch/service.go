package batch

import (
	"archive/zip"
	"context"
	"io"
	"log/slog"
	"net/http"

	"github.com/google/uuid"

	"github.com/bytebox/backend/internal/auth"
	"github.com/bytebox/backend/internal/common"
	"github.com/bytebox/backend/internal/file"
	"github.com/bytebox/backend/internal/folder"
	"github.com/bytebox/backend/internal/storage"
)

type Service struct {
	fileRepo   *file.Repository
	folderRepo *folder.Repository
	fileSvc    *file.Service
	folderSvc  *folder.Service
	store      *storage.Client
}

func NewService(fileRepo *file.Repository, folderRepo *folder.Repository, fileSvc *file.Service, folderSvc *folder.Service, store *storage.Client) *Service {
	return &Service{
		fileRepo:   fileRepo,
		folderRepo: folderRepo,
		fileSvc:    fileSvc,
		folderSvc:  folderSvc,
		store:      store,
	}
}

func (s *Service) BatchMove(ctx context.Context, claims *auth.TokenClaims, req BatchMoveRequest) (*BatchResult, error) {
	result := &BatchResult{}

	fileIDs, folderIDs := splitByType(req.Items)

	// Move files
	if len(fileIDs) > 0 {
		affected, err := s.fileRepo.MoveMany(ctx, fileIDs, claims.UserID, req.FolderID)
		if err != nil {
			slog.Error("batch move files failed", "error", err)
		}
		for _, id := range fileIDs {
			item := BatchResultItem{ID: id, Type: "file"}
			if err != nil {
				item.Error = "failed to move"
				result.Failed++
			} else if affected > 0 {
				item.Success = true
				result.Succeeded++
				affected--
			} else {
				item.Error = "file not found"
				result.Failed++
			}
			result.Items = append(result.Items, item)
		}
	}

	// Move folders individually (they need path recalculation)
	for _, id := range folderIDs {
		item := BatchResultItem{ID: id, Type: "folder"}
		_, err := s.folderSvc.Move(ctx, claims, id, folder.MoveFolderRequest{ParentID: req.FolderID})
		if err != nil {
			item.Error = "failed to move folder"
			result.Failed++
		} else {
			item.Success = true
			result.Succeeded++
		}
		result.Items = append(result.Items, item)
	}

	return result, nil
}

func (s *Service) BatchTrash(ctx context.Context, claims *auth.TokenClaims, req BatchTrashRequest) (*BatchResult, error) {
	result := &BatchResult{}

	fileIDs, folderIDs := splitByType(req.Items)

	// Trash files in bulk
	if len(fileIDs) > 0 {
		affected, err := s.fileRepo.TrashMany(ctx, fileIDs, claims.UserID)
		if err != nil {
			slog.Error("batch trash files failed", "error", err)
			for _, id := range fileIDs {
				result.Items = append(result.Items, BatchResultItem{ID: id, Type: "file", Error: "failed to trash"})
				result.Failed++
			}
		} else {
			trashed := int(affected)
			for i, id := range fileIDs {
				item := BatchResultItem{ID: id, Type: "file"}
				if i < trashed {
					item.Success = true
					result.Succeeded++
				} else {
					item.Error = "file not found or already trashed"
					result.Failed++
				}
				result.Items = append(result.Items, item)
			}
		}
	}

	// Trash folders (uses recursive trash which also trashes contained files)
	for _, id := range folderIDs {
		item := BatchResultItem{ID: id, Type: "folder"}
		if err := s.folderSvc.Trash(ctx, claims, id); err != nil {
			item.Error = "failed to trash folder"
			result.Failed++
		} else {
			item.Success = true
			result.Succeeded++
		}
		result.Items = append(result.Items, item)
	}

	return result, nil
}

func (s *Service) BatchDelete(ctx context.Context, claims *auth.TokenClaims, req BatchDeleteRequest) (*BatchResult, error) {
	result := &BatchResult{}

	fileIDs, folderIDs := splitByType(req.Items)

	// Delete files individually (need S3 cleanup per file)
	for _, id := range fileIDs {
		item := BatchResultItem{ID: id, Type: "file"}
		if err := s.fileSvc.Delete(ctx, claims, id); err != nil {
			item.Error = "failed to delete"
			result.Failed++
		} else {
			item.Success = true
			result.Succeeded++
		}
		result.Items = append(result.Items, item)
	}

	// Delete folders (recursive delete with S3 cleanup)
	for _, id := range folderIDs {
		item := BatchResultItem{ID: id, Type: "folder"}
		if err := s.folderSvc.Delete(ctx, claims, id); err != nil {
			item.Error = "failed to delete folder"
			result.Failed++
		} else {
			item.Success = true
			result.Succeeded++
		}
		result.Items = append(result.Items, item)
	}

	return result, nil
}

const maxBatchDownloadSize = 5 * 1024 * 1024 * 1024 // 5GB

func (s *Service) BatchDownload(ctx context.Context, claims *auth.TokenClaims, req BatchDownloadRequest, w http.ResponseWriter) error {
	// Collect all file IDs (expand folders to their files)
	var fileIDs []uuid.UUID
	for _, item := range req.Items {
		if item.Type == "file" {
			fileIDs = append(fileIDs, item.ID)
		}
	}

	// Get all files
	files, err := s.fileRepo.GetByIDs(ctx, fileIDs, claims.UserID)
	if err != nil {
		return common.ErrInternal("failed to fetch files")
	}

	// Check total size
	var totalSize int64
	for _, f := range files {
		if f.TrashedAt != nil {
			continue
		}
		totalSize += f.Size
	}
	if totalSize > maxBatchDownloadSize {
		return common.ErrTooLarge("total download size exceeds 5GB limit")
	}

	// Stream zip response
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=\"bytebox-download.zip\"")
	w.WriteHeader(http.StatusOK)

	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	for _, f := range files {
		if f.TrashedAt != nil {
			continue
		}

		url, err := s.store.PresignGetURL(ctx, s.store.BucketFiles(), f.StorageKey, s.store.PresignExpiry())
		if err != nil {
			slog.Error("failed to get presigned URL for batch download", "file_id", f.ID, "error", err)
			continue
		}

		// Fetch file content
		resp, err := http.Get(url)
		if err != nil {
			slog.Error("failed to download file for zip", "file_id", f.ID, "error", err)
			continue
		}

		entry, err := zipWriter.Create(f.Name)
		if err != nil {
			resp.Body.Close()
			slog.Error("failed to create zip entry", "file_id", f.ID, "error", err)
			continue
		}

		if _, err := io.Copy(entry, resp.Body); err != nil {
			slog.Error("failed to write file to zip", "file_id", f.ID, "error", err)
		}
		resp.Body.Close()
	}

	return nil
}

// splitByType separates batch items into file IDs and folder IDs
func splitByType(items []BatchItemRef) (fileIDs, folderIDs []uuid.UUID) {
	for _, item := range items {
		switch item.Type {
		case "file":
			fileIDs = append(fileIDs, item.ID)
		case "folder":
			folderIDs = append(folderIDs, item.ID)
		}
	}
	return
}

