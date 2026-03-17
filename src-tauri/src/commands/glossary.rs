use crate::db::queries;
use crate::models::GlossaryTerm;
use sqlx::SqlitePool;
use uuid::Uuid;

#[tauri::command]
pub async fn export_glossary(
    pool: tauri::State<'_, SqlitePool>,
    path: String,
) -> Result<(), String> {
    let terms = queries::get_all_glossary_terms(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&terms).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
struct ImportTerm {
    #[serde(default)]
    id: Option<String>,
    project_id: Option<String>,
    source_term: String,
    target_term: String,
    #[serde(default = "default_lang")]
    target_lang: String,
}

fn default_lang() -> String {
    "en".to_string()
}

#[tauri::command]
pub async fn import_glossary(
    pool: tauri::State<'_, SqlitePool>,
    path: String,
) -> Result<u32, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let terms: Vec<ImportTerm> =
        serde_json::from_str(&content).map_err(|e| format!("Invalid JSON: {e}"))?;
    let mut count = 0u32;
    for term in terms {
        let id = term.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        queries::upsert_glossary_term(
            pool.inner(),
            &id,
            term.project_id.as_deref(),
            &term.source_term,
            &term.target_term,
            &term.target_lang,
        )
        .await
        .map_err(|e| e.to_string())?;
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
pub async fn get_all_glossary_terms(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Vec<GlossaryTerm>, String> {
    queries::get_all_glossary_terms(pool.inner())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upsert_glossary_term(
    pool: tauri::State<'_, SqlitePool>,
    project_id: Option<String>,
    source_term: String,
    target_term: String,
    target_lang: String,
    id: Option<String>,
) -> Result<GlossaryTerm, String> {
    let term_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
    queries::upsert_glossary_term(
        pool.inner(),
        &term_id,
        project_id.as_deref(),
        &source_term,
        &target_term,
        &target_lang,
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(GlossaryTerm {
        id: term_id,
        project_id,
        source_term,
        target_term,
        target_lang,
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
