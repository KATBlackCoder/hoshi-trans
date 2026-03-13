CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    game_dir    TEXT NOT NULL UNIQUE,
    engine      TEXT NOT NULL,
    game_title  TEXT NOT NULL,
    target_lang TEXT NOT NULL DEFAULT 'en',
    json_path   TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);
-- Note: json_path is NULL when hoshi-trans.json is in game_dir.
-- When game_dir is read-only, json_path stores the fallback location.

CREATE TABLE IF NOT EXISTS entries (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL,
    source_text  TEXT NOT NULL,
    translation  TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',
    context      TEXT,
    file_path    TEXT NOT NULL,
    order_index  INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
-- order_index is CRITICAL for injection — must preserve source file ordering

CREATE INDEX IF NOT EXISTS idx_entries_project_status ON entries(project_id, status);
CREATE INDEX IF NOT EXISTS idx_entries_order ON entries(project_id, file_path, order_index);
