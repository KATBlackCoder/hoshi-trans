use std::sync::LazyLock;

use regex::Regex;

// ── ENCODE REGEXES ────────────────────────────────────────────────────────────
// Order is critical: compound patterns (nested codes) must be encoded BEFORE
// their component codes to avoid double-encoding.

// --- Compound patterns (encode first) ---

// \f[\cself[n]] → {{WOLF_FONT_CS[n]}}   font code with cself expression
static RE_FONT_CSELF: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\f\[\\cself\[(\d+)\]\]").unwrap());

// \ax[\cself[n]] → {{WOLF_AX_CS[n]}}
static RE_AX_CSELF: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\ax\[\\cself\[(\d+)\]\]").unwrap());

// \ay[\cself[n]] → {{WOLF_AY_CS[n]}}
static RE_AY_CSELF: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\ay\[\\cself\[(\d+)\]\]").unwrap());

// \m[\cself[n]] → {{WOLF_M_CS[n]}}   message position with cself expression
static RE_M_CSELF: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\m\[\\cself\[(\d+)\]\]").unwrap());

// \udb[n:\d[m]] → {{WOLF_UDB_D[n:m]}}   user database with variable index (compound)
static RE_UDB_D: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\udb\[(\d+):\\d\[(\d+)\]\]").unwrap());

// --- Simple parametric codes ---

// \cself[n] → {{WOLF_CSELF[n]}}   character self-variable (name, attribute)
static RE_CSELF: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\cself\[(\d+)\]").unwrap());

// \cdb[type:index:field] → {{WOLF_CDB[type:index:field]}}   database lookup
static RE_CDB: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\cdb\[(\d+:\d+:\d+)\]").unwrap());

// \c[n] → {{WOLF_COLOR_L[n]}}   text color (lowercase = base color)
// Note: must be encoded before \C[n] to avoid regex collision
static RE_COLOR_L: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\c\[(\d+)\]").unwrap());

// \C[n] → {{WOLF_COLOR_U[n]}}   text color (uppercase = special color)
static RE_COLOR_U: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\C\[(\d+)\]").unwrap());

// \sys[n] → {{WOLF_SYS[n]}}   system variable
static RE_SYS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\sys\[(\d+)\]").unwrap());

// \font[n] → {{WOLF_FONTFULL[n]}}   font (alternative full-name format)
// Must be encoded before \f[n] to avoid partial match
static RE_FONT_FULL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\font\[(\d+)\]").unwrap());

// \f[n] → {{WOLF_FONT[n]}}   font (simple number format)
static RE_FONT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\f\[(\d+)\]").unwrap());

// \ax[n] → {{WOLF_AX[n]}}   absolute X position (simple number)
static RE_AX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\ax\[(\d+)\]").unwrap());

// \ay[n] → {{WOLF_AY[n]}}   absolute Y position (simple number)
static RE_AY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\ay\[(\d+)\]").unwrap());

// \v[n] → {{WOLF_V[n]}}   variable display
static RE_V: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\v\[(\d+)\]").unwrap());

// \i[n] → {{WOLF_ICON[n]}}   icon display
static RE_ICON: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\i\[(\d+)\]").unwrap());

// \s[n] → {{WOLF_SLOT[n]}}   equipment slot reference
static RE_SLOT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\s\[(\d+)\]").unwrap());

// \-[n] → {{WOLF_INDENT[n]}}   negative indentation
static RE_INDENT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\-\[(\d+)\]").unwrap());

// \space[n] → {{WOLF_SPACE[n]}}   spacing control
static RE_SPACE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\space\[(\d+)\]").unwrap());

// \udb[n:m] → {{WOLF_UDB[n:m]}}   user database reference (2-arg form)
static RE_UDB: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\udb\[(\d+:\d+)\]").unwrap());

// \m[n] → {{WOLF_M[n]}}   message position (n can be negative)
static RE_M: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\m\[(-?\d+)\]").unwrap());

// \my[n] → {{WOLF_MY[n]}}   message y-offset (n can be negative)
static RE_MY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\\my\[(-?\d+)\]").unwrap());

// @n → {{WOLF_AT[n]}}   parameter reference
static RE_AT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"@(\d+)").unwrap());

// %n / ％n → {{WOLF_PC[n]}}   format parameter (dynamic value substitution)
static RE_PC: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[%％](\d+)").unwrap());

// ── DECODE REGEXES ────────────────────────────────────────────────────────────

