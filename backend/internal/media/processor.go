package media

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	_ "image/gif"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bytebox/backend/internal/scanner"
	"github.com/bytebox/backend/internal/storage"
)

const (
	thumbMaxWidth  = 400
	thumbMaxHeight = 400
	thumbQuality   = 80
)

type Processor struct {
	db      *pgxpool.Pool
	store   *storage.Client
	stream  *storage.StreamClient
	scanner *scanner.ClamAVScanner
}

func NewProcessor(db *pgxpool.Pool, store *storage.Client, stream *storage.StreamClient, scanner *scanner.ClamAVScanner) *Processor {
	return &Processor{db: db, store: store, stream: stream, scanner: scanner}
}

func (p *Processor) HandleGenerateThumbnail(ctx context.Context, t *asynq.Task) error {
	var payload ThumbnailPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	slog.Info("generating thumbnail", "file_id", payload.FileID, "mime", payload.MimeType)

	isVideo := strings.HasPrefix(payload.MimeType, "video/")
	isImage := isImageType(payload.MimeType)

	if !isImage && !isVideo {
		slog.Info("skipping unsupported file type for thumbnail", "mime", payload.MimeType)
		return nil
	}

	// Download original from storage
	fileData, err := p.downloadFile(ctx, payload.StorageKey)
	if err != nil {
		return fmt.Errorf("download file: %w", err)
	}

	var thumbData []byte

	if isVideo {
		// Extract frame from video using ffmpeg
		thumbData, err = p.extractVideoFrame(fileData)
		if err != nil {
			slog.Error("failed to extract video frame", "error", err, "file_id", payload.FileID)
			return nil // Don't retry
		}
	} else {
		// Decode image
		img, _, decErr := image.Decode(bytes.NewReader(fileData))
		if decErr != nil {
			slog.Error("failed to decode image", "error", decErr)
			return nil
		}
		thumb := resizeImage(img, thumbMaxWidth, thumbMaxHeight)
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, thumb, &jpeg.Options{Quality: thumbQuality}); err != nil {
			return fmt.Errorf("encode thumbnail: %w", err)
		}
		thumbData = buf.Bytes()
	}

	// Upload thumbnail
	thumbKey := fmt.Sprintf("thumbnails/%s/%s_thumb.jpg", payload.UserID, payload.FileID)
	if err := p.store.Upload(ctx, p.store.BucketThumbs(), thumbKey, bytes.NewReader(thumbData), "image/jpeg", int64(len(thumbData))); err != nil {
		return fmt.Errorf("upload thumbnail: %w", err)
	}

	// Update file record
	if err := p.updateThumbnailKey(ctx, payload.FileID, thumbKey); err != nil {
		return fmt.Errorf("update thumbnail key: %w", err)
	}

	slog.Info("thumbnail generated", "file_id", payload.FileID, "key", thumbKey, "type", payload.MimeType)
	return nil
}

// extractVideoFrame uses ffmpeg to grab a frame at 1 second and return JPEG bytes.
func (p *Processor) extractVideoFrame(videoData []byte) ([]byte, error) {
	tmpDir, err := os.MkdirTemp("", "bytebox-thumb-*")
	if err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	inputPath := filepath.Join(tmpDir, "input.mp4")
	outputPath := filepath.Join(tmpDir, "thumb.jpg")

	if err := os.WriteFile(inputPath, videoData, 0600); err != nil {
		return nil, fmt.Errorf("write temp video: %w", err)
	}

	// Extract frame at 1s, scale to max 400px width, JPEG quality ~80
	cmd := exec.Command("ffmpeg",
		"-i", inputPath,
		"-ss", "1",
		"-vframes", "1",
		"-vf", fmt.Sprintf("scale='min(%d,iw)':-1", thumbMaxWidth),
		"-q:v", "5",
		"-y",
		outputPath,
	)
	cmd.Stderr = io.Discard
	cmd.Stdout = io.Discard

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("ffmpeg: %w", err)
	}

	return os.ReadFile(outputPath)
}

