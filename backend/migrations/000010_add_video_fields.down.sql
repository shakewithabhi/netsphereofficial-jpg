ALTER TABLE upload_sessions DROP COLUMN IF EXISTS is_video;

DROP INDEX IF EXISTS idx_files_stream_status;
DROP INDEX IF EXISTS idx_files_bunny_video;

ALTER TABLE files DROP COLUMN IF EXISTS video_thumbnail_url;
ALTER TABLE files DROP COLUMN IF EXISTS hls_url;
ALTER TABLE files DROP COLUMN IF EXISTS stream_status;
ALTER TABLE files DROP COLUMN IF EXISTS bunny_video_id;
ALTER TABLE files DROP COLUMN IF EXISTS is_video;
