use crate::db::queries;
use crate::models::GlossaryTerm;
use sqlx::SqlitePool;
use uuid::Uuid;

#[tauri::command]
pub async fn get_glossary(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
) -> Result<Vec<GlossaryTerm>, String> {
    queries::get_glossary(pool.inner(), &project_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upsert_glossary_term(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
    source_term: String,
    target_term: String,
    id: Option<String>,
) -> Result<GlossaryTerm, String> {
    let term_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
    queries::upsert_glossary_term(
        pool.inner(),
        &term_id,
        &project_id,
        &source_term,
        &target_term,
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(GlossaryTerm {
        id: term_id,
        project_id,
        source_term,
        target_term,
    })
}

#[tauri::command]
pub async fn delete_glossary_term(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    queries::delete_glossary_term(pool.inner(), &id)
        .await
        .map_err(|e| e.to_string())
}
