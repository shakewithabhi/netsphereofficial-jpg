package share

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bytebox/backend/internal/file"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, s *Share) error {
	query := `
		INSERT INTO shares (file_id, folder_id, user_id, code, share_type, password_hash, expires_at, max_downloads)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, download_count, is_active, created_at`

	err := r.db.QueryRow(ctx, query,
		s.FileID, s.FolderID, s.UserID, s.Code, s.ShareType, s.PasswordHash, s.ExpiresAt, s.MaxDownloads,
	).Scan(&s.ID, &s.DownloadCount, &s.IsActive, &s.CreatedAt)
	if err != nil {
		return fmt.Errorf("create share: %w", err)
	}
	return nil
}

func (r *Repository) GetByID(ctx context.Context, id, userID uuid.UUID) (*Share, error) {
	query := `
		SELECT id, file_id, folder_id, user_id, code, share_type, password_hash, expires_at, max_downloads,
		       download_count, is_active, created_at
		FROM shares
		WHERE id = $1 AND user_id = $2`

	return r.scanShare(r.db.QueryRow(ctx, query, id, userID))
}

func (r *Repository) GetByCode(ctx context.Context, code string) (*Share, error) {
	query := `
		SELECT id, file_id, folder_id, user_id, code, share_type, password_hash, expires_at, max_downloads,
		       download_count, is_active, created_at
		FROM shares
		WHERE code = $1 AND is_active = true`

	return r.scanShare(r.db.QueryRow(ctx, query, code))
}

func (r *Repository) ListByUser(ctx context.Context, userID uuid.UUID) ([]Share, error) {
	query := `
		SELECT id, file_id, folder_id, user_id, code, share_type, password_hash, expires_at, max_downloads,
		       download_count, is_active, created_at
		FROM shares
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 100`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("list shares: %w", err)
	}
	defer rows.Close()

	var shares []Share
	for rows.Next() {
		s, err := r.scanShareRow(rows)
		if err != nil {
			return nil, err
		}
		shares = append(shares, *s)
	}
	return shares, nil
}

func (r *Repository) Update(ctx context.Context, id, userID uuid.UUID, passwordHash *string, expiresAt *time.Time, maxDownloads *int, isActive *bool) error {
	// Build dynamic update
	query := `UPDATE shares SET `
	args := []any{}
	argIdx := 1
	setClauses := ""

	if passwordHash != nil {
		setClauses += fmt.Sprintf("password_hash = $%d, ", argIdx)
		args = append(args, *passwordHash)
		argIdx++
	}
	if expiresAt != nil {
		setClauses += fmt.Sprintf("expires_at = $%d, ", argIdx)
		args = append(args, *expiresAt)
		argIdx++
	}
	if maxDownloads != nil {
		setClauses += fmt.Sprintf("max_downloads = $%d, ", argIdx)
		args = append(args, *maxDownloads)
		argIdx++
	}
	if isActive != nil {
		setClauses += fmt.Sprintf("is_active = $%d, ", argIdx)
		args = append(args, *isActive)
		argIdx++
	}

	if len(args) == 0 {
		return nil
	}

	// Remove trailing ", "
	setClauses = setClauses[:len(setClauses)-2]
	query += setClauses + fmt.Sprintf(" WHERE id = $%d AND user_id = $%d", argIdx, argIdx+1)
	args = append(args, id, userID)

	result, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update share: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("share not found")
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	query := `DELETE FROM shares WHERE id = $1 AND user_id = $2`
	result, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("delete share: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("share not found")
	}
	return nil
}

func (r *Repository) IncrementDownload(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE shares SET download_count = download_count + 1 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("increment download: %w", err)
	}
	return nil
}

