CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (key, value) VALUES
    ('default_storage_limit_free', '5368709120'),
    ('default_storage_limit_pro', '53687091200'),
    ('default_storage_limit_premium', '214748364800'),
    ('max_upload_size_mb', '500'),
    ('maintenance_mode', 'false'),
    ('require_approval', 'false'),
    ('allow_registration', 'true')
ON CONFLICT (key) DO NOTHING;
