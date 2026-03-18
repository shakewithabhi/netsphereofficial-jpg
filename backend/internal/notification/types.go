package notification

import (
	"time"

	"github.com/google/uuid"
)

type Notification struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	Type      string
	Title     string
	Message   string
	Data      map[string]interface{}
	ReadAt    *time.Time
	CreatedAt time.Time
}

type NotificationResponse struct {
	ID        uuid.UUID              `json:"id"`
	Type      string                 `json:"type"`
	Title     string                 `json:"title"`
	Message   string                 `json:"message"`
	Data      map[string]interface{} `json:"data,omitempty"`
	IsRead    bool                   `json:"is_read"`
	CreatedAt time.Time              `json:"created_at"`
}

type RegisterTokenRequest struct {
	Token    string `json:"token" validate:"required"`
	Platform string `json:"platform" validate:"required,oneof=android ios web"`
}

type DeleteTokenRequest struct {
	Token string `json:"token" validate:"required"`
}

func (n *Notification) ToResponse() NotificationResponse {
	return NotificationResponse{
		ID:        n.ID,
		Type:      n.Type,
		Title:     n.Title,
		Message:   n.Message,
		Data:      n.Data,
		IsRead:    n.ReadAt != nil,
		CreatedAt: n.CreatedAt,
	}
}
