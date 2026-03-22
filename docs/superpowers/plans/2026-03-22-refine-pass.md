# Refine Pass Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second-pass "refine" feature that sends already-translated entries to a thinking model (hoshi-translator-30b) for quality review, placeholder count validation, and improvement.

**Architecture:** Extend the `entries` table with 6 new columns (`refined_text`, `refined_status`, `ph_count_source`, `ph_count_draft`, `ph_count_refined`, `text_type`, `refined_at`). A new Rust command `refine_batch` mirrors `translate_batch` but sends `(encoded_source, encoded_draft)` to the review model with a critique prompt, compares output to draft, and sets `refined_status`. Injection uses `COALESCE(refined_text, translation)` so refined text is exported automatically. UI adds a "Refine" button alongside Export and shows `refined_text` with a diff indicator in the translation row.

**Tech Stack:** Rust (sqlx, tokio, ollama-rs), SQLite migration, React 19, TanStack Query, Zustand, shadcn/ui, Tauri v2 IPC.

---

## Chunk 1: DB migration + Rust model update

### Task 1: DB migration — add refine columns to `entries`

**Files:**
- Create: `src-tauri/migrations/002_refine_columns.sql`
- Modify: `src-tauri/src/models/translation.rs`

- [ ] **Step 1: Write the migration file**

```sql
-- 002_refine_columns.sql
-- Adds refinement columns to entries. All nullable — existing rows unaffected.
ALTER TABLE entries ADD COLUMN refined_text     TEXT;
ALTER TABLE entries ADD COLUMN refined_status   TEXT;     -- 'reviewed' | 'unchanged' | 'manual'
ALTER TABLE entries ADD COLUMN ph_count_source  INTEGER;  -- {{...}} count in encoded source
ALTER TABLE entries ADD COLUMN ph_count_draft   INTEGER;  -- {{...}} count in encoded draft
ALTER TABLE entries ADD COLUMN ph_count_refined INTEGER;  -- {{...}} count in encoded refined
ALTER TABLE entries ADD COLUMN text_type        TEXT;     -- 'dialogue' | 'item' | 'ui' | 'general'
ALTER TABLE entries ADD COLUMN refined_at       INTEGER;  -- unix timestamp
```

- [ ] **Step 2: Update `TranslationEntry` struct to include new fields**

In `src-tauri/src/models/translation.rs`, update the struct:

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct TranslationEntry {
    pub id: String,
    pub project_id: String,
    pub source_text: String,
    pub translation: Option<String>,
    pub status: String,
    pub context: Option<String>,
    pub file_path: String,
    pub order_index: i64,
    // Refine-pass fields (all nullable — None before refine is run)
    pub refined_text: Option<String>,
    pub refined_status: Option<String>,
    pub ph_count_source: Option<i64>,
    pub ph_count_draft: Option<i64>,
    pub ph_count_refined: Option<i64>,
    pub text_type: Option<String>,
    pub refined_at: Option<i64>,
}
```

Also add the `RefinedStatus` enum below `TranslationStatus`:

```rust
/// Status of the refine pass for an entry.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RefinedStatus {
    /// Thinking model changed at least one character.
    Reviewed,
    /// Thinking model returned identical text — draft was already correct.
    Unchanged,
    /// User manually edited the refined_text.
    Manual,
}

impl RefinedStatus {
    pub fn as_db_str(&self) -> &'static str {
        match self {
            Self::Reviewed  => "reviewed",
            Self::Unchanged => "unchanged",
            Self::Manual    => "manual",
        }
    }
}
```

- [ ] **Step 3: Add tests for `RefinedStatus`**

In the `#[cfg(test)]` block of `translation.rs`:

```rust
#[test]
fn test_refined_status_reviewed_str() {
    assert_eq!(RefinedStatus::Reviewed.as_db_str(), "reviewed");
}

#[test]
fn test_refined_status_unchanged_str() {
    assert_eq!(RefinedStatus::Unchanged.as_db_str(), "unchanged");
}

#[test]
fn test_refined_status_manual_str() {
    assert_eq!(RefinedStatus::Manual.as_db_str(), "manual");
}
```

- [ ] **Step 4: Run tests**

