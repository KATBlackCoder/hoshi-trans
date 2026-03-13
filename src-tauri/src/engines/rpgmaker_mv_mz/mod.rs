pub fn detect(game_dir: &std::path::Path) -> bool {
    game_dir.join("data/System.json").exists()
}

pub fn get_game_title(game_dir: &std::path::Path) -> anyhow::Result<String> {
    let path = game_dir.join("data/System.json");
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
    fn test_detect_returns_true_when_system_json_exists() {
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
    fn test_get_game_title() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("data")).unwrap();
        std::fs::write(
            dir.path().join("data/System.json"),
            r#"{"gameTitle":"テストゲーム"}"#,
        )
        .unwrap();
        assert_eq!(get_game_title(dir.path()).unwrap(), "テストゲーム");
    }
}
