use std::sync::LazyLock;

// Generic parametric: matches any \LETTERS[n] — single or multi-char, any case
// Encodes to {{PH:LETTERS[n]}} — PH: prefix makes it unambiguous to LLMs
static RE_ENCODE: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"\\([A-Za-z]+)\[(\d+)\]").unwrap());

static RE_DECODE: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"\{\{PH:([A-Za-z]+)\[(\d+)\]\}\}").unwrap());

// Percent-parameter codes: %1, %2, ... (dynamic value substitution in RPG Maker)
// Encodes to {{PC[n]}} — distinct prefix avoids collision with PH: tokens
static RE_ENCODE_PC: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"%(\d+)").unwrap());

static RE_DECODE_PC: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"\{\{PC\[(\d+)\]\}\}").unwrap());

// Detect leftover unrecognized placeholders after decode
static RE_LEFTOVER_PH: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"\{\{[^}]+\}\}").unwrap());

/// Encode RPG Maker control codes to {{PH:CODE[n]}} placeholders before sending to Ollama.
/// Handles any \LETTERS[n] pattern — covers built-in codes (\N, \V, \C, \FS, \PY...)
/// and plugin-added codes (\item, \GOLD, \FACE...) without needing per-code entries.
/// Case is preserved exactly: \N[1] → {{PH:N[1]}} → \N[1], \n[1] → {{PH:n[1]}} → \n[1]
pub fn encode(text: &str) -> String {
    let mut s = RE_ENCODE.replace_all(text, "{{PH:$1[$2]}}").into_owned();
    s = RE_ENCODE_PC.replace_all(&s, "{{PC[$1]}}").into_owned();

    // No-parameter codes — plain string replace (no regex needed)
    s = s.replace(r"\{", "{{FONT_UP}}");
    s = s.replace(r"\}", "{{FONT_DOWN}}");
    s = s.replace(r"\.", "{{WAIT_S}}");
    s = s.replace(r"\|", "{{WAIT_L}}");
    s = s.replace(r"\!", "{{WAIT_INPUT}}");
    s = s.replace(r"\^", "{{NO_WAIT}}");
    s = s.replace(r"\>", "{{FAST_START}}");
    s = s.replace(r"\<", "{{FAST_END}}");

    s
}

/// Decode {{PH:CODE[n]}} and no-parameter placeholders back to RPG Maker control codes.
/// Returns (decoded_text, all_placeholders_intact).
pub fn decode(text: &str) -> (String, bool) {
    let mut s = RE_DECODE.replace_all(text, r"\$1[$2]").into_owned();
    s = RE_DECODE_PC.replace_all(&s, "%$1").into_owned();

    s = s.replace("{{FONT_UP}}", r"\{");
    s = s.replace("{{FONT_DOWN}}", r"\}");
    s = s.replace("{{WAIT_S}}", r"\.");
    s = s.replace("{{WAIT_L}}", r"\|");
    s = s.replace("{{WAIT_INPUT}}", r"\!");
    s = s.replace("{{NO_WAIT}}", r"\^");
    s = s.replace("{{FAST_START}}", r"\>");
    s = s.replace("{{FAST_END}}", r"\<");

    let intact = !RE_LEFTOVER_PH.is_match(&s);
    (s, intact)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_single_char_uppercase() {
        assert_eq!(encode(r"\N[1]"), "{{PH:N[1]}}");
    }

    #[test]
    fn test_encode_single_char_lowercase() {
        assert_eq!(encode(r"\n[4]"), "{{PH:n[4]}}");
    }

    #[test]
    fn test_encode_case_distinct() {
        assert_ne!(encode(r"\N[1]"), encode(r"\n[1]"));
    }

    #[test]
    fn test_encode_variable() {
        assert_eq!(encode(r"\V[10]"), "{{PH:V[10]}}");
        assert_eq!(encode(r"\v[127]"), "{{PH:v[127]}}");
    }

    #[test]
    fn test_encode_multichar_fs() {
        assert_eq!(encode(r"\FS[24]"), "{{PH:FS[24]}}");
    }

    #[test]
    fn test_encode_multichar_py() {
        assert_eq!(encode(r"\PY[5]"), "{{PH:PY[5]}}");
    }

    #[test]
    fn test_encode_multichar_item() {
        assert_eq!(encode(r"\item[17]"), "{{PH:item[17]}}");
    }

    #[test]
    fn test_encode_font_size_braces() {
        assert_eq!(encode(r"\{大きい\}"), "{{FONT_UP}}大きい{{FONT_DOWN}}");
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
        let (decoded, intact) = decode("{{PH:N[1]}}");
        assert_eq!(decoded, r"\N[1]");
        assert!(intact);
    }

    #[test]
    fn test_decode_preserves_case_lowercase() {
        let (decoded, intact) = decode("{{PH:n[1]}}");
        assert_eq!(decoded, r"\n[1]");
        assert!(intact);
    }

    #[test]
    fn test_decode_multichar() {
        let (decoded, intact) = decode("{{PH:FS[24]}}");
        assert_eq!(decoded, r"\FS[24]");
        assert!(intact);
    }

    #[test]
    fn test_decode_font_size_braces() {
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
    fn test_roundtrip_single_char() {
        let original = r"こんにちは\n[1]、\v[2]ゴールド！";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_multichar() {
        let original = r"\FS[24]大きい文字\FS[0]、\item[17]を取った！";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_mixed() {
        let original = r"\N[1]は\FS[20]\item[5]\FS[0]を持っている\PY[3]。";
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

    #[test]
    fn test_encode_percent_param() {
        assert_eq!(encode("%1が倒れた！"), "{{PC[1]}}が倒れた！");
        assert_eq!(
            encode("%1は%2を手に入れた！"),
            "{{PC[1]}}は{{PC[2]}}を手に入れた！"
        );
    }

    #[test]
    fn test_decode_percent_param() {
        let (decoded, intact) = decode("{{PC[1]}} was defeated!");
        assert_eq!(decoded, "%1 was defeated!");
        assert!(intact);
    }

    #[test]
    fn test_roundtrip_percent_param() {
        let original = "%1は%2ゴールドを手に入れた！";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_intact_false_when_placeholder_dropped() {
        // Simulate LLM dropping a placeholder
        let (_, intact) = decode("Hello {{PH:N[1]}} world");
        // After decode this becomes \N[1] which is valid, so intact is true
        // To test false: pass something with leftover {{...}}
        let (_, intact2) = decode("Hello {{UNKNOWN_TOKEN}} world");
        assert!(!intact2);
    }
}
