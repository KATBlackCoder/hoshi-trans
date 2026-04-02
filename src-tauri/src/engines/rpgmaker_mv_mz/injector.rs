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
        by_file
            .entry(entry.file_path.as_str())
            .or_default()
            .push(entry);
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
                .filter_map(|e| {
                    e.translation
                        .as_deref()
                        .map(|t| (e.source_text.as_str(), t))
                })
                .collect();

            if filename.starts_with("Map") && filename != "MapInfos.json" {
                inject_map_translations(&mut json, &translations);
            } else if filename == "System.json" {
                inject_system_translations(&mut json, file_entries);
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
                            match code {
                                401 | 405 => {
                                    if let Some(t) = trans_iter.next() {
                                        cmd["parameters"][0] =
                                            serde_json::Value::String(t.1.to_string());
                                    }
                                }
                                102 => {
                                    // parameters[0] is an array of choice strings.
                                    // Consume one translation per choice and rebuild the array.
                                    if let Some(choices) =
                                        cmd["parameters"][0].as_array().map(|a| a.len())
                                    {
                                        let mut translated_choices = Vec::with_capacity(choices);
                                        for _ in 0..choices {
                                            if let Some(t) = trans_iter.next() {
                                                translated_choices
                                                    .push(serde_json::Value::String(t.1.to_string()));
                                            }
                                        }
                                        if !translated_choices.is_empty() {
                                            cmd["parameters"][0] =
                                                serde_json::Value::Array(translated_choices);
                                        }
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

/// Inject System.json translations using context field to locate exact position.
/// Context format:
///   "terms.basic"         → json["terms"]["basic"][i]
///   "terms.commands"      → json["terms"]["commands"][i]
///   "terms.params"        → json["terms"]["params"][i]
///   "skillTypes" etc.     → json["skillTypes"][i]
///   "terms.messages.KEY"  → json["terms"]["messages"]["KEY"]
pub fn inject_system_translations(
    json: &mut serde_json::Value,
    entries: &[&crate::models::TranslationEntry],
) {
    // Append hoshi-trans signature to gameTitle
    if let Some(title) = json["gameTitle"].as_str() {
        let signed = if title.contains("| TL:") {
            title.to_string()
        } else {
            format!("{} | TL: hoshi-trans", title)
        };
        json["gameTitle"] = serde_json::Value::String(signed);
    }

    for entry in entries {
        let translation = match entry.translation.as_deref() {
            Some(t) if !t.is_empty() => t,
            _ => continue,
        };
        let ctx = match entry.context.as_deref() {
            Some(c) => c,
            None => continue,
        };

        if let Some(key) = ctx.strip_prefix("terms.messages.") {
            // Object field — inject directly by key
            json["terms"]["messages"][key] = serde_json::Value::String(translation.to_string());
        } else if let Some(bracket) = ctx.rfind('[') {
            // Array field — context is "FIELD[i]", parse field name and index
            let field = &ctx[..bracket];
            let idx_str = ctx[bracket + 1..].trim_end_matches(']');
            if let Ok(idx) = idx_str.parse::<usize>() {
                let target = match field {
                    "terms.basic"    => &mut json["terms"]["basic"][idx],
                    "terms.commands" => &mut json["terms"]["commands"][idx],
                    "terms.params"   => &mut json["terms"]["params"][idx],
                    "skillTypes"     => &mut json["skillTypes"][idx],
                    "weaponTypes"    => &mut json["weaponTypes"][idx],
                    "armorTypes"     => &mut json["armorTypes"][idx],
                    "equipTypes"     => &mut json["equipTypes"][idx],
                    "elements"       => &mut json["elements"][idx],
                    _ => continue,
                };
                *target = serde_json::Value::String(translation.to_string());
            }
        }
    }
}

pub fn inject_database_translations(json: &mut serde_json::Value, translations: &[(&str, &str)]) {
    let mut trans_iter = translations.iter();
    if let Some(items) = json.as_array_mut() {
        for item in items.iter_mut().filter(|i| !i.is_null()) {
            for field in &[
                "name",
                "description",
                "message1",
                "message2",
                "message3",
                "message4",
            ] {
                if item[field].as_str().is_some() {
                    if let Some(t) = trans_iter.next() {
                        item[*field] = serde_json::Value::String(t.1.to_string());
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TranslationEntry;

    fn make_entry(ctx: &str, source: &str, translation: &str) -> TranslationEntry {
        TranslationEntry {
            id: "test".into(),
            project_id: "proj".into(),
            source_text: source.into(),
            translation: Some(translation.into()),
            status: "translated".into(),
            context: Some(ctx.into()),
            file_path: "data/System.json".into(),
            order_index: 0,
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
    fn test_inject_system_arrays_and_messages() {
        let mut json = serde_json::json!({
            "terms": {
                "basic":    ["レベル", "Lv", "体力"],
                "commands": ["攻撃", "防御"],
                "params":   ["最大HP"],
                "messages": {
                    "victory": "%1の勝利！",
                    "defeat":  "戦いに敗れた…"
                }
            },
            "skillTypes":  ["", "変態"],
            "weaponTypes": ["", "剣"],
            "armorTypes":  ["", "一般防具"],
            "equipTypes":  ["", "武器"],
            "elements":    ["", "貧困"]
        });

        // Context uses "FIELD[i]" format — index 1 ("Lv") is skipped by extractor (not JP)
        let entries = vec![
            make_entry("terms.basic[0]",    "レベル",  "Level"),
            make_entry("terms.basic[2]",    "体力",    "Stamina"),  // index 2, skipping "Lv"[1]
            make_entry("terms.commands[0]", "攻撃",    "Attack"),
            make_entry("terms.commands[1]", "防御",    "Guard"),
            make_entry("terms.params[0]",   "最大HP",  "Max HP"),
            make_entry("skillTypes[1]",     "変態",    "Pervert"),
            make_entry("weaponTypes[1]",    "剣",      "Sword"),
            make_entry("armorTypes[1]",     "一般防具","Light Armor"),
            make_entry("equipTypes[1]",     "武器",    "Weapon"),
            make_entry("elements[1]",       "貧困",    "Poor"),
            make_entry("terms.messages.victory", "%1の勝利！", "%1 wins!"),
            make_entry("terms.messages.defeat",  "戦いに敗れた…", "Defeated…"),
        ];
        let refs: Vec<&TranslationEntry> = entries.iter().collect();
        inject_system_translations(&mut json, &refs);

        assert_eq!(json["terms"]["basic"][0], "Level");
        assert_eq!(json["terms"]["basic"][1], "Lv");   // "Lv" not JP → skipped → untouched
        assert_eq!(json["terms"]["basic"][2], "Stamina");
        assert_eq!(json["terms"]["commands"][0], "Attack");
        assert_eq!(json["terms"]["commands"][1], "Guard");
        assert_eq!(json["terms"]["params"][0], "Max HP");
        assert_eq!(json["skillTypes"][1], "Pervert");
        assert_eq!(json["weaponTypes"][1], "Sword");
        assert_eq!(json["armorTypes"][1], "Light Armor");
        assert_eq!(json["equipTypes"][1], "Weapon");
        assert_eq!(json["elements"][1], "Poor");
        assert_eq!(json["terms"]["messages"]["victory"], "%1 wins!");
        assert_eq!(json["terms"]["messages"]["defeat"], "Defeated…");
    }

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

        assert_eq!(
            json["events"][0]["pages"][0]["list"][0]["parameters"][0],
            "Hello"
        );
        assert_eq!(
            json["events"][0]["pages"][0]["list"][1]["parameters"][0],
            "Goodbye"
        );
    }

    #[test]
    fn test_inject_map_uses_translation_as_is() {
        // Translation stored in DB is already native — injector writes it verbatim
        let mut json = serde_json::json!({
            "events": [{
                "pages": [{
                    "list": [
                        {"code": 401, "parameters": ["dummy"]}
                    ]
                }]
            }]
        });

        let translations = vec![("dummy", r"Hello \N[1]!")];
        inject_map_translations(&mut json, &translations);

        assert_eq!(
            json["events"][0]["pages"][0]["list"][0]["parameters"][0],
            r"Hello \N[1]!"
        );
    }

    #[test]
    fn test_inject_map_choices_rebuild_array() {
        let mut json = serde_json::json!({
            "events": [{
                "pages": [{
                    "list": [
                        {"code": 401, "indent": 0, "parameters": ["自宅を出る？"]},
                        {"code": 102, "indent": 0, "parameters": [["はい", "いいえ"], 1, 0, 2, 0]},
                        {"code": 401, "indent": 0, "parameters": ["次のセリフ"]}
                    ]
                }]
            }]
        });

        let translations = vec![
            ("自宅を出る？", "Leaving home?"),
            ("はい", "Yes"),
            ("いいえ", "No"),
            ("次のセリフ", "Next line"),
        ];
        inject_map_translations(&mut json, &translations);

        let list = &json["events"][0]["pages"][0]["list"];
        // code 401 translated normally
        assert_eq!(list[0]["parameters"][0], "Leaving home?");
        // code 102 parameters[0] stays an array with translated choices
        assert_eq!(list[1]["parameters"][0][0], "Yes");
        assert_eq!(list[1]["parameters"][0][1], "No");
        // remaining parameters (cancel_type, etc.) untouched
        assert_eq!(list[1]["parameters"][1], 1);
        assert_eq!(list[1]["parameters"][3], 2);
        // next 401 is not shifted
        assert_eq!(list[2]["parameters"][0], "Next line");
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
