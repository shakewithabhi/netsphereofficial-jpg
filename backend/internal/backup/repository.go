package backup

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

func (r *Repository) GetConfig(ctx context.Context, userID uuid.UUID) (*BackupConfig, error) {
	query := `
		SELECT enabled, COALESCE(folder_id::text, ''), wifi_only, include_videos,
		       COALESCE(to_char(last_backup_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '')
		FROM backup_configs
		WHERE user_id = $1`

	cfg := &BackupConfig{}
	err := r.db.QueryRow(ctx, query, userID).Scan(
		&cfg.Enabled, &cfg.FolderID, &cfg.WiFiOnly, &cfg.IncludeVideos, &cfg.LastBackupAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Return default config
			return &BackupConfig{
				Enabled:       false,
				WiFiOnly:      true,
				IncludeVideos: true,
			}, nil
		}
		return nil, fmt.Errorf("get backup config: %w", err)
	}
	return cfg, nil
}

func (r *Repository) SaveConfig(ctx context.Context, userID uuid.UUID, cfg *BackupConfig) error {
	var folderID *uuid.UUID
	if cfg.FolderID != "" {
		parsed, err := uuid.Parse(cfg.FolderID)
		if err != nil {
			return fmt.Errorf("invalid folder_id: %w", err)
		}
		folderID = &parsed
	}

	query := `
		INSERT INTO backup_configs (user_id, enabled, folder_id, wifi_only, include_videos, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			enabled = EXCLUDED.enabled,
			folder_id = EXCLUDED.folder_id,
			wifi_only = EXCLUDED.wifi_only,
			include_videos = EXCLUDED.include_videos,
			updated_at = NOW()`

	_, err := r.db.Exec(ctx, query, userID, cfg.Enabled, folderID, cfg.WiFiOnly, cfg.IncludeVideos)
	if err != nil {
		return fmt.Errorf("save backup config: %w", err)
	}
	return nil
}

func (r *Repository) CheckExistingHashes(ctx context.Context, userID uuid.UUID, hashes []string) ([]string, error) {
	query := `
		SELECT content_hash FROM files
		WHERE user_id = $1 AND content_hash = ANY($2) AND trashed_at IS NULL`

	rows, err := r.db.Query(ctx, query, userID, hashes)
	if err != nil {
		return nil, fmt.Errorf("check existing hashes: %w", err)
	}
	defer rows.Close()

	var existing []string
	for rows.Next() {
		var hash string
		if err := rows.Scan(&hash); err != nil {
			return nil, fmt.Errorf("scan hash: %w", err)
		}
		existing = append(existing, hash)
	}
	return existing, nil
}
