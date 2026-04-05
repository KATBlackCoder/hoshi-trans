# Marker Extraction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-pass `encode()` + `decode()` placeholder strategy with a single-pass `extract_native()` / `reinject_native()` system that converts native game codes directly to `❬n❭` markers, sending only simplified text to Ollama.

**Architecture:** Instead of encoding `\c[2]` → `{{WOLF_COLOR_L[2]}}` then to `❬n❭`, we go directly: `\c[2]` → `❬n❭`, storing `"\c[2]"` in the map. After the model responds, `reinject_native()` restores the original native codes from the map. The `encode()` / `decode()` functions are deleted. The model never sees `{{...}}` tokens nor native game codes — only short opaque `❬n❭` markers.

**Tech Stack:** Rust, regex (LazyLock), existing regex patterns from `wolf_rpg/placeholders.rs` and `rpgmaker_mv_mz/placeholders.rs`, `ollama.rs` translation loop.

---

## Why this change

| Problem | Old approach | New approach |
|---|---|---|
| Model drops `{{WOLF_RUBY}}` | Complex rule: "copy verbatim" | Model never sees it — just `❬0❭` |
| Two-pass encode+decode | `\c[2]` → `{{WOLF_COLOR_L[2]}}` → `❬0❭` | `\c[2]` → `❬0❭` directly |
| Long tokens waste context | `{{WOLF_COLOR_L[2]}}` = 7 tokens | `❬0❭` = 1 token |
| Per-engine prompt rules | 44 examples in Modelfile | One rule: "copy ❬n❭ exactly" |
| `encode()` + `decode()` complexity | ~300 lines per engine | Reuse same regexes, map stores native value |

## Key example — `{{WOLF_RUBY}}`

```
Source file:    \r[甘,あま]\r[酸,ず]っぱい思い出を\nはんすうしている！

extract_native():
  ❬0❭[甘,あま]❬1❭[酸,ず]っぱい思い出を❬2❭はんすうしている！
  map = { 0: r"\r", 1: r"\r", 2: "\n" }

Model output:
  ❬0❭[sweet,amai]❬1❭[sour,zu]ppai memories!❬2❭

reinject_native():
  \r[sweet,amai]\r[sour,zu]ppai memories!\n   ✅ native codes, ready for injection
```

`[甘,あま]` stays in the text → model translates it. `\r` goes into the map → model never sees it.

---

## File Map

| File | Change |
|---|---|
| `src-tauri/src/engines/wolf_rpg/placeholders.rs` | Replace `encode()` + `decode()` with `extract_native()` + `reinject_native()` |
| `src-tauri/src/engines/rpgmaker_mv_mz/placeholders.rs` | Same replacement |
| `src-tauri/src/engines/common/placeholders.rs` | Remove `check_placeholders_intact()` (no longer needed); keep `contains_japanese()` |
| `src-tauri/src/commands/ollama.rs` | Use `extract_native()` + `reinject_native()`; remove `encode()`/`decode()` calls; remove `count_placeholders()` |
| `src-tauri/src/commands/analyze.rs` | Use `extract_native()` for re-analysis |
| `src-tauri/modelfiles/trans/*.Modelfile` | Simplify: one `❬n❭` rule replaces all `{{...}}` rules |
| `src-tauri/modelfiles/rev/*.Modelfile` | Same simplification |

---

## Chunk 1: Wolf RPG — `extract_native()` + `reinject_native()`

### Task 1: Rewrite `wolf_rpg/placeholders.rs`

**Files:**
- Modify: `src-tauri/src/engines/wolf_rpg/placeholders.rs`

The existing regexes are kept — only their **output** changes. Instead of replacing `\c[2]` with `{{WOLF_COLOR_L[2]}}`, we replace it with `❬n❭` and store `r"\c[2]"` in the map.

The encoding order (compound → long-prefix → short-prefix → no-param) must be preserved exactly, since order prevents partial matches.

- [ ] **Step 1: Write failing tests**

Replace the existing test module with:

