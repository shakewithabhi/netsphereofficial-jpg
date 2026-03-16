ALTER TABLE users ADD COLUMN totp_secret_encrypted BYTEA;
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN totp_verified_at TIMESTAMPTZ;

CREATE TABLE recovery_codes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash  VARCHAR(64) NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recovery_codes_user ON recovery_codes(user_id) WHERE used_at IS NULL;
