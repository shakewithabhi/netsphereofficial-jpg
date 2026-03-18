package folder

import (
	"context"
	"errors"
	"fmt"
	"time"

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

func (r *Repository) Create(ctx context.Context, f *Folder) error {
	query := `
		INSERT INTO folders (user_id, parent_id, name, path)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at`

	err := r.db.QueryRow(ctx, query,
		f.UserID, f.ParentID, f.Name, f.Path,
	).Scan(&f.ID, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create folder: %w", err)
	}
	return nil
}

func (r *Repository) GetByID(ctx context.Context, id, userID uuid.UUID) (*Folder, error) {
	query := `
		SELECT id, user_id, parent_id, name, path, trashed_at, created_at, updated_at
		FROM folders
		WHERE id = $1 AND user_id = $2`

	f := &Folder{}
	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&f.ID, &f.UserID, &f.ParentID, &f.Name, &f.Path,
		&f.TrashedAt, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get folder: %w", err)
	}
	return f, nil
}

func (r *Repository) GetParentPath(ctx context.Context, parentID *uuid.UUID, userID uuid.UUID) (string, error) {
	if parentID == nil {
		return "/", nil
	}

	query := `SELECT path FROM folders WHERE id = $1 AND user_id = $2 AND trashed_at IS NULL`
	var path string
	err := r.db.QueryRow(ctx, query, parentID, userID).Scan(&path)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", fmt.Errorf("parent folder not found")
		}
		return "", fmt.Errorf("get parent path: %w", err)
	}
	return path, nil
}

func (r *Repository) ListByParent(ctx context.Context, userID uuid.UUID, parentID *uuid.UUID) ([]Folder, error) {
	var query string
	var args []any

	if parentID == nil {
		query = `
			SELECT id, user_id, parent_id, name, path, trashed_at, created_at, updated_at
			FROM folders
			WHERE user_id = $1 AND parent_id IS NULL AND trashed_at IS NULL
			ORDER BY name ASC`
		args = []any{userID}
	} else {
		query = `
			SELECT id, user_id, parent_id, name, path, trashed_at, created_at, updated_at
			FROM folders
			WHERE user_id = $1 AND parent_id = $2 AND trashed_at IS NULL
			ORDER BY name ASC`
		args = []any{userID, parentID}
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list folders: %w", err)
	}
	defer rows.Close()

	var folders []Folder
	for rows.Next() {
		var f Folder
		if err := rows.Scan(
			&f.ID, &f.UserID, &f.ParentID, &f.Name, &f.Path,
			&f.TrashedAt, &f.CreatedAt, &f.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan folder: %w", err)
		}
		folders = append(folders, f)
	}
	return folders, nil
}

func (r *Repository) Rename(ctx context.Context, id, userID uuid.UUID, name string) error {
	query := `UPDATE folders SET name = $1 WHERE id = $2 AND user_id = $3 AND trashed_at IS NULL`
	result, err := r.db.Exec(ctx, query, name, id, userID)
	if err != nil {
		return fmt.Errorf("rename folder: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("folder not found")
	}
	return nil
}

func (r *Repository) Move(ctx context.Context, id, userID uuid.UUID, newParentID *uuid.UUID, newPath string) error {
	query := `UPDATE folders SET parent_id = $1, path = $2 WHERE id = $3 AND user_id = $4 AND trashed_at IS NULL`
	result, err := r.db.Exec(ctx, query, newParentID, newPath, id, userID)
	if err != nil {
		return fmt.Errorf("move folder: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("folder not found")
	}
	return nil
}

func (r *Repository) Trash(ctx context.Context, id, userID uuid.UUID) error {
	// Trash the folder and all its descendants
	query := `
		WITH RECURSIVE descendants AS (
			SELECT id FROM folders WHERE id = $1 AND user_id = $2
			UNION ALL
			SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
		)
		UPDATE folders SET trashed_at = NOW() WHERE id IN (SELECT id FROM descendants)`

	result, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("trash folder: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("folder not found")
	}

	// Also trash files in these folders
	queryFiles := `
		WITH RECURSIVE descendants AS (
			SELECT id FROM folders WHERE id = $1 AND user_id = $2
			UNION ALL
			SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
		)
		UPDATE files SET trashed_at = NOW()
		WHERE folder_id IN (SELECT id FROM descendants) AND user_id = $2`

	r.db.Exec(ctx, queryFiles, id, userID)

	return nil
}

func (r *Repository) Restore(ctx context.Context, id, userID uuid.UUID) error {
	query := `
		WITH RECURSIVE descendants AS (
			SELECT id FROM folders WHERE id = $1 AND user_id = $2
			UNION ALL
			SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
		)
		UPDATE folders SET trashed_at = NULL WHERE id IN (SELECT id FROM descendants)`

	result, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("restore folder: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("folder not found")
	}

	// Also restore files
	queryFiles := `
		WITH RECURSIVE descendants AS (
			SELECT id FROM folders WHERE id = $1 AND user_id = $2
			UNION ALL
			SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
		)
		UPDATE files SET trashed_at = NULL
		WHERE folder_id IN (SELECT id FROM descendants) AND user_id = $2`

	r.db.Exec(ctx, queryFiles, id, userID)

	return nil
}

func (r *Repository) Delete(ctx context.Context, id, userID uuid.UUID) ([]string, error) {
	// Get all storage keys for files in this folder tree (for storage cleanup)
	keyQuery := `
		WITH RECURSIVE descendants AS (
			SELECT id FROM folders WHERE id = $1 AND user_id = $2
			UNION ALL
			SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
		)
		SELECT storage_key FROM files
		WHERE folder_id IN (SELECT id FROM descendants) AND user_id = $2`

	rows, err := r.db.Query(ctx, keyQuery, id, userID)
	if err != nil {
		return nil, fmt.Errorf("get storage keys: %w", err)
	}
	defer rows.Close()

	var keys []string
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, fmt.Errorf("scan key: %w", err)
		}
		keys = append(keys, key)
	}

	// Delete files first (FK constraint)
	deleteFiles := `
		WITH RECURSIVE descendants AS (
			SELECT id FROM folders WHERE id = $1 AND user_id = $2
			UNION ALL
			SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
		)
		DELETE FROM files WHERE folder_id IN (SELECT id FROM descendants) AND user_id = $2`
	r.db.Exec(ctx, deleteFiles, id, userID)

	// Delete folder tree
	deleteQuery := `
		WITH RECURSIVE descendants AS (
			SELECT id FROM folders WHERE id = $1 AND user_id = $2
			UNION ALL
			SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
		)
		DELETE FROM folders WHERE id IN (SELECT id FROM descendants)`

	r.db.Exec(ctx, deleteQuery, id, userID)

	return keys, nil
}

