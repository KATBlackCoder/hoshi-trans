pub mod extractor;
pub mod injector;
pub mod placeholders;
pub mod skip;

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
