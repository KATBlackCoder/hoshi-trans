CREATE TABLE IF NOT EXISTS glossary_global_usage (
    global_term_id TEXT NOT NULL,
    project_id     TEXT NOT NULL,
    used_at        TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (global_term_id, project_id),
    FOREIGN KEY (global_term_id) REFERENCES glossary(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id)     REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_global_usage_project ON glossary_global_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_global_usage_term    ON glossary_global_usage(global_term_id);
