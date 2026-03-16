CREATE INDEX idx_files_mime_type ON files(user_id, mime_type) WHERE trashed_at IS NULL;
