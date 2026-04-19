# Translation UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce visual noise in the translation view by extracting batch controls into a focused component, collapsing secondary options into a popover, and adding per-status row tinting.

**Architecture:** Extract `BatchControls` from `TranslationView` header into its own component. Collapse concurrency + limit selectors into a `<Popover>` triggered by a settings icon. Add subtle background tints to `TranslationRow` based on status. Clean up toolbar visual hierarchy with a separator between filter group and action group.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS, shadcn/ui (`Popover`, `PopoverTrigger`, `PopoverContent`), lucide-react, TanStack Query (no changes).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/features/translation/BatchControls.tsx` | **Create** | Translate + Refine controls, model selectors, progress display, concurrency/limit popover |
| `src/features/translation/TranslationView.tsx` | **Modify** | Remove inline batch controls, import `BatchControls`, fix toolbar separator |
| `src/features/translation/TranslationRow.tsx` | **Modify** | Add per-status background tint to row className |
| `src/App.css` | **Modify** | Add `status-row-warning`, `status-row-reviewed`, `status-row-pending` CSS classes |

---

## Chunk 1: BatchControls component

### Task 1: Create `BatchControls` component

**Files:**
- Create: `src/features/translation/BatchControls.tsx`

The component receives everything it needs as props — no internal state for batch/refine (that lives in `TranslationView`). It owns only the concurrency and limit state (local, not shared elsewhere).

**Interface:**

```tsx
interface BatchControlsProps {
  // Models
  availableModels: string[]
  model: string
  onModelChange: (m: string) => void
  refineModel: string
  onRefineModelChange: (m: string) => void

  // Translate batch
  running: boolean
  progress: { done: number; total: number } | null
  onStart: () => void
  onCancel: () => void
  selectedCount: number       // 0 = translate all pending

  // Refine batch
  refining: boolean
  refineProgress: { done: number; total: number } | null
  onRefine: () => void
  onCancelRefine: () => void

  // Concurrency + limit (lifted to TranslationView so handleStart can read them)
  concurrency: number
  onConcurrencyChange: (n: number) => void
  limit: number
  onLimitChange: (n: number) => void
}
```

- [ ] **Step 1: Install shadcn Popover if not already present**

```bash
pnpm dlx shadcn@latest add popover
```

Check `src/components/ui/popover.tsx` exists after. If already present, skip.

- [ ] **Step 2: Write `BatchControls.tsx`**

```tsx
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sparkles, Wand2, X, Loader2, Settings2 } from 'lucide-react'

const CONCURRENCY_OPTIONS = [1, 2, 4, 8]
const LIMIT_OPTIONS = [
  { label: '100', value: 100 },
  { label: '500', value: 500 },
  { label: '1000', value: 1000 },
  { label: 'All', value: 0 },
]

interface BatchControlsProps {
  availableModels: string[]
  model: string
  onModelChange: (m: string) => void
  refineModel: string
  onRefineModelChange: (m: string) => void
  running: boolean
  progress: { done: number; total: number } | null
  onStart: () => void
  onCancel: () => void
  selectedCount: number
  refining: boolean
  refineProgress: { done: number; total: number } | null
  onRefine: () => void
  onCancelRefine: () => void
  concurrency: number
  onConcurrencyChange: (n: number) => void
  limit: number
  onLimitChange: (n: number) => void
}

