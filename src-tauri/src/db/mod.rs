pub mod queries;

use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

pub async fn init_pool(app_data_dir: &str) -> anyhow::Result<SqlitePool> {
    let db_path = format!("{}/hoshi-trans.db", app_data_dir);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&format!("sqlite://{}?mode=rwc", db_path))
        .await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_init_pool_creates_tables() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_str().unwrap();
        let pool = init_pool(path).await.unwrap();

        // Verify tables exist
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('projects', 'entries')"
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(row.0, 2);
    }
}
