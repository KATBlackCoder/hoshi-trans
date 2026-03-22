import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { invoke } from '@tauri-apps/api/core'
import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TranslationRow } from './TranslationRow'
import { useTranslationBatch } from '@/hooks/useTranslationBatch'
import { useRefineBatch } from '@/hooks/useRefineBatch'
import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sparkles, X, Loader2, Search, ChevronUp, ChevronDown, ChevronsUpDown, RotateCcw, FolderOpen, Bug, Wand2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { openPath } from '@tauri-apps/plugin-opener'
import type { TranslationEntry } from '@/types'

const STATUS_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'pending' },
  { label: 'Translated', value: 'translated' },
  { label: 'Reviewed', value: 'reviewed' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
]

type SortKey = 'order' | 'file' | 'status'
type SortDir = 'asc' | 'desc'

const CONCURRENCY_OPTIONS = [1, 2, 4, 8]
const LIMIT_OPTIONS = [
  { label: '100', value: 100 },
  { label: '500', value: 500 },
  { label: '1000', value: 1000 },
  { label: 'All', value: 0 },
]

function sortEntries(entries: TranslationEntry[], key: SortKey, dir: SortDir): TranslationEntry[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => {
    switch (key) {
      case 'file':
        return mul * (a.file_path.localeCompare(b.file_path) || a.order_index - b.order_index)
      case 'status': {
        const statusStr = (e: TranslationEntry) =>
          typeof e.status === 'string' ? e.status : JSON.stringify(e.status)
        return mul * statusStr(a).localeCompare(statusStr(b))
      }
      default:
        return mul * (a.order_index - b.order_index)
    }
  })
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 ml-1 text-muted-foreground/40" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 ml-1 text-primary" />
    : <ChevronDown className="w-3 h-3 ml-1 text-primary" />
}

interface Props {
  projectId: string
  gameTitle?: string
  gameDir: string
  outputDir: string
}

