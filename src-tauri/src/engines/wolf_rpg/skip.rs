use crate::engines::common::skip as common_skip;

pub fn should_skip(text: &str) -> bool {
    if common_skip::should_skip(text) {
        return true;
    }
    is_wolf_db_reference(text)
        || is_wolf_debug_message(text)
        || is_wolf_data_path(text)
}

fn is_wolf_db_reference(text: &str) -> bool {
    text.contains("cdb[") || text.starts_with("sdb:")
}

/// Skip les messages de debug Wolf RPG : `X[戦]技能選択実行` (uppercase X suivi de `[`)
/// Ces chaînes sont des références à des catégories de base de données Wolf, pas du texte joueur.
fn is_wolf_debug_message(text: &str) -> bool {
    text.contains("X[")
}

/// Skip les chemins système Wolf RPG : `Data\BasicData\`, `Data/SE/attack.mp3`
/// Ces chaînes référencent des fichiers du jeu, pas du texte à traduire.
fn is_wolf_data_path(text: &str) -> bool {
    text.starts_with("Data\\") || text.starts_with("Data/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_delegates_to_common() {
        assert!(should_skip(""));
        assert!(should_skip("Hello"));
    }

    #[test]
    fn test_skip_wolf_db_reference() {
        assert!(should_skip("cdb[sdb:0:0]"));
    }

    #[test]
    fn test_keep_japanese() {
        assert!(!should_skip("勇者よ、立ち上がれ！"));
    }

    #[test]
    fn test_skip_wolf_debug_message() {
        // X[ uppercase = référence catégorie DB Wolf, pas du texte joueur
        assert!(should_skip("X[戦]技能選択実行"));
        assert!(should_skip("コモン159「X[共]万能ウィンドウ」：エラー"));
        assert!(should_skip("X[移]テスト"));
        // x[ minuscule → ce n'est PAS un message debug Wolf
        assert!(!should_skip("x[テスト]勇者"));
    }

    #[test]
    fn test_skip_wolf_data_path() {
        assert!(should_skip("Data\\BasicData\\"));
        assert!(should_skip("Data/SE/attack.mp3"));
        assert!(should_skip("Data\\BGM\\theme.ogg"));
        // "Data" pas en début de chaîne → ne pas skipper
        assert!(!should_skip("アイテムDataのテスト"));
    }
}
