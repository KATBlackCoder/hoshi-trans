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

function getStatusMeta(status: TranslationStatus): { label: string; strip: string; bgCls: string; labelCls: string; rowCls: string } {
  if (status === 'translated')
    return { label: 'Translated', strip: 'status-strip-translated', bgCls: 'bg-emerald-500/15 border-emerald-500/40', labelCls: 'text-emerald-400', rowCls: '' }
  if (status === 'reviewed')
    return { label: 'Reviewed', strip: 'status-strip-reviewed', bgCls: 'bg-blue-500/15 border-blue-500/40', labelCls: 'text-blue-400', rowCls: 'status-row-reviewed' }
  if (status === 'skipped')
    return { label: 'Skipped', strip: 'status-strip-skipped', bgCls: 'bg-muted/40 border-border', labelCls: 'text-muted-foreground', rowCls: '' }
  if (typeof status === 'string' && status.startsWith('warning')) {
    const ratio = parseWarningRatio(status)
    return { label: ratio ? `Warn ${ratio}` : 'Warning', strip: 'status-strip-warning', bgCls: 'bg-amber-500/15 border-amber-500/40', labelCls: 'text-amber-400', rowCls: 'status-row-warning' }
  }
  if (typeof status === 'object' && 'error' in status)
    return { label: 'Error', strip: 'status-strip-error', bgCls: 'bg-red-500/15 border-red-500/40', labelCls: 'text-red-400', rowCls: 'status-row-error' }
  if (typeof status === 'object' && 'warning' in status)
    return { label: 'Warning', strip: 'status-strip-warning', bgCls: 'bg-amber-500/15 border-amber-500/40', labelCls: 'text-amber-400', rowCls: 'status-row-warning' }
  return { label: 'Pending', strip: 'status-strip-pending', bgCls: 'bg-card/60 border-border', labelCls: 'text-muted-foreground', rowCls: '' }
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
  const { label, strip, bgCls, labelCls, rowCls } = getStatusMeta(entry.status)
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
      className={`group absolute top-0 left-0 w-full flex border-b border-border/40 ${strip} ${rowCls} ${
        selected ? 'bg-primary/8 hover:bg-primary/12' : 'hover:bg-card/40'
      }`}
    >
      {/* Source — JP text */}
      <TableCell className="w-1/2 min-w-0 align-top py-3 px-4 overflow-hidden">
        <div className="flex items-start gap-2">
          <button
            onClick={e => { e.stopPropagation(); onToggleSelect?.() }}
            className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${
              selected
                ? 'bg-primary border-primary text-primary-foreground opacity-100'
                : selectionActive
                  ? 'border-border opacity-100 hover:border-primary'
                  : 'border-border opacity-0 group-hover:opacity-100 hover:border-primary'
            }`}
          >
            {selected && <Check className="w-2 h-2" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap wrap-break-word">
              {entry.source_text}
            </p>
            <span className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-wider mt-1 block">
              {filename} <span className="text-primary">·</span> #{entry.order_index}
              {translatedAtStr && (
                <span className="ml-2 text-muted-foreground/60 normal-case tracking-normal font-normal">{translatedAtStr}</span>
              )}
              {(entry.prompt_tokens != null || entry.output_tokens != null) && (
                <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400/70 normal-case tracking-normal font-normal">
                  {entry.prompt_tokens != null && <>in:{entry.prompt_tokens} </>}
                  {entry.output_tokens != null && <>out:{entry.output_tokens}</>}
                </span>
              )}
            </span>
          </div>
        </div>
      </TableCell>

      {/* Translation */}
      <TableCell className="w-1/2 min-w-0 align-top py-3 px-4 border-l border-border/40 overflow-hidden">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            {/* Status badge — Voltage square pill */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[9px] font-bold font-mono uppercase tracking-widest ${bgCls} ${labelCls}`}>
              {label}
            </span>
            {!editing && (
              <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={e => { e.stopPropagation(); onTranslateSingle?.() }}
                  disabled={translating || refining}
                  title="Translate this entry"
                  className="text-muted-foreground hover:text-primary"
                >
                  {translating
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Sparkles className="w-3 h-3" />}
                </Button>
                {(entry.status === 'translated' || (typeof entry.status === 'object' && 'warning' in entry.status) || (typeof entry.status === 'string' && entry.status.startsWith('warning'))) && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={e => { e.stopPropagation(); onRefineSingle?.() }}
                    disabled={refining || translating}
                    title="Refine this entry"
                    className="text-muted-foreground hover:text-amber-400"
                  >
                    {refining
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Wand2 className="w-3 h-3" />}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setEditing(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {entry.ph_count_source != null && entry.ph_count_draft != null
            && entry.ph_count_source !== entry.ph_count_draft && (
            <span className="text-[9px] text-amber-400 font-mono font-bold uppercase tracking-wider">
              ⚠ {entry.ph_count_draft}/{entry.ph_count_source} ph
            </span>
          )}

          {editing ? (
            <div className="flex flex-col gap-1.5">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="text-xs font-mono resize-none bg-card/60"
                autoFocus
              />
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="xs" onClick={discard}>
                  <X className="w-3 h-3" />Discard
                </Button>
                <Button size="xs" onClick={save}>
                  <Check className="w-3 h-3" />Save
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="text-xs leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground/75 font-mono cursor-text hover:text-foreground transition-colors"
              onClick={() => setEditing(true)}
              title="Click to edit"
            >
              {entry.refined_text && entry.refined_status !== 'unchanged' ? (
                <>
                  <span className="text-amber-400 mr-1 text-[9px] font-bold">
                    {entry.refined_status === 'manual' ? '✎' : '✦'}
                  </span>
                  {entry.refined_text}
                  {entry.refined_status === 'reviewed' && entry.translation && (
                    <div className="mt-1 text-[10px] text-muted-foreground/40 line-through leading-relaxed">
                      {entry.translation}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {entry.translation ?? <span className="text-muted-foreground/50 italic font-sans uppercase text-[10px] font-bold tracking-wider">// not translated</span>}
                  {entry.refined_status === 'unchanged' && (
                    <span className="ml-1.5 text-[9px] text-emerald-500/60">✓</span>
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
