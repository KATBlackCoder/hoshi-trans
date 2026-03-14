import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { invoke } from '@tauri-apps/api/core'
import { useMemo, useRef, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TranslationRow } from './TranslationRow'
import { useTranslationBatch } from '@/hooks/useTranslationBatch'
import { useAppStore } from '@/stores/appStore'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sparkles, X, Loader2, Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { TranslationEntry } from '@/types'

const STATUS_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'pending' },
  { label: 'Translated', value: 'translated' },
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
}

export function TranslationView({ projectId, gameTitle }: Props) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('order')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [concurrency, setConcurrency] = useState(4)
  const [limit, setLimit] = useState(0)
  const { availableModels } = useAppStore()
  const [selectedModel, setSelectedModel] = useState<string>('')
  const model = selectedModel || availableModels[0] || ''
  const { progress, running, start, cancel } = useTranslationBatch()
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

  function handleStart() {
    start(
      projectId,
      model,
      'en',
      'Translate to English. Preserve all {{PLACEHOLDER}} tokens exactly.',
      concurrency,
      limit,
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 shrink-0">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold text-sm">{gameTitle ?? 'Translation'}</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{entries.length} entries</span>
            {translatedCount > 0 && <><span>·</span><span className="text-green-500">{translatedCount} translated</span></>}
            {pendingCount > 0 && <><span>·</span><span>{pendingCount} pending</span></>}
            {search && <><span>·</span><span className="text-primary">{filtered.length} results</span></>}
          </div>
        </div>

        {/* Batch controls */}
        <div className="flex items-center gap-2">
          {running && (
            <div className="flex items-center gap-2">
              <Progress value={progressPct} className="w-32 h-1.5" />
              <span className="text-xs text-muted-foreground tabular-nums">
                {progress?.done}/{progress?.total}
              </span>
              <Button variant="ghost" size="sm" onClick={cancel} className="h-7 px-2 text-xs">
                <X className="w-3 h-3 mr-1" />Cancel
              </Button>
            </div>
          )}

          {/* Model selector */}
          <Select value={model} onValueChange={(v) => setSelectedModel(v ?? '')} disabled={running}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="No model" />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map(m => (
                <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Concurrency */}
          <div className="flex items-center gap-0.5 border border-border rounded-md px-1 py-0.5">
            {CONCURRENCY_OPTIONS.map(n => (
              <button key={n} onClick={() => setConcurrency(n)} disabled={running}
                title={`${n} parallel requests`}
                className={`w-7 h-6 rounded text-xs font-mono transition-colors ${concurrency === n ? 'bg-secondary text-secondary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
              >{n}×</button>
            ))}
          </div>

          {/* Limit */}
          <div className="flex items-center gap-0.5 border border-border rounded-md px-1 py-0.5">
            {LIMIT_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setLimit(o.value)} disabled={running}
                title={o.value === 0 ? 'Translate all pending' : `Translate next ${o.value}`}
                className={`px-1.5 h-6 rounded text-xs transition-colors ${limit === o.value ? 'bg-secondary text-secondary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
              >{o.label}</button>
            ))}
          </div>

          <Button size="sm" onClick={handleStart} disabled={running || !model} className="h-8 gap-1.5">
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {running ? 'Translating…' : 'Translate'}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map(f => (
            <button key={f.label} onClick={() => setStatusFilter(f.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${statusFilter === f.value ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
            >{f.label}</button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="relative w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="h-7 pl-6 text-xs" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {!model && (
          <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">No Ollama model</Badge>
        )}
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
                  />
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {running && (
        <div className="h-0.5 bg-border shrink-0">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
      )}
    </div>
  )
}
