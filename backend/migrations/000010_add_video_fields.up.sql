ALTER TABLE files ADD COLUMN is_video BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE files ADD COLUMN bunny_video_id VARCHAR(100);
ALTER TABLE files ADD COLUMN stream_status VARCHAR(20);
ALTER TABLE files ADD COLUMN hls_url VARCHAR(500);
ALTER TABLE files ADD COLUMN video_thumbnail_url VARCHAR(500);

CREATE INDEX idx_files_bunny_video ON files(bunny_video_id) WHERE bunny_video_id IS NOT NULL;
CREATE INDEX idx_files_stream_status ON files(stream_status) WHERE stream_status IS NOT NULL;

ALTER TABLE upload_sessions ADD COLUMN is_video BOOLEAN NOT NULL DEFAULT false;