func (p *Processor) HandleCleanupTrash(ctx context.Context, t *asynq.Task) error {
	slog.Info("running trash cleanup")

	// Get files trashed more than 30 days ago
	query := `
		SELECT id, user_id, storage_key, thumbnail_key, size, stream_video_id
		FROM files
		WHERE trashed_at IS NOT NULL AND trashed_at < NOW() - INTERVAL '30 days'
		LIMIT 100`

	rows, err := p.db.Query(ctx, query)
	if err != nil {
		return fmt.Errorf("query trashed files: %w", err)
	}
	defer rows.Close()

	deleted := 0
	for rows.Next() {
		var id, userID uuid.UUID
		var storageKey, thumbnailKey, streamVideoID string
		var size int64

		if err := rows.Scan(&id, &userID, &storageKey, &thumbnailKey, &size, &streamVideoID); err != nil {
			slog.Error("scan trashed file", "error", err)
			continue
		}

		// Delete from storage
		if err := p.store.Delete(ctx, p.store.BucketFiles(), storageKey); err != nil {
			slog.Error("delete file from storage", "key", storageKey, "error", err)
		}
		if thumbnailKey != "" {
			p.store.Delete(ctx, p.store.BucketThumbs(), thumbnailKey)
		}
		// Delete from Cloudflare Stream if applicable
		if streamVideoID != "" && p.stream != nil {
			if err := p.stream.DeleteVideo(ctx, streamVideoID); err != nil {
				slog.Error("delete video from cloudflare stream", "video_uid", streamVideoID, "error", err)
			}
		}

		// Delete from DB
		_, err := p.db.Exec(ctx, `DELETE FROM files WHERE id = $1`, id)
		if err != nil {
			slog.Error("delete file from db", "error", err)
			continue
		}

		// Update storage (user + global pool)
		p.db.Exec(ctx, `UPDATE users SET storage_used = storage_used - $1 WHERE id = $2`, size, userID)
		p.db.Exec(ctx, `UPDATE storage_pool SET used_capacity = used_capacity - $1, updated_at = NOW() WHERE id = 1`, size)
		deleted++
	}

	// Also delete trashed folders older than 30 days
	p.db.Exec(ctx, `DELETE FROM folders WHERE trashed_at IS NOT NULL AND trashed_at < NOW() - INTERVAL '30 days'`)

	slog.Info("trash cleanup complete", "deleted", deleted)
	return nil
}

func (p *Processor) HandleExpireUploads(ctx context.Context, t *asynq.Task) error {
	slog.Info("running upload session cleanup")

	query := `
		SELECT id, storage_key, storage_upload_id
		FROM upload_sessions
		WHERE status = 'active' AND expires_at < NOW()
		LIMIT 100`

	rows, err := p.db.Query(ctx, query)
	if err != nil {
		return fmt.Errorf("query expired sessions: %w", err)
	}
	defer rows.Close()

	cleaned := 0
	for rows.Next() {
		var id uuid.UUID
		var storageKey, storageUploadID string

		if err := rows.Scan(&id, &storageKey, &storageUploadID); err != nil {
			slog.Error("scan expired session", "error", err)
			continue
		}

		// Abort multipart upload
		if storageUploadID != "" {
			p.store.AbortMultipartUpload(ctx, p.store.BucketFiles(), storageKey, storageUploadID)
		}

		// Delete session
		p.db.Exec(ctx, `UPDATE upload_sessions SET status = 'expired' WHERE id = $1`, id)
		p.db.Exec(ctx, `DELETE FROM upload_sessions WHERE id = $1`, id)
		cleaned++
	}

	slog.Info("upload cleanup complete", "cleaned", cleaned)
	return nil
}

func (p *Processor) HandleTranscodeVideo(ctx context.Context, t *asynq.Task) error {
	var payload TranscodeVideoPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	slog.Info("starting video transcode", "file_id", payload.FileID, "filename", payload.Filename)

	if p.stream == nil {
		slog.Warn("stream client not configured, skipping video transcode", "file_id", payload.FileID)
		return nil
	}

	// Download file from object storage
	data, err := p.downloadFile(ctx, payload.StorageKey)
	if err != nil {
		return fmt.Errorf("download file for transcode: %w", err)
	}

	// Upload to Cloudflare Stream (creates + uploads in one call)
	video, err := p.stream.UploadVideo(ctx, payload.Filename, bytes.NewReader(data), int64(len(data)))
	if err != nil {
		// Mark as failed
		p.db.Exec(ctx, `UPDATE files SET stream_status = 'failed', updated_at = NOW() WHERE id = $1`, payload.FileID)
		return fmt.Errorf("upload to cloudflare stream: %w", err)
	}

	// Update file record with stream_video_id and processing status
	hlsURL := p.stream.GetHLSURL(video.UID)
	thumbURL := p.stream.GetThumbnailURL(video.UID)

	_, err = p.db.Exec(ctx,
		`UPDATE files SET stream_video_id = $1, stream_status = 'processing', hls_url = $2, video_thumbnail_url = $3, updated_at = NOW() WHERE id = $4`,
		video.UID, hlsURL, thumbURL, payload.FileID,
	)
	if err != nil {
		return fmt.Errorf("update video fields: %w", err)
	}

	slog.Info("video uploaded to cloudflare stream", "file_id", payload.FileID, "video_uid", video.UID)
	return nil
}

