# Translation Quality Feedback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make translation quality improve automatically the more you use the app — by feeding manual corrections and model-reviewed entries back into the glossary, detecting inconsistent translations, and widening the dialogue context window.

**Architecture:** Four independent improvements: (1) context window 3→5 lines in Phase 2; (2) after any manual save (`update_refined_manual` or `update_translation`), auto-inject the corrected term into the project glossary if source ≤ 10 chars — both save paths are wired, the Tauri commands are frontend-only so batch translations are unaffected; (3) after `refine_batch` completes, bulk-inject all short `refined_status='reviewed'` entries into the project glossary; (4) new query + command to detect entries where the same `source_text` has multiple distinct translations, exposed as a filter badge in `TranslationView`.

**Tech Stack:** Rust/SQLx (`db/queries.rs`, `commands/entries.rs`, `commands/ollama.rs`, `lib.rs`), React/TypeScript (`TranslationView.tsx`, `types/index.ts`), TanStack Query.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src-tauri/src/db/queries.rs` | Modify | Add `maybe_feed_glossary_from_manual`, `get_reviewed_short_for_glossary`, `get_inconsistent_source_texts` |
| `src-tauri/src/commands/entries.rs` | Modify | Call `maybe_feed_glossary_from_manual` after manual save; add `get_inconsistent_source_texts` command |
| `src-tauri/src/commands/ollama.rs` | Modify | Context lines `3` → `5`; call `bulk_insert_auto_glossary` after refine batch drains |
| `src-tauri/src/lib.rs` | Modify | Register `get_inconsistent_source_texts` command |
| `src/features/translation/TranslationView.tsx` | Modify | Inconsistency badge + filter in toolbar |
| `src/types/index.ts` | No change | `string[]` suffices for the new command return type |

---

## Task 1: Context lines 3 → 5

**Files:**
- Modify: `src-tauri/src/commands/ollama.rs`

- [ ] **Step 1: Change the constant**

Find (line ≈356):
```rust
            let preceding = queries::get_preceding_translated(
                &pool_inner,
                &project_id,
                &entry.file_path,
                entry.order_index,
                3,
            )
```

Replace the `3` with `5`:
```rust
            let preceding = queries::get_preceding_translated(
                &pool_inner,
                &project_id,
                &entry.file_path,
                entry.order_index,
                5,
            )
```

- [ ] **Step 2: Run cargo check**

```bash
cd src-tauri && cargo check 2>&1 | grep "^error" | head -10
```

Expected: 0 errors.

- [ ] **Step 3: Run full test suite**

```bash
cd src-tauri && cargo test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/ollama.rs
git commit -m "feat(ollama): increase Phase 2 context window from 3 to 5 lines"
```

---

## Task 2: Manual corrections → glossary

When the user saves a manual correction (`update_refined_manual`), if the entry's `source_text` is ≤ 10 chars, auto-inject the corrected text into the project glossary. Uses `bulk_insert_auto_glossary` (INSERT OR IGNORE — safe to call repeatedly).

**Files:**
- Modify: `src-tauri/src/db/queries.rs`
- Modify: `src-tauri/src/commands/entries.rs`

- [ ] **Step 1: Write the failing test**

Add to the `context_glossary_tests` module at the bottom of `src-tauri/src/db/queries.rs`:

```rust
    #[tokio::test]
    async fn test_maybe_feed_glossary_short_source_inserts() {
        let pool = setup_test_db().await;
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index)
             VALUES ('e1', 'p1', '勇者', 'Brave', 'translated', 'items/armor.json', 0)",
        )
        .execute(&pool)
        .await
        .unwrap();

        maybe_feed_glossary_from_manual(&pool, "e1", "Hero").await.unwrap();

        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM glossary WHERE project_id = 'p1' AND source_term = '勇者' AND target_term = 'Hero'"
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count.0, 1);
    }

    #[tokio::test]
    async fn test_maybe_feed_glossary_long_source_skips() {
        let pool = setup_test_db().await;
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index)
             VALUES ('e1', 'p1', 'この技は強力だ', 'This skill is powerful', 'translated', 'items/skill.json', 0)",
        )
        .execute(&pool)
        .await
        .unwrap();

        maybe_feed_glossary_from_manual(&pool, "e1", "This skill is powerful").await.unwrap();

        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM glossary WHERE project_id = 'p1'"
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count.0, 0); // 7 chars — exceeds limit, not inserted
    }

    #[tokio::test]
    async fn test_maybe_feed_glossary_unknown_entry_is_noop() {
        let pool = setup_test_db().await;
        // Should not panic or error — entry simply doesn't exist
        maybe_feed_glossary_from_manual(&pool, "nonexistent", "Hero").await.unwrap();
    }
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src-tauri && cargo test test_maybe_feed_glossary 2>&1 | tail -10
```

Expected: FAIL with `cannot find function \`maybe_feed_glossary_from_manual\``.

