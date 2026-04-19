# Context Lines + Auto-Glossary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Process translations in two phases: item/ui entries first (auto-populate project glossary with short translated names), then dialogue entries sequentially with the enriched glossary and 3-line context from the same file.

**Architecture:** `translate_batch` splits entries into Phase 1 (item/ui/general files) and Phase 2 (dialogue files). Phase 1 runs first — short translations (source ≤ 20 chars) are auto-inserted into the project glossary if not already present. Phase 2 re-fetches the enriched glossary, then processes dialogue files sequentially with context lines from DB. No parallelism — Ollama processes one request at a time locally. Concurrency slider removed from UI.

**Tech Stack:** SQLite migration (timestamps on glossary), Rust/SQLx (2 new queries), Rust async (sequential Phase 1 → Phase 2 loop), React/TypeScript (remove concurrency from hook + BatchControls + TranslationView).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src-tauri/migrations/008_glossary_timestamps.sql` | Create | Add `created_at`, `updated_at` columns to glossary |
| `src-tauri/migrations/009_glossary_global_usage.sql` | Create | Junction table tracking which projects use each global term |
| `src-tauri/src/db/queries.rs` | Modify | Add `get_preceding_translated()` + `bulk_insert_auto_glossary()` queries, update `update_glossary_term()` to set `updated_at` |
| `src-tauri/src/commands/ollama.rs` | Modify | Add `format_context_block()`, update `build_translate_prompt()` signature, rewrite `translate_batch` with Phase 1 / Phase 2 split, remove `concurrency` param |
| `src/hooks/useTranslationBatch.ts` | Modify | Remove `concurrency` param from `start()` and `invoke` call |
| `src/features/translation/BatchControls.tsx` | Modify | Remove `concurrency`/`onConcurrencyChange` props and Concurrency UI section |
| `src/features/translation/TranslationView.tsx` | Modify | Remove `concurrency` state and all its usages |

---

## Task 1: DB migration — add timestamps to glossary

**Files:**
- Create: `src-tauri/migrations/008_glossary_timestamps.sql`

- [ ] **Step 1: Write the migration file**

```sql
ALTER TABLE glossary ADD COLUMN created_at TEXT;
ALTER TABLE glossary ADD COLUMN updated_at TEXT;
```

Existing rows will have NULL for both — acceptable, they predate the feature.

- [ ] **Step 2: Run cargo test to verify migration applies cleanly**

```bash
cd src-tauri && cargo test 2>&1 | grep -E "^error|FAILED|migration" | head -20
```

Expected: all existing tests pass (sqlx runs migrations on the test DB automatically via `setup_test_db()`).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/migrations/008_glossary_timestamps.sql
git commit -m "feat(db): add created_at and updated_at columns to glossary"
```

---

## Task 2: DB queries — `get_preceding_translated` + `bulk_insert_auto_glossary`

**Files:**
- Modify: `src-tauri/src/db/queries.rs`

- [ ] **Step 1: Write the failing tests**

At the bottom of `queries.rs` in the `#[cfg(test)]` block, add:

```rust
#[tokio::test]
async fn test_get_preceding_translated_returns_ordered() {
    let pool = setup_test_db().await;
    sqlx::query("INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index) VALUES ('e1','p1','こんにちは','Hello.','translated','mps/Map001.json',0)").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index) VALUES ('e2','p1','ありがとう','Thank you.','translated','mps/Map001.json',1)").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO entries (id, project_id, source_text, status, file_path, order_index) VALUES ('e3','p1','さようなら','pending','mps/Map001.json',2)").execute(&pool).await.unwrap();

    let result = get_preceding_translated(&pool, "p1", "mps/Map001.json", 2, 3).await.unwrap();
    assert_eq!(result.len(), 2);
    assert_eq!(result[0].0, "こんにちは");
    assert_eq!(result[0].1, "Hello.");
    assert_eq!(result[1].0, "ありがとう");
    assert_eq!(result[1].1, "Thank you.");
}

#[tokio::test]
async fn test_get_preceding_translated_ignores_pending() {
    let pool = setup_test_db().await;
    sqlx::query("INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index) VALUES ('e1','p1','こんにちは','Hello.','pending','mps/Map001.json',0)").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO entries (id, project_id, source_text, status, file_path, order_index) VALUES ('e2','p1','さようなら','pending','mps/Map001.json',1)").execute(&pool).await.unwrap();

    let result = get_preceding_translated(&pool, "p1", "mps/Map001.json", 1, 3).await.unwrap();
    assert_eq!(result.len(), 0);
}

#[tokio::test]
async fn test_get_preceding_translated_respects_limit() {
    let pool = setup_test_db().await;
    for i in 0..5i64 {
        let id = format!("e{}", i);
        let src = format!("src{}", i);
        let tgt = format!("tgt{}", i);
        sqlx::query("INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index) VALUES (?,?,?,?,'translated','mps/Map001.json',?)")
            .bind(&id).bind("p1").bind(&src).bind(&tgt).bind(i)
            .execute(&pool).await.unwrap();
    }
    let result = get_preceding_translated(&pool, "p1", "mps/Map001.json", 5, 3).await.unwrap();
    assert_eq!(result.len(), 3);
    assert_eq!(result[0].0, "src2");
    assert_eq!(result[2].0, "src4");
}

#[tokio::test]
async fn test_bulk_insert_auto_glossary_inserts_new() {
    let pool = setup_test_db().await;
    sqlx::query("INSERT INTO projects (id, name, game_dir, engine, target_lang) VALUES ('p1','Test','dir','wolf_rpg','en')")
        .execute(&pool).await.unwrap();

    let terms = vec![
        ("勇者".to_string(), "Hero".to_string()),
        ("剣".to_string(), "Sword".to_string()),
    ];
    let inserted = bulk_insert_auto_glossary(&pool, "p1", &terms).await.unwrap();
    assert_eq!(inserted, 2);

    let row: (String, String, Option<String>, Option<String>) = sqlx::query_as(
        "SELECT source_term, target_term, created_at, updated_at FROM glossary WHERE project_id = 'p1' AND source_term = '勇者'"
    ).fetch_one(&pool).await.unwrap();
    assert_eq!(row.0, "勇者");
    assert_eq!(row.1, "Hero");
    assert!(row.2.is_some(), "created_at should be set");
    assert!(row.3.is_some(), "updated_at should be set");
}

#[tokio::test]
async fn test_bulk_insert_auto_glossary_skips_existing() {
    let pool = setup_test_db().await;
    sqlx::query("INSERT INTO projects (id, name, game_dir, engine, target_lang) VALUES ('p1','Test','dir','wolf_rpg','en')")
        .execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO glossary (id, project_id, source_term, target_term, target_lang) VALUES ('g1','p1','勇者','Hero','en')")
        .execute(&pool).await.unwrap();

    let terms = vec![
        ("勇者".to_string(), "Brave Hero".to_string()), // already exists — skip
        ("剣".to_string(), "Sword".to_string()),         // new — insert
    ];
    let inserted = bulk_insert_auto_glossary(&pool, "p1", &terms).await.unwrap();
    assert_eq!(inserted, 1); // only 剣 was inserted

    let existing: (String,) = sqlx::query_as(
        "SELECT target_term FROM glossary WHERE project_id = 'p1' AND source_term = '勇者'"
    ).fetch_one(&pool).await.unwrap();
    assert_eq!(existing.0, "Hero"); // unchanged
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src-tauri && cargo test test_get_preceding_translated test_bulk_insert_auto_glossary 2>&1 | tail -15
```

Expected: FAIL with "cannot find function".

- [ ] **Step 3: Implement `get_preceding_translated`**

Add after the `get_entries_by_ids` function (around line 254):

```rust
pub async fn get_preceding_translated(
    pool: &SqlitePool,
    project_id: &str,
    file_path: &str,
    before_order: i64,
    limit: u32,
) -> anyhow::Result<Vec<(String, String)>> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT source_text, translation FROM entries
         WHERE project_id = ? AND file_path = ? AND order_index < ?
           AND status = 'translated' AND translation IS NOT NULL
         ORDER BY order_index DESC
         LIMIT ?",
    )
    .bind(project_id)
    .bind(file_path)
    .bind(before_order)
    .bind(limit as i64)
    .fetch_all(pool)
    .await?;
    let mut pairs = rows;
    pairs.reverse(); // DESC → ASC (chronological)
    Ok(pairs)
}
```

- [ ] **Step 4: Implement `bulk_insert_auto_glossary`**

Add immediately after `get_preceding_translated`:

```rust
/// Insert (source, target) pairs into the project glossary if they don't already exist.
/// Uses INSERT OR IGNORE to skip duplicates (unique index on project_id + source_term + target_lang).
/// Returns the number of rows actually inserted.
pub async fn bulk_insert_auto_glossary(
    pool: &SqlitePool,
    project_id: &str,
    terms: &[(String, String)],
) -> anyhow::Result<u32> {
    let mut inserted = 0u32;
    for (source, target) in terms {
        let id = uuid::Uuid::new_v4().to_string();
        let result = sqlx::query(
            "INSERT OR IGNORE INTO glossary
             (id, project_id, source_term, target_term, target_lang, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'en', datetime('now'), datetime('now'))",
        )
        .bind(&id)
        .bind(project_id)
        .bind(source)
        .bind(target)
        .execute(pool)
        .await?;
        if result.rows_affected() > 0 {
            inserted += 1;
        }
    }
    Ok(inserted)
}
```

- [ ] **Step 5: Update `update_glossary_term` to set `updated_at`**

Find the existing `update_glossary_term` function in `queries.rs`. Add `updated_at = datetime('now')` to its UPDATE query:

```rust
// BEFORE — find the UPDATE query inside update_glossary_term:
"UPDATE glossary SET source_term = ?, target_term = ? WHERE id = ?"

// AFTER:
"UPDATE glossary SET source_term = ?, target_term = ?, updated_at = datetime('now') WHERE id = ?"
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd src-tauri && cargo test test_get_preceding_translated test_bulk_insert_auto_glossary 2>&1 | tail -15
```

Expected: 5 tests pass.

- [ ] **Step 7: Run full test suite**

```bash
cd src-tauri && cargo test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/db/queries.rs
git commit -m "feat(db): add get_preceding_translated + bulk_insert_auto_glossary queries"
```

---

## Task 3: `format_context_block` + update `build_translate_prompt`

**Files:**
- Modify: `src-tauri/src/commands/ollama.rs`

- [ ] **Step 1: Write failing tests**

In the `#[cfg(test)]` block at the bottom of `ollama.rs`, add:

