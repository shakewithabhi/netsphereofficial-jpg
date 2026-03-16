package common

import (
	"fmt"
	"net/http"
)

type AppError struct {
	Code    int    `json:"-"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

func (e *AppError) Error() string {
	return fmt.Sprintf("%d: %s", e.Code, e.Message)
}

func ErrBadRequest(msg string) *AppError {
	return &AppError{Code: http.StatusBadRequest, Message: msg}
}

func ErrUnauthorized(msg string) *AppError {
	return &AppError{Code: http.StatusUnauthorized, Message: msg}
}

func ErrForbidden(msg string) *AppError {
	return &AppError{Code: http.StatusForbidden, Message: msg}
}

func ErrNotFound(msg string) *AppError {
	return &AppError{Code: http.StatusNotFound, Message: msg}
}

func ErrConflict(msg string) *AppError {
	return &AppError{Code: http.StatusConflict, Message: msg}
}

func ErrTooLarge(msg string) *AppError {
	return &AppError{Code: http.StatusRequestEntityTooLarge, Message: msg}
}

func ErrTooManyRequests(msg string) *AppError {
	return &AppError{Code: http.StatusTooManyRequests, Message: msg}
}

func ErrInternal(msg string) *AppError {
	return &AppError{Code: http.StatusInternalServerError, Message: msg}
}
