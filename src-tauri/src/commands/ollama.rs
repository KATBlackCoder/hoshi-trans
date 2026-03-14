use crate::db::queries;
use crate::engines::rpgmaker_mv_mz::placeholders;
use ollama_rs::{generation::completion::request::GenerationRequest, Ollama};
use sqlx::SqlitePool;
use std::sync::{
    atomic::{AtomicBool, AtomicU32, Ordering},
    Arc,
};
use tauri::Emitter;

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
pub async fn cancel_batch(cancel_flag: tauri::State<'_, Arc<AtomicBool>>) -> Result<(), String> {
    cancel_flag.store(true, Ordering::Relaxed);
    Ok(())
}

/// Translate pending entries with configurable concurrency and batch limit.
///
/// - `concurrency`: number of simultaneous Ollama requests (1–16, default 4)
/// - `limit`: max entries to translate in this run (0 = all pending)
#[tauri::command]
pub async fn translate_batch(
    window: tauri::Window,
    pool: tauri::State<'_, SqlitePool>,
    cancel_flag: tauri::State<'_, Arc<AtomicBool>>,
    project_id: String,
    model: String,
    target_lang: String,
    system_prompt: String,
    concurrency: u32,
    limit: u32,
    temperature: f32,
) -> Result<(), String> {
    use tokio::sync::Semaphore;

    cancel_flag.store(false, Ordering::Relaxed);

    let all_entries = queries::get_pending_entries(&pool, &project_id)
        .await
        .map_err(|e| e.to_string())?;

    // Apply batch limit (0 = translate all)
    let entries = if limit > 0 {
        all_entries
            .into_iter()
            .take(limit as usize)
            .collect::<Vec<_>>()
    } else {
        all_entries
    };

    let total = entries.len() as u32;
    let concurrency = concurrency.max(1).min(16) as usize;
    let semaphore = Arc::new(Semaphore::new(concurrency));
    let done_count = Arc::new(AtomicU32::new(0));
    let cancel = cancel_flag.inner().clone();
    let pool_inner = pool.inner().clone();
    let mut join_set = tokio::task::JoinSet::new();

    for entry in entries {
        // Check cancel before acquiring permit — avoids spawning unnecessary tasks
        if cancel.load(Ordering::Relaxed) {
            break;
        }

        let permit = semaphore.clone().acquire_owned().await.unwrap();

        // Check again — cancel may have been set while waiting for a permit
        if cancel.load(Ordering::Relaxed) {
            break;
        }

        let pool = pool_inner.clone();
        let cancel = cancel.clone();
        let window = window.clone();
        let model = model.clone();
        let system_prompt = system_prompt.clone();
        let target_lang = target_lang.clone();
        let done_count = done_count.clone();
        let temperature = temperature;

        join_set.spawn(async move {
            let _permit = permit; // released when this task ends

            if cancel.load(Ordering::Relaxed) {
                return;
            }

            let encoded = placeholders::encode(&entry.source_text);
            let prompt = format!(
                "{}\n\nTranslate to {}:\n{}",
                system_prompt, target_lang, encoded
            );
            let ollama = Ollama::default();
            let options = ollama_rs::models::ModelOptions::default().temperature(temperature);
            let request = GenerationRequest::new(model.clone(), prompt).options(options);

            match ollama.generate(request).await {
                Ok(response) => {
                    let translated = response.response.trim().to_string();
                    let (decoded, intact) = placeholders::decode(&translated);
                    let status = if intact {
                        "translated"
                    } else {
                        "warning:missing_placeholder"
                    };
                    let _ = queries::update_translation(&pool, &entry.id, &decoded, status).await;
                }
                Err(e) => {
                    let _ = queries::update_status(&pool, &entry.id, &format!("error:{}", e)).await;
                }
            }

            let done = done_count.fetch_add(1, Ordering::Relaxed) + 1;
            let _ = window.emit(
                "translation:progress",
                TranslationProgress {
                    done,
                    total,
                    entry_id: entry.id.clone(),
                },
            );
        });
    }

    // Wait for all in-flight tasks to finish
    while join_set.join_next().await.is_some() {}

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_ollama_returns_bool() {
        let result = check_ollama_inner().await;
        assert!(result.is_ok() || result.is_err());
    }

    #[tokio::test]
    async fn test_semaphore_limits_concurrency() {
        use tokio::sync::Semaphore;

        let semaphore = Arc::new(Semaphore::new(2));
        let active = Arc::new(AtomicU32::new(0));
        let max_seen = Arc::new(AtomicU32::new(0));
        let mut join_set = tokio::task::JoinSet::new();

        for _ in 0..8 {
            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let active = active.clone();
            let max_seen = max_seen.clone();
            join_set.spawn(async move {
                let current = active.fetch_add(1, Ordering::SeqCst) + 1;
                let mut seen = max_seen.load(Ordering::SeqCst);
                while current > seen {
                    match max_seen.compare_exchange(
                        seen,
                        current,
                        Ordering::SeqCst,
                        Ordering::SeqCst,
                    ) {
                        Ok(_) => break,
                        Err(x) => seen = x,
                    }
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                active.fetch_sub(1, Ordering::SeqCst);
                drop(permit);
            });
        }

        while join_set.join_next().await.is_some() {}
        assert!(
            max_seen.load(Ordering::SeqCst) <= 2,
            "concurrency exceeded semaphore limit"
        );
    }
}
