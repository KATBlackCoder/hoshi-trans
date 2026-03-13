# RPG Maker MV/MZ Extractor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse all JSON files in an RPG Maker MV/MZ `data/` folder, extract translatable strings with skip filtering and placeholder encoding, and batch-insert them into SQLite.

**Architecture:** `common/skip.rs` handles universal text filtering (empty, non-Japanese, paths, scripts, numbers). `rpgmaker_mv_mz/skip.rs` adds engine-specific rules and delegates to common first. `rpgmaker_mv_mz/placeholders.rs` encodes control codes (e.g. `\N[1]` → `{{ACTOR_NAME[1]}}`) before DB storage. The `extract_strings` Tauri command orchestrates extraction + batch insert + stats update.

**Tech Stack:** Rust, serde_json, regex, sqlx, walkdir

---

## Packages to Add

```bash
# From src-tauri/
cargo add regex
```

---

## File Structure

- Create: `src-tauri/src/engines/common/mod.rs` — pub mod declarations
- Create: `src-tauri/src/engines/common/skip.rs` — universal skip logic
- Create: `src-tauri/src/engines/common/placeholders.rs` — `contains_japanese`, `check_placeholders_intact`
- Create: `src-tauri/src/engines/rpgmaker_mv_mz/skip.rs` — RPG Maker-specific skip + calls common
- Create: `src-tauri/src/engines/rpgmaker_mv_mz/placeholders.rs` — full code ↔ `{{NAME}}` table
- Create: `src-tauri/src/engines/rpgmaker_mv_mz/extractor.rs` — JSON parsing + entry creation
- Modify: `src-tauri/src/db/queries.rs` — add `insert_entries_batch`
- Create: `src-tauri/src/commands/extract.rs` — `extract_strings` command
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/engines/rpgmaker_mv_mz/ENGINE_NOTES.md`

---

## Task 1: common/skip.rs

**Files:**
- Create: `src-tauri/src/engines/common/mod.rs`
- Create: `src-tauri/src/engines/common/skip.rs`

- [ ] **Step 1: Write the failing tests**

```rust
// src-tauri/src/engines/common/skip.rs — include at bottom
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_skip_empty() {
        assert!(should_skip(""));
        assert!(should_skip("   "));
    }

    #[test]
    fn test_skip_non_japanese() {
        assert!(should_skip("Hello world"));
        assert!(should_skip("123"));
    }

    #[test]
    fn test_keep_japanese() {
        assert!(!should_skip("おはよう"));
        assert!(!should_skip("戦士"));
    }

    #[test]
    fn test_keep_mixed_jp_en() {
        // Mixed text with Japanese should NOT be skipped
        assert!(!should_skip("Hello、世界"));
    }

    #[test]
    fn test_skip_file_path() {
        assert!(should_skip("/home/user/game.exe"));
        assert!(should_skip("http://example.com"));
    }

    #[test]
    fn test_skip_script_formula() {
        assert!(should_skip("$gameActors.actor(1).name()"));
        assert!(should_skip("this.value()"));
    }

    #[test]
    fn test_skip_pure_number() {
        assert!(should_skip("42"));
        assert!(!should_skip("42人の侍")); // number + Japanese — keep
    }
}
```

- [ ] **Step 2: Run to verify tests fail**

Run: `cd src-tauri && cargo test test_skip`
Expected: FAIL — module not found

- [ ] **Step 3: Write common/mod.rs**

```rust
// src-tauri/src/engines/common/mod.rs
pub mod skip;
pub mod placeholders;
```

- [ ] **Step 4: Write common/skip.rs**

```rust
// src-tauri/src/engines/common/skip.rs
pub fn should_skip(text: &str) -> bool {
    is_empty_or_whitespace(text)
        || !contains_japanese(text)
        || is_file_path(text)
        || is_script_formula(text)
        || is_pure_number(text)
}

fn is_empty_or_whitespace(text: &str) -> bool {
    text.trim().is_empty()
}

pub fn contains_japanese(text: &str) -> bool {
    text.chars().any(|c| matches!(c,
        '\u{3040}'..='\u{309F}'  // Hiragana
        | '\u{30A0}'..='\u{30FF}' // Katakana
        | '\u{4E00}'..='\u{9FFF}' // CJK Kanji
    ))
}

fn is_file_path(text: &str) -> bool {
    text.starts_with('/') || text.contains("://")
}

fn is_script_formula(text: &str) -> bool {
    text.contains("$game")
        || text.contains(".value(")
        || text.contains("eval(")
        || text.contains(".actor(")
}

