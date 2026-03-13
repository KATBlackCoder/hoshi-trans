# Translation UI + Ollama Batch Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Translation list view with filters, manual editing, "Translate all" batch via Ollama with real-time progress bar, clean cancellation, and per-entry retry.

**Architecture:** Rust `translate_batch` calls Ollama sequentially, emits `translation:progress` events, and checks an `Arc<AtomicBool>` cancel flag before each entry. React `useTranslationBatch` listens to the event stream and updates the UI. All DB reads/writes go through Tauri commands.

**Tech Stack:** React 19, TanStack Query, Zustand, ollama-rs, tokio, Arc<AtomicBool>

---

## No New Packages

- Rust: tokio + ollama-rs already added in STEP-02
- Frontend: zustand + @tanstack/react-query already added in STEP-02

---

## File Structure

- Create: `src/types/index.ts` — TypeScript mirror types for all Rust structs
- Create: `src/features/translation/TranslationView.tsx` — main list view
- Create: `src/features/translation/TranslationRow.tsx` — single entry (source | translation | status)
- Create: `src/features/translation/TranslationFilters.tsx` — filter by file_path and status
- Create: `src/features/translation/index.ts` — re-export
- Create: `src/hooks/useTranslationBatch.ts` — invoke translate_batch + listen to progress events
- Create: `src-tauri/src/commands/entries.rs` — get_entries, update_translation, update_status
- Modify: `src-tauri/src/commands/ollama.rs` — add translate_batch, cancel_batch
- Modify: `src-tauri/src/db/queries.rs` — add entry queries
- Modify: `src-tauri/src/main.rs` — manage Arc<AtomicBool> cancel flag
- Modify: `src-tauri/src/lib.rs` — register new commands

---

## Task 1: TypeScript Mirror Types

**Files:**
- Create: `src/types/index.ts`

- [x] **Step 1: Write types matching Rust structs exactly**

```ts
// src/types/index.ts

// Mirror of TranslationEntry (Rust) — status stored as string from DB
export interface TranslationEntry {
  id: string
  project_id: string
  source_text: string
  translation: string | null
  status: TranslationStatus
  context: string | null
  file_path: string
  order_index: number
}

// Mirror of TranslationStatus Rust enum — serde rename_all = "snake_case"
// Error/Warning variants serialize as { error: string } / { warning: string }
export type TranslationStatus =
  | 'pending'
  | 'translated'
  | 'reviewed'
  | 'skipped'
  | { error: string }
  | { warning: string }

// Payload of the "translation:progress" Tauri event
export interface TranslationProgress {
  done: number
  total: number
  entry_id: string
}

// Mirror of ProjectFile (Rust)
export interface ProjectFile {
  version: string
  project_id: string
  created_at: number
  updated_at: number
  game_dir: string
  engine: 'rpgmaker_mv_mz' | 'wolf_rpg' | 'bakin'
  game_title: string
  target_lang: string
  stats: ProjectStats
  last_model: string | null
  output_dir: string
}

export interface ProjectStats {
  total: number
  translated: number
  reviewed: number
  skipped: number
  error: number
  pending: number
}
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `pnpm build`
Expected: No errors

- [x] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript mirror types for Rust structs"
```

---

## Task 2: Entry DB Queries

**Files:**
- Modify: `src-tauri/src/db/queries.rs`

- [x] **Step 1: Write failing test**

```rust
#[tokio::test]
async fn test_get_entries_filtered_by_status() {
    let dir = tempfile::tempdir().unwrap();
    let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();
    create_project(&pool, "p1", "/g", "rpgmaker_mv_mz", "T", "en", None).await.unwrap();

    // Insert two entries: one pending, one translated
    sqlx::query!(
        "INSERT INTO entries (id, project_id, source_text, status, file_path, order_index) VALUES ('e1','p1','こんにちは','pending','f',0)"
    ).execute(&pool).await.unwrap();
    sqlx::query!(
        "INSERT INTO entries (id, project_id, source_text, status, file_path, order_index) VALUES ('e2','p1','ありがとう','translated','f',1)"
    ).execute(&pool).await.unwrap();

    let pending = get_entries(&pool, "p1", Some("pending"), None).await.unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].source_text, "こんにちは");
}
```

- [x] **Step 2: Run to verify fail**

Run: `cd src-tauri && cargo test test_get_entries_filtered`
Expected: FAIL

- [x] **Step 3: Implement entry queries**

