# Wolf RPG Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support Wolf RPG games by reading WolfTL dump JSON directly — no sidecars, no Wine required.

**Architecture:** The user manually runs UberWolf (decrypt `Data.wolf` → `Data/`) and WolfTL (`dump` → `dump/`) before opening the project in hoshi-trans. hoshi-trans detects a Wolf RPG dump folder (`dump/mps/`, `dump/common/`, `dump/db/`), extracts translatable text from the structured JSON, translates it, and writes translated JSON back so the user can run `WolfTL patch` themselves. The old sidecar pipeline (UberWolfCli + WolfTL via Wine) is removed.

**Tech Stack:** serde_json, walkdir (already in Cargo.toml)

---

## ✅ Previous STATUS (sidecar approach — superseded)

Old implementation (2026-03-15) used UberWolfCli + WolfTL .exe sidecars via Wine.
Replaced by dump-based approach because:
- Wine fragile on Linux (permission errors, not installed by default)
- `hoshi-wolf-work/` created inside game dir → os error 13 on read-only folders
- WolfTL dump format is now confirmed from a real game (`月咲流ホノカ ver1.03`)

---

## User Workflow (new)

```
1. User runs UberWolf on game folder  →  Data/ (decrypted)
2. User runs WolfTL dump Data/        →  dump/  (JSON files)
3. User opens dump/ folder in hoshi-trans
4. hoshi-trans extracts → translates → writes translated dump/
5. User runs WolfTL patch             →  patched game files
```

---

## WolfTL Dump Format (confirmed on 月咲流ホノカ ver1.03)

### dump/mps/MapXXX.json
```json
{
  "events": [{
    "id": 0,
    "name": "イベント名",
    "pages": [{
      "id": 0,
      "list": [
        { "code": 101, "codeStr": "Message",  "stringArgs": ["\\E\\c[2]ほのか\n「セリフ」"], "index": 3 },
        { "code": 401, "codeStr": "Choice",   "stringArgs": ["はい", "いいえ"],             "index": 7 }
      ]
    }]
  }]
}
```

### dump/common/NNN_name.json
```json
{
  "id": 0,
  "name": "○アイテム増減",
  "description": "アイテムを増減させます。",
  "commands": [
    { "code": 103, "codeStr": "Comment", "stringArgs": ["コメント\r\r"], "index": 0 },
    { "code": 101, "codeStr": "Message", "stringArgs": ["セリフ"],       "index": 5 }
  ]
}
```

### dump/db/DataBase.json / CDataBase.json / SysDatabase.json
```json
{
  "types": [{
    "name": "技能",
    "description": "説明テキスト",
    "fields": [
      { "name": "技能の名前" },
      { "name": "説明" }
    ],
    "data": [{
      "name": "攻撃",
      "description": "通常攻撃",
      "fields": [...]
    }]
  }]
}
```

---

## Codes to extract (codeStr)

| codeStr | Content | Translate |
|---------|---------|-----------|
| `Message` | Dialogue lines | ✓ Yes |
| `Choice` | Choice options (stringArgs array) | ✓ Yes |
| `Comment` | Developer comments | ✗ No |
| `CommonEventByName` | Internal event name refs | ✗ No |

---

## Injection key

Use `"index"` field from WolfTL JSON as `order_index` in TranslationEntry.
Use `file_path` = relative path from dump root (e.g. `mps/Map001.json`).
Use `context` = `"event:{id}:page:{pid}"` for mps, `"cmd"` for common, `"db:{type}:{data}"` for db.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src-tauri/src/engines/wolf_rpg/mod.rs` | Modify | Update `detect()` to accept dump folder |
| `src-tauri/src/engines/wolf_rpg/extractor.rs` | Rewrite | Parse WolfTL dump JSON directly, no sidecars |
| `src-tauri/src/engines/wolf_rpg/injector.rs` | Rewrite | Write translated JSON back to dump files, no sidecars |
| `src-tauri/src/engines/wolf_rpg/sidecar.rs` | Delete | No longer needed |
| `src-tauri/src/commands/extract.rs` | Modify | Remove `app: AppHandle` from Wolf branch |
| `src-tauri/src/commands/inject.rs` | Modify | Remove `app: AppHandle` from Wolf branch |

---

## Task 1: Update Detection

**Files:**
- Modify: `src-tauri/src/engines/wolf_rpg/mod.rs`

### What changes

Old detection required `Game.exe` + `Data/BasicData`. New detection accepts either:
- **Unpacked game** (for future use): `Game.exe` + `Data/BasicData/`
- **Dump folder** (new primary): contains `mps/` + `common/` + `db/` subdirs

The user opens the `dump/` folder directly in hoshi-trans.

- [ ] **Step 1: Write failing test**

In `mod.rs` test module:
```rust
#[test]
fn test_detect_dump_folder() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join("mps")).unwrap();
    std::fs::create_dir_all(dir.path().join("common")).unwrap();
    std::fs::create_dir_all(dir.path().join("db")).unwrap();
    assert!(detect(dir.path()));
}

