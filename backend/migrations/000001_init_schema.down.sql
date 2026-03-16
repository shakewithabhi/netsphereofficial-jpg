DROP TRIGGER IF EXISTS upload_sessions_updated_at ON upload_sessions;
DROP TRIGGER IF EXISTS files_updated_at ON files;
DROP TRIGGER IF EXISTS folders_updated_at ON folders;
DROP TRIGGER IF EXISTS users_updated_at ON users;
DROP FUNCTION IF EXISTS update_updated_at();

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS shares;
DROP TABLE IF EXISTS upload_parts;
DROP TABLE IF EXISTS upload_sessions;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS folders;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