func (r *Repository) GetByIDs(ctx context.Context, ids []uuid.UUID, userID uuid.UUID) ([]Folder, error) {
	query := `
		SELECT id, user_id, parent_id, name, path, trashed_at, created_at, updated_at
		FROM folders
		WHERE id = ANY($1) AND user_id = $2`

	rows, err := r.db.Query(ctx, query, ids, userID)
	if err != nil {
		return nil, fmt.Errorf("get folders by ids: %w", err)
	}
	defer rows.Close()

	var folders []Folder
	for rows.Next() {
		var f Folder
		if err := rows.Scan(
			&f.ID, &f.UserID, &f.ParentID, &f.Name, &f.Path,
			&f.TrashedAt, &f.CreatedAt, &f.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan folder: %w", err)
		}
		folders = append(folders, f)
	}
	return folders, nil
}

func (r *Repository) TrashMany(ctx context.Context, ids []uuid.UUID, userID uuid.UUID) (int64, error) {
	query := `UPDATE folders SET trashed_at = NOW() WHERE id = ANY($1) AND user_id = $2 AND trashed_at IS NULL`
	result, err := r.db.Exec(ctx, query, ids, userID)
	if err != nil {
		return 0, fmt.Errorf("trash many folders: %w", err)
	}
	return result.RowsAffected(), nil
}

func (r *Repository) MoveMany(ctx context.Context, ids []uuid.UUID, userID uuid.UUID, parentID *uuid.UUID, newPath string) (int64, error) {
	query := `UPDATE folders SET parent_id = $1, path = $2 WHERE id = ANY($3) AND user_id = $4 AND trashed_at IS NULL`
	result, err := r.db.Exec(ctx, query, parentID, newPath, ids, userID)
	if err != nil {
		return 0, fmt.Errorf("move many folders: %w", err)
	}
	return result.RowsAffected(), nil
}

// DeleteExpiredTrash permanently deletes folders that have been in the trash longer than the given cutoff time.
// Returns the number of rows deleted.
func (r *Repository) DeleteExpiredTrash(ctx context.Context, olderThan time.Time) (int64, error) {
	query := `DELETE FROM folders WHERE trashed_at IS NOT NULL AND trashed_at < $1`
	result, err := r.db.Exec(ctx, query, olderThan)
	if err != nil {
		return 0, fmt.Errorf("delete expired trash folders: %w", err)
	}
	return result.RowsAffected(), nil
}

func (r *Repository) NameExists(ctx context.Context, userID uuid.UUID, parentID *uuid.UUID, name string) (bool, error) {
	var query string
	var args []any

	if parentID == nil {
		query = `SELECT EXISTS(SELECT 1 FROM folders WHERE user_id = $1 AND parent_id IS NULL AND name = $2 AND trashed_at IS NULL)`
		args = []any{userID, name}
	} else {
		query = `SELECT EXISTS(SELECT 1 FROM folders WHERE user_id = $1 AND parent_id = $2 AND name = $3 AND trashed_at IS NULL)`
		args = []any{userID, parentID, name}
	}

	var exists bool
	err := r.db.QueryRow(ctx, query, args...).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check name exists: %w", err)
	}
	return exists, nil
}