#[test]
fn test_detect_rejects_missing_db() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join("mps")).unwrap();
    std::fs::create_dir_all(dir.path().join("common")).unwrap();
    // no db/
    assert!(!detect(dir.path()));
}
```

Run: `cargo test test_detect_dump_folder test_detect_rejects_missing_db`
Expected: FAIL

- [ ] **Step 2: Implement**

```rust
pub fn detect(game_dir: &std::path::Path) -> bool {
    // Dump folder mode (primary): WolfTL dump/ with mps/ common/ db/
    let is_dump = game_dir.join("mps").exists()
        && game_dir.join("common").exists()
        && game_dir.join("db").exists();
    // Unpacked game mode (legacy): Game.exe + Data/BasicData
    let is_unpacked = game_dir.join("Game.exe").exists()
        && (game_dir.join("Data/BasicData").exists()
            || game_dir.join("Data.wolf").exists());
    is_dump || is_unpacked
}
```

- [ ] **Step 3: Run tests**

Run: `cargo test wolf_rpg`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/engines/wolf_rpg/mod.rs
git commit -m "feat: wolf_rpg detect() accepts WolfTL dump folder"
```

---

## Task 2: Rewrite extractor.rs

**Files:**
- Rewrite: `src-tauri/src/engines/wolf_rpg/extractor.rs`

No more sidecars. Reads `dump/mps/`, `dump/common/`, `dump/db/` directly.

### Entry key design

`order_index` = WolfTL `index` field of the command within its file.
`file_path` = relative path from dump root, e.g. `mps/Map001.json`.
`context` encodes location for injection:
- mps: `"event:{event_id}:page:{page_id}:idx:{index}"`
- common: `"cmd:idx:{index}"`
- db: stored separately (names/descriptions, not by command index)

- [ ] **Step 1: Write failing tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn write_file(dir: &std::path::Path, rel: &str, content: &str) {
        let p = dir.join(rel);
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(p, content).unwrap();
    }

    #[test]
    fn test_extract_mps_message() {
        let dir = tempfile::tempdir().unwrap();
        write_file(dir.path(), "mps/Map001.json", r#"{
            "events": [{"id": 1, "name": "", "pages": [{"id": 0, "list": [
                {"code": 101, "codeStr": "Message", "stringArgs": ["こんにちは"], "index": 3}
            ]}]}]
        }"#);
        std::fs::create_dir_all(dir.path().join("common")).unwrap();
        std::fs::create_dir_all(dir.path().join("db")).unwrap();

        let entries = extract_sync(dir.path(), "proj1").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].source_text, "こんにちは");
        assert_eq!(entries[0].file_path, "mps/Map001.json");
        assert_eq!(entries[0].order_index, 3);
    }

    #[test]
    fn test_extract_skips_comment() {
        let dir = tempfile::tempdir().unwrap();
        write_file(dir.path(), "mps/Map001.json", r#"{
            "events": [{"id": 1, "name": "", "pages": [{"id": 0, "list": [
                {"code": 103, "codeStr": "Comment", "stringArgs": ["開発メモ"], "index": 0},
                {"code": 101, "codeStr": "Message", "stringArgs": ["セリフ"], "index": 1}
            ]}]}]
        }"#);
        std::fs::create_dir_all(dir.path().join("common")).unwrap();
        std::fs::create_dir_all(dir.path().join("db")).unwrap();

        let entries = extract_sync(dir.path(), "proj1").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].source_text, "セリフ");
    }

    #[test]
    fn test_extract_common_event_message() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("mps")).unwrap();
        std::fs::create_dir_all(dir.path().join("db")).unwrap();
        write_file(dir.path(), "common/0_test.json", r#"{
            "id": 0, "name": "テスト", "description": "",
            "commands": [
                {"code": 101, "codeStr": "Message", "stringArgs": ["共通メッセージ"], "index": 2}
            ]
        }"#);

        let entries = extract_sync(dir.path(), "proj1").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].file_path, "common/0_test.json");
        assert_eq!(entries[0].order_index, 2);
    }

    #[test]
    fn test_extract_choice_each_option_is_entry() {
        let dir = tempfile::tempdir().unwrap();
        write_file(dir.path(), "mps/Map001.json", r#"{
            "events": [{"id": 1, "name": "", "pages": [{"id": 0, "list": [
                {"code": 401, "codeStr": "Choice", "stringArgs": ["はい", "いいえ"], "index": 5}
            ]}]}]
        }"#);
        std::fs::create_dir_all(dir.path().join("common")).unwrap();
        std::fs::create_dir_all(dir.path().join("db")).unwrap();

        let entries = extract_sync(dir.path(), "proj1").unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].source_text, "はい");
        assert_eq!(entries[1].source_text, "いいえ");
        // Both share the same index (5), disambiguated by context
        assert_eq!(entries[0].order_index, 5);
    }
}
```

Run: `cargo test wolf_rpg::extractor`
Expected: FAIL (no `extract_sync` defined)

- [ ] **Step 2: Implement**

```rust
use crate::engines::wolf_rpg::{placeholders, skip};
use crate::models::TranslationEntry;
use std::path::Path;
use uuid::Uuid;

