-- 002_refine_columns.sql
-- Adds refinement columns to entries. All nullable — existing rows unaffected.
ALTER TABLE entries ADD COLUMN refined_text     TEXT;
ALTER TABLE entries ADD COLUMN refined_status   TEXT;     -- 'reviewed' | 'unchanged' | 'manual'
ALTER TABLE entries ADD COLUMN ph_count_source  INTEGER;  -- {{...}} count in encoded source
ALTER TABLE entries ADD COLUMN ph_count_draft   INTEGER;  -- {{...}} count in encoded draft
ALTER TABLE entries ADD COLUMN ph_count_refined INTEGER;  -- {{...}} count in encoded refined
ALTER TABLE entries ADD COLUMN text_type        TEXT;     -- 'dialogue' | 'item' | 'ui' | 'general'
ALTER TABLE entries ADD COLUMN refined_at       INTEGER;  -- unix timestamp
