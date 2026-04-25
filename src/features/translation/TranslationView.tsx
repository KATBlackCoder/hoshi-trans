import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { invoke } from '@tauri-apps/api/core'
import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TranslationRow } from './TranslationRow'
import { FileStatsPanel } from './FileStatsPanel'
import { useTranslationBatch } from '@/hooks/useTranslationBatch'
import { useRefineBatch } from '@/hooks/useRefineBatch'
import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Loader2, Search, ChevronUp, ChevronDown, ChevronsUpDown, FolderOpen, AlertTriangle, LayoutList, BarChart2 } from 'lucide-react'
import { BatchControls } from './BatchControls'
import { useMutation } from '@tanstack/react-query'
import { openPath } from '@tauri-apps/plugin-opener'
import type { TranslationEntry } from '@/types'

const STATUS_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'pending' },
  { label: 'Translated', value: 'translated' },
  { label: 'Reviewed', value: 'reviewed' },
  { label: 'Warning', value: 'warning' },
]

type SortKey = 'order' | 'file' | 'status'
type SortDir = 'asc' | 'desc'

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
  const [fileFilter, setFileFilter] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [limit, setLimit] = useState(0)
  const { availableModels: allModels, settings } = useAppStore()
  const availableModels = allModels.filter(m => m.includes('hoshi-translator'))
  const [selectedModel, setSelectedModel] = useState<string>('')
  const model = selectedModel || availableModels[0] || ''
  const { progress, running, start, cancel } = useTranslationBatch()
  const { progress: refineProgress, running: refining, start: startRefine, cancel: cancelRefine } = useRefineBatch()
  const [selectedRefineModel, setSelectedRefineModel] = useState<string>('')
  const refineModel = selectedRefineModel || availableModels[0] || ''
  const [viewMode, setViewMode] = useState<'list' | 'files'>('list')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [translatingRowId, setTranslatingRowId] = useState<string | null>(null)
  const [refiningRowId, setRefiningRowId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: entries = [], refetch } = useQuery({
    queryKey: ['entries', projectId, statusFilter, fileFilter],
    queryFn: () =>
      invoke<TranslationEntry[]>('get_entries', {
        projectId,
        statusFilter: statusFilter ?? null,
        fileFilter: fileFilter ?? null,
      }),
  })

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

  const { data: inconsistentTexts = [] } = useQuery({
    queryKey: ['inconsistent', projectId],
    queryFn: () => invoke<string[]>('get_inconsistent_source_texts', { projectId }),
    enabled: !running && !refining,
  })

  const [showInconsistent, setShowInconsistent] = useState(false)

  useEffect(() => {
    setFileFilter(undefined)
    setShowInconsistent(false)
  }, [projectId])

  const progressPct = progress ? Math.round((progress.done / progress.total) * 100) : 0
  const pendingCount = entries.filter(e => e.status === 'pending').length
  const translatedCount = entries.filter(e => e.status === 'translated').length

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

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
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
    start(projectId, model, settings.ollamaHost, 0, settings.temperature, [entry.id])
      .finally(() => { setTranslatingRowId(null); refetch() })
  }

  function handleStart() {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
    setSelectedIds(new Set())
    start(projectId, model, settings.ollamaHost, limit, settings.temperature, ids)
  }

  const exportTranslated = useMutation({
    mutationFn: async () => {
      const count = await invoke<number>('inject_translations', { projectId, gameDir, outputDir })
      await openPath(outputDir)
      return count
    },
  })

  function handleRetranslateWarnings() {
    const warningIds = entries
      .filter(e => typeof e.status === 'string' && e.status.startsWith('warning'))
      .map(e => e.id)
    if (warningIds.length === 0) return
    start(projectId, model, settings.ollamaHost, limit, settings.temperature, warningIds)
  }

  // Refresh table when batch completes
  useEffect(() => {
    if (!running) refetch()
  }, [running])

  // Refresh table when refine batch completes
  useEffect(() => {
    if (!refining) refetch()
  }, [refining])

  function handleRefine() {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
    setSelectedIds(new Set())
    startRefine(projectId, refineModel, settings.targetLang, settings.ollamaHost, 1, ids)
  }

  function handleRefineSingle(entry: TranslationEntry) {
    if (refiningRowId || refining) return
    setRefiningRowId(entry.id)
    startRefine(projectId, refineModel, settings.targetLang, settings.ollamaHost, 1, [entry.id])
      .finally(() => { setRefiningRowId(null); refetch() })
  }

  function handleFileClick(filePath: string) {
    setFileFilter(filePath)
    setViewMode('list')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-2.5 border-b border-border/50 flex items-center justify-between gap-4 shrink-0 bg-background/60 backdrop-blur-sm">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="font-semibold text-sm truncate text-foreground/90">{gameTitle ?? 'Translation'}</h2>
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="tabular-nums text-foreground/60">{entries.length}</span>
            <span className="text-muted-foreground/40">entries</span>
            {(running ? (progress?.done ?? 0) : translatedCount) > 0 && (
              <><span className="text-muted-foreground/30">·</span><span className="text-emerald-400/80 tabular-nums">{running ? (progress?.done ?? 0) : translatedCount} done</span></>
            )}
            {(running ? ((progress?.total ?? 0) - (progress?.done ?? 0)) : pendingCount) > 0 && (
              <><span className="text-muted-foreground/30">·</span><span className="text-muted-foreground/50 tabular-nums">{running ? ((progress?.total ?? 0) - (progress?.done ?? 0)) : pendingCount} pending</span></>
            )}
            {search && (
              <><span className="text-muted-foreground/30">·</span><span className="text-primary/70 tabular-nums">{filtered.length} found</span></>
            )}
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
          </div>
        </div>

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
          limit={limit}
          onLimitChange={setLimit}
        />
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

        {uniqueFiles.length > 1 && (
          <Select value={fileFilter ?? '__all__'} onValueChange={(v) => setFileFilter(!v || v === '__all__' ? undefined : v)}>
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

        <div className="flex-1" />
        <div className="w-px h-4 bg-border/30 shrink-0" />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleRetranslateWarnings}
          disabled={running || refining || entries.filter(e => typeof e.status === 'string' && e.status.startsWith('warning')).length === 0}
          title="Retranslate all warning entries"
          className="h-7 px-2 text-xs text-muted-foreground/60 hover:text-amber-400 gap-1"
        >
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
          Retry warnings
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
                    data-index={virtualRow.index}
                    measureRef={virtualizer.measureElement}
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
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
