import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sparkles, Wand2, X, Settings2 } from 'lucide-react'

const CONCURRENCY_OPTIONS = [1, 2, 4, 8]
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
  concurrency: number
  onConcurrencyChange: (n: number) => void
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
  concurrency, onConcurrencyChange,
  limit, onLimitChange,
}: BatchControlsProps) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">

      {/* ── TRANSLATE SECTION ── */}
      <div className="flex items-center gap-1 border border-border/40 rounded-md px-1.5 py-0.5">
        <span className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40 mr-0.5 select-none">
          TL
        </span>

        <Select value={model} onValueChange={(v) => onModelChange(v ?? '')} disabled={running}>
          <SelectTrigger className="h-6 w-40 text-xs font-mono border-0 bg-transparent px-1 focus:ring-0">
            <SelectValue placeholder="No model" />
          </SelectTrigger>
          <SelectContent className="max-w-none w-auto min-w-(--radix-select-trigger-width)">
            {availableModels.map(m => (
              <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger
            className="inline-flex h-6 w-6 items-center justify-center p-0 rounded-sm text-muted-foreground/40 hover:text-foreground transition-colors disabled:opacity-40"
            title="Batch settings"
            disabled={running}
          >
            <Settings2 className="w-3 h-3" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-3 space-y-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Concurrency
              </p>
              <div className="flex items-center border border-border/50 rounded-md overflow-hidden">
                {CONCURRENCY_OPTIONS.map(n => (
                  <button key={n} onClick={() => onConcurrencyChange(n)}
                    className={`flex-1 h-7 text-[11px] font-mono transition-colors border-r border-border/40 last:border-r-0 ${
                      concurrency === n
                        ? 'bg-secondary text-secondary-foreground font-semibold'
                        : 'text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40'
                    }`}
                  >{n}×</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Limit
              </p>
              <div className="flex items-center border border-border/50 rounded-md overflow-hidden">
                {LIMIT_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => onLimitChange(o.value)}
                    title={o.value === 0 ? 'All pending' : `Next ${o.value}`}
                    className={`flex-1 h-7 text-[11px] font-mono transition-colors border-r border-border/40 last:border-r-0 ${
                      limit === o.value
                        ? 'bg-secondary text-secondary-foreground font-semibold'
                        : 'text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40'
                    }`}
                  >{o.label}</button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {running ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums min-w-12 text-right">
              {progress?.done}<span className="opacity-40">/</span>{progress?.total}
            </span>
            <Button variant="ghost" size="sm" onClick={onCancel}
              className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-destructive">
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={onStart}
            disabled={!model}
            className="h-6 gap-1 text-xs font-medium px-2.5"
          >
            <Sparkles className="w-3 h-3" />
            {selectedCount > 0 ? `Translate ${selectedCount}` : 'Translate'}
          </Button>
        )}
      </div>

      {/* ── REFINE SECTION ── */}
      <div className="flex items-center gap-1 border border-amber-500/20 rounded-md px-1.5 py-0.5">
        <span className="text-[9px] font-medium uppercase tracking-widest text-amber-500/40 mr-0.5 select-none">
          RF
        </span>

        <Select value={refineModel} onValueChange={(v) => onRefineModelChange(v ?? '')} disabled={refining}>
          <SelectTrigger className="h-6 w-40 text-xs font-mono border-0 bg-transparent px-1 focus:ring-0">
            <SelectValue placeholder="No model" />
          </SelectTrigger>
          <SelectContent className="max-w-none w-auto min-w-(--radix-select-trigger-width)">
            {availableModels.map(m => (
              <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {refining ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums min-w-12 text-right">
              {refineProgress?.done}<span className="opacity-40">/</span>{refineProgress?.total}
            </span>
            <Button variant="ghost" size="sm" onClick={onCancelRefine}
              className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-destructive">
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onRefine}
            disabled={running || !refineModel}
            className="h-6 gap-1 text-xs font-medium px-2.5 border-amber-500/30 text-amber-400/80 hover:bg-amber-500/10"
          >
            <Wand2 className="w-3 h-3" />
            {selectedCount > 0 ? `Refine ${selectedCount}` : 'Refine'}
          </Button>
        )}
      </div>
    </div>
  )
}
