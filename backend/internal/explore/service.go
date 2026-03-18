package explore

import (
	"context"
	"fmt"
	"html"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/bytebox/backend/internal/storage"
)

type Service struct {
	repo    *Repository
	storage *storage.Client
}

func NewService(repo *Repository, store *storage.Client) *Service {
	return &Service{repo: repo, storage: store}
}

// CreatePost creates a new post after validating that the file is a video owned by the user.
func (s *Service) CreatePost(ctx context.Context, userID uuid.UUID, req CreatePostRequest) (*Post, error) {
	// Verify file ownership
	ownerID, err := s.repo.GetFileOwner(ctx, req.FileID)
	if err != nil {
		return nil, fmt.Errorf("file not found")
	}
	if ownerID != userID {
		return nil, fmt.Errorf("you do not own this file")
	}

	// Verify file is a video
	mimeType, err := s.repo.GetFileMimeType(ctx, req.FileID)
	if err != nil {
		return nil, fmt.Errorf("file not found")
	}
	if !strings.HasPrefix(mimeType, "video/") {
		return nil, fmt.Errorf("only video files can be posted")
	}

	// Sanitize inputs
	caption := html.EscapeString(strings.TrimSpace(req.Caption))
	category := strings.ToLower(strings.TrimSpace(req.Category))
	if category == "" || !ValidCategories[category] {
		category = "other"
	}

	sanitizedTags := make([]string, 0, len(req.Tags))
	for _, tag := range req.Tags {
		t := strings.ToLower(strings.TrimSpace(tag))
		if t != "" {
			sanitizedTags = append(sanitizedTags, html.EscapeString(t))
		}
	}

	post := &Post{
		UserID:   userID,
		FileID:   req.FileID,
		Caption:  caption,
		Category: category,
		Tags:     sanitizedTags,
	}

	if err := s.repo.Create(ctx, post); err != nil {
		return nil, err
	}

	return s.repo.GetByID(ctx, post.ID, userID)
}

// GetPost returns a single post with viewer context.
func (s *Service) GetPost(ctx context.Context, postID, viewerID uuid.UUID) (*PostResponse, error) {
	post, err := s.repo.GetByID(ctx, postID, viewerID)
	if err != nil {
		return nil, err
	}
	if post == nil {
		return nil, nil
	}

	return s.toResponse(ctx, post)
}

// DeletePost deletes a post owned by the user.
func (s *Service) DeletePost(ctx context.Context, postID, userID uuid.UUID) error {
	return s.repo.Delete(ctx, postID, userID)
}

// GetFeed returns a paginated feed.
func (s *Service) GetFeed(ctx context.Context, params FeedParams, viewerID uuid.UUID) ([]PostResponse, bool, error) {
	posts, hasMore, err := s.repo.GetFeed(ctx, params, viewerID)
	if err != nil {
		return nil, false, err
	}
	return s.toResponses(ctx, posts), hasMore, nil
}

// GetTrendingFeed returns trending posts.
func (s *Service) GetTrendingFeed(ctx context.Context, limit int, viewerID uuid.UUID) ([]PostResponse, error) {
	posts, err := s.repo.GetTrendingFeed(ctx, limit, viewerID)
	if err != nil {
		return nil, err
	}
	return s.toResponses(ctx, posts), nil
}

// GetForYouFeed returns a personalized feed.
func (s *Service) GetForYouFeed(ctx context.Context, userID uuid.UUID, limit int) ([]PostResponse, error) {
	posts, err := s.repo.GetForYouFeed(ctx, userID, limit)
	if err != nil {
		return nil, err
	}
	return s.toResponses(ctx, posts), nil
}

// GetSubscriptionFeed returns posts from subscribed creators.
func (s *Service) GetSubscriptionFeed(ctx context.Context, userID uuid.UUID, limit int, cursor string) ([]PostResponse, bool, error) {
	posts, hasMore, err := s.repo.GetSubscriptionFeed(ctx, userID, limit, cursor)
	if err != nil {
		return nil, false, err
	}
	return s.toResponses(ctx, posts), hasMore, nil
}

// GetCategoryFeed returns posts for a category.
func (s *Service) GetCategoryFeed(ctx context.Context, category string, limit int, cursor string, viewerID uuid.UUID) ([]PostResponse, bool, error) {
	posts, hasMore, err := s.repo.GetCategoryFeed(ctx, category, limit, cursor, viewerID)
	if err != nil {
		return nil, false, err
	}
	return s.toResponses(ctx, posts), hasMore, nil
}

// GetRelatedPosts returns related posts.
func (s *Service) GetRelatedPosts(ctx context.Context, postID uuid.UUID, limit int, viewerID uuid.UUID) ([]PostResponse, error) {
	posts, err := s.repo.GetRelatedPosts(ctx, postID, limit, viewerID)
	if err != nil {
		return nil, err
	}
	return s.toResponses(ctx, posts), nil
}

// SearchPosts searches posts by query.
func (s *Service) SearchPosts(ctx context.Context, query string, limit int, viewerID uuid.UUID) ([]PostResponse, error) {
	posts, err := s.repo.SearchPosts(ctx, query, limit, viewerID)
	if err != nil {
		return nil, err
	}
	return s.toResponses(ctx, posts), nil
}

// LikePost likes a post.
func (s *Service) LikePost(ctx context.Context, postID, userID uuid.UUID) error {
	return s.repo.LikePost(ctx, postID, userID)
}

// UnlikePost removes a like.
func (s *Service) UnlikePost(ctx context.Context, postID, userID uuid.UUID) error {
	return s.repo.UnlikePost(ctx, postID, userID)
}

