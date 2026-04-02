use std::sync::LazyLock;
use regex::Regex;

// ── REGEXES ───────────────────────────────────────────────────────────────────
// Order is critical: compound patterns (nested codes) must be extracted BEFORE
// their component codes to avoid partial matches.

// Compound patterns (extract first)
static RE_FONT_CSELF: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\f\[\\cself\[(\d+)\]\]").unwrap());
static RE_AX_CSELF:   LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\ax\[\\cself\[(\d+)\]\]").unwrap());
static RE_AY_CSELF:   LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\ay\[\\cself\[(\d+)\]\]").unwrap());
static RE_M_CSELF:    LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\m\[\\cself\[(\d+)\]\]").unwrap());
static RE_UDB_D:      LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\udb\[(\d+):\\d\[(\d+)\]\]").unwrap());

// Long-prefix parametric
static RE_CSELF:      LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\cself\[(\d+)\]").unwrap());
static RE_SELF:       LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\self\[(\d+)\]").unwrap());
static RE_CDB:        LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\cdb\[(\d+:\d+:\d+)\]").unwrap());
static RE_SYS:        LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\sys\[(\d+)\]").unwrap());
static RE_FONT_FULL:  LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\font\[(\d+)\]").unwrap());
static RE_SPACE:      LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\space\[(\d+)\]").unwrap());
static RE_UDB:        LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\udb\[(\d+:\d+)\]").unwrap());
static RE_MY:         LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\my\[(-?\d+)\]").unwrap());
static RE_M:          LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\m\[(-?\d+)\]").unwrap());

// Ruby: \r[base,reading] — must be extracted before the no-param \r literal
static RE_RUBY:       LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\r\[[^\]]*\]").unwrap());

// Short-prefix parametric (\C before \c to avoid partial match)
static RE_COLOR_U:    LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\C\[(\d+)\]").unwrap());
static RE_COLOR_L:    LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\c\[(\d+)\]").unwrap());
static RE_FONT:       LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\f\[(\d+)\]").unwrap());
static RE_AX:         LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\ax\[(\d+)\]").unwrap());
static RE_AY:         LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\ay\[(\d+)\]").unwrap());
static RE_V:          LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\v\[(\d+)\]").unwrap());
static RE_ICON:       LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\i\[(\d+)\]").unwrap());
static RE_SLOT:       LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\s\[(\d+)\]").unwrap());
static RE_INDENT:     LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\-\[(\d+)\]").unwrap());
static RE_AT:         LazyLock<Regex> = LazyLock::new(|| Regex::new(r"@(\d+)").unwrap());
static RE_PC:         LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[%％](\d+)").unwrap());

// ── HELPERS ───────────────────────────────────────────────────────────────────