- [ ] **Step 3: Implement `maybe_feed_glossary_from_manual`**

Add after `delete_glossary_terms` in `src-tauri/src/db/queries.rs`:

```rust
pub async fn maybe_feed_glossary_from_manual(
    pool: &SqlitePool,
    entry_id: &str,
    refined_text: &str,
) -> anyhow::Result<()> {
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT source_text, project_id FROM entries WHERE id = ?",
    )
    .bind(entry_id)
    .fetch_optional(pool)
    .await?;

    if let Some((source_text, project_id)) = row {
        if source_text.chars().count() <= 10 {
            bulk_insert_auto_glossary(
                pool,
                &project_id,
                &[(source_text, refined_text.to_string())],
            )
            .await?;
        }
    }
    Ok(())
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd src-tauri && cargo test test_maybe_feed_glossary 2>&1 | tail -10
```

Expected: 3 tests pass.

- [ ] **Step 5: Update `update_refined_manual` command to call the new query**

In `src-tauri/src/commands/entries.rs`, replace:

```rust
#[tauri::command]
pub async fn update_refined_manual(
    pool: tauri::State<'_, sqlx::SqlitePool>,
    entry_id: String,
    refined_text: String,
) -> Result<(), String> {
    crate::db::queries::update_refined_manual(pool.inner(), &entry_id, &refined_text)
        .await
        .map_err(|e| e.to_string())
}
```

With:

```rust
#[tauri::command]
pub async fn update_refined_manual(
    pool: tauri::State<'_, sqlx::SqlitePool>,
    entry_id: String,
    refined_text: String,
) -> Result<(), String> {
    crate::db::queries::update_refined_manual(pool.inner(), &entry_id, &refined_text)
        .await
        .map_err(|e| e.to_string())?;
    let _ = crate::db::queries::maybe_feed_glossary_from_manual(
        pool.inner(),
        &entry_id,
        &refined_text,
    )
    .await;
    Ok(())
}
```

- [ ] **Step 6: Update `update_translation` command to also call the new query**

`update_translation` is the save path for entries that have never been refined. The Tauri command is only called from the frontend (UI manual edits) — batch translations call `queries::update_translation` directly and are unaffected.

In `src-tauri/src/commands/entries.rs`, replace:

```rust
#[tauri::command]
pub async fn update_translation(
    pool: tauri::State<'_, SqlitePool>,
    entry_id: String,
    translation: String,
) -> Result<(), String> {
    queries::update_translation(pool.inner(), &entry_id, &translation, "translated", None, None)
        .await
        .map_err(|e| e.to_string())
}
```

With:

```rust
#[tauri::command]
pub async fn update_translation(
    pool: tauri::State<'_, SqlitePool>,
    entry_id: String,
    translation: String,
) -> Result<(), String> {
    queries::update_translation(pool.inner(), &entry_id, &translation, "translated", None, None)
        .await
        .map_err(|e| e.to_string())?;
    let _ = crate::db::queries::maybe_feed_glossary_from_manual(
        pool.inner(),
        &entry_id,
        &translation,
    )
    .await;
    Ok(())
}
```

- [ ] **Step 7: Run full test suite**

```bash
cd src-tauri && cargo test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/db/queries.rs src-tauri/src/commands/entries.rs
git commit -m "feat(glossary): feed manual corrections back to project glossary (≤10 chars)"
```

---

## Task 3: Reviewed entries → glossary after refine

After `refine_batch` drains, fetch all entries where `refined_status = 'reviewed'` and `source_text ≤ 10 chars`, then bulk-insert them into the project glossary. INSERT OR IGNORE — idempotent.