```bash
cd src-tauri && cargo test models::translation
```

Expected: all 3 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/migrations/002_refine_columns.sql src-tauri/src/models/translation.rs
git commit -m "feat: add refine-pass columns to entries table and RefinedStatus enum"
```

---

### Task 2: Update DB queries for refine pass

**Files:**
- Modify: `src-tauri/src/db/queries.rs`

- [ ] **Step 1: Write failing tests first**

Add to the `#[cfg(test)] mod tests` block in `queries.rs`:

```rust
#[tokio::test]
async fn test_update_refined_sets_reviewed_status() {
    let dir = tempfile::tempdir().unwrap();
    let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();
    create_project(&pool, "p1", "/g", "rpgmaker_mv_mz", "T", "en", None).await.unwrap();
    sqlx::query(
        "INSERT INTO entries (id, project_id, source_text, status, file_path, order_index)
         VALUES ('e1', 'p1', 'こんにちは', 'translated', 'f', 0)"
    ).execute(&pool).await.unwrap();

    update_refined(&pool, "e1", "Hello.", "reviewed", 0, 0, 0, "dialogue", 1_000_000).await.unwrap();

    let row: (Option<String>, Option<String>, Option<i64>, Option<i64>) = sqlx::query_as(
        "SELECT refined_text, refined_status, ph_count_source, ph_count_draft FROM entries WHERE id = 'e1'"
    ).fetch_one(&pool).await.unwrap();
    assert_eq!(row.0.as_deref(), Some("Hello."));
    assert_eq!(row.1.as_deref(), Some("reviewed"));
    assert_eq!(row.2, Some(0));
    assert_eq!(row.3, Some(0));
}

#[tokio::test]
async fn test_get_refinable_entries_returns_translated() {
    let dir = tempfile::tempdir().unwrap();
    let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();
    create_project(&pool, "p1", "/g", "rpgmaker_mv_mz", "T", "en", None).await.unwrap();
    sqlx::query(
        "INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index)
         VALUES ('e1', 'p1', 'こんにちは', 'Hello', 'translated', 'f', 0)"
    ).execute(&pool).await.unwrap();
    sqlx::query(
        "INSERT INTO entries (id, project_id, source_text, status, file_path, order_index)
         VALUES ('e2', 'p1', 'ありがとう', 'pending', 'f', 1)"
    ).execute(&pool).await.unwrap();

    let refinable = get_refinable_entries(&pool, "p1", &[] as &[String]).await.unwrap();
    assert_eq!(refinable.len(), 1);
    assert_eq!(refinable[0].id, "e1");
}

#[tokio::test]
async fn test_update_refined_manual() {
    let dir = tempfile::tempdir().unwrap();
    let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();
    create_project(&pool, "p1", "/g", "rpgmaker_mv_mz", "T", "en", None).await.unwrap();
    sqlx::query(
        "INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index)
         VALUES ('e1', 'p1', 'こんにちは', 'Hello', 'translated', 'f', 0)"
    ).execute(&pool).await.unwrap();

    update_refined_manual(&pool, "e1", "Hi there.").await.unwrap();

    let row: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT refined_text, refined_status FROM entries WHERE id = 'e1'"
    ).fetch_one(&pool).await.unwrap();
    assert_eq!(row.0.as_deref(), Some("Hi there."));
    assert_eq!(row.1.as_deref(), Some("manual"));
}
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd src-tauri && cargo test test_update_refined 2>&1 | grep -E "FAILED|error"
```

