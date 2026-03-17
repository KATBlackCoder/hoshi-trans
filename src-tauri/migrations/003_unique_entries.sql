-- Remove duplicate entries keeping the one with the lowest rowid
-- (duplicates occur when extraction is run multiple times on the same project)
DELETE FROM entries WHERE rowid NOT IN (
    SELECT MIN(rowid) FROM entries GROUP BY project_id, file_path, order_index
);

-- Enforce uniqueness: one entry per (project, file, position)
-- INSERT OR IGNORE in insert_entries_batch will silently skip re-extractions
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_unique_position
    ON entries(project_id, file_path, order_index);