export function BatchControls({
  availableModels,
  model, onModelChange,
  refineModel, onRefineModelChange,
  running, progress, onStart, onCancel,
  selectedCount,
  refining, refineProgress, onRefine, onCancelRefine,
  concurrency, onConcurrencyChange,
  limit, onLimitChange,
}: BatchControlsProps) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">

      {/* ── TRANSLATE SECTION ── */}
      <div className="flex items-center gap-1 border border-border/40 rounded-md px-1.5 py-0.5">
        <span className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40 mr-0.5 select-none">
          TL
        </span>

        {/* Model selector */}
        <Select value={model} onValueChange={(v) => onModelChange(v ?? '')} disabled={running}>
          <SelectTrigger className="h-6 w-40 text-xs font-mono border-0 bg-transparent px-1 focus:ring-0">
            <SelectValue placeholder="No model" />
          </SelectTrigger>
          <SelectContent className="max-w-none w-auto min-w-(--radix-select-trigger-width)">
            {availableModels.map(m => (
              <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Settings popover — concurrency + limit */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-foreground"
              title="Batch settings"
              disabled={running}
            >
              <Settings2 className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-3 space-y-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Concurrency
              </p>
              <div className="flex items-center border border-border/50 rounded-md overflow-hidden">
                {CONCURRENCY_OPTIONS.map(n => (
                  <button key={n} onClick={() => onConcurrencyChange(n)}
                    className={`flex-1 h-7 text-[11px] font-mono transition-colors border-r border-border/40 last:border-r-0 ${
                      concurrency === n
                        ? 'bg-secondary text-secondary-foreground font-semibold'
                        : 'text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40'
                    }`}
                  >{n}×</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Limit
              </p>
              <div className="flex items-center border border-border/50 rounded-md overflow-hidden">
                {LIMIT_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => onLimitChange(o.value)}
                    title={o.value === 0 ? 'All pending' : `Next ${o.value}`}
                    className={`flex-1 h-7 text-[11px] font-mono transition-colors border-r border-border/40 last:border-r-0 ${
                      limit === o.value
                        ? 'bg-secondary text-secondary-foreground font-semibold'
                        : 'text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40'
                    }`}
                  >{o.label}</button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Progress + cancel OR translate button */}
        {running ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums min-w-[3rem] text-right">
              {progress?.done}<span className="opacity-40">/</span>{progress?.total}
            </span>
            <Button variant="ghost" size="sm" onClick={onCancel}
              className="h-6 px-2 text-xs text-muted-foreground/60 hover:text-destructive">
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={onStart}
            disabled={!model}
            className="h-6 gap-1 text-xs font-medium px-2.5"
          >
            <Sparkles className="w-3 h-3" />
            {selectedCount > 0 ? `Translate ${selectedCount}` : 'Translate'}
          </Button>
        )}
      </div>

      {/* ── REFINE SECTION ── */}
      <div className="flex items-center gap-1 border border-amber-500/20 rounded-md px-1.5 py-0.5">
        <span className="text-[9px] font-medium uppercase tracking-widest text-amber-500/40 mr-0.5 select-none">
          RF
        </span>

        {/* Refine model selector */}
        <Select value={refineModel} onValueChange={(v) => onRefineModelChange(v ?? '')} disabled={refining}>
          <SelectTrigger className="h-6 w-40 text-xs font-mono border-0 bg-transparent px-1 focus:ring-0">
            <SelectValue placeholder="No model" />
          </SelectTrigger>
          <SelectContent className="max-w-none w-auto min-w-(--radix-select-trigger-width)">
            {availableModels.map(m => (
              <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Progress + cancel OR refine button */}
        {refining ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums min-w-[3rem] text-right">
              {refineProgress?.done}<span className="opacity-40">/</span>{refineProgress?.total}
            </span>
            <Button variant="ghost" size="sm" onClick={onCancelRefine}
              className="h-6 px-2 text-xs text-muted-foreground/60 hover:text-destructive">
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onRefine}
            disabled={running || !refineModel}
            className="h-6 gap-1 text-xs font-medium px-2.5 border-amber-500/30 text-amber-400/80 hover:bg-amber-500/10"
          >
            {<Wand2 className="w-3 h-3" />}
            {selectedCount > 0 ? `Refine ${selectedCount}` : 'Refine'}
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles (no runtime needed)**

```bash
cd /home/blackat/project/hoshi-trans && pnpm build 2>&1 | head -40
```

Expected: no errors in `BatchControls.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/features/translation/BatchControls.tsx src/components/ui/popover.tsx
git commit -m "feat(translation): extract BatchControls component with settings popover"
```

---

### Task 2: Wire `BatchControls` into `TranslationView`

**Files:**
- Modify: `src/features/translation/TranslationView.tsx`

Changes:
1. Remove `CONCURRENCY_OPTIONS`, `LIMIT_OPTIONS` constants (moved to `BatchControls`)
2. Keep `concurrency`, `limit`, `selectedModel`, `selectedRefineModel` state (they're still needed as props for `BatchControls`)
3. Remove the entire inline batch controls `<div>` from the header
4. Import and render `<BatchControls .../>` in its place
5. Remove unused imports: `RotateCcw` (already done), verify `ShieldCheck` is gone

- [ ] **Step 1: Update imports in `TranslationView.tsx`**

Remove from the lucide import: `Sparkles`, `Wand2` (no longer used directly in this file — they're in `BatchControls`).

Add import:
```tsx
import { BatchControls } from './BatchControls'
```

Verify the full lucide import becomes:
```tsx
import { X, Loader2, Search, ChevronUp, ChevronDown, ChevronsUpDown, FolderOpen, AlertTriangle, LayoutList, BarChart2 } from 'lucide-react'
```

- [ ] **Step 2: Remove `CONCURRENCY_OPTIONS` and `LIMIT_OPTIONS` from `TranslationView.tsx`**

These are now defined inside `BatchControls`. Delete the two const arrays at the top of the file.

- [ ] **Step 3: Replace inline batch controls with `<BatchControls />`**

Find the `{/* Batch controls */}` div (lines ~243–365 of current file). Replace the entire `<div className="flex items-center gap-1.5 shrink-0">` block with:

```tsx
<BatchControls
  availableModels={availableModels}
  model={model}
  onModelChange={setSelectedModel}
  refineModel={refineModel}
  onRefineModelChange={setSelectedRefineModel}
  running={running}
  progress={progress}
  onStart={handleStart}
  onCancel={cancel}
  selectedCount={selectedIds.size}
  refining={refining}
  refineProgress={refineProgress}
  onRefine={handleRefine}
  onCancelRefine={cancelRefine}
  concurrency={concurrency}
  onConcurrencyChange={setConcurrency}
  limit={limit}
  onLimitChange={setLimit}
/>
```

- [ ] **Step 4: Remove `handleRetranslateWarnings` — it stays in toolbar, keep it**

Toolbar already has "Retry warnings" button that calls `handleRetranslateWarnings`. This stays untouched in `TranslationView`.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /home/blackat/project/hoshi-trans && pnpm build 2>&1 | head -40
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/translation/TranslationView.tsx
git commit -m "refactor(translation): replace inline batch controls with BatchControls component"
```

---

## Chunk 2: Toolbar separator + row tinting

### Task 3: Toolbar visual grouping

**Files:**
- Modify: `src/features/translation/TranslationView.tsx` (toolbar section only, lines ~388–514)

Add a thin vertical separator `<div>` between the filter group (status + file + view toggle) and the action group (retry warnings + export + search). This is a pure CSS change — no logic.

Separator element:
```tsx
<div className="w-px h-4 bg-border/40 shrink-0" />
```

Layout after change:
```
[All][Pending][Translated][Reviewed][Warning]  [file dropdown]  [list|files]  |  [retry ⚠]  [export]  [search]
```

- [ ] **Step 1: Add separator in toolbar**

In `TranslationView.tsx`, find the toolbar `<div className="flex items-center gap-3 px-5 py-1.5 ...">`.

After the view toggle buttons block (the `</div>` closing the `flex items-center border border-border/50 rounded-md` div for the list/files toggle), and before `<div className="flex-1" />`, add nothing — the spacer already acts as separator.

Actually: replace `<div className="flex-1" />` with a more explicit grouping:

```tsx
{/* Left: filters */}
{/* (status chips, file dropdown, view toggle already present — no change) */}

{/* Spacer */}
<div className="flex-1" />

{/* Separator */}
<div className="w-px h-4 bg-border/30 shrink-0" />

{/* Right: actions */}
```

Insert `<div className="w-px h-4 bg-border/30 shrink-0" />` immediately after `<div className="flex-1" />`.

- [ ] **Step 2: Commit**

```bash
git add src/features/translation/TranslationView.tsx
git commit -m "style(translation): add toolbar separator between filters and actions"
```

---

### Task 4: Per-status row background tinting

**Files:**
- Modify: `src/App.css`
- Modify: `src/features/translation/TranslationRow.tsx`

The current row has only a left border strip per status. Adding a very subtle background tint makes the status immediately readable at a glance without eye movement to the left edge.

Color choices (dark theme, extremely subtle):
- `warning` → amber tint: `oklch(0.78 0.16 65 / 3%)`
- `reviewed` → blue tint: `oklch(0.60 0.18 255 / 4%)`
- `pending` → no tint (default dark bg is fine)
- `translated` → no tint (neutral, most common)
- `error` → red tint: `oklch(0.62 0.22 22 / 3%)`

- [ ] **Step 1: Add CSS classes to `src/App.css`**

In the `.dark` block, after the existing `status-strip-*` rules (around line 141), add:

```css
  .status-row-warning  { background-color: oklch(0.78 0.16 65 / 3%); }
  .status-row-reviewed { background-color: oklch(0.60 0.18 255 / 4%); }
  .status-row-error    { background-color: oklch(0.62 0.22 22 / 3%); }
```

- [ ] **Step 2: Add `rowCls` to `getStatusMeta` return type in `TranslationRow.tsx`**

Update the return type and each branch of `getStatusMeta`:

```tsx
function getStatusMeta(status: TranslationStatus): {
  label: string; strip: string; dotCls: string; labelCls: string; rowCls: string
} {
  if (status === 'translated')
    return { label: 'translated', strip: 'status-strip-translated', dotCls: 'bg-emerald-500', labelCls: 'text-emerald-400', rowCls: '' }
  if (status === 'reviewed')
    return { label: 'reviewed', strip: 'status-strip-reviewed', dotCls: 'bg-blue-400', labelCls: 'text-blue-400', rowCls: 'status-row-reviewed' }
  if (status === 'skipped')
    return { label: 'skipped', strip: 'status-strip-skipped', dotCls: 'bg-muted-foreground/40', labelCls: 'text-muted-foreground/50', rowCls: '' }
  if (typeof status === 'string' && status.startsWith('warning')) {
    const ratio = parseWarningRatio(status)
    return { label: ratio ? `⚠ ${ratio}` : 'warning', strip: 'status-strip-warning', dotCls: 'bg-amber-400', labelCls: 'text-amber-400', rowCls: 'status-row-warning' }
  }
  if (typeof status === 'object' && 'error' in status)
    return { label: 'error', strip: 'status-strip-error', dotCls: 'bg-red-500', labelCls: 'text-red-400', rowCls: 'status-row-error' }
  if (typeof status === 'object' && 'warning' in status)
    return { label: 'warning', strip: 'status-strip-warning', dotCls: 'bg-amber-400', labelCls: 'text-amber-400', rowCls: 'status-row-warning' }
  return { label: 'pending', strip: 'status-strip-pending', dotCls: 'bg-muted-foreground/40', labelCls: 'text-muted-foreground/50', rowCls: '' }
}
```

- [ ] **Step 3: Apply `rowCls` to `<TableRow>` in `TranslationRow.tsx`**

Destructure `rowCls` from `getStatusMeta` result:
```tsx
const { label, strip, dotCls, labelCls, rowCls } = getStatusMeta(entry.status)
```

Update the `<TableRow>` className:
```tsx
className={`group absolute top-0 left-0 w-full flex border-b border-white/7 ${strip} ${rowCls} ${
  selected ? 'bg-primary/5 hover:bg-primary/8' : 'hover:bg-white/3'
}`}
```

Note: `rowCls` is empty string `''` for pending/translated/skipped, so no visual change for those — only warning/reviewed/error get tinted.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/blackat/project/hoshi-trans && pnpm build 2>&1 | head -40
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/translation/TranslationRow.tsx src/App.css
git commit -m "style(translation): add per-status row background tint for warning/reviewed/error"
```

---

## Summary of commits

| # | Message |
|---|---------|
| 1 | `feat(translation): extract BatchControls component with settings popover` |
| 2 | `refactor(translation): replace inline batch controls with BatchControls component` |
| 3 | `style(translation): add toolbar separator between filters and actions` |
| 4 | `style(translation): add per-status row background tint for warning/reviewed/error` |

## What this does NOT change

- Virtualizer logic — untouched
- All Tauri command invocations — untouched
- Status strip left border — kept, tinting is additive
- FileStatsPanel — untouched
- Toolbar buttons (retry warnings, export, search) — untouched, just visually grouped
