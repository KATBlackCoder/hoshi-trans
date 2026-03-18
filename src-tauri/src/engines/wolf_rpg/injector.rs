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

fn resolve_dump_dir(path: &Path) -> std::path::PathBuf {
    if path.join("mps").exists() {
        return path.to_path_buf();
    }
    let sub = path.join("dump");
    if sub.join("mps").exists() {
        return sub;
    }
    path.to_path_buf()
}

pub fn inject_sync(
    path: &Path,
    entries: &[TranslationEntry],
    output_dir: &Path,
) -> anyhow::Result<()> {
    let dump_dir_owned = resolve_dump_dir(path);
    let dump_dir = dump_dir_owned.as_path();
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

    for subdir in &["mps", "common", "db"] {
        let src_dir = dump_dir.join(subdir);
        if !src_dir.exists() {
            continue;
        }
        for file_path in sorted_json_files(&src_dir)? {
            let rel = rel_path(dump_dir, &file_path);
            let content = std::fs::read_to_string(&file_path)?;
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

        inject_sync(dir.path(), &[], dir.path()).unwrap();

        let out: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(dir.path().join("mps/Map001.json")).unwrap()
        ).unwrap();
        assert_eq!(out["events"][0]["pages"][0]["list"][0]["stringArgs"][0], "原文");
    }
}
