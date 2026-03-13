use sqlx::SqlitePool;
use crate::db::queries;

#[tauri::command]
pub async fn get_entries(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
    status_filter: Option<String>,
    file_filter: Option<String>,
) -> Result<Vec<crate::models::TranslationEntry>, String> {
    queries::get_entries(
        &pool,
        &project_id,
        status_filter.as_deref(),
        file_filter.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_translation(
    pool: tauri::State<'_, SqlitePool>,
    entry_id: String,
    translation: String,
) -> Result<(), String> {
    queries::update_translation(&pool, &entry_id, &translation, "translated")
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_status(
    pool: tauri::State<'_, SqlitePool>,
    entry_id: String,
    status: String,
) -> Result<(), String> {
    queries::update_status(&pool, &entry_id, &status)
        .await
        .map_err(|e| e.to_string())
}
