/// Encode RPG Maker control codes to {{NAME}} placeholders before sending to Ollama.
/// Uppercase and lowercase variants encode to different placeholders to preserve case on decode.
pub fn encode(text: &str) -> String {
    let mut s = text.to_string();

    // Parametric codes — uppercase first to avoid partial matches with lowercase patterns
    let re = regex::Regex::new(r"\\N\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{ACTOR_NAME[$1]}}").into_owned();

    let re = regex::Regex::new(r"\\n\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{actor_name[$1]}}").into_owned();

    let re = regex::Regex::new(r"\\C\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{COLOR[$1]}}").into_owned();

    let re = regex::Regex::new(r"\\c\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{color[$1]}}").into_owned();

    let re = regex::Regex::new(r"\\I\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{ICON[$1]}}").into_owned();

    let re = regex::Regex::new(r"\\i\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{icon[$1]}}").into_owned();

    let re = regex::Regex::new(r"\\V\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{VAR[$1]}}").into_owned();

    let re = regex::Regex::new(r"\\v\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{var[$1]}}").into_owned();

    let re = regex::Regex::new(r"\\P\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{PARTY[$1]}}").into_owned();

    let re = regex::Regex::new(r"\\p\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{party[$1]}}").into_owned();

    // Font size codes — must encode \{ and \} before wait codes to avoid collision
    s = s.replace(r"\{", "{{FONT_UP}}");
    s = s.replace(r"\}", "{{FONT_DOWN}}");

    // Wait / display control codes
    s = s.replace(r"\.", "{{WAIT_S}}");
    s = s.replace(r"\|", "{{WAIT_L}}");
    s = s.replace(r"\!", "{{WAIT_INPUT}}");
    s = s.replace(r"\^", "{{NO_WAIT}}");
    s = s.replace(r"\>", "{{FAST_START}}");
    s = s.replace(r"\<", "{{FAST_END}}");

    s
}

/// Decode {{NAME}} placeholders back to RPG Maker control codes.
/// Returns (decoded_text, all_placeholders_intact).
pub fn decode(text: &str) -> (String, bool) {
    let mut s = text.to_string();

    let re = regex::Regex::new(r"\{\{ACTOR_NAME\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\N[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{actor_name\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\n[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{COLOR\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\C[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{color\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\c[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{ICON\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\I[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{icon\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\i[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{VAR\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\V[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{var\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\v[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{PARTY\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\P[$1]").into_owned();

    let re = regex::Regex::new(r"\{\{party\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\p[$1]").into_owned();

    s = s.replace("{{FONT_UP}}", r"\{");
    s = s.replace("{{FONT_DOWN}}", r"\}");
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
    fn test_encode_uppercase_actor_name() {
        assert_eq!(encode(r"\N[1]"), "{{ACTOR_NAME[1]}}");
    }

    #[test]
    fn test_encode_lowercase_actor_name() {
        assert_eq!(encode(r"\n[4]"), "{{actor_name[4]}}");
    }

    #[test]
    fn test_encode_uppercase_and_lowercase_are_distinct() {
        assert_ne!(encode(r"\N[1]"), encode(r"\n[1]"));
    }

    #[test]
    fn test_encode_variable_uppercase() {
        assert_eq!(encode(r"\V[10]"), "{{VAR[10]}}");
    }

    #[test]
    fn test_encode_variable_lowercase() {
        assert_eq!(encode(r"\v[127]"), "{{var[127]}}");
    }

    #[test]
    fn test_encode_font_size() {
        assert_eq!(encode(r"\{大きい\}"), "{{FONT_UP}}大きい{{FONT_DOWN}}");
        // Double font up: \{\{ → {{FONT_UP}}{{FONT_UP}}
        assert_eq!(encode(r"\{\{text"), "{{FONT_UP}}{{FONT_UP}}text");
    }

    #[test]
    fn test_encode_wait_codes() {
        assert_eq!(encode(r"text\.more"), r"text{{WAIT_S}}more");
        assert_eq!(encode(r"\|"), "{{WAIT_L}}");
        assert_eq!(encode(r"\>速い\<"), "{{FAST_START}}速い{{FAST_END}}");
    }

    #[test]
    fn test_decode_preserves_case_uppercase() {
        let (decoded, intact) = decode("{{ACTOR_NAME[1]}}");
        assert_eq!(decoded, r"\N[1]");
        assert!(intact);
    }

    #[test]
    fn test_decode_preserves_case_lowercase() {
        let (decoded, intact) = decode("{{actor_name[1]}}");
        assert_eq!(decoded, r"\n[1]");
        assert!(intact);
    }

    #[test]
    fn test_decode_font_size() {
        let (decoded, intact) = decode("{{FONT_UP}}{{FONT_UP}}text");
        assert_eq!(decoded, r"\{\{text");
        assert!(intact);
    }

    #[test]
    fn test_decode_wait_codes() {
        let (decoded, intact) = decode(r"text{{WAIT_S}}more{{WAIT_L}}");
        assert_eq!(decoded, r"text\.more\|");
        assert!(intact);
    }

    #[test]
    fn test_roundtrip_lowercase() {
        let original = r"こんにちは\n[1]、\v[2]ゴールド！";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_uppercase() {
        let original = r"こんにちは \N[1]、\C[2]アイテム\C[0]を取った！";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_font_and_wait() {
        let original = r"\{大きい文字\}\.待って";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }
}
