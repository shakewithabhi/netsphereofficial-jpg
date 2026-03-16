CREATE TABLE storage_pool (
    id             INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    total_capacity BIGINT NOT NULL DEFAULT 10737418240000,  -- 10TB
    used_capacity  BIGINT NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO storage_pool (id, total_capacity, used_capacity)
VALUES (1, 10737418240000, COALESCE((SELECT SUM(storage_used) FROM users), 0));

ALTER TABLE users ADD COLUMN soft_storage_limit BIGINT;
ALTER TABLE users ADD COLUMN storage_warning_sent BOOLEAN NOT NULL DEFAULT false;
