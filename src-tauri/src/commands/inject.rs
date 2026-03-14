use sqlx::SqlitePool;
use crate::db::queries;
use crate::engines::rpgmaker_mv_mz::injector;

#[tauri::command]
pub async fn inject_translations(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
    game_dir: String,
    output_dir: String,
) -> Result<u32, String> {
    let entries = queries::get_translated_entries_ordered(&pool, &project_id)
        .await
        .map_err(|e| e.to_string())?;

    let count = entries.len() as u32;

    let game_path = std::path::Path::new(&game_dir);
    let out_path = std::path::Path::new(&output_dir);

    injector::inject(game_path, &entries, out_path)
        .await
        .map_err(|e| e.to_string())?;

    Ok(count)
}
