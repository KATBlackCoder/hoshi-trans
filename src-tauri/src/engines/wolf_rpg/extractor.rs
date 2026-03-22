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

/// Resolve the actual dump directory.
/// If the user opened the game root (containing Game.exe + Data.wolf),
/// the WolfTL dump may be in a `dump/` subdirectory.
fn resolve_dump_dir(path: &Path) -> std::path::PathBuf {
    // If the given path already has mps/ → use it directly
    if path.join("mps").exists() {
        return path.to_path_buf();
    }
    // Otherwise look for a dump/ subfolder (user opened game root, not dump/)
    let sub = path.join("dump");
    if sub.join("mps").exists() {
        return sub;
    }
    // Fall back to given path — will produce empty results gracefully
    path.to_path_buf()
}

pub fn extract_sync(
    path: &Path,
    project_id: &str,
) -> anyhow::Result<Vec<TranslationEntry>> {
    let dump_dir = resolve_dump_dir(path);
    let dump_dir = dump_dir.as_path();
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

    // Game.json — game title (player-visible on title screen)
    let game_json = dump_dir.join("Game.json");
    if game_json.exists() {
        let content = std::fs::read_to_string(&game_json)?;
        let json: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| anyhow::anyhow!("Parse error Game.json: {}", e))?;
        for field in &["Title", "TitlePlus", "StartUpMsg", "TitleMsg"] {
            if let Some(text) = json[field].as_str() {
                add_entry(
                    &mut entries,
                    project_id,
                    text,
                    Some(format!("game:{}", field.to_lowercase())),
                    "Game.json",
                    0,
                );
            }
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
                            Some((event_id, page_id)),
                            entries,
                        );
                    }
                }
            }
        }
    }
}

/// Returns true for Wolf RPG common event files that are engine/system internals.
/// These files contain logic for the RPG system framework (menus, battle engine,
/// shop, status screens) — never direct player-visible dialogue.
/// Prefixes: X[共] (common internal), X[移] (map internal), X[戦] (battle internal).
fn is_engine_internal_common(file_path: &str) -> bool {
    let name = file_path.split('/').last().unwrap_or(file_path);
    // Strip numeric prefix (e.g. "48_X[共]..." → "X[共]...")
    let after_num = name
        .find(|c: char| !c.is_ascii_digit())
        .map(|i| name[i..].trim_start_matches('_'))
        .unwrap_or(name);
    after_num.starts_with("X[共]")
        || after_num.starts_with("X[移]")
        || after_num.starts_with("X[戦]")
        || after_num.starts_with("X┣")
        || after_num.starts_with("X┗")
        || after_num.starts_with("X┃")
        || after_num.starts_with("X◆")
}

fn extract_common_file(
    json: &serde_json::Value,
    project_id: &str,
    file_path: &str,
    entries: &mut Vec<TranslationEntry>,
) {
    if is_engine_internal_common(file_path) {
        return;
    }
    if let Some(commands) = json["commands"].as_array() {
        extract_command_list(commands, project_id, file_path, "cmd", None, entries);
    }
}

/// Compute a globally unique order_index for mps commands.
/// cmd_index alone is local to its event/page list — multiple events in the same
/// file can have commands with the same index, causing DB unique constraint collisions.
/// Encoding event_id and page_id makes it file-globally unique.
/// For common/ files (no event/page nesting), mps_ids is None → use cmd_index directly.
fn mps_order_index(mps_ids: Option<(i64, i64)>, cmd_index: i64) -> i64 {
    match mps_ids {
        Some((event_id, page_id)) => event_id * 1_000_000 + page_id * 100_000 + cmd_index,
        None => cmd_index,
    }
}

fn extract_command_list(
    list: &[serde_json::Value],
    project_id: &str,
    file_path: &str,
    ctx_prefix: &str,
    mps_ids: Option<(i64, i64)>, // Some((event_id, page_id)) for mps, None for common
    entries: &mut Vec<TranslationEntry>,
) {
    for cmd in list {
        let code_str = cmd["codeStr"].as_str().unwrap_or("");
        let cmd_index = cmd["index"].as_i64().unwrap_or(0);
        let order = mps_order_index(mps_ids, cmd_index);

        match code_str {
            "Message" => {
                if let Some(text) = cmd["stringArgs"][0].as_str() {
                    add_entry(
                        entries,
                        project_id,
                        text,
                        Some(format!("{}:idx:{}", ctx_prefix, cmd_index)),
                        file_path,
                        order,
                    );
                }
            }
            // Wolf RPG uses "Choices" (not "Choice") for multi-option prompts.
            // Each option gets order*100+i to ensure unique order_index per DB constraint.
            "Choices" => {
                if let Some(args) = cmd["stringArgs"].as_array() {
                    for (i, arg) in args.iter().enumerate() {
                        if let Some(text) = arg.as_str() {
                            add_entry(
                                entries,
                                project_id,
                                text,
                                Some(format!("{}:idx:{}:choice:{}", ctx_prefix, cmd_index, i)),
                                file_path,
                                order * 100 + i as i64,
                            );
                        }
                    }
                }
            }
            // SetString: assigns a string to a variable — can contain visible player text
            // (e.g. unit suffixes like 個/枚/人, UI labels, item counts)
            "SetString" => {
                if let Some(text) = cmd["stringArgs"][0].as_str() {
                    add_entry(
                        entries,
                        project_id,
                        text,
                        Some(format!("{}:idx:{}:setstring", ctx_prefix, cmd_index)),
                        file_path,
                        order,
                    );
                }
            }
            _ => {}
        }
    }
}