pub async fn extract(
    game_dir: &Path,
    project_id: &str,
) -> anyhow::Result<Vec<TranslationEntry>> {
    extract_sync(game_dir, project_id)
}

pub fn extract_sync(
    dump_dir: &Path,
    project_id: &str,
) -> anyhow::Result<Vec<TranslationEntry>> {
    let mut entries = Vec::new();

    // mps/
    let mps_dir = dump_dir.join("mps");
    if mps_dir.exists() {
        for path in sorted_json_files(&mps_dir)? {
            let rel = rel_path(dump_dir, &path);
            let content = std::fs::read_to_string(&path)?;
            let json: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| anyhow::anyhow!("Parse error {}: {}", rel, e))?;
            extract_mps_file(&json, project_id, &rel, &mut entries);
        }
    }

    // common/
    let common_dir = dump_dir.join("common");
    if common_dir.exists() {
        for path in sorted_json_files(&common_dir)? {
            let rel = rel_path(dump_dir, &path);
            let content = std::fs::read_to_string(&path)?;
            let json: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| anyhow::anyhow!("Parse error {}: {}", rel, e))?;
            extract_common_file(&json, project_id, &rel, &mut entries);
        }
    }

    // db/
    let db_dir = dump_dir.join("db");
    if db_dir.exists() {
        for path in sorted_json_files(&db_dir)? {
            let rel = rel_path(dump_dir, &path);
            let content = std::fs::read_to_string(&path)?;
            let json: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| anyhow::anyhow!("Parse error {}: {}", rel, e))?;
            extract_db_file(&json, project_id, &rel, &mut entries);
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

/// Extract messages and choices from a Map JSON file.
fn extract_mps_file(
    json: &serde_json::Value,
    project_id: &str,
    file_path: &str,
    entries: &mut Vec<TranslationEntry>,
) {
    if let Some(events) = json["events"].as_array() {
        for event in events {
            let event_id = event["id"].as_i64().unwrap_or(0);
            if let Some(pages) = event["pages"].as_array() {
                for page in pages {
                    let page_id = page["id"].as_i64().unwrap_or(0);
                    if let Some(list) = page["list"].as_array() {
                        extract_command_list(
                            list,
                            project_id,
                            file_path,
                            &format!("event:{}:page:{}", event_id, page_id),
                            entries,
                        );
                    }
                }
            }
        }
    }
}

/// Extract messages from a CommonEvent JSON file.
fn extract_common_file(
    json: &serde_json::Value,
    project_id: &str,
    file_path: &str,
    entries: &mut Vec<TranslationEntry>,
) {
    if let Some(commands) = json["commands"].as_array() {
        extract_command_list(commands, project_id, file_path, "cmd", entries);
    }
}

/// Shared logic: walk a command list and extract Message/Choice entries.
fn extract_command_list(
    list: &[serde_json::Value],
    project_id: &str,
    file_path: &str,
    ctx_prefix: &str,
    entries: &mut Vec<TranslationEntry>,
) {
    for cmd in list {
        let code_str = cmd["codeStr"].as_str().unwrap_or("");
        let index = cmd["index"].as_i64().unwrap_or(0);

        match code_str {
            "Message" => {
                if let Some(text) = cmd["stringArgs"][0].as_str() {
                    add_entry(
                        entries,
                        project_id,
                        text,
                        Some(format!("{}:idx:{}", ctx_prefix, index)),
                        file_path,
                        index,
                    );
                }
            }
            "Choice" => {
                // Each choice option is a separate TranslationEntry.
                // order_index = command index; choice position encoded in context.
                if let Some(args) = cmd["stringArgs"].as_array() {
                    for (i, arg) in args.iter().enumerate() {
                        if let Some(text) = arg.as_str() {
                            add_entry(
                                entries,
                                project_id,
                                text,
                                Some(format!("{}:idx:{}:choice:{}", ctx_prefix, index, i)),
                                file_path,
                                index,
                            );
                        }
                    }
                }
            }
            _ => {}
        }
    }
}

/// Extract names and descriptions from a Database JSON file.
fn extract_db_file(
    json: &serde_json::Value,
    project_id: &str,
    file_path: &str,
    entries: &mut Vec<TranslationEntry>,
) {
    let mut order: i64 = 0;
    if let Some(types) = json["types"].as_array() {
        for (ti, typ) in types.iter().enumerate() {
            // Type name and description (editor-only metadata — skip)
            // Data entries: names and descriptions shown in-game
            if let Some(data) = typ["data"].as_array() {
                for (di, item) in data.iter().enumerate() {
                    for field in &["name", "description"] {
                        if let Some(text) = item[field].as_str() {
                            add_entry(
                                entries,
                                project_id,
                                text,
                                Some(format!("db:type:{}:data:{}:{}", ti, di, field)),
                                file_path,
                                order,
                            );
                            order += 1;
                        }
                    }
                }
            }
        }
    }
}

fn rel_path(base: &Path, path: &Path) -> String {
    path.strip_prefix(base)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn sorted_json_files(dir: &Path) -> anyhow::Result<Vec<std::path::PathBuf>> {
    let mut files: Vec<_> = walkdir::WalkDir::new(dir)
        .sort_by_file_name()
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file()
            && e.path().extension().map_or(false, |x| x == "json"))
        .map(|e| e.path().to_path_buf())
        .collect();
    files.sort();
    Ok(files)
}
```

- [ ] **Step 3: Run tests**

Run: `cargo test wolf_rpg::extractor`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/engines/wolf_rpg/extractor.rs
git commit -m "feat: wolf_rpg extractor reads WolfTL dump JSON directly, no sidecars"
```

---

## Task 3: Rewrite injector.rs

**Files:**
- Rewrite: `src-tauri/src/engines/wolf_rpg/injector.rs`

Reads the same dump JSON files, writes translated text back by matching `file_path` + `order_index` + `context`.

### Injection strategy

- **Message** (`context` ends with `idx:N`): find command where `index == N`, set `stringArgs[0] = translation`
- **Choice** (`context` ends with `idx:N:choice:M`): find command where `index == N`, set `stringArgs[M] = translation`
- **db** (`context` starts with `db:type:T:data:D:field`): navigate to `types[T].data[D][field]`

- [ ] **Step 1: Write failing tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TranslationEntry;

    fn entry(file_path: &str, order_index: i64, ctx: &str, translation: &str) -> TranslationEntry {
        TranslationEntry {
            id: "x".into(),
            project_id: "p".into(),
            source_text: "src".into(),
            translation: Some(translation.into()),
            status: "translated".into(),
            context: Some(ctx.into()),
            file_path: file_path.into(),
            order_index,
        }
    }

    #[test]
    fn test_inject_mps_message() {
        let dir = tempfile::tempdir().unwrap();
        let map_path = dir.path().join("mps/Map001.json");
        std::fs::create_dir_all(map_path.parent().unwrap()).unwrap();
        std::fs::write(&map_path, r#"{
            "events": [{"id": 1, "name": "", "pages": [{"id": 0, "list": [
                {"code": 101, "codeStr": "Message", "stringArgs": ["こんにちは"], "index": 3}
            ]}]}]
        }"#).unwrap();

        let entries = vec![entry("mps/Map001.json", 3, "event:1:page:0:idx:3", "Hello")];
        inject_sync(dir.path(), &entries, dir.path()).unwrap();

        let out: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(dir.path().join("mps/Map001.json")).unwrap()
        ).unwrap();
        assert_eq!(out["events"][0]["pages"][0]["list"][0]["stringArgs"][0], "Hello");
    }

    #[test]
    fn test_inject_choice_options() {
        let dir = tempfile::tempdir().unwrap();
        let map_path = dir.path().join("mps/Map001.json");
        std::fs::create_dir_all(map_path.parent().unwrap()).unwrap();
        std::fs::write(&map_path, r#"{
            "events": [{"id": 1, "name": "", "pages": [{"id": 0, "list": [
                {"code": 401, "codeStr": "Choice", "stringArgs": ["はい", "いいえ"], "index": 5}
            ]}]}]
        }"#).unwrap();

        let entries = vec![
            entry("mps/Map001.json", 5, "event:1:page:0:idx:5:choice:0", "Yes"),
            entry("mps/Map001.json", 5, "event:1:page:0:idx:5:choice:1", "No"),
        ];
        inject_sync(dir.path(), &entries, dir.path()).unwrap();

        let out: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(dir.path().join("mps/Map001.json")).unwrap()
        ).unwrap();
        let args = &out["events"][0]["pages"][0]["list"][0]["stringArgs"];
        assert_eq!(args[0], "Yes");
        assert_eq!(args[1], "No");
    }

    #[test]
    fn test_inject_untranslated_entry_left_as_original() {
        let dir = tempfile::tempdir().unwrap();
        let map_path = dir.path().join("mps/Map001.json");
        std::fs::create_dir_all(map_path.parent().unwrap()).unwrap();
        std::fs::write(&map_path, r#"{
            "events": [{"id": 1, "name": "", "pages": [{"id": 0, "list": [
                {"code": 101, "codeStr": "Message", "stringArgs": ["原文"], "index": 1}
            ]}]}]
        }"#).unwrap();

        // No entries provided → original text unchanged
        inject_sync(dir.path(), &[], dir.path()).unwrap();

        let out: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(dir.path().join("mps/Map001.json")).unwrap()
        ).unwrap();
        assert_eq!(out["events"][0]["pages"][0]["list"][0]["stringArgs"][0], "原文");
    }
}
```

Run: `cargo test wolf_rpg::injector`
Expected: FAIL

- [ ] **Step 2: Implement**

```rust
use crate::engines::wolf_rpg::placeholders;
use crate::models::TranslationEntry;
use std::collections::HashMap;
use std::path::Path;

