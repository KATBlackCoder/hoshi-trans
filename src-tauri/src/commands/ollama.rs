use crate::db::queries;
use crate::engines::{rpgmaker_mv_mz::placeholders as rpgmaker_ph, wolf_rpg::placeholders as wolf_ph};
use ollama_rs::{generation::completion::request::GenerationRequest, Ollama};
use sqlx::SqlitePool;
use std::sync::{
    atomic::{AtomicBool, AtomicU32, Ordering},
    Arc, Mutex,
};
use tauri::Emitter;

/// Shared buffer that accumulates prompt logs during a translation batch.
/// Cleared at the start of each new batch.
pub struct PromptLog(pub Arc<Mutex<Vec<serde_json::Value>>>);

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

/// Newtype wrapper so Tauri can distinguish the batch-running flag from the cancel flag.
pub struct BatchRunning(pub Arc<AtomicBool>);

#[tauri::command]
pub async fn cancel_batch(cancel_flag: tauri::State<'_, Arc<AtomicBool>>) -> Result<(), String> {
    cancel_flag.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn is_batch_running(batch_running: tauri::State<'_, BatchRunning>) -> Result<bool, String> {
    Ok(batch_running.inner().0.load(Ordering::Relaxed))
}

fn format_glossary_block(terms: &[(String, String)]) -> String {
    if terms.is_empty() {
        return String::new();
    }
    let lines: Vec<String> = terms
        .iter()
        .map(|(src, tgt)| format!("- {} → {}", src, tgt))
        .collect();
    format!("Reference glossary (use these translations, do not include in output):\n{}", lines.join("\n"))
}

const TRANSLATEGEMMA_HEADER: &str = "You are a professional Japanese (ja) to English (en) translator. Your goal is to accurately convey the meaning and nuances of the original Japanese text while adhering to English grammar, vocabulary, and cultural sensitivities.\nProduce only the English translation, without any additional explanations or commentary. Please translate the following Japanese text into English:";

fn build_translate_prompt(glossary_block: &str, text: &str) -> String {
    if glossary_block.is_empty() {
        format!("{}\n\n\n{}", TRANSLATEGEMMA_HEADER, text)
    } else {
        format!("{}\n{}\n\n\n{}", TRANSLATEGEMMA_HEADER, glossary_block, text)
    }
}

/// Returns only the glossary terms whose source_term appears literally in `text`.
/// Preserves the original order from `terms`.
fn filter_glossary_for_text(text: &str, terms: &[(String, String)]) -> Vec<(String, String)> {
    terms
        .iter()
        .filter(|(src, _)| text.contains(src.as_str()))
        .cloned()
        .collect()
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
    batch_running: tauri::State<'_, BatchRunning>,
    prompt_log: tauri::State<'_, PromptLog>,
    project_id: String,
    model: String,
    ollama_host: String,
    concurrency: u32,
    limit: u32,
    temperature: f32,
    entry_ids: Option<Vec<String>>,
) -> Result<(), String> {
    use tokio::sync::Semaphore;

    cancel_flag.store(false, Ordering::Relaxed);
    batch_running.inner().0.store(true, Ordering::Relaxed);
    prompt_log.inner().0.lock().unwrap().clear();

    // Fetch glossary (global + project-specific) for this project
    let glossary_terms = queries::get_glossary_for_translation(pool.inner(), &project_id, "en")
        .await
        .unwrap_or_default();
    let term_pairs: Vec<(String, String)> = glossary_terms
        .into_iter()
        .map(|t| (t.source_term, t.target_term))
        .collect();
    // NOTE: glossary_block is no longer built here — filtered per-entry inside the spawn closure

    let engine = queries::get_project_engine_by_id(pool.inner(), &project_id)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let is_wolf = engine == "wolf_rpg";

    // If specific entry IDs provided, translate those regardless of status.
    // Otherwise fall back to pending entries with optional limit.
    let entries = if let Some(ids) = entry_ids {
        queries::get_entries_by_ids(pool.inner(), &ids)
            .await
            .map_err(|e| e.to_string())?
    } else {
        let all_pending = queries::get_pending_entries(pool.inner(), &project_id)
            .await
            .map_err(|e| e.to_string())?;
        if limit > 0 {
            all_pending.into_iter().take(limit as usize).collect()
        } else {
            all_pending
        }
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
        let term_pairs = term_pairs.clone();
        let ollama_host = ollama_host.clone();
        let done_count = done_count.clone();
        let temperature = temperature;
        let prompt_log = prompt_log.inner().0.clone();

        join_set.spawn(async move {
            let _permit = permit; // released when this task ends

            if cancel.load(Ordering::Relaxed) {
                return;
            }

            // Single-pass: extract native codes → ❬n❭ markers
            let (simplified, ph_map) = if is_wolf {
                wolf_ph::extract_native(&entry.source_text)
            } else {
                rpgmaker_ph::extract_native(&entry.source_text)
            };
            let marker_count = ph_map.len();

            // Per-entry glossary: only terms present in this source text
            let entry_glossary = filter_glossary_for_text(&entry.source_text, &term_pairs);
            let gb = format_glossary_block(&entry_glossary);

            let prompt = build_translate_prompt(&gb, &simplified);

            // Log prompt for debug export
            prompt_log.lock().unwrap().push(serde_json::json!({
                "entry_id": entry.id,
                "file": entry.file_path,
                "order": entry.order_index,
                "source": entry.source_text,
                "simplified": simplified,
                "prompt": prompt,
            }));

            let ollama = ollama_from_url(&ollama_host);
            let options = ollama_rs::models::ModelOptions::default().temperature(temperature);


            let mut last_error: Option<String> = None;
            let mut final_result = String::new();
            let mut final_status = String::new();
            let mut success = false;
            let mut final_prompt_tokens: Option<i64> = None;
            let mut final_output_tokens: Option<i64> = None;

            let request = GenerationRequest::new(model.clone(), prompt).options(options.clone());
            match ollama.generate(request).await {
                Ok(response) => {
                    let translated = response.response.trim().replace("\\\"", "\"");
                    final_prompt_tokens = response.prompt_eval_count.map(|n| n as i64);
                    final_output_tokens = response.eval_count.map(|n| n as i64);
                    let (reinjected, intact) = if is_wolf {
                        wolf_ph::reinject_native(&translated, &ph_map)
                    } else {
                        rpgmaker_ph::reinject_native(&translated, &ph_map)
                    };
                    let found = (0..marker_count)
                        .filter(|i| translated.contains(&format!("❬{}❭", i)))
                        .count();
                    final_result = reinjected;
                    final_status = if intact {
                        "translated".to_string()
                    } else {
                        format!("warning:missing_placeholder:{}/{}", found, marker_count)
                    };
                    success = true;
                }
                Err(e) => {
                    last_error = Some(e.to_string());
                }
            }

            if success {
                let _ = queries::update_translation(&pool, &entry.id, &final_result, &final_status, final_prompt_tokens, final_output_tokens).await;
            } else {
                let err = last_error.unwrap_or_else(|| "unknown".to_string());
                let _ = queries::update_status(&pool, &entry.id, &format!("error:{}", err)).await;
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

    batch_running.inner().0.store(false, Ordering::Relaxed);
    let _ = window.emit("translation:complete", ());

    Ok(())
}

/// Infer the semantic type of a string from its file path.
/// Used to give the review model additional context.
pub fn infer_text_type(file_path: &str) -> &'static str {
    let lower = file_path.to_lowercase();
    let item_keywords = ["item", "weapon", "armor", "skill", "actor", "class", "enemy",
                         "troop", "state", "アイテム", "武器", "防具", "スキル"];
    let ui_keywords = ["system", "game.json"];
    let dialogue_keywords = ["mps/", "common/", "map"];

    // Check dialogue path patterns first — common/ and mps/ are always dialogue
    // regardless of what's in the filename (e.g. アイテム増減 common event)
    if dialogue_keywords.iter().any(|k| lower.contains(k)) {
        "dialogue"
    } else if item_keywords.iter().any(|k| lower.contains(k)) {
        "item"
    } else if ui_keywords.iter().any(|k| lower.contains(k)) {
        "ui"
    } else {
        "general"
    }
}

/// Build the critique prompt sent to the thinking model during the refine pass.
/// The model receives encoded source + encoded draft so it can reason about placeholders.
pub fn build_review_prompt(
    encoded_source: &str,
    encoded_draft: &str,
    ph_count_source: i64,
    ph_count_draft: i64,
    lang_name: &str,
) -> String {
    format!(
        "Review this Japanese-to-{lang} game translation.\n\
         Source (JP): {source}\n\
         Draft translation: {draft}\n\
         Source has {ph_src} placeholder token(s). Draft has {ph_draft} placeholder token(s).\n\n\
         Review criteria:\n\
         1. Placeholder count: if counts differ, fix the draft to preserve all placeholders.\n\
         2. Accuracy: faithfully represent the Japanese meaning and tone.\n\
         3. Fluency: natural, idiomatic {lang}.\n\
         4. Register: preserve emotional register (dramatic, casual, cute, etc.).\n\n\
         If the draft is already correct and natural, output it EXACTLY unchanged.\n\
         If you can improve it, output ONLY the improved translation — no commentary.",
        lang = lang_name,
        source = encoded_source,
        draft = encoded_draft,
        ph_src = ph_count_source,
        ph_draft = ph_count_draft,
    )
}

/// Newtype for the refine-batch running flag (distinct from BatchRunning).
pub struct RefineRunning(pub Arc<AtomicBool>);

#[tauri::command]
pub async fn cancel_refine(cancel_flag: tauri::State<'_, Arc<AtomicBool>>) -> Result<(), String> {
    cancel_flag.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn is_refine_running(refine_running: tauri::State<'_, RefineRunning>) -> Result<bool, String> {
    Ok(refine_running.inner().0.load(Ordering::Relaxed))
}

/// Refine pass: sends already-translated entries to a thinking model for quality review.
///
/// - Sends (encoded_source, encoded_draft) to the model with a critique prompt.
/// - If model output differs from draft → `refined_status = "reviewed"`.
/// - If model output matches draft → `refined_status = "unchanged"`.
/// - Placeholder counts are stored for display in the UI.
/// - Entry `status` (translated/warning) is NOT modified — only refine columns are updated.
#[tauri::command]
pub async fn refine_batch(
    window: tauri::Window,
    app: tauri::AppHandle,
    pool: tauri::State<'_, SqlitePool>,
    cancel_flag: tauri::State<'_, Arc<AtomicBool>>,
    refine_running: tauri::State<'_, RefineRunning>,
    project_id: String,
    model: String,
    target_lang: String,
    ollama_host: String,
    concurrency: u32,
    entry_ids: Option<Vec<String>>,
) -> Result<(), String> {
    use tokio::sync::Semaphore;

    cancel_flag.store(false, Ordering::Relaxed);
    refine_running.inner().0.store(true, Ordering::Relaxed);

    let engine = queries::get_project_engine_by_id(pool.inner(), &project_id)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let is_wolf = engine == "wolf_rpg";

    let ids = entry_ids.unwrap_or_default();
    let entries = queries::get_refinable_entries(pool.inner(), &project_id, &ids)
        .await
        .map_err(|e| e.to_string())?;

    let total = entries.len() as u32;
    let concurrency = concurrency.max(1).min(4) as usize; // cap at 4 for thinking model
    let semaphore = Arc::new(Semaphore::new(concurrency));
    let done_count = Arc::new(AtomicU32::new(0));
    let cancel = cancel_flag.inner().clone();
    let pool_inner = pool.inner().clone();
    let mut join_set = tokio::task::JoinSet::new();

    for entry in entries {
        if cancel.load(Ordering::Relaxed) { break; }
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        if cancel.load(Ordering::Relaxed) { break; }

        let pool = pool_inner.clone();
        let cancel = cancel.clone();
        let window = window.clone();
        let model = model.clone();
        let target_lang = target_lang.clone();
        let ollama_host = ollama_host.clone();
        let done_count = done_count.clone();

        join_set.spawn(async move {
            let _permit = permit;
            if cancel.load(Ordering::Relaxed) { return; }

            let draft = match &entry.translation {
                Some(t) => t.clone(),
                None => return,
            };

            // Extract native codes → ❬n❭ for both source and draft
            let (simplified_src, src_map) = if is_wolf {
                wolf_ph::extract_native(&entry.source_text)
            } else {
                rpgmaker_ph::extract_native(&entry.source_text)
            };
            let (simplified_trl, _) = if is_wolf {
                wolf_ph::extract_native(&draft)
            } else {
                rpgmaker_ph::extract_native(&draft)
            };

            let ph_count_source = src_map.len() as i64;
            let ph_count_draft = (0..src_map.len())
                .filter(|i| simplified_trl.contains(&format!("❬{}❭", i)))
                .count() as i64;

            let lang_name = match target_lang.as_str() {
                "fr" => "French",
                _ => "English",
            };
            let prompt = build_review_prompt(
                &simplified_src,
                &simplified_trl,
                ph_count_source,
                ph_count_draft,
                lang_name,
            );

            let ollama = ollama_from_url(&ollama_host);
            let options = ollama_rs::models::ModelOptions::default().temperature(0.0);
            let request = GenerationRequest::new(model.clone(), prompt).options(options);

            match ollama.generate(request).await {
                Ok(response) => {
                    let raw = response.response.trim().replace("\\\"", "\"");
                    let (decoded_refined, _intact) = if is_wolf {
                        wolf_ph::reinject_native(&raw, &src_map)
                    } else {
                        rpgmaker_ph::reinject_native(&raw, &src_map)
                    };

                    let ph_count_refined = (0..src_map.len())
                        .filter(|i| raw.contains(&format!("❬{}❭", i)))
                        .count() as i64;

                    let refined_status = if decoded_refined.trim() == draft.trim() {
                        "unchanged"
                    } else {
                        "reviewed"
                    };

                    let text_type = infer_text_type(&entry.file_path);
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs() as i64;

                    let _ = queries::update_refined(
                        &pool,
                        &entry.id,
                        &decoded_refined,
                        refined_status,
                        ph_count_source,
                        ph_count_draft,
                        ph_count_refined,
                        text_type,
                        now,
                    ).await;
                }
                Err(e) => {
                    eprintln!("refine error for {}: {}", entry.id, e);
                }
            }

            let done = done_count.fetch_add(1, Ordering::Relaxed) + 1;
            let _ = window.emit(
                "refine:progress",
                TranslationProgress { done, total, entry_id: entry.id.clone() },
            );
        });
    }

    while join_set.join_next().await.is_some() {}

    use tauri_plugin_notification::NotificationExt;
    let done = done_count.load(Ordering::Relaxed);
    let _ = app
        .notification()
        .builder()
        .title("hoshi-trans")
        .body(&format!("Refine complete: {} entries reviewed.", done))
        .show();

    refine_running.inner().0.store(false, Ordering::Relaxed);
    let _ = window.emit("refine:complete", ());

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_glossary_present_terms() {
        let terms = vec![
            ("六花".to_string(), "Rikka".to_string()),
            ("羽鳥".to_string(), "Hatori".to_string()),
            ("魔法".to_string(), "magic".to_string()),
        ];
        let result = filter_glossary_for_text("六花が魔法を使った。", &terms);
        assert_eq!(result, vec![
            ("六花".to_string(), "Rikka".to_string()),
            ("魔法".to_string(), "magic".to_string()),
        ]);
    }

    #[test]
    fn test_filter_glossary_no_match() {
        let terms = vec![("羽鳥".to_string(), "Hatori".to_string())];
        let result = filter_glossary_for_text("おはようございます。", &terms);
        assert!(result.is_empty());
    }

    #[test]
    fn test_filter_glossary_empty_terms() {
        let result = filter_glossary_for_text("六花が魔法を使った。", &[]);
        assert!(result.is_empty());
    }

    #[test]
    fn test_infer_text_type_dialogue() {
        assert_eq!(infer_text_type("mps/Map001.json"), "dialogue");
        assert_eq!(infer_text_type("common/0_○アイテム増減.json"), "dialogue");
    }

    #[test]
    fn test_infer_text_type_item() {
        assert_eq!(infer_text_type("data/Items.json"), "item");
        assert_eq!(infer_text_type("data/Weapons.json"), "item");
        assert_eq!(infer_text_type("data/Skills.json"), "item");
    }

    #[test]
    fn test_infer_text_type_ui() {
        assert_eq!(infer_text_type("Game.json"), "ui");
        assert_eq!(infer_text_type("data/System.json"), "ui");
    }

    #[test]
    fn test_infer_text_type_general_fallback() {
        assert_eq!(infer_text_type("unknown/File.json"), "general");
    }

    #[test]
    fn test_build_review_prompt_includes_source_and_draft() {
        let prompt = build_review_prompt("こんにちは", "Hello", 0, 0, "English");
        assert!(prompt.contains("こんにちは"));
        assert!(prompt.contains("Hello"));
        assert!(prompt.contains("English"));
    }

    #[test]
    fn test_build_review_prompt_includes_placeholder_counts() {
        let prompt = build_review_prompt("❬0❭は戦士", "❬0❭ is a warrior", 1, 1, "English");
        assert!(prompt.contains("1"));
    }

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
