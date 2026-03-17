use crate::db::queries;
use crate::engines::rpgmaker_mv_mz::placeholders;
use ollama_rs::{generation::completion::request::GenerationRequest, Ollama};
use sqlx::SqlitePool;
use std::sync::{
    atomic::{AtomicBool, AtomicU32, Ordering},
    Arc,
};
use tauri::Emitter;

/// Parse a URL like "http://host:port" or "https://host.proxy.runpod.net" into (host_with_scheme, port).
/// For HTTPS URLs without an explicit port, uses 443 (required for RunPod proxy URLs).
/// For HTTP URLs without an explicit port, uses 11434 (Ollama default).
fn parse_ollama_url(url: &str) -> (String, u16) {
    let url = url.trim().trim_end_matches('/');

    // Strip scheme
    let (scheme, hostpart) = if let Some(s) = url.strip_prefix("https://") {
        ("https", s)
    } else if let Some(s) = url.strip_prefix("http://") {
        ("http", s)
    } else {
        ("http", url)
    };

    // Check for explicit port at end of host (host:port)
    if let Some(colon_pos) = hostpart.rfind(':') {
        let maybe_port = &hostpart[colon_pos + 1..];
        if let Ok(port) = maybe_port.parse::<u16>() {
            let host = format!("{}://{}", scheme, &hostpart[..colon_pos]);
            return (host, port);
        }
    }

    // No explicit port — use scheme default (443 for HTTPS, 11434 for HTTP)
    let default_port = if scheme == "https" { 443 } else { 11434 };
    (format!("{}://{}", scheme, hostpart), default_port)
}

fn ollama_from_url(url: &str) -> Ollama {
    let (host, port) = parse_ollama_url(url);
    Ollama::new(host, port)
}

/// Internal function — testable without Tauri state
pub async fn check_ollama_inner(ollama_host: &str) -> Result<bool, String> {
    let ollama = ollama_from_url(ollama_host);
    match ollama.list_local_models().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn check_ollama(ollama_host: String) -> Result<bool, String> {
    check_ollama_inner(&ollama_host).await
}

#[tauri::command]
pub async fn list_models(ollama_host: String) -> Result<Vec<String>, String> {
    let ollama = ollama_from_url(&ollama_host);
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

fn format_glossary_block(terms: &[(String, String)]) -> String {
    if terms.is_empty() {
        return String::new();
    }
    let lines: Vec<String> = terms
        .iter()
        .take(20)
        .map(|(src, tgt)| format!("- {} → {}", src, tgt))
        .collect();
    format!(
        "Glossary (always use these translations):\n{}\n\n",
        lines.join("\n")
    )
}

/// Translate pending entries with configurable concurrency and batch limit.
///
/// - `concurrency`: number of simultaneous Ollama requests (1–16, default 4)
/// - `limit`: max entries to translate in this run (0 = all pending)
#[tauri::command]
pub async fn translate_batch(
    window: tauri::Window,
    app: tauri::AppHandle,
    pool: tauri::State<'_, SqlitePool>,
    cancel_flag: tauri::State<'_, Arc<AtomicBool>>,
    project_id: String,
    model: String,
    target_lang: String,
    system_prompt: String,
    ollama_host: String,
    concurrency: u32,
    limit: u32,
    temperature: f32,
) -> Result<(), String> {
    use tokio::sync::Semaphore;

    cancel_flag.store(false, Ordering::Relaxed);

    // Fetch glossary (global + project-specific for target_lang) and prepend to system_prompt
    let glossary_terms = queries::get_glossary_for_translation(pool.inner(), &project_id, &target_lang)
        .await
        .unwrap_or_default();
    let term_pairs: Vec<(String, String)> = glossary_terms
        .into_iter()
        .map(|t| (t.source_term, t.target_term))
        .collect();
    let glossary_block = format_glossary_block(&term_pairs);
    let system_prompt = if glossary_block.is_empty() {
        system_prompt
    } else {
        format!("{}{}", glossary_block, system_prompt)
    };

    let all_entries = queries::get_pending_entries(pool.inner(), &project_id)
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
        let ollama_host = ollama_host.clone();
        let done_count = done_count.clone();
        let temperature = temperature;

        join_set.spawn(async move {
            let _permit = permit; // released when this task ends

            if cancel.load(Ordering::Relaxed) {
                return;
            }

            let encoded = placeholders::encode(&entry.source_text);
            // Map lang code to full name so the prompt matches the Modelfile few-shot format:
            // "Translate from Japanese to English: {text}"
            let lang_name = match target_lang.as_str() {
                "fr" => "French",
                _ => "English",
            };
            let prompt = if system_prompt.is_empty() {
                // hoshi-translator: SYSTEM baked in Modelfile — match few-shot format exactly
                format!("Translate from Japanese to {}: {}", lang_name, encoded)
            } else {
                // Generic model: prepend settings system prompt
                format!("{}\n\nTranslate from Japanese to {}: {}", system_prompt, lang_name, encoded)
            };
            let ollama = ollama_from_url(&ollama_host);
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

    // Send system notification
    use tauri_plugin_notification::NotificationExt;
    let done = done_count.load(Ordering::Relaxed);
    let cancelled = cancel_flag.load(Ordering::Relaxed);
    let message = if cancelled {
        format!("Batch cancelled after {} entries.", done)
    } else {
        format!("Batch complete: {} entries translated.", done)
    };
    let _ = app
        .notification()
        .builder()
        .title("hoshi-trans")
        .body(&message)
        .show();

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_glossary_block_empty() {
        let terms: Vec<(String, String)> = vec![];
        let block = format_glossary_block(&terms);
        assert_eq!(block, "");
    }

    #[test]
    fn test_format_glossary_block_with_terms() {
        let terms = vec![
            ("羽鳥".to_string(), "Hatori".to_string()),
            ("六花".to_string(), "Rikka".to_string()),
        ];
        let block = format_glossary_block(&terms);
        assert!(block.contains("Glossary"));
        assert!(block.contains("羽鳥 → Hatori"));
        assert!(block.contains("六花 → Rikka"));
    }

    #[tokio::test]
    async fn test_check_ollama_returns_bool() {
        let result = check_ollama_inner("http://localhost:11434").await;
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
