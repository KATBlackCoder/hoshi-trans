use crate::engines::wolf_rpg::{placeholders, sidecar, skip};
use crate::models::TranslationEntry;
use std::path::Path;
use uuid::Uuid;

/// WolfTL dump JSON format: array of objects per file
/// { "Original": "JP text", "Translation": "" }
/// ⚠️ Verify this format against a real game — update if different
#[derive(serde::Deserialize, serde::Serialize)]
struct WolfEntry {
    #[serde(rename = "Original")]
    original: String,
    #[serde(rename = "Translation")]
    translation: String,
}

/// Working directory under game_dir for decrypted + dump files
fn work_dir(game_dir: &Path) -> std::path::PathBuf {
    game_dir.join("hoshi-wolf-work")
}

pub fn decrypted_dir(game_dir: &Path) -> std::path::PathBuf {
    work_dir(game_dir).join("decrypted")
}

pub fn json_dir(game_dir: &Path) -> std::path::PathBuf {
    work_dir(game_dir).join("json")
}

pub async fn extract(
    app: &tauri::AppHandle,
    game_dir: &Path,
    project_id: &str,
) -> anyhow::Result<Vec<TranslationEntry>> {
    let dec_dir = decrypted_dir(game_dir);
    let dump_dir = json_dir(game_dir);
    std::fs::create_dir_all(&dec_dir)?;
    std::fs::create_dir_all(&dump_dir)?;

    // Step 1: decrypt with UberWolfCli
    sidecar::run_uberwolf(app, game_dir, &dec_dir).await?;

    // Step 2: dump text to JSON with WolfTL
    sidecar::run_wolftl_dump(app, &dec_dir, &dump_dir).await?;

    // Step 3: parse JSON files → TranslationEntry
    let mut entries = Vec::new();
    let mut order: i64 = 0;

    let json_files = collect_json_files(&dump_dir)?;

    for json_path in &json_files {
        let rel = json_path
            .strip_prefix(&dump_dir)
            .unwrap_or(json_path)
            .to_string_lossy()
            .to_string();

        let content = std::fs::read_to_string(json_path)?;
        let wolf_entries: Vec<WolfEntry> = serde_json::from_str(&content)
            .map_err(|e| anyhow::anyhow!("Failed to parse {}: {}", rel, e))?;

        for we in wolf_entries {
            let text = we.original.trim().to_string();
            if skip::should_skip(&text) {
                continue;
            }
            let encoded = placeholders::encode(&text);
            entries.push(TranslationEntry {
                id: Uuid::new_v4().to_string(),
                project_id: project_id.to_string(),
                source_text: encoded,
                translation: None,
                status: "pending".to_string(),
                context: None,
                file_path: rel.clone(),
                order_index: order,
            });
            order += 1;
        }
    }

    Ok(entries)
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
