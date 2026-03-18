package file

import (
	"time"

	"github.com/google/uuid"
)

// Request types

type RenameFileRequest struct {
	Name string `json:"name" validate:"required,min=1,max=255"`
}

type MoveFileRequest struct {
	FolderID *uuid.UUID `json:"folder_id"` // nil = move to root
}

type CopyFileRequest struct {
	FolderID *uuid.UUID `json:"folder_id"` // nil = copy to root
}

// Domain model

type File struct {
	ID                uuid.UUID
	UserID            uuid.UUID
	FolderID          *uuid.UUID
	Name              string
	StorageKey        string
	ThumbnailKey      string
	Size              int64
	MimeType          string
	ContentHash       string
	ScanStatus        string
	CurrentVersion    int
	IsVideo           bool
	StreamVideoID      string
	StreamStatus      string // "", "processing", "ready", "failed"
	HLSURL            string
	VideoThumbnailURL string
	VideoDurationSec  int
	TrashedAt         *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type FileVersion struct {
	ID            uuid.UUID
	FileID        uuid.UUID
	VersionNumber int
	StorageKey    string
	Size          int64
	ContentHash   string
	CreatedBy     uuid.UUID
	CreatedAt     time.Time
}

// Response types

type FileResponse struct {
	ID                uuid.UUID  `json:"id"`
	FolderID          *uuid.UUID `json:"folder_id"`
	Name              string     `json:"name"`
	Size              int64      `json:"size"`
	MimeType          string     `json:"mime_type"`
	ThumbnailKey      string     `json:"thumbnail_key,omitempty"`
	ScanStatus        string     `json:"scan_status"`
	CurrentVersion    int        `json:"current_version"`
	IsVideo           bool       `json:"is_video"`
	StreamStatus      string     `json:"stream_status,omitempty"`
	HLSURL            string     `json:"hls_url,omitempty"`
	VideoThumbnailURL string     `json:"video_thumbnail_url,omitempty"`
	IsStarred         bool       `json:"is_starred"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type FileVersionResponse struct {
	ID            uuid.UUID `json:"id"`
	FileID        uuid.UUID `json:"file_id"`
	VersionNumber int       `json:"version_number"`
	Size          int64     `json:"size"`
	ContentHash   string    `json:"content_hash"`
	CreatedBy     uuid.UUID `json:"created_by"`
	CreatedAt     time.Time `json:"created_at"`
}

func (f *File) ToResponse() FileResponse {
	return FileResponse{
		ID:                f.ID,
		FolderID:          f.FolderID,
		Name:              f.Name,
		Size:              f.Size,
		MimeType:          f.MimeType,
		ThumbnailKey:      f.ThumbnailKey,
		ScanStatus:        f.ScanStatus,
		CurrentVersion:    f.CurrentVersion,
		IsVideo:           f.IsVideo,
		StreamStatus:      f.StreamStatus,
		HLSURL:            f.HLSURL,
		VideoThumbnailURL: f.VideoThumbnailURL,
		CreatedAt:         f.CreatedAt,
		UpdatedAt:         f.UpdatedAt,
	}
}

func (v *FileVersion) ToResponse() FileVersionResponse {
	return FileVersionResponse{
		ID:            v.ID,
		FileID:        v.FileID,
		VersionNumber: v.VersionNumber,
		Size:          v.Size,
		ContentHash:   v.ContentHash,
		CreatedBy:     v.CreatedBy,
		CreatedAt:     v.CreatedAt,
	}
}

// Category types for quick access by file type

type FileCategoryCount struct {
	Category  string `json:"category"`
	Count     int64  `json:"count"`
	TotalSize int64  `json:"total_size"`
}

type FileCategorySummary struct {
	Categories []FileCategoryCount `json:"categories"`
	TotalFiles int64               `json:"total_files"`
	TotalSize  int64               `json:"total_size"`
}

// CategoryMimePatterns maps category names to MIME type SQL LIKE patterns
var CategoryMimePatterns = map[string][]string{
	"images":    {"image/%"},
	"videos":    {"video/%"},
	"audio":     {"audio/%"},
	"documents": {"application/pdf", "application/msword", "application/vnd.openxmlformats-%", "text/%"},
}

type DownloadResponse struct {
	URL               string `json:"url"`
	ExpiresIn         int64  `json:"expires_in"` // seconds
	IsVideo           bool   `json:"is_video"`
	HLSURL            string `json:"hls_url,omitempty"`
	VideoThumbnailURL string `json:"video_thumbnail_url,omitempty"`
}

// Combined listing response for folder contents
type FolderContentsItem struct {
	Type   string      `json:"type"` // "folder" or "file"
	Folder *FolderItem `json:"folder,omitempty"`
	File   *FileResponse `json:"file,omitempty"`
}

type FolderItem struct {
	ID        uuid.UUID  `json:"id"`
	ParentID  *uuid.UUID `json:"parent_id"`
	Name      string     `json:"name"`
	Path      string     `json:"path"`
	CreatedAt time.Time  `json:"created_at"`
}

// Comment types

type Comment struct {
	ID        uuid.UUID
	FileID    uuid.UUID
	UserID    uuid.UUID
	UserName  string
	Content   string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type CommentResponse struct {
	ID        uuid.UUID `json:"id"`
	FileID    uuid.UUID `json:"file_id"`
	UserID    uuid.UUID `json:"user_id"`
	UserName  string    `json:"user_name"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateCommentRequest struct {
	Content string `json:"content" validate:"required,min=1,max=2000"`
}

type UpdateCommentRequest struct {
	Content string `json:"content" validate:"required,min=1,max=2000"`
}

func (c *Comment) ToResponse() CommentResponse {
	return CommentResponse{
		ID:        c.ID,
		FileID:    c.FileID,
		UserID:    c.UserID,
		UserName:  c.UserName,
		Content:   c.Content,
		CreatedAt: c.CreatedAt,
		UpdatedAt: c.UpdatedAt,
	}
}
