# Unified Modelfiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 6+ modelfiles (trans/ + rev/ per size) into 2 unified modelfiles (4b, 30b), with all task-specific prompt text stored in `src-tauri/prompts/hoshi-prompts.json` embedded at compile time via `include_str!()`.

**Architecture:** Each unified modelfile contains universal rules (marker handling, honorifics, no censorship), 3 generic few-shots, and a single set of sampling parameters that work for both translation and review. All task-specific prompt text lives in `hoshi-prompts.json`, parsed once at startup via `LazyLock<serde_json::Value>`. The app passes **no custom `ModelOptions`** — only `temperature` (already from user settings) is sent at call time; everything else comes from the modelfile. The frontend model filter (`m.includes('hoshi-translator')`) requires no change.

**Tech Stack:** Ollama modelfile format, Rust `serde_json`, `std::sync::LazyLock`, React/TypeScript (About page setup commands).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src-tauri/prompts/hoshi-prompts.json` | **Create** | All task-specific prompt text (translate rules, review criteria) |
| `src-tauri/modelfiles/hoshi-translator-4b.Modelfile` | **Create** | Unified 4B — full params + universal SYSTEM + 3 few-shots |
| `src-tauri/modelfiles/hoshi-translator-30b.Modelfile` | **Create** | Unified 30B MoE — same structure |
| `src-tauri/modelfiles/trans/` | **Delete all** | Replaced by unified modelfiles |
| `src-tauri/modelfiles/rev/` | **Delete all** | Replaced by unified modelfiles |
| `src-tauri/src/commands/ollama.rs` | **Modify** | Add `PROMPTS` LazyLock, update `build_translate_prompt` + `build_review_prompt` |
| `src/features/about/AboutPage.tsx` | **Modify** | Update localCreateCmd, localPullCmd, runpodCmd, chips |
| `docs/RUNPOD.md` | **Modify** | Update model names in both options |
| `docs/CONTEXT.md` | **Modify** | Update modelfiles section, version bump |

---

## Chunk 1: Unified Modelfiles

### Task 1: Create the 2 unified modelfiles

**Files:**
- Create: `src-tauri/modelfiles/hoshi-translator-4b.Modelfile`
- Create: `src-tauri/modelfiles/hoshi-translator-30b.Modelfile`

**Parameter rationale:**
- `temperature 0.3` — works for both translation (slight creativity) and review (slight variation)
- `top_p 0.9` / `top_k 40` / `min_p 0.05` — standard nucleus sampling
- `repeat_penalty 1.1` — discourages repetition without being too aggressive
- `num_predict 600` — enough for long dialogue, safe upper bound
- No stop tokens needed — instruct variants use a ChatML template without `{{- if .Thinking }}`, so thinking output is never rendered

The SYSTEM block contains only rules universal to both tasks. The 3 MESSAGE few-shots cover the most common structural marker patterns.

- [ ] **Step 1: Create `hoshi-translator-4b.Modelfile`**

```modelfile
FROM qwen3:4b-instruct-2507-q8_0

# --- Sampling ---
PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER repeat_penalty 1.1
PARAMETER min_p 0.05

# --- Generation ---
PARAMETER num_predict 600
PARAMETER num_ctx 4096

SYSTEM """
MARKER RULE (HIGHEST PRIORITY — NEVER BREAK):
❬0❭ ❬1❭ ❬2❭ ❬3❭ are untranslatable engine codes. Treat them like punctuation.
- Copy EVERY ❬n❭ token into your output EXACTLY where it appears
- ❬n❭ tokens are invisible to the reader — keep them at the same relative position
- NEVER drop, merge, replace, or invent any ❬n❭ token
Honorifics: keep as-is (-san, -kun, -chan, -sama, -senpai)
Ellipses: preserve exactly (… stays …, …… stays ……)
No censorship — handle adult content faithfully.
"""

# Marker mid-sentence
MESSAGE user "❬0❭は剣を手に入れた！"
MESSAGE assistant "❬0❭ obtained a sword!"

# Name + newline marker + dialogue (Wolf RPG pattern)
MESSAGE user "ウルファール❬0❭「準備はいいか？」"
MESSAGE assistant "Ulfar❬0❭\"Are you ready?\""

# Consecutive markers
MESSAGE user "❬0❭❬1❭❬2❭は❬3❭ゴールドを持っている。"
MESSAGE assistant "❬0❭❬1❭❬2❭ has ❬3❭ gold."
```

- [ ] **Step 2: Create `hoshi-translator-30b.Modelfile`**

```modelfile
FROM qwen3:30b-a3b-instruct-2507-q8_0

