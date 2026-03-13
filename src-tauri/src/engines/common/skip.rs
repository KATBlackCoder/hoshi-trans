pub fn should_skip(text: &str) -> bool {
    is_empty_or_whitespace(text)
        || !contains_japanese(text)
        || is_file_path(text)
        || is_script_formula(text)
        || is_pure_number(text)
}

fn is_empty_or_whitespace(text: &str) -> bool {
    text.trim().is_empty()
}

pub fn contains_japanese(text: &str) -> bool {
    text.chars().any(|c| matches!(c,
        '\u{3040}'..='\u{309F}'  // Hiragana
        | '\u{30A0}'..='\u{30FF}' // Katakana
        | '\u{4E00}'..='\u{9FFF}' // CJK Kanji
    ))
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
}
