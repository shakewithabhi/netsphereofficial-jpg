package upload

import (
	"context"
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

func (r *Repository) CreateSession(ctx context.Context, s *Session) error {
	query := `
		INSERT INTO upload_sessions (user_id, folder_id, filename, file_size, mime_type, chunk_size, total_chunks, storage_key, storage_upload_id, is_video, status, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, completed_chunks, created_at, updated_at`

	err := r.db.QueryRow(ctx, query,
		s.UserID, s.FolderID, s.Filename, s.FileSize, s.MimeType,
		s.ChunkSize, s.TotalChunks, s.StorageKey, s.StorageUploadID, s.IsVideo, s.Status, s.ExpiresAt,
	).Scan(&s.ID, &s.CompletedChunks, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create upload session: %w", err)
	}
	return nil
}

func (r *Repository) GetSession(ctx context.Context, id, userID uuid.UUID) (*Session, error) {
	query := `
		SELECT id, user_id, folder_id, filename, file_size, mime_type, chunk_size,
		       total_chunks, completed_chunks, storage_key, storage_upload_id, is_video, status, expires_at, created_at, updated_at
		FROM upload_sessions
		WHERE id = $1 AND user_id = $2`

	s := &Session{}
	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&s.ID, &s.UserID, &s.FolderID, &s.Filename, &s.FileSize, &s.MimeType,
		&s.ChunkSize, &s.TotalChunks, &s.CompletedChunks, &s.StorageKey, &s.StorageUploadID,
		&s.IsVideo, &s.Status, &s.ExpiresAt, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get upload session: %w", err)
	}
	return s, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	query := `UPDATE upload_sessions SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("update session status: %w", err)
	}
	return nil
}

func (r *Repository) AddPart(ctx context.Context, p *Part) error {
	query := `
		INSERT INTO upload_parts (session_id, part_number, etag, size)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (session_id, part_number) DO UPDATE SET etag = $3, size = $4
		RETURNING id, uploaded_at`

	err := r.db.QueryRow(ctx, query, p.SessionID, p.PartNumber, p.ETag, p.Size).
		Scan(&p.ID, &p.UploadedAt)
	if err != nil {
		return fmt.Errorf("add upload part: %w", err)
	}

	// Increment completed_chunks
	updateQuery := `
		UPDATE upload_sessions
		SET completed_chunks = (SELECT COUNT(*) FROM upload_parts WHERE session_id = $1),
		    updated_at = NOW()
		WHERE id = $1`
	_, err = r.db.Exec(ctx, updateQuery, p.SessionID)
	if err != nil {
		return fmt.Errorf("update completed chunks: %w", err)
	}

	return nil
}

func (r *Repository) GetCompletedParts(ctx context.Context, sessionID uuid.UUID) ([]Part, error) {
	query := `
		SELECT id, session_id, part_number, etag, size, uploaded_at
		FROM upload_parts
		WHERE session_id = $1
		ORDER BY part_number ASC`

	rows, err := r.db.Query(ctx, query, sessionID)
	if err != nil {
		return nil, fmt.Errorf("get completed parts: %w", err)
	}
	defer rows.Close()

	var parts []Part
	for rows.Next() {
		var p Part
		if err := rows.Scan(&p.ID, &p.SessionID, &p.PartNumber, &p.ETag, &p.Size, &p.UploadedAt); err != nil {
			return nil, fmt.Errorf("scan part: %w", err)
		}
		parts = append(parts, p)
	}
	return parts, nil
}

func (r *Repository) DeleteSession(ctx context.Context, id uuid.UUID) error {
	// Parts are cascade-deleted
	query := `DELETE FROM upload_sessions WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

func (r *Repository) ListExpiredSessions(ctx context.Context) ([]Session, error) {
	query := `
		SELECT id, user_id, folder_id, filename, file_size, mime_type, chunk_size,
		       total_chunks, completed_chunks, storage_key, storage_upload_id, is_video, status, expires_at, created_at, updated_at
		FROM upload_sessions
		WHERE status = 'active' AND expires_at < NOW()
		LIMIT 100`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list expired sessions: %w", err)
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var s Session
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.FolderID, &s.Filename, &s.FileSize, &s.MimeType,
			&s.ChunkSize, &s.TotalChunks, &s.CompletedChunks, &s.StorageKey, &s.StorageUploadID,
			&s.IsVideo, &s.Status, &s.ExpiresAt, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan session: %w", err)
		}
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (r *Repository) CountActiveSessions(ctx context.Context, userID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM upload_sessions WHERE user_id = $1 AND status = 'active'`
	var count int
	err := r.db.QueryRow(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count active sessions: %w", err)
	}
	return count, nil
}
