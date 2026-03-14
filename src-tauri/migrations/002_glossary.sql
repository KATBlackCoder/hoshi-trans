CREATE TABLE IF NOT EXISTS glossary (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL,
    source_term TEXT NOT NULL,
    target_term TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, source_term)
);

CREATE INDEX IF NOT EXISTS idx_glossary_project ON glossary(project_id);