// GetFolderContents lists files in a shared folder for public access.
func (r *Repository) GetFolderContents(ctx context.Context, folderID uuid.UUID) ([]file.File, error) {
	query := `
		SELECT id, user_id, folder_id, name, storage_key, thumbnail_key,
		       size, mime_type, content_hash, scan_status, current_version,
		       is_video, stream_video_id, stream_status, hls_url, video_thumbnail_url,
		       trashed_at, created_at, updated_at
		FROM files
		WHERE folder_id = $1 AND trashed_at IS NULL
		ORDER BY name ASC`

	rows, err := r.db.Query(ctx, query, folderID)
	if err != nil {
		return nil, fmt.Errorf("get folder contents: %w", err)
	}
	defer rows.Close()

	var files []file.File
	for rows.Next() {
		var f file.File
		if err := rows.Scan(
			&f.ID, &f.UserID, &f.FolderID, &f.Name, &f.StorageKey, &f.ThumbnailKey,
			&f.Size, &f.MimeType, &f.ContentHash, &f.ScanStatus, &f.CurrentVersion,
			&f.IsVideo, &f.StreamVideoID, &f.StreamStatus, &f.HLSURL, &f.VideoThumbnailURL,
			&f.TrashedAt, &f.CreatedAt, &f.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan file: %w", err)
		}
		files = append(files, f)
	}
	return files, nil
}

// GetExploreItems returns publicly shared files for the explore feed.
// Cursor is encoded as "createdAt_RFC3339Nano|shareID" to support stable keyset pagination.
func (r *Repository) GetExploreItems(ctx context.Context, limit int, cursorTime *time.Time, cursorID *string, mimePrefix *string) ([]exploreRow, error) {
	args := []any{}
	idx := 1

	query := `
		SELECT s.id, s.code, f.name, f.size, f.mime_type,
		       COALESCE(f.thumbnail_key, ''), COALESCE(f.video_thumbnail_url, ''),
		       f.is_video, COALESCE(u.display_name, ''), s.download_count, s.created_at
		FROM shares s
		JOIN files f ON f.id = s.file_id
		JOIN users u ON u.id = s.user_id
		WHERE s.is_active = true
		  AND s.password_hash = ''
		  AND s.share_type = 'file'
		  AND (s.expires_at IS NULL OR s.expires_at > NOW())
		  AND f.trashed_at IS NULL`

	if mimePrefix != nil {
		query += fmt.Sprintf(" AND f.mime_type LIKE $%d", idx)
		args = append(args, *mimePrefix+"%")
		idx++
	}

	if cursorTime != nil && cursorID != nil {
		query += fmt.Sprintf(" AND (s.created_at, s.id::text) < ($%d, $%d)", idx, idx+1)
		args = append(args, *cursorTime, *cursorID)
		idx += 2
	}

	query += fmt.Sprintf(" ORDER BY s.created_at DESC, s.id DESC LIMIT $%d", idx)
	args = append(args, limit)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("get explore items: %w", err)
	}
	defer rows.Close()

	var items []exploreRow
	for rows.Next() {
		var item exploreRow
		if err := rows.Scan(
			&item.ShareID, &item.Code, &item.FileName, &item.FileSize, &item.MimeType,
			&item.ThumbnailKey, &item.VideoThumbnailURL, &item.IsVideo,
			&item.OwnerName, &item.DownloadCount, &item.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan explore row: %w", err)
		}
		items = append(items, item)
	}
	return items, nil
}

// CountFolderFiles returns the number of non-trashed files in a folder.
func (r *Repository) CountFolderFiles(ctx context.Context, folderID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM files WHERE folder_id = $1 AND trashed_at IS NULL`
	var count int
	err := r.db.QueryRow(ctx, query, folderID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count folder files: %w", err)
	}
	return count, nil
}

func (r *Repository) scanShare(row pgx.Row) (*Share, error) {
	s := &Share{}
	err := row.Scan(
		&s.ID, &s.FileID, &s.FolderID, &s.UserID, &s.Code, &s.ShareType, &s.PasswordHash,
		&s.ExpiresAt, &s.MaxDownloads, &s.DownloadCount, &s.IsActive, &s.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("scan share: %w", err)
	}
	return s, nil
}

func (r *Repository) scanShareRow(rows pgx.Rows) (*Share, error) {
	s := &Share{}
	err := rows.Scan(
		&s.ID, &s.FileID, &s.FolderID, &s.UserID, &s.Code, &s.ShareType, &s.PasswordHash,
		&s.ExpiresAt, &s.MaxDownloads, &s.DownloadCount, &s.IsActive, &s.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan share: %w", err)
	}
	return s, nil
}
