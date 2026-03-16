package common

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
)

const (
	DefaultPageSize = 50
	MaxPageSize     = 100
)

type Cursor struct {
	SortValue string `json:"sv"`
	ID        string `json:"id"`
}

func EncodeCursor(sortValue, id string) string {
	c := Cursor{SortValue: sortValue, ID: id}
	data, _ := json.Marshal(c)
	return base64.URLEncoding.EncodeToString(data)
}

func DecodeCursor(encoded string) (*Cursor, error) {
	if encoded == "" {
		return nil, nil
	}

	data, err := base64.URLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("invalid cursor: %w", err)
	}

	var c Cursor
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("invalid cursor: %w", err)
	}

	return &c, nil
}

type PaginationParams struct {
	Cursor string
	Limit  int
	Sort   string
	Order  string
}

func ParsePagination(r *http.Request) PaginationParams {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}

	sort := r.URL.Query().Get("sort")
	if sort == "" {
		sort = "name"
	}

	order := r.URL.Query().Get("order")
	if order != "desc" {
		order = "asc"
	}

	return PaginationParams{
		Cursor: r.URL.Query().Get("cursor"),
		Limit:  limit,
		Sort:   sort,
		Order:  order,
	}
}
