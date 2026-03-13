/// RPG Maker MZ uses `data/`, MV uses `www/data/`
pub fn detect(game_dir: &std::path::Path) -> bool {
    game_dir.join("data/System.json").exists()
        || game_dir.join("www/data/System.json").exists()
}

fn system_json_path(game_dir: &std::path::Path) -> Option<std::path::PathBuf> {
    let mz = game_dir.join("data/System.json");
    if mz.exists() {
        return Some(mz);
    }
    let mv = game_dir.join("www/data/System.json");
    if mv.exists() {
        return Some(mv);
    }
    None
}

pub fn get_game_title(game_dir: &std::path::Path) -> anyhow::Result<String> {
    let path = system_json_path(game_dir)
        .ok_or_else(|| anyhow::anyhow!("System.json not found"))?;
    let content = std::fs::read_to_string(path)?;
    let json: serde_json::Value = serde_json::from_str(&content)?;
    Ok(json["gameTitle"]
        .as_str()
        .unwrap_or("Unknown")
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_returns_false_for_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!detect(dir.path()));
    }

    #[test]
    fn test_detect_returns_true_for_mz() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("data")).unwrap();
        std::fs::write(
            dir.path().join("data/System.json"),
            r#"{"gameTitle":"テストゲーム"}"#,
        )
        .unwrap();
        assert!(detect(dir.path()));
    }

    #[test]
    fn test_detect_returns_true_for_mv() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("www/data")).unwrap();
        std::fs::write(
            dir.path().join("www/data/System.json"),
            r#"{"gameTitle":"MVゲーム"}"#,
        )
        .unwrap();
        assert!(detect(dir.path()));
    }

    #[test]
    fn test_get_game_title_mz() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("data")).unwrap();
        std::fs::write(
            dir.path().join("data/System.json"),
            r#"{"gameTitle":"テストゲーム"}"#,
        )
        .unwrap();
        assert_eq!(get_game_title(dir.path()).unwrap(), "テストゲーム");
    }

    #[test]
    fn test_get_game_title_mv() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("www/data")).unwrap();
        std::fs::write(
            dir.path().join("www/data/System.json"),
            r#"{"gameTitle":"MVゲーム"}"#,
        )
        .unwrap();
        assert_eq!(get_game_title(dir.path()).unwrap(), "MVゲーム");
    }
}
