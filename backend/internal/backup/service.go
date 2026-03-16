package backup

import (
	"context"
	"log/slog"

	"github.com/bytebox/backend/internal/auth"
	"github.com/bytebox/backend/internal/common"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetConfig(ctx context.Context, claims *auth.TokenClaims) (*BackupConfig, error) {
	cfg, err := s.repo.GetConfig(ctx, claims.UserID)
	if err != nil {
		slog.Error("failed to get backup config", "error", err, "user_id", claims.UserID)
		return nil, common.ErrInternal("failed to get backup config")
	}
	return cfg, nil
}

func (s *Service) UpdateConfig(ctx context.Context, claims *auth.TokenClaims, req UpdateBackupConfigRequest) (*BackupConfig, error) {
	// Get current config
	cfg, err := s.repo.GetConfig(ctx, claims.UserID)
	if err != nil {
		slog.Error("failed to get backup config", "error", err, "user_id", claims.UserID)
		return nil, common.ErrInternal("failed to get backup config")
	}

	// Apply updates
	if req.Enabled != nil {
		cfg.Enabled = *req.Enabled
	}
	if req.FolderID != nil {
		cfg.FolderID = *req.FolderID
	}
	if req.WiFiOnly != nil {
		cfg.WiFiOnly = *req.WiFiOnly
	}
	if req.IncludeVideos != nil {
		cfg.IncludeVideos = *req.IncludeVideos
	}

	if err := s.repo.SaveConfig(ctx, claims.UserID, cfg); err != nil {
		slog.Error("failed to save backup config", "error", err, "user_id", claims.UserID)
		return nil, common.ErrInternal("failed to save backup config")
	}

	return cfg, nil
}

func (s *Service) CheckStatus(ctx context.Context, claims *auth.TokenClaims, req BackupStatusRequest) (*BackupStatusResponse, error) {
	existing, err := s.repo.CheckExistingHashes(ctx, claims.UserID, req.Hashes)
	if err != nil {
		slog.Error("failed to check backup status", "error", err, "user_id", claims.UserID)
		return nil, common.ErrInternal("failed to check backup status")
	}

	// Build set of existing hashes for fast lookup
	existingSet := make(map[string]bool, len(existing))
	for _, h := range existing {
		existingSet[h] = true
	}

	var missing []string
	for _, h := range req.Hashes {
		if !existingSet[h] {
			missing = append(missing, h)
		}
	}

	// Ensure non-nil slices for JSON
	if existing == nil {
		existing = []string{}
	}
	if missing == nil {
		missing = []string{}
	}

	return &BackupStatusResponse{
		Existing: existing,
		Missing:  missing,
	}, nil
}
