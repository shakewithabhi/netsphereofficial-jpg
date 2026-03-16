ALTER TABLE shares ADD COLUMN folder_id UUID REFERENCES folders(id);
ALTER TABLE shares ALTER COLUMN file_id DROP NOT NULL;
ALTER TABLE shares ADD COLUMN share_type VARCHAR(10) NOT NULL DEFAULT 'file';
-- share_type: 'file' or 'folder'
ALTER TABLE shares ADD CONSTRAINT shares_target_check CHECK (
    (share_type = 'file' AND file_id IS NOT NULL) OR
    (share_type = 'folder' AND folder_id IS NOT NULL)
);
CREATE INDEX idx_shares_folder ON shares(folder_id);
