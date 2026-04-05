# Glossary Filtering Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filter glossary terms per-entry so only terms present in the source text are sent to the model, reducing prompt noise from irrelevant entries.

**Architecture:** `translate_batch()` currently builds one glossary block before the loop and applies it to every entry. We refactor it to fetch all terms once (DB call stays before the loop), then filter per-entry inside the spawn closure by checking `contains()` on the source text. Option B (project-scoped glossary) is already fully implemented in the frontend — no changes needed there.

**Tech Stack:** Rust, `src-tauri/src/commands/ollama.rs`, `tokio::task::JoinSet`, Cargo test

---

## Note: Option B is already done

`src/features/glossary/GlossaryPage.tsx` already has:
- `scopeProjectId` state (`useState<string | null>(null)`)
- Project list query via `get_projects_with_stats`
- Scope `<Select>` UI (Global / per-project)
- Per-row scope badge display

No frontend changes needed for Option B.

---

## Chunk 1: Per-entry glossary filtering

### Task 1: `filter_glossary_for_text()` utility

**Files:**
- Modify: `src-tauri/src/commands/ollama.rs`

- [ ] **Step 1: Write the failing tests**

Add inside the `#[cfg(test)]` module at the bottom of `src-tauri/src/commands/ollama.rs`:

```rust
#[test]
fn test_filter_glossary_present_terms() {
    let terms = vec![
        ("六花".to_string(), "Rikka".to_string()),
        ("羽鳥".to_string(), "Hatori".to_string()),
        ("魔法".to_string(), "magic".to_string()),
    ];
    let result = filter_glossary_for_text("六花が魔法を使った。", &terms);
    assert_eq!(result, vec![
        ("六花".to_string(), "Rikka".to_string()),
        ("魔法".to_string(), "magic".to_string()),
    ]);
}

#[test]
fn test_filter_glossary_no_match() {
    let terms = vec![("羽鳥".to_string(), "Hatori".to_string())];
    let result = filter_glossary_for_text("おはようございます。", &terms);
    assert!(result.is_empty());
}

#[test]
fn test_filter_glossary_empty_terms() {
    let result = filter_glossary_for_text("六花が魔法を使った。", &[]);
    assert!(result.is_empty());
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src-tauri && cargo test test_filter_glossary 2>&1 | head -20
```
Expected: FAIL — `filter_glossary_for_text` not found.

- [ ] **Step 3: Add `filter_glossary_for_text()` after `format_glossary_block()`**

Insert after the closing `}` of `format_glossary_block()` (after line 103), before the `translate_batch` doc comment:

```rust
/// Returns only the glossary terms whose source_term appears literally in `text`.
/// Preserves the original order from `terms`.
fn filter_glossary_for_text(text: &str, terms: &[(String, String)]) -> Vec<(String, String)> {
    terms
        .iter()
        .filter(|(src, _)| text.contains(src.as_str()))
        .cloned()
        .collect()
}
```

- [ ] **Step 4: Run tests**

```bash
cd src-tauri && cargo test test_filter_glossary
```
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/ollama.rs
git commit -m "feat(glossary): add filter_glossary_for_text utility with tests"
```

---

### Task 2: Move glossary filtering inside the per-entry spawn closure

**Files:**
- Modify: `src-tauri/src/commands/ollama.rs`

**Context — what the code looks like now:**

Lines 131-144 in `translate_batch()`:
```rust
// BEFORE THE LOOP — builds ONE glossary block for ALL entries
let glossary_terms = queries::get_glossary_for_translation(pool.inner(), &project_id, &target_lang)
    .await
    .unwrap_or_default();
let term_pairs: Vec<(String, String)> = glossary_terms
    .into_iter()
    .map(|t| (t.source_term, t.target_term))
    .collect();
let glossary_block = format_glossary_block(&term_pairs);
let system_prompt = if glossary_block.is_empty() {
    system_prompt
} else {
    format!("{}{}", glossary_block, system_prompt)
};
```

Lines 190-198 clone variables before `join_set.spawn(async move { ... })`:
```rust
let pool = pool_inner.clone();
let cancel = cancel.clone();
let window = window.clone();
let model = model.clone();
let system_prompt = system_prompt.clone();  // ← line 194
let target_lang = target_lang.clone();
let ollama_host = ollama_host.clone();
let done_count = done_count.clone();
```

Inside the spawn closure, `system_prompt` is used in TWO places:
- Line 222: initial prompt — `format!("{}\n\nTranslate from Japanese to {}: {}", system_prompt, lang_name, simplified)`
- Line 247: retry prompt — `format!("{}\n\nTranslate from Japanese to {} (RETRY ...): {}", system_prompt, lang_name, simplified)`

**What to change:**

- [ ] **Step 1: Refactor the pre-loop glossary block**

Replace lines 131-144 with: keep `term_pairs` but remove the pre-built `glossary_block` and `system_prompt` override:

```rust
// Fetch glossary once — filtering happens per-entry inside the loop
let glossary_terms = queries::get_glossary_for_translation(pool.inner(), &project_id, &target_lang)
    .await
    .unwrap_or_default();
let term_pairs: Vec<(String, String)> = glossary_terms
    .into_iter()
    .map(|t| (t.source_term, t.target_term))
    .collect();
// NOTE: glossary_block is no longer built here — it is filtered per-entry inside the spawn closure
```

- [ ] **Step 2: Add `term_pairs` to the pre-spawn clone block**

After line 194 (`let system_prompt = system_prompt.clone();`), add:

```rust
let term_pairs = term_pairs.clone();
```

- [ ] **Step 3: Filter glossary per-entry inside the spawn closure**

Inside `join_set.spawn(async move { ... })`, after the `ph_map` / `marker_count` block (around line 213), add:

```rust
// Per-entry glossary: only terms present in this source text
let entry_glossary = filter_glossary_for_text(&entry.source_text, &term_pairs);
let gb = format_glossary_block(&entry_glossary);
// Shadow system_prompt to prepend the per-entry glossary block (if any)
let system_prompt = if gb.is_empty() {
    system_prompt
} else {
    format!("{}{}", gb, system_prompt)
};
```

This shadowing means both the initial prompt (line 222) and the retry prompt (line 247) automatically use the per-entry filtered version — no other changes needed in those lines.

- [ ] **Step 4: Remove `.take(20)` from `format_glossary_block()`**

Since filtering now limits terms to those actually present in the entry (typically 0-5 for any single sentence), the hardcoded cap is no longer needed.

In `format_glossary_block()`, delete the `.take(20)` line:

```rust
// Before:
let lines: Vec<String> = terms
    .iter()
    .take(20)
    .map(|(src, tgt)| format!("- {} → {}", src, tgt))
    .collect();

// After:
let lines: Vec<String> = terms
    .iter()
    .map(|(src, tgt)| format!("- {} → {}", src, tgt))
    .collect();
```

- [ ] **Step 5: Build and run all tests**

```bash
cd src-tauri && cargo build 2>&1 | grep "^error"
cd src-tauri && cargo test 2>&1 | tail -5
```
Expected: 0 build errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/ollama.rs
git commit -m "feat(glossary): filter glossary terms per-entry by presence in source text

Only terms whose source_term appears literally in the entry's source text
are sent to the model. Fetch remains once per batch; filtering is O(n) per entry."
```
