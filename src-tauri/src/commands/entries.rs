use crate::db::queries;
use sqlx::SqlitePool;

#[tauri::command]
pub async fn get_entries(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
    status_filter: Option<String>,
    file_filter: Option<String>,
) -> Result<Vec<crate::models::TranslationEntry>, String> {
    queries::get_entries(
        pool.inner(),
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
    queries::update_translation(pool.inner(), &entry_id, &translation, "translated", None, None)
        .await
        .map_err(|e| e.to_string())
}

/// Reset entries with empty translation back to pending so they get retranslated.
/// Returns the count of entries reset.
#[tauri::command]
pub async fn reset_empty_translations(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
) -> Result<u32, String> {
    queries::reset_empty_translations(pool.inner(), &project_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_refined_manual(
    pool: tauri::State<'_, sqlx::SqlitePool>,
    entry_id: String,
    refined_text: String,
) -> Result<(), String> {
    crate::db::queries::update_refined_manual(pool.inner(), &entry_id, &refined_text)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_status(
    pool: tauri::State<'_, SqlitePool>,
    entry_id: String,
    status: String,
) -> Result<(), String> {
    queries::update_status(pool.inner(), &entry_id, &status)
        .await
        .map_err(|e| e.to_string())
}