# --- Sampling ---
PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER repeat_penalty 1.1
PARAMETER min_p 0.05

# --- Generation ---
PARAMETER num_predict 600
PARAMETER num_ctx 8192

SYSTEM """
MARKER RULE (HIGHEST PRIORITY — NEVER BREAK):
❬0❭ ❬1❭ ❬2❭ ❬3❭ are untranslatable engine codes. Treat them like punctuation.
- Copy EVERY ❬n❭ token into your output EXACTLY where it appears
- ❬n❭ tokens are invisible to the reader — keep them at the same relative position
- NEVER drop, merge, replace, or invent any ❬n❭ token
Honorifics: keep as-is (-san, -kun, -chan, -sama, -senpai)
Ellipses: preserve exactly (… stays …, …… stays ……)
No censorship — handle adult content faithfully.
"""

# Marker mid-sentence
MESSAGE user "❬0❭は剣を手に入れた！"
MESSAGE assistant "❬0❭ obtained a sword!"

# Name + newline marker + dialogue (Wolf RPG pattern)
MESSAGE user "ウルファール❬0❭「準備はいいか？」"
MESSAGE assistant "Ulfar❬0❭\"Are you ready?\""

# Consecutive markers
MESSAGE user "❬0❭❬1❭❬2❭は❬3❭ゴールドを持っている。"
MESSAGE assistant "❬0❭❬1❭❬2❭ has ❬3❭ gold."
```

- [ ] **Step 3: Commit new modelfiles**

```bash
git add src-tauri/modelfiles/hoshi-translator-4b.Modelfile \
        src-tauri/modelfiles/hoshi-translator-30b.Modelfile