Expected: compile error (functions don't exist yet).

- [ ] **Step 3: Add query functions**

Add the following functions to `src-tauri/src/db/queries.rs`:

```rust
/// Write refined output back to the entry after the review pass.
pub async fn update_refined(
    pool: &SqlitePool,
    entry_id: &str,
    refined_text: &str,
    refined_status: &str,   // "reviewed" | "unchanged"
    ph_count_source: i64,
    ph_count_draft: i64,
    ph_count_refined: i64,
    text_type: &str,
    refined_at: i64,
) -> anyhow::Result<()> {
    sqlx::query(
        "UPDATE entries
         SET refined_text = ?, refined_status = ?,
             ph_count_source = ?, ph_count_draft = ?, ph_count_refined = ?,
             text_type = ?, refined_at = ?
         WHERE id = ?",
    )
    .bind(refined_text)
    .bind(refined_status)
    .bind(ph_count_source)
    .bind(ph_count_draft)
    .bind(ph_count_refined)
    .bind(text_type)
    .bind(refined_at)
    .bind(entry_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// User manually edited refined_text — mark as manual.
pub async fn update_refined_manual(
    pool: &SqlitePool,
    entry_id: &str,
    refined_text: &str,
) -> anyhow::Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    sqlx::query(
        "UPDATE entries SET refined_text = ?, refined_status = 'manual', refined_at = ? WHERE id = ?",
    )
    .bind(refined_text)
    .bind(now)
    .bind(entry_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Returns entries eligible for the refine pass: status is 'translated' or 'warning:missing_placeholder'.
/// If `ids` is non-empty, limits to those specific IDs (and still checks status).
pub async fn get_refinable_entries(
    pool: &SqlitePool,
    project_id: &str,
    ids: &[String],
) -> anyhow::Result<Vec<crate::models::TranslationEntry>> {
    // Fetch all translated/warning entries for the project first, then optionally filter by IDs.
    // Using a simpler approach: fetch all eligible then filter in Rust if IDs provided.
    let rows: Vec<crate::models::TranslationEntry> = sqlx::query_as(
        "SELECT id, project_id, source_text, translation, status, context, file_path, order_index,
                refined_text, refined_status, ph_count_source, ph_count_draft, ph_count_refined,
                text_type, refined_at
         FROM entries
         WHERE project_id = ?
           AND (status = 'translated' OR status LIKE 'warning:%')
           AND translation IS NOT NULL
         ORDER BY file_path, order_index",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    if ids.is_empty() {
        return Ok(rows);
    }
    let id_set: std::collections::HashSet<&str> = ids.iter().map(|s| s.as_str()).collect();
    Ok(rows.into_iter().filter(|e| id_set.contains(e.id.as_str())).collect())
}
```

Also update `get_entries` and `get_translated_entries_ordered` to select the new columns:

In `get_entries`, change the SELECT:
```rust
"SELECT id, project_id, source_text, translation, status, context, file_path, order_index,
        refined_text, refined_status, ph_count_source, ph_count_draft, ph_count_refined,
        text_type, refined_at
 FROM entries
 WHERE project_id = ?
 AND (? IS NULL OR status = ?)
 AND (? IS NULL OR file_path = ?)
 ORDER BY file_path, order_index"
```

In `get_translated_entries_ordered`, change the SELECT and also update it to use refined_text for injection:
```rust
"SELECT id, project_id,
        source_text,
        COALESCE(refined_text, translation) AS translation,
        status, context, file_path, order_index,
        refined_text, refined_status, ph_count_source, ph_count_draft, ph_count_refined,
        text_type, refined_at
 FROM entries
 WHERE project_id = ?
 AND status IN ('translated', 'reviewed', 'warning')
 ORDER BY file_path, order_index"
```

Also update `get_entries_by_ids` to select new columns:
```rust
let sql = format!(
    "SELECT id, project_id, source_text, translation, status, context, file_path, order_index,
            refined_text, refined_status, ph_count_source, ph_count_draft, ph_count_refined,
            text_type, refined_at
     FROM entries WHERE id IN ({}) ORDER BY file_path, order_index",
    placeholders
);
```

- [ ] **Step 4: Run all DB tests**

```bash
cd src-tauri && cargo test db::
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/db/queries.rs
git commit -m "feat: add update_refined, update_refined_manual, get_refinable_entries queries"
```

---

## Chunk 2: Rust `refine_batch` command

### Task 3: Helpers — placeholder count and text type inference

**Files:**
- Modify: `src-tauri/src/commands/ollama.rs`

The refine batch needs two small helpers. Add them to `ollama.rs` (or a shared location if you prefer — keeping in `ollama.rs` is fine since refine uses the same Ollama client).

- [ ] **Step 1: Write failing tests**

Add to `#[cfg(test)] mod tests` in `ollama.rs`:

```rust
#[test]
fn test_count_placeholders_zero() {
    assert_eq!(count_placeholders("Hello world"), 0);
}

#[test]
fn test_count_placeholders_one() {
    assert_eq!(count_placeholders("{{WOLF_NL}}"), 1);
}

#[test]
fn test_count_placeholders_multiple() {
    assert_eq!(count_placeholders("{{WOLF_AT[1]}}{{WOLF_NL}}\"{{WOLF_CSELF[8]}}\" obtained."), 3);
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
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd src-tauri && cargo test test_count_placeholders 2>&1 | grep -E "error|FAILED"
```

Expected: compile error.

- [ ] **Step 3: Implement helpers**

Add to `ollama.rs` (before `translate_batch`):

```rust
/// Count the number of `{{...}}` placeholder tokens in a string.
/// Used to compare placeholder counts between source, draft, and refined text.
pub fn count_placeholders(text: &str) -> i64 {
    static PH_RE: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"\{\{[^}]+\}\}").unwrap());
    PH_RE.find_iter(text).count() as i64
}

/// Infer the semantic type of a string from its file path.
/// Used to give the review model additional context.
pub fn infer_text_type(file_path: &str) -> &'static str {
    let lower = file_path.to_lowercase();
    let item_keywords = ["item", "weapon", "armor", "skill", "actor", "class", "enemy",
                         "troop", "state", "アイテム", "武器", "防具", "スキル"];
    let ui_keywords = ["system", "game.json"];
    let dialogue_keywords = ["mps/", "common/", "map"];

    if item_keywords.iter().any(|k| lower.contains(k)) {
        "item"
    } else if ui_keywords.iter().any(|k| lower.contains(k)) {
        "ui"
    } else if dialogue_keywords.iter().any(|k| lower.contains(k)) {
        "dialogue"
    } else {
        "general"
    }
}
```

- [ ] **Step 4: Run helper tests**

```bash
cd src-tauri && cargo test test_count_placeholders test_infer_text_type
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/ollama.rs
git commit -m "feat: add count_placeholders and infer_text_type helpers"
```

---

### Task 4: Implement `refine_batch` Tauri command

**Files:**
- Modify: `src-tauri/src/commands/ollama.rs`
- Modify: `src-tauri/src/lib.rs` (register command)

- [ ] **Step 1: Write a unit test for the review prompt builder**

Add to `#[cfg(test)] mod tests` in `ollama.rs`:

```rust
#[test]
fn test_build_review_prompt_includes_source_and_draft() {
    let prompt = build_review_prompt("こんにちは", "Hello", 0, 0, "English");
    assert!(prompt.contains("こんにちは"));
    assert!(prompt.contains("Hello"));
    assert!(prompt.contains("English"));
}

#[test]
fn test_build_review_prompt_includes_placeholder_counts() {
    let prompt = build_review_prompt("{{PH:n[1]}}は戦士", "{{PH:n[1]}} is a warrior", 1, 1, "English");
    assert!(prompt.contains("1"));
}
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd src-tauri && cargo test test_build_review_prompt 2>&1 | grep -E "error|FAILED"
```

- [ ] **Step 3: Implement `build_review_prompt` and `refine_batch`**

Add to `ollama.rs`:

```rust
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
pub async fn cancel_refine(cancel_refine_flag: tauri::State<'_, Arc<AtomicBool>>) -> Result<(), String> {
    // Re-uses the same cancel flag — only one batch/refine may run at a time.
    cancel_refine_flag.store(true, Ordering::Relaxed);
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
                None => return, // no draft to refine — skip silently
            };

            // Encode both source and draft so the model reasons in {{...}} form
            let encoded_source = if is_wolf {
                wolf_ph::encode(&entry.source_text)
            } else {
                rpgmaker_ph::encode(&entry.source_text)
            };
            let encoded_draft = if is_wolf {
                wolf_ph::encode(&draft)
            } else {
                rpgmaker_ph::encode(&draft)
            };

            let ph_count_source = count_placeholders(&encoded_source);
            let ph_count_draft = count_placeholders(&encoded_draft);

            let lang_name = match target_lang.as_str() {
                "fr" => "French",
                _ => "English",
            };
            let prompt = build_review_prompt(
                &encoded_source,
                &encoded_draft,
                ph_count_source,
                ph_count_draft,
                lang_name,
            );

            let ollama = ollama_from_url(&ollama_host);
            // Thinking model needs temperature 0 for review (deterministic critique)
            let options = ollama_rs::models::ModelOptions::default().temperature(0.0);
            let request = GenerationRequest::new(model.clone(), prompt).options(options);

            match ollama.generate(request).await {
                Ok(response) => {
                    let raw = response.response.trim().replace("\\\"", "\"");
                    // Decode {{...}} tokens back to native game codes
                    let (decoded_refined, _intact) = if is_wolf {
                        wolf_ph::decode(&raw)
                    } else {
                        rpgmaker_ph::decode(&raw)
                    };
                    let ph_count_refined = count_placeholders(&raw); // count before decode

                    // Compare decoded_refined vs original draft (both decoded)
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
                    // Refine errors are non-fatal — log but don't change entry status
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
```

- [ ] **Step 4: Add `update_refined_manual` Tauri command in `entries.rs`**

In `src-tauri/src/commands/entries.rs`, add:

```rust
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
```

- [ ] **Step 5: Register new commands and state in `lib.rs`**

In `src-tauri/src/lib.rs`, find the `.manage()` calls and add:

```rust
.manage(crate::commands::ollama::RefineRunning(Arc::new(AtomicBool::new(false))))
```

In the `.invoke_handler(tauri::generate_handler![...])`, add:

```
commands::ollama::refine_batch,
commands::ollama::is_refine_running,
commands::ollama::cancel_refine,
commands::entries::update_refined_manual,
```

- [ ] **Step 6: Build to verify no compile errors**

```bash
cd src-tauri && cargo build 2>&1 | grep -E "^error"
```

Expected: no errors.

- [ ] **Step 7: Run all Rust tests**

```bash
cd src-tauri && cargo test
```

Expected: all tests pass (same count or more than before).

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands/ollama.rs src-tauri/src/commands/entries.rs src-tauri/src/lib.rs
git commit -m "feat: add refine_batch Tauri command with thinking-model review pass"
```

---

## Chunk 3: TypeScript types + React hook

### Task 5: Update TypeScript types and add `useRefineBatch` hook

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/hooks/useRefineBatch.ts`

- [ ] **Step 1: Update `TranslationEntry` in `src/types/index.ts`**

Add new fields to the interface:

```typescript
export type RefinedStatus = 'reviewed' | 'unchanged' | 'manual'

export interface TranslationEntry {
  id: string
  project_id: string
  source_text: string
  translation: string | null
  status: TranslationStatus
  context: string | null
  file_path: string
  order_index: number
  // Refine-pass fields — null before refine is run
  refined_text: string | null
  refined_status: RefinedStatus | null
  ph_count_source: number | null
  ph_count_draft: number | null
  ph_count_refined: number | null
  text_type: string | null
  refined_at: number | null
}
```

- [ ] **Step 2: Create `src/hooks/useRefineBatch.ts`**

```typescript
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { TranslationProgress } from '@/types'

export function useRefineBatch() {
  const [progress, setProgress] = useState<TranslationProgress | null>(null)
  const [running, setRunning] = useState(false)
  const unlistenRef = useRef<(() => void) | null>(null)
  const { setBatchStarted, setBatchFinished } = useAppStore()

  useEffect(() => {
    invoke<boolean>('is_refine_running').then(r => setRunning(r))

    const setup = async () => {
      const unlisten1 = await listen<TranslationProgress>('refine:progress', e => {
        setProgress(e.payload)
      })
      const unlisten2 = await listen('refine:complete', () => {
        setRunning(false)
        setProgress(null)
        setBatchFinished()
      })
      unlistenRef.current = () => { unlisten1(); unlisten2() }
    }
    setup()
    return () => { unlistenRef.current?.() }
  }, [])

  async function start(
    projectId: string,
    model: string,
    targetLang: string,
    ollamaHost: string,
    concurrency: number,
    entryIds?: string[],
  ) {
    setRunning(true)
    setProgress(null)
    setBatchStarted()
    try {
      await invoke('refine_batch', {
        projectId,
        model,
        targetLang,
        ollamaHost,
        concurrency,
        entryIds: entryIds ?? null,
      })
    } finally {
      setRunning(false)
      setBatchFinished()
    }
  }

  async function cancel() {
    await invoke('cancel_refine')
  }

  return { progress, running, start, cancel }
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /home/blackat/project/hoshi-trans && pnpm build 2>&1 | grep -E "error TS"
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/hooks/useRefineBatch.ts
git commit -m "feat: add RefinedStatus type, refine fields to TranslationEntry, useRefineBatch hook"
```

---

## Chunk 4: UI — Refine button + row display

### Task 6: Add Refine controls to `TranslationView`

**Files:**
- Modify: `src/features/translation/TranslationView.tsx`

The Refine button lives in the toolbar alongside Export. When running, it shows progress like the translate batch.

- [ ] **Step 1: Add `useRefineBatch` and Refine button**

At the top of `TranslationView.tsx`, import:
```typescript
import { useRefineBatch } from '@/hooks/useRefineBatch'
import { Wand2 } from 'lucide-react'
```

Inside `TranslationView`, after the `useTranslationBatch` line:
```typescript
const { progress: refineProgress, running: refining, start: startRefine, cancel: cancelRefine } = useRefineBatch()
```

Add a `refineModel` state alongside `selectedModel`:
```typescript
const [refineModel, setRefineModel] = useState<string>('')
const effectiveRefineModel = refineModel || availableModels.find(m => m.includes('hoshi-translator')) || availableModels[0] || ''
```

Add `handleRefine` function:
```typescript
function handleRefine() {
  const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
  setSelectedIds(new Set())
  startRefine(projectId, effectiveRefineModel, settings.targetLang, settings.ollamaHost, 1, ids)
}
```

In the toolbar (after the Export button), add:
```tsx
{/* Refine button — second-pass quality review with thinking model */}
{refining && (
  <div className="flex items-center gap-2 mr-1">
    <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">
      {refineProgress?.done}<span className="opacity-40">/</span>{refineProgress?.total}
    </span>
    <Button variant="ghost" size="sm" onClick={cancelRefine} className="h-7 px-2 text-xs text-muted-foreground/60 hover:text-destructive">
      <X className="w-3 h-3 mr-1" />Cancel refine
    </Button>
  </div>
)}

{selectedIds.size > 0 && !running && !refining && (
  <Button
    size="sm"
    variant="outline"
    onClick={handleRefine}
    disabled={!effectiveRefineModel}
    className="h-7 gap-1.5 text-xs font-medium px-3 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
  >
    <Wand2 className="w-3.5 h-3.5" />
    Refine {selectedIds.size} selected
  </Button>
)}

<Button
  size="sm"
  variant="outline"
  onClick={handleRefine}
  disabled={running || refining || !effectiveRefineModel}
  className="h-7 gap-1.5 text-xs font-medium px-3 border-amber-500/30 text-amber-400/80 hover:bg-amber-500/10"
>
  {refining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
  {refining ? 'Refining…' : 'Refine'}
</Button>
```

Also update the `STATUS_FILTERS` array to include `Reviewed`:
```typescript
const STATUS_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'pending' },
  { label: 'Translated', value: 'translated' },
  { label: 'Reviewed', value: 'reviewed' },   // ← add this
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
]
```

And add `'Reviewed'` to the `refetch` trigger by adding `refining` to the query effect:
```typescript
// After refine completes, refresh the table
useEffect(() => {
  if (!refining) refetch()
}, [refining])
```

- [ ] **Step 2: TypeScript check**

```bash
cd /home/blackat/project/hoshi-trans && pnpm build 2>&1 | grep -E "error TS"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/translation/TranslationView.tsx
git commit -m "feat: add Refine button and refine progress to TranslationView"
```

---

### Task 7: Show refined_text in `TranslationRow`

**Files:**
- Modify: `src/features/translation/TranslationRow.tsx`

Read the current file before editing to understand its structure.

- [ ] **Step 1: Read the file**

Read `src/features/translation/TranslationRow.tsx` fully before making changes.

- [ ] **Step 2: Add refined_text display and refined_status badge**

In the translation cell, show:
- If `entry.refined_text` is set and `entry.refined_status === 'reviewed'`: display `refined_text` with a subtle amber `✦` indicator before it, and show the original `translation` in a muted diff line below.
- If `entry.refined_status === 'unchanged'`: show `translation` as normal with a tiny `✓` badge.
- If `entry.refined_status === 'manual'`: show `refined_text` with a `✎` badge.

Example rendering pattern for the translation cell area:
```tsx
{/* Translation display — prefer refined_text if reviewed/manual */}
<div className="text-xs leading-relaxed whitespace-pre-wrap break-words">
  {entry.refined_text && entry.refined_status !== 'unchanged' ? (
    <>
      <span className="text-amber-400/70 mr-1 text-[9px]">
        {entry.refined_status === 'manual' ? '✎' : '✦'}
      </span>
      {entry.refined_text}
      {entry.refined_status === 'reviewed' && entry.translation && (
        <div className="mt-1 text-[9.5px] text-muted-foreground/30 line-through leading-relaxed">
          {entry.translation}
        </div>
      )}
    </>
  ) : (
    <>
      {entry.translation ?? <span className="text-muted-foreground/30 italic">not translated</span>}
      {entry.refined_status === 'unchanged' && (
        <span className="ml-1.5 text-[9px] text-emerald-500/50">✓</span>
      )}
    </>
  )}
</div>
```

Also add placeholder count mismatch warning badge when `ph_count_source !== ph_count_draft`:
```tsx
{entry.ph_count_source != null && entry.ph_count_draft != null
  && entry.ph_count_source !== entry.ph_count_draft && (
  <span className="text-[9px] text-amber-400/70 font-mono">
    ⚠ {entry.ph_count_draft}/{entry.ph_count_source} ph
  </span>
)}
```

- [ ] **Step 3: TypeScript check and visual test**

```bash
cd /home/blackat/project/hoshi-trans && pnpm build 2>&1 | grep -E "error TS"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/translation/TranslationRow.tsx
git commit -m "feat: show refined_text, refined_status badge, and placeholder count diff in TranslationRow"
```

---

## Final verification

- [ ] Run the full Rust test suite: `cd src-tauri && cargo test`
- [ ] Run TypeScript check: `pnpm build`
- [ ] Launch dev app: `pnpm tauri:linux` — verify:
  1. Translation table loads without errors (new nullable columns are transparent)
  2. "Refine" button appears in toolbar
  3. Selecting entries and clicking "Refine selected" triggers `refine_batch`
  4. After refine completes, rows with `reviewed` status show `✦ refined_text` with strikethrough draft
  5. Export (`inject_translations`) uses `refined_text` when available (via `COALESCE` in query)

---

## Summary of files changed

| File | Change |
|---|---|
| `src-tauri/migrations/002_refine_columns.sql` | New — 7 nullable columns added to `entries` |
| `src-tauri/src/models/translation.rs` | Updated `TranslationEntry` struct + `RefinedStatus` enum |
| `src-tauri/src/db/queries.rs` | New: `update_refined`, `update_refined_manual`, `get_refinable_entries`; updated SELECT in `get_entries`, `get_translated_entries_ordered`, `get_entries_by_ids` |
| `src-tauri/src/commands/ollama.rs` | New: `count_placeholders`, `infer_text_type`, `build_review_prompt`, `refine_batch`, `is_refine_running`, `cancel_refine`, `RefineRunning` |
| `src-tauri/src/commands/entries.rs` | New: `update_refined_manual` Tauri command |
| `src-tauri/src/lib.rs` | Register new state and commands |
| `src/types/index.ts` | Updated `TranslationEntry` + new `RefinedStatus` type |
| `src/hooks/useRefineBatch.ts` | New hook — mirrors `useTranslationBatch` for refine events |
| `src/features/translation/TranslationView.tsx` | Refine button, refine progress, Reviewed filter |
| `src/features/translation/TranslationRow.tsx` | Refined text display, status badge, placeholder count warning |