**Files:**
- Modify: `src-tauri/src/db/queries.rs`
- Modify: `src-tauri/src/commands/ollama.rs`

- [ ] **Step 1: Write the failing test**

Add to `context_glossary_tests` in `src-tauri/src/db/queries.rs`:

```rust
    #[tokio::test]
    async fn test_get_reviewed_short_returns_only_short_reviewed() {
        let pool = setup_test_db().await;
        // short + reviewed → should be included
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, refined_text, refined_status, status, file_path, order_index)
             VALUES ('e1', 'p1', '剣', 'Sword', 'Blade', 'reviewed', 'translated', 'items/weapons.json', 0)",
        )
        .execute(&pool).await.unwrap();
        // long + reviewed → excluded (11 chars)
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, refined_text, refined_status, status, file_path, order_index)
             VALUES ('e2', 'p1', 'この剣は強力だ', 'This sword is strong', 'This sword is powerful', 'reviewed', 'translated', 'mps/Map001.json', 1)",
        )
        .execute(&pool).await.unwrap();
        // short + unchanged → excluded
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, refined_text, refined_status, status, file_path, order_index)
             VALUES ('e3', 'p1', '盾', 'Shield', 'Shield', 'unchanged', 'translated', 'items/armor.json', 2)",
        )
        .execute(&pool).await.unwrap();

        let pairs = get_reviewed_short_for_glossary(&pool, "p1", 10).await.unwrap();
        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].0, "剣");
        assert_eq!(pairs[0].1, "Blade");
    }
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd src-tauri && cargo test test_get_reviewed_short 2>&1 | tail -10
```

Expected: FAIL with `cannot find function \`get_reviewed_short_for_glossary\``.

- [ ] **Step 3: Implement `get_reviewed_short_for_glossary`**

Add after `maybe_feed_glossary_from_manual` in `src-tauri/src/db/queries.rs`:

```rust
pub async fn get_reviewed_short_for_glossary(
    pool: &SqlitePool,
    project_id: &str,
    max_chars: usize,
) -> anyhow::Result<Vec<(String, String)>> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT source_text, refined_text FROM entries
         WHERE project_id = ? AND refined_status = 'reviewed'
           AND refined_text IS NOT NULL",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .filter(|(src, _)| src.chars().count() <= max_chars)
        .collect())
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd src-tauri && cargo test test_get_reviewed_short 2>&1 | tail -10
```

Expected: 1 test passes.

- [ ] **Step 5: Call it at the end of `refine_batch`**

In `src-tauri/src/commands/ollama.rs`, find the line after the join_set drains:

```rust
    while join_set.join_next().await.is_some() {}
```

Add immediately after:

```rust
    // Feed short reviewed entries back into project glossary
    if !cancel.load(Ordering::Relaxed) {
        if let Ok(terms) = queries::get_reviewed_short_for_glossary(&pool_inner, &project_id, 10).await {
            if !terms.is_empty() {
                let _ = queries::bulk_insert_auto_glossary(&pool_inner, &project_id, &terms).await;
            }
        }
    }
```

- [ ] **Step 6: Run full test suite**

```bash
cd src-tauri && cargo test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/db/queries.rs src-tauri/src/commands/ollama.rs
git commit -m "feat(glossary): auto-inject short reviewed entries into project glossary after refine"
```

---

## Task 4: Inconsistency detection + UI badge

Detect entries where the same `source_text` has multiple distinct translations in the same project. Expose as a filter badge in `TranslationView` — clicking it shows only the inconsistent entries.

**Files:**
- Modify: `src-tauri/src/db/queries.rs`
- Modify: `src-tauri/src/commands/entries.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/features/translation/TranslationView.tsx`

- [ ] **Step 1: Write the failing test**

Add to `context_glossary_tests` in `src-tauri/src/db/queries.rs`:

```rust
    #[tokio::test]
    async fn test_get_inconsistent_source_texts_detects_conflicts() {
        let pool = setup_test_db().await;
        // Same source_text, two different translations → inconsistent
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index)
             VALUES ('e1', 'p1', '魔法', 'Magic', 'translated', 'mps/Map001.json', 0)",
        )
        .execute(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index)
             VALUES ('e2', 'p1', '魔法', 'Spell', 'translated', 'mps/Map002.json', 0)",
        )
        .execute(&pool).await.unwrap();
        // Different source_text, consistent → not flagged
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index)
             VALUES ('e3', 'p1', '剣', 'Sword', 'translated', 'items/weapons.json', 0)",
        )
        .execute(&pool).await.unwrap();

        let result = get_inconsistent_source_texts(&pool, "p1").await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], "魔法");
    }

    #[tokio::test]
    async fn test_get_inconsistent_prefers_refined_text() {
        let pool = setup_test_db().await;
        // e1 has refined_text "Sorcery", e2 has translation "Magic" → two distinct values
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, refined_text, refined_status, status, file_path, order_index)
             VALUES ('e1', 'p1', '魔法', 'Magic', 'Sorcery', 'reviewed', 'translated', 'mps/Map001.json', 0)",
        )
        .execute(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index)
             VALUES ('e2', 'p1', '魔法', 'Magic', 'translated', 'mps/Map002.json', 0)",
        )
        .execute(&pool).await.unwrap();

        let result = get_inconsistent_source_texts(&pool, "p1").await.unwrap();
        assert_eq!(result.len(), 1); // "Sorcery" vs "Magic" → inconsistent
    }

    #[tokio::test]
    async fn test_get_inconsistent_returns_empty_when_consistent() {
        let pool = setup_test_db().await;
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index)
             VALUES ('e1', 'p1', '魔法', 'Magic', 'translated', 'mps/Map001.json', 0)",
        )
        .execute(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO entries (id, project_id, source_text, translation, status, file_path, order_index)
             VALUES ('e2', 'p1', '魔法', 'Magic', 'translated', 'mps/Map002.json', 1)",
        )
        .execute(&pool).await.unwrap();

        let result = get_inconsistent_source_texts(&pool, "p1").await.unwrap();
        assert!(result.is_empty());
    }
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src-tauri && cargo test test_get_inconsistent 2>&1 | tail -10
```

Expected: FAIL with `cannot find function \`get_inconsistent_source_texts\``.

- [ ] **Step 3: Implement `get_inconsistent_source_texts`**

Add after `get_reviewed_short_for_glossary` in `src-tauri/src/db/queries.rs`:

```rust
pub async fn get_inconsistent_source_texts(
    pool: &SqlitePool,
    project_id: &str,
) -> anyhow::Result<Vec<String>> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT source_text
         FROM entries
         WHERE project_id = ?
           AND (status = 'translated' OR status LIKE 'warning%')
           AND translation IS NOT NULL
         GROUP BY source_text
         HAVING COUNT(DISTINCT COALESCE(refined_text, translation)) > 1
         ORDER BY source_text",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|(s,)| s).collect())
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd src-tauri && cargo test test_get_inconsistent 2>&1 | tail -10
```

Expected: 3 tests pass.

- [ ] **Step 5: Add the Tauri command**

In `src-tauri/src/commands/entries.rs`, add at the end of the file:

```rust
#[tauri::command]
pub async fn get_inconsistent_source_texts(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
) -> Result<Vec<String>, String> {
    crate::db::queries::get_inconsistent_source_texts(pool.inner(), &project_id)
        .await
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 6: Register the command in `lib.rs`**

In `src-tauri/src/lib.rs`, add to the `.invoke_handler` list:

```rust
            commands::entries::get_inconsistent_source_texts,
```

- [ ] **Step 7: Run cargo check**

```bash
cd src-tauri && cargo check 2>&1 | grep "^error" | head -10
```

Expected: 0 errors.

- [ ] **Step 8: Add the query and badge to `TranslationView.tsx`**

In `src/features/translation/TranslationView.tsx`, add the query after the `uniqueFiles` query (around line 94):

```tsx
  const { data: inconsistentTexts = [] } = useQuery({
    queryKey: ['inconsistent', projectId],
    queryFn: () => invoke<string[]>('get_inconsistent_source_texts', { projectId }),
    enabled: !running && !refining,
  })
```

Add a new filter state after `const [search, setSearch] = useState('')`:

```tsx
  const [showInconsistent, setShowInconsistent] = useState(false)
```

Reset it when project changes — add to the existing `useEffect` at line ≈105:

```tsx
  useEffect(() => {
    setFileFilter(undefined)
    setShowInconsistent(false)
  }, [projectId])
