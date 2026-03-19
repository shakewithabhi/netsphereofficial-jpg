package share

import (
	"context"
	"crypto/rand"
	"encoding/base64"
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
	"github.com/bytebox/backend/internal/storage"
)

type Service struct {
	repo       *Repository
	fileRepo   *file.Repository
	folderRepo *folder.Repository
	store      *storage.Client
	stream     *storage.StreamClient
	baseURL    string // e.g., "https://byteboxapp.com"
}

func NewService(repo *Repository, fileRepo *file.Repository, folderRepo *folder.Repository, store *storage.Client, stream *storage.StreamClient, baseURL string) *Service {
	return &Service{repo: repo, fileRepo: fileRepo, folderRepo: folderRepo, store: store, stream: stream, baseURL: baseURL}
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

func (s *Service) GetPublicInfo(ctx context.Context, code string, viewerID *uuid.UUID) (*PublicShareResponse, error) {
	share, err := s.repo.GetByCode(ctx, code)
	if err != nil {
		slog.Error("GetPublicInfo: GetByCode failed", "code", code, "error", err)
		return nil, common.ErrNotFound("share not found")
	}
	if share == nil {
		slog.Warn("GetPublicInfo: share not found in DB", "code", code)
		return nil, common.ErrNotFound("share not found")
	}

	if err := s.validateShare(share); err != nil {
		return nil, err
	}

	resp := &PublicShareResponse{
		ShareType:     share.ShareType,
		HasPassword:   share.PasswordHash != "",
		DownloadCount: share.DownloadCount,
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
		resp.VideoThumbnailURL = f.VideoThumbnailURL
		if f.IsVideo && f.HLSURL != "" {
			resp.HLSURL = f.HLSURL
		}
		if f.ThumbnailKey != "" {
			if url, err := s.store.PresignGetURL(ctx, s.store.BucketThumbs(), f.ThumbnailKey, 24*time.Hour); err == nil {
				resp.ThumbnailURL = url
			}
		}
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

	// Fetch owner name
	// (user is the owner of the share)
	// We use a best-effort approach via the file repo owner field.

	// Social counts
	likeCount, isLiked, err := s.repo.GetShareLikeInfo(ctx, share.ID, viewerID)
	if err != nil {
		slog.Warn("failed to get like info", "error", err)
	}
	commentCount, err := s.repo.GetShareCommentCount(ctx, share.ID)
	if err != nil {
		slog.Warn("failed to get comment count", "error", err)
	}
	resp.LikeCount = likeCount
	resp.IsLiked = isLiked
	resp.CommentCount = commentCount

	return resp, nil
}

func (s *Service) ToggleLike(ctx context.Context, code string, userID uuid.UUID) (*ToggleLikeResponse, error) {
	share, err := s.repo.GetByCode(ctx, code)
	if err != nil || share == nil {
		return nil, common.ErrNotFound("share not found")
	}
	if err := s.validateShare(share); err != nil {
		return nil, err
	}
	liked, count, err := s.repo.ToggleShareLike(ctx, share.ID, userID)
	if err != nil {
		slog.Error("toggle like", "error", err)
		return nil, common.ErrInternal("failed to toggle like")
	}
	return &ToggleLikeResponse{Liked: liked, LikeCount: count}, nil
}

func (s *Service) AddComment(ctx context.Context, code string, userID uuid.UUID, content string) (*ShareComment, error) {
	if strings.TrimSpace(content) == "" {
		return nil, common.ErrBadRequest("content is required")
	}
	share, err := s.repo.GetByCode(ctx, code)
	if err != nil || share == nil {
		return nil, common.ErrNotFound("share not found")
	}
	if err := s.validateShare(share); err != nil {
		return nil, err
	}
	comment, err := s.repo.AddShareComment(ctx, share.ID, userID, strings.TrimSpace(content))
	if err != nil {
		slog.Error("add share comment", "error", err)
		return nil, common.ErrInternal("failed to add comment")
	}
	return comment, nil
}

func (s *Service) GetComments(ctx context.Context, code string, limit, offset int) ([]ShareComment, error) {
	share, err := s.repo.GetByCode(ctx, code)
	if err != nil || share == nil {
		return nil, common.ErrNotFound("share not found")
	}
	if err := s.validateShare(share); err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	comments, err := s.repo.GetShareComments(ctx, share.ID, limit, offset)
	if err != nil {
		slog.Error("get share comments", "error", err)
		return nil, common.ErrInternal("failed to get comments")
	}
	if comments == nil {
		comments = []ShareComment{}
	}
	return comments, nil
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

func (s *Service) GetExploreItems(ctx context.Context, limit int, cursor *string, category *string) (*ExploreListResponse, error) {
	var cursorTime *time.Time
	var cursorID *string

	if cursor != nil && *cursor != "" {
		// Decode cursor: "RFC3339Nano|shareID"
		decoded, err := base64.URLEncoding.DecodeString(*cursor)
		if err == nil {
			parts := strings.SplitN(string(decoded), "|", 2)
			if len(parts) == 2 {
				t, err := time.Parse(time.RFC3339Nano, parts[0])
				if err == nil {
					cursorTime = &t
					cursorID = &parts[1]
				}
			}
		}
	}

	var mimePrefix *string
	if category != nil && *category != "" {
		p := *category + "/"
		mimePrefix = &p
	}

	slog.Info("GetExploreItems calling repo", "limit", limit+1, "hasCursor", cursorTime != nil, "mimePrefix", mimePrefix)
	rows, err := s.repo.GetExploreItems(ctx, limit+1, cursorTime, cursorID, mimePrefix)
	if err != nil {
		slog.Error("failed to get explore items", "error", err, "detail", fmt.Sprintf("%+v", err))
		return nil, common.ErrInternal(fmt.Sprintf("failed to load explore items: %v", err))
	}
	slog.Info("GetExploreItems success", "row_count", len(rows))

	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}

	items := make([]ExploreItem, 0, len(rows))
	for _, row := range rows {
		thumbnailURL := ""
		if row.IsVideo && row.VideoThumbnailURL != "" {
			thumbnailURL = row.VideoThumbnailURL
		} else if row.IsVideo && row.StreamVideoID != "" && s.stream != nil {
			thumbnailURL = s.stream.GetThumbnailURL(row.StreamVideoID)
		} else if row.ThumbnailKey != "" {
			url, err := s.store.PresignGetURL(ctx, s.store.BucketThumbs(), row.ThumbnailKey, 24*time.Hour)
			if err == nil {
				thumbnailURL = url
			}
		} else if strings.HasPrefix(row.MimeType, "image/") && row.StorageKey != "" {
			url, err := s.store.PresignGetURL(ctx, s.store.BucketFiles(), row.StorageKey, 24*time.Hour)
			if err == nil {
				thumbnailURL = url
			}
		}

		hlsURL := ""
		if row.IsVideo && row.HLSURL != "" {
			hlsURL = row.HLSURL
		}

		items = append(items, ExploreItem{
			ID:            row.ShareID,
			Code:          row.Code,
			FileName:      row.FileName,
			FileSize:      row.FileSize,
			MimeType:      row.MimeType,
			ThumbnailURL:  thumbnailURL,
			OwnerName:     row.OwnerName,
			DownloadCount: row.DownloadCount,
			CreatedAt:     row.CreatedAt,
			LikeCount:     row.LikeCount,
			CommentCount:  row.CommentCount,
			HLSURL:        hlsURL,
		})
	}

	resp := &ExploreListResponse{Items: items}
	if hasMore && len(rows) > 0 {
		last := rows[len(rows)-1]
		raw := last.CreatedAt.UTC().Format(time.RFC3339Nano) + "|" + last.ShareID
		encoded := base64.URLEncoding.EncodeToString([]byte(raw))
		resp.NextCursor = &encoded
	}

	return resp, nil
}

func (s *Service) SearchExploreItems(ctx context.Context, query string, limit int) (*ExploreListResponse, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	rows, err := s.repo.SearchExploreItems(ctx, query, limit)
	if err != nil {
		slog.Error("failed to search explore items", "error", err, "query", query)
		return nil, common.ErrInternal("failed to search explore items")
	}

	items := make([]ExploreItem, 0, len(rows))
	for _, row := range rows {
		thumbnailURL := ""
		if row.IsVideo && row.VideoThumbnailURL != "" {
			thumbnailURL = row.VideoThumbnailURL
		} else if row.ThumbnailKey != "" {
			url, err := s.store.PresignGetURL(ctx, s.store.BucketThumbs(), row.ThumbnailKey, 24*time.Hour)
			if err == nil {
				thumbnailURL = url
			}
		} else if strings.HasPrefix(row.MimeType, "image/") && row.StorageKey != "" {
			url, err := s.store.PresignGetURL(ctx, s.store.BucketFiles(), row.StorageKey, 24*time.Hour)
			if err == nil {
				thumbnailURL = url
			}
		}

		hlsURL := ""
		if row.IsVideo && row.HLSURL != "" {
			hlsURL = row.HLSURL
		}

		items = append(items, ExploreItem{
			ID:            row.ShareID,
			Code:          row.Code,
			FileName:      row.FileName,
			FileSize:      row.FileSize,
			MimeType:      row.MimeType,
			ThumbnailURL:  thumbnailURL,
			OwnerName:     row.OwnerName,
			DownloadCount: row.DownloadCount,
			CreatedAt:     row.CreatedAt,
			LikeCount:     row.LikeCount,
			CommentCount:  row.CommentCount,
			HLSURL:        hlsURL,
		})
	}

	return &ExploreListResponse{Items: items}, nil
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
