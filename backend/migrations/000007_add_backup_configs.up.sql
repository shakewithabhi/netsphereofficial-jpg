CREATE TABLE backup_configs (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    enabled BOOLEAN NOT NULL DEFAULT false,
    folder_id UUID REFERENCES folders(id),
    wifi_only BOOLEAN NOT NULL DEFAULT true,
    include_videos BOOLEAN NOT NULL DEFAULT true,
    last_backup_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
