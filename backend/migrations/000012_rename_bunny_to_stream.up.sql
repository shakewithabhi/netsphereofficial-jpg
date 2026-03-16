ALTER TABLE files RENAME COLUMN bunny_video_id TO stream_video_id;
DROP INDEX IF EXISTS idx_files_bunny_video;
CREATE INDEX idx_files_stream_video ON files(stream_video_id) WHERE stream_video_id IS NOT NULL;