```

Update `filtered` to respect the new filter — change the `useMemo` block:

```tsx
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let base = q
      ? entries.filter(
          e =>
            e.source_text.toLowerCase().includes(q) ||
            (e.translation ?? '').toLowerCase().includes(q) ||
            e.file_path.toLowerCase().includes(q),
        )
      : entries
    if (showInconsistent && inconsistentTexts.length > 0) {
      const set = new Set(inconsistentTexts)
      base = base.filter(e => set.has(e.source_text))
    }
    return sortEntries(base, sortKey, sortDir)
  }, [entries, search, sortKey, sortDir, showInconsistent, inconsistentTexts])
```

- [ ] **Step 9: Add the badge to the toolbar**

In the toolbar section (`<div className="flex items-center gap-3 px-5 py-1.5 ...`), add after the status filter buttons and before the file dropdown:

```tsx
        {inconsistentTexts.length > 0 && (
          <button
            onClick={() => setShowInconsistent(v => !v)}
            title={`${inconsistentTexts.length} source text(s) with inconsistent translations`}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              showInconsistent
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            {inconsistentTexts.length} inconsistent
          </button>
        )}
```

(`AlertTriangle` is already imported in `TranslationView.tsx`.)

- [ ] **Step 10: TypeScript build check**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

Expected: 0 errors from our changes (pre-existing `OllamaPage.tsx` TS6133 is acceptable).

- [ ] **Step 11: Commit**

```bash
git add src-tauri/src/db/queries.rs \
        src-tauri/src/commands/entries.rs \
        src-tauri/src/lib.rs \
        src/features/translation/TranslationView.tsx
git commit -m "feat(ui): detect inconsistent translations + badge filter in TranslationView"
```

---

## Task 5: Update docs

**Files:**
- Modify: `docs/CONTEXT.md`

- [ ] **Step 1: Update the Glossary UI section**

Dans `docs/CONTEXT.md`, section **Glossary UI**, ajouter après la ligne `glossary_global_usage` :

```
- **Feedback loop automatique** — deux chemins alimentent le glossaire projet automatiquement :
  - `update_refined_manual` et `update_translation` (Tauri commands) appellent `maybe_feed_glossary_from_manual` après save — si `source_text ≤ 10 chars`, le terme est injecté (`INSERT OR IGNORE`). Concerne uniquement les sauvegardes UI (les batchs appellent `queries::update_translation` directement, non affectés).
  - Fin de `refine_batch` : `get_reviewed_short_for_glossary` + `bulk_insert_auto_glossary` injecte les entrées courtes `refined_status='reviewed'`.
```

- [ ] **Step 2: Update the translate_batch section**

Dans `docs/CONTEXT.md`, section **Pipeline de traduction en deux phases**, mettre à jour la mention du context window :

Remplacer `get_preceding_translated` remonte jusqu'à **3** entrées par **5**.

- [ ] **Step 3: Update the Translation UI section**

Dans `docs/CONTEXT.md`, section **Translation UI redesign**, ajouter à la liste :

```
- **Badge inconsistances** — `get_inconsistent_source_texts(project_id)` détecte les `source_text` ayant plusieurs traductions distinctes (`COALESCE(refined_text, translation)`). Badge `⚠ N inconsistent` dans la toolbar de `TranslationView` ; cliquer filtre la table sur ces entrées via `showInconsistent` state + `inconsistentTexts` TanStack Query (désactivée pendant les batchs).
```

- [ ] **Step 4: Commit**

```bash
git add docs/CONTEXT.md
git commit -m "docs: document quality feedback loop — glossary auto-feed + inconsistency badge"
```

---

## Summary of commits

| # | Message |
|---|---------|
| 1 | `feat(ollama): increase Phase 2 context window from 3 to 5 lines` |
| 2 | `feat(glossary): feed manual corrections back to project glossary (≤10 chars)` |
| 3 | `feat(glossary): auto-inject short reviewed entries into project glossary after refine` |
| 4 | `feat(ui): detect inconsistent translations + badge filter in TranslationView` |
| 5 | `docs: document quality feedback loop — glossary auto-feed + inconsistency badge` |

## What does NOT change

- `refine_batch` concurrency — still uses its own semaphore, unchanged
- Global glossary — all injections target project glossary only
- `filter_glossary_for_text` matching logic — still literal `contains`, no fuzzy matching