```rust
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
        let (s, map) = extract_native(r"\c[2]text\C[3]");
        assert_eq!(s, "❬0❭text❬1❭");
        assert_eq!(map, vec![r"\c[2]", r"\C[3]"]);
    }

    #[test]
    fn test_extract_ruby_leaves_content() {
        // \r is extracted, [甘,あま] stays for translation
        let (s, map) = extract_native(r"\r[甘,あま]\r[酸,ず]っぱい");
        assert_eq!(s, "❬0❭[甘,あま]❬1❭[酸,ず]っぱい");
        assert_eq!(map, vec![r"\r", r"\r"]);
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
        let (s, map) = extract_native("@1\n\"@2\"");
        assert_eq!(s, "❬0❭❬1❭\"❬2❭\"");
        assert_eq!(map, vec!["@1", "\n", "@2"]);
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
        // \r[甘,あま] — \r extracted, [甘,あま] stays in text
        let original = "\\r[甘,あま]\\r[酸,ず]っぱい思い出を\nはんすうしている！";
        let (s, map) = extract_native(original);
        // [甘,あま] is still in simplified text (for translation)
        assert!(s.contains("[甘,あま]"));
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
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src-tauri && cargo test wolf_rpg::placeholders::tests 2>&1 | head -20
```
Expected: compile error — `extract_native`, `reinject_native` not defined.

- [ ] **Step 3: Implement `extract_native()` and `reinject_native()`**

Replace the entire content of `src-tauri/src/engines/wolf_rpg/placeholders.rs` with:

```rust
use std::sync::LazyLock;
use regex::Regex;

// ── REGEXES (same patterns as before, kept for extraction) ────────────────────

static RE_FONT_CSELF: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\f\[\\cself\[(\d+)\]\]").unwrap());
static RE_AX_CSELF:   LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\ax\[\\cself\[(\d+)\]\]").unwrap());
static RE_AY_CSELF:   LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\ay\[\\cself\[(\d+)\]\]").unwrap());
static RE_M_CSELF:    LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\m\[\\cself\[(\d+)\]\]").unwrap());
static RE_UDB_D:      LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\udb\[(\d+):\\d\[(\d+)\]\]").unwrap());
static RE_CSELF:      LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\cself\[(\d+)\]").unwrap());
static RE_SELF:       LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\self\[(\d+)\]").unwrap());
static RE_CDB:        LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\cdb\[(\d+:\d+:\d+)\]").unwrap());
static RE_COLOR_L:    LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\c\[(\d+)\]").unwrap());
static RE_COLOR_U:    LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\C\[(\d+)\]").unwrap());
static RE_SYS:        LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\sys\[(\d+)\]").unwrap());
static RE_FONT_FULL:  LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\font\[(\d+)\]").unwrap());
static RE_FONT:       LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\f\[(\d+)\]").unwrap());
static RE_AX:         LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\ax\[(\d+)\]").unwrap());
static RE_AY:         LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\ay\[(\d+)\]").unwrap());
static RE_V:          LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\v\[(\d+)\]").unwrap());
static RE_ICON:       LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\i\[(\d+)\]").unwrap());
static RE_SLOT:       LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\s\[(\d+)\]").unwrap());
static RE_INDENT:     LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\-\[(\d+)\]").unwrap());
static RE_SPACE:      LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\space\[(\d+)\]").unwrap());
static RE_UDB:        LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\udb\[(\d+:\d+)\]").unwrap());
static RE_M:          LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\m\[(-?\d+)\]").unwrap());
static RE_MY:         LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\\my\[(-?\d+)\]").unwrap());
static RE_AT:         LazyLock<Regex> = LazyLock::new(|| Regex::new(r"@(\d+)").unwrap());
static RE_PC:         LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[%％](\d+)").unwrap());

// Ordered list of (regex, native_template) for parametric codes.
// Compound patterns first, then long-prefix, then short-prefix.
// native_template: use $0 for full match (no-param codes handled separately).
fn parametric_rules() -> &'static [(LazyLock<Regex>, fn(&regex::Captures) -> String)] {
    // We use a different approach: iterate in order, find earliest match each pass.
    // See extract_native() implementation below.
    unimplemented!() // not used directly — see ORDERED_RULES
}

/// Extract all Wolf RPG native codes from `text`, replacing each with `❬n❭`.
/// Returns (simplified_text, map) where map[n] = original native code string.
/// Extraction order matches old encode() to avoid partial matches.
pub fn extract_native(text: &str) -> (String, Vec<String>) {
    let mut s = text.to_string();
    let mut map: Vec<String> = Vec::new();

    // Helper: replace all matches of `re` in `s`, capturing each match as-is into map.
    // Returns new string with ❬n❭ markers.
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

    // Helper: replace all occurrences of literal `needle` in `s`.
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

    // 1. Compound patterns — must come before their components
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
    s = replace_literal(&s, r"\r",  &mut map);  // ruby start
    s = replace_literal(&s, "\r",   &mut map);  // actual CR char
    s = replace_literal(&s, "\n",   &mut map);  // actual newline
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

#[cfg(test)]
mod tests {
    // ... (tests from Step 1 go here)
}
```

