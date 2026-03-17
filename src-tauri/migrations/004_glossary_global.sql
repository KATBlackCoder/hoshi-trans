-- Recreate glossary table with nullable project_id (NULL = global) and target_lang
ALTER TABLE glossary RENAME TO glossary_old;

CREATE TABLE glossary (
    id          TEXT PRIMARY KEY,
    project_id  TEXT,
    source_term TEXT NOT NULL,
    target_term TEXT NOT NULL,
    target_lang TEXT NOT NULL DEFAULT 'en',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Migrate existing data (all were project-scoped, assign default lang 'en')
INSERT INTO glossary (id, project_id, source_term, target_term, target_lang)
SELECT id, project_id, source_term, target_term, 'en' FROM glossary_old;

DROP TABLE glossary_old;

-- Global terms: unique per (source_term, target_lang) when project_id IS NULL
CREATE UNIQUE INDEX idx_glossary_global
    ON glossary(source_term, target_lang)
    WHERE project_id IS NULL;

-- Project terms: unique per (project_id, source_term, target_lang)
CREATE UNIQUE INDEX idx_glossary_project
    ON glossary(project_id, source_term, target_lang)
    WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_glossary_lookup ON glossary(project_id, target_lang);
