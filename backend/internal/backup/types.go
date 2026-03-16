package backup

type BackupConfig struct {
	Enabled       bool   `json:"enabled"`
	FolderID      string `json:"folder_id"`                  // target folder for backups
	WiFiOnly      bool   `json:"wifi_only"`
	IncludeVideos bool   `json:"include_videos"`
	LastBackupAt  string `json:"last_backup_at,omitempty"`
}

type BackupStatusRequest struct {
	// Client sends list of file hashes to check which are already backed up
	Hashes []string `json:"hashes" validate:"required"`
}

type BackupStatusResponse struct {
	// Returns which hashes are already uploaded
	Existing []string `json:"existing"`
	Missing  []string `json:"missing"`
}

type UpdateBackupConfigRequest struct {
	Enabled       *bool   `json:"enabled"`
	FolderID      *string `json:"folder_id"`
	WiFiOnly      *bool   `json:"wifi_only"`
	IncludeVideos *bool   `json:"include_videos"`
}
