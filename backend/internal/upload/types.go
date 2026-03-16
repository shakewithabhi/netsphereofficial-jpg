package upload

import (
	"time"

	"github.com/google/uuid"
)

// Request types

type InitUploadRequest struct {
	Filename string     `json:"filename" validate:"required,min=1,max=255"`
	FileSize int64      `json:"file_size" validate:"required,gt=0"`
	MimeType string     `json:"mime_type" validate:"required"`
	FolderID *uuid.UUID `json:"folder_id"`
}

type CompletePartRequest struct {
	PartNumber int32  `json:"part_number" validate:"required,gte=1"`
	ETag       string `json:"etag" validate:"required"`
	Size       int64  `json:"size" validate:"required,gt=0"`
}

// Domain models

type Session struct {
	ID              uuid.UUID
	UserID          uuid.UUID
	FolderID        *uuid.UUID
	Filename        string
	FileSize        int64
	MimeType        string
	ChunkSize       int64
	TotalChunks     int32
	CompletedChunks int32
	StorageKey      string
	StorageUploadID      string
	IsVideo         bool
	Status          string // active, finalizing, completed, cancelled, expired
	ExpiresAt       time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type Part struct {
	ID         uuid.UUID
	SessionID  uuid.UUID
	PartNumber int32
	ETag       string
	Size       int64
	UploadedAt time.Time
}

// Response types

type InitUploadResponse struct {
	UploadID    uuid.UUID         `json:"upload_id"`
	ChunkSize   int64             `json:"chunk_size"`
	TotalChunks int32             `json:"total_chunks"`
	ExpiresAt   time.Time         `json:"expires_at"`
	Parts       []PartPresignInfo `json:"parts"`
}

type PartPresignInfo struct {
	PartNumber int32  `json:"part_number"`
	URL        string `json:"url"`
}

type UploadStatusResponse struct {
	UploadID        uuid.UUID `json:"upload_id"`
	Status          string    `json:"status"`
	TotalChunks     int32     `json:"total_chunks"`
	CompletedChunks int32     `json:"completed_chunks"`
	CompletedParts  []int32   `json:"completed_parts"`
	ExpiresAt       time.Time `json:"expires_at"`
}

type RefreshURLsResponse struct {
	Parts []PartPresignInfo `json:"parts"`
}
