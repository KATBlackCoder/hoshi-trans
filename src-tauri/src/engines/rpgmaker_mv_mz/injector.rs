use crate::engines::rpgmaker_mv_mz::placeholders;
use crate::models::TranslationEntry;
use std::collections::HashMap;
use std::path::Path;

/// Inject translations into all RPG Maker JSON files, write to output_dir.
/// Handles both MZ (game_dir/data/) and MV (game_dir/www/data/).
/// Output is always written to output_dir/data/.
pub async fn inject(
    game_dir: &Path,
    entries: &[TranslationEntry],
    output_dir: &Path,
) -> anyhow::Result<()> {
    // Group entries by file_path (stored as "data/<filename>")
    let mut by_file: HashMap<&str, Vec<&TranslationEntry>> = HashMap::new();
    for entry in entries {
        by_file.entry(entry.file_path.as_str()).or_default().push(entry);
    }

    // Sort each file's entries by order_index
    for file_entries in by_file.values_mut() {
        file_entries.sort_by_key(|e| e.order_index);
    }

    // Resolve actual source data dir (MZ = data/, MV = www/data/)
    let data_dir = if game_dir.join("data").exists() {
        game_dir.join("data")
    } else {
        game_dir.join("www/data")
    };

    let out_data_dir = output_dir.join("data");
    std::fs::create_dir_all(&out_data_dir)?;

    for dir_entry in std::fs::read_dir(&data_dir)? {
        let path = dir_entry?.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let filename = path.file_name().unwrap().to_string_lossy().to_string();
        let file_rel = format!("data/{}", filename);

        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let mut json: serde_json::Value = match serde_json::from_str(&content) {
            Ok(j) => j,
            Err(_) => continue,
        };

        if let Some(file_entries) = by_file.get(file_rel.as_str()) {
            let translations: Vec<(&str, &str)> = file_entries
                .iter()
                .filter_map(|e| e.translation.as_deref().map(|t| (e.source_text.as_str(), t)))
                .collect();

            if filename.starts_with("Map") && filename != "MapInfos.json" {
                inject_map_translations(&mut json, &translations);
            } else {
                inject_database_translations(&mut json, &translations);
            }
        }

        let out_path = out_data_dir.join(&filename);
        let out_content = serde_json::to_string_pretty(&json)?;
        std::fs::write(out_path, out_content)?;
    }

    Ok(())
}

pub fn inject_map_translations(json: &mut serde_json::Value, translations: &[(&str, &str)]) {
    let mut trans_iter = translations.iter();

    if let Some(events) = json["events"].as_array_mut() {
        for event in events.iter_mut().filter(|e| !e.is_null()) {
            if let Some(pages) = event["pages"].as_array_mut() {
                for page in pages.iter_mut() {
                    if let Some(list) = page["list"].as_array_mut() {
                        for cmd in list.iter_mut() {
                            let code = cmd["code"].as_i64().unwrap_or(0);
                            if matches!(code, 401 | 405 | 102) {
                                if let Some(t) = trans_iter.next() {
                                    let (decoded, _) = placeholders::decode(t.1);
                                    cmd["parameters"][0] = serde_json::Value::String(decoded);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

pub fn inject_database_translations(json: &mut serde_json::Value, translations: &[(&str, &str)]) {
    let mut trans_iter = translations.iter();
    if let Some(items) = json.as_array_mut() {
        for item in items.iter_mut().filter(|i| !i.is_null()) {
            for field in &["name", "description", "message1", "message2", "message3", "message4"] {
                if item[field].as_str().is_some() {
                    if let Some(t) = trans_iter.next() {
                        let (decoded, _) = placeholders::decode(t.1);
                        item[*field] = serde_json::Value::String(decoded);
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inject_map_replaces_dialogue() {
        let mut json = serde_json::json!({
            "events": [{
                "pages": [{
                    "list": [
                        {"code": 401, "parameters": ["こんにちは"]},
                        {"code": 401, "parameters": ["さようなら"]}
                    ]
                }]
            }]
        });

        let translations = vec![("こんにちは", "Hello"), ("さようなら", "Goodbye")];
        inject_map_translations(&mut json, &translations);

        assert_eq!(json["events"][0]["pages"][0]["list"][0]["parameters"][0], "Hello");
        assert_eq!(json["events"][0]["pages"][0]["list"][1]["parameters"][0], "Goodbye");
    }

    #[test]
    fn test_inject_map_decodes_placeholders() {
        let mut json = serde_json::json!({
            "events": [{
                "pages": [{
                    "list": [
                        {"code": 401, "parameters": ["dummy"]}
                    ]
                }]
            }]
        });

        let translations = vec![("dummy", "Hello {{PH:N[1]}}!")];
        inject_map_translations(&mut json, &translations);

        assert_eq!(
            json["events"][0]["pages"][0]["list"][0]["parameters"][0],
            r"Hello \N[1]!"
        );
    }

    #[test]
    fn test_inject_database_replaces_name_and_description() {
        let mut json = serde_json::json!([
            null,
            {"name": "剣", "description": "普通の剣"}
        ]);

        let translations = vec![("剣", "Sword"), ("普通の剣", "An ordinary sword")];
        inject_database_translations(&mut json, &translations);

        assert_eq!(json[1]["name"], "Sword");
        assert_eq!(json[1]["description"], "An ordinary sword");
    }
}
