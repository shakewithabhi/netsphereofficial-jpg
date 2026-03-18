package share

import (
	"time"

	"github.com/google/uuid"

	"github.com/bytebox/backend/internal/file"
)

// Request types

type CreateShareRequest struct {
	FileID       *uuid.UUID `json:"file_id,omitempty"`
	FolderID     *uuid.UUID `json:"folder_id,omitempty"`
	Password     string     `json:"password"`                // optional
	ExpiresAt    *time.Time `json:"expires_at"`              // optional
	MaxDownloads *int       `json:"max_downloads,omitempty"` // optional
}

type UpdateShareRequest struct {
	Password     *string    `json:"password"`                // nil = no change, "" = remove
	ExpiresAt    *time.Time `json:"expires_at"`              // nil = no change
	MaxDownloads *int       `json:"max_downloads,omitempty"` // nil = no change
	IsActive     *bool      `json:"is_active"`
}

type DownloadShareRequest struct {
	Password string `json:"password"`
	FileID   string `json:"file_id"` // optional: specific file in a shared folder
}

// Domain model

type Share struct {
	ID            uuid.UUID
	FileID        *uuid.UUID
	FolderID      *uuid.UUID
	UserID        uuid.UUID
	Code          string
	ShareType     string // "file" or "folder"
	PasswordHash  string
	ExpiresAt     *time.Time
	MaxDownloads  *int
	DownloadCount int
	IsActive      bool
	CreatedAt     time.Time
}

// Response types

type ShareResponse struct {
	ID            uuid.UUID  `json:"id"`
	FileID        *uuid.UUID `json:"file_id,omitempty"`
	FolderID      *uuid.UUID `json:"folder_id,omitempty"`
	ShareType     string     `json:"share_type"`
	Code          string     `json:"code"`
	URL           string     `json:"url"`
	HasPassword   bool       `json:"has_password"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	MaxDownloads  *int       `json:"max_downloads,omitempty"`
	DownloadCount int        `json:"download_count"`
	IsActive      bool       `json:"is_active"`
	FileName      string     `json:"file_name,omitempty"`
	FileSize      int64      `json:"file_size,omitempty"`
	MimeType      string     `json:"mime_type,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

type SaveToStorageRequest struct {
	FolderID *uuid.UUID `json:"folder_id"` // nil = save to root
}

type PublicShareResponse struct {
	ShareType         string `json:"share_type"`
	FileName          string `json:"file_name,omitempty"`
	FileSize          int64  `json:"file_size,omitempty"`
	MimeType          string `json:"mime_type,omitempty"`
	FolderName        string `json:"folder_name,omitempty"`
	ItemCount         int    `json:"item_count,omitempty"`
	HasPassword       bool   `json:"has_password"`
	IsVideo           bool   `json:"is_video,omitempty"`
	IsImage           bool   `json:"is_image,omitempty"`
	PreviewAvailable  bool   `json:"preview_available"`
	ThumbnailURL      string `json:"thumbnail_url,omitempty"`
	VideoThumbnailURL string `json:"video_thumbnail_url,omitempty"`
}

type PreviewResponse struct {
	URL               string `json:"url,omitempty"`
	PreviewDuration   int    `json:"preview_duration_seconds"`
	FileName          string `json:"file_name"`
	FileSize          int64  `json:"file_size"`
	MimeType          string `json:"mime_type"`
	IsVideo           bool   `json:"is_video"`
	IsImage           bool   `json:"is_image"`
	RequiresLogin     bool   `json:"requires_login"`
	ThumbnailURL      string `json:"thumbnail_url,omitempty"`
	HLSURL            string `json:"hls_url,omitempty"`
	VideoThumbnailURL string `json:"video_thumbnail_url,omitempty"`
}

type ShareDownloadResponse struct {
	URL               string `json:"url"`
	ExpiresIn         int64  `json:"expires_in"`
	IsVideo           bool   `json:"is_video"`
	HLSURL            string `json:"hls_url,omitempty"`
	VideoThumbnailURL string `json:"video_thumbnail_url,omitempty"`
}

type PublicFolderContentsResponse struct {
	FolderName string              `json:"folder_name"`
	Files      []file.FileResponse `json:"files"`
}
