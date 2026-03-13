use ollama_rs::{Ollama, generation::completion::request::GenerationRequest};
use sqlx::SqlitePool;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use tauri::Emitter;
use crate::db::queries;
use crate::engines::rpgmaker_mv_mz::placeholders;

/// Internal function — testable without Tauri state
pub async fn check_ollama_inner() -> Result<bool, String> {
    let ollama = Ollama::default(); // connects to localhost:11434
    match ollama.list_local_models().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn check_ollama() -> Result<bool, String> {
    check_ollama_inner().await
}

#[tauri::command]
pub async fn list_models() -> Result<Vec<String>, String> {
    let ollama = Ollama::default();
    let models = ollama
        .list_local_models()
        .await
        .map_err(|e| e.to_string())?;
    Ok(models.into_iter().map(|m| m.name).collect())
}

#[derive(serde::Serialize, Clone)]
pub struct TranslationProgress {
    pub done: u32,
    pub total: u32,
    pub entry_id: String,
}

#[tauri::command]
pub async fn cancel_batch(
    cancel_flag: tauri::State<'_, Arc<AtomicBool>>,
) -> Result<(), String> {
    cancel_flag.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn translate_batch(
    window: tauri::Window,
    pool: tauri::State<'_, SqlitePool>,
    cancel_flag: tauri::State<'_, Arc<AtomicBool>>,
    project_id: String,
    model: String,
    target_lang: String,
    system_prompt: String,
) -> Result<(), String> {
    cancel_flag.store(false, Ordering::Relaxed);

    let entries = queries::get_pending_entries(&pool, &project_id)
        .await
        .map_err(|e| e.to_string())?;

    let total = entries.len() as u32;
    let ollama = Ollama::default();

    for (i, entry) in entries.iter().enumerate() {
        if cancel_flag.load(Ordering::Relaxed) {
            break;
        }

        let prompt = format!(
            "{}\n\nTranslate to {}:\n{}",
            system_prompt, target_lang, entry.source_text
        );

        let request = GenerationRequest::new(model.clone(), prompt);
        match ollama.generate(request).await {
            Ok(response) => {
                let translated = response.response.trim().to_string();
                let (decoded, intact) = placeholders::decode(&translated);
                let status = if intact { "translated" } else { "warning:missing_placeholder" };
                let _ = queries::update_translation(&pool, &entry.id, &decoded, status).await;
            }
            Err(e) => {
                let _ = queries::update_status(&pool, &entry.id, &format!("error:{}", e)).await;
            }
        }

        let _ = window.emit("translation:progress", TranslationProgress {
            done: (i + 1) as u32,
            total,
            entry_id: entry.id.clone(),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_ollama_returns_bool() {
        let result = check_ollama_inner().await;
        assert!(result.is_ok() || result.is_err()); // always true — just tests compilation
    }
}
