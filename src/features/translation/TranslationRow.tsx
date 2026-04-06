import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { TableCell, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Check, Loader2, Pencil, Sparkles, Wand2, X } from 'lucide-react'
import type { TranslationEntry, TranslationStatus } from '@/types'

function parseWarningRatio(status: TranslationStatus): string | null {
  if (typeof status !== 'string') return null
  // "warning:missing_placeholder:1/3" → "1/3"
  const parts = status.split(':')
  if (parts[0] === 'warning' && parts[2]) return parts[2]
  return null
}

function getStatusMeta(status: TranslationStatus): { label: string; strip: string; dotCls: string; labelCls: string; rowCls: string } {
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

interface Props {
  entry: TranslationEntry
  onUpdated: () => void
  style?: React.CSSProperties
  selected?: boolean
  onToggleSelect?: () => void
  onTranslateSingle?: () => void
  translating?: boolean
  onRefineSingle?: () => void
  refining?: boolean
  selectionActive?: boolean
  measureRef?: (el: Element | null) => void
  'data-index'?: number
}

export function TranslationRow({ entry, onUpdated, style, selected, onToggleSelect, onTranslateSingle, translating, onRefineSingle, refining, selectionActive, measureRef, 'data-index': dataIndex }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.translation ?? '')

  useEffect(() => {
    if (!editing) {
      const text = entry.refined_text && entry.refined_status !== 'unchanged'
        ? entry.refined_text
        : (entry.translation ?? '')
      setDraft(text)
    }
  }, [entry.translation, entry.refined_text, entry.refined_status, editing])

  const filename = entry.file_path.split('/').pop() ?? entry.file_path
  const { label, strip, dotCls, labelCls, rowCls } = getStatusMeta(entry.status)
  const translatedAtStr = entry.translated_at
    ? new Date(entry.translated_at * 1000).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    : null

  async function save() {
    if (entry.refined_text && entry.refined_status !== 'unchanged') {
      await invoke('update_refined_manual', { entryId: entry.id, refinedText: draft })
    } else {
      await invoke('update_translation', { entryId: entry.id, translation: draft })
    }
    setEditing(false)
    onUpdated()
  }

  function discard() {
    const text = entry.refined_text && entry.refined_status !== 'unchanged'
      ? entry.refined_text
      : (entry.translation ?? '')
    setDraft(text)
    setEditing(false)
  }

  return (
    <TableRow
      ref={measureRef}
      data-index={dataIndex}
      style={style}
      className={`group absolute top-0 left-0 w-full flex border-b border-white/7 ${strip} ${rowCls} ${
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
              {translatedAtStr && (
                <span className="ml-2 opacity-50">{translatedAtStr}</span>
              )}
              {(entry.prompt_tokens != null || entry.output_tokens != null) && (
                <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400/60">
                  {entry.prompt_tokens != null && <>in:{entry.prompt_tokens} </>}
                  {entry.output_tokens != null && <>out:{entry.output_tokens}</>}
                </span>
              )}
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
                  disabled={translating || refining}
                  title="Translate this entry"
                >
                  {translating
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Sparkles className="w-3 h-3" />}
                </Button>
                {/* Per-row refine button — only for translated/warning entries */}
                {(entry.status === 'translated' || (typeof entry.status === 'object' && 'warning' in entry.status) || (typeof entry.status === 'string' && entry.status.startsWith('warning'))) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-muted-foreground/50 hover:text-amber-400"
                    onClick={e => { e.stopPropagation(); onRefineSingle?.() }}
                    disabled={refining || translating}
                    title="Refine this entry"
                  >
                    {refining
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Wand2 className="w-3 h-3" />}
                  </Button>
                )}
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

          {/* Placeholder count mismatch warning */}
          {entry.ph_count_source != null && entry.ph_count_draft != null
            && entry.ph_count_source !== entry.ph_count_draft && (
            <span className="text-[9px] text-amber-400/70 font-mono">
              ⚠ {entry.ph_count_draft}/{entry.ph_count_source} ph
            </span>
          )}

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
            <div
              className="text-xs leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground/70 font-mono cursor-text hover:text-foreground/90 transition-colors"
              onClick={() => setEditing(true)}
              title="Click to edit"
            >
              {entry.refined_text && entry.refined_status !== 'unchanged' ? (
                <>
                  <span className="text-amber-400/70 mr-1 text-[9px]">
                    {entry.refined_status === 'manual' ? '✎' : '✦'}
                  </span>
                  {entry.refined_text}
                  {entry.refined_status === 'reviewed' && entry.translation && (
                    <div className="mt-1 text-[9.5px] text-muted-foreground/30 line-through leading-relaxed">
                      {entry.translation}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {entry.translation ?? <span className="text-muted-foreground/40 italic font-sans">not translated</span>}
                  {entry.refined_status === 'unchanged' && (
                    <span className="ml-1.5 text-[9px] text-emerald-500/50">✓</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