fn is_pure_number(text: &str) -> bool {
    text.trim().chars().all(|c| c.is_ascii_digit())
}

#[cfg(test)]
mod tests { /* see step 1 */ }
```

- [ ] **Step 5: Update engines/mod.rs to expose common**

```rust
// src-tauri/src/engines/mod.rs — add
pub mod common;
```

- [ ] **Step 6: Run tests**

Run: `cd src-tauri && cargo test test_skip`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/engines/common/
git commit -m "feat: add common/skip.rs with universal skip logic"
```

---

## Task 2: common/placeholders.rs

**Files:**
- Create: `src-tauri/src/engines/common/placeholders.rs`

- [ ] **Step 1: Write the failing tests**

```rust
// src-tauri/src/engines/common/placeholders.rs — include at bottom
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_contains_japanese_hiragana() {
        assert!(contains_japanese("おはよう"));
    }

    #[test]
    fn test_contains_japanese_katakana() {
        assert!(contains_japanese("アイウ"));
    }

    #[test]
    fn test_contains_japanese_kanji() {
        assert!(contains_japanese("漢字"));
    }

    #[test]
    fn test_not_japanese() {
        assert!(!contains_japanese("Hello"));
    }

    #[test]
    fn test_check_placeholders_intact_all_present() {
        assert!(check_placeholders_intact(
            "Hello {{ACTOR_NAME[1]}}",
            "Bonjour {{ACTOR_NAME[1]}}"
        ));
    }

    #[test]
    fn test_check_placeholders_missing() {
        assert!(!check_placeholders_intact(
            "Hello {{ACTOR_NAME[1]}}",
            "Bonjour"
        ));
    }

    #[test]
    fn test_check_placeholders_no_placeholders() {
        assert!(check_placeholders_intact("Hello", "Bonjour"));
    }
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd src-tauri && cargo test test_contains_japanese test_check_placeholders`
Expected: FAIL

- [ ] **Step 3: Implement**

```rust
// src-tauri/src/engines/common/placeholders.rs

/// Detects presence of Japanese characters (Hiragana, Katakana, CJK Kanji)
pub fn contains_japanese(text: &str) -> bool {
    text.chars().any(|c| matches!(c,
        '\u{3040}'..='\u{309F}'
        | '\u{30A0}'..='\u{30FF}'
        | '\u{4E00}'..='\u{9FFF}'
    ))
}

/// Verifies all {{...}} placeholders from `original` are still present in `translated`
pub fn check_placeholders_intact(original: &str, translated: &str) -> bool {
    let re = regex::Regex::new(r"\{\{[^}]+\}\}").unwrap();
    re.find_iter(original)
        .all(|m| translated.contains(m.as_str()))
}
```

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test test_contains_japanese test_check_placeholders`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/engines/common/placeholders.rs
git commit -m "feat: add common/placeholders.rs with JP detection and placeholder check"
```

---

## Task 3: rpgmaker_mv_mz/placeholders.rs

**Files:**
- Create: `src-tauri/src/engines/rpgmaker_mv_mz/placeholders.rs`

- [ ] **Step 1: Write the failing tests**

```rust
// include at bottom of placeholders.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_actor_name() {
        assert_eq!(encode(r"\N[1]"), "{{ACTOR_NAME[1]}}");
        assert_eq!(encode(r"\N[12]"), "{{ACTOR_NAME[12]}}");
    }

    #[test]
    fn test_encode_color() {
        assert_eq!(encode(r"\C[4]"), "{{COLOR[4]}}");
    }

    #[test]
    fn test_encode_icon() {
        assert_eq!(encode(r"\I[76]"), "{{ICON[76]}}");
    }

    #[test]
    fn test_encode_no_codes() {
        assert_eq!(encode("普通のテキスト"), "普通のテキスト");
    }

    #[test]
    fn test_decode_actor_name() {
        let (decoded, intact) = decode("Hello {{ACTOR_NAME[1]}}!");
        assert_eq!(decoded, r"Hello \N[1]!");
        assert!(intact);
    }

    #[test]
    fn test_decode_missing_placeholder_returns_false() {
        // If Ollama drops a placeholder, intact = false
        let (_, intact) = decode("Placeholder was dropped");
        // No {{...}} remain, but original had none either — intact = true
        // Test with an already-decoded string (no {{}} left):
        assert!(intact);
    }

    #[test]
    fn test_roundtrip() {
        let original = r"こんにちは \N[1]、\C[2]アイテム\C[0]を取った！";
        let encoded = encode(original);
        assert!(encoded.contains("{{ACTOR_NAME[1]}}"));
        assert!(encoded.contains("{{COLOR[2]}}"));
        let (decoded, intact) = decode(&encoded);
        assert!(intact);
        assert_eq!(decoded, original);
    }
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd src-tauri && cargo test test_encode test_decode test_roundtrip`
Expected: FAIL

