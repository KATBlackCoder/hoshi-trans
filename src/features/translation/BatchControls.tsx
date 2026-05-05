import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sparkles, Wand2, X, Settings2 } from 'lucide-react'
import { HOSHI_MODEL_INFO } from '@/lib/models'

const LIMIT_OPTIONS = [
  { label: '100', value: 100 },
  { label: '500', value: 500 },
  { label: '1000', value: 1000 },
  { label: 'All', value: 0 },
]

interface BatchControlsProps {
  availableModels: string[]
  model: string
  onModelChange: (m: string) => void
  refineModel: string
  onRefineModelChange: (m: string) => void
  running: boolean
  progress: { done: number; total: number } | null
  onStart: () => void
  onCancel: () => void
  selectedCount: number
  refining: boolean
  refineProgress: { done: number; total: number } | null
  onRefine: () => void
  onCancelRefine: () => void
  limit: number
  onLimitChange: (n: number) => void
}

export function BatchControls({
  availableModels,
  model, onModelChange,
  refineModel, onRefineModelChange,
  running, progress, onStart, onCancel,
  selectedCount,
  refining, refineProgress, onRefine, onCancelRefine,
  limit, onLimitChange,
}: BatchControlsProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">

      {/* ── TRANSLATE SECTION ── */}
      <div className="flex items-center gap-1.5 border border-primary/30 rounded-sm px-2 py-1 bg-card/30">
        <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-primary mr-0.5 select-none">
          TL
        </span>

        <Select value={model} onValueChange={(v) => onModelChange(v ?? '')} disabled={running}>
          <SelectTrigger className="h-6 w-52 text-[11px] font-mono border-0 bg-transparent px-1 focus:ring-0 focus-visible:ring-0">
            <SelectValue placeholder="No model" />
          </SelectTrigger>
          <SelectContent className="max-w-none w-auto min-w-(--radix-select-trigger-width)">
            {availableModels.map(m => (
              <SelectItem key={m} value={m} className="text-xs font-mono">
                <span>hoshi-translator</span>
                {HOSHI_MODEL_INFO[m] && (
                  <span className="ml-1.5 text-[9px] text-primary font-bold uppercase">{HOSHI_MODEL_INFO[m]}</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger
            className="inline-flex h-6 w-6 items-center justify-center p-0 rounded-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
            title="Batch settings"
            disabled={running}
          >
            <Settings2 className="w-3 h-3" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-3 space-y-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Limit
              </p>
              <div className="flex items-center border border-border rounded-sm overflow-hidden">
                {LIMIT_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => onLimitChange(o.value)}
                    title={o.value === 0 ? 'All pending' : `Next ${o.value}`}
                    className={`flex-1 h-7 text-[10px] font-bold font-mono uppercase tracking-wider transition-colors border-r border-border last:border-r-0 ${
                      limit === o.value
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
                    }`}
                  >{o.label}</button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {running ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-primary font-mono font-bold tabular-nums min-w-12 text-right">
              {progress?.done}<span className="text-muted-foreground">/</span>{progress?.total}
            </span>
            <Button variant="ghost" size="icon-xs" onClick={onCancel}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="xs"
            onClick={onStart}
            disabled={!model}
          >
            <Sparkles className="w-3 h-3" />
            {selectedCount > 0 ? `Translate ${selectedCount}` : 'Translate'}
          </Button>
        )}
      </div>

      {/* ── REFINE SECTION ── */}
      <div className="flex items-center gap-1.5 border border-amber-500/30 rounded-sm px-2 py-1 bg-card/30">
        <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-amber-400 mr-0.5 select-none">
          RF
        </span>

        <Select value={refineModel} onValueChange={(v) => onRefineModelChange(v ?? '')} disabled={refining}>
          <SelectTrigger className="h-6 w-52 text-[11px] font-mono border-0 bg-transparent px-1 focus:ring-0 focus-visible:ring-0">
            <SelectValue placeholder="No model" />
          </SelectTrigger>
          <SelectContent className="max-w-none w-auto min-w-(--radix-select-trigger-width)">
            {availableModels.map(m => (
              <SelectItem key={m} value={m} className="text-xs font-mono">
                <span>hoshi-translator</span>
                {HOSHI_MODEL_INFO[m] && (
                  <span className="ml-1.5 text-[9px] text-amber-400 font-bold uppercase">{HOSHI_MODEL_INFO[m]}</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {refining ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-amber-400 font-mono font-bold tabular-nums min-w-12 text-right">
              {refineProgress?.done}<span className="text-muted-foreground">/</span>{refineProgress?.total}
            </span>
            <Button variant="ghost" size="icon-xs" onClick={onCancelRefine}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="xs"
            variant="outline"
            onClick={onRefine}
            disabled={running || !refineModel}
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/60 hover:text-amber-300"
          >
            <Wand2 className="w-3 h-3" />
            {selectedCount > 0 ? `Refine ${selectedCount}` : 'Refine'}
          </Button>
        )}
      </div>
    </div>
  )
}
