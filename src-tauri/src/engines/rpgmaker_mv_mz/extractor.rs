use crate::engines::rpgmaker_mv_mz::{skip, placeholders};
use crate::models::TranslationEntry;
use uuid::Uuid;

#[cfg(test)]
mod tests {
    use super::*;

    const MZ_DIR: &str = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../engine_test/Adventurer_Corruption"
    );
    const MV_DIR: &str = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../engine_test/Ah,Ghost-1.10"
    );

    #[tokio::test]
    async fn test_extract_mz_runs_without_error() {
        // Adventurer_Corruption is an English MZ game — skip filter correctly
        // discards all entries (no Japanese text). Test verifies the extractor
        // reads the MZ data/ structure without panicking or erroring.
        let path = std::path::Path::new(MZ_DIR);
        if !path.exists() {
            return;
        }
        assert!(super::super::detect(path), "MZ detection failed");
        let result = extract(path, "test-proj").await;
        assert!(result.is_ok(), "extractor error: {:?}", result.err());
        let entries = result.unwrap();
        println!("MZ (English game) entries after skip filter: {}", entries.len());
        // All returned entries must be valid if any
        assert!(entries.iter().all(|e| !e.source_text.is_empty()));
        assert!(entries.iter().all(|e| e.status == "pending"));
        assert!(entries.iter().all(|e| e.order_index >= 0));
    }

    #[tokio::test]
    async fn test_extract_mv_returns_entries() {
        let path = std::path::Path::new(MV_DIR);
        if !path.exists() {
            return;
        }
        let entries = extract(path, "test-proj").await.unwrap();
        assert!(!entries.is_empty(), "MV extractor returned 0 entries");
        println!("MV entries: {}", entries.len());
        assert!(entries.iter().all(|e| !e.source_text.is_empty()));
        assert!(entries.iter().all(|e| e.status == "pending"));
    }

    #[tokio::test]
    async fn test_extract_no_non_japanese_text() {
        let path = std::path::Path::new(MZ_DIR);
        if !path.exists() {
            return;
        }
        let entries = extract(path, "test-proj").await.unwrap();
        // No entry should contain purely ASCII source text (skip filter working)
        let bad: Vec<_> = entries
            .iter()
            .filter(|e| !crate::engines::common::skip::contains_japanese(&e.source_text))
            .collect();
        if !bad.is_empty() {
            for e in &bad {
                println!("Non-JP leaked: {:?}", e.source_text);
            }
        }
        assert!(bad.is_empty(), "{} non-Japanese entries leaked through skip filter", bad.len());
    }

    #[tokio::test]
    async fn test_extract_mv_no_non_japanese_text() {
        let path = std::path::Path::new(MV_DIR);
        if !path.exists() {
            return;
        }
        let entries = extract(path, "test-proj").await.unwrap();
        let bad: Vec<_> = entries
            .iter()
            .filter(|e| !crate::engines::common::skip::contains_japanese(&e.source_text))
            .collect();
        if !bad.is_empty() {
            for e in &bad {
                println!("Non-JP leaked: {:?}", e.source_text);
            }
        }
        assert!(bad.is_empty(), "{} non-Japanese entries leaked through skip filter", bad.len());
    }
}

/// Extract all translatable strings from RPG Maker MV/MZ data/ folder
pub async fn extract(
    game_dir: &std::path::Path,
    project_id: &str,
) -> anyhow::Result<Vec<TranslationEntry>> {
    // Support both MZ (data/) and MV (www/data/)
    let data_dir = if game_dir.join("data").exists() {
        game_dir.join("data")
    } else {
        game_dir.join("www/data")
    };

    let mut entries = Vec::new();

    for entry in std::fs::read_dir(&data_dir)? {
        let path = entry?.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let filename = path.file_name().unwrap().to_string_lossy().to_string();
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let json: serde_json::Value = match serde_json::from_str(&content) {
            Ok(j) => j,
            Err(_) => continue,
        };

        let file_rel = format!("data/{}", filename);

        if filename.starts_with("Map") && filename != "MapInfos.json" {
            extract_map_events(&json, project_id, &file_rel, &mut entries);
        } else if filename == "CommonEvents.json" {
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
                                    if let Some(text) = cmd["parameters"][0].as_str() {
                                        add_entry(entries, project_id, text, Some(format!("code:{}", code)), file_path, order);
                                        order += 1;
                                    }
                                }
                                102 => {
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
