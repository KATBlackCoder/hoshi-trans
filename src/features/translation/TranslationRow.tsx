import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, Pencil, X } from 'lucide-react'
import type { TranslationEntry, TranslationStatus } from '@/types'

function StatusBadge({ status }: { status: TranslationStatus }) {
  if (status === 'pending')
    return <Badge variant="outline" className="text-xs h-5 px-1.5 font-normal text-muted-foreground">pending</Badge>
  if (status === 'translated')
    return <Badge variant="outline" className="text-xs h-5 px-1.5 font-normal text-green-500 border-green-500/30">translated</Badge>
  if (status === 'reviewed')
    return <Badge variant="outline" className="text-xs h-5 px-1.5 font-normal text-blue-500 border-blue-500/30">reviewed</Badge>
  if (status === 'skipped')
    return <Badge variant="secondary" className="text-xs h-5 px-1.5 font-normal">skipped</Badge>
  if (typeof status === 'object' && 'error' in status)
    return <Badge variant="destructive" className="text-xs h-5 px-1.5 font-normal">error</Badge>
  if (typeof status === 'object' && 'warning' in status)
    return <Badge variant="outline" className="text-xs h-5 px-1.5 font-normal text-yellow-500 border-yellow-500/30">warning</Badge>
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

  function discard() {
    setDraft(entry.translation ?? '')
    setEditing(false)
  }

  return (
    <div className="grid grid-cols-2 gap-4 px-6 py-3 text-sm hover:bg-muted/20 group">
      {/* Source */}
      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">
          {entry.source_text}
        </p>
        {entry.context && (
          <span className="text-xs text-muted-foreground/60">{entry.context}</span>
        )}
      </div>

      {/* Translation */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <StatusBadge status={entry.status} />
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
              onClick={() => setEditing(true)}
            >
              <Pencil className="w-3 h-3" />
            </Button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-1.5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="text-xs font-mono resize-none"
              autoFocus
            />
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={discard}>
                <X className="w-3 h-3 mr-1" />
                Discard
              </Button>
              <Button size="sm" className="h-6 px-2 text-xs" onClick={save}>
                <Check className="w-3 h-3 mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/70">
            {entry.translation ?? <span className="text-muted-foreground/40 italic">not translated</span>}
          </p>
        )}
      </div>
    </div>
  )
}