pub async fn inject(
    game_dir: &Path,
    entries: &[TranslationEntry],
    output_dir: &Path,
) -> anyhow::Result<()> {
    inject_sync(game_dir, entries, output_dir)
}

pub fn inject_sync(
    dump_dir: &Path,
    entries: &[TranslationEntry],
    output_dir: &Path,
) -> anyhow::Result<()> {
    // Index: (file_path, order_index, context) → translation
    let mut index: HashMap<(String, i64, String), String> = HashMap::new();
    for entry in entries {
        if let Some(ref t) = entry.translation {
            if !t.is_empty() {
                let ctx = entry.context.clone().unwrap_or_default();
                let (decoded, _) = placeholders::decode(t);
                index.insert((entry.file_path.clone(), entry.order_index, ctx), decoded);
            }
        }
    }

    // Walk same three directories
    for subdir in &["mps", "common", "db"] {
        let src_dir = dump_dir.join(subdir);
        if !src_dir.exists() {
            continue;
        }
        for path in sorted_json_files(&src_dir)? {
            let rel = rel_path(dump_dir, &path);
            let content = std::fs::read_to_string(&path)?;
            let mut json: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| anyhow::anyhow!("Parse error {}: {}", rel, e))?;

            match *subdir {
                "mps" => inject_mps(&mut json, &rel, &index),
                "common" => inject_common(&mut json, &rel, &index),
                "db" => inject_db(&mut json, &rel, &index),
                _ => {}
            }

            let dest = output_dir.join(&rel);
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&dest, serde_json::to_string_pretty(&json)?)?;
        }
    }
    Ok(())
}

