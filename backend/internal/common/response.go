package common

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type Response struct {
	Success bool   `json:"success"`
	Data    any    `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
}

type PaginatedResponse struct {
	Success    bool   `json:"success"`
	Data       any    `json:"data"`
	NextCursor string `json:"next_cursor,omitempty"`
	HasMore    bool   `json:"has_more"`
}

func JSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(Response{
		Success: status >= 200 && status < 300,
		Data:    data,
	}); err != nil {
		slog.Error("failed to encode response", "error", err)
	}
}

func JSONPaginated(w http.ResponseWriter, data any, nextCursor string, hasMore bool) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(PaginatedResponse{
		Success:    true,
		Data:       data,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}); err != nil {
		slog.Error("failed to encode response", "error", err)
	}
}

func JSONError(w http.ResponseWriter, err error) {
	if appErr, ok := err.(*AppError); ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(appErr.Code)
		json.NewEncoder(w).Encode(Response{
			Success: false,
			Error:   appErr.Message,
		})
		return
	}

	slog.Error("unhandled error", "error", err)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	json.NewEncoder(w).Encode(Response{
		Success: false,
		Error:   "internal server error",
	})
}
