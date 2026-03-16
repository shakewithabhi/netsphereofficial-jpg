package scanner

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"
)

type ClamAVScanner struct {
	enabled bool
}

func NewClamAVScanner(enabled bool) *ClamAVScanner {
	return &ClamAVScanner{enabled: enabled}
}

// ScanFile scans a file at the given path and returns (isClean, virusName, error).
func (s *ClamAVScanner) ScanFile(ctx context.Context, filePath string) (bool, string, error) {
	if !s.enabled {
		return true, "", nil
	}

	cmd := exec.CommandContext(ctx, "clamdscan", "--no-summary", filePath)
	output, err := cmd.CombinedOutput()

	result := strings.TrimSpace(string(output))
	slog.Info("clamav scan result", "file", filePath, "result", result)

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			if exitErr.ExitCode() == 1 {
				// Virus found
				parts := strings.SplitN(result, ":", 2)
				virusName := "unknown"
				if len(parts) > 1 {
					virusName = strings.TrimSpace(strings.TrimSuffix(parts[1], "FOUND"))
				}
				return false, virusName, nil
			}
		}
		return false, "", fmt.Errorf("clamav scan error: %w", err)
	}

	return true, "", nil
}