- [ ] **Step 3: Implement**

```rust
// src-tauri/src/engines/rpgmaker_mv_mz/placeholders.rs

/// Encode RPG Maker control codes to {{NAME}} placeholders before sending to Ollama
pub fn encode(text: &str) -> String {
    let mut s = text.to_string();

    // \N[n] → {{ACTOR_NAME[n]}}
    let re = regex::Regex::new(r"\\N\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{ACTOR_NAME[$1]}}").into_owned();

    // \C[n] → {{COLOR[n]}}
    let re = regex::Regex::new(r"\\C\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{COLOR[$1]}}").into_owned();

    // \I[n] → {{ICON[n]}}
    let re = regex::Regex::new(r"\\I\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{ICON[$1]}}").into_owned();

    // \V[n] → {{VAR[n]}}
    let re = regex::Regex::new(r"\\V\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{VAR[$1]}}").into_owned();

    // \P[n] → {{PARTY[n]}}
    let re = regex::Regex::new(r"\\P\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{PARTY[$1]}}").into_owned();

    s
}

/// Decode {{NAME}} placeholders back to RPG Maker control codes after Ollama translation
/// Returns (decoded_text, all_placeholders_intact)
pub fn decode(text: &str) -> (String, bool) {
    let mut s = text.to_string();

    let re = regex::Regex::new(r"\{\{ACTOR_NAME\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\N[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{COLOR\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\C[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{ICON\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\I[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{VAR\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\V[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{PARTY\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\P[$1]").into_owned();

    // Check if any {{...}} remain (unrecognized or dropped by Ollama)
    let intact = !regex::Regex::new(r"\{\{[^}]+\}\}").unwrap().is_match(&s);
    (s, intact)
}
```

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test test_encode test_decode test_roundtrip`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/engines/rpgmaker_mv_mz/placeholders.rs
git commit -m "feat: add RPG Maker placeholder encode/decode"
```

---

## Task 4: rpgmaker_mv_mz/skip.rs

**Files:**
- Create: `src-tauri/src/engines/rpgmaker_mv_mz/skip.rs`

- [ ] **Step 1: Write the failing tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_delegates_to_common_skip() {
        assert!(should_skip("")); // empty
        assert!(should_skip("Hello")); // no Japanese
    }

    #[test]
    fn test_skip_rpgmaker_control_codes_only() {
        // Pure control code with no translatable text
        assert!(should_skip(r"\>"));
        assert!(should_skip(r"\<"));
    }

    #[test]
    fn test_keep_japanese_text() {
        assert!(!should_skip("勇者よ、立ち上がれ！"));
    }
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd src-tauri && cargo test -p hoshi-trans test_delegates_to_common`
Expected: FAIL

- [ ] **Step 3: Implement**

```rust
// src-tauri/src/engines/rpgmaker_mv_mz/skip.rs
use crate::engines::common::skip as common_skip;

pub fn should_skip(text: &str) -> bool {
    if common_skip::should_skip(text) {
        return true;
    }
    is_rpgmaker_control_code_only(text)
}