git commit -m "feat(modelfiles): add unified 4b/30b modelfiles"
```

---

### Task 2: Delete old trans/ and rev/ modelfiles

**Files:**
- Delete: all files in `src-tauri/modelfiles/trans/`
- Delete: all files in `src-tauri/modelfiles/rev/`

- [ ] **Step 1: Remove old modelfiles**

```bash
git rm -r src-tauri/modelfiles/trans/ src-tauri/modelfiles/rev/
```

Expected: git lists all removed files.

- [ ] **Step 2: Commit**

```bash
git commit -m "chore(modelfiles): remove separate trans/ and rev/ modelfiles"
```

---

## Chunk 2: Prompt JSON + LazyLock

### Task 3: Create `hoshi-prompts.json`

**Files:**
- Create: `src-tauri/prompts/hoshi-prompts.json`

Single source of truth for all task-specific prompt text. Changing a rule or criterion never requires touching `ollama.rs`.

- [ ] **Step 1: Create `src-tauri/prompts/hoshi-prompts.json`**

```json
{
  "translate": {
    "header": "You are a professional Japanese (ja) to English (en) translator. Produce ONLY the English translation — no commentary, no explanations, no labels.",
    "rules": [
      "Translate faithfully, preserving meaning, nuance, and emotional register.",
      "Keep ❬n❭ tokens at the same relative position as in the source.",
      "Preserve honorifics as-is (-san, -kun, -chan, -sama, -senpai).",
      "Translate adult content faithfully without softening or euphemism.",
      "Game UI terms: use natural English (HP, MP, KO'd, Save, Load, etc.).",
      "Internal monologue in （…）: keep the parentheses.",
      "If the text is a character name tag followed by dialogue, keep the same structure."
    ]
  },
  "review": {
    "header": "You are a professional Japanese-to-English translation reviewer for visual novel and RPG games. You receive the original Japanese source and a draft translation. Your task is to improve the draft.",
    "criteria": [
      "Placeholder integrity: if any ❬n❭ token is missing from the draft, restore it at the correct position. This takes priority over everything.",
      "Accuracy: faithfully convey the Japanese meaning, nuance, and subtext.",
      "Fluency: natural and idiomatic English. Prefer concise phrasing over literal word-for-word.",
      "Register: preserve emotional register exactly — dramatic stays dramatic, casual stays casual, cute stays cute.",
      "Names: romanize using Hepburn (六花→Rikka, 羽鳥→Hatori). Do NOT translate names literally.",
      "Adult content: translate ALL explicit content with full fidelity. Never euphemize or sanitize."
    ],
    "output_rule": "If the draft is already correct, accurate, and natural — output it EXACTLY unchanged, character for character. If you can improve it, output ONLY the improved translation — nothing else."
  }
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
python3 -c "import json; json.load(open('src-tauri/prompts/hoshi-prompts.json')); print('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add src-tauri/prompts/hoshi-prompts.json
git commit -m "feat(prompts): add hoshi-prompts.json — single source of truth for prompt text"
```

---

### Task 4: Wire `hoshi-prompts.json` into `ollama.rs`

**Files:**
- Modify: `src-tauri/src/commands/ollama.rs`

**What changes:**

1. Add a `LazyLock<serde_json::Value>` that parses the JSON once at startup via `include_str!()`.
2. Replace `TRANSLATEGEMMA_HEADER` const + `build_translate_prompt` to read from `PROMPTS["translate"]`.
3. Replace hardcoded criteria in `build_review_prompt` to read from `PROMPTS["review"]`.
4. `ModelOptions` in both `translate_batch` and `refine_batch` stay exactly as they are — only `temperature` is passed, nothing else.

The `include_str!` path is relative to `ollama.rs` which lives at `src-tauri/src/commands/ollama.rs`. The prompts file is at `src-tauri/prompts/hoshi-prompts.json`, so the relative path is `"../../../prompts/hoshi-prompts.json"`.

- [ ] **Step 1: Check `serde_json` is in Cargo.toml**

```bash
grep "serde_json" src-tauri/Cargo.toml
```

If no output: `cd src-tauri && cargo add serde_json`
If present: skip.

- [ ] **Step 2: Add `LazyLock` + `include_str!` at the top of `ollama.rs`**

After the existing `use` imports, add:

```rust
static PROMPTS: std::sync::LazyLock<serde_json::Value> = std::sync::LazyLock::new(|| {
    serde_json::from_str(include_str!("../../../prompts/hoshi-prompts.json"))
        .expect("hoshi-prompts.json is invalid JSON")
});
```

- [ ] **Step 3: Replace `TRANSLATEGEMMA_HEADER` + `build_translate_prompt`**

Delete the existing `const TRANSLATEGEMMA_HEADER: &str = ...` and the `build_translate_prompt` function (around lines 105–113). Replace with:

```rust
fn build_translate_prompt(glossary_block: &str, text: &str) -> String {
    let t = &PROMPTS["translate"];
    let header = t["header"].as_str().unwrap_or("");
    let rules: String = t["rules"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join("\n- ")
        })
        .unwrap_or_default();

    let instruction = format!("{}\nRules:\n- {}", header, rules);

    if glossary_block.is_empty() {
        format!("{}\n\nTranslate:\n{}", instruction, text)
    } else {
        format!("{}\n{}\n\nTranslate:\n{}", instruction, glossary_block, text)
    }
}
```

- [ ] **Step 4: Replace hardcoded criteria in `build_review_prompt`**

Current function signature (keep unchanged):
```rust
pub fn build_review_prompt(
    encoded_source: &str,
    encoded_draft: &str,
    ph_count_source: i64,
    ph_count_draft: i64,
    lang_name: &str,
) -> String
```

Replace the body:

```rust
pub fn build_review_prompt(
    encoded_source: &str,
    encoded_draft: &str,
    ph_count_source: i64,
    ph_count_draft: i64,
    lang_name: &str,
) -> String {
    let r = &PROMPTS["review"];
    let header = r["header"].as_str().unwrap_or("");
    let criteria: String = r["criteria"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .enumerate()
                .filter_map(|(i, v)| v.as_str().map(|s| format!("{}. {}", i + 1, s)))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();
    let output_rule = r["output_rule"].as_str().unwrap_or("");

    format!(
        "{header}\nCRITICAL: Output ONLY the final translation. No commentary, no labels.\n\n\
         Source (JP): {source}\n\
         Draft: {draft}\n\
         Source has {ph_src} marker(s). Draft has {ph_draft} marker(s).\n\n\
         Review criteria:\n{criteria}\n\n\
         {output_rule}",
        header = header,
        source = encoded_source,
        draft = encoded_draft,
        ph_src = ph_count_source,
        ph_draft = ph_count_draft,
        criteria = criteria,
        output_rule = output_rule,
    )
}
```

- [ ] **Step 5: Verify `ModelOptions` lines are untouched**

Confirm these two lines remain exactly as they are (no new options added):

In `translate_batch` (~line 247):
```rust
let options = ollama_rs::models::ModelOptions::default().temperature(temperature);
```

In `refine_batch` (~line 490):
```rust
let options = ollama_rs::models::ModelOptions::default().temperature(0.0);
```

- [ ] **Step 6: Run Rust tests**

```bash
cd src-tauri && cargo test 2>&1 | tail -20
```

Expected: all existing tests pass. The `test_build_review_prompt_includes_source_and_draft` test still passes — the new function still includes source and draft in output.

- [ ] **Step 7: Add tests for the new prompt builders**

In the `#[cfg(test)]` block at the bottom of `ollama.rs`:

```rust
#[test]
fn test_build_translate_prompt_reads_json() {
    let prompt = build_translate_prompt("", "おはようございます");
    assert!(prompt.contains("Translate:"));
    assert!(prompt.contains("おはようございます"));
    assert!(prompt.contains("honorific") || prompt.contains("Honorific"));
}

#[test]
fn test_build_translate_prompt_includes_glossary() {
    let glossary = "Reference glossary (use these translations, do not include in output):\n- 六花 → Rikka";
    let prompt = build_translate_prompt(glossary, "六花が来た。");
    assert!(prompt.contains("Reference glossary"));
    assert!(prompt.contains("六花が来た。"));
}

#[test]
fn test_build_review_prompt_reads_json() {
    let prompt = build_review_prompt("こんにちは", "Hello", 0, 0, "English");
    assert!(prompt.contains("こんにちは"));
    assert!(prompt.contains("Hello"));
    assert!(prompt.contains("unchanged") || prompt.contains("EXACTLY"));
}
```

- [ ] **Step 8: Run new tests**

```bash
cd src-tauri && cargo test test_build_translate_prompt test_build_review_prompt_reads_json 2>&1
```

Expected: 3 tests pass.

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/commands/ollama.rs src-tauri/Cargo.toml
git commit -m "feat(ollama): load prompt text from hoshi-prompts.json via include_str! + LazyLock"
```

---

## Chunk 3: Frontend + docs update

### Task 5: Update `AboutPage.tsx` setup commands

**Files:**
- Modify: `src/features/about/AboutPage.tsx`

**What changes:** Old model names (`hoshi-translator-4b-trans`, `-rev`, `27b` variants) → new unified names. Only 4b and 30b.

- [ ] **Step 1: Read current state block**

Read `src/features/about/AboutPage.tsx` lines 70–120 to confirm exact current code.

- [ ] **Step 2: Update `localModel` state type**

Find:
```tsx
const [localModel, setLocalModel] = useState<'4b' | '27b' | '30b'>('4b')
```
Replace with:
```tsx
const [localModel, setLocalModel] = useState<'4b' | '30b'>('4b')
```

- [ ] **Step 3: Update size chips array**

```tsx
{ id: '4b' as const, label: '4B', sub: 'Local · ~3 GB' },
{ id: '30b' as const, label: '30B MoE', sub: 'RunPod · ~20 GB' },
```

- [ ] **Step 4: Update `localModelName`**

Find:
```tsx
const localModelName = localModel === '4b' ? 'hoshi-translator' : `hoshi-translator-${localModel}`
```
Replace with:
```tsx
const localModelName = `hoshi-translator-${localModel}`
```

- [ ] **Step 5: Update `localPullCmd`**

```tsx
const localPullCmd =
  localModel === '4b'
    ? `ollama pull qwen3:4b-instruct-2507-q8_0`
    : `ollama pull qwen3:30b-a3b-instruct-2507-q8_0`
```

- [ ] **Step 6: Update `localCreateCmd`**

```tsx
const localCreateCmd =
  localModel === '4b'
    ? `curl -fL -o /tmp/hoshi-translator-4b.Modelfile \\
  https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/hoshi-translator-4b.Modelfile
ollama create hoshi-translator-4b -f /tmp/hoshi-translator-4b.Modelfile`
    : `curl -fL -o /tmp/hoshi-translator-30b.Modelfile \\
  https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/hoshi-translator-30b.Modelfile
ollama create hoshi-translator-30b -f /tmp/hoshi-translator-30b.Modelfile`
```

- [ ] **Step 7: Update `runpodCmd`**

```tsx
const runpodCmd = `bash -c "apt update && apt install -y curl lshw zstd && curl -fsSL https://ollama.com/install.sh | sh && OLLAMA_HOST=0.0.0.0 nohup ollama serve > /root/ollama.log 2>&1 & sleep 60 && curl -fL -o /tmp/30b.Modelfile https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/hoshi-translator-30b.Modelfile && ollama create hoshi-translator-30b -f /tmp/30b.Modelfile && echo hoshi-translator-ready && sleep infinity"`
```

- [ ] **Step 8: Update RunPod chip label**

Find:
```tsx
<span className="... font-mono">30b-trans</span>
```
Replace with:
```tsx
<span className="... font-mono">30b</span>
```

- [ ] **Step 9: TypeScript build check**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

Expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git add src/features/about/AboutPage.tsx
git commit -m "feat(about): update setup commands for unified 4b/14b/30b modelfiles"
```

---

### Task 6: Update `docs/RUNPOD.md`

**Files:**
- Modify: `docs/RUNPOD.md`

- [ ] **Step 1: Read current file**

```bash
cat docs/RUNPOD.md
```

- [ ] **Step 2: Replace all modelfile references**

For every occurrence:
- `modelfiles/trans/hoshi-translator-Xb-trans.Modelfile` → `modelfiles/hoshi-translator-Xb.Modelfile`
- `ollama create hoshi-translator-Xb-trans` → `ollama create hoshi-translator-Xb`
- Remove any separate `-rev` model creation commands

- [ ] **Step 3: Commit**

```bash
git add docs/RUNPOD.md
git commit -m "docs(runpod): update modelfile paths for unified modelfiles"
```

---

### Task 7: Update `docs/CONTEXT.md`

**Files:**
- Modify: `docs/CONTEXT.md`

- [ ] **Step 1: Bump version line**

```
> Version : 1.1 — Unified modelfiles (4b/14b/30b) + hoshi-prompts.json
```

- [ ] **Step 2: Update `## 🗂️ Modelfiles` section**

Replace existing trans/rev split description with:

```markdown
### Structure

One modelfile per size — no trans/rev split. Sampling parameters work for both translation and review. Task-specific prompt text lives in `src-tauri/prompts/hoshi-prompts.json`.

| Model | Base | VRAM | Use case |
|-------|------|------|---------|
| `hoshi-translator-4b` | qwen3:4b-instruct-2507-q8_0 | ~3 GB | Local CPU/GPU |
| `hoshi-translator-30b` | qwen3:30b-a3b-instruct-2507-q8_0 | ~20 GB | RunPod RTX 4090 |

### Shared parameters (all 3 modelfiles)

| Parameter | Value | Why |
|-----------|-------|-----|
| temperature | 0.3 | balanced creativity for both tasks |
| top_k | 40 | standard nucleus sampling |
| top_p | 0.9 | standard nucleus sampling |
| repeat_penalty | 1.1 | discourages repetition |
| min_p | 0.05 | filters unlikely tokens |
| num_predict | 600 | enough for long dialogue |
| num_ctx | 4096 (4b) / 8192 (30b) | context window |
| stop | — | not needed — instruct template has no thinking block |

### Prompt engineering — `hoshi-prompts.json`

All task-specific prompt text lives in `src-tauri/prompts/hoshi-prompts.json`, embedded at compile time via `include_str!()` and parsed once via `LazyLock<serde_json::Value>`.

- `translate.header` + `translate.rules` → built by `build_translate_prompt()`
- `review.header` + `review.criteria` + `review.output_rule` → built by `build_review_prompt()`

To change a translation rule or review criterion: edit `hoshi-prompts.json` only.

### App passes no custom ModelOptions

Only `temperature` is sent at call time (from user settings). All other parameters come from the modelfile.
```

- [ ] **Step 3: Commit**

```bash
git add docs/CONTEXT.md
git commit -m "docs(context): document unified modelfile architecture + hoshi-prompts.json (v1.1)"
```

---

## Summary of commits

| # | Message |
|---|---------|
| 1 | `feat(modelfiles): add unified 4b/30b modelfiles` |
| 2 | `chore(modelfiles): remove separate trans/ and rev/ modelfiles` |
| 3 | `feat(prompts): add hoshi-prompts.json` |
| 4 | `feat(ollama): load prompt text from hoshi-prompts.json via include_str! + LazyLock` |
| 5 | `feat(about): update setup commands for unified 4b/14b/30b modelfiles` |
| 6 | `docs(runpod): update modelfile paths for unified modelfiles` |
| 7 | `docs(context): document unified modelfile architecture (v1.1)` |

## What does NOT change

- `ModelOptions` in `translate_batch` and `refine_batch` — only temperature, unchanged
- Frontend model filter `m.includes('hoshi-translator')` — works as-is
- `refine_batch` and `translate_batch` call signatures — unchanged
- DB schema, Tauri commands, engine logic — untouched
