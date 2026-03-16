package media

import (
	"encoding/json"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

const (
	TaskGenerateThumbnail = "media:generate_thumbnail"
	TaskTranscodeVideo    = "media:transcode_video"
	TaskCleanupTrash      = "media:cleanup_trash"
	TaskExpireUploads     = "media:expire_uploads"
	TaskVirusScan         = "task:virus_scan"
)

type ThumbnailPayload struct {
	FileID     uuid.UUID `json:"file_id"`
	UserID     uuid.UUID `json:"user_id"`
	StorageKey string    `json:"storage_key"`
	MimeType   string    `json:"mime_type"`
}

func NewThumbnailTask(fileID, userID uuid.UUID, storageKey, mimeType string) (*asynq.Task, error) {
	payload, err := json.Marshal(ThumbnailPayload{
		FileID:     fileID,
		UserID:     userID,
		StorageKey: storageKey,
		MimeType:   mimeType,
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TaskGenerateThumbnail, payload, asynq.MaxRetry(3), asynq.Queue("default")), nil
}

type TranscodeVideoPayload struct {
	FileID     uuid.UUID `json:"file_id"`
	UserID     uuid.UUID `json:"user_id"`
	StorageKey string    `json:"storage_key"`
	Filename   string    `json:"filename"`
}

func NewTranscodeVideoTask(fileID, userID uuid.UUID, storageKey, filename string) (*asynq.Task, error) {
	payload, err := json.Marshal(TranscodeVideoPayload{
		FileID:     fileID,
		UserID:     userID,
		StorageKey: storageKey,
		Filename:   filename,
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TaskTranscodeVideo, payload, asynq.MaxRetry(3), asynq.Queue("default")), nil
}

func NewCleanupTrashTask() *asynq.Task {
	return asynq.NewTask(TaskCleanupTrash, nil, asynq.MaxRetry(1), asynq.Queue("low"))
}

func NewExpireUploadsTask() *asynq.Task {
	return asynq.NewTask(TaskExpireUploads, nil, asynq.MaxRetry(1), asynq.Queue("low"))
}

type VirusScanPayload struct {
	FileID     uuid.UUID `json:"file_id"`
	StorageKey string    `json:"storage_key"`
}

func NewVirusScanTask(fileID uuid.UUID, storageKey string) (*asynq.Task, error) {
	payload, err := json.Marshal(VirusScanPayload{
		FileID:     fileID,
		StorageKey: storageKey,
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TaskVirusScan, payload, asynq.MaxRetry(2), asynq.Queue("default")), nil
}
