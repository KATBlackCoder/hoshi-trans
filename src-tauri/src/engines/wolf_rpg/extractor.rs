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

fn extract_db_file(
    json: &serde_json::Value,
    project_id: &str,
    file_path: &str,
    entries: &mut Vec<TranslationEntry>,
) {
    let mut order: i64 = 0;
    if let Some(types) = json["types"].as_array() {
        for (ti, typ) in types.iter().enumerate() {
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
        assert_eq!(entries[0].order_index, 5);
    }
}