```rust
// src-tauri/src/db/queries.rs — add

pub async fn get_entries(
    pool: &SqlitePool,
    project_id: &str,
    status_filter: Option<&str>,
    file_filter: Option<&str>,
) -> anyhow::Result<Vec<crate::models::TranslationEntry>> {
    // Build dynamic query
    let rows = sqlx::query_as!(
        crate::models::TranslationEntry,
        r#"SELECT id, project_id, source_text, translation, status, context, file_path, order_index
           FROM entries
           WHERE project_id = ?
           AND (? IS NULL OR status = ?)
           AND (? IS NULL OR file_path = ?)
           ORDER BY file_path, order_index"#,
        project_id,
        status_filter, status_filter,
        file_filter, file_filter,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn update_translation(
    pool: &SqlitePool,
    entry_id: &str,
    translation: &str,
    status: &str,
) -> anyhow::Result<()> {
    sqlx::query!(
        "UPDATE entries SET translation = ?, status = ? WHERE id = ?",
        translation, status, entry_id
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_status(
    pool: &SqlitePool,
    entry_id: &str,
    status: &str,
) -> anyhow::Result<()> {
    sqlx::query!(
        "UPDATE entries SET status = ? WHERE id = ?",
        status, entry_id
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_pending_entries(
    pool: &SqlitePool,
    project_id: &str,
) -> anyhow::Result<Vec<crate::models::TranslationEntry>> {
    get_entries(pool, project_id, Some("pending"), None).await
}
```

- [x] **Step 4: Run tests**

Run: `cd src-tauri && cargo test test_get_entries_filtered`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/db/queries.rs
git commit -m "feat: add get_entries, update_translation, update_status queries"
```

---

## Task 3: entries.rs Commands

**Files:**
- Create: `src-tauri/src/commands/entries.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [x] **Step 1: Write entries.rs**

```rust
// src-tauri/src/commands/entries.rs
use sqlx::SqlitePool;
use crate::db::queries;

#[tauri::command]
pub async fn get_entries(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
    status_filter: Option<String>,
    file_filter: Option<String>,
) -> Result<Vec<crate::models::TranslationEntry>, String> {
    queries::get_entries(
        &pool,
        &project_id,
        status_filter.as_deref(),
        file_filter.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_translation(
    pool: tauri::State<'_, SqlitePool>,
    entry_id: String,
    translation: String,
) -> Result<(), String> {
    queries::update_translation(&pool, &entry_id, &translation, "translated")
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_status(
    pool: tauri::State<'_, SqlitePool>,
    entry_id: String,
    status: String,
) -> Result<(), String> {
    queries::update_status(&pool, &entry_id, &status)
        .await
        .map_err(|e| e.to_string())
}
```

- [x] **Step 2: Add to mod.rs**

```rust
// commands/mod.rs
pub mod entries;
```

- [x] **Step 3: Register in lib.rs**

```rust
commands::entries::get_entries,
commands::entries::update_translation,
commands::entries::update_status,
```

- [x] **Step 4: Compile check**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/commands/entries.rs src-tauri/src/commands/mod.rs
git commit -m "feat: add get_entries, update_translation, update_status commands"
```

---

## Task 4: translate_batch + cancel_batch

**Files:**
- Modify: `src-tauri/src/commands/ollama.rs`
- Modify: `src-tauri/src/lib.rs` — add cancel flag state

- [x] **Step 1: Add cancel flag to lib.rs**

```rust
// lib.rs — in setup, after pool:
use std::sync::{Arc, atomic::AtomicBool};
app.manage(Arc::new(AtomicBool::new(false)));
```

- [x] **Step 2: Implement translate_batch and cancel_batch**

```rust
// src-tauri/src/commands/ollama.rs — add
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use sqlx::SqlitePool;
use ollama_rs::{Ollama, generation::completion::request::GenerationRequest};
use crate::db::queries;
use crate::engines::rpgmaker_mv_mz::placeholders;
use crate::engines::common::placeholders::check_placeholders_intact;

#[derive(serde::Serialize, Clone)]
pub struct TranslationProgress {
    pub done: u32,
    pub total: u32,
    pub entry_id: String,
}

