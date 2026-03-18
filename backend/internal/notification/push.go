package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
)

// PushSender is an interface for sending push notifications to devices.
type PushSender interface {
	SendPush(ctx context.Context, tokens []string, title, message string, data map[string]interface{}) error
}

// FCMSender sends push notifications via Firebase Cloud Messaging.
type FCMSender struct {
	serverKey string
}

// NewFCMSender creates a new FCMSender. If serverKey is empty, SendPush is a no-op.
func NewFCMSender(serverKey string) *FCMSender {
	return &FCMSender{serverKey: serverKey}
}

func (f *FCMSender) SendPush(ctx context.Context, tokens []string, title, message string, data map[string]interface{}) error {
	if f.serverKey == "" || len(tokens) == 0 {
		return nil
	}

	// FCM HTTP v1 API
	for _, token := range tokens {
		payload := map[string]interface{}{
			"to": token,
			"notification": map[string]string{
				"title": title,
				"body":  message,
			},
			"data": data,
		}

		body, err := json.Marshal(payload)
		if err != nil {
			slog.Error("failed to marshal FCM payload", "error", err)
			continue
		}

		req, err := http.NewRequestWithContext(ctx, "POST", "https://fcm.googleapis.com/fcm/send", bytes.NewReader(body))
		if err != nil {
			slog.Error("failed to create FCM request", "error", err)
			continue
		}
		req.Header.Set("Authorization", "key="+f.serverKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			slog.Error("failed to send FCM push", "error", err)
			continue
		}
		resp.Body.Close()
	}
	return nil
}
