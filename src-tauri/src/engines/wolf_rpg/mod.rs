pub mod extractor;
pub mod injector;
pub mod placeholders;
pub mod sidecar;
pub mod skip;

pub fn detect(game_dir: &std::path::Path) -> bool {
    game_dir.join("Game.exe").exists() && game_dir.join("Data/BasicData").exists()
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
}
