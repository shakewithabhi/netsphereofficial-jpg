package notification

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, n *Notification) error {
	dataJSON, err := json.Marshal(n.Data)
	if err != nil {
		dataJSON = []byte("{}")
	}

	query := `
		INSERT INTO notifications (user_id, type, title, message, data)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at`

	err = r.db.QueryRow(ctx, query, n.UserID, n.Type, n.Title, n.Message, dataJSON).Scan(
		&n.ID, &n.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("create notification: %w", err)
	}
	return nil
}

func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID, limit int) ([]Notification, error) {
	query := `
		SELECT id, user_id, type, title, message, data, read_at, created_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2`

	rows, err := r.db.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()

	var notifications []Notification
	for rows.Next() {
		var n Notification
		var dataJSON []byte
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &dataJSON, &n.ReadAt, &n.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}
		if dataJSON != nil {
			json.Unmarshal(dataJSON, &n.Data)
		}
		if n.Data == nil {
			n.Data = make(map[string]interface{})
		}
		notifications = append(notifications, n)
	}
	return notifications, nil
}

func (r *Repository) CountUnread(ctx context.Context, userID uuid.UUID) (int64, error) {
	query := `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`
	var count int64
	err := r.db.QueryRow(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count unread: %w", err)
	}
	return count, nil
}

func (r *Repository) MarkAsRead(ctx context.Context, id, userID uuid.UUID) error {
	query := `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL`
	result, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("mark as read: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("notification not found")
	}
	return nil
}

func (r *Repository) MarkAllAsRead(ctx context.Context, userID uuid.UUID) error {
	query := `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`
	_, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("mark all as read: %w", err)
	}
	return nil
}

func (r *Repository) SavePushToken(ctx context.Context, userID uuid.UUID, token, platform string) error {
	query := `INSERT INTO push_tokens (user_id, token, platform) VALUES ($1, $2, $3) ON CONFLICT (token) DO NOTHING`
	_, err := r.db.Exec(ctx, query, userID, token, platform)
	if err != nil {
		return fmt.Errorf("save push token: %w", err)
	}
	return nil
}

func (r *Repository) DeletePushToken(ctx context.Context, token string) error {
	query := `DELETE FROM push_tokens WHERE token = $1`
	_, err := r.db.Exec(ctx, query, token)
	if err != nil {
		return fmt.Errorf("delete push token: %w", err)
	}
	return nil
}

func (r *Repository) GetUserPushTokens(ctx context.Context, userID uuid.UUID) ([]string, error) {
	query := `SELECT token FROM push_tokens WHERE user_id = $1`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get user push tokens: %w", err)
	}
	defer rows.Close()

	var tokens []string
	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err != nil {
			return nil, fmt.Errorf("scan push token: %w", err)
		}
		tokens = append(tokens, token)
	}
	return tokens, nil
}