```rust
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
    let context = format_context_block(&[
        ("おはよう".to_string(), "Good morning.".to_string()),
    ]);
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src-tauri && cargo test test_format_context_block test_build_translate_prompt_with_context test_build_translate_prompt_no_context 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Add `format_context_block`**

After the `format_glossary_block` function (around line 108), add:

```rust
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
```

- [ ] **Step 4: Update `build_translate_prompt` to accept a context block**

Replace the existing `build_translate_prompt` function:

```rust
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
```

- [ ] **Step 5: Fix existing call site and tests**

Find the existing call site in `translate_batch` (around line 249):

```rust
let prompt = build_translate_prompt(&gb, &simplified);
```

Replace with:

```rust
let prompt = build_translate_prompt(&gb, "", &simplified);
```

Fix the existing tests `test_build_translate_prompt_reads_json` and `test_build_translate_prompt_includes_glossary`:

```rust
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
```

- [ ] **Step 6: Run all tests**

```bash
cd src-tauri && cargo test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/ollama.rs
git commit -m "feat(ollama): add format_context_block + context_block param to build_translate_prompt"
```

---

## Task 4: Rewrite `translate_batch` — Phase 1 → auto-glossary → Phase 2

**Files:**
- Modify: `src-tauri/src/commands/ollama.rs`

Two phases:
- **Phase 1** — item/ui/general files, no context. Short translated entries (source ≤ 20 chars) collected for auto-glossary.
- **Auto-inject** — inserts collected terms into project glossary (skip if exists), re-fetches enriched glossary.
- **Phase 2** — dialogue files, sequential with 3-line context from DB.

- [ ] **Step 1: Remove `concurrency: u32` from the `translate_batch` signature**

Find (around line 150):

```rust
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
```

Replace with:

```rust
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
```

- [ ] **Step 2: Make `term_pairs` mutable**

Find (around line 170):

```rust
let term_pairs: Vec<(String, String)> = glossary_terms
```

Change to:

```rust
let mut term_pairs: Vec<(String, String)> = glossary_terms
```

- [ ] **Step 3: Replace the loop body with Phase 1 / auto-inject / Phase 2**

Find `let total = entries.len() as u32;` in `translate_batch`. Replace everything from that line to `while join_set.join_next().await.is_some() {}` with:

```rust
    let total = entries.len() as u32;
    let cancel = cancel_flag.inner().clone();
    let pool_inner = pool.inner().clone();

    // Split entries into phase1 (item/ui/general) and phase2 (dialogue)
    let mut phase1_groups: std::collections::BTreeMap<String, Vec<TranslationEntry>> =
        std::collections::BTreeMap::new();
    let mut phase2_groups: std::collections::BTreeMap<String, Vec<TranslationEntry>> =
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
                    // Collect short entries for auto-glossary (source ≤ 20 chars)
                    if entry.source_text.chars().count() <= 20 {
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
        // Re-fetch enriched glossary so Phase 2 benefits from the new terms
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
                3,
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
```

- [ ] **Step 4: Fix the notification block**

The notification block immediately after (already in the file) references `done_count` which no longer exists. Find:

```rust
let done = done_count.load(Ordering::Relaxed);
let cancelled = cancel_flag.load(Ordering::Relaxed);
```

Delete the first line — `done` is already the final counter from the loops above:

```rust
let cancelled = cancel_flag.load(Ordering::Relaxed);
```

- [ ] **Step 5: Run cargo check**

```bash
cd src-tauri && cargo check 2>&1 | grep "^error" | head -20
```

Expected: 0 errors. Fix any type mismatches before continuing.

- [ ] **Step 6: Run full test suite**

```bash
cd src-tauri && cargo test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/ollama.rs
git commit -m "feat(ollama): Phase 1 item/ui → auto-glossary → Phase 2 dialogue with context lines"
```

---

## Task 5: Remove concurrency from the frontend stack

**Files:**
- Modify: `src/hooks/useTranslationBatch.ts`
- Modify: `src/features/translation/BatchControls.tsx`
- Modify: `src/features/translation/TranslationView.tsx`

- [ ] **Step 1: Update `useTranslationBatch.ts`**

Replace the `start` function (lines 39–72):

```ts
const start = useCallback(async (
  projectId: string,
  model: string,
  ollamaHost: string,
  limit: number = 0,
  temperature: number = 0.3,
  entryIds?: string[],
) => {
  setRunning(true)
  setProgress(null)
  setBatchStarted()

  const unlisten = await listen<TranslationProgress>(
    'translation:progress',
    (e) => setProgress(e.payload),
  )

  try {
    await invoke('translate_batch', {
      projectId,
      model,
      ollamaHost,
      limit,
      temperature,
      entryIds: entryIds ?? null,
    })
  } finally {
    unlisten()
    setRunning(false)
    setBatchFinished()
  }
}, [])
```

- [ ] **Step 2: Update `BatchControls.tsx` — remove concurrency prop and UI**

Delete `CONCURRENCY_OPTIONS` constant (line 6):

```ts
// DELETE:
const CONCURRENCY_OPTIONS = [1, 2, 4, 8]
```

Remove from `BatchControlsProps` interface (lines 29–30):

```ts
// DELETE:
  concurrency: number
  onConcurrencyChange: (n: number) => void
```

Remove from the destructured function params (line 42):

```ts
// DELETE this line:
  concurrency, onConcurrencyChange,
```

Remove the entire Concurrency section from the `PopoverContent` (the `<div>` block containing `CONCURRENCY_OPTIONS.map`):

```tsx
// DELETE this entire block:
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Concurrency
              </p>
              <div className="flex items-center border border-border/50 rounded-md overflow-hidden">
                {CONCURRENCY_OPTIONS.map(n => (
                  <button key={n} onClick={() => onConcurrencyChange(n)}
                    className={`flex-1 h-7 text-[11px] font-mono transition-colors border-r border-border/40 last:border-r-0 ${
                      concurrency === n
                        ? 'bg-secondary text-secondary-foreground font-semibold'
                        : 'text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40'
                    }`}
                  >{n}×</button>
                ))}
              </div>
            </div>
```

- [ ] **Step 3: Update `TranslationView.tsx`**

Remove `concurrency` state (line 69):

```tsx
// DELETE:
const [concurrency, setConcurrency] = useState(4)
```

Update the two `start(...)` calls — remove `concurrency` as 4th argument:

```tsx
// Line 162 — BEFORE:
start(projectId, model, settings.ollamaHost, concurrency, limit, settings.temperature, ids)
// AFTER:
start(projectId, model, settings.ollamaHost, limit, settings.temperature, ids)

// Line 178 — BEFORE:
start(projectId, model, settings.ollamaHost, concurrency, limit, settings.temperature, warningIds)
// AFTER:
start(projectId, model, settings.ollamaHost, limit, settings.temperature, warningIds)
```

Remove the two concurrency props from `<BatchControls />` (lines 251–252):

```tsx
// DELETE:
          concurrency={concurrency}
          onConcurrencyChange={setConcurrency}
```

- [ ] **Step 4: TypeScript build check**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

Expected: 0 errors related to our changes.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTranslationBatch.ts \
        src/features/translation/BatchControls.tsx \
        src/features/translation/TranslationView.tsx
git commit -m "feat(ui): remove concurrency slider — translation is now sequential"
```

---

---

## Task 6: Track which projects use each global glossary term

**Files:**
- Create: `src-tauri/migrations/009_glossary_global_usage.sql`
- Modify: `src-tauri/src/db/queries.rs`

Many-to-many junction table: a global term can be used by N projects; a project can use N global terms. Populated automatically during Phase 1 auto-inject — when `bulk_insert_auto_glossary` finds a matching global term, it records usage via `INSERT OR IGNORE`. Enables future UI to display "used by: Project A, Project B" on each global term row.

- [ ] **Step 1: Write the migration file**

```sql
CREATE TABLE IF NOT EXISTS glossary_global_usage (
    global_term_id TEXT NOT NULL,
    project_id     TEXT NOT NULL,
    used_at        TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (global_term_id, project_id),
    FOREIGN KEY (global_term_id) REFERENCES glossary(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id)     REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_global_usage_project ON glossary_global_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_global_usage_term    ON glossary_global_usage(global_term_id);
```

- [ ] **Step 2: Run cargo test to verify migration applies cleanly**

```bash
cd src-tauri && cargo test 2>&1 | grep -E "^error|FAILED|migration" | head -20
```

Expected: all existing tests pass.

- [ ] **Step 3: Write failing tests**

Add to the `#[cfg(test)]` block in `queries.rs`:

```rust
#[tokio::test]
async fn test_record_global_term_usage_records_when_global_exists() {
    let pool = setup_test_db().await;
    sqlx::query("INSERT INTO projects (id, name, game_dir, engine, target_lang) VALUES ('p1','Test','dir','wolf_rpg','en')")
        .execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO glossary (id, project_id, source_term, target_term, target_lang) VALUES ('g1', NULL, '勇者', 'Hero', 'en')")
        .execute(&pool).await.unwrap();

    record_global_term_usage(&pool, "p1", "勇者", "en").await.unwrap();

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM glossary_global_usage WHERE global_term_id = 'g1' AND project_id = 'p1'"
    ).fetch_one(&pool).await.unwrap();
    assert_eq!(count.0, 1);
}

#[tokio::test]
async fn test_record_global_term_usage_ignores_when_no_global() {
    let pool = setup_test_db().await;
    sqlx::query("INSERT INTO projects (id, name, game_dir, engine, target_lang) VALUES ('p1','Test','dir','wolf_rpg','en')")
        .execute(&pool).await.unwrap();

    record_global_term_usage(&pool, "p1", "存在しない", "en").await.unwrap();

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM glossary_global_usage"
    ).fetch_one(&pool).await.unwrap();
    assert_eq!(count.0, 0);
}

#[tokio::test]
async fn test_record_global_term_usage_is_idempotent() {
    let pool = setup_test_db().await;
    sqlx::query("INSERT INTO projects (id, name, game_dir, engine, target_lang) VALUES ('p1','Test','dir','wolf_rpg','en')")
        .execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO glossary (id, project_id, source_term, target_term, target_lang) VALUES ('g1', NULL, '勇者', 'Hero', 'en')")
        .execute(&pool).await.unwrap();

    record_global_term_usage(&pool, "p1", "勇者", "en").await.unwrap();
    record_global_term_usage(&pool, "p1", "勇者", "en").await.unwrap(); // second call — no error

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM glossary_global_usage WHERE global_term_id = 'g1' AND project_id = 'p1'"
    ).fetch_one(&pool).await.unwrap();
    assert_eq!(count.0, 1); // still just 1 row
}

#[tokio::test]
async fn test_bulk_insert_auto_glossary_records_global_usage() {
    let pool = setup_test_db().await;
    sqlx::query("INSERT INTO projects (id, name, game_dir, engine, target_lang) VALUES ('p1','Test','dir','wolf_rpg','en')")
        .execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO glossary (id, project_id, source_term, target_term, target_lang) VALUES ('g1', NULL, '勇者', 'Hero', 'en')")
        .execute(&pool).await.unwrap();

    let terms = vec![
        ("勇者".to_string(), "Hero".to_string()),  // global exists → record usage
        ("剣".to_string(), "Sword".to_string()),    // no global → insert into project glossary
    ];
    bulk_insert_auto_glossary(&pool, "p1", &terms).await.unwrap();

    let usage: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM glossary_global_usage WHERE global_term_id = 'g1' AND project_id = 'p1'"
    ).fetch_one(&pool).await.unwrap();
    assert_eq!(usage.0, 1);

    let proj: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM glossary WHERE project_id = 'p1' AND source_term = '剣'"
    ).fetch_one(&pool).await.unwrap();
    assert_eq!(proj.0, 1);
}
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd src-tauri && cargo test test_record_global_term_usage test_bulk_insert_auto_glossary_records_global_usage 2>&1 | tail -15
```

Expected: FAIL with "cannot find function".

- [ ] **Step 5: Implement `record_global_term_usage`**

Add immediately after `bulk_insert_auto_glossary` in `queries.rs`:

```rust
pub async fn record_global_term_usage(
    pool: &SqlitePool,
    project_id: &str,
    source_term: &str,
    target_lang: &str,
) -> anyhow::Result<()> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM glossary WHERE project_id IS NULL AND source_term = ? AND target_lang = ?",
    )
    .bind(source_term)
    .bind(target_lang)
    .fetch_optional(pool)
    .await?;

    if let Some((global_id,)) = row {
        sqlx::query(
            "INSERT OR IGNORE INTO glossary_global_usage (global_term_id, project_id) VALUES (?, ?)",
        )
        .bind(&global_id)
        .bind(project_id)
        .execute(pool)
        .await?;
    }
    Ok(())
}
```

- [ ] **Step 6: Update `bulk_insert_auto_glossary` to call `record_global_term_usage`**

Replace the existing `bulk_insert_auto_glossary` function (from Task 2, Step 4):

```rust
pub async fn bulk_insert_auto_glossary(
    pool: &SqlitePool,
    project_id: &str,
    terms: &[(String, String)],
) -> anyhow::Result<u32> {
    let mut inserted = 0u32;
    for (source, target) in terms {
        let id = uuid::Uuid::new_v4().to_string();
        let result = sqlx::query(
            "INSERT OR IGNORE INTO glossary
             (id, project_id, source_term, target_term, target_lang, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'en', datetime('now'), datetime('now'))",
        )
        .bind(&id)
        .bind(project_id)
        .bind(source)
        .bind(target)
        .execute(pool)
        .await?;
        if result.rows_affected() > 0 {
            inserted += 1;
        }
        // Record usage if a matching global term exists (INSERT OR IGNORE — idempotent)
        let _ = record_global_term_usage(pool, project_id, source, "en").await;
    }
    Ok(inserted)
}
```

- [ ] **Step 7: Add `get_global_term_projects` for future UI reads**

Add after `record_global_term_usage`:

```rust
pub async fn get_global_term_projects(
    pool: &SqlitePool,
    global_term_id: &str,
) -> anyhow::Result<Vec<(String, String, String)>> {
    // Returns (project_id, project_name, used_at)
    let rows: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT p.id, p.name, u.used_at
         FROM glossary_global_usage u
         JOIN projects p ON p.id = u.project_id
         WHERE u.global_term_id = ?
         ORDER BY u.used_at DESC",
    )
    .bind(global_term_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}
```

- [ ] **Step 8: Run all tests**

```bash
cd src-tauri && cargo test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src-tauri/migrations/009_glossary_global_usage.sql \
        src-tauri/src/db/queries.rs
git commit -m "feat(db): track which projects use each global glossary term"
```

---

## Summary of commits

| # | Message |
|---|---------|
| 1 | `feat(db): add created_at and updated_at columns to glossary` |
| 2 | `feat(db): add get_preceding_translated + bulk_insert_auto_glossary queries` |
| 3 | `feat(ollama): add format_context_block + context_block param to build_translate_prompt` |
| 4 | `feat(ollama): Phase 1 item/ui → auto-glossary → Phase 2 dialogue with context lines` |
| 5 | `feat(ui): remove concurrency slider — translation is now sequential` |
| 6 | `feat(db): track which projects use each global glossary term` |

## What does NOT change

- Refine pass (`refine_batch`) — unchanged, still uses its own concurrency + semaphore
- DB schema beyond migration 008 — no other changes needed
- `infer_text_type()` — used as-is
- `build_review_prompt` — unchanged
- `limit` param — still works (applies to total entries before splitting into phases)
- Global glossary — auto-insert targets project glossary only