static RE_D_FONT_CSELF: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_FONT_CS\[(\d+)\]\}\}").unwrap());
static RE_D_AX_CSELF: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_AX_CS\[(\d+)\]\}\}").unwrap());
static RE_D_AY_CSELF: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_AY_CS\[(\d+)\]\}\}").unwrap());
static RE_D_M_CSELF: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_M_CS\[(\d+)\]\}\}").unwrap());
static RE_D_UDB_D: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_UDB_D\[(\d+):(\d+)\]\}\}").unwrap());
static RE_D_CSELF: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_CSELF\[(\d+)\]\}\}").unwrap());
static RE_D_CDB: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_CDB\[(\d+:\d+:\d+)\]\}\}").unwrap());
static RE_D_COLOR_L: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_COLOR_L\[(\d+)\]\}\}").unwrap());
static RE_D_COLOR_U: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_COLOR_U\[(\d+)\]\}\}").unwrap());
static RE_D_SYS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_SYS\[(\d+)\]\}\}").unwrap());
static RE_D_FONT_FULL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_FONTFULL\[(\d+)\]\}\}").unwrap());
static RE_D_FONT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_FONT\[(\d+)\]\}\}").unwrap());
static RE_D_AX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_AX\[(\d+)\]\}\}").unwrap());
static RE_D_AY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_AY\[(\d+)\]\}\}").unwrap());
static RE_D_V: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_V\[(\d+)\]\}\}").unwrap());
static RE_D_ICON: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_ICON\[(\d+)\]\}\}").unwrap());
static RE_D_SLOT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_SLOT\[(\d+)\]\}\}").unwrap());
static RE_D_INDENT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_INDENT\[(\d+)\]\}\}").unwrap());
static RE_D_SPACE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_SPACE\[(\d+)\]\}\}").unwrap());
static RE_D_UDB: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_UDB\[(\d+:\d+)\]\}\}").unwrap());
static RE_D_M: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_M\[(-?\d+)\]\}\}").unwrap());
static RE_D_MY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_MY\[(-?\d+)\]\}\}").unwrap());
static RE_D_AT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_AT\[(\d+)\]\}\}").unwrap());
static RE_D_PC: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_PC\[(\d+)\]\}\}").unwrap());

// Detects any leftover unrecognized {{WOLF_...}} token after decode
static RE_LEFTOVER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{\{WOLF_[^}]+\}\}").unwrap());

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/// Encode Wolf RPG control codes to {{WOLF_...}} placeholders before sending to Ollama.
///
/// Encoding order is strict:
/// 1. Compound patterns (\f[\cself[n]], \ax[\cself[n]], \ay[\cself[n]])
/// 2. Long-prefix codes (\font, \space, \cself, \cdb, \sys) — before short prefixes
/// 3. Short-prefix codes (\c, \C, \f, \i, \s, \v, \-, @, %)
/// 4. No-parameter codes (plain string replace)
pub fn encode(text: &str) -> String {
    let mut s = text.to_string();

    // 1. Compound patterns — encode before components
    s = RE_FONT_CSELF.replace_all(&s, "{{WOLF_FONT_CS[$1]}}").into_owned();
    s = RE_AX_CSELF.replace_all(&s, "{{WOLF_AX_CS[$1]}}").into_owned();
    s = RE_AY_CSELF.replace_all(&s, "{{WOLF_AY_CS[$1]}}").into_owned();
    s = RE_M_CSELF.replace_all(&s, "{{WOLF_M_CS[$1]}}").into_owned();
    s = RE_UDB_D.replace_all(&s, "{{WOLF_UDB_D[$1:$2]}}").into_owned();

    // 2. Long-prefix parametric codes (before short prefixes to avoid partial match)
    s = RE_CSELF.replace_all(&s, "{{WOLF_CSELF[$1]}}").into_owned();
    s = RE_CDB.replace_all(&s, "{{WOLF_CDB[$1]}}").into_owned();
    s = RE_SYS.replace_all(&s, "{{WOLF_SYS[$1]}}").into_owned();
    s = RE_FONT_FULL.replace_all(&s, "{{WOLF_FONTFULL[$1]}}").into_owned();
    s = RE_SPACE.replace_all(&s, "{{WOLF_SPACE[$1]}}").into_owned();
    s = RE_UDB.replace_all(&s, "{{WOLF_UDB[$1]}}").into_owned();
    s = RE_MY.replace_all(&s, "{{WOLF_MY[$1]}}").into_owned();
    s = RE_M.replace_all(&s, "{{WOLF_M[$1]}}").into_owned();

    // 3. Short-prefix parametric codes
    s = RE_COLOR_U.replace_all(&s, "{{WOLF_COLOR_U[$1]}}").into_owned(); // \C before \c
    s = RE_COLOR_L.replace_all(&s, "{{WOLF_COLOR_L[$1]}}").into_owned();
    s = RE_FONT.replace_all(&s, "{{WOLF_FONT[$1]}}").into_owned();
    s = RE_AX.replace_all(&s, "{{WOLF_AX[$1]}}").into_owned();
    s = RE_AY.replace_all(&s, "{{WOLF_AY[$1]}}").into_owned();
    s = RE_V.replace_all(&s, "{{WOLF_V[$1]}}").into_owned();
    s = RE_ICON.replace_all(&s, "{{WOLF_ICON[$1]}}").into_owned();
    s = RE_SLOT.replace_all(&s, "{{WOLF_SLOT[$1]}}").into_owned();
    s = RE_INDENT.replace_all(&s, "{{WOLF_INDENT[$1]}}").into_owned();
    s = RE_AT.replace_all(&s, "{{WOLF_AT[$1]}}").into_owned();
    s = RE_PC.replace_all(&s, "{{WOLF_PC[$1]}}").into_owned();

    // 4. No-parameter codes — plain string replace
    s = s.replace(r"\E", "{{WOLF_END}}");
    s = s.replace(r"\A-", "{{WOLF_AUTO}}");  // auto-fit alignment
    s = s.replace(r"\r", "{{WOLF_RUBY}}");   // ruby start (escape sequence \r, not char)
    s = s.replace('\r', "{{WOLF_CR}}");       // actual carriage return character
    s = s.replace('\n', "{{WOLF_NL}}");       // actual newline character
    s = s.replace("<C>", "{{WOLF_CENTER}}");
    s = s.replace(r"\>", "{{WOLF_RALIGN}}");
    s = s.replace("<R>", "{{WOLF_RTAG}}");
    s = s.replace("<<", "{{WOLF_LBRACKET}}");
    s = s.replace(">>", "{{WOLF_RBRACKET}}");

    s
}