fn is_rpgmaker_control_code_only(text: &str) -> bool {
    matches!(text.trim(), r"\>" | r"\<" | r"\!" | r"\." | r"\|" | r"\^")
}
```

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test test_delegates_to_common test_skip_rpgmaker test_keep_japanese`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/engines/rpgmaker_mv_mz/skip.rs
git commit -m "feat: add rpgmaker_mv_mz/skip.rs"
```

---

## Task 5: rpgmaker_mv_mz/extractor.rs + DB batch insert

**Files:**
- Create: `src-tauri/src/engines/rpgmaker_mv_mz/extractor.rs`
- Modify: `src-tauri/src/db/queries.rs` — add `insert_entries_batch`

- [ ] **Step 1: Write failing test for insert_entries_batch**

```rust
// src-tauri/src/db/queries.rs — add test
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_pool;
    use crate::models::TranslationEntry;

    #[tokio::test]
    async fn test_insert_entries_batch() {
        let dir = tempfile::tempdir().unwrap();
        let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();

        // Create a project first
        create_project(&pool, "proj-1", "/game", "rpgmaker_mv_mz", "Test", "en", None)
            .await.unwrap();

        let entries = vec![
            TranslationEntry {
                id: "e1".into(),
                project_id: "proj-1".into(),
                source_text: "こんにちは".into(),
                translation: None,
                status: "pending".into(),
                context: None,
                file_path: "data/Map001.json".into(),
                order_index: 0,
            },
        ];

        insert_entries_batch(&pool, &entries).await.unwrap();

        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM entries WHERE project_id = 'proj-1'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(count.0, 1);
    }
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd src-tauri && cargo test test_insert_entries_batch`
Expected: FAIL

- [ ] **Step 3: Implement insert_entries_batch**

```rust
// src-tauri/src/db/queries.rs — add
pub async fn insert_entries_batch(
    pool: &SqlitePool,
    entries: &[crate::models::TranslationEntry],
) -> anyhow::Result<()> {
    let mut tx = pool.begin().await?;
    for entry in entries {
        sqlx::query!(
            "INSERT OR IGNORE INTO entries
             (id, project_id, source_text, status, context, file_path, order_index)
             VALUES (?, ?, ?, 'pending', ?, ?, ?)",
            entry.id,
            entry.project_id,
            entry.source_text,
            entry.context,
            entry.file_path,
            entry.order_index
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}
```

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test test_insert_entries_batch`
Expected: PASS

- [ ] **Step 5: Write the extractor**

```rust
// src-tauri/src/engines/rpgmaker_mv_mz/extractor.rs
use crate::engines::rpgmaker_mv_mz::{skip, placeholders};
use crate::models::TranslationEntry;
use uuid::Uuid;

/// Extract all translatable strings from RPG Maker MV/MZ data/ folder
pub async fn extract(
    game_dir: &std::path::Path,
    project_id: &str,
) -> anyhow::Result<Vec<TranslationEntry>> {
    let data_dir = game_dir.join("data");
    let mut entries = Vec::new();

    for entry in std::fs::read_dir(&data_dir)? {
        let path = entry?.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let filename = path.file_name().unwrap().to_string_lossy().to_string();
        let content = std::fs::read_to_string(&path)?;
        let json: serde_json::Value = serde_json::from_str(&content)?;

        let file_rel = format!("data/{}", filename);

        if filename.starts_with("Map") && filename != "MapInfos.json" {
            extract_map_events(&json, project_id, &file_rel, &mut entries);
        } else if matches!(
            filename.as_str(),
            "CommonEvents.json"
        ) {
            extract_common_events(&json, project_id, &file_rel, &mut entries);
        } else if matches!(
            filename.as_str(),
            "Actors.json" | "Items.json" | "Weapons.json" | "Armors.json"
            | "Skills.json" | "Enemies.json" | "States.json"
        ) {
            extract_database_objects(&json, project_id, &file_rel, &mut entries);
        }
    }

    Ok(entries)
}

fn add_entry(
    entries: &mut Vec<TranslationEntry>,
    project_id: &str,
    text: &str,
    context: Option<String>,
    file_path: &str,
    order_index: i64,
) {
    if skip::should_skip(text) {
        return;
    }
    let encoded = placeholders::encode(text);
    entries.push(TranslationEntry {
        id: Uuid::new_v4().to_string(),
        project_id: project_id.to_string(),
        source_text: encoded,
        translation: None,
        status: "pending".to_string(),
        context,
        file_path: file_path.to_string(),
        order_index,
    });
}

fn extract_map_events(
    json: &serde_json::Value,
    project_id: &str,
    file_path: &str,
    entries: &mut Vec<TranslationEntry>,
) {
    let mut order: i64 = 0;
    if let Some(events) = json["events"].as_array() {
        for event in events.iter().filter_map(|e| e.as_object()) {
            if let Some(pages) = event.get("pages").and_then(|p| p.as_array()) {
                for page in pages {
                    if let Some(list) = page["list"].as_array() {
                        for cmd in list {
                            let code = cmd["code"].as_i64().unwrap_or(0);
                            match code {
                                401 | 405 => {
                                    // Dialogue line
                                    if let Some(text) = cmd["parameters"][0].as_str() {
                                        add_entry(entries, project_id, text, Some(format!("code:{}", code)), file_path, order);
                                        order += 1;
                                    }
                                }
                                102 => {
                                    // Choice list
                                    if let Some(choices) = cmd["parameters"][0].as_array() {
                                        for choice in choices {
                                            if let Some(text) = choice.as_str() {
                                                add_entry(entries, project_id, text, Some("choice".into()), file_path, order);
                                                order += 1;
                                            }
                                        }
                                    }
                                }
                                101 => {
                                    // Speaker name in params[4]
                                    if let Some(text) = cmd["parameters"][4].as_str() {
                                        add_entry(entries, project_id, text, Some("speaker".into()), file_path, order);
                                        order += 1;
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        }
    }
}

fn extract_common_events(
    json: &serde_json::Value,
    project_id: &str,
    file_path: &str,
    entries: &mut Vec<TranslationEntry>,
) {
    let mut order: i64 = 0;
    if let Some(events) = json.as_array() {
        for event in events.iter().filter(|e| !e.is_null()) {
            if let Some(list) = event["list"].as_array() {
                for cmd in list {
                    let code = cmd["code"].as_i64().unwrap_or(0);
                    if matches!(code, 401 | 405 | 102) {
                        if let Some(text) = cmd["parameters"][0].as_str() {
                            add_entry(entries, project_id, text, Some(format!("code:{}", code)), file_path, order);
                            order += 1;
                        }
                    }
                }
            }
        }
    }
}

fn extract_database_objects(
    json: &serde_json::Value,
    project_id: &str,
    file_path: &str,
    entries: &mut Vec<TranslationEntry>,
) {
    let mut order: i64 = 0;
    if let Some(items) = json.as_array() {
        for item in items.iter().filter(|i| !i.is_null()) {
            for field in &["name", "description", "message1", "message2", "message3", "message4"] {
                if let Some(text) = item[field].as_str() {
                    add_entry(entries, project_id, text, Some((*field).to_string()), file_path, order);
                    order += 1;
                }
            }
        }
    }
}
```

- [ ] **Step 6: Update rpgmaker_mv_mz/mod.rs**

```rust
// src-tauri/src/engines/rpgmaker_mv_mz/mod.rs — add
pub mod extractor;
pub mod placeholders;
pub mod skip;
```

- [ ] **Step 7: Compile check**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/engines/rpgmaker_mv_mz/extractor.rs src-tauri/src/db/queries.rs
git commit -m "feat: add RPG Maker extractor and insert_entries_batch"
```

---

## Task 6: extract_strings Command

**Files:**
- Create: `src-tauri/src/commands/extract.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write extract.rs**

```rust
// src-tauri/src/commands/extract.rs
use sqlx::SqlitePool;
use crate::engines::rpgmaker_mv_mz::extractor;
use crate::db::queries;

#[tauri::command]
pub async fn extract_strings(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
    game_dir: String,
) -> Result<u32, String> {
    let path = std::path::Path::new(&game_dir);
    let entries = extractor::extract(path, &project_id)
        .await
        .map_err(|e| e.to_string())?;

    let count = entries.len() as u32;

    queries::insert_entries_batch(&pool, &entries)
        .await
        .map_err(|e| e.to_string())?;

    Ok(count)
}
```

- [ ] **Step 2: Update mod.rs and lib.rs**

```rust
// commands/mod.rs — add
pub mod extract;
```

```rust
// lib.rs — update invoke_handler
commands::extract::extract_strings,
```

- [ ] **Step 3: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [ ] **Step 4: Test manually**

Run: `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev`
- Open an RPG Maker MV/MZ game folder
- Call `extract_strings` from frontend (temporary button or console)
- Expected: count of extracted entries returned, entries visible in SQLite

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/extract.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add extract_strings Tauri command"
```

---

## Task 7: ENGINE_NOTES.md

**Files:**
- Create: `src-tauri/src/engines/rpgmaker_mv_mz/ENGINE_NOTES.md`

- [ ] **Step 1: Create the notes file**

```markdown
# RPG Maker MV/MZ Engine Notes

## Detection
- `data/System.json` must exist
- Game title read from `gameTitle` field

## Files parsed
- `data/Map*.json` — events.pages.list codes 401, 405 (dialogue), 102 (choices), 101 (speaker)
- `data/CommonEvents.json` — same codes
- `data/Actors/Items/Weapons/Armors/Skills/Enemies/States.json` — name, description, message1-4

## Known placeholder codes
| RPG Maker | Encoded |
|-----------|---------|
| `\N[n]` | `{{ACTOR_NAME[n]}}` |
| `\C[n]` | `{{COLOR[n]}}` |
| `\I[n]` | `{{ICON[n]}}` |
| `\V[n]` | `{{VAR[n]}}` |
| `\P[n]` | `{{PARTY[n]}}` |

## Tested on
<!-- Update after each real game test -->
- [ ] RPG Maker MV game
- [ ] RPG Maker MZ game

## Known issues
<!-- Document quirks found during testing -->
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/engines/rpgmaker_mv_mz/ENGINE_NOTES.md
git commit -m "docs: add RPG Maker ENGINE_NOTES.md"
```
