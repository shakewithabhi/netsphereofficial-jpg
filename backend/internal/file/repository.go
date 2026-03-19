package file

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bytebox/backend/internal/common"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, f *File) error {
	query := `
		INSERT INTO files (user_id, folder_id, name, storage_key, size, mime_type, content_hash, is_video)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, scan_status, current_version, created_at, updated_at`

	err := r.db.QueryRow(ctx, query,
		f.UserID, f.FolderID, f.Name, f.StorageKey, f.Size, f.MimeType, f.ContentHash, f.IsVideo,
	).Scan(&f.ID, &f.ScanStatus, &f.CurrentVersion, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	return nil
}

func (r *Repository) GetByID(ctx context.Context, id, userID uuid.UUID) (*File, error) {
	query := `
		SELECT id, user_id, folder_id, name, storage_key, COALESCE(thumbnail_key, ''),
		       size, mime_type, COALESCE(content_hash, ''), scan_status, current_version,
		       is_video, COALESCE(stream_video_id, ''), COALESCE(stream_status, ''),
		       COALESCE(hls_url, ''), COALESCE(video_thumbnail_url, ''),
		       trashed_at, created_at, updated_at
		FROM files
		WHERE id = $1 AND user_id = $2`

	f := &File{}
	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&f.ID, &f.UserID, &f.FolderID, &f.Name, &f.StorageKey, &f.ThumbnailKey,
		&f.Size, &f.MimeType, &f.ContentHash, &f.ScanStatus, &f.CurrentVersion,
		&f.IsVideo, &f.StreamVideoID, &f.StreamStatus, &f.HLSURL, &f.VideoThumbnailURL,
		&f.TrashedAt, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get file: %w", err)
	}
	return f, nil
}

func (r *Repository) ListByFolder(ctx context.Context, userID uuid.UUID, folderID *uuid.UUID, params common.PaginationParams) ([]File, bool, error) {
	// Fetch one extra to determine hasMore
	limit := params.Limit + 1

	var query string
	var args []any

	orderDir := "ASC"
	if params.Order == "desc" {
		orderDir = "DESC"
	}

	// Validate sort field
	sortCol := "name"
	switch params.Sort {
	case "name":
		sortCol = "name"
	case "size":
		sortCol = "size"
	case "created_at":
		sortCol = "created_at"
	case "updated_at":
		sortCol = "updated_at"
	}

	if folderID == nil {
		query = fmt.Sprintf(`
			SELECT id, user_id, folder_id, name, storage_key, COALESCE(thumbnail_key, ''),
			       size, mime_type, COALESCE(content_hash, ''), scan_status, current_version,
			       is_video, COALESCE(stream_video_id, ''), COALESCE(stream_status, ''),
			       COALESCE(hls_url, ''), COALESCE(video_thumbnail_url, ''),
			       trashed_at, created_at, updated_at
			FROM files
			WHERE user_id = $1 AND folder_id IS NULL AND trashed_at IS NULL
			ORDER BY %s %s, id ASC
			LIMIT $2`, sortCol, orderDir)
		args = []any{userID, limit}
	} else {
		query = fmt.Sprintf(`
			SELECT id, user_id, folder_id, name, storage_key, COALESCE(thumbnail_key, ''),
			       size, mime_type, COALESCE(content_hash, ''), scan_status, current_version,
			       is_video, COALESCE(stream_video_id, ''), COALESCE(stream_status, ''),
			       COALESCE(hls_url, ''), COALESCE(video_thumbnail_url, ''),
			       trashed_at, created_at, updated_at
			FROM files
			WHERE user_id = $1 AND folder_id = $2 AND trashed_at IS NULL
			ORDER BY %s %s, id ASC
			LIMIT $3`, sortCol, orderDir)
		args = []any{userID, folderID, limit}
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, false, fmt.Errorf("list files: %w", err)
	}
	defer rows.Close()

	var files []File
	for rows.Next() {
		var f File
		if err := rows.Scan(
			&f.ID, &f.UserID, &f.FolderID, &f.Name, &f.StorageKey, &f.ThumbnailKey,
			&f.Size, &f.MimeType, &f.ContentHash, &f.ScanStatus, &f.CurrentVersion,
		&f.IsVideo, &f.StreamVideoID, &f.StreamStatus, &f.HLSURL, &f.VideoThumbnailURL,
		&f.TrashedAt, &f.CreatedAt, &f.UpdatedAt,
		); err != nil {
			return nil, false, fmt.Errorf("scan file: %w", err)
		}
		files = append(files, f)
	}

	hasMore := len(files) > params.Limit
	if hasMore {
		files = files[:params.Limit]
	}

	return files, hasMore, nil
}