/// Decode {{WOLF_...}} placeholders back to Wolf RPG control codes after translation.
/// Returns (decoded_text, all_placeholders_intact).
/// intact = false if any {{WOLF_...}} token was dropped or hallucinated by the LLM.
pub fn decode(text: &str) -> (String, bool) {
    let mut s = text.to_string();

    // Compound patterns first
    s = RE_D_FONT_CSELF.replace_all(&s, r"\f[\cself[$1]]").into_owned();
    s = RE_D_AX_CSELF.replace_all(&s, r"\ax[\cself[$1]]").into_owned();
    s = RE_D_AY_CSELF.replace_all(&s, r"\ay[\cself[$1]]").into_owned();
    s = RE_D_M_CSELF.replace_all(&s, r"\m[\cself[$1]]").into_owned();
    s = RE_D_UDB_D.replace_all(&s, r"\udb[$1:\d[$2]]").into_owned();

    // Long-prefix parametric codes
    s = RE_D_CSELF.replace_all(&s, r"\cself[$1]").into_owned();
    s = RE_D_CDB.replace_all(&s, r"\cdb[$1]").into_owned();
    s = RE_D_SYS.replace_all(&s, r"\sys[$1]").into_owned();
    s = RE_D_FONT_FULL.replace_all(&s, r"\font[$1]").into_owned();
    s = RE_D_SPACE.replace_all(&s, r"\space[$1]").into_owned();
    s = RE_D_UDB.replace_all(&s, r"\udb[$1]").into_owned();
    s = RE_D_MY.replace_all(&s, r"\my[$1]").into_owned();
    s = RE_D_M.replace_all(&s, r"\m[$1]").into_owned();

    // Short-prefix parametric codes
    s = RE_D_COLOR_U.replace_all(&s, r"\C[$1]").into_owned();
    s = RE_D_COLOR_L.replace_all(&s, r"\c[$1]").into_owned();
    s = RE_D_FONT.replace_all(&s, r"\f[$1]").into_owned();
    s = RE_D_AX.replace_all(&s, r"\ax[$1]").into_owned();
    s = RE_D_AY.replace_all(&s, r"\ay[$1]").into_owned();
    s = RE_D_V.replace_all(&s, r"\v[$1]").into_owned();
    s = RE_D_ICON.replace_all(&s, r"\i[$1]").into_owned();
    s = RE_D_SLOT.replace_all(&s, r"\s[$1]").into_owned();
    s = RE_D_INDENT.replace_all(&s, r"\-[$1]").into_owned();
    s = RE_D_AT.replace_all(&s, "@$1").into_owned();
    s = RE_D_PC.replace_all(&s, "%$1").into_owned();

    // No-parameter codes
    s = s.replace("{{WOLF_END}}", r"\E");
    s = s.replace("{{WOLF_AUTO}}", r"\A-");
    s = s.replace("{{WOLF_RUBY}}", r"\r");
    s = s.replace("{{WOLF_CR}}", "\r");       // actual carriage return character
    s = s.replace("{{WOLF_NL}}", "\n");       // actual newline character
    s = s.replace("{{WOLF_CENTER}}", "<C>");
    s = s.replace("{{WOLF_RALIGN}}", r"\>");
    s = s.replace("{{WOLF_RTAG}}", "<R>");
    s = s.replace("{{WOLF_LBRACKET}}", "<<");
    s = s.replace("{{WOLF_RBRACKET}}", ">>");

    let intact = !RE_LEFTOVER.is_match(&s);
    (s, intact)
}

