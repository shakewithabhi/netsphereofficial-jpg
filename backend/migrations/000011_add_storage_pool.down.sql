ALTER TABLE users DROP COLUMN IF EXISTS storage_warning_sent;
ALTER TABLE users DROP COLUMN IF EXISTS soft_storage_limit;
DROP TABLE IF EXISTS storage_pool;
