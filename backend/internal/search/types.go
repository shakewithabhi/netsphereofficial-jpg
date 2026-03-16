package search

import "time"

type FileDocument struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	FolderID  string    `json:"folder_id,omitempty"`
	Name      string    `json:"name"`
	MimeType  string    `json:"mime_type"`
	Size      int64     `json:"size"`
	Trashed   bool      `json:"trashed"`
	CreatedAt time.Time `json:"created_at"`
}

type SearchFilters struct {
	MimeType string `json:"mime_type,omitempty"`
	FolderID string `json:"folder_id,omitempty"`
	MinSize  int64  `json:"min_size,omitempty"`
	MaxSize  int64  `json:"max_size,omitempty"`
	Sort     string `json:"sort,omitempty"` // "name:asc", "size:desc", "created_at:desc"
}

type SearchResult struct {
	Hits             []FileDocument `json:"hits"`
	TotalHits        int64          `json:"total_hits"`
	ProcessingTimeMs int64          `json:"processing_time_ms"`
	Query            string         `json:"query"`
}