// GetShareCodes returns a map of fileID -> shareCode for files that have active public shares.
func (r *Repository) GetShareCodes(ctx context.Context, userID uuid.UUID, fileIDs []uuid.UUID) (map[uuid.UUID]string, error) {
	if len(fileIDs) == 0 {
		return map[uuid.UUID]string{}, nil
	}
	query := `
		SELECT DISTINCT ON (file_id) file_id, code
		FROM shares
		WHERE user_id = $1 AND file_id = ANY($2)
		  AND is_active = true AND password_hash = '' AND share_type = 'file'
		ORDER BY file_id, created_at DESC`

	rows, err := r.db.Query(ctx, query, userID, fileIDs)
	if err != nil {
		return nil, fmt.Errorf("get share codes: %w", err)
	}
	defer rows.Close()

	result := make(map[uuid.UUID]string)
	for rows.Next() {
		var fid uuid.UUID
		var code string
		if err := rows.Scan(&fid, &code); err != nil {
			return nil, fmt.Errorf("scan share code: %w", err)
		}
		result[fid] = code
	}
	return result, nil
}

func (r *Repository) ListRecent(ctx context.Context, userID uuid.UUID, limit int) ([]File, error) {
	query := `
		SELECT id, user_id, folder_id, name, storage_key, COALESCE(thumbnail_key, ''),
		       size, mime_type, COALESCE(content_hash, ''), scan_status, current_version,
		       is_video, COALESCE(stream_video_id, ''), COALESCE(stream_status, ''),
		       COALESCE(hls_url, ''), COALESCE(video_thumbnail_url, ''),
		       trashed_at, created_at, updated_at
		FROM files
		WHERE user_id = $1 AND trashed_at IS NULL
		ORDER BY created_at DESC
		LIMIT $2`

	rows, err := r.db.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("list recent files: %w", err)
	}
	defer rows.Close()

	var files []File
	for rows.Next() {
		var f File
		if err := rows.Scan(
			&f.ID, &f.UserID, &f.FolderID, &f.Name, &f.StorageKey, &f.ThumbnailKey,
			&f.Size, &f.MimeType, &f.ContentHash, &f.ScanStatus, &f.CurrentVersion,
			&f.IsVideo, &f.StreamVideoID, &f.StreamStatus, &f.HLSURL, &f.VideoThumbnailURL,
			&f.TrashedAt, &f.CreatedAt, &f.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan recent file: %w", err)
		}
		files = append(files, f)
	}
	return files, nil
}

