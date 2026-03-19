import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { TableCell, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Check, Loader2, Pencil, Sparkles, X } from 'lucide-react'
import type { TranslationEntry, TranslationStatus } from '@/types'

function getStatusMeta(status: TranslationStatus): { label: string; strip: string; dotCls: string; labelCls: string } {
  if (status === 'translated')
    return { label: 'translated', strip: 'status-strip-translated', dotCls: 'bg-emerald-500', labelCls: 'text-emerald-400' }
  if (status === 'reviewed')
    return { label: 'reviewed', strip: 'status-strip-reviewed', dotCls: 'bg-blue-400', labelCls: 'text-blue-400' }
  if (status === 'skipped')
    return { label: 'skipped', strip: 'status-strip-skipped', dotCls: 'bg-muted-foreground/40', labelCls: 'text-muted-foreground/50' }
  if (typeof status === 'object' && 'error' in status)
    return { label: 'error', strip: 'status-strip-error', dotCls: 'bg-red-500', labelCls: 'text-red-400' }
  if (typeof status === 'object' && 'warning' in status)
    return { label: 'warning', strip: 'status-strip-warning', dotCls: 'bg-amber-400', labelCls: 'text-amber-400' }
  return { label: 'pending', strip: 'status-strip-pending', dotCls: 'bg-muted-foreground/40', labelCls: 'text-muted-foreground/50' }
}

interface Props {
  entry: TranslationEntry
  onUpdated: () => void
  style?: React.CSSProperties
  selected?: boolean
  onToggleSelect?: () => void
  onTranslateSingle?: () => void
  translating?: boolean
  selectionActive?: boolean
}

export function TranslationRow({ entry, onUpdated, style, selected, onToggleSelect, onTranslateSingle, translating, selectionActive }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.translation ?? '')

  const filename = entry.file_path.split('/').pop() ?? entry.file_path
  const { label, strip, dotCls, labelCls } = getStatusMeta(entry.status)

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
      className={`group absolute top-0 left-0 w-full flex border-b border-white/7 ${strip} ${
        selected ? 'bg-primary/5 hover:bg-primary/8' : 'hover:bg-white/3'
      }`}
    >
      {/* Source — JP text */}
      <TableCell className="w-1/2 min-w-0 align-top py-3 px-4 overflow-hidden">
        <div className="flex items-start gap-2">
          {/* Checkbox — visible on hover or when selection active */}
          <button
            onClick={e => { e.stopPropagation(); onToggleSelect?.() }}
            className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
              selected
                ? 'bg-primary border-primary text-primary-foreground opacity-100'
                : selectionActive
                  ? 'border-border/60 opacity-100 hover:border-primary/60'
                  : 'border-border/40 opacity-0 group-hover:opacity-100 hover:border-primary/60'
            }`}
          >
            {selected && <Check className="w-2 h-2" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs leading-relaxed text-foreground/85 whitespace-pre-wrap wrap-break-word">
              {entry.source_text}
            </p>
            <span className="text-[10px] text-muted-foreground/40 font-mono mt-1 block">
              {filename} <span className="opacity-50">#{entry.order_index}</span>
            </span>
          </div>
        </div>
      </TableCell>

      {/* Translation */}
      <TableCell className="w-1/2 min-w-0 align-top py-3 px-4 border-l border-white/6 overflow-hidden">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            {/* Status dot + label */}
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
              <span className={`text-[10px] font-mono font-medium uppercase tracking-wider ${labelCls}`}>{label}</span>
            </div>
            {!editing && (
              <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Per-row translate button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-muted-foreground/50 hover:text-primary"
                  onClick={e => { e.stopPropagation(); onTranslateSingle?.() }}
                  disabled={translating}
                  title="Translate this entry"
                >
                  {translating
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Sparkles className="w-3 h-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-muted-foreground/50 hover:text-foreground"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
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
            <p className="text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground/70 font-mono">
              {entry.translation ?? <span className="text-muted-foreground/40 italic font-sans">not translated</span>}
            </p>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