fn replace_regex(s: &str, re: &Regex, map: &mut Vec<String>) -> String {
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

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/// Extract all Wolf RPG native codes from `text`, replacing each occurrence with `❬n❭`.
/// Returns (simplified_text, map) where map[n] = original native code string.
/// Extraction order matches old encode() to avoid partial matches.
pub fn extract_native(text: &str) -> (String, Vec<String>) {
    let mut s = text.to_string();
    let mut map: Vec<String> = Vec::new();

    // 1. Compound patterns — extract before their components
    s = replace_regex(&s, &RE_FONT_CSELF, &mut map);
    s = replace_regex(&s, &RE_AX_CSELF,   &mut map);
    s = replace_regex(&s, &RE_AY_CSELF,   &mut map);
    s = replace_regex(&s, &RE_M_CSELF,    &mut map);
    s = replace_regex(&s, &RE_UDB_D,      &mut map);

    // 2. Long-prefix parametric
    s = replace_regex(&s, &RE_CSELF,     &mut map);
    s = replace_regex(&s, &RE_SELF,      &mut map);
    s = replace_regex(&s, &RE_CDB,       &mut map);
    s = replace_regex(&s, &RE_SYS,       &mut map);
    s = replace_regex(&s, &RE_FONT_FULL, &mut map);
    s = replace_regex(&s, &RE_SPACE,     &mut map);
    s = replace_regex(&s, &RE_UDB,       &mut map);
    s = replace_regex(&s, &RE_MY,        &mut map);
    s = replace_regex(&s, &RE_M,         &mut map);

    // 3. Short-prefix parametric (\C before \c to avoid partial match)
    s = replace_regex(&s, &RE_RUBY,    &mut map); // \r[base,reading] before no-param \r
    s = replace_regex(&s, &RE_COLOR_U, &mut map);
    s = replace_regex(&s, &RE_COLOR_L, &mut map);
    s = replace_regex(&s, &RE_FONT,    &mut map);
    s = replace_regex(&s, &RE_AX,      &mut map);
    s = replace_regex(&s, &RE_AY,      &mut map);
    s = replace_regex(&s, &RE_V,       &mut map);
    s = replace_regex(&s, &RE_ICON,    &mut map);
    s = replace_regex(&s, &RE_SLOT,    &mut map);
    s = replace_regex(&s, &RE_INDENT,  &mut map);
    s = replace_regex(&s, &RE_AT,      &mut map);
    s = replace_regex(&s, &RE_PC,      &mut map);

    // 4. No-parameter codes — plain literal replace
    s = replace_literal(&s, r"\E",  &mut map);
    s = replace_literal(&s, r"\A-", &mut map);
    s = replace_literal(&s, r"\r",  &mut map);  // ruby start (escape sequence, not char)
    s = replace_literal(&s, "\r",   &mut map);  // actual CR character
    s = replace_literal(&s, "\n",   &mut map);  // actual newline character
    s = replace_literal(&s, "<C>",  &mut map);
    s = replace_literal(&s, r"\>",  &mut map);
    s = replace_literal(&s, "<R>",  &mut map);
    s = replace_literal(&s, "<<",   &mut map);
    s = replace_literal(&s, ">>",   &mut map);

    (s, map)
}

/// Reinject native Wolf RPG codes from `map` into model output.
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

// ── TESTS ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── extract_native tests ──────────────────────────────────────────────────

    #[test]
    fn test_extract_plain_text() {
        let (s, map) = extract_native("ゲームオーバー");
        assert_eq!(s, "ゲームオーバー");
        assert!(map.is_empty());
    }

    #[test]
    fn test_extract_newline() {
        let (s, map) = extract_native("hello\nworld");
        assert_eq!(s, "hello❬0❭world");
        assert_eq!(map, vec!["\n"]);
    }

    #[test]
    fn test_extract_cself() {
        let (s, map) = extract_native(r"\cself[1]は剣を手に入れた！");
        assert_eq!(s, "❬0❭は剣を手に入れた！");
        assert_eq!(map, vec![r"\cself[1]"]);
    }

    #[test]
    fn test_extract_color() {
        let (s, map) = extract_native(r"\c[2]注意\c[0]：回復量が増加する。");
        assert_eq!(s, "❬0❭注意❬1❭：回復量が増加する。");
        assert_eq!(map, vec![r"\c[2]", r"\c[0]"]);
    }

    #[test]
    fn test_extract_color_case_distinct() {
        // \C is processed before \c (short-prefix order), so \C[3] gets idx 0, \c[2] gets idx 1
        let (s, map) = extract_native(r"\c[2]text\C[3]");
        assert_eq!(s, "❬1❭text❬0❭");
        assert_eq!(map, vec![r"\C[3]", r"\c[2]"]);
    }

    #[test]
    fn test_extract_ruby_whole_unit() {
        // \r[base,reading] is extracted as a whole — bracket content not visible to model
        let (s, map) = extract_native(r"\r[甘,あま]\r[酸,ず]っぱい");
        assert_eq!(s, "❬0❭❬1❭っぱい");
        assert_eq!(map, vec![r"\r[甘,あま]", r"\r[酸,ず]"]);
    }

    #[test]
    fn test_extract_multiple_nl() {
        let (s, map) = extract_native("A\nB\nC\n");
        assert_eq!(s, "A❬0❭B❬1❭C❬2❭");
        assert_eq!(map, vec!["\n", "\n", "\n"]);
    }

    #[test]
    fn test_extract_compound_font_cself() {
        let (s, map) = extract_native(r"\f[\cself[19]]購入");
        assert_eq!(s, "❬0❭購入");
        assert_eq!(map, vec![r"\f[\cself[19]]"]);
    }

    #[test]
    fn test_extract_udb() {
        let (s, map) = extract_native(r"所持金：\udb[8:0]Ｇ");
        assert_eq!(s, "所持金：❬0❭Ｇ");
        assert_eq!(map, vec![r"\udb[8:0]"]);
    }

    #[test]
    fn test_extract_at() {
        // RE_AT processes all @n in one pass, then \n literal — so @1→0, @2→1, \n→2
        let (s, map) = extract_native("@1\n\"@2\"");
        assert_eq!(s, "❬0❭❬2❭\"❬1❭\"");
        assert_eq!(map, vec!["@1", "@2", "\n"]);
    }

    #[test]
    fn test_extract_wolf_end() {
        let (s, map) = extract_native(r"\EHPが200回復した");
        assert_eq!(s, "❬0❭HPが200回復した");
        assert_eq!(map, vec![r"\E"]);
    }

    // ── reinject_native tests ─────────────────────────────────────────────────

    #[test]
    fn test_reinject_all_present() {
        let map = vec![r"\c[2]".to_string(), r"\c[0]".to_string()];
        let (result, intact) = reinject_native("❬0❭Warning❬1❭: ok", &map);
        assert_eq!(result, r"\c[2]Warning\c[0]: ok");
        assert!(intact);
    }

    #[test]
    fn test_reinject_marker_dropped() {
        let map = vec!["\n".to_string(), "\n".to_string()];
        let (result, intact) = reinject_native("Hello❬0❭World", &map);
        assert_eq!(result, "Hello\nWorld");
        assert!(!intact); // ❬1❭ was dropped
    }

    #[test]
    fn test_reinject_empty_map() {
        let map: Vec<String> = vec![];
        let (result, intact) = reinject_native("Hello world", &map);
        assert_eq!(result, "Hello world");
        assert!(intact);
    }

    // ── roundtrip tests ───────────────────────────────────────────────────────

    #[test]
    fn test_roundtrip_cself() {
        let original = r"\cself[1]は剣を手に入れた！";
        let (s, map) = extract_native(original);
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }

    #[test]
    fn test_roundtrip_color_case() {
        let original = r"\E\c[2]ほのか\C[3]いぶき";
        let (s, map) = extract_native(original);
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }

    #[test]
    fn test_roundtrip_compound_font_cself() {
        let original = r"\f[\cself[19]]購入";
        let (s, map) = extract_native(original);
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }

    #[test]
    fn test_roundtrip_complex() {
        let original = r"\>\f[5]レベル\cself[30]  / \cdb[21:78:0] \cdb[21:80:0]";
        let (s, map) = extract_native(original);
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }

    #[test]
    fn test_roundtrip_udb_d() {
        let original = r"\udb[7:\d[0]]";
        let (s, map) = extract_native(original);
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }

    #[test]
    fn test_roundtrip_ruby() {
        // \r[甘,あま] — extracted as whole unit, brackets not visible to model
        let original = "\\r[甘,あま]\\r[酸,ず]っぱい思い出を\nはんすうしている！";
        let (s, map) = extract_native(original);
        assert!(!s.contains("[甘,あま]"), "bracket content must not be visible to model");
        assert_eq!(s, "❬0❭❬1❭っぱい思い出を❬2❭はんすうしている！");
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }

    #[test]
    fn test_roundtrip_newlines_multiple() {
        let original = "A\nB\nC\n";
        let (s, map) = extract_native(original);
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }

    #[test]
    fn test_roundtrip_self_vs_cself() {
        let original = r"\cself[1]\self[0]";
        let (s, map) = extract_native(original);
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }

    #[test]
    fn test_roundtrip_my_signed() {
        let original = r"\my[-2]テキスト\my[2]";
        let (s, map) = extract_native(original);
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }

    #[test]
    fn test_roundtrip_indent_space_center() {
        let original = r"\-[1]<C>\E\space[0]\f[\cself[17]]\cself[7]";
        let (s, map) = extract_native(original);
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }

    #[test]
    fn test_roundtrip_cr_char() {
        let original = "line1\rline2";
        let (s, map) = extract_native(original);
        let (result, intact) = reinject_native(&s, &map);
        assert!(intact);
        assert_eq!(result, original);
    }
}
