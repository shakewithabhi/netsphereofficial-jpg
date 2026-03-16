CREATE TABLE file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    size BIGINT NOT NULL,
    content_hash VARCHAR(64),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(file_id, version_number)
);
CREATE INDEX idx_file_versions_file ON file_versions(file_id);

ALTER TABLE files ADD COLUMN current_version INTEGER NOT NULL DEFAULT 1;