export function TranslationView({ projectId, gameTitle, gameDir, outputDir }: Props) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [concurrency, setConcurrency] = useState(4)
  const [limit, setLimit] = useState(0)
  const { availableModels, settings } = useAppStore()
  const [selectedModel, setSelectedModel] = useState<string>('')
  const model = selectedModel || availableModels[0] || ''
  const { progress, running, start, cancel } = useTranslationBatch()
  const { progress: refineProgress, running: refining, start: startRefine, cancel: cancelRefine } = useRefineBatch()
  // Default: same model as translation (user can pick a dedicated thinking model if available)
  const effectiveRefineModel = model
  const [resetting, setResetting] = useState(false)
  const [lastResetCount, setLastResetCount] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [translatingRowId, setTranslatingRowId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: entries = [], refetch } = useQuery({
    queryKey: ['entries', projectId, statusFilter],
    queryFn: () =>
      invoke<TranslationEntry[]>('get_entries', {
        projectId,
        statusFilter: statusFilter ?? null,
        fileFilter: null,
      }),
  })

  const progressPct = progress ? Math.round((progress.done / progress.total) * 100) : 0
  const pendingCount = entries.filter(e => e.status === 'pending').length
  const translatedCount = entries.filter(e => e.status === 'translated').length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q
      ? entries.filter(
          e =>
            e.source_text.toLowerCase().includes(q) ||
            (e.translation ?? '').toLowerCase().includes(q) ||
            e.file_path.toLowerCase().includes(q),
        )
      : entries
    return sortEntries(base, sortKey, sortDir)
  }, [entries, search, sortKey, sortDir])

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 8,
  })

  function handleSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(col)
      setSortDir('asc')
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleTranslateSingle(entry: TranslationEntry) {
    if (translatingRowId || running) return
    setTranslatingRowId(entry.id)
    const lang = settings.targetLang === 'fr' ? 'French' : 'English'
    const effectivePrompt = model.includes('hoshi-translator')
      ? ''
      : settings.systemPrompt.replace('{lang}', lang)
    start(projectId, model, settings.targetLang, effectivePrompt, settings.ollamaHost, 1, 0, settings.temperature, [entry.id])
      .finally(() => { setTranslatingRowId(null); refetch() })
  }

  function handleStart() {
    const lang = settings.targetLang === 'fr' ? 'French' : 'English'
    // hoshi-translator has its own baked SYSTEM directive — sending a second
    // system prompt in the user message confuses the model, so we send empty.
    const effectivePrompt = model.includes('hoshi-translator')
      ? ''
      : settings.systemPrompt.replace('{lang}', lang)
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
    setSelectedIds(new Set())
    start(projectId, model, settings.targetLang, effectivePrompt, settings.ollamaHost, concurrency, limit, settings.temperature, ids)
  }

  const exportTranslated = useMutation({
    mutationFn: async () => {
      const count = await invoke<number>('inject_translations', { projectId, gameDir, outputDir })
      await openPath(outputDir)
      return count
    },
  })

  const debugExport = useMutation({
    mutationFn: async () => {
      const path = await invoke<string>('export_debug_json', { projectId, outputDir })
      await openPath(path)
    },
  })

  // Refresh table when refine batch completes
  useEffect(() => {
    if (!refining) refetch()
  }, [refining])

  function handleRefine() {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
    setSelectedIds(new Set())
    startRefine(projectId, effectiveRefineModel, settings.targetLang, settings.ollamaHost, 1, ids)
  }

  async function handleReset() {
    setResetting(true)
    setLastResetCount(null)
    try {
      const count = await invoke<number>('reset_empty_translations', { projectId })
      setLastResetCount(count)
      await refetch()
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-2.5 border-b border-border/50 flex items-center justify-between gap-4 shrink-0 bg-background/60 backdrop-blur-sm">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="font-semibold text-sm truncate text-foreground/90">{gameTitle ?? 'Translation'}</h2>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40 font-mono">
            <span className="tabular-nums">{entries.length}</span>
            <span className="opacity-50">entries</span>
            {translatedCount > 0 && (
              <><span className="opacity-30">·</span><span className="text-emerald-500/60 tabular-nums">{translatedCount} done</span></>
            )}
            {pendingCount > 0 && (
              <><span className="opacity-30">·</span><span className="tabular-nums">{pendingCount} pending</span></>
            )}
            {search && (
              <><span className="opacity-30">·</span><span className="text-primary/70 tabular-nums">{filtered.length} found</span></>
            )}
          </div>
        </div>

        {/* Batch controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {running && (
            <div className="flex items-center gap-2 mr-1">
              <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">
                {progress?.done}<span className="opacity-40">/</span>{progress?.total}
              </span>
              <Button variant="ghost" size="sm" onClick={cancel} className="h-7 px-2 text-xs text-muted-foreground/60 hover:text-destructive">
                <X className="w-3 h-3 mr-1" />Cancel
              </Button>
            </div>
          )}

          {/* Model selector */}
          <Select value={model} onValueChange={(v) => setSelectedModel(v ?? '')} disabled={running}>
            <SelectTrigger className="h-7 w-40 text-xs font-mono">
              <SelectValue placeholder="No model" />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map(m => (
                <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Concurrency segmented control */}
          <div className="flex items-center border border-border/50 rounded-md overflow-hidden">
            {CONCURRENCY_OPTIONS.map(n => (
              <button key={n} onClick={() => setConcurrency(n)} disabled={running}
                title={`${n} parallel requests`}
                className={`w-7 h-7 text-[11px] font-mono transition-colors border-r border-border/40 last:border-r-0 ${
                  concurrency === n
                    ? 'bg-secondary text-secondary-foreground font-semibold'
                    : 'text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40'
                }`}
              >{n}×</button>
            ))}
          </div>

          {/* Limit segmented control */}
          <div className="flex items-center border border-border/50 rounded-md overflow-hidden">
            {LIMIT_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setLimit(o.value)} disabled={running}
                title={o.value === 0 ? 'Translate all pending' : `Translate next ${o.value}`}
                className={`px-1.5 h-7 text-[11px] font-mono transition-colors border-r border-border/40 last:border-r-0 ${
                  limit === o.value
                    ? 'bg-secondary text-secondary-foreground font-semibold'
                    : 'text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40'
                }`}
              >{o.label}</button>
            ))}
          </div>

          {selectedIds.size > 0 && !running && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleStart}
              disabled={!model}
              className="h-7 gap-1.5 text-xs font-medium px-3 border-primary/40 text-primary hover:bg-primary/10"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Translate {selectedIds.size} selected
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleStart}
            disabled={running || !model}
            className="h-7 gap-1.5 text-xs font-medium px-3"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {running ? 'Translating…' : 'Translate'}
          </Button>

          {/* Refine controls */}
          {refining && (
            <div className="flex items-center gap-2 ml-1">
              <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">
                {refineProgress?.done}<span className="opacity-40">/</span>{refineProgress?.total}
              </span>
              <Button variant="ghost" size="sm" onClick={cancelRefine} className="h-7 px-2 text-xs text-muted-foreground/60 hover:text-destructive">
                <X className="w-3 h-3 mr-1" />Cancel refine
              </Button>
            </div>
          )}

          {selectedIds.size > 0 && !running && !refining && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefine}
              disabled={!effectiveRefineModel}
              className="h-7 gap-1.5 text-xs font-medium px-3 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Refine {selectedIds.size} selected
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleRefine}
            disabled={running || refining || !effectiveRefineModel}
            className="h-7 gap-1.5 text-xs font-medium px-3 border-amber-500/30 text-amber-400/80 hover:bg-amber-500/10"
          >
            {refining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            {refining ? 'Refining…' : 'Refine'}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-1.5 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-0.5">
          {STATUS_FILTERS.map(f => (
            <button key={f.label} onClick={() => setStatusFilter(f.value)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40'
              }`}
            >{f.label}</button>
          ))}
        </div>

        <div className="flex-1" />

        {lastResetCount !== null && (
          <span className="text-[10.5px] text-emerald-500/80 font-mono">
            {lastResetCount} reset
          </span>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={running || resetting}
          title="Reset translated entries with empty translation back to pending"
          className="h-7 px-2 text-xs text-muted-foreground/60 hover:text-foreground gap-1"
        >
          <RotateCcw className={`w-3 h-3 ${resetting ? 'animate-spin' : ''}`} />
          Reset empty
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => debugExport.mutate()}
          disabled={debugExport.isPending}
          title="Export translated entries to JSON"
          className="h-7 px-2 text-xs text-muted-foreground/60 hover:text-foreground gap-1"
        >
          {debugExport.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bug className="w-3 h-3" />}
          Debug JSON
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => exportTranslated.mutate()}
          disabled={exportTranslated.isPending || running}
          title="Inject translations and open output folder"
          className="h-7 px-2 text-xs text-muted-foreground/60 hover:text-foreground gap-1"
        >
          {exportTranslated.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderOpen className="w-3 h-3" />}
          Export
        </Button>

        {!model && (
          <span className="text-[10.5px] text-amber-400/80 font-mono">no model selected</span>
        )}

        <div className="relative w-44">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40 pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="h-7 pl-6 text-xs bg-transparent" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Virtualized table */}
      {filtered.length === 0 ? (
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
                {/* Original column — sorts by file or order */}
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

                {/* Translation column — sorts by status */}
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
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    selected={selectedIds.has(entry.id)}
                    onToggleSelect={() => toggleSelect(entry.id)}
                    selectionActive={selectedIds.size > 0}
                    onTranslateSingle={() => handleTranslateSingle(entry)}
                    translating={translatingRowId === entry.id}
                  />
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Progress bar — bottom amber shimmer */}
      <div className="h-0.5 bg-border/30 shrink-0 overflow-hidden">
        {running && (
          <div
            className="h-full shimmer transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        )}
      </div>
    </div>
  )
}
