package media

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bytebox/backend/internal/storage"
)

type WebhookHandler struct {
	db     *pgxpool.Pool
	stream *storage.StreamClient
	secret string
}

func NewWebhookHandler(db *pgxpool.Pool, stream *storage.StreamClient, secret string) *WebhookHandler {
	return &WebhookHandler{db: db, stream: stream, secret: secret}
}

type cfStreamWebhookPayload struct {
	UID           string `json:"uid"`
	ReadyToStream bool   `json:"readyToStream"`
	Status        struct {
		State string `json:"state"` // "ready", "error"
	} `json:"status"`
}

func (h *WebhookHandler) Handle(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1024*1024))
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	// Validate webhook signature if secret is configured
	if h.secret != "" {
		sig := r.Header.Get("Webhook-Signature")
		if !verifyCFSignature(body, h.secret, sig) {
			slog.Warn("invalid webhook signature")
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
	}

	var payload cfStreamWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		slog.Error("failed to parse webhook payload", "error", err)
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	slog.Info("cloudflare stream webhook received", "video_uid", payload.UID, "state", payload.Status.State)

	ctx := r.Context()

	switch payload.Status.State {
	case "ready":
		hlsURL := h.stream.GetHLSURL(payload.UID)
		thumbURL := h.stream.GetThumbnailURL(payload.UID)

		_, err := h.db.Exec(ctx,
			`UPDATE files SET stream_status = 'ready', hls_url = $1, video_thumbnail_url = $2, updated_at = NOW()
			 WHERE stream_video_id = $3`,
			hlsURL, thumbURL, payload.UID,
		)
		if err != nil {
			slog.Error("failed to update file after transcode", "video_uid", payload.UID, "error", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		slog.Info("video transcode completed", "video_uid", payload.UID)

	case "error":
		_, err := h.db.Exec(ctx,
			`UPDATE files SET stream_status = 'failed', updated_at = NOW() WHERE stream_video_id = $1`,
			payload.UID,
		)
		if err != nil {
			slog.Error("failed to update file after transcode failure", "video_uid", payload.UID, "error", err)
		}
		slog.Warn("video transcode failed", "video_uid", payload.UID)
	}

	w.WriteHeader(http.StatusOK)
}

// verifyCFSignature validates Cloudflare webhook signatures.
// Cloudflare sends: Webhook-Signature: time={ts},sig1={hex}
// Signing input: "{ts}.{body}"
func verifyCFSignature(body []byte, secret, signature string) bool {
	if signature == "" {
		return false
	}

	var ts, sig string
	for _, part := range strings.Split(signature, ",") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "time=") {
			ts = strings.TrimPrefix(part, "time=")
		} else if strings.HasPrefix(part, "sig1=") {
			sig = strings.TrimPrefix(part, "sig1=")
		}
	}

	if ts == "" || sig == "" {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%s.%s", ts, string(body))))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sig))
}
