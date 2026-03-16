-- ByteBox initial schema

-- Users
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100),
    avatar_key      VARCHAR(500),
    storage_used    BIGINT NOT NULL DEFAULT 0,
    storage_limit   BIGINT NOT NULL DEFAULT 5368709120, -- 5GB
    plan            VARCHAR(20) NOT NULL DEFAULT 'free',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_admin        BOOLEAN NOT NULL DEFAULT false,
    email_verified  BOOLEAN NOT NULL DEFAULT false,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Auth sessions
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   VARCHAR(500) UNIQUE NOT NULL,
    device_name     VARCHAR(255),
    device_type     VARCHAR(50),
    ip_address      INET,
    user_agent      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(refresh_token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Folders
CREATE TABLE folders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES folders(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    path            TEXT NOT NULL,
    trashed_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_folders_unique_name
    ON folders(user_id, parent_id, name) WHERE trashed_at IS NULL;
CREATE INDEX idx_folders_user_parent
    ON folders(user_id, parent_id) WHERE trashed_at IS NULL;
CREATE INDEX idx_folders_trashed
    ON folders(user_id, trashed_at) WHERE trashed_at IS NOT NULL;

-- Files
CREATE TABLE files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id       UUID REFERENCES folders(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    storage_key     VARCHAR(500) NOT NULL,
    thumbnail_key   VARCHAR(500),
    size            BIGINT NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    content_hash    VARCHAR(64),
    scan_status     VARCHAR(20) NOT NULL DEFAULT 'pending',
    trashed_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_files_unique_name
    ON files(user_id, folder_id, name) WHERE trashed_at IS NULL;
CREATE INDEX idx_files_user_folder
    ON files(user_id, folder_id) WHERE trashed_at IS NULL;
CREATE INDEX idx_files_trashed
    ON files(user_id, trashed_at) WHERE trashed_at IS NOT NULL;
CREATE INDEX idx_files_content_hash
    ON files(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX idx_files_search
    ON files USING gin(to_tsvector('english', name));

-- Upload sessions
CREATE TABLE upload_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id       UUID REFERENCES folders(id) ON DELETE SET NULL,
    filename        VARCHAR(255) NOT NULL,
    file_size       BIGINT NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    chunk_size      INTEGER NOT NULL,
    total_chunks    INTEGER NOT NULL,
    completed_chunks INTEGER NOT NULL DEFAULT 0,
    r2_upload_id    VARCHAR(500),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_upload_sessions_user
    ON upload_sessions(user_id, status);
CREATE INDEX idx_upload_sessions_expires
    ON upload_sessions(expires_at) WHERE status = 'active';

-- Upload parts
CREATE TABLE upload_parts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    part_number     INTEGER NOT NULL,
    etag            VARCHAR(255) NOT NULL,
    size            BIGINT NOT NULL,
    checksum        VARCHAR(64),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, part_number)
);

-- Shares
CREATE TABLE shares (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id         UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code            VARCHAR(12) UNIQUE NOT NULL,
    password_hash   VARCHAR(255),
    expires_at      TIMESTAMPTZ,
    max_downloads   INTEGER,
    download_count  INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shares_code ON shares(code) WHERE is_active = true;
CREATE INDEX idx_shares_file ON shares(file_id);
CREATE INDEX idx_shares_user ON shares(user_id);

-- Audit logs
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(50) NOT NULL,
    resource_type   VARCHAR(50),
    resource_id     UUID,
    metadata        JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER folders_updated_at BEFORE UPDATE ON folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER upload_sessions_updated_at BEFORE UPDATE ON upload_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
