package search

import (
	"context"
	"fmt"
	"strings"

	"github.com/meilisearch/meilisearch-go"
)

type MeiliClient struct {
	client meilisearch.ServiceManager
	index  meilisearch.IndexManager
}

func NewMeiliClient(host, apiKey string) (*MeiliClient, error) {
	client := meilisearch.New(host, meilisearch.WithAPIKey(apiKey))

	// Create or get the files index
	_, err := client.CreateIndex(&meilisearch.IndexConfig{
		Uid:        "files",
		PrimaryKey: "id",
	})
	// Ignore error if index already exists
	_ = err

	index := client.Index("files")

	// Configure searchable and filterable attributes
	_, err = index.UpdateSearchableAttributes(&[]string{"name", "mime_type"})
	if err != nil {
		return nil, fmt.Errorf("update searchable attributes: %w", err)
	}

	_, err = index.UpdateFilterableAttributes(&[]string{"user_id", "folder_id", "mime_type", "trashed"})
	if err != nil {
		return nil, fmt.Errorf("update filterable attributes: %w", err)
	}

	_, err = index.UpdateSortableAttributes(&[]string{"created_at", "size", "name"})
	if err != nil {
		return nil, fmt.Errorf("update sortable attributes: %w", err)
	}

	return &MeiliClient{client: client, index: index}, nil
}

// IndexFile adds or updates a single document in the search index.
func (m *MeiliClient) IndexFile(ctx context.Context, doc FileDocument) error {
	_, err := m.index.AddDocuments([]FileDocument{doc}, "id")
	if err != nil {
		return fmt.Errorf("index file: %w", err)
	}
	return nil
}

// DeleteFile removes a document from the search index by file ID.
func (m *MeiliClient) DeleteFile(ctx context.Context, fileID string) error {
	_, err := m.index.DeleteDocument(fileID)
	if err != nil {
		return fmt.Errorf("delete file from index: %w", err)
	}
	return nil
}

// Search performs a full-text search scoped to a user with optional filters.
func (m *MeiliClient) Search(ctx context.Context, userID, query string, filters SearchFilters) (*SearchResult, error) {
	// Build filter conditions
	filterParts := []string{
		fmt.Sprintf("user_id = \"%s\"", userID),
		"trashed = false",
	}

	if filters.MimeType != "" {
		filterParts = append(filterParts, fmt.Sprintf("mime_type = \"%s\"", filters.MimeType))
	}
	if filters.FolderID != "" {
		filterParts = append(filterParts, fmt.Sprintf("folder_id = \"%s\"", filters.FolderID))
	}
	if filters.MinSize > 0 {
		filterParts = append(filterParts, fmt.Sprintf("size >= %d", filters.MinSize))
	}
	if filters.MaxSize > 0 {
		filterParts = append(filterParts, fmt.Sprintf("size <= %d", filters.MaxSize))
	}

	filterStr := strings.Join(filterParts, " AND ")

	// Build sort
	var sort []string
	if filters.Sort != "" {
		sort = []string{filters.Sort}
	}

	searchReq := &meilisearch.SearchRequest{
		Filter: filterStr,
		Sort:   sort,
		Limit:  50,
	}

	resp, err := m.index.Search(query, searchReq)
	if err != nil {
		return nil, fmt.Errorf("meilisearch search: %w", err)
	}

	hits := make([]FileDocument, 0, len(resp.Hits))
	for _, hit := range resp.Hits {
		doc, ok := hit.(map[string]interface{})
		if !ok {
			continue
		}
		fd := mapToFileDocument(doc)
		hits = append(hits, fd)
	}

	return &SearchResult{
		Hits:             hits,
		TotalHits:        resp.EstimatedTotalHits,
		ProcessingTimeMs: resp.ProcessingTimeMs,
		Query:            query,
	}, nil
}

// BulkIndex adds or updates multiple documents in the search index.
func (m *MeiliClient) BulkIndex(ctx context.Context, docs []FileDocument) error {
	if len(docs) == 0 {
		return nil
	}
	_, err := m.index.AddDocuments(docs, "id")
	if err != nil {
		return fmt.Errorf("bulk index: %w", err)
	}
	return nil
}

func mapToFileDocument(doc map[string]interface{}) FileDocument {
	fd := FileDocument{}

	if v, ok := doc["id"].(string); ok {
		fd.ID = v
	}
	if v, ok := doc["user_id"].(string); ok {
		fd.UserID = v
	}
	if v, ok := doc["folder_id"].(string); ok {
		fd.FolderID = v
	}
	if v, ok := doc["name"].(string); ok {
		fd.Name = v
	}
	if v, ok := doc["mime_type"].(string); ok {
		fd.MimeType = v
	}
	if v, ok := doc["size"].(float64); ok {
		fd.Size = int64(v)
	}
	if v, ok := doc["trashed"].(bool); ok {
		fd.Trashed = v
	}

	return fd
}
