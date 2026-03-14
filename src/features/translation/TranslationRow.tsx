import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { TableCell, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Check, Pencil, X } from 'lucide-react'
import type { TranslationEntry, TranslationStatus } from '@/types'

function getStatusMeta(status: TranslationStatus): { label: string; strip: string; dot: string } {
  if (status === 'translated')
    return { label: 'ok', strip: 'status-strip-translated', dot: 'bg-emerald-500' }
  if (status === 'reviewed')
    return { label: 'reviewed', strip: 'status-strip-reviewed', dot: 'bg-blue-500' }
  if (status === 'skipped')
    return { label: 'skip', strip: 'status-strip-skipped', dot: 'bg-muted-foreground/30' }
  if (typeof status === 'object' && 'error' in status)
    return { label: 'error', strip: 'status-strip-error', dot: 'bg-red-500' }
  if (typeof status === 'object' && 'warning' in status)
    return { label: 'warn', strip: 'status-strip-warning', dot: 'bg-amber-400' }
  return { label: 'pending', strip: 'status-strip-pending', dot: 'bg-muted-foreground/20' }
}

interface Props {
  entry: TranslationEntry
  onUpdated: () => void
  style?: React.CSSProperties
}

export function TranslationRow({ entry, onUpdated, style }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.translation ?? '')

  const filename = entry.file_path.split('/').pop() ?? entry.file_path
  const { label, strip, dot } = getStatusMeta(entry.status)

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
    <TableRow
      style={style}
      className={`group absolute top-0 left-0 w-full flex hover:bg-muted/10 border-b border-border/60 ${strip}`}
    >
      {/* Source — JP text */}
      <TableCell className="w-1/2 align-top py-2.5 px-4">
        <p className="font-mono text-[11.5px] leading-relaxed text-foreground/75 whitespace-pre-wrap wrap-break-word">
          {entry.source_text}
        </p>
        <span className="text-[9.5px] text-muted-foreground/35 font-mono mt-1 block tracking-wide">
          {filename} <span className="opacity-60">#{entry.order_index}</span>
        </span>
      </TableCell>

      {/* Translation */}
      <TableCell className="w-1/2 align-top py-2.5 px-4 border-l border-border/40">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            {/* Status dot + label */}
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
              <span className="text-[9.5px] font-mono text-muted-foreground/50 uppercase tracking-widest">{label}</span>
            </div>
            {!editing && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto text-muted-foreground/50 hover:text-foreground"
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
                className="text-xs font-mono resize-none bg-background/50"
                autoFocus
              />
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={discard}>
                  <X className="w-3 h-3 mr-1" />Discard
                </Button>
                <Button size="sm" className="h-6 px-2 text-xs" onClick={save}>
                  <Check className="w-3 h-3 mr-1" />Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-[11.5px] leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground/65 font-mono">
              {entry.translation ?? <span className="text-muted-foreground/25 italic font-sans text-xs">not translated</span>}
            </p>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
