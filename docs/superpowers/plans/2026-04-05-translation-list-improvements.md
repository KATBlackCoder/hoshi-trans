# Translation List Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the translation list with click-to-edit, file filter dropdown, grouped file view, and per-file progress stats.

**Architecture:** Three independent frontend improvements (Tasks 1 & 2 are pure React, Task 3 adds one Rust query + command + new React component). All changes are confined to `TranslationView`, `TranslationRow`, and a new `FileStatsPanel` component, plus one new Rust query.

**Tech Stack:** React 19, TypeScript strict, Tailwind + shadcn/ui, TanStack Query, Rust/sqlx, Tauri commands.

---

## Chunk 1: Click-to-Edit + File Filter

### Task 1: Click-to-edit — inline edit by clicking translation text

Currently the user must hover to reveal a tiny pencil icon, then click it. This task makes the translation text itself clickable to enter edit mode directly.

**Files:**
- Modify: `src/features/translation/TranslationRow.tsx`

**Context:** `TranslationRow` already has `editing` state and a `<Textarea>` — it's just gated behind the pencil button. The change is: make the translation text `<div>` trigger `setEditing(true)` on click.

- [ ] **Step 1: Make the display text clickable**

In `TranslationRow.tsx`, find the display block (line ~194):

```tsx
) : (
  <div className="text-xs leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground/70 font-mono">
```

Replace it with:

```tsx
) : (
  <div
    className="text-xs leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground/70 font-mono cursor-text hover:text-foreground/90 transition-colors"
    onClick={() => setEditing(true)}
    title="Click to edit"
  >
```

- [ ] **Step 2: Sync draft when entry updates externally (batch translation)**

The `draft` state is initialized once: `useState(entry.translation ?? '')`.  
When a batch completes and the virtualizer gives the component a new `entry` prop, `useState` does NOT re-run — draft is stale.

Add a `useEffect` after the existing `useState` declarations:

```tsx
// Keep the existing init (used for first mount):
const [draft, setDraft] = useState(entry.translation ?? '')

// Add this — syncs draft whenever the entry changes outside of editing:
useEffect(() => {
  if (!editing) {
    const text = entry.refined_text && entry.refined_status !== 'unchanged'
      ? entry.refined_text
      : (entry.translation ?? '')
    setDraft(text)
  }
}, [entry.translation, entry.refined_text, entry.refined_status, editing])
```

Also update `discard()` to compute from current entry props:

```tsx
function discard() {
  const text = entry.refined_text && entry.refined_status !== 'unchanged'
    ? entry.refined_text
    : (entry.translation ?? '')
  setDraft(text)
  setEditing(false)
}
```

And add `useEffect` to the imports at the top:

```tsx
import { useState, useEffect } from 'react'
```

- [ ] **Step 3: Update save() to use update_refined_manual for refined entries**

Currently `save()` always calls `update_translation`. But if the entry has a refined text, the user is editing the refined layer. Use `update_refined_manual` when a refined text exists.

```tsx
async function save() {
  if (entry.refined_text && entry.refined_status !== 'unchanged') {
    await invoke('update_refined_manual', { entryId: entry.id, refinedText: draft })
  } else {
    await invoke('update_translation', { entryId: entry.id, translation: draft })
  }
  setEditing(false)
  onUpdated()
}
```

- [ ] **Step 4: Verify manually**

```
pnpm tauri:linux
```

1. Open a project, find a translated entry
2. Click directly on the translation text → textarea opens
3. Edit text → Save → text updates
4. Click again → textarea re-opens with new text
5. Pencil button still works as before

- [ ] **Step 5: Commit**

```bash
git add src/features/translation/TranslationRow.tsx
git commit -m "feat(translation): click translation text to edit inline"
```

---

### Task 2: File filter dropdown in toolbar

