use crate::engines::wolf_rpg::{extractor, placeholders, sidecar};
use crate::models::TranslationEntry;
use std::collections::HashMap;
use std::path::Path;

/// WolfTL dump JSON format (must match extractor.rs)
#[derive(serde::Deserialize, serde::Serialize)]
struct WolfEntry {
    #[serde(rename = "Original")]
    original: String,
    #[serde(rename = "Translation")]
    translation: String,
}

pub async fn inject(
    app: &tauri::AppHandle,
    game_dir: &Path,
    entries: &[TranslationEntry],
    output_dir: &Path,
) -> anyhow::Result<()> {
    let dec_dir = extractor::decrypted_dir(game_dir);
    let src_json_dir = extractor::json_dir(game_dir);
    let translated_json_dir = game_dir.join("hoshi-wolf-work/translated-json");

    if !dec_dir.exists() {
        return Err(anyhow::anyhow!(
            "Decrypted game files not found at {}. Run extraction first.",
            dec_dir.display()
        ));
    }
    if !src_json_dir.exists() {
        return Err(anyhow::anyhow!(
            "WolfTL dump not found at {}. Run extraction first.",
            src_json_dir.display()
        ));
    }

    std::fs::create_dir_all(&translated_json_dir)?;
    std::fs::create_dir_all(output_dir)?;

    // Group entries by file_path
    let mut by_file: HashMap<&str, Vec<&TranslationEntry>> = HashMap::new();
    for entry in entries {
        by_file.entry(&entry.file_path).or_default().push(entry);
    }
    // Sort each file's entries by order_index
    for vec in by_file.values_mut() {
        vec.sort_by_key(|e| e.order_index);
    }

    // For each JSON file in src_json_dir, write translated version
    let json_files = collect_json_files(&src_json_dir)?;
    for json_path in &json_files {
        let rel = json_path
            .strip_prefix(&src_json_dir)
            .unwrap_or(json_path)
            .to_string_lossy()
            .to_string();

        let content = std::fs::read_to_string(json_path)?;
        let mut wolf_entries: Vec<WolfEntry> = serde_json::from_str(&content)?;

        let file_entries = by_file.get(rel.as_str());

        if let Some(translated) = file_entries {
            // Match by order within this file (entries are in original order)
            let mut trans_iter = translated.iter();
            for we in &mut wolf_entries {
                if crate::engines::wolf_rpg::skip::should_skip(we.original.trim()) {
                    continue;
                }
                if let Some(entry) = trans_iter.next() {
                    if let Some(ref t) = entry.translation {
                        let (decoded, _) = placeholders::decode(t);
                        we.translation = decoded;
                    }
                }
            }
        }

        // Write to translated_json_dir preserving relative path
        let dest = translated_json_dir.join(&rel);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let out = serde_json::to_string_pretty(&wolf_entries)?;
        std::fs::write(&dest, out)?;
    }

    // Run WolfTL patch: decrypted + translated JSON → output_dir
    sidecar::run_wolftl_patch(app, &dec_dir, &translated_json_dir, output_dir).await?;

    Ok(())
}

fn collect_json_files(dir: &Path) -> anyhow::Result<Vec<std::path::PathBuf>> {
    let mut files = Vec::new();
    for entry in walkdir::WalkDir::new(dir)
        .sort_by_file_name()
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file()
            && entry.path().extension().map_or(false, |e| e == "json")
        {
            files.push(entry.path().to_path_buf());
        }
    }
    Ok(files)
}