// ── TESTS ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_cself() {
        assert_eq!(encode(r"\cself[1]"), "{{WOLF_CSELF[1]}}");
        assert_eq!(encode(r"\cself[19]"), "{{WOLF_CSELF[19]}}");
    }

    #[test]
    fn test_encode_cdb() {
        assert_eq!(encode(r"\cdb[21:78:0]"), "{{WOLF_CDB[21:78:0]}}");
        assert_eq!(encode(r"\cdb[23:1:4]"), "{{WOLF_CDB[23:1:4]}}");
    }

    #[test]
    fn test_encode_color_case_distinct() {
        assert_eq!(encode(r"\c[2]"), "{{WOLF_COLOR_L[2]}}");
        assert_eq!(encode(r"\C[3]"), "{{WOLF_COLOR_U[3]}}");
        assert_ne!(encode(r"\c[2]"), encode(r"\C[2]"));
    }

    #[test]
    fn test_encode_font() {
        assert_eq!(encode(r"\f[2]"), "{{WOLF_FONT[2]}}");
        assert_eq!(encode(r"\font[1]"), "{{WOLF_FONTFULL[1]}}");
    }

    #[test]
    fn test_encode_compound_font_cself() {
        assert_eq!(encode(r"\f[\cself[19]]"), "{{WOLF_FONT_CS[19]}}");
    }

    #[test]
    fn test_encode_compound_ax_cself() {
        assert_eq!(encode(r"\ax[\cself[13]]"), "{{WOLF_AX_CS[13]}}");
        assert_eq!(encode(r"\ay[\cself[14]]"), "{{WOLF_AY_CS[14]}}");
    }

    #[test]
    fn test_encode_at() {
        assert_eq!(encode("@1"), "{{WOLF_AT[1]}}");
        assert_eq!(encode("@42"), "{{WOLF_AT[42]}}");
    }

    #[test]
    fn test_encode_percent_param() {
        assert_eq!(encode("%1が倒れた！"), "{{WOLF_PC[1]}}が倒れた！");
        assert_eq!(encode("％2"), "{{WOLF_PC[2]}}");
    }

    #[test]
    fn test_encode_no_param_codes() {
        assert_eq!(encode(r"\E"), "{{WOLF_END}}");
        assert_eq!(encode("<C>"), "{{WOLF_CENTER}}");
        assert_eq!(encode(r"\>"), "{{WOLF_RALIGN}}");
        assert_eq!(encode("<R>"), "{{WOLF_RTAG}}");
        assert_eq!(encode("<<"), "{{WOLF_LBRACKET}}");
        assert_eq!(encode(">>"), "{{WOLF_RBRACKET}}");
    }

    #[test]
    fn test_encode_newline_and_cr() {
        assert_eq!(encode("\n"), "{{WOLF_NL}}");
        assert_eq!(encode("\r"), "{{WOLF_CR}}");
    }

    #[test]
    fn test_roundtrip_cself() {
        let original = r"\cself[1]は剣を手に入れた！";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_cdb() {
        let original = r"\cdb[21:78:0]と\cdb[21:80:0]";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_color_case() {
        let original = r"\E\c[2]ほのか\C[3]いぶき";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_compound_font_cself() {
        let original = r"\f[\cself[19]]購入";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_complex() {
        let original = r"\>\f[5]レベル\cself[30]  / \cdb[21:78:0] \cdb[21:80:0]";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_indent_space_center() {
        let original = r"\-[1]<C>\E\space[0]\f[\cself[17]]\cself[7]";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_plain_text() {
        let text = "ゲームオーバー";
        let (decoded, intact) = decode(&encode(text));
        assert!(intact);
        assert_eq!(decoded, text);
    }

    #[test]
    fn test_roundtrip_udb() {
        let original = r"\udb[8:0]";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_udb_d() {
        let original = r"\udb[7:\d[0]]";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_my_signed() {
        let original = r"\my[-2]テキスト\my[2]";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_m_cself() {
        let original = r"\m[\cself[19]]";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_roundtrip_auto_align() {
        let original = r"\A-テキスト";
        let (decoded, intact) = decode(&encode(original));
        assert!(intact);
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_intact_false_when_token_dropped() {
        let (_, intact) = decode("{{WOLF_UNKNOWN_TOKEN}}");
        assert!(!intact);
    }

    #[test]
    fn test_decode_cr_is_actual_char() {
        let encoded = encode("\r");
        assert_eq!(encoded, "{{WOLF_CR}}");
        let (decoded, intact) = decode(&encoded);
        assert!(intact);
        assert_eq!(decoded, "\r"); // actual carriage return, not \\r
    }
}
