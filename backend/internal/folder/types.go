package folder

import (
	"time"

	"github.com/google/uuid"
)

// Request types

type CreateFolderRequest struct {
	Name     string     `json:"name" validate:"required,min=1,max=255"`
	ParentID *uuid.UUID `json:"parent_id"`
}

type RenameFolderRequest struct {
	Name string `json:"name" validate:"required,min=1,max=255"`
}

type MoveFolderRequest struct {
	ParentID *uuid.UUID `json:"parent_id"` // nil = move to root
}

// Domain model

type Folder struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	ParentID  *uuid.UUID
	Name      string
	Path      string
	TrashedAt *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Response types

type FolderResponse struct {
	ID        uuid.UUID  `json:"id"`
	ParentID  *uuid.UUID `json:"parent_id"`
	Name      string     `json:"name"`
	Path      string     `json:"path"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

func (f *Folder) ToResponse() FolderResponse {
	return FolderResponse{
		ID:        f.ID,
		ParentID:  f.ParentID,
		Name:      f.Name,
		Path:      f.Path,
		CreatedAt: f.CreatedAt,
		UpdatedAt: f.UpdatedAt,
	}
}

// Contents response combines folders and files in a single listing
type FolderContentsResponse struct {
	Folder  FolderResponse   `json:"folder"`
	Folders []FolderResponse `json:"folders"`
	// Files will be added when file module is built
}
