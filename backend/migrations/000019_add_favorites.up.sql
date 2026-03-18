CREATE TABLE file_stars (
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    starred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (file_id, user_id)
);
CREATE INDEX idx_file_stars_user ON file_stars(user_id, starred_at DESC);
