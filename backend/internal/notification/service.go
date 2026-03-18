package notification

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"

	"github.com/bytebox/backend/internal/auth"
	"github.com/bytebox/backend/internal/common"
)

type Service struct {
	repo   *Repository
	pusher PushSender
}

func NewService(repo *Repository, pusher PushSender) *Service {
	return &Service{repo: repo, pusher: pusher}
}

func (s *Service) Notify(ctx context.Context, userID uuid.UUID, notifType, title, message string, data map[string]interface{}) error {
	if data == nil {
		data = make(map[string]interface{})
	}

	n := &Notification{
		UserID:  userID,
		Type:    notifType,
		Title:   title,
		Message: message,
		Data:    data,
	}

	if err := s.repo.Create(ctx, n); err != nil {
		slog.Error("failed to create notification", "error", err, "user_id", userID, "type", notifType)
		return err
	}

	// Send push notification via FCM if a pusher is configured
	if s.pusher != nil {
		tokens, err := s.repo.GetUserPushTokens(ctx, userID)
		if err != nil {
			slog.Error("failed to get push tokens", "error", err, "user_id", userID)
		} else if len(tokens) > 0 {
			if err := s.pusher.SendPush(ctx, tokens, title, message, data); err != nil {
				slog.Error("failed to send push notification", "error", err, "user_id", userID)
			}
		}
	}

	return nil
}

func (s *Service) NotifyFileShared(ctx context.Context, ownerID uuid.UUID, fileName, sharedByEmail string) {
	title := "File shared with you"
	message := fmt.Sprintf("%s shared \"%s\" with you", sharedByEmail, fileName)
	data := map[string]interface{}{
		"file_name":      fileName,
		"shared_by_email": sharedByEmail,
	}

	if err := s.Notify(ctx, ownerID, "file_shared", title, message, data); err != nil {
		slog.Error("failed to send file shared notification", "error", err)
	}
}

func (s *Service) NotifyNewComment(ctx context.Context, ownerID uuid.UUID, fileName, commenterEmail, commentContent string) {
	title := "New comment on your file"
	message := fmt.Sprintf("%s commented on \"%s\": %s", commenterEmail, fileName, commentContent)
	data := map[string]interface{}{
		"file_name":       fileName,
		"commenter_email": commenterEmail,
		"comment_preview": commentContent,
	}

	if err := s.Notify(ctx, ownerID, "new_comment", title, message, data); err != nil {
		slog.Error("failed to send new comment notification", "error", err)
	}
}

func (s *Service) NotifyStorageWarning(ctx context.Context, userID uuid.UUID, percentUsed int) {
	title := "Storage warning"
	message := fmt.Sprintf("You have used %d%% of your storage quota", percentUsed)
	data := map[string]interface{}{
		"percent_used": percentUsed,
	}

	if err := s.Notify(ctx, userID, "storage_warning", title, message, data); err != nil {
		slog.Error("failed to send storage warning notification", "error", err)
	}
}

func (s *Service) List(ctx context.Context, claims *auth.TokenClaims, limit int) ([]NotificationResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	notifications, err := s.repo.ListByUser(ctx, claims.UserID, limit)
	if err != nil {
		slog.Error("failed to list notifications", "error", err)
		return nil, common.ErrInternal("failed to list notifications")
	}

	result := make([]NotificationResponse, len(notifications))
	for i, n := range notifications {
		result[i] = n.ToResponse()
	}
	return result, nil
}

func (s *Service) CountUnread(ctx context.Context, claims *auth.TokenClaims) (int64, error) {
	count, err := s.repo.CountUnread(ctx, claims.UserID)
	if err != nil {
		slog.Error("failed to count unread notifications", "error", err)
		return 0, common.ErrInternal("failed to count unread notifications")
	}
	return count, nil
}

func (s *Service) MarkAsRead(ctx context.Context, claims *auth.TokenClaims, id uuid.UUID) error {
	if err := s.repo.MarkAsRead(ctx, id, claims.UserID); err != nil {
		slog.Error("failed to mark notification as read", "error", err)
		return common.ErrNotFound("notification not found")
	}
	return nil
}

func (s *Service) MarkAllAsRead(ctx context.Context, claims *auth.TokenClaims) error {
	if err := s.repo.MarkAllAsRead(ctx, claims.UserID); err != nil {
		slog.Error("failed to mark all notifications as read", "error", err)
		return common.ErrInternal("failed to mark all notifications as read")
	}
	return nil
}

func (s *Service) RegisterToken(ctx context.Context, claims *auth.TokenClaims, req RegisterTokenRequest) error {
	if err := s.repo.SavePushToken(ctx, claims.UserID, req.Token, req.Platform); err != nil {
		slog.Error("failed to register push token", "error", err)
		return common.ErrInternal("failed to register push token")
	}
	return nil
}
