use crate::models::TranslationEntry;
use std::collections::HashMap;
use std::path::Path;

pub async fn inject(
    game_dir: &Path,
    entries: &[TranslationEntry],
    output_dir: &Path,
    font_size: Option<u32>,
) -> anyhow::Result<()> {
    inject_sync(game_dir, entries, output_dir, font_size)
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
    font_size: Option<u32>,
) -> anyhow::Result<()> {
    let dump_dir_owned = resolve_dump_dir(path);
    let dump_dir = dump_dir_owned.as_path();
    // Index: (file_path, order_index, context) → translation
    let mut index: HashMap<(String, i64, String), String> = HashMap::new();
    for entry in entries {
        if let Some(ref t) = entry.translation {
            if !t.is_empty() {
                let ctx = entry.context.clone().unwrap_or_default();
                index.insert((entry.file_path.clone(), entry.order_index, ctx), t.clone());
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
                "mps" => inject_mps(&mut json, &rel, &index, font_size),
                "common" => inject_common(&mut json, &rel, &index, font_size),
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
    // Game.json — game title
    let game_json = dump_dir.join("Game.json");
    if game_json.exists() {
        let content = std::fs::read_to_string(&game_json)?;
        let mut json: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| anyhow::anyhow!("Parse error Game.json: {}", e))?;
        for field in &["Title", "TitlePlus", "StartUpMsg", "TitleMsg"] {
            let ctx = format!("game:{}", field.to_lowercase());
            if let Some(t) = index.get(&("Game.json".to_string(), 0, ctx)) {
                json[field] = serde_json::Value::String(t.clone());
            }
        }
        // Append hoshi-trans signature to Title
        if let Some(title) = json["Title"].as_str() {
            let signed = if title.contains("| TL:") {
                title.to_string()
            } else {
                format!("{} | TL: hoshi-trans", title)
            };
            json["Title"] = serde_json::Value::String(signed);
        }
        let dest = output_dir.join("Game.json");
        std::fs::write(&dest, serde_json::to_string_pretty(&json)?)?;
    }

    Ok(())
}

fn mps_order_index(event_id: i64, page_id: i64, cmd_index: i64) -> i64 {
    event_id * 1_000_000 + page_id * 100_000 + cmd_index
}

fn inject_mps(
    json: &mut serde_json::Value,
    file_path: &str,
    index: &HashMap<(String, i64, String), String>,
    font_size: Option<u32>,
) {
    if let Some(events) = json["events"].as_array_mut() {
        for event in events.iter_mut() {
            let event_id = event["id"].as_i64().unwrap_or(0);
            if let Some(pages) = event["pages"].as_array_mut() {
                for page in pages.iter_mut() {
                    let page_id = page["id"].as_i64().unwrap_or(0);
                    let ctx_prefix = format!("event:{}:page:{}", event_id, page_id);
                    if let Some(list) = page["list"].as_array_mut() {
                        inject_command_list(list, file_path, &ctx_prefix, Some((event_id, page_id)), index, font_size);
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
    font_size: Option<u32>,
) {
    if let Some(commands) = json["commands"].as_array_mut() {
        inject_command_list(commands, file_path, "cmd", None, index, font_size);
    }
}

fn apply_font_prefix(text: &str, font_size: Option<u32>) -> String {
    // NOTE: currently we skip if text already starts with \f[ to avoid double-prefixing.
    // In a future revision, evaluate whether we should overwrite existing \f[ codes instead.
    match font_size {
        Some(n) if !text.starts_with("\\f[") => format!("\\f[{}]{}", n, text),
        _ => text.to_string(),
    }
}

fn inject_command_list(
    list: &mut [serde_json::Value],
    file_path: &str,
    ctx_prefix: &str,
    mps_ids: Option<(i64, i64)>, // Some((event_id, page_id)) for mps, None for common
    index: &HashMap<(String, i64, String), String>,
    font_size: Option<u32>,
) {
    for cmd in list.iter_mut() {
        let code_str = cmd["codeStr"].as_str().unwrap_or("").to_string();
        let cmd_index = cmd["index"].as_i64().unwrap_or(0);
        let order = match mps_ids {
            Some((event_id, page_id)) => mps_order_index(event_id, page_id, cmd_index),
            None => cmd_index,
        };

        match code_str.as_str() {
            "Message" => {
                let ctx = format!("{}:idx:{}", ctx_prefix, cmd_index);
                if let Some(t) = index.get(&(file_path.to_string(), order, ctx)) {
                    let text = apply_font_prefix(t, font_size);
                    cmd["stringArgs"][0] = serde_json::Value::String(text);
                }
            }
            "Choices" => {
                let n = cmd["stringArgs"].as_array().map(|a| a.len()).unwrap_or(0);
                for i in 0..n {
                    let ctx = format!("{}:idx:{}:choice:{}", ctx_prefix, cmd_index, i);
                    let choice_order = order * 100 + i as i64;
                    if let Some(t) = index.get(&(file_path.to_string(), choice_order, ctx)) {
                        let text = apply_font_prefix(t, font_size);
                        cmd["stringArgs"][i] = serde_json::Value::String(text);
                    }
                }
            }
            "SetString" => {
                let ctx = format!("{}:idx:{}:setstring", ctx_prefix, cmd_index);
                if let Some(t) = index.get(&(file_path.to_string(), order, ctx)) {
                    let text = apply_font_prefix(t, font_size);
                    cmd["stringArgs"][0] = serde_json::Value::String(text);
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
    let name = file_path.split('/').last().unwrap_or(file_path);
    if matches!(name, "SysDatabase.json" | "CDataBase.json") {
        return;
    }
    let skip_name_desc = false;

    let mut order: i64 = 0;
    if let Some(types) = json["types"].as_array_mut() {
        for (ti, typ) in types.iter_mut().enumerate() {
            if let Some(data) = typ["data"].as_array_mut() {
                for (di, item) in data.iter_mut().enumerate() {
                    // item["name"]/["description"] are editor labels — not extracted, not injected.
                    if let Some(fields) = item["data"].as_array_mut() {
                        for (fi, f) in fields.iter_mut().enumerate() {
                            if f["value"].as_str().is_some() {
                                let ctx = format!("db:type:{}:data:{}:field:{}", ti, di, fi);
                                if let Some(t) = index.get(&(file_path.to_string(), order, ctx)) {
                                    f["value"] = serde_json::Value::String(t.clone());
                                }
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
            refined_text: None,
            refined_status: None,
            ph_count_source: None,
            ph_count_draft: None,
            ph_count_refined: None,
            text_type: None,
            refined_at: None,
            translated_at: None,
            prompt_tokens: None,
            output_tokens: None,
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

        // order_index = event_id=1 * 1_000_000 + page_id=0 * 100_000 + cmd_index=3
        let entries = vec![entry("mps/Map001.json", 1_000_003, "event:1:page:0:idx:3", "Hello")];
        inject_sync(dir.path(), &entries, dir.path(), None).unwrap();

        let out: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(dir.path().join("mps/Map001.json")).unwrap()
        ).unwrap();
        assert_eq!(out["events"][0]["pages"][0]["list"][0]["stringArgs"][0], "Hello");
    }

    #[test]
    fn test_inject_choices_options() {
        let dir = tempfile::tempdir().unwrap();
        let map_path = dir.path().join("mps/Map001.json");
        std::fs::create_dir_all(map_path.parent().unwrap()).unwrap();
        std::fs::write(&map_path, r#"{
            "events": [{"id": 1, "name": "", "pages": [{"id": 0, "list": [
                {"code": 102, "codeStr": "Choices", "stringArgs": ["はい", "いいえ"], "index": 5}
            ]}]}]
        }"#).unwrap();

        // order = event_id=1 * 1_000_000 + page_id=0 * 100_000 + cmd_index=5 = 1_000_005
        // choices: order*100+i = 100_000_500, 100_000_501
        let entries = vec![
            entry("mps/Map001.json", 100_000_500, "event:1:page:0:idx:5:choice:0", "Yes"),
            entry("mps/Map001.json", 100_000_501, "event:1:page:0:idx:5:choice:1", "No"),
        ];
        inject_sync(dir.path(), &entries, dir.path(), None).unwrap();

        let out: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(dir.path().join("mps/Map001.json")).unwrap()
        ).unwrap();
        let args = &out["events"][0]["pages"][0]["list"][0]["stringArgs"];
        assert_eq!(args[0], "Yes");
        assert_eq!(args[1], "No");
    }

    #[test]
    fn test_inject_setstring() {
        let dir = tempfile::tempdir().unwrap();
        let map_path = dir.path().join("mps/Map001.json");
        std::fs::create_dir_all(map_path.parent().unwrap()).unwrap();
        std::fs::write(&map_path, r#"{
            "events": [{"id": 1, "name": "", "pages": [{"id": 0, "list": [
                {"code": 122, "codeStr": "SetString", "stringArgs": ["個"], "index": 7}
            ]}]}]
        }"#).unwrap();

        // order_index = event_id=1 * 1_000_000 + page_id=0 * 100_000 + cmd_index=7
        let entries = vec![
            entry("mps/Map001.json", 1_000_007, "event:1:page:0:idx:7:setstring", "unit"),
        ];
        inject_sync(dir.path(), &entries, dir.path(), None).unwrap();

        let out: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(dir.path().join("mps/Map001.json")).unwrap()
        ).unwrap();
        assert_eq!(out["events"][0]["pages"][0]["list"][0]["stringArgs"][0], "unit");
    }

    #[test]
    fn test_inject_db_field_values() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("mps")).unwrap();
        std::fs::create_dir_all(dir.path().join("common")).unwrap();
        let db_path = dir.path().join("db/DataBase.json");
        std::fs::create_dir_all(db_path.parent().unwrap()).unwrap();
        std::fs::write(&db_path, r#"{
            "types": [{"data": [
                {"name": "Punch", "description": "", "data": [
                    {"name": "技能の名前", "value": "突き拳"},
                    {"name": "説明", "value": "敵にダメージを与える"}
                ]}
            ]}]
        }"#).unwrap();

        // item name/description skipped — data fields start at order=0
        let entries = vec![
            entry("db/DataBase.json", 0, "db:type:0:data:0:field:0", "Punch"),
            entry("db/DataBase.json", 1, "db:type:0:data:0:field:1", "Deals damage to enemy"),
        ];
        inject_sync(dir.path(), &entries, dir.path(), None).unwrap();

        let out: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(dir.path().join("db/DataBase.json")).unwrap()
        ).unwrap();
        assert_eq!(out["types"][0]["data"][0]["data"][0]["value"], "Punch");
        assert_eq!(out["types"][0]["data"][0]["data"][1]["value"], "Deals damage to enemy");
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

        let empty: Vec<TranslationEntry> = vec![];
        inject_sync(dir.path(), &empty, dir.path(), None).unwrap();

        let out: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(dir.path().join("mps/Map001.json")).unwrap()
        ).unwrap();
        assert_eq!(out["events"][0]["pages"][0]["list"][0]["stringArgs"][0], "原文");
    }
}
