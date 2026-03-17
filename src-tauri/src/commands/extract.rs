use crate::db::queries;
use crate::engines::rpgmaker_mv_mz::extractor as rpg_extractor;
use crate::engines::wolf_rpg::extractor as wolf_extractor;
use sqlx::SqlitePool;

#[tauri::command]
pub async fn extract_strings(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
    game_dir: String,
) -> Result<u32, String> {
    let engine = queries::get_project_engine_by_id(pool.inner(), &project_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project {} not found", project_id))?;

    let path = std::path::Path::new(&game_dir);

    let entries = match engine.as_str() {
        "wolf_rpg" => wolf_extractor::extract(path, &project_id)
            .await
            .map_err(|e| e.to_string())?,
        _ => rpg_extractor::extract(path, &project_id)
            .await
            .map_err(|e| e.to_string())?,
    };

    let count = entries.len() as u32;

    queries::insert_entries_batch(pool.inner(), &entries)
        .await
        .map_err(|e| e.to_string())?;

    Ok(count)
}
