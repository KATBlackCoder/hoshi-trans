pub fn should_skip(text: &str) -> bool {
    is_empty_or_whitespace(text)
        || !contains_japanese(text)
        || is_file_path(text)
        || is_script_formula(text)
        || is_pure_number(text)
        || is_pipe_separated(text)
        || is_event_identifier(text)
        || is_empty_japanese_quotes(text)
}

fn is_empty_or_whitespace(text: &str) -> bool {
    text.trim().is_empty()
}

pub fn contains_japanese(text: &str) -> bool {
    text.chars().any(|c| {
        matches!(c,
            '\u{3040}'..='\u{309F}'  // Hiragana
            | '\u{30A0}'..='\u{30FF}' // Katakana
            | '\u{4E00}'..='\u{9FFF}' // CJK Kanji
        )
    })
}

fn is_file_path(text: &str) -> bool {
    text.starts_with('/') || text.contains("://")
}

fn is_script_formula(text: &str) -> bool {
    text.contains("$game")
        || text.contains(".value(")
        || text.contains("eval(")
        || text.contains(".actor(")
}

fn is_pure_number(text: &str) -> bool {
    text.trim().chars().all(|c| c.is_ascii_digit())
}

/// Skip textes avec `|` : coordonnées UI (`はい|262|380`), menus Wolf RPG, etc.
fn is_pipe_separated(text: &str) -> bool {
    text.contains('|')
}

/// Skip identifiants d'événements : `EV0`, `EV123`, `EV002物乞いＢ`
/// Ces chaînes commencent par "EV" suivi immédiatement d'un chiffre.
fn is_event_identifier(text: &str) -> bool {
    if text.len() >= 3 && text.starts_with("EV") {
        text.chars().nth(2).map_or(false, |c| c.is_ascii_digit())
    } else {
        false
    }
}

/// Skip quotes japonaises vides : `「」`, `「 」`, `「`, `」`
/// Ces tokens apparaissent parfois seuls dans les fichiers de jeu.
fn is_empty_japanese_quotes(text: &str) -> bool {
    let t = text.trim();
    t.chars().all(|c| c == '「' || c == '」' || c == ' ')
        && t.chars().any(|c| c == '「' || c == '」')
        && !t.chars().any(|c| {
            matches!(c,
                '\u{3040}'..='\u{309F}'  // Hiragana
                | '\u{30A0}'..='\u{30FF}' // Katakana
                | '\u{4E00}'..='\u{9FFF}' // Kanji
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_skip_empty() {
        assert!(should_skip(""));
        assert!(should_skip("   "));
    }

    #[test]
    fn test_skip_non_japanese() {
        assert!(should_skip("Hello world"));
        assert!(should_skip("123"));
    }

    #[test]
    fn test_keep_japanese() {
        assert!(!should_skip("おはよう"));
        assert!(!should_skip("戦士"));
    }

    #[test]
    fn test_keep_mixed_jp_en() {
        assert!(!should_skip("Hello、世界"));
    }

    #[test]
    fn test_skip_file_path() {
        assert!(should_skip("/home/user/game.exe"));
        assert!(should_skip("http://example.com"));
    }

    #[test]
    fn test_skip_script_formula() {
        assert!(should_skip("$gameActors.actor(1).name()"));
        assert!(should_skip("this.value()"));
    }

    #[test]
    fn test_skip_pure_number() {
        assert!(should_skip("42"));
        assert!(!should_skip("42人の侍"));
    }

    #[test]
    fn test_skip_pipe_separated() {
        // Coordonnées UI Wolf RPG — contient du japonais mais doit être skippé
        assert!(should_skip("はい|262|380"));
        assert!(should_skip("戻る|492|380"));
        assert!(should_skip("日本語|999|888"));
    }

    #[test]
    fn test_skip_event_identifier() {
        // Identifiants techniques — EV + chiffre, même avec du japonais après
        assert!(should_skip("EV0"));
        assert!(should_skip("EV123"));
        assert!(should_skip("EV002物乞いＢ"));
        assert!(should_skip("EV123見張り"));
        // EVENT (pas EV + chiffre) ne doit PAS être skippé
        assert!(!should_skip("EVENTの開始"));
    }

    #[test]
    fn test_skip_empty_japanese_quotes() {
        assert!(should_skip("「」"));
        assert!(should_skip("「 」"));
        assert!(should_skip("「"));
        assert!(should_skip("」"));
        // Avec contenu japonais → ne pas skipper
        assert!(!should_skip("「勇者」"));
        assert!(!should_skip("「こんにちは」"));
    }
}
