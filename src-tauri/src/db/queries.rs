use sqlx::SqlitePool;

pub async fn create_project(
    pool: &SqlitePool,
    id: &str,
    game_dir: &str,
    engine: &str,
    game_title: &str,
    target_lang: &str,
    json_path: Option<&str>,
) -> anyhow::Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;
    sqlx::query(
        "INSERT INTO projects (id, game_dir, engine, game_title, target_lang, json_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(game_dir)
    .bind(engine)
    .bind(game_title)
    .bind(target_lang)
    .bind(json_path)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;
    Ok(())
}

/// Returns projects with entry counts — used for the project library view.
pub async fn get_projects_with_stats(
    pool: &SqlitePool,
) -> anyhow::Result<Vec<(String, String, String, String, String, i64, i64)>> {
    // (id, game_dir, game_title, engine, target_lang, total, translated)
    let rows: Vec<(String, String, String, String, String, i64, i64)> = sqlx::query_as(
        "SELECT p.id, p.game_dir, p.game_title, p.engine, p.target_lang,
                COUNT(e.id) AS total,
                SUM(CASE WHEN e.status = 'translated' THEN 1 ELSE 0 END) AS translated
         FROM projects p
         LEFT JOIN entries e ON e.project_id = p.id
         GROUP BY p.id
         ORDER BY p.updated_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Returns (id, game_dir, engine, game_title, target_lang, json_path)
pub async fn get_projects(
    pool: &SqlitePool,
) -> anyhow::Result<Vec<(String, String, String, String, String, Option<String>)>> {
    let rows: Vec<(String, String, String, String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, game_dir, engine, game_title, target_lang, json_path FROM projects ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get_project_by_game_dir(
    pool: &SqlitePool,
    game_dir: &str,
) -> anyhow::Result<Option<(String, String, String, String, Option<String>)>> {
    let row: Option<(String, String, String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, engine, game_title, target_lang, json_path FROM projects WHERE game_dir = ?",
    )
    .bind(game_dir)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn get_project_engine_by_id(
    pool: &SqlitePool,
    project_id: &str,
) -> anyhow::Result<Option<String>> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT engine FROM projects WHERE id = ?")
            .bind(project_id)
            .fetch_optional(pool)
            .await?;
    Ok(row.map(|(e,)| e))
}

pub async fn insert_entries_batch(
    pool: &SqlitePool,
    entries: &[crate::models::TranslationEntry],
) -> anyhow::Result<()> {
    let mut tx = pool.begin().await?;
    for entry in entries {
        sqlx::query(
            "INSERT OR IGNORE INTO entries
             (id, project_id, source_text, status, context, file_path, order_index)
             VALUES (?, ?, ?, 'pending', ?, ?, ?)",
        )
        .bind(&entry.id)
        .bind(&entry.project_id)
        .bind(&entry.source_text)
        .bind(&entry.context)
        .bind(&entry.file_path)
        .bind(entry.order_index)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn get_entries(
    pool: &SqlitePool,
    project_id: &str,
    status_filter: Option<&str>,
    file_filter: Option<&str>,
) -> anyhow::Result<Vec<crate::models::TranslationEntry>> {
    let rows: Vec<crate::models::TranslationEntry> = sqlx::query_as(
        "SELECT id, project_id, source_text, translation, status, context, file_path, order_index
         FROM entries
         WHERE project_id = ?
         AND (? IS NULL OR status = ?)
         AND (? IS NULL OR file_path = ?)
         ORDER BY file_path, order_index",
    )
    .bind(project_id)
    .bind(status_filter)
    .bind(status_filter)
    .bind(file_filter)
    .bind(file_filter)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn update_translation(
    pool: &SqlitePool,
    entry_id: &str,
    translation: &str,
    status: &str,
) -> anyhow::Result<()> {
    sqlx::query("UPDATE entries SET translation = ?, status = ? WHERE id = ?")
        .bind(translation)
        .bind(status)
        .bind(entry_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Reset entries that were "translated" but with an empty translation back to pending.
/// Returns the number of entries reset.
pub async fn reset_empty_translations(
    pool: &SqlitePool,
    project_id: &str,
) -> anyhow::Result<u32> {
    let result = sqlx::query(
        "UPDATE entries SET status = 'pending', translation = NULL
         WHERE project_id = ? AND status = 'translated' AND (translation IS NULL OR translation = '')",
    )
    .bind(project_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() as u32)
}

pub async fn update_status(pool: &SqlitePool, entry_id: &str, status: &str) -> anyhow::Result<()> {
    sqlx::query("UPDATE entries SET status = ? WHERE id = ?")
        .bind(status)
        .bind(entry_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_project(pool: &SqlitePool, project_id: &str) -> anyhow::Result<()> {
    // ON DELETE CASCADE handles entries automatically
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(project_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_translated_entries_ordered(
    pool: &SqlitePool,
    project_id: &str,
) -> anyhow::Result<Vec<crate::models::TranslationEntry>> {
    let rows: Vec<crate::models::TranslationEntry> = sqlx::query_as(
        "SELECT id, project_id, source_text, translation, status, context, file_path, order_index
         FROM entries
         WHERE project_id = ?
         AND status IN ('translated', 'reviewed', 'warning')
         ORDER BY file_path, order_index",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get_pending_entries(
    pool: &SqlitePool,
    project_id: &str,
) -> anyhow::Result<Vec<crate::models::TranslationEntry>> {
    get_entries(pool, project_id, Some("pending"), None).await
}

/// Fetch all glossary terms across all projects and global (for the Glossary page).
pub async fn get_all_glossary_terms(
    pool: &SqlitePool,
) -> anyhow::Result<Vec<crate::models::GlossaryTerm>> {
    let rows = sqlx::query_as::<_, crate::models::GlossaryTerm>(
        "SELECT id, project_id, source_term, target_term, target_lang
         FROM glossary
         ORDER BY source_term, target_lang",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Fetch glossary terms for translation: global terms + project-specific terms for the
/// given target_lang, with project terms taking priority over global ones.
pub async fn get_glossary_for_translation(
    pool: &SqlitePool,
    project_id: &str,
    target_lang: &str,
) -> anyhow::Result<Vec<crate::models::GlossaryTerm>> {
    // Fetch global first (NULL project_id), then project-specific — project overrides global
    let rows = sqlx::query_as::<_, crate::models::GlossaryTerm>(
        "SELECT id, project_id, source_term, target_term, target_lang
         FROM glossary
         WHERE (project_id = ? OR project_id IS NULL)
           AND target_lang = ?
         ORDER BY project_id NULLS FIRST, source_term",
    )
    .bind(project_id)
    .bind(target_lang)
    .fetch_all(pool)
    .await?;

    // Deduplicate: project-specific overrides global for same source_term
    let mut map: std::collections::HashMap<String, crate::models::GlossaryTerm> =
        std::collections::HashMap::new();
    for term in rows {
        map.insert(term.source_term.clone(), term);
    }
    let mut result: Vec<crate::models::GlossaryTerm> = map.into_values().collect();
    result.sort_by(|a, b| a.source_term.cmp(&b.source_term));
    Ok(result)
}

pub async fn upsert_glossary_term(
    pool: &SqlitePool,
    id: &str,
    project_id: Option<&str>,
    source_term: &str,
    target_term: &str,
    target_lang: &str,
) -> anyhow::Result<()> {
    match project_id {
        None => {
            // Global term — conflict on (source_term, target_lang) WHERE project_id IS NULL
            sqlx::query(
                "INSERT INTO glossary (id, project_id, source_term, target_term, target_lang)
                 VALUES (?, NULL, ?, ?, ?)
                 ON CONFLICT(source_term, target_lang) WHERE project_id IS NULL DO UPDATE SET
                   id = excluded.id,
                   target_term = excluded.target_term",
            )
            .bind(id)
            .bind(source_term)
            .bind(target_term)
            .bind(target_lang)
            .execute(pool)
            .await?;
        }
        Some(pid) => {
            // Project-scoped term — conflict on (project_id, source_term, target_lang)
            sqlx::query(
                "INSERT INTO glossary (id, project_id, source_term, target_term, target_lang)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(project_id, source_term, target_lang) WHERE project_id IS NOT NULL DO UPDATE SET
                   id = excluded.id,
                   target_term = excluded.target_term",
            )
            .bind(id)
            .bind(pid)
            .bind(source_term)
            .bind(target_term)
            .bind(target_lang)
            .execute(pool)
            .await?;
        }
    }
    Ok(())
}

pub async fn delete_glossary_term(pool: &SqlitePool, id: &str) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM glossary WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

#[cfg(test)]
mod glossary_tests {
    use super::*;
    use crate::db::init_pool;

    async fn setup() -> (sqlx::SqlitePool, String, tempfile::TempDir) {
        let dir = tempfile::tempdir().unwrap();
        let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();
        sqlx::query(
            "INSERT INTO projects (id, game_dir, engine, game_title, target_lang, created_at, updated_at)
             VALUES ('p1', '/g', 'rpgmaker_mv_mz', 'Test', 'en', 0, 0)",
        )
        .execute(&pool)
        .await
        .unwrap();
        (pool, "p1".to_string(), dir)
    }

    #[tokio::test]
    async fn test_upsert_project_term_and_get_all() {
        let (pool, pid, _dir) = setup().await;
        upsert_glossary_term(&pool, "id1", Some(&pid), "羽鳥", "Hatori", "en")
            .await
            .unwrap();
        upsert_glossary_term(&pool, "id2", Some(&pid), "六花", "Rikka", "en")
            .await
            .unwrap();
        let terms = get_all_glossary_terms(&pool).await.unwrap();
        assert_eq!(terms.len(), 2);
        assert!(terms.iter().any(|t| t.source_term == "羽鳥" && t.target_term == "Hatori"));
    }

    #[tokio::test]
    async fn test_upsert_global_term() {
        let (pool, _pid, _dir) = setup().await;
        upsert_glossary_term(&pool, "g1", None, "魔法", "magic", "en")
            .await
            .unwrap();
        let terms = get_all_glossary_terms(&pool).await.unwrap();
        assert_eq!(terms.len(), 1);
        assert!(terms[0].project_id.is_none());
    }

    #[tokio::test]
    async fn test_project_overrides_global_in_translation() {
        let (pool, pid, _dir) = setup().await;
        // Global: 六花 → Rikka
        upsert_glossary_term(&pool, "g1", None, "六花", "Rikka", "en").await.unwrap();
        // Project-specific override: 六花 → Rokka
        upsert_glossary_term(&pool, "p1", Some(&pid), "六花", "Rokka", "en").await.unwrap();
        let terms = get_glossary_for_translation(&pool, &pid, "en").await.unwrap();
        assert_eq!(terms.len(), 1);
        assert_eq!(terms[0].target_term, "Rokka");
    }

    #[tokio::test]
    async fn test_global_appears_in_all_projects() {
        let (pool, pid, _dir) = setup().await;
        upsert_glossary_term(&pool, "g1", None, "魔法", "magic", "en").await.unwrap();
        let terms = get_glossary_for_translation(&pool, &pid, "en").await.unwrap();
        assert_eq!(terms.len(), 1);
        assert_eq!(terms[0].source_term, "魔法");
    }

    #[tokio::test]
    async fn test_upsert_overwrites_existing_project() {
        let (pool, pid, _dir) = setup().await;
        upsert_glossary_term(&pool, "id1", Some(&pid), "羽鳥", "Hatori", "en").await.unwrap();
        upsert_glossary_term(&pool, "id1", Some(&pid), "羽鳥", "Hatori2", "en").await.unwrap();
        let terms = get_all_glossary_terms(&pool).await.unwrap();
        assert_eq!(terms.len(), 1);
        assert_eq!(terms[0].target_term, "Hatori2");
    }

    #[tokio::test]
    async fn test_different_target_lang_not_duplicate() {
        let (pool, _pid, _dir) = setup().await;
        upsert_glossary_term(&pool, "g1", None, "六花", "Rikka", "en").await.unwrap();
        upsert_glossary_term(&pool, "g2", None, "六花", "Rikka", "fr").await.unwrap();
        let terms = get_all_glossary_terms(&pool).await.unwrap();
        assert_eq!(terms.len(), 2);
    }

    #[tokio::test]
    async fn test_delete_glossary_term() {
        let (pool, pid, _dir) = setup().await;
        upsert_glossary_term(&pool, "id1", Some(&pid), "羽鳥", "Hatori", "en").await.unwrap();
        delete_glossary_term(&pool, "id1").await.unwrap();
        let terms = get_all_glossary_terms(&pool).await.unwrap();
        assert_eq!(terms.len(), 0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_pool;

    #[tokio::test]
    async fn test_create_and_get_project() {
        let dir = tempfile::tempdir().unwrap();
        let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();

        create_project(
            &pool,
            "proj-1",
            "/games/mygame",
            "rpgmaker_mv_mz",
            "My Game",
            "en",
            None,
        )
        .await
        .unwrap();

        let projects = get_projects(&pool).await.unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].0, "proj-1");
    }

    #[tokio::test]
    async fn test_insert_entries_batch() {
        let dir = tempfile::tempdir().unwrap();
        let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();

        create_project(
            &pool,
            "proj-1",
            "/game",
            "rpgmaker_mv_mz",
            "Test",
            "en",
            None,
        )
        .await
        .unwrap();

        let entries = vec![crate::models::TranslationEntry {
            id: "e1".into(),
            project_id: "proj-1".into(),
            source_text: "こんにちは".into(),
            translation: None,
            status: "pending".into(),
            context: None,
            file_path: "data/Map001.json".into(),
            order_index: 0,
        }];

        insert_entries_batch(&pool, &entries).await.unwrap();

        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM entries WHERE project_id = 'proj-1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(count.0, 1);
    }

    #[tokio::test]
    async fn test_get_entries_filtered_by_status() {
        let dir = tempfile::tempdir().unwrap();
        let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();
        create_project(&pool, "p1", "/g", "rpgmaker_mv_mz", "T", "en", None)
            .await
            .unwrap();

        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, status, file_path, order_index) VALUES ('e1','p1','こんにちは','pending','f',0)"
        ).execute(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, status, file_path, order_index) VALUES ('e2','p1','ありがとう','translated','f',1)"
        ).execute(&pool).await.unwrap();

        let pending = get_entries(&pool, "p1", Some("pending"), None)
            .await
            .unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].source_text, "こんにちは");

        let all = get_entries(&pool, "p1", None, None).await.unwrap();
        assert_eq!(all.len(), 2);
    }

    #[tokio::test]
    async fn test_reset_empty_translations() {
        let dir = tempfile::tempdir().unwrap();
        let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();
        create_project(&pool, "p1", "/g", "rpgmaker_mv_mz", "T", "en", None)
            .await
            .unwrap();

        // e1: translated with real content — must NOT be reset
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index)
             VALUES ('e1','p1','こんにちは','Hello','translated','f',0)"
        ).execute(&pool).await.unwrap();
        // e2: translated with empty string — must be reset to pending
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index)
             VALUES ('e2','p1','ありがとう','','translated','f',1)"
        ).execute(&pool).await.unwrap();
        // e3: translated with NULL translation — must also be reset
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, status, file_path, order_index)
             VALUES ('e3','p1','さようなら','translated','f',2)"
        ).execute(&pool).await.unwrap();
        // e4: pending — must NOT be touched
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, status, file_path, order_index)
             VALUES ('e4','p1','おはよう','pending','f',3)"
        ).execute(&pool).await.unwrap();

        let count = reset_empty_translations(&pool, "p1").await.unwrap();
        assert_eq!(count, 2, "should have reset e2 and e3");

        let pending = get_entries(&pool, "p1", Some("pending"), None).await.unwrap();
        assert_eq!(pending.len(), 3); // e2, e3, e4 are now pending

        let translated = get_entries(&pool, "p1", Some("translated"), None).await.unwrap();
        assert_eq!(translated.len(), 1); // only e1 remains translated
        assert_eq!(translated[0].source_text, "こんにちは");
    }

    #[tokio::test]
    async fn test_insert_entries_batch_no_duplicates() {
        let dir = tempfile::tempdir().unwrap();
        let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();
        create_project(&pool, "p1", "/g", "rpgmaker_mv_mz", "T", "en", None)
            .await
            .unwrap();

        let make_entry = |id: &str, order: i64| crate::models::TranslationEntry {
            id: id.to_string(),
            project_id: "p1".into(),
            source_text: "六花".into(),
            translation: None,
            status: "pending".into(),
            context: None,
            file_path: "data/Actors.json".into(),
            order_index: order,
        };

        // First extraction
        insert_entries_batch(&pool, &[make_entry("e1", 0)]).await.unwrap();
        // Second extraction same position — different UUID, should be ignored
        insert_entries_batch(&pool, &[make_entry("e2", 0)]).await.unwrap();

        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM entries WHERE project_id = 'p1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(count.0, 1, "re-extraction must not create duplicates");
    }
}