/// Returns true for Wolf RPG system database files that contain only engine-internal
/// configuration (resistances, system flags, gender labels, etc.) — never player-visible text.
/// Dragon Blood (a fully translated game) leaves SysDatabase.json 100% in Japanese.
fn is_system_db(file_path: &str) -> bool {
    let name = file_path.split('/').last().unwrap_or(file_path);
    name == "SysDatabase.json"
}

fn extract_db_file(
    json: &serde_json::Value,
    project_id: &str,
    file_path: &str,
    entries: &mut Vec<TranslationEntry>,
) {
    let name = file_path.split('/').last().unwrap_or(file_path);
    // SysDatabase: engine-internal config, never player-visible.
    // CDataBase: runtime variable store (flags, counters, character stats) — values are
    //   numeric or file paths; skipping entirely avoids injecting broken paths/system keys.
    if matches!(name, "SysDatabase.json" | "CDataBase.json") {
        return;
    }
    let mut order: i64 = 0;
    if let Some(types) = json["types"].as_array() {
        for (ti, typ) in types.iter().enumerate() {
            if let Some(data) = typ["data"].as_array() {
                for (di, item) in data.iter().enumerate() {
                    // item["name"] and item["description"] are editor-facing labels —
                    // identical copies of the first data[].value field. Skip to avoid duplicates.
                    if let Some(fields) = item["data"].as_array() {
                        for (fi, f) in fields.iter().enumerate() {
                            if let Some(text) = f["value"].as_str() {
                                add_entry(
                                    entries,
                                    project_id,
                                    text,
                                    Some(format!("db:type:{}:data:{}:field:{}", ti, di, fi)),
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
        .filter(|e| {
            e.file_type().is_file()
                && e.path().extension().map_or(false, |x| x == "json")
        })
        .map(|e| e.path().to_path_buf())
        .collect();
    files.sort();
    Ok(files)
}

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
        // event_id=1, page_id=0, cmd_index=3 → 1*1_000_000 + 0*100_000 + 3
        assert_eq!(entries[0].order_index, 1_000_003);
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
                {"code": 102, "codeStr": "Choices", "stringArgs": ["はい", "いいえ"], "index": 5}
            ]}]}]
        }"#);
        std::fs::create_dir_all(dir.path().join("common")).unwrap();
        std::fs::create_dir_all(dir.path().join("db")).unwrap();

        let entries = extract_sync(dir.path(), "proj1").unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].source_text, "はい");
        assert_eq!(entries[1].source_text, "いいえ");
        // event_id=1, page_id=0, cmd_index=5 → order=1_000_005; choices: order*100+i
        assert_eq!(entries[0].order_index, 100_000_500);
        assert_eq!(entries[1].order_index, 100_000_501);
    }

    #[test]
    fn test_extract_setstring() {
        let dir = tempfile::tempdir().unwrap();
        write_file(dir.path(), "mps/Map001.json", r#"{
            "events": [{"id": 1, "name": "", "pages": [{"id": 0, "list": [
                {"code": 122, "codeStr": "SetString", "stringArgs": ["個"], "index": 5}
            ]}]}]
        }"#);
        std::fs::create_dir_all(dir.path().join("common")).unwrap();
        std::fs::create_dir_all(dir.path().join("db")).unwrap();

        let entries = extract_sync(dir.path(), "proj1").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].source_text, "個");
    }

    #[test]
    fn test_skip_system_db() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("mps")).unwrap();
        std::fs::create_dir_all(dir.path().join("common")).unwrap();
        // SysDatabase = engine-internal, skipped entirely
        write_file(dir.path(), "db/SysDatabase.json", r#"{"types":[{"data":[{"name":"テスト","description":"説明","data":[]}]}]}"#);
        // DataBase = only data[].value extracted (item name/description are editor labels, skipped)
        write_file(dir.path(), "db/DataBase.json", r#"{"types":[{"data":[{"name":"スキル","description":"","data":[{"name":"文","value":"攻撃"}]}]}]}"#);
        // CDataBase = skipped entirely (runtime variables, file paths, system keys)
        write_file(dir.path(), "db/CDataBase.json", r#"{"types":[{"data":[{"name":"戦闘中フラグ","description":"システム","data":[{"name":"名前","value":"いぬこ"}]}]}]}"#);

        let entries = extract_sync(dir.path(), "proj1").unwrap();
        // SysDatabase: nothing; DataBase: "攻撃" (value only, "スキル" item name skipped); CDataBase: nothing
        assert_eq!(entries.len(), 1);
        assert!(entries.iter().any(|e| e.source_text == "攻撃"));
        assert!(!entries.iter().any(|e| e.source_text == "スキル"));
        // CDataBase must NOT be extracted at all
        assert!(!entries.iter().any(|e| e.source_text == "いぬこ"));
        assert!(!entries.iter().any(|e| e.source_text == "戦闘中フラグ"));
        assert!(!entries.iter().any(|e| e.source_text == "システム"));
    }

    #[test]
    fn test_extract_game_json_title() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("mps")).unwrap();
        std::fs::create_dir_all(dir.path().join("common")).unwrap();
        std::fs::create_dir_all(dir.path().join("db")).unwrap();
        write_file(dir.path(), "Game.json", r#"{"Title":"いぬこちゃんは見習い魔女","TitlePlus":"","StartUpMsg":"","TitleMsg":""}"#);

        let entries = extract_sync(dir.path(), "proj1").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].source_text, "いぬこちゃんは見習い魔女");
        assert_eq!(entries[0].file_path, "Game.json");
        assert_eq!(entries[0].context, Some("game:title".to_string()));
    }

    #[test]
    fn test_extract_db_string_fields() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("mps")).unwrap();
        std::fs::create_dir_all(dir.path().join("common")).unwrap();
        write_file(dir.path(), "db/DataBase.json", r#"{
            "types": [{"data": [
                {"name": "Punch", "description": "", "data": [
                    {"name": "技能の名前", "value": "突き拳"},
                    {"name": "説明", "value": "敵にダメージを与える"},
                    {"name": "効果対象", "value": 10}
                ]}
            ]}]
        }"#);

        let entries = extract_sync(dir.path(), "proj1").unwrap();
        // String values with Japanese extracted, numeric fields skipped
        assert!(entries.iter().any(|e| e.source_text == "突き拳"));
        assert!(entries.iter().any(|e| e.source_text == "敵にダメージを与える"));
        // Numeric value not extracted
        assert!(!entries.iter().any(|e| e.source_text == "10"));
    }

    #[test]
    fn test_skip_engine_internal_common() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("mps")).unwrap();
        std::fs::create_dir_all(dir.path().join("db")).unwrap();
        // Internal files — should be skipped
        write_file(dir.path(), "common/48_X[共]基本ｼｽﾃﾑ自動初期化.json", r#"{"id":48,"name":"X[共]基本ｼｽﾃﾑ自動初期化","commands":[{"code":101,"codeStr":"Message","stringArgs":["内部メッセージ"],"index":0}]}"#);
        write_file(dir.path(), "common/70_X[移]パラメータ増減.json", r#"{"id":70,"name":"X[移]パラメータ増減","commands":[{"code":101,"codeStr":"Message","stringArgs":["内部移動"],"index":0}]}"#);
        write_file(dir.path(), "common/135_X[戦]パラメータ増減.json", r#"{"id":135,"name":"X[戦]パラメータ増減","commands":[{"code":101,"codeStr":"Message","stringArgs":["内部戦闘"],"index":0}]}"#);
        // Game-specific — should be extracted
        write_file(dir.path(), "common/212_相談コマンド.json", r#"{"id":212,"name":"相談コマンド","commands":[{"code":101,"codeStr":"Message","stringArgs":["ウルファール"],"index":0}]}"#);

        let entries = extract_sync(dir.path(), "proj1").unwrap();
        assert_eq!(entries.len(), 1, "Only game-specific common events should be extracted");
        assert_eq!(entries[0].source_text, "ウルファール");
        assert!(!entries.iter().any(|e| e.source_text == "内部メッセージ"));
        assert!(!entries.iter().any(|e| e.source_text == "内部移動"));
        assert!(!entries.iter().any(|e| e.source_text == "内部戦闘"));
    }

    #[test]
    fn test_extract_real_dump() {
        let path = std::path::Path::new(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../engine_test/月咲流ホノカ ver1.03/dump"
        ));
        if !path.exists() { return; }
        let entries = extract_sync(path, "test").unwrap();
        println!("Real dump entries: {}", entries.len());
        assert!(!entries.is_empty(), "Expected entries from real dump");
    }
}
