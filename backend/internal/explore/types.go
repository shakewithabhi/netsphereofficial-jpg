package explore

import (
	"time"

	"github.com/google/uuid"
)

// Valid categories for posts
var ValidCategories = map[string]bool{
	"trending":      true,
	"music":         true,
	"gaming":        true,
	"education":     true,
	"nature":        true,
	"tech":          true,
	"entertainment": true,
	"sports":        true,
	"other":         true,
}

// Post is the domain model with joined fields.
type Post struct {
	ID               uuid.UUID `json:"id"`
	UserID           uuid.UUID `json:"user_id"`
	FileID           uuid.UUID `json:"file_id"`
	Caption          string    `json:"caption"`
	Category         string    `json:"category"`
	Tags             []string  `json:"tags"`
	ViewCount        int64     `json:"view_count"`
	LikeCount        int64     `json:"like_count"`
	CommentCount     int64     `json:"comment_count"`
	DurationSeconds  int       `json:"duration_seconds"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`

	// Joined fields
	UserName         string `json:"user_name"`
	UserAvatarInitial string `json:"user_avatar_initial"`
	FileName         string `json:"file_name"`
	FileMimeType     string `json:"file_mime_type"`
	FileSize         int64  `json:"file_size"`
	FileStorageKey   string `json:"-"`

	// Viewer-specific fields
	IsLiked          bool  `json:"is_liked"`
	IsSubscribed     bool  `json:"is_subscribed"`
	SubscriberCount  int64 `json:"subscriber_count"`
}

// PostResponse is the JSON response for a post.
type PostResponse struct {
	ID               uuid.UUID `json:"id"`
	UserID           uuid.UUID `json:"user_id"`
	Caption          string    `json:"caption"`
	Category         string    `json:"category"`
	Tags             []string  `json:"tags"`
	ViewCount        int64     `json:"view_count"`
	LikeCount        int64     `json:"like_count"`
	CommentCount     int64     `json:"comment_count"`
	DurationSeconds  int       `json:"duration_seconds"`
	VideoURL         string    `json:"video_url"`
	UserName         string    `json:"user_name"`
	UserAvatarInitial string  `json:"user_avatar_initial"`
	FileName         string    `json:"file_name"`
	FileMimeType     string    `json:"file_mime_type"`
	FileSize         int64     `json:"file_size"`
	IsLiked          bool      `json:"is_liked"`
	IsSubscribed     bool      `json:"is_subscribed"`
	SubscriberCount  int64     `json:"subscriber_count"`
	CreatedAt        time.Time `json:"created_at"`
}

// CreatePostRequest is the request body for creating a post.
type CreatePostRequest struct {
	FileID   uuid.UUID `json:"file_id" validate:"required"`
	Caption  string    `json:"caption" validate:"max=2000"`
	Category string    `json:"category" validate:"omitempty,max=30"`
	Tags     []string  `json:"tags" validate:"omitempty,max=10,dive,max=30"`
}

// PostComment is the domain model for a post comment.
type PostComment struct {
	ID        uuid.UUID `json:"id"`
	PostID    uuid.UUID `json:"post_id"`
	UserID    uuid.UUID `json:"user_id"`
	Content   string    `json:"content"`
	LikeCount int64     `json:"like_count"`
	CreatedAt time.Time `json:"created_at"`

	// Joined
	UserName         string `json:"user_name"`
	UserAvatarInitial string `json:"user_avatar_initial"`
}

// PostCommentResponse is the JSON response for a comment.
type PostCommentResponse struct {
	ID               uuid.UUID `json:"id"`
	PostID           uuid.UUID `json:"post_id"`
	UserID           uuid.UUID `json:"user_id"`
	Content          string    `json:"content"`
	LikeCount        int64     `json:"like_count"`
	UserName         string    `json:"user_name"`
	UserAvatarInitial string  `json:"user_avatar_initial"`
	CreatedAt        time.Time `json:"created_at"`
}

// CreateCommentRequest is the request body for adding a comment.
type CreateCommentRequest struct {
	Content string `json:"content" validate:"required,min=1,max=2000"`
}

// WatchHistoryEntry represents one watch history row.
type WatchHistoryEntry struct {
	ID                   uuid.UUID `json:"id"`
	UserID               uuid.UUID `json:"user_id"`
	PostID               uuid.UUID `json:"post_id"`
	WatchDurationSeconds int       `json:"watch_duration_seconds"`
	Completed            bool      `json:"completed"`
	CreatedAt            time.Time `json:"created_at"`
}

// CreatorProfile is the public profile for a content creator.
type CreatorProfile struct {
	UserID          uuid.UUID `json:"user_id"`
	Name            string    `json:"name"`
	AvatarInitial   string    `json:"avatar_initial"`
	PostCount       int64     `json:"post_count"`
	SubscriberCount int64     `json:"subscriber_count"`
	IsSubscribed    bool      `json:"is_subscribed"`
}

// ReportRequest is the request body for reporting a post.
type ReportRequest struct {
	Reason  string `json:"reason" validate:"required,oneof=spam harassment hate_speech nudity violence copyright misinformation other"`
	Details string `json:"details" validate:"max=1000"`
}

// RecordViewRequest is the request body for recording a view.
type RecordViewRequest struct {
	DurationSeconds int `json:"duration_seconds" validate:"min=0"`
}

// FeedParams holds pagination and filter parameters for feed queries.
type FeedParams struct {
	Limit    int
	Cursor   string
	Sort     string
	Category string
	Tag      string
}

// TagCount holds a tag and its usage count.
type TagCount struct {
	Tag   string `json:"tag"`
	Count int64  `json:"count"`
}