fn inject_mps(
    json: &mut serde_json::Value,
    file_path: &str,
    index: &HashMap<(String, i64, String), String>,
) {
    if let Some(events) = json["events"].as_array_mut() {
        for event in events.iter_mut() {
            let event_id = event["id"].as_i64().unwrap_or(0);
            if let Some(pages) = event["pages"].as_array_mut() {
                for page in pages.iter_mut() {
                    let page_id = page["id"].as_i64().unwrap_or(0);
                    let ctx_prefix = format!("event:{}:page:{}", event_id, page_id);
                    if let Some(list) = page["list"].as_array_mut() {
                        inject_command_list(list, file_path, &ctx_prefix, index);
                    }
                }
            }
        }
    }
}

fn inject_common(
    json: &mut serde_json::Value,
    file_path: &str,
    index: &HashMap<(String, i64, String), String>,
) {
    if let Some(commands) = json["commands"].as_array_mut() {
        inject_command_list(commands, file_path, "cmd", index);
    }
}

fn inject_command_list(
    list: &mut [serde_json::Value],
    file_path: &str,
    ctx_prefix: &str,
    index: &HashMap<(String, i64, String), String>,
) {
    for cmd in list.iter_mut() {
        let code_str = cmd["codeStr"].as_str().unwrap_or("").to_string();
        let cmd_index = cmd["index"].as_i64().unwrap_or(0);

        match code_str.as_str() {
            "Message" => {
                let ctx = format!("{}:idx:{}", ctx_prefix, cmd_index);
                if let Some(t) = index.get(&(file_path.to_string(), cmd_index, ctx)) {
                    cmd["stringArgs"][0] = serde_json::Value::String(t.clone());
                }
            }
            "Choice" => {
                let n = cmd["stringArgs"].as_array().map(|a| a.len()).unwrap_or(0);
                for i in 0..n {
                    let ctx = format!("{}:idx:{}:choice:{}", ctx_prefix, cmd_index, i);
                    if let Some(t) = index.get(&(file_path.to_string(), cmd_index, ctx)) {
                        cmd["stringArgs"][i] = serde_json::Value::String(t.clone());
                    }
                }
            }
            _ => {}
        }
    }
}