func (r *Repository) ListTrashed(ctx context.Context, userID uuid.UUID) ([]File, error) {
	query := `
		SELECT id, user_id, folder_id, name, storage_key, COALESCE(thumbnail_key, ''),
		       size, mime_type, COALESCE(content_hash, ''), scan_status, current_version,
		       is_video, COALESCE(stream_video_id, ''), COALESCE(stream_status, ''),
		       COALESCE(hls_url, ''), COALESCE(video_thumbnail_url, ''),
		       trashed_at, created_at, updated_at
		FROM files
		WHERE user_id = $1 AND trashed_at IS NOT NULL
		ORDER BY trashed_at DESC
		LIMIT 200`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("list trashed: %w", err)
	}
	defer rows.Close()

	var files []File
	for rows.Next() {
		var f File
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

func (r *Repository) Rename(ctx context.Context, id, userID uuid.UUID, name string) error {
	query := `UPDATE files SET name = $1 WHERE id = $2 AND user_id = $3 AND trashed_at IS NULL`
	result, err := r.db.Exec(ctx, query, name, id, userID)
	if err != nil {
		return fmt.Errorf("rename file: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("file not found")
	}
	return nil
}

func (r *Repository) Move(ctx context.Context, id, userID uuid.UUID, folderID *uuid.UUID) error {
	query := `UPDATE files SET folder_id = $1 WHERE id = $2 AND user_id = $3 AND trashed_at IS NULL`
	result, err := r.db.Exec(ctx, query, folderID, id, userID)
	if err != nil {
		return fmt.Errorf("move file: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("file not found")
	}
	return nil
}

func (r *Repository) Trash(ctx context.Context, id, userID uuid.UUID) error {
	query := `UPDATE files SET trashed_at = NOW() WHERE id = $1 AND user_id = $2 AND trashed_at IS NULL`
	result, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("trash file: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("file not found")
	}
	return nil
}

func (r *Repository) Restore(ctx context.Context, id, userID uuid.UUID) error {
	query := `UPDATE files SET trashed_at = NULL WHERE id = $1 AND user_id = $2 AND trashed_at IS NOT NULL`
	result, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("restore file: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("file not found")
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, id, userID uuid.UUID) (*File, error) {
	// Get file info before deleting (for storage cleanup)
	f, err := r.GetByID(ctx, id, userID)
	if err != nil || f == nil {
		return nil, fmt.Errorf("file not found")
	}

	query := `DELETE FROM files WHERE id = $1 AND user_id = $2`
	_, err = r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return nil, fmt.Errorf("delete file: %w", err)
	}
	return f, nil
}

func (r *Repository) UpdateStorageUsed(ctx context.Context, userID uuid.UUID, delta int64) error {
	query := `UPDATE users SET storage_used = storage_used + $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, delta, userID)
	if err != nil {
		return fmt.Errorf("update storage used: %w", err)
	}
	return nil
}

func (r *Repository) GetStorageUsed(ctx context.Context, userID uuid.UUID) (int64, int64, error) {
	query := `SELECT storage_used, storage_limit FROM users WHERE id = $1`
	var used, limit int64
	err := r.db.QueryRow(ctx, query, userID).Scan(&used, &limit)
	if err != nil {
		return 0, 0, fmt.Errorf("get storage: %w", err)
	}
	return used, limit, nil
}

func (r *Repository) Search(ctx context.Context, userID uuid.UUID, query string, limit int) ([]File, error) {
	sql := `
		SELECT id, user_id, folder_id, name, storage_key, COALESCE(thumbnail_key, ''),
		       size, mime_type, COALESCE(content_hash, ''), scan_status, current_version,
		       is_video, COALESCE(stream_video_id, ''), COALESCE(stream_status, ''),
		       COALESCE(hls_url, ''), COALESCE(video_thumbnail_url, ''),
		       trashed_at, created_at, updated_at
		FROM files
		WHERE user_id = $1 AND trashed_at IS NULL
		  AND to_tsvector('english', name) @@ plainto_tsquery('english', $2)
		ORDER BY ts_rank(to_tsvector('english', name), plainto_tsquery('english', $2)) DESC
		LIMIT $3`

	rows, err := r.db.Query(ctx, sql, userID, query, limit)
	if err != nil {
		return nil, fmt.Errorf("search files: %w", err)
	}
	defer rows.Close()

	var files []File
	for rows.Next() {
		var f File
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

func (r *Repository) CreateVersion(ctx context.Context, version *FileVersion) error {
	query := `
		INSERT INTO file_versions (file_id, version_number, storage_key, size, content_hash, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at`

	err := r.db.QueryRow(ctx, query,
		version.FileID, version.VersionNumber, version.StorageKey, version.Size, version.ContentHash, version.CreatedBy,
	).Scan(&version.ID, &version.CreatedAt)
	if err != nil {
		return fmt.Errorf("create file version: %w", err)
	}
	return nil
}

func (r *Repository) ListVersions(ctx context.Context, fileID uuid.UUID) ([]FileVersion, error) {
	query := `
		SELECT id, file_id, version_number, storage_key, size, content_hash, created_by, created_at
		FROM file_versions
		WHERE file_id = $1
		ORDER BY version_number DESC`

	rows, err := r.db.Query(ctx, query, fileID)
	if err != nil {
		return nil, fmt.Errorf("list file versions: %w", err)
	}
	defer rows.Close()

	var versions []FileVersion
	for rows.Next() {
		var v FileVersion
		if err := rows.Scan(
			&v.ID, &v.FileID, &v.VersionNumber, &v.StorageKey, &v.Size, &v.ContentHash, &v.CreatedBy, &v.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan file version: %w", err)
		}
		versions = append(versions, v)
	}
	return versions, nil
}

func (r *Repository) GetVersion(ctx context.Context, fileID uuid.UUID, versionNumber int) (*FileVersion, error) {
	query := `
		SELECT id, file_id, version_number, storage_key, size, content_hash, created_by, created_at
		FROM file_versions
		WHERE file_id = $1 AND version_number = $2`

	v := &FileVersion{}
	err := r.db.QueryRow(ctx, query, fileID, versionNumber).Scan(
		&v.ID, &v.FileID, &v.VersionNumber, &v.StorageKey, &v.Size, &v.ContentHash, &v.CreatedBy, &v.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get file version: %w", err)
	}
	return v, nil
}

func (r *Repository) GetLatestVersionNumber(ctx context.Context, fileID uuid.UUID) (int, error) {
	query := `SELECT COALESCE(MAX(version_number), 0) FROM file_versions WHERE file_id = $1`
	var num int
	err := r.db.QueryRow(ctx, query, fileID).Scan(&num)
	if err != nil {
		return 0, fmt.Errorf("get latest version number: %w", err)
	}
	return num, nil
}

func (r *Repository) DeleteVersion(ctx context.Context, fileID uuid.UUID, versionNumber int) error {
	query := `DELETE FROM file_versions WHERE file_id = $1 AND version_number = $2`
	result, err := r.db.Exec(ctx, query, fileID, versionNumber)
	if err != nil {
		return fmt.Errorf("delete file version: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("version not found")
	}
	return nil
}

func (r *Repository) RestoreVersion(ctx context.Context, fileID uuid.UUID, versionNumber int) error {
	query := `
		UPDATE files
		SET storage_key = fv.storage_key,
		    size = fv.size,
		    content_hash = fv.content_hash,
		    current_version = fv.version_number,
		    updated_at = NOW()
		FROM file_versions fv
		WHERE files.id = $1 AND fv.file_id = $1 AND fv.version_number = $2`

	result, err := r.db.Exec(ctx, query, fileID, versionNumber)
	if err != nil {
		return fmt.Errorf("restore file version: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("version not found")
	}
	return nil
}

func (r *Repository) GetByIDs(ctx context.Context, ids []uuid.UUID, userID uuid.UUID) ([]File, error) {
	query := `
		SELECT id, user_id, folder_id, name, storage_key, COALESCE(thumbnail_key, ''),
		       size, mime_type, COALESCE(content_hash, ''), scan_status, current_version,
		       is_video, COALESCE(stream_video_id, ''), COALESCE(stream_status, ''),
		       COALESCE(hls_url, ''), COALESCE(video_thumbnail_url, ''),
		       trashed_at, created_at, updated_at
		FROM files
		WHERE id = ANY($1) AND user_id = $2`

	rows, err := r.db.Query(ctx, query, ids, userID)
	if err != nil {
		return nil, fmt.Errorf("get files by ids: %w", err)
	}
	defer rows.Close()

	var files []File
	for rows.Next() {
		var f File
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

func (r *Repository) TrashMany(ctx context.Context, ids []uuid.UUID, userID uuid.UUID) (int64, error) {
	query := `UPDATE files SET trashed_at = NOW() WHERE id = ANY($1) AND user_id = $2 AND trashed_at IS NULL`
	result, err := r.db.Exec(ctx, query, ids, userID)
	if err != nil {
		return 0, fmt.Errorf("trash many files: %w", err)
	}
	return result.RowsAffected(), nil
}

func (r *Repository) MoveMany(ctx context.Context, ids []uuid.UUID, userID uuid.UUID, folderID *uuid.UUID) (int64, error) {
	query := `UPDATE files SET folder_id = $1 WHERE id = ANY($2) AND user_id = $3 AND trashed_at IS NULL`
	result, err := r.db.Exec(ctx, query, folderID, ids, userID)
	if err != nil {
		return 0, fmt.Errorf("move many files: %w", err)
	}
	return result.RowsAffected(), nil
}

func (r *Repository) ListNamesByPrefix(ctx context.Context, userID uuid.UUID, folderID *uuid.UUID, prefix string) ([]string, error) {
	var query string
	var args []any

	if folderID == nil {
		query = `SELECT name FROM files WHERE user_id = $1 AND folder_id IS NULL AND trashed_at IS NULL AND name LIKE $2 || '%'`
		args = []any{userID, prefix}
	} else {
		query = `SELECT name FROM files WHERE user_id = $1 AND folder_id = $2 AND trashed_at IS NULL AND name LIKE $3 || '%'`
		args = []any{userID, folderID, prefix}
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list names by prefix: %w", err)
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scan name: %w", err)
		}
		names = append(names, name)
	}
	return names, nil
}

func (r *Repository) FindByName(ctx context.Context, userID uuid.UUID, folderID *uuid.UUID, name string) (*File, error) {
	var query string
	var args []any

	if folderID == nil {
		query = `
			SELECT id, user_id, folder_id, name, storage_key, COALESCE(thumbnail_key, ''),
			       size, mime_type, COALESCE(content_hash, ''), scan_status, current_version,
			       is_video, COALESCE(stream_video_id, ''), COALESCE(stream_status, ''),
			       COALESCE(hls_url, ''), COALESCE(video_thumbnail_url, ''),
			       trashed_at, created_at, updated_at
			FROM files
			WHERE user_id = $1 AND folder_id IS NULL AND name = $2 AND trashed_at IS NULL`
		args = []any{userID, name}
	} else {
		query = `
			SELECT id, user_id, folder_id, name, storage_key, COALESCE(thumbnail_key, ''),
			       size, mime_type, COALESCE(content_hash, ''), scan_status, current_version,
			       is_video, COALESCE(stream_video_id, ''), COALESCE(stream_status, ''),
			       COALESCE(hls_url, ''), COALESCE(video_thumbnail_url, ''),
			       trashed_at, created_at, updated_at
			FROM files
			WHERE user_id = $1 AND folder_id = $2 AND name = $3 AND trashed_at IS NULL`
		args = []any{userID, folderID, name}
	}

	f := &File{}
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&f.ID, &f.UserID, &f.FolderID, &f.Name, &f.StorageKey, &f.ThumbnailKey,
		&f.Size, &f.MimeType, &f.ContentHash, &f.ScanStatus, &f.CurrentVersion,
		&f.IsVideo, &f.StreamVideoID, &f.StreamStatus, &f.HLSURL, &f.VideoThumbnailURL,
		&f.TrashedAt, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("find file by name: %w", err)
	}
	return f, nil
}

func (r *Repository) ReplaceFile(ctx context.Context, id, userID uuid.UUID, storageKey string, size int64, mimeType, contentHash string, isVideo bool) error {
	query := `
		UPDATE files
		SET storage_key = $1, size = $2, mime_type = $3, content_hash = $4, is_video = $5,
		    current_version = current_version + 1,
		    stream_video_id = NULL, stream_status = NULL, hls_url = NULL, video_thumbnail_url = NULL,
		    updated_at = NOW()
		WHERE id = $6 AND user_id = $7`
	_, err := r.db.Exec(ctx, query, storageKey, size, mimeType, contentHash, isVideo, id, userID)
	if err != nil {
		return fmt.Errorf("replace file: %w", err)
	}
	return nil
}

func (r *Repository) NameExistsInFolder(ctx context.Context, userID uuid.UUID, folderID *uuid.UUID, name string) (bool, error) {
	var query string
	var args []any

	if folderID == nil {
		query = `SELECT EXISTS(SELECT 1 FROM files WHERE user_id = $1 AND folder_id IS NULL AND name = $2 AND trashed_at IS NULL)`
		args = []any{userID, name}
	} else {
		query = `SELECT EXISTS(SELECT 1 FROM files WHERE user_id = $1 AND folder_id = $2 AND name = $3 AND trashed_at IS NULL)`
		args = []any{userID, folderID, name}
	}

	var exists bool
	err := r.db.QueryRow(ctx, query, args...).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check file name: %w", err)
	}
	return exists, nil
}

func (r *Repository) ListByMimeTypes(ctx context.Context, userID uuid.UUID, mimePatterns []string, params common.PaginationParams) ([]File, bool, error) {
	limit := params.Limit + 1

	orderDir := "ASC"
	if params.Order == "desc" {
		orderDir = "DESC"
	}

	sortCol := "created_at"
	switch params.Sort {
	case "name":
		sortCol = "name"
	case "size":
		sortCol = "size"
	case "created_at":
		sortCol = "created_at"
	case "updated_at":
		sortCol = "updated_at"
	}

	// Build MIME type filter conditions
	conditions := ""
	args := []any{userID}
	for i, pattern := range mimePatterns {
		if i > 0 {
			conditions += " OR "
		}
		args = append(args, pattern)
		conditions += fmt.Sprintf("mime_type LIKE $%d", len(args))
	}

	args = append(args, limit)
	query := fmt.Sprintf(`
		SELECT id, user_id, folder_id, name, storage_key, COALESCE(thumbnail_key, ''),
		       size, mime_type, COALESCE(content_hash, ''), scan_status, current_version,
		       is_video, COALESCE(stream_video_id, ''), COALESCE(stream_status, ''),
		       COALESCE(hls_url, ''), COALESCE(video_thumbnail_url, ''),
		       trashed_at, created_at, updated_at
		FROM files
		WHERE user_id = $1 AND trashed_at IS NULL AND (%s)
		ORDER BY %s %s, id ASC
		LIMIT $%d`, conditions, sortCol, orderDir, len(args))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, false, fmt.Errorf("list files by mime: %w", err)
	}
	defer rows.Close()

	var files []File
	for rows.Next() {
		var f File
		if err := rows.Scan(
			&f.ID, &f.UserID, &f.FolderID, &f.Name, &f.StorageKey, &f.ThumbnailKey,
			&f.Size, &f.MimeType, &f.ContentHash, &f.ScanStatus, &f.CurrentVersion,
			&f.IsVideo, &f.StreamVideoID, &f.StreamStatus, &f.HLSURL, &f.VideoThumbnailURL,
			&f.TrashedAt, &f.CreatedAt, &f.UpdatedAt,
		); err != nil {
			return nil, false, fmt.Errorf("scan file: %w", err)
		}
		files = append(files, f)
	}

	hasMore := len(files) > params.Limit
	if hasMore {
		files = files[:params.Limit]
	}

	return files, hasMore, nil
}

func (r *Repository) CountByCategory(ctx context.Context, userID uuid.UUID) ([]FileCategoryCount, error) {
	query := `
		SELECT
			CASE
				WHEN mime_type LIKE 'image/%' THEN 'images'
				WHEN mime_type LIKE 'video/%' THEN 'videos'
				WHEN mime_type LIKE 'audio/%' THEN 'audio'
				WHEN mime_type LIKE 'application/pdf'
				  OR mime_type LIKE 'application/msword'
				  OR mime_type LIKE 'application/vnd.openxmlformats-%'
				  OR mime_type LIKE 'text/%' THEN 'documents'
				ELSE 'other'
			END AS category,
			COUNT(*) AS count,
			COALESCE(SUM(size), 0) AS total_size
		FROM files
		WHERE user_id = $1 AND trashed_at IS NULL
		GROUP BY category
		ORDER BY count DESC`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("count by category: %w", err)
	}
	defer rows.Close()

	var categories []FileCategoryCount
	for rows.Next() {
		var c FileCategoryCount
		if err := rows.Scan(&c.Category, &c.Count, &c.TotalSize); err != nil {
			return nil, fmt.Errorf("scan category count: %w", err)
		}
		categories = append(categories, c)
	}
	return categories, nil
}

func (r *Repository) UpdateVideoFields(ctx context.Context, fileID uuid.UUID, streamVideoID, streamStatus, hlsURL, videoThumbnailURL string) error {
	query := `
		UPDATE files
		SET stream_video_id = $2, stream_status = $3, hls_url = $4, video_thumbnail_url = $5, updated_at = NOW()
		WHERE id = $1`
	_, err := r.db.Exec(ctx, query, fileID, streamVideoID, streamStatus, hlsURL, videoThumbnailURL)
	if err != nil {
		return fmt.Errorf("update video fields: %w", err)
	}
	return nil
}

func (r *Repository) GetByStreamVideoID(ctx context.Context, streamVideoID string) (*File, error) {
	query := `
		SELECT id, user_id, folder_id, name, storage_key, COALESCE(thumbnail_key, ''),
		       size, mime_type, COALESCE(content_hash, ''), scan_status, current_version,
		       is_video, COALESCE(stream_video_id, ''), COALESCE(stream_status, ''),
		       COALESCE(hls_url, ''), COALESCE(video_thumbnail_url, ''),
		       trashed_at, created_at, updated_at
		FROM files
		WHERE stream_video_id = $1`

	f := &File{}
	err := r.db.QueryRow(ctx, query, streamVideoID).Scan(
		&f.ID, &f.UserID, &f.FolderID, &f.Name, &f.StorageKey, &f.ThumbnailKey,
		&f.Size, &f.MimeType, &f.ContentHash, &f.ScanStatus, &f.CurrentVersion,
		&f.IsVideo, &f.StreamVideoID, &f.StreamStatus, &f.HLSURL, &f.VideoThumbnailURL,
		&f.TrashedAt, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get file by stream video id: %w", err)
	}
	return f, nil
}

// Star/Favorite methods

func (r *Repository) StarFile(ctx context.Context, fileID, userID uuid.UUID) error {
	query := `INSERT INTO file_stars (file_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`
	_, err := r.db.Exec(ctx, query, fileID, userID)
	if err != nil {
		return fmt.Errorf("star file: %w", err)
	}
	return nil
}

func (r *Repository) UnstarFile(ctx context.Context, fileID, userID uuid.UUID) error {
	query := `DELETE FROM file_stars WHERE file_id = $1 AND user_id = $2`
	_, err := r.db.Exec(ctx, query, fileID, userID)
	if err != nil {
		return fmt.Errorf("unstar file: %w", err)
	}
	return nil
}

func (r *Repository) ListStarred(ctx context.Context, userID uuid.UUID) ([]File, error) {
	query := `
		SELECT f.id, f.user_id, f.folder_id, f.name, f.storage_key, COALESCE(f.thumbnail_key, ''),
		       f.size, f.mime_type, COALESCE(f.content_hash, ''), f.scan_status, f.current_version,
		       f.is_video, COALESCE(f.stream_video_id, ''), COALESCE(f.stream_status, ''),
		       COALESCE(f.hls_url, ''), COALESCE(f.video_thumbnail_url, ''),
		       f.trashed_at, f.created_at, f.updated_at
		FROM files f
		JOIN file_stars fs ON f.id = fs.file_id
		WHERE fs.user_id = $1 AND f.trashed_at IS NULL
		ORDER BY fs.starred_at DESC
		LIMIT 200`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("list starred: %w", err)
	}
	defer rows.Close()

	var files []File
	for rows.Next() {
		var f File
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

func (r *Repository) IsStarred(ctx context.Context, fileID, userID uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM file_stars WHERE file_id = $1 AND user_id = $2)`
	var exists bool
	err := r.db.QueryRow(ctx, query, fileID, userID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check starred: %w", err)
	}
	return exists, nil
}

// Comment methods

func (r *Repository) CreateComment(ctx context.Context, comment *Comment) error {
	query := `
		INSERT INTO file_comments (file_id, user_id, content)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at`

	err := r.db.QueryRow(ctx, query, comment.FileID, comment.UserID, comment.Content).Scan(
		&comment.ID, &comment.CreatedAt, &comment.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("create comment: %w", err)
	}
	return nil
}

func (r *Repository) ListComments(ctx context.Context, fileID uuid.UUID) ([]Comment, error) {
	query := `
		SELECT fc.id, fc.file_id, fc.user_id, u.display_name, fc.content, fc.created_at, fc.updated_at
		FROM file_comments fc
		JOIN users u ON fc.user_id = u.id
		WHERE fc.file_id = $1
		ORDER BY fc.created_at ASC`

	rows, err := r.db.Query(ctx, query, fileID)
	if err != nil {
		return nil, fmt.Errorf("list comments: %w", err)
	}
	defer rows.Close()

	var comments []Comment
	for rows.Next() {
		var c Comment
		if err := rows.Scan(&c.ID, &c.FileID, &c.UserID, &c.UserName, &c.Content, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan comment: %w", err)
		}
		comments = append(comments, c)
	}
	return comments, nil
}

func (r *Repository) GetComment(ctx context.Context, commentID uuid.UUID) (*Comment, error) {
	query := `
		SELECT fc.id, fc.file_id, fc.user_id, u.display_name, fc.content, fc.created_at, fc.updated_at
		FROM file_comments fc
		JOIN users u ON fc.user_id = u.id
		WHERE fc.id = $1`

	c := &Comment{}
	err := r.db.QueryRow(ctx, query, commentID).Scan(
		&c.ID, &c.FileID, &c.UserID, &c.UserName, &c.Content, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get comment: %w", err)
	}
	return c, nil
}

func (r *Repository) UpdateComment(ctx context.Context, commentID, userID uuid.UUID, content string) error {
	query := `UPDATE file_comments SET content = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`
	result, err := r.db.Exec(ctx, query, content, commentID, userID)
	if err != nil {
		return fmt.Errorf("update comment: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("comment not found")
	}
	return nil
}

func (r *Repository) DeleteComment(ctx context.Context, commentID, userID uuid.UUID) error {
	query := `DELETE FROM file_comments WHERE id = $1 AND user_id = $2`
	result, err := r.db.Exec(ctx, query, commentID, userID)
	if err != nil {
		return fmt.Errorf("delete comment: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("comment not found")
	}
	return nil
}
