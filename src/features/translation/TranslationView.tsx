import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TranslationRow } from './TranslationRow'
import { useTranslationBatch } from '@/hooks/useTranslationBatch'
import { useAppStore } from '@/stores/appStore'
import { Sparkles, X, Loader2 } from 'lucide-react'
import type { TranslationEntry } from '@/types'

const STATUS_FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'pending' },
  { label: 'Translated', value: 'translated' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
]

interface Props {
  projectId: string
  gameTitle?: string
}

export function TranslationView({ projectId, gameTitle }: Props) {
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

  const pendingCount = entries.filter(e => e.status === 'pending').length
  const translatedCount = entries.filter(e => e.status === 'translated').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold text-sm">{gameTitle ?? 'Translation'}</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{entries.length} entries</span>
            {translatedCount > 0 && (
              <>
                <span>·</span>
                <span className="text-green-500">{translatedCount} translated</span>
              </>
            )}
            {pendingCount > 0 && (
              <>
                <span>·</span>
                <span>{pendingCount} pending</span>
              </>
            )}
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
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
            </div>
          )}
          <Button
            size="sm"
            onClick={() => start(projectId, model, 'en', 'Translate to English. Preserve all {{PLACEHOLDER}} tokens exactly.')}
            disabled={running || !model}
            className="h-8 gap-1.5"
          >
            {running
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Sparkles className="w-3.5 h-3.5" />}
            {running ? 'Translating…' : 'Translate all'}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-border">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            {f.label}
          </button>
        ))}
        {!model && (
          <Badge variant="outline" className="ml-auto text-xs text-yellow-500 border-yellow-500/30">
            No Ollama model available
          </Badge>
        )}
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
            <p className="text-sm font-medium">No entries</p>
            <p className="text-xs text-muted-foreground">Run extraction to populate this list</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Column headers */}
            <div className="grid grid-cols-2 gap-4 px-6 py-2 text-xs font-medium text-muted-foreground bg-muted/30 sticky top-0">
              <span>Original (JP)</span>
              <span>Translation</span>
            </div>
            {entries.map((e) => (
              <TranslationRow key={e.id} entry={e} onUpdated={refetch} />
            ))}
          </div>
        )}
      </div>

      {/* Progress bar overlay when running */}
      {running && (
        <div className="h-0.5 bg-border">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  )
}