func (p *Processor) downloadFile(ctx context.Context, key string) ([]byte, error) {
	// Generate a presigned URL and download
	url, err := p.store.PresignGetURL(ctx, p.store.BucketFiles(), key, p.store.PresignExpiry())
	if err != nil {
		return nil, err
	}

	// Use a simple HTTP GET
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()

	// Limit to 50MB for thumbnail processing
	return io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
}

func (p *Processor) updateThumbnailKey(ctx context.Context, fileID uuid.UUID, key string) error {
	_, err := p.db.Exec(ctx, `UPDATE files SET thumbnail_key = $1 WHERE id = $2`, key, fileID)
	return err
}

func (p *Processor) HandleVirusScan(ctx context.Context, t *asynq.Task) error {
	var payload VirusScanPayload
	if err := json.Unmarshal(t.Payload(), &payload); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	slog.Info("starting virus scan", "file_id", payload.FileID)

	// Download file from storage to temp dir
	data, err := p.downloadFile(ctx, payload.StorageKey)
	if err != nil {
		return fmt.Errorf("download file for scan: %w", err)
	}

	tmpDir, err := os.MkdirTemp("", "bytebox-scan-*")
	if err != nil {
		return fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	tmpFile := filepath.Join(tmpDir, "scanfile")
	if err := os.WriteFile(tmpFile, data, 0600); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}

	// Run ClamAV scan
	isClean, virusName, err := p.scanner.ScanFile(ctx, tmpFile)
	if err != nil {
		slog.Error("virus scan error", "file_id", payload.FileID, "error", err)
		return fmt.Errorf("virus scan: %w", err)
	}

	if isClean {
		// Update scan_status to clean
		_, err := p.db.Exec(ctx, `UPDATE files SET scan_status = 'clean' WHERE id = $1`, payload.FileID)
		if err != nil {
			return fmt.Errorf("update scan status: %w", err)
		}
		slog.Info("virus scan clean", "file_id", payload.FileID)
	} else {
		// Quarantine: set trashed_at and update scan_status
		_, err := p.db.Exec(ctx,
			`UPDATE files SET scan_status = 'infected', trashed_at = NOW() WHERE id = $1`,
			payload.FileID,
		)
		if err != nil {
			return fmt.Errorf("quarantine file: %w", err)
		}
		slog.Warn("virus detected, file quarantined",
			"file_id", payload.FileID,
			"virus", virusName,
		)
	}

	return nil
}

func isImageType(mimeType string) bool {
	return strings.HasPrefix(mimeType, "image/") &&
		(strings.Contains(mimeType, "jpeg") ||
			strings.Contains(mimeType, "jpg") ||
			strings.Contains(mimeType, "png") ||
			strings.Contains(mimeType, "gif") ||
			strings.Contains(mimeType, "webp"))
}

// Simple nearest-neighbor resize (no external dep needed for MVP)
func resizeImage(src image.Image, maxW, maxH int) image.Image {
	bounds := src.Bounds()
	w := bounds.Dx()
	h := bounds.Dy()

	if w <= maxW && h <= maxH {
		return src
	}

	ratio := float64(w) / float64(h)
	newW, newH := maxW, maxH

	if float64(maxW)/float64(maxH) > ratio {
		newW = int(float64(maxH) * ratio)
	} else {
		newH = int(float64(maxW) / ratio)
	}

	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	for y := 0; y < newH; y++ {
		for x := 0; x < newW; x++ {
			srcX := x * w / newW
			srcY := y * h / newH
			dst.Set(x, y, src.At(srcX+bounds.Min.X, srcY+bounds.Min.Y))
		}
	}
	return dst
}