- [ ] **Step 4: Run tests**

```bash
cd src-tauri && cargo test wolf_rpg::placeholders::tests 2>&1 | tail -20
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/engines/wolf_rpg/placeholders.rs
git commit -m "feat(wolf): replace encode/decode with extract_native/reinject_native direct marker system"
```

---

## Chunk 2: RPG Maker — `extract_native()` + `reinject_native()`

### Task 2: Rewrite `rpgmaker_mv_mz/placeholders.rs`

**Files:**
- Modify: `src-tauri/src/engines/rpgmaker_mv_mz/placeholders.rs`

RPG Maker has simpler patterns — one generic regex for `\LETTERS[n]` and a few no-param codes.

- [ ] **Step 1: Write failing tests**

```rust
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src-tauri && cargo test rpgmaker_mv_mz::placeholders::tests 2>&1 | head -20
```
Expected: compile error.

- [ ] **Step 3: Implement**

Replace the entire content of `src-tauri/src/engines/rpgmaker_mv_mz/placeholders.rs` with:

```rust
use std::sync::LazyLock;

// Generic parametric: \LETTERS[n] — covers \N, \V, \C, \FS, \item, \PY etc.
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
    // ... tests from Step 1
}
```

- [ ] **Step 4: Run tests**

```bash
cd src-tauri && cargo test rpgmaker_mv_mz::placeholders::tests 2>&1 | tail -20
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/engines/rpgmaker_mv_mz/placeholders.rs
git commit -m "feat(rpgmaker): replace encode/decode with extract_native/reinject_native"
```

---

## Chunk 3: Wire into `ollama.rs` and `analyze.rs`

### Task 3: Update `ollama.rs` translation loop

**Files:**
- Modify: `src-tauri/src/commands/ollama.rs`

- [ ] **Step 1: Update imports**

Replace:
```rust
use crate::engines::{rpgmaker_mv_mz::placeholders as rpgmaker_ph, wolf_rpg::placeholders as wolf_ph};
```
With (same — module names unchanged, just function names change inside):
```rust
use crate::engines::{rpgmaker_mv_mz::placeholders as rpgmaker_ph, wolf_rpg::placeholders as wolf_ph};
```

- [ ] **Step 2: Replace translation core**

Find the translation block starting at `let encoded = if is_wolf {` and replace:

```rust
// OLD — two-pass encode then count {{...}}
let encoded = if is_wolf {
    wolf_ph::encode(&entry.source_text)
} else {
    rpgmaker_ph::encode(&entry.source_text)
};
let source_count = count_placeholders(&encoded);
// ...sends encoded to model...
// ...counts {{...}} in output...
let (decoded, _) = if is_wolf { wolf_ph::decode(&translated) } else { rpgmaker_ph::decode(&translated) };
```

With:

```rust
// NEW — single-pass extract native → ❬n❭
let (simplified, ph_map) = if is_wolf {
    wolf_ph::extract_native(&entry.source_text)
} else {
    rpgmaker_ph::extract_native(&entry.source_text)
};
let marker_count = ph_map.len();

let lang_name = match target_lang.as_str() {
    "fr" => "French",
    _ => "English",
};
let prompt = if system_prompt.is_empty() {
    format!("Translate from Japanese to {}: {}", lang_name, simplified)
} else {
    format!("{}\n\nTranslate from Japanese to {}: {}", system_prompt, lang_name, simplified)
};
let ollama = ollama_from_url(&ollama_host);
let options = ollama_rs::models::ModelOptions::default().temperature(temperature);

const MAX_RETRIES: u32 = 2;
let mut last_error: Option<String> = None;
let mut final_result = String::new();
let mut final_status = String::new();
let mut success = false;
let mut last_found: usize = 0;

for attempt in 0..=MAX_RETRIES {
    let attempt_prompt = if attempt == 0 {
        prompt.clone()
    } else {
        let missing = marker_count - last_found.min(marker_count);
        if system_prompt.is_empty() {
            format!(
                "Translate from Japanese to {} (RETRY {attempt}/{MAX_RETRIES} — {missing} marker(s) missing, copy ALL ❬n❭ exactly): {}",
                lang_name, simplified
            )
        } else {
            format!(
                "{}\n\nTranslate from Japanese to {} (RETRY {attempt}/{MAX_RETRIES} — {missing} marker(s) missing, copy ALL ❬n❭ exactly): {}",
                system_prompt, lang_name, simplified
            )
        }
    };

    let request = GenerationRequest::new(model.clone(), attempt_prompt).options(options.clone());
    match ollama.generate(request).await {
        Ok(response) => {
            let translated = response.response.trim().replace("\\\"", "\"");
            let (reinjected, intact) = if is_wolf {
                wolf_ph::reinject_native(&translated, &ph_map)
            } else {
                rpgmaker_ph::reinject_native(&translated, &ph_map)
            };
            if intact {
                final_result = reinjected;
                final_status = "translated".to_string();
                success = true;
                break;
            } else if attempt == MAX_RETRIES {
                let found = (0..marker_count)
                    .filter(|i| translated.contains(&format!("❬{}❭", i)))
                    .count();
                final_result = reinjected;
                final_status = format!("warning:missing_placeholder:{}/{}", found, marker_count);
                success = true;
            } else {
                last_found = (0..marker_count)
                    .filter(|i| translated.contains(&format!("❬{}❭", i)))
                    .count();
            }
        }
        Err(e) => {
            last_error = Some(e.to_string());
        }
    }
}
```

