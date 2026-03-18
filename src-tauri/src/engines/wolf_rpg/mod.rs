pub mod extractor;
pub mod injector;
pub mod placeholders;
pub mod skip;

/// Read the game title from Game.json in the dump folder (or dump/ subfolder).
/// Falls back to the folder name if not found.
pub fn get_game_title(game_dir: &std::path::Path) -> String {
    // Try game_dir/Game.json, then game_dir/dump/Game.json
    for candidate in &[game_dir.join("Game.json"), game_dir.join("dump/Game.json")] {
        if let Ok(content) = std::fs::read_to_string(candidate) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(title) = json["Title"].as_str() {
                    if !title.is_empty() {
                        return title.to_string();
                    }
                }
            }
        }
    }
    // Fallback: folder name
    game_dir
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Unknown".into())
}

pub fn detect(game_dir: &std::path::Path) -> bool {
    // Dump folder mode (primary): WolfTL dump/ with mps/ common/ db/
    let is_dump = game_dir.join("mps").exists()
        && game_dir.join("common").exists()
        && game_dir.join("db").exists();
    // Unpacked game mode (legacy): Game.exe + Data/BasicData or Data.wolf
    let is_unpacked = game_dir.join("Game.exe").exists()
        && (game_dir.join("Data/BasicData").exists()
            || game_dir.join("Data.wolf").exists());
    is_dump || is_unpacked
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_false_for_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!detect(dir.path()));
    }

    #[test]
    fn test_detect_true_when_wolf_structure_present() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("Game.exe"), b"").unwrap();
        std::fs::create_dir_all(dir.path().join("Data/BasicData")).unwrap();
        assert!(detect(dir.path()));
    }

    #[test]
    fn test_not_wolf_without_basic_data() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("Game.exe"), b"").unwrap();
        assert!(!detect(dir.path()));
    }

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
}
