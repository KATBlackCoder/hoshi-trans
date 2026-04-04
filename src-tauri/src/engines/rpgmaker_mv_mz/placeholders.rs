use std::sync::LazyLock;

// Generic parametric: \LETTERS[n] — covers \N, \V, \C, \FS, \item, \PY etc.
// Case is preserved exactly: \N[1] stays \N[1], \n[1] stays \n[1].
static RE_PARAM: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"\\([A-Za-z]+)\[(\d+)\]").unwrap());

// Percent-parameter codes: %1, %2, ...
static RE_PC: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"%(\d+)").unwrap());

fn replace_regex(s: &str, re: &regex::Regex, map: &mut Vec<String>) -> String {
    let mut result = String::with_capacity(s.len());
    let mut last = 0;
    for m in re.find_iter(s) {
        result.push_str(&s[last..m.start()]);
        result.push('❬');
        result.push_str(&map.len().to_string());
        result.push('❭');
        map.push(m.as_str().to_string());
        last = m.end();
    }
    result.push_str(&s[last..]);
    result
}

fn replace_literal(s: &str, needle: &str, map: &mut Vec<String>) -> String {
    if !s.contains(needle) { return s.to_string(); }
    let mut result = String::with_capacity(s.len());
    let mut remaining = s;
    while let Some(pos) = remaining.find(needle) {
        result.push_str(&remaining[..pos]);
        result.push('❬');
        result.push_str(&map.len().to_string());
        result.push('❭');
        map.push(needle.to_string());
        remaining = &remaining[pos + needle.len()..];
    }
    result.push_str(remaining);
    result
}

/// Extract all RPG Maker control codes from `text`, replacing each with `❬n❭`.
/// Returns (simplified_text, map) where map[n] = original native code string.
pub fn extract_native(text: &str) -> (String, Vec<String>) {
    let mut map: Vec<String> = Vec::new();
    let mut s = replace_regex(text, &RE_PARAM, &mut map);
    s = replace_regex(&s, &RE_PC, &mut map);

    // No-parameter codes
    s = replace_literal(&s, r"\{", &mut map);
    s = replace_literal(&s, r"\}", &mut map);
    s = replace_literal(&s, r"\.", &mut map);
    s = replace_literal(&s, r"\|", &mut map);
    s = replace_literal(&s, r"\!", &mut map);
    s = replace_literal(&s, r"\^", &mut map);
    s = replace_literal(&s, r"\>", &mut map);
    s = replace_literal(&s, r"\<", &mut map);

    (s, map)
}

/// Reinject native RPG Maker codes from `map` into model output.
/// Returns (restored_text, intact) where intact = all ❬n❭ markers were present.
pub fn reinject_native(translated: &str, map: &[String]) -> (String, bool) {
    if map.is_empty() {
        return (translated.to_string(), true);
    }
    let mut result = translated.to_string();
    let mut intact = true;
    for (idx, native) in map.iter().enumerate() {
        let marker = format!("❬{}❭", idx);
        if result.contains(&marker) {
            result = result.replace(&marker, native);
        } else {
            intact = false;
        }
    }
    (result, intact)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_plain() {
        let (s, map) = extract_native("おはようございます");
        assert_eq!(s, "おはようございます");
        assert!(map.is_empty());
    }

    #[test]
    fn test_extract_actor_name() {
        let (s, map) = extract_native(r"\N[1]は剣を手に入れた！");
        assert_eq!(s, "❬0❭は剣を手に入れた！");
        assert_eq!(map, vec![r"\N[1]"]);
    }

    #[test]
    fn test_extract_case_distinct() {
        let (s, map) = extract_native(r"\N[1]と\n[2]");
        assert_eq!(s, "❬0❭と❬1❭");
        assert_eq!(map, vec![r"\N[1]", r"\n[2]"]);
    }

    #[test]
    fn test_extract_multichar() {
        let (s, map) = extract_native(r"\FS[24]大きい\FS[0]");
        assert_eq!(s, "❬0❭大きい❬1❭");
        assert_eq!(map, vec![r"\FS[24]", r"\FS[0]"]);
    }

    #[test]
    fn test_extract_percent_param() {
        let (s, map) = extract_native("%1が倒れた！");
        assert_eq!(s, "❬0❭が倒れた！");
        assert_eq!(map, vec!["%1"]);
    }

    #[test]
    fn test_extract_no_param_wait() {
        let (s, map) = extract_native(r"text\.more");
        assert_eq!(s, "text❬0❭more");
        assert_eq!(map, vec![r"\."]);
    }

    #[test]
    fn test_extract_font_braces() {
        let (s, map) = extract_native(r"\{大きい\}");
        assert_eq!(s, "❬0❭大きい❬1❭");
        assert_eq!(map, vec![r"\{", r"\}"]);
    }

    #[test]
    fn test_reinject_all_present() {
        let map = vec![r"\N[1]".to_string()];
        let (result, intact) = reinject_native("❬0❭ obtained a sword!", &map);
        assert_eq!(result, r"\N[1] obtained a sword!");
        assert!(intact);
    }

    #[test]
    fn test_reinject_missing() {
        let map = vec![r"\N[1]".to_string(), r"\V[2]".to_string()];
        let (result, intact) = reinject_native("❬0❭ got it", &map);
        assert!(!intact); // ❬1❭ dropped
        assert_eq!(result, r"\N[1] got it");
    }

    #[test]
    fn test_roundtrip_single() {
        let original = r"\N[1]は\FS[20]\item[5]\FS[0]を持っている。";
        let (s, map) = extract_native(original);
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }

    #[test]
    fn test_roundtrip_font_wait() {
        let original = r"\{大きい文字\}\.待って";
        let (s, map) = extract_native(original);
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }

    #[test]
    fn test_roundtrip_percent() {
        let original = "%1は%2ゴールドを手に入れた！";
        let (s, map) = extract_native(original);
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }
}