The backend already supports `file_filter` param in `get_entries` (it's passed as `null` currently). This task adds a dropdown populated from the unique file paths of the loaded entries.

**Files:**
- Modify: `src/features/translation/TranslationView.tsx`

**Context:** `entries` array already contains all `file_path` values. We derive unique paths from it, add a `fileFilter` state, add a `<Select>` in the toolbar, and pass the filter to the query.

- [ ] **Step 1: Add fileFilter state and query unique file paths**

In `TranslationView.tsx`, after the existing `useState` declarations (around line 70):

```tsx
const [fileFilter, setFileFilter] = useState<string | undefined>()
```

**Do NOT** derive `uniqueFiles` from the `entries` query — that query is filtered by `statusFilter`, so files with no matching status would disappear from the dropdown. Instead, add a separate lightweight query that always fetches all file paths regardless of filters:

```tsx
const { data: uniqueFiles = [] } = useQuery({
  queryKey: ['file_paths', projectId],
  queryFn: () =>
    invoke<TranslationEntry[]>('get_entries', {
      projectId,
      statusFilter: null,
      fileFilter: null,
    }).then(all => [...new Set(all.map(e => e.file_path))].sort()),
  staleTime: 30_000,
})
```

- [ ] **Step 2: Pass fileFilter to the query**

Update the `useQuery` call (lines 91-99):

```tsx
const { data: entries = [], refetch } = useQuery({
  queryKey: ['entries', projectId, statusFilter, fileFilter],
  queryFn: () =>
    invoke<TranslationEntry[]>('get_entries', {
      projectId,
      statusFilter: statusFilter ?? null,
      fileFilter: fileFilter ?? null,
    }),
})
```

- [ ] **Step 3: Add file filter Select in toolbar**

In the toolbar `<div>` (around line 354, after the status filter buttons), add before the `<div className="flex-1" />`:

```tsx
{uniqueFiles.length > 1 && (
  <Select value={fileFilter ?? '__all__'} onValueChange={v => setFileFilter(v === '__all__' ? undefined : v)}>
    <SelectTrigger className="h-7 w-48 text-xs font-mono border-border/40">
      <SelectValue placeholder="All files" />
    </SelectTrigger>
    <SelectContent className="max-w-none w-auto min-w-(--radix-select-trigger-width) max-h-64">
      <SelectItem value="__all__" className="text-xs font-mono">All files</SelectItem>
      {uniqueFiles.map(f => {
        const short = f.split('/').pop() ?? f
        return (
          <SelectItem key={f} value={f} className="text-xs font-mono" title={f}>
            {short}
          </SelectItem>
        )
      })}
    </SelectContent>
  </Select>
)}
```

- [ ] **Step 4: Clear fileFilter when statusFilter changes (reset cross-filters)**

Add a `useEffect`:

```tsx
useEffect(() => {
  setFileFilter(undefined)
}, [projectId])
```

- [ ] **Step 5: Show active file filter badge in header stats**

In the header stats row (around line 213), add after the existing `{search && ...}` block:

```tsx
{fileFilter && (
  <>
    <span className="opacity-30">·</span>
    <span className="text-primary/70 font-mono truncate max-w-24">
      {fileFilter.split('/').pop()}
    </span>
    <button onClick={() => setFileFilter(undefined)} className="text-muted-foreground/40 hover:text-foreground">
      <X className="w-2.5 h-2.5" />
    </button>
  </>
)}
```

- [ ] **Step 6: Verify manually**

1. Open project with multiple files (e.g. Wolf RPG common/ files)
2. File dropdown appears — select one file → list filters to that file
3. "All files" resets the filter
4. Status filter + file filter combine correctly
5. Header shows active file name with × to clear

- [ ] **Step 7: Commit**

```bash
git add src/features/translation/TranslationView.tsx
git commit -m "feat(translation): add file filter dropdown to toolbar"
```

---

## Chunk 2: Per-file stats view

### Task 3: Backend — get_file_stats query + command

A new Tauri command `get_file_stats` returns per-file entry counts grouped by status, used to render the file overview panel.

**Files:**
- Modify: `src-tauri/src/db/queries.rs` — add `get_file_stats` query
- Modify: `src-tauri/src/models.rs` — add `FileStats` struct
- Modify: `src-tauri/src/commands/entries.rs` — add `get_file_stats` command
- Modify: `src-tauri/src/lib.rs` — register command
- Modify: `src/types/index.ts` — add `FileStats` type

**Context:** The SQL groups `entries` by `file_path` and counts status buckets. `translated` includes both `'translated'` and `'reviewed'`; `warning` is `LIKE 'warning%'`; the rest is `pending`.

- [ ] **Step 1: Add FileStats struct to models.rs**

Open `src-tauri/src/models.rs`, add after the existing structs:

```rust
#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct FileStats {
    pub file_path: String,
    pub total: i64,
    pub translated: i64,
    pub warning: i64,
    pub pending: i64,
}
```

- [ ] **Step 2: Write the failing test in queries.rs**

At the bottom of `src-tauri/src/db/queries.rs` test module, add:

```rust
#[tokio::test]
async fn test_get_file_stats() {
    let dir = tempfile::tempdir().unwrap();
    let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();
    create_project(&pool, "p1", "/g", "rpgmaker_mv_mz", "T", "en", None).await.unwrap();
    sqlx::query(
        "INSERT INTO entries (id, project_id, source_text, status, file_path, order_index) VALUES
         ('e1','p1','A','translated','data/Map001.json',0),
         ('e2','p1','B','pending','data/Map001.json',1),
         ('e3','p1','C','warning:missing_placeholder:1/2','data/Actors.json',0),
         ('e4','p1','D','translated','data/Actors.json',1)"
    ).execute(&pool).await.unwrap();

    let stats = get_file_stats(&pool, "p1").await.unwrap();
    assert_eq!(stats.len(), 2);

    let map001 = stats.iter().find(|s| s.file_path == "data/Map001.json").unwrap();
    assert_eq!(map001.total, 2);
    assert_eq!(map001.translated, 1);
    assert_eq!(map001.warning, 0);
    assert_eq!(map001.pending, 1);

    let actors = stats.iter().find(|s| s.file_path == "data/Actors.json").unwrap();
    assert_eq!(actors.total, 2);
    assert_eq!(actors.translated, 1);
    assert_eq!(actors.warning, 1);
    assert_eq!(actors.pending, 0);
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd src-tauri && cargo test test_get_file_stats -- --nocapture 2>&1 | tail -20
```

Expected: compile error — `get_file_stats` not found.

- [ ] **Step 4: Implement get_file_stats in queries.rs**

After the `get_entries` function, add:

```rust
pub async fn get_file_stats(
    pool: &SqlitePool,
    project_id: &str,
) -> anyhow::Result<Vec<crate::models::FileStats>> {
    let rows: Vec<crate::models::FileStats> = sqlx::query_as(
        "SELECT
           file_path,
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'translated' OR status = 'reviewed' THEN 1 ELSE 0 END) AS translated,
           SUM(CASE WHEN status LIKE 'warning%' THEN 1 ELSE 0 END) AS warning,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
         FROM entries
         WHERE project_id = ?
         GROUP BY file_path
         ORDER BY file_path",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd src-tauri && cargo test test_get_file_stats -- --nocapture 2>&1 | tail -10
```

Expected: `test test_get_file_stats ... ok`

- [ ] **Step 6: Add Tauri command in entries.rs**

```rust
#[tauri::command]
pub async fn get_file_stats(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
) -> Result<Vec<crate::models::FileStats>, String> {
    crate::db::queries::get_file_stats(pool.inner(), &project_id)
        .await
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 7: Register command in lib.rs**

Find the `.invoke_handler(tauri::generate_handler![` call and add `commands::entries::get_file_stats`:

```rust
// In the generate_handler! list, add:
commands::entries::get_file_stats,
```

- [ ] **Step 8: cargo check**

```bash
cd src-tauri && cargo check 2>&1 | grep -E "^error" | head -10
```

Expected: no errors.

- [ ] **Step 9: Add FileStats type to src/types/index.ts**

```typescript
export interface FileStats {
  file_path: string
  total: number
  translated: number
  warning: number
  pending: number
}
```

- [ ] **Step 10: Commit**

```bash
git add src-tauri/src/db/queries.rs src-tauri/src/models.rs src-tauri/src/commands/entries.rs src-tauri/src/lib.rs src/types/index.ts
git commit -m "feat(entries): add get_file_stats command with per-file status counts"
```

---

### Task 4: Frontend — FileStatsPanel component + view toggle

A new `FileStatsPanel` component shows each file as a row with a progress bar and status counts. A toggle in the toolbar switches between the normal list view and this file overview.

**Files:**
- Create: `src/features/translation/FileStatsPanel.tsx`
- Modify: `src/features/translation/TranslationView.tsx`

- [ ] **Step 1: Create FileStatsPanel.tsx**

```tsx
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import type { FileStats } from '@/types'

interface Props {
  projectId: string
  onFileClick: (filePath: string) => void
}

export function FileStatsPanel({ projectId, onFileClick }: Props) {
  const { data: files = [] } = useQuery({
    queryKey: ['file_stats', projectId],
    queryFn: () => invoke<FileStats[]>('get_file_stats', { projectId }),
  })

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground/50">
        No files extracted yet
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
      {files.map(f => {
        const short = f.file_path.split('/').pop() ?? f.file_path
        const translatedPct = f.total > 0 ? Math.round(((f.translated + f.warning) / f.total) * 100) : 0
        const donePct = f.total > 0 ? Math.round((f.translated / f.total) * 100) : 0

        return (
          <button
            key={f.file_path}
            onClick={() => onFileClick(f.file_path)}
            className="w-full text-left px-3 py-2.5 rounded-md hover:bg-white/4 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono text-foreground/80 group-hover:text-foreground truncate max-w-[60%]" title={f.file_path}>
                {short}
              </span>
              <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono">
                {f.warning > 0 && (
                  <span className="text-amber-400/70">{f.warning}⚠</span>
                )}
                {f.pending > 0 && (
                  <span className="text-muted-foreground/50">{f.pending} pending</span>
                )}
                <span className="text-muted-foreground/40">{f.translated}/{f.total}</span>
                <span className={`font-semibold tabular-nums ${donePct === 100 ? 'text-emerald-400' : 'text-foreground/60'}`}>
                  {donePct}%
                </span>
              </div>
            </div>
            {/* Progress bar: green = translated, amber = warning, rest = pending */}
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500/60 transition-all"
                style={{ width: `${donePct}%` }}
              />
              {f.warning > 0 && (
                <div
                  className="h-full bg-amber-400/50 transition-all"
                  style={{ width: `${translatedPct - donePct}%` }}
                />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Add view toggle state and import in TranslationView.tsx**

Add import:
```tsx
import { FileStatsPanel } from './FileStatsPanel'
import { LayoutList, BarChart2 } from 'lucide-react'
```

Add state after other `useState` calls:
```tsx
const [viewMode, setViewMode] = useState<'list' | 'files'>('list')
```

- [ ] **Step 3: Add view toggle button to toolbar**

In the toolbar (around line 354, after the status filters and before `<div className="flex-1" />`):

```tsx
<div className="flex items-center border border-border/50 rounded-md overflow-hidden">
  <button
    onClick={() => setViewMode('list')}
    title="List view"
    className={`w-7 h-7 flex items-center justify-center transition-colors ${
      viewMode === 'list'
        ? 'bg-secondary text-secondary-foreground'
        : 'text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40'
    }`}
  >
    <LayoutList className="w-3.5 h-3.5" />
  </button>
  <button
    onClick={() => setViewMode('files')}
    title="Files view"
    className={`w-7 h-7 flex items-center justify-center transition-colors border-l border-border/40 ${
      viewMode === 'files'
        ? 'bg-secondary text-secondary-foreground'
        : 'text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40'
    }`}
  >
    <BarChart2 className="w-3.5 h-3.5" />
  </button>
</div>
```

- [ ] **Step 4: Handle file click from FileStatsPanel**

Add a handler that switches back to list view and sets the file filter:

```tsx
function handleFileClick(filePath: string) {
  setFileFilter(filePath)
  setViewMode('list')
}
```

- [ ] **Step 5: Conditionally render FileStatsPanel vs list**

In `TranslationView.tsx` at line 439, find this block:

```tsx
      {/* Virtualized table */}
      {filtered.length === 0 ? (
```

Replace the entire block from that comment to the closing `)}` before the progress bar (line ~504) with:

```tsx
      {/* Virtualized table / file stats */}
      {viewMode === 'files' ? (
        <FileStatsPanel projectId={projectId} onFileClick={handleFileClick} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
          <p className="text-sm font-medium">{search ? 'No results' : 'No entries'}</p>
          <p className="text-xs text-muted-foreground">
            {search ? `Nothing matched "${search}"` : 'Run extraction to populate this list'}
          </p>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <Table style={{ display: 'grid' }}>
            <TableHeader style={{ display: 'grid', position: 'sticky', top: 0, zIndex: 10 }} className="bg-muted/50 backdrop-blur-sm">
              <TableRow style={{ display: 'flex' }} className="border-b border-border hover:bg-transparent">
                <TableHead style={{ width: '50%' }} className="px-6 py-2">
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleSort('order')} className="flex items-center text-xs font-medium hover:text-foreground transition-colors">
                      Original (JP)
                      <SortIcon col="order" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                    <button onClick={() => handleSort('file')} className={`flex items-center text-xs transition-colors ${sortKey === 'file' ? 'text-primary font-medium' : 'text-muted-foreground/60 hover:text-muted-foreground'}`}>
                      by file
                      <SortIcon col="file" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </div>
                </TableHead>
                <TableHead style={{ width: '50%' }} className="px-6 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium">Translation</span>
                    <button onClick={() => handleSort('status')} className={`flex items-center text-xs transition-colors ${sortKey === 'status' ? 'text-primary font-medium' : 'text-muted-foreground/60 hover:text-muted-foreground'}`}>
                      by status
                      <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody style={{ display: 'grid', height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map(virtualRow => {
                const entry = filtered[virtualRow.index]
                return (
                  <TranslationRow
                    key={entry.id}
                    entry={entry}
                    onUpdated={refetch}
                    data-index={virtualRow.index}
                    measureRef={virtualizer.measureElement}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                    selected={selectedIds.has(entry.id)}
                    onToggleSelect={() => toggleSelect(entry.id)}
                    selectionActive={selectedIds.size > 0}
                    onTranslateSingle={() => handleTranslateSingle(entry)}
                    translating={translatingRowId === entry.id}
                    onRefineSingle={() => handleRefineSingle(entry)}
                    refining={refiningRowId === entry.id}
                  />
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
```

- [ ] **Step 6: TypeScript check**

```bash
pnpm build 2>&1 | grep -E "error TS" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 7: Verify manually**

```
pnpm tauri:linux
```

1. Open a project with multiple files
2. Click the `BarChart2` (files) toggle → file list appears
3. Each file row shows name, counts, progress bar
4. Click a file row → switches back to list view filtered to that file
5. Click `LayoutList` toggle → returns to full list
6. After batch translation completes, switch to files view → counts update

- [ ] **Step 8: Commit**

```bash
git add src/features/translation/FileStatsPanel.tsx src/features/translation/TranslationView.tsx
git commit -m "feat(translation): add file stats panel with per-file progress view"
```
