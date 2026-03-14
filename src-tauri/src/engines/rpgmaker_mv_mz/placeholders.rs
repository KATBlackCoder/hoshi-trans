/// Encode RPG Maker control codes to {{NAME}} placeholders before sending to Ollama.
/// All letter-based codes are matched case-insensitively (\N == \n, \V == \v, etc.)
pub fn encode(text: &str) -> String {
    let mut s = text.to_string();

    // Actor name \N[n] or \n[n]
    let re = regex::Regex::new(r"(?i)\\N\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{ACTOR_NAME[$1]}}").into_owned();

    // Color \C[n] or \c[n]
    let re = regex::Regex::new(r"(?i)\\C\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{COLOR[$1]}}").into_owned();

    // Icon \I[n] or \i[n]
    let re = regex::Regex::new(r"(?i)\\I\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{ICON[$1]}}").into_owned();

    // Variable \V[n] or \v[n]
    let re = regex::Regex::new(r"(?i)\\V\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{VAR[$1]}}").into_owned();

    // Party member \P[n] or \p[n]
    let re = regex::Regex::new(r"(?i)\\P\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{PARTY[$1]}}").into_owned();

    // Wait / display control codes (no parameters)
    s = s.replace(r"\.", "{{WAIT_S}}");
    s = s.replace(r"\|", "{{WAIT_L}}");
    s = s.replace(r"\!", "{{WAIT_INPUT}}");
    s = s.replace(r"\^", "{{NO_WAIT}}");
    s = s.replace(r"\>", "{{FAST_START}}");
    s = s.replace(r"\<", "{{FAST_END}}");

    s
}

/// Decode {{NAME}} placeholders back to RPG Maker control codes after Ollama translation.
/// Returns (decoded_text, all_placeholders_intact).
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

    s = s.replace("{{WAIT_S}}", r"\.");
    s = s.replace("{{WAIT_L}}", r"\|");
    s = s.replace("{{WAIT_INPUT}}", r"\!");
    s = s.replace("{{NO_WAIT}}", r"\^");
    s = s.replace("{{FAST_START}}", r"\>");
    s = s.replace("{{FAST_END}}", r"\<");

    let intact = !regex::Regex::new(r"\{\{[^}]+\}\}").unwrap().is_match(&s);
    (s, intact)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_actor_name_uppercase() {
        assert_eq!(encode(r"\N[1]"), "{{ACTOR_NAME[1]}}");
    }

    #[test]
    fn test_encode_actor_name_lowercase() {
        assert_eq!(encode(r"\n[4]"), "{{ACTOR_NAME[4]}}");
    }

    #[test]
    fn test_encode_variable_lowercase() {
        assert_eq!(encode(r"\v[127]"), "{{VAR[127]}}");
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
    fn test_encode_wait_codes() {
        assert_eq!(encode(r"text\.more"), r"text{{WAIT_S}}more");
        assert_eq!(encode(r"\|"), "{{WAIT_L}}");
        assert_eq!(encode(r"\!"), "{{WAIT_INPUT}}");
        assert_eq!(encode(r"\^"), "{{NO_WAIT}}");
        assert_eq!(encode(r"\>速い\<"), "{{FAST_START}}速い{{FAST_END}}");
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
    fn test_decode_wait_codes() {
        let (decoded, intact) = decode(r"text{{WAIT_S}}more{{WAIT_L}}");
        assert_eq!(decoded, r"text\.more\|");
        assert!(intact);
    }

    #[test]
    fn test_roundtrip_lowercase_codes() {
        let original = r"こんにちは\n[1]、\v[2]ゴールド持ってる！";
        let encoded = encode(original);
        assert!(encoded.contains("{{ACTOR_NAME[1]}}"));
        assert!(encoded.contains("{{VAR[2]}}"));
        let (decoded, intact) = decode(&encoded);
        assert!(intact);
        // Decoded uses uppercase \N and \V (canonical form)
        assert!(decoded.contains(r"\N[1]"));
        assert!(decoded.contains(r"\V[2]"));
    }

    #[test]
    fn test_roundtrip_uppercase() {
        let original = r"こんにちは \N[1]、\C[2]アイテム\C[0]を取った！";
        let encoded = encode(original);
        let (decoded, intact) = decode(&encoded);
        assert!(intact);
        assert_eq!(decoded, original);
    }
}
