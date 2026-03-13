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

        create_project(&pool, "proj-1", "/game", "rpgmaker_mv_mz", "Test", "en", None)
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
}
