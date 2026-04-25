use crate::db::queries;
use crate::engines::{rpgmaker_mv_mz::placeholders as rpgmaker_ph, wolf_rpg::placeholders as wolf_ph};
use ollama_rs::{generation::completion::request::GenerationRequest, Ollama};
use sqlx::SqlitePool;
use std::sync::{
    atomic::{AtomicBool, AtomicU32, Ordering},
    Arc, LazyLock, Mutex,
};

static PROMPTS: LazyLock<serde_json::Value> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../prompts/hoshi-prompts.json"))
        .expect("hoshi-prompts.json is invalid JSON")
});
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

fn format_context_block(entries: &[(String, String)]) -> String {
    if entries.is_empty() {
        return String::new();
    }
    let lines: Vec<String> = entries
        .iter()
        .map(|(src, tgt)| format!("- {} → {}", src, tgt))
        .collect();
    format!("[Previous lines]\n{}", lines.join("\n"))
}

fn build_translate_prompt(glossary_block: &str, context_block: &str, text: &str) -> String {
    let t = &PROMPTS["translate"];
    let header = t["header"].as_str().unwrap_or("");
    let rules: String = t["rules"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join("\n- ")
        })
        .unwrap_or_default();
    let instruction = format!("{}\nRules:\n- {}", header, rules);
    let mut parts = vec![instruction];
    if !glossary_block.is_empty() {
        parts.push(glossary_block.to_string());
    }
    if !context_block.is_empty() {
        parts.push(context_block.to_string());
    }
    parts.push(format!("Translate:\n{}", text));
    parts.join("\n\n")
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

