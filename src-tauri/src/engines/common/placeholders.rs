/// Detects presence of Japanese characters (Hiragana, Katakana, CJK Kanji)
pub fn contains_japanese(text: &str) -> bool {
    text.chars().any(|c| matches!(c,
        '\u{3040}'..='\u{309F}'
        | '\u{30A0}'..='\u{30FF}'
        | '\u{4E00}'..='\u{9FFF}'
    ))
}

/// Verifies all {{...}} placeholders from `original` are still present in `translated`
pub fn check_placeholders_intact(original: &str, translated: &str) -> bool {
    let re = regex::Regex::new(r"\{\{[^}]+\}\}").unwrap();
    let result = re.find_iter(original)
        .all(|m| translated.contains(m.as_str()));
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_contains_japanese_hiragana() {
        assert!(contains_japanese("おはよう"));
    }

    #[test]
    fn test_contains_japanese_katakana() {
        assert!(contains_japanese("アイウ"));
    }

    #[test]
    fn test_contains_japanese_kanji() {
        assert!(contains_japanese("漢字"));
    }

    #[test]
    fn test_not_japanese() {
        assert!(!contains_japanese("Hello"));
    }

    #[test]
    fn test_check_placeholders_intact_all_present() {
        assert!(check_placeholders_intact(
            "Hello {{ACTOR_NAME[1]}}",
            "Bonjour {{ACTOR_NAME[1]}}"
        ));
    }

    #[test]
    fn test_check_placeholders_missing() {
        assert!(!check_placeholders_intact(
            "Hello {{ACTOR_NAME[1]}}",
            "Bonjour"
        ));
    }

    #[test]
    fn test_check_placeholders_no_placeholders() {
        assert!(check_placeholders_intact("Hello", "Bonjour"));
    }
}