// RecordView records a view, throttling to one view per user per post per 5 minutes.
func (s *Service) RecordView(ctx context.Context, postID, userID uuid.UUID, durationSec int) error {
	if userID != uuid.Nil {
		lastViewed, err := s.repo.LastViewedAt(ctx, postID, userID)
		if err != nil {
			return err
		}
		if lastViewed != nil && time.Since(*lastViewed) < 5*time.Minute {
			// Don't count repeat views within 5 minutes, but still ok
			return nil
		}
	}
	return s.repo.RecordView(ctx, postID, userID, durationSec)
}

// AddComment adds a comment to a post.
func (s *Service) AddComment(ctx context.Context, postID, userID uuid.UUID, req CreateCommentRequest) (*PostComment, error) {
	content := html.EscapeString(strings.TrimSpace(req.Content))
	if content == "" {
		return nil, fmt.Errorf("comment content is required")
	}

	comment := &PostComment{
		PostID:  postID,
		UserID:  userID,
		Content: content,
	}

	if err := s.repo.AddComment(ctx, comment); err != nil {
		return nil, err
	}

	return comment, nil
}

// ListComments lists comments for a post.
func (s *Service) ListComments(ctx context.Context, postID uuid.UUID, limit int) ([]PostCommentResponse, error) {
	comments, err := s.repo.ListComments(ctx, postID, limit)
	if err != nil {
		return nil, err
	}

	var responses []PostCommentResponse
	for _, c := range comments {
		responses = append(responses, PostCommentResponse{
			ID:               c.ID,
			PostID:           c.PostID,
			UserID:           c.UserID,
			Content:          c.Content,
			LikeCount:        c.LikeCount,
			UserName:         c.UserName,
			UserAvatarInitial: c.UserAvatarInitial,
			CreatedAt:        c.CreatedAt,
		})
	}

	return responses, nil
}

// DeleteComment deletes a comment owned by the user.
func (s *Service) DeleteComment(ctx context.Context, commentID, userID uuid.UUID) error {
	return s.repo.DeleteComment(ctx, commentID, userID)
}

// Subscribe subscribes to a creator.
func (s *Service) Subscribe(ctx context.Context, subscriberID, creatorID uuid.UUID) error {
	return s.repo.Subscribe(ctx, subscriberID, creatorID)
}

// Unsubscribe unsubscribes from a creator.
func (s *Service) Unsubscribe(ctx context.Context, subscriberID, creatorID uuid.UUID) error {
	return s.repo.Unsubscribe(ctx, subscriberID, creatorID)
}

// GetCreatorProfile returns a creator's profile.
func (s *Service) GetCreatorProfile(ctx context.Context, creatorID, viewerID uuid.UUID) (*CreatorProfile, error) {
	return s.repo.GetCreatorProfile(ctx, creatorID, viewerID)
}

// GetCreatorPosts returns a creator's posts.
func (s *Service) GetCreatorPosts(ctx context.Context, creatorID uuid.UUID, limit int, viewerID uuid.UUID) ([]PostResponse, error) {
	posts, err := s.repo.GetUserPosts(ctx, creatorID, limit, viewerID)
	if err != nil {
		return nil, err
	}
	return s.toResponses(ctx, posts), nil
}

// GetWatchHistory returns the user's watch history.
func (s *Service) GetWatchHistory(ctx context.Context, userID uuid.UUID, limit int) ([]PostResponse, error) {
	posts, err := s.repo.GetWatchHistory(ctx, userID, limit)
	if err != nil {
		return nil, err
	}
	return s.toResponses(ctx, posts), nil
}

// ReportPost reports a post.
func (s *Service) ReportPost(ctx context.Context, postID, userID uuid.UUID, req ReportRequest) error {
	details := html.EscapeString(strings.TrimSpace(req.Details))
	return s.repo.ReportPost(ctx, postID, userID, req.Reason, details)
}

// GetTrendingTags returns trending tags.
func (s *Service) GetTrendingTags(ctx context.Context, limit int) ([]TagCount, error) {
	return s.repo.GetTrendingTags(ctx, limit)
}

// toResponse converts a Post to PostResponse with a presigned video URL.
func (s *Service) toResponse(ctx context.Context, p *Post) (*PostResponse, error) {
	videoURL := ""
	if p.FileStorageKey != "" {
		url, err := s.storage.PresignGetURL(ctx, s.storage.BucketFiles(), p.FileStorageKey, s.storage.PresignExpiry())
		if err == nil {
			videoURL = url
		}
	}

	return &PostResponse{
		ID:               p.ID,
		UserID:           p.UserID,
		Caption:          p.Caption,
		Category:         p.Category,
		Tags:             p.Tags,
		ViewCount:        p.ViewCount,
		LikeCount:        p.LikeCount,
		CommentCount:     p.CommentCount,
		DurationSeconds:  p.DurationSeconds,
		VideoURL:         videoURL,
		UserName:         p.UserName,
		UserAvatarInitial: p.UserAvatarInitial,
		FileName:         p.FileName,
		FileMimeType:     p.FileMimeType,
		FileSize:         p.FileSize,
		IsLiked:          p.IsLiked,
		IsSubscribed:     p.IsSubscribed,
		SubscriberCount:  p.SubscriberCount,
		CreatedAt:        p.CreatedAt,
	}, nil
}

// toResponses converts a slice of Posts to PostResponses.
func (s *Service) toResponses(ctx context.Context, posts []Post) []PostResponse {
	responses := make([]PostResponse, 0, len(posts))
	for i := range posts {
		resp, err := s.toResponse(ctx, &posts[i])
		if err != nil {
			continue
		}
		responses = append(responses, *resp)
	}
	return responses
}
