use crate::db::queries;
use crate::engines::rpgmaker_mv_mz::injector as rpg_injector;
use crate::engines::wolf_rpg::injector as wolf_injector;
use crate::models::ProjectFile;
use sqlx::SqlitePool;

fn read_wolf_font_size(game_dir: &str) -> Option<u32> {
    let path = std::path::Path::new(game_dir).join("hoshi-trans.json");
    let content = std::fs::read_to_string(path).ok()?;
    let project: ProjectFile = serde_json::from_str(&content).ok()?;
    project.wolf_rpg_font_size
}

#[tauri::command]
pub async fn inject_translations(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
    game_dir: String,
    output_dir: String,
) -> Result<u32, String> {
    let engine = queries::get_project_engine_by_id(pool.inner(), &project_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project {} not found", project_id))?;

    let entries = queries::get_translated_entries_ordered(pool.inner(), &project_id)
        .await
        .map_err(|e| e.to_string())?;

    let count = entries.len() as u32;
    let game_path = std::path::Path::new(&game_dir);
    let out_path = std::path::Path::new(&output_dir);

    match engine.as_str() {
        "wolf_rpg" => {
            let font_size = read_wolf_font_size(&game_dir);
            wolf_injector::inject(game_path, &entries, out_path, font_size)
                .await
                .map_err(|e| e.to_string())?
        }
        _ => rpg_injector::inject(game_path, &entries, out_path)
            .await
            .map_err(|e| e.to_string())?,
    }

    Ok(count)
}
