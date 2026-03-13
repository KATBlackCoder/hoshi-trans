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
  const [statusFilter] = useState<string | undefined>()
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
      <div className="flex items-center gap-2 flex-wrap">
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
        {entries.length === 0 && (
          <p className="text-muted-foreground text-sm mt-4">No entries. Run extraction first.</p>
        )}
      </div>
    </div>
  )
}