- [ ] **Step 3: Remove `count_placeholders()` function**

It is no longer needed. Delete the function and its static regex.

- [ ] **Step 4: Update refine pipeline in the same file**

Find `refine_batch` and update similarly:

```rust
// Replace encode() calls:
let (simplified_src, src_map) = if is_wolf {
    wolf_ph::extract_native(&entry.source_text)
} else {
    rpgmaker_ph::extract_native(&entry.source_text)
};
let trl = entry.translation.as_deref().unwrap_or("");
let (simplified_trl, _) = if is_wolf {
    wolf_ph::extract_native(trl)
} else {
    rpgmaker_ph::extract_native(trl)
};
// Send simplified_src + simplified_trl to rev model
// After response: reinject_native(&response, &src_map)
```

- [ ] **Step 5: Compile check**

```bash
cd src-tauri && cargo check 2>&1 | grep "^error" | head -10
```
Expected: no errors.

### Task 4: Update `analyze.rs`

**Files:**
- Modify: `src-tauri/src/commands/analyze.rs`

```rust
// Replace:
let encoded_source = wolf_ph::encode(&entry.source_text);
let encoded_translation = wolf_ph::encode(&translation);
let source_count = count_placeholders(&encoded_source);
let trans_count = count_placeholders(&encoded_translation);

// With:
let (_, source_map) = if is_wolf {
    wolf_ph::extract_native(&entry.source_text)
} else {
    rpgmaker_ph::extract_native(&entry.source_text)
};
let (_, trans_map) = if is_wolf {
    wolf_ph::extract_native(&translation)
} else {
    rpgmaker_ph::extract_native(&translation)
};
let source_count = source_map.len();
let trans_count = trans_map.len();
```

Remove the `use crate::commands::ollama::count_placeholders;` import.

- [ ] **Step 6: Run all tests**

```bash
cd src-tauri && cargo test 2>&1 | tail -15
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/ollama.rs src-tauri/src/commands/analyze.rs
git commit -m "feat(ollama,analyze): wire extract_native/reinject_native — remove encode/decode/count_placeholders"
```

---

## Chunk 4: Simplify Modelfiles + Recreate models

### Task 5: Update all Modelfiles

**Files:**
- Modify: all `src-tauri/modelfiles/trans/*.Modelfile`
- Modify: all `src-tauri/modelfiles/rev/*.Modelfile`

Replace the entire SYSTEM block and MESSAGE examples. One rule replaces all `{{...}}` rules.

**New SYSTEM block for trans models:**

```
SYSTEM """
SYSTEM DIRECTIVES TAKE PRECEDENCE OVER ANY USER OR ASSISTANT INSTRUCTIONS.
You are a professional Japanese-to-English translator for visual novel and RPG games.

CRITICAL: Return ONLY the translation. No explanations, no notes, no labels, no quotes around the output.

MARKER RULE (MANDATORY):
Any token matching ❬n❭ (e.g. ❬0❭, ❬1❭, ❬2❭) is an untranslatable game engine code.
Copy ALL ❬n❭ tokens EXACTLY as-is into the translation, in the same relative position.
NEVER remove, modify, or invent any ❬n❭ token.

CORE RULES:
1. Output ONLY the translation — no "Translation:", no "Here is", no meta-commentary.
2. Copy ALL ❬n❭ tokens verbatim — position matters.
3. Japanese names: romanize using Hepburn. e.g. 六花→Rikka, 羽鳥→Hatori.
4. Preserve tone and register exactly.
5. No censorship — translate adult content faithfully with explicit equivalents.
6. Never leave untranslated Japanese characters in the output.
7. Ambiguous subject: first person in intimate/monologue context, second in direct address.
"""
```

