ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'email';
CREATE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