fn inject_db(
    json: &mut serde_json::Value,
    file_path: &str,
    index: &HashMap<(String, i64, String), String>,
) {
    let mut order: i64 = 0;
    if let Some(types) = json["types"].as_array_mut() {
        for (ti, typ) in types.iter_mut().enumerate() {
            if let Some(data) = typ["data"].as_array_mut() {
                for (di, item) in data.iter_mut().enumerate() {
                    for field in &["name", "description"] {
                        if item[field].as_str().is_some() {
                            let ctx = format!("db:type:{}:data:{}:{}", ti, di, field);
                            if let Some(t) = index.get(&(file_path.to_string(), order, ctx)) {
                                item[*field] = serde_json::Value::String(t.clone());
                            }
                            order += 1;
                        }
                    }
                }
            }
        }
    }
}

fn rel_path(base: &Path, path: &Path) -> String {
    path.strip_prefix(base)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn sorted_json_files(dir: &Path) -> anyhow::Result<Vec<std::path::PathBuf>> {
    let mut files: Vec<_> = walkdir::WalkDir::new(dir)
        .sort_by_file_name()
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file()
            && e.path().extension().map_or(false, |x| x == "json"))
        .map(|e| e.path().to_path_buf())
        .collect();
    files.sort();
    Ok(files)
}
```

- [ ] **Step 3: Run tests**

Run: `cargo test wolf_rpg::injector`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/engines/wolf_rpg/injector.rs
git commit -m "feat: wolf_rpg injector writes translations back to WolfTL dump JSON"
```

---

## Task 4: Remove sidecar dependency from commands

**Files:**
- Modify: `src-tauri/src/commands/extract.rs`
- Modify: `src-tauri/src/commands/inject.rs`
- Delete: `src-tauri/src/engines/wolf_rpg/sidecar.rs`

The Wolf branch no longer needs `app: tauri::AppHandle` since there are no sidecar calls.

- [ ] **Step 1: Update extract.rs Wolf branch**

Find the Wolf RPG branch in `extract_strings` command. Change:
```rust
// Old
wolf_rpg::extract(app, &game_dir, &project_id).await

// New
wolf_rpg::extract(&game_dir, &project_id).await
```