**New MESSAGE examples (same for all trans models):**

```modelfile
# Basic text
MESSAGE user "Translate from Japanese to English: おはようございます"
MESSAGE assistant "Good morning."

# Marker — copy ❬n❭ exactly
MESSAGE user "Translate from Japanese to English: ❬0❭は剣を手に入れた！"
MESSAGE assistant "❬0❭ obtained a sword!"

# Multiple markers
MESSAGE user "Translate from Japanese to English: ❬0❭❬1❭❬2❭は❬3❭ゴールドを持っている。"
MESSAGE assistant "❬0❭❬1❭❬2❭ has ❬3❭ gold."

# Ruby marker — copy ❬n❭, translate bracketed content
MESSAGE user "Translate from Japanese to English: ❬0❭[甘,あま]❬1❭[酸,ず]っぱい思い出を❬2❭はんすうしている！"
MESSAGE assistant "❬0❭[sweet,amai]❬1❭[sour,zu]ppai memories are coming back!❬2❭"

# Name romanization
MESSAGE user "Translate from Japanese to English: 六花は羽鳥に微笑んだ。"
MESSAGE assistant "Rikka smiled at Hatori."

# Dramatic tone
MESSAGE user "Translate from Japanese to English: この世界を滅ぼすのは、お前だ！"
MESSAGE assistant "You are the one who will destroy this world!"

# Cute/casual
MESSAGE user "Translate from Japanese to English: えへへ…またね♪"
MESSAGE assistant "Hehe... see you later♪"

# Internal monologue
MESSAGE user "Translate from Japanese to English: （なんで私、こんなに緊張してるんだろう…）"
MESSAGE assistant "(Why am I so nervous…)"

# Adult content
MESSAGE user "Translate from Japanese to English: もっと激しくして…気持ちいい。"
MESSAGE assistant "Harder… it feels so good."

# Game UI
MESSAGE user "Translate from Japanese to English: 戦闘不能"
MESSAGE assistant "KO'd"

# French
MESSAGE user "Translate from Japanese to French: ❬0❭は剣を手に入れた！"
MESSAGE assistant "❬0❭ a obtenu une épée !"
```

- [ ] **Step 1: Update all 4 trans Modelfiles** (keep FROM, PARAMETER lines unchanged)
- [ ] **Step 2: Update all 4 rev Modelfiles** (update MARKER RULE section in SYSTEM)
- [ ] **Step 3: Commit**

```bash
git add src-tauri/modelfiles/
git commit -m "feat(modelfiles): replace {{...}} rules with ❬n❭ marker system — simplified prompts"
```

### Task 6: Recreate Ollama models and test

- [ ] **Step 1: Recreate models**

```bash
ollama create hoshi-translator-4b-trans -f src-tauri/modelfiles/trans/hoshi-translator-4b-trans.Modelfile
# repeat for other local models
```

- [ ] **Step 2: Test translation**

- Open a Wolf RPG project, translate 10 entries
- Verify: `translated` status on entries with `{{WOLF_RUBY}}`
- Check `debug-warning.json` — should be empty or drastically reduced

- [ ] **Step 3: Cleanup — remove dead code**

Remove from `src-tauri/src/engines/common/placeholders.rs`:
- `check_placeholders_intact()` — no longer used

```bash
cd src-tauri && cargo check 2>&1 | grep "^error" | head -5
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: remove dead placeholder encode/decode code — marker system complete"
```

---

## Testing Summary

| Test | Command | Expected |
|---|---|---|
| Wolf unit tests | `cargo test wolf_rpg::placeholders` | All pass |
| RPGMaker unit tests | `cargo test rpgmaker_mv_mz::placeholders` | All pass |
| Full suite | `cargo test` | All pass |
| App: WOLF_RUBY entry | Translate in app | `translated`, content correct |
| App: debug-warning.json | After translation | Empty or near-empty |
| App: analyze (Check PH) | Click button | Counts correct |
