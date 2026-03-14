use crate::db::queries;
use sqlx::SqlitePool;

#[tauri::command]
pub async fn export_debug_json(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
    output_dir: String,
) -> Result<String, String> {
    let entries = queries::get_entries(pool.inner(), &project_id, None, None)
        .await
        .map_err(|e| e.to_string())?;

    let json_entries: Vec<serde_json::Value> = entries
        .iter()
        .map(|e| {
            serde_json::json!({
                "file": e.file_path,
                "order": e.order_index,
                "status": e.status,
                "source": e.source_text,
                "translation": e.translation,
            })
        })
        .collect();

    let out = serde_json::to_string_pretty(&json_entries).map_err(|e| e.to_string())?;

    let out_path = std::path::Path::new(&output_dir).join("debug-translations.json");
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    std::fs::write(&out_path, &out).map_err(|e| e.to_string())?;

    Ok(out_path.to_string_lossy().to_string())
}
