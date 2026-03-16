DROP TABLE IF EXISTS recovery_codes;
ALTER TABLE users DROP COLUMN IF EXISTS totp_secret_encrypted;
ALTER TABLE users DROP COLUMN IF EXISTS totp_enabled;
ALTER TABLE users DROP COLUMN IF EXISTS totp_verified_at;