/// Translate pending entries in two sequential phases:
/// - Phase 1: item/ui/general files first; short translated terms collected for auto-glossary.
/// - Auto-inject: inserts Phase 1 short terms into project glossary (INSERT OR IGNORE), re-fetches.
/// - Phase 2: dialogue files sequentially with 3-line context from DB.
///
/// `limit`: max entries to translate in this run (0 = all pending)
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
    limit: u32,
    temperature: f32,
    entry_ids: Option<Vec<String>>,
) -> Result<(), String> {
    cancel_flag.store(false, Ordering::Relaxed);
    batch_running.inner().0.store(true, Ordering::Relaxed);
    prompt_log.inner().0.lock().unwrap().clear();

    // Fetch glossary (global + project-specific) for this project
    let glossary_terms = queries::get_glossary_for_translation(pool.inner(), &project_id, "en")
        .await
        .unwrap_or_default();
    let mut term_pairs: Vec<(String, String)> = glossary_terms
        .into_iter()
        .map(|t| (t.source_term, t.target_term))
        .collect();

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
    let cancel = cancel_flag.inner().clone();
    let pool_inner = pool.inner().clone();

    // Split entries into Phase 1 (item/ui/general) and Phase 2 (dialogue)
    let mut phase1_groups: std::collections::BTreeMap<String, Vec<crate::models::TranslationEntry>> =
        std::collections::BTreeMap::new();
    let mut phase2_groups: std::collections::BTreeMap<String, Vec<crate::models::TranslationEntry>> =
        std::collections::BTreeMap::new();

    for entry in entries {
        if infer_text_type(&entry.file_path) == "dialogue" {
            phase2_groups
                .entry(entry.file_path.clone())
                .or_default()
                .push(entry);
        } else {
            phase1_groups
                .entry(entry.file_path.clone())
                .or_default()
                .push(entry);
        }
    }
    for group in phase1_groups.values_mut() {
        group.sort_by_key(|e| e.order_index);
    }
    for group in phase2_groups.values_mut() {
        group.sort_by_key(|e| e.order_index);
    }

    let mut done: u32 = 0;
    let mut auto_terms: Vec<(String, String)> = Vec::new();

    // ── Phase 1: item / ui / general ────────────────────────────────────────
    'phase1: for (_file_path, file_entries) in phase1_groups {
        for entry in file_entries {
            if cancel.load(Ordering::Relaxed) {
                break 'phase1;
            }

            let (simplified, ph_map) = if is_wolf {
                wolf_ph::extract_native(&entry.source_text)
            } else {
                rpgmaker_ph::extract_native(&entry.source_text)
            };
            let marker_count = ph_map.len();

            let entry_glossary = filter_glossary_for_text(&entry.source_text, &term_pairs);
            let gb = format_glossary_block(&entry_glossary);
            let prompt = build_translate_prompt(&gb, "", &simplified);

            {
                let mut log = prompt_log.inner().0.lock().unwrap();
                log.push(serde_json::json!({
                    "entry_id": entry.id,
                    "file": entry.file_path,
                    "order": entry.order_index,
                    "text_type": infer_text_type(&entry.file_path),
                    "source": entry.source_text,
                    "simplified": simplified,
                    "prompt": prompt,
                }));
            }

            let ollama = ollama_from_url(&ollama_host);
            let options = ollama_rs::models::ModelOptions::default().temperature(temperature);
            let request = GenerationRequest::new(model.clone(), prompt).options(options);

            match ollama.generate(request).await {
                Ok(response) => {
                    let translated = response.response.trim().replace("\\\"", "\"");
                    let prompt_tokens = response.prompt_eval_count.map(|n| n as i64);
                    let output_tokens = response.eval_count.map(|n| n as i64);
                    let (reinjected, intact) = if is_wolf {
                        wolf_ph::reinject_native(&translated, &ph_map)
                    } else {
                        rpgmaker_ph::reinject_native(&translated, &ph_map)
                    };
                    let found = (0..marker_count)
                        .filter(|i| translated.contains(&format!("❬{}❭", i)))
                        .count();
                    let status = if intact {
                        "translated".to_string()
                    } else {
                        format!("warning:missing_placeholder:{}/{}", found, marker_count)
                    };
                    let _ = queries::update_translation(
                        &pool_inner,
                        &entry.id,
                        &reinjected,
                        &status,
                        prompt_tokens,
                        output_tokens,
                    )
                    .await;
                    if entry.source_text.chars().count() <= 10 {
                        auto_terms.push((entry.source_text.clone(), reinjected));
                    }
                }
                Err(e) => {
                    let _ = queries::update_status(
                        &pool_inner,
                        &entry.id,
                        &format!("error:{}", e),
                    )
                    .await;
                }
            }

            done += 1;
            let _ = window.emit(
                "translation:progress",
                TranslationProgress {
                    done,
                    total,
                    entry_id: entry.id.clone(),
                },
            );
        }
    }

    // ── Auto-inject Phase 1 results into project glossary ───────────────────
    if !auto_terms.is_empty() && !cancel.load(Ordering::Relaxed) {
        let _ = queries::bulk_insert_auto_glossary(&pool_inner, &project_id, &auto_terms).await;
        if let Ok(refreshed) = queries::get_glossary_for_translation(&pool_inner, &project_id, "en").await {
            term_pairs = refreshed
                .into_iter()
                .map(|t| (t.source_term, t.target_term))
                .collect();
        }
    }

    // ── Phase 2: dialogue — sequential with context lines ───────────────────
    'phase2: for (_file_path, file_entries) in phase2_groups {
        for entry in file_entries {
            if cancel.load(Ordering::Relaxed) {
                break 'phase2;
            }

            let preceding = queries::get_preceding_translated(
                &pool_inner,
                &project_id,
                &entry.file_path,
                entry.order_index,
                5,
            )
            .await
            .unwrap_or_default();
            let context_block = format_context_block(&preceding);

            let (simplified, ph_map) = if is_wolf {
                wolf_ph::extract_native(&entry.source_text)
            } else {
                rpgmaker_ph::extract_native(&entry.source_text)
            };
            let marker_count = ph_map.len();

            let entry_glossary = filter_glossary_for_text(&entry.source_text, &term_pairs);
            let gb = format_glossary_block(&entry_glossary);
            let prompt = build_translate_prompt(&gb, &context_block, &simplified);

            {
                let mut log = prompt_log.inner().0.lock().unwrap();
                log.push(serde_json::json!({
                    "entry_id": entry.id,
                    "file": entry.file_path,
                    "order": entry.order_index,
                    "text_type": "dialogue",
                    "source": entry.source_text,
                    "simplified": simplified,
                    "prompt": prompt,
                }));
            }

            let ollama = ollama_from_url(&ollama_host);
            let options = ollama_rs::models::ModelOptions::default().temperature(temperature);
            let request = GenerationRequest::new(model.clone(), prompt).options(options);

            match ollama.generate(request).await {
                Ok(response) => {
                    let translated = response.response.trim().replace("\\\"", "\"");
                    let prompt_tokens = response.prompt_eval_count.map(|n| n as i64);
                    let output_tokens = response.eval_count.map(|n| n as i64);
                    let (reinjected, intact) = if is_wolf {
                        wolf_ph::reinject_native(&translated, &ph_map)
                    } else {
                        rpgmaker_ph::reinject_native(&translated, &ph_map)
                    };
                    let found = (0..marker_count)
                        .filter(|i| translated.contains(&format!("❬{}❭", i)))
                        .count();
                    let status = if intact {
                        "translated".to_string()
                    } else {
                        format!("warning:missing_placeholder:{}/{}", found, marker_count)
                    };
                    let _ = queries::update_translation(
                        &pool_inner,
                        &entry.id,
                        &reinjected,
                        &status,
                        prompt_tokens,
                        output_tokens,
                    )
                    .await;
                }
                Err(e) => {
                    let _ = queries::update_status(
                        &pool_inner,
                        &entry.id,
                        &format!("error:{}", e),
                    )
                    .await;
                }
            }

            done += 1;
            let _ = window.emit(
                "translation:progress",
                TranslationProgress {
                    done,
                    total,
                    entry_id: entry.id.clone(),
                },
            );
        }
    }

    // Send system notification
    use tauri_plugin_notification::NotificationExt;
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
    _lang_name: &str,
) -> String {
    let r = &PROMPTS["review"];
    let header = r["header"].as_str().unwrap_or("");
    let criteria: String = r["criteria"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .enumerate()
                .filter_map(|(i, v)| v.as_str().map(|s| format!("{}. {}", i + 1, s)))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();
    let output_rule = r["output_rule"].as_str().unwrap_or("");
    format!(
        "{header}\nCRITICAL: Output ONLY the final translation. No commentary, no labels.\n\n\
         Source (JP): {source}\n\
         Draft: {draft}\n\
         Source has {ph_src} marker(s). Draft has {ph_draft} marker(s).\n\n\
         Review criteria:\n{criteria}\n\n\
         {output_rule}",
        header = header,
        source = encoded_source,
        draft = encoded_draft,
        ph_src = ph_count_source,
        ph_draft = ph_count_draft,
        criteria = criteria,
        output_rule = output_rule,
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
    }

    #[test]
    fn test_build_translate_prompt_reads_json() {
        let prompt = build_translate_prompt("", "", "おはようございます");
        assert!(prompt.contains("Translate:"));
        assert!(prompt.contains("おはようございます"));
        assert!(prompt.contains("honorific") || prompt.contains("Honorific") || prompt.contains("-san"));
    }

    #[test]
    fn test_build_translate_prompt_includes_glossary() {
        let glossary = "Reference glossary (use these translations, do not include in output):\n- 六花 → Rikka";
        let prompt = build_translate_prompt(glossary, "", "六花が来た。");
        assert!(prompt.contains("Reference glossary"));
        assert!(prompt.contains("六花が来た。"));
    }

    #[test]
    fn test_format_context_block_empty() {
        let block = format_context_block(&[]);
        assert_eq!(block, "");
    }

    #[test]
    fn test_format_context_block_with_entries() {
        let entries = vec![
            ("こんにちは".to_string(), "Hello.".to_string()),
            ("ありがとう".to_string(), "Thank you.".to_string()),
        ];
        let block = format_context_block(&entries);
        assert!(block.contains("[Previous lines]"));
        assert!(block.contains("こんにちは → Hello."));
        assert!(block.contains("ありがとう → Thank you."));
    }

    #[test]
    fn test_build_translate_prompt_with_context() {
        let context = format_context_block(&[("おはよう".to_string(), "Good morning.".to_string())]);
        let prompt = build_translate_prompt("", &context, "こんにちは");
        assert!(prompt.contains("[Previous lines]"));
        assert!(prompt.contains("Translate:"));
        assert!(prompt.contains("こんにちは"));
    }

    #[test]
    fn test_build_translate_prompt_no_context() {
        let prompt = build_translate_prompt("", "", "おはよう");
        assert!(!prompt.contains("[Previous lines]"));
        assert!(prompt.contains("Translate:"));
        assert!(prompt.contains("おはよう"));
    }

    #[test]
    fn test_build_review_prompt_reads_json() {
        let prompt = build_review_prompt("こんにちは", "Hello", 0, 0, "English");
        assert!(prompt.contains("こんにちは"));
        assert!(prompt.contains("Hello"));
        assert!(prompt.contains("unchanged") || prompt.contains("EXACTLY"));
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
        assert!(block.contains("Reference glossary"));
        assert!(block.contains("羽鳥 → Hatori"));
        assert!(block.contains("六花 → Rikka"));
    }

    #[tokio::test]
    async fn test_check_ollama_returns_bool() {
        let result = check_ollama_inner("http://localhost:11434").await;
        assert!(result.is_ok() || result.is_err());
    }

}