- [ ] **Step 2: Update inject.rs Wolf branch**

Find the Wolf RPG branch in `inject_translations` command. Change:
```rust
// Old
wolf_rpg::inject(app, &game_dir, &entries, &output_dir).await

// New
wolf_rpg::inject(&game_dir, &entries, &output_dir).await
```

- [ ] **Step 3: Remove sidecar.rs from wolf_rpg/mod.rs**

In `mod.rs`, remove: `pub mod sidecar;`

- [ ] **Step 4: Delete sidecar.rs**

```bash
rm src-tauri/src/engines/wolf_rpg/sidecar.rs
```

- [ ] **Step 5: cargo check**

Run: `cargo check`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/engines/wolf_rpg/mod.rs
git add src-tauri/src/commands/extract.rs
git add src-tauri/src/commands/inject.rs
git rm src-tauri/src/engines/wolf_rpg/sidecar.rs
git commit -m "chore: remove Wolf RPG sidecar dependency, use dump-based pipeline"
```

---

## Task 5: Update placeholders.rs for real Wolf codes

**Files:**
- Modify: `src-tauri/src/engines/wolf_rpg/placeholders.rs`

The original placeholder table only had `\self[n]`. After testing on `月咲流ホノカ ver1.03`, update with confirmed Wolf RPG codes found in the dump.

- [ ] **Step 1: Check real codes in dump**

Run in project root:
```bash
grep -r '\\\\[a-zA-Z]' "engine_test/月咲流ホノカ ver1.03/dump/" | head -20
grep -r '\\\w\+\[' "engine_test/月咲流ホノカ ver1.03/dump/" | head -20
```

Expected output: lines showing Wolf control codes like `\E`, `\c[N]`, `\n[N]`, `\self[N]`

- [ ] **Step 2: Update placeholder table**

Common Wolf RPG codes (update based on grep above):

| Wolf code | Encoded | Notes |
|-----------|---------|-------|
| `\self[N]` | `{{SELF_VAR[N]}}` | Self variable ref |
| `\cdb[N:M:K]` | `{{CDB[N:M:K]}}` | Database value ref |
| `\c[N]` | `{{COLOR[N]}}` | Color code |
| `\E` | `{{WAIT_E}}` | Wait for input |
| `\n[N]` | `{{HERO_NAME[N]}}` | Hero name |

Add confirmed codes only — do not speculate.

- [ ] **Step 3: Run existing placeholder tests**

Run: `cargo test wolf_rpg::placeholders`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/engines/wolf_rpg/placeholders.rs
git commit -m "feat: update Wolf RPG placeholder table from real game dump"
```

---

## Task 6: Full integration test on 月咲流ホノカ ver1.03

- [ ] **Step 1: Run cargo test**

```bash
cargo test wolf_rpg
```
Expected: all tests pass

- [ ] **Step 2: Build app**

```bash
cd src-tauri && cargo build 2>&1 | grep -E "^error"
```
Expected: no errors

- [ ] **Step 3: Open dump folder in app**

1. Launch `pnpm tauri:linux`
2. Click "Open project"
3. Select `engine_test/月咲流ホノカ ver1.03/dump/`
4. Verify: project opens, engine shown as "Wolf RPG", entries loaded

- [ ] **Step 4: Translate a sample batch**

1. Run translation on first 10 entries
2. Check debug export — verify translations are present

- [ ] **Step 5: Inject**

1. Click Export
2. Verify `output/mps/Map001.json` has translated `stringArgs`
3. Verify `gameTitle` NOT modified (Wolf has no gameTitle)

- [ ] **Step 6: Update ENGINE_NOTES.md**

Update `docs/ENGINE_NOTES.md` with Wolf RPG dump-mode findings.

- [ ] **Step 7: Final commit**

```bash
git add docs/ENGINE_NOTES.md
git commit -m "docs: update Wolf RPG engine notes for dump-based pipeline"
```

---

## Tested on
- [ ] Wolf RPG game (月咲流ホノカ ver1.03) — dump mode

## Linux notes
- No Wine required for dump-based approach
- User installs UberWolf + WolfTL once, runs manually before opening project
- Sidecars (`UberWolfCli-*`, `WolfTL-*`) kept in `src-tauri/bin/` for Windows users who prefer the automated pipeline (future work)
