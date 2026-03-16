package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/bytebox/backend/internal/platform/config"
)

const cfStreamBaseURL = "https://api.cloudflare.com/client/v4/accounts"

// StreamClient wraps the Cloudflare Stream API for video transcoding and HLS delivery.
type StreamClient struct {
	httpClient *http.Client
	cfg        config.CFStreamConfig
}

// NewStreamClient creates a new Cloudflare Stream API client.
func NewStreamClient(cfg config.CFStreamConfig) *StreamClient {
	return &StreamClient{
		httpClient: &http.Client{Timeout: 5 * time.Minute},
		cfg:        cfg,
	}
}

// Video represents a Cloudflare Stream video resource.
type Video struct {
	UID           string `json:"uid"`
	ReadyToStream bool   `json:"readyToStream"`
	Status        struct {
		State string `json:"state"`
	} `json:"status"`
	Playback struct {
		HLS  string `json:"hls"`
		Dash string `json:"dash"`
	} `json:"playback"`
	Duration float64 `json:"duration"`
	Created  string  `json:"created"`
	Modified string  `json:"modified"`
}

// cfResponse wraps the Cloudflare API response envelope.
type cfResponse struct {
	Result  Video    `json:"result"`
	Success bool     `json:"success"`
	Errors  []cfError `json:"errors"`
}

type cfError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (c *StreamClient) baseURL() string {
	return fmt.Sprintf("%s/%s/stream", cfStreamBaseURL, c.cfg.AccountID)
}

func (c *StreamClient) setAuth(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+c.cfg.APIToken)
}

// UploadVideo uploads a video to Cloudflare Stream. This creates and uploads in a single call.
func (c *StreamClient) UploadVideo(ctx context.Context, title string, body io.Reader, fileSize int64) (*Video, error) {
	url := c.baseURL()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	if err != nil {
		return nil, fmt.Errorf("create upload request: %w", err)
	}
	c.setAuth(req)
	req.Header.Set("Content-Type", "application/octet-stream")
	req.ContentLength = fileSize

	// Set video name via TUS metadata header
	req.Header.Set("Upload-Metadata", fmt.Sprintf("name %s", title))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("upload video: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("upload video: status %d: %s", resp.StatusCode, string(respBody))
	}

	var cfResp cfResponse
	if err := json.NewDecoder(resp.Body).Decode(&cfResp); err != nil {
		return nil, fmt.Errorf("decode upload response: %w", err)
	}
	if !cfResp.Success {
		return nil, fmt.Errorf("upload video: API error: %v", cfResp.Errors)
	}
	return &cfResp.Result, nil
}

// GetVideo retrieves video metadata from Cloudflare Stream.
func (c *StreamClient) GetVideo(ctx context.Context, videoUID string) (*Video, error) {
	url := fmt.Sprintf("%s/%s", c.baseURL(), videoUID)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("get video request: %w", err)
	}
	c.setAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get video: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("get video: status %d", resp.StatusCode)
	}

	var cfResp cfResponse
	if err := json.NewDecoder(resp.Body).Decode(&cfResp); err != nil {
		return nil, fmt.Errorf("decode get video response: %w", err)
	}
	return &cfResp.Result, nil
}

// DeleteVideo removes a video from Cloudflare Stream.
func (c *StreamClient) DeleteVideo(ctx context.Context, videoUID string) error {
	url := fmt.Sprintf("%s/%s", c.baseURL(), videoUID)

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("delete video request: %w", err)
	}
	c.setAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("delete video: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("delete video: status %d", resp.StatusCode)
	}
	return nil
}

// GetHLSURL returns the HLS playlist URL for a video.
func (c *StreamClient) GetHLSURL(videoUID string) string {
	return fmt.Sprintf("https://customer-%s.cloudflarestream.com/%s/manifest/video.m3u8", c.cfg.CustomerSubdomain, videoUID)
}

// GetThumbnailURL returns the thumbnail URL for a video.
func (c *StreamClient) GetThumbnailURL(videoUID string) string {
	return fmt.Sprintf("https://customer-%s.cloudflarestream.com/%s/thumbnails/thumbnail.jpg", c.cfg.CustomerSubdomain, videoUID)
}
