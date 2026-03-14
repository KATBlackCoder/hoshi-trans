use crate::db::queries;
use crate::engines::rpgmaker_mv_mz::extractor;
use sqlx::SqlitePool;

#[tauri::command]
pub async fn extract_strings(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
    game_dir: String,
) -> Result<u32, String> {
    let path = std::path::Path::new(&game_dir);
    let entries = extractor::extract(path, &project_id)
        .await
        .map_err(|e| e.to_string())?;

    let count = entries.len() as u32;

    queries::insert_entries_batch(&pool, &entries)
        .await
        .map_err(|e| e.to_string())?;

    Ok(count)
}
