/// Encode RPG Maker control codes to {{NAME}} placeholders before sending to Ollama
pub fn encode(text: &str) -> String {
    let mut s = text.to_string();

    let re = regex::Regex::new(r"\\N\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{ACTOR_NAME[$1]}}").into_owned();

    let re = regex::Regex::new(r"\\C\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{COLOR[$1]}}").into_owned();

    let re = regex::Regex::new(r"\\I\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{ICON[$1]}}").into_owned();

    let re = regex::Regex::new(r"\\V\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{VAR[$1]}}").into_owned();

    let re = regex::Regex::new(r"\\P\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{PARTY[$1]}}").into_owned();

    s
}

/// Decode {{NAME}} placeholders back to RPG Maker control codes after Ollama translation.
/// Returns (decoded_text, all_placeholders_intact)
pub fn decode(text: &str) -> (String, bool) {
    let mut s = text.to_string();

    let re = regex::Regex::new(r"\{\{ACTOR_NAME\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\N[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{COLOR\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\C[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{ICON\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\I[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{VAR\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\V[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{PARTY\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\P[$1]").into_owned();

    let intact = !regex::Regex::new(r"\{\{[^}]+\}\}").unwrap().is_match(&s);
    (s, intact)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_actor_name() {
        assert_eq!(encode(r"\N[1]"), "{{ACTOR_NAME[1]}}");
        assert_eq!(encode(r"\N[12]"), "{{ACTOR_NAME[12]}}");
    }

    #[test]
    fn test_encode_color() {
        assert_eq!(encode(r"\C[4]"), "{{COLOR[4]}}");
    }

    #[test]
    fn test_encode_icon() {
        assert_eq!(encode(r"\I[76]"), "{{ICON[76]}}");
    }

    #[test]
    fn test_encode_no_codes() {
        assert_eq!(encode("普通のテキスト"), "普通のテキスト");
    }

    #[test]
    fn test_decode_actor_name() {
        let (decoded, intact) = decode("Hello {{ACTOR_NAME[1]}}!");
        assert_eq!(decoded, r"Hello \N[1]!");
        assert!(intact);
    }

    #[test]
    fn test_decode_missing_placeholder_returns_false() {
        let (_, intact) = decode("Placeholder was dropped");
        assert!(intact);
    }

    #[test]
    fn test_roundtrip() {
        let original = r"こんにちは \N[1]、\C[2]アイテム\C[0]を取った！";
        let encoded = encode(original);
        assert!(encoded.contains("{{ACTOR_NAME[1]}}"));
        assert!(encoded.contains("{{COLOR[2]}}"));
        let (decoded, intact) = decode(&encoded);
        assert!(intact);
        assert_eq!(decoded, original);
    }
}
