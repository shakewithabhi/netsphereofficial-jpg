package batch

import (
	"github.com/google/uuid"
)

type BatchItemRef struct {
	ID   uuid.UUID `json:"id" validate:"required"`
	Type string    `json:"type" validate:"required,oneof=file folder"`
}

type BatchMoveRequest struct {
	Items    []BatchItemRef `json:"items" validate:"required,min=1,max=100,dive"`
	FolderID *uuid.UUID     `json:"folder_id"` // nil = move to root
}

type BatchTrashRequest struct {
	Items []BatchItemRef `json:"items" validate:"required,min=1,max=100,dive"`
}

type BatchDeleteRequest struct {
	Items []BatchItemRef `json:"items" validate:"required,min=1,max=100,dive"`
}

type BatchDownloadRequest struct {
	Items []BatchItemRef `json:"items" validate:"required,min=1,max=50,dive"`
}

type BatchResultItem struct {
	ID      uuid.UUID `json:"id"`
	Type    string    `json:"type"`
	Success bool      `json:"success"`
	Error   string    `json:"error,omitempty"`
}

type BatchResult struct {
	Succeeded int               `json:"succeeded"`
	Failed    int               `json:"failed"`
	Items     []BatchResultItem `json:"items"`
}
