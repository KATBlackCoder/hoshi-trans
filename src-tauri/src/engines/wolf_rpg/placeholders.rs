use std::sync::LazyLock;
use regex::Regex;

static RE_SELF_VAR: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\self\[(\d+)\]").unwrap());

static RE_PH_SELF_VAR: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{SELF_VAR\[(\d+)\]\}\}").unwrap());

static RE_ANY_PH: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{[^}]+\}\}").unwrap());

pub fn encode(text: &str) -> String {
    RE_SELF_VAR
        .replace_all(text, "{{SELF_VAR[$1]}}")
        .into_owned()
}

pub fn decode(text: &str) -> (String, bool) {
    let s = RE_PH_SELF_VAR
        .replace_all(text, r"\self[$1]")
        .into_owned();
    let intact = !RE_ANY_PH.is_match(&s);
    (s, intact)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_self_var() {
        assert_eq!(encode(r"\self[1]"), "{{SELF_VAR[1]}}");
    }

    #[test]
    fn test_decode_self_var() {
        let (decoded, intact) = decode("{{SELF_VAR[1]}}");
        assert_eq!(decoded, r"\self[1]");
        assert!(intact);
    }

    #[test]
    fn test_roundtrip_no_codes() {
        let text = "ゲームオーバー";
        let encoded = encode(text);
        assert_eq!(encoded, text);
        let (decoded, intact) = decode(&encoded);
        assert_eq!(decoded, text);
        assert!(intact);
    }

    #[test]
    fn test_decode_intact_false_when_unknown_ph_remains() {
        let (_, intact) = decode("{{UNKNOWN_CODE}}");
        assert!(!intact);
    }
}