#[tauri::command]
pub async fn cancel_batch(
    cancel_flag: tauri::State<'_, Arc<AtomicBool>>,
) -> Result<(), String> {
    cancel_flag.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn translate_batch(
    window: tauri::Window,
    pool: tauri::State<'_, SqlitePool>,
    cancel_flag: tauri::State<'_, Arc<AtomicBool>>,
    project_id: String,
    model: String,
    target_lang: String,
    system_prompt: String,
) -> Result<(), String> {
    // Reset cancel flag
    cancel_flag.store(false, Ordering::Relaxed);

    let entries = queries::get_pending_entries(&pool, &project_id)
        .await
        .map_err(|e| e.to_string())?;

    let total = entries.len() as u32;
    let ollama = Ollama::default();

    for (i, entry) in entries.iter().enumerate() {
        // Check cancellation before each entry
        if cancel_flag.load(Ordering::Relaxed) {
            break;
        }

        let prompt = format!(
            "{}\n\nTranslate to {}:\n{}",
            system_prompt, target_lang, entry.source_text
        );

        let request = GenerationRequest::new(model.clone(), prompt);
        match ollama.generate(request).await {
            Ok(response) => {
                let translated = response.response.trim().to_string();
                // Decode placeholders and check integrity
                let (decoded, intact) = placeholders::decode(&translated);
                let status = if intact { "translated" } else { "warning:missing_placeholder" };
                let _ = queries::update_translation(&pool, &entry.id, &decoded, status).await;
            }
            Err(e) => {
                let _ = queries::update_status(&pool, &entry.id, &format!("error:{}", e)).await;
            }
        }

        let _ = window.emit("translation:progress", TranslationProgress {
            done: (i + 1) as u32,
            total,
            entry_id: entry.id.clone(),
        });
    }

    Ok(())
}
```

- [x] **Step 3: Register new commands in lib.rs**

```rust
commands::ollama::translate_batch,
commands::ollama::cancel_batch,
```

- [x] **Step 4: Compile check**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/commands/ollama.rs src-tauri/src/lib.rs
git commit -m "feat: add translate_batch and cancel_batch with progress events"
```

---

## Task 5: useTranslationBatch Hook

**Files:**
- Create: `src/hooks/useTranslationBatch.ts`

- [x] **Step 1: Implement the hook**

```ts
// src/hooks/useTranslationBatch.ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useState, useCallback } from 'react'
import type { TranslationProgress } from '@/types'

export function useTranslationBatch() {
  const [progress, setProgress] = useState<TranslationProgress | null>(null)
  const [running, setRunning] = useState(false)

  const start = useCallback(async (
    projectId: string,
    model: string,
    targetLang: string,
    systemPrompt: string,
  ) => {
    setRunning(true)
    setProgress(null)

    const unlisten = await listen<TranslationProgress>(
      'translation:progress',
      (e) => setProgress(e.payload),
    )

    try {
      await invoke('translate_batch', {
        projectId,
        model,
        targetLang,
        systemPrompt,
      })
    } finally {
      unlisten()
      setRunning(false)
    }
  }, [])

  const cancel = useCallback(() => invoke('cancel_batch'), [])

  return { progress, running, start, cancel }
}
```

- [x] **Step 2: Verify TypeScript**

Run: `pnpm build`
Expected: No errors

- [x] **Step 3: Commit**

```bash
git add src/hooks/useTranslationBatch.ts
git commit -m "feat: add useTranslationBatch hook"
```

---

## Task 6: Translation UI Components

**Files:**
- Create: `src/features/translation/TranslationRow.tsx`
- Create: `src/features/translation/TranslationFilters.tsx`
- Create: `src/features/translation/TranslationView.tsx`
- Create: `src/features/translation/index.ts`

- [x] **Step 1: Install needed shadcn components**

```bash
pnpm dlx shadcn@latest add badge input progress select textarea
```

- [x] **Step 2: Write TranslationRow**

```tsx
// src/features/translation/TranslationRow.tsx
import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import type { TranslationEntry, TranslationStatus } from '@/types'

function statusBadge(status: TranslationStatus) {
  if (status === 'pending') return <Badge variant="outline">pending</Badge>
  if (status === 'translated') return <Badge variant="default">translated</Badge>
  if (status === 'reviewed') return <Badge className="bg-green-600">reviewed</Badge>
  if (status === 'skipped') return <Badge variant="secondary">skipped</Badge>
  if (typeof status === 'object' && 'error' in status)
    return <Badge variant="destructive">error</Badge>
  if (typeof status === 'object' && 'warning' in status)
    return <Badge className="bg-yellow-500">warning</Badge>
  return null
}

interface Props {
  entry: TranslationEntry
  onUpdated: () => void
}

export function TranslationRow({ entry, onUpdated }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.translation ?? '')

  async function save() {
    await invoke('update_translation', { entryId: entry.id, translation: draft })
    setEditing(false)
    onUpdated()
  }

  return (
    <div className="grid grid-cols-2 gap-2 border-b py-2 text-sm">
      <p className="text-muted-foreground whitespace-pre-wrap">{entry.source_text}</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {statusBadge(entry.status)}
          <button
            className="text-xs text-primary underline"
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'cancel' : 'edit'}
          </button>
        </div>
        {editing ? (
          <div className="flex flex-col gap-1">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
            />
            <button
              className="self-end text-xs text-primary underline"
              onClick={save}
            >
              save
            </button>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{entry.translation ?? '—'}</p>
        )}
      </div>
    </div>
  )
}
```

- [x] **Step 3: Write TranslationView**

```tsx
// src/features/translation/TranslationView.tsx
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { TranslationRow } from './TranslationRow'
import { useTranslationBatch } from '@/hooks/useTranslationBatch'
import { useAppStore } from '@/stores/appStore'
import type { TranslationEntry } from '@/types'

interface Props {
  projectId: string
}

export function TranslationView({ projectId }: Props) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const { availableModels } = useAppStore()
  const { progress, running, start, cancel } = useTranslationBatch()

  const { data: entries = [], refetch } = useQuery({
    queryKey: ['entries', projectId, statusFilter],
    queryFn: () =>
      invoke<TranslationEntry[]>('get_entries', {
        projectId,
        statusFilter: statusFilter ?? null,
        fileFilter: null,
      }),
  })

  const model = availableModels[0] ?? ''
  const progressPct = progress ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => start(projectId, model, 'en', 'Translate to English. Preserve all {{PLACEHOLDER}} tokens exactly.')}
          disabled={running || !model}
        >
          {running ? 'Translating…' : 'Translate all'}
        </Button>
        {running && (
          <>
            <Progress value={progressPct} className="w-48" />
            <span className="text-xs text-muted-foreground">
              {progress?.done}/{progress?.total}
            </span>
            <Button variant="outline" size="sm" onClick={cancel}>
              Cancel
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-col">
        <div className="grid grid-cols-2 gap-2 border-b pb-1 text-xs font-semibold text-muted-foreground">
          <span>Original (JP)</span>
          <span>Translation</span>
        </div>
        {entries.map((e) => (
          <TranslationRow key={e.id} entry={e} onUpdated={refetch} />
        ))}
      </div>
    </div>
  )
}
```

```ts
// src/features/translation/index.ts
export { TranslationView } from './TranslationView'
```

- [x] **Step 4: Add to App.tsx main area**

```tsx
// src/App.tsx — in MainLayout, update main area
import { TranslationView } from '@/features/translation'
// ... add projectId state and render TranslationView when a project is open
```

- [x] **Step 5: Test in app**

Run: `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev`
Expected:
- List of entries shown with source text and status badges
- "Translate all" triggers batch, progress bar updates in real-time
- Cancel button stops the batch
- Manual edit saves and shows "translated" badge

- [x] **Step 6: Commit**

```bash
git add src/features/translation/ src/App.tsx
git commit -m "feat: add translation list view with batch progress and manual editing"
```

---

## Implementation Notes

**Completed:** 2026-03-13 — commits `34f5e80`, `cdc9e29`, `dca16ea`

**Deviation — `sqlx::query!` macros:**
All DB queries use runtime `sqlx::query` / `sqlx::query_as` per CLAUDE.md rule (no live DB at compile time).

**Deviation — Task 6 Step 4 (manual test):**
Tested with real games `Cursed_Blessing_v2` (MV, 9163 entries) and `osana_isekai_v1.06` (MZ, 20795 entries).

**Extra — auto-extraction on open:**
`useProject.ts` calls `extract_strings` automatically after `open_project`. The button shows "Extracting…" with a spinner. `INSERT OR IGNORE` makes re-extraction safe.

**Extra — UI redesign (not in plan):**
- Dark mode forced by default
- Sidebar with logo, game info card
- TranslationView: sticky header with stats, filter tabs, inline progress bar
- TranslationRow: monospace source, hover edit button, Save/Discard
- OnboardingPage: card-based steps with icons
- `FileImportButton`: removed success message, spinner during extraction

**Tests:** 43/43 passing (`cargo test`, excluding slow integration tests)
