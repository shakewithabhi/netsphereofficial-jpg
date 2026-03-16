ALTER TABLE files RENAME COLUMN stream_video_id TO bunny_video_id;
DROP INDEX IF EXISTS idx_files_stream_video;
CREATE INDEX idx_files_bunny_video ON files(bunny_video_id) WHERE bunny_video_id IS NOT NULL;
