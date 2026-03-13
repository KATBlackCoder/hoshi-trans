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
