import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import type { FileStats } from '@/types'

interface Props {
  projectId: string
  onFileClick: (filePath: string) => void
}

export function FileStatsPanel({ projectId, onFileClick }: Props) {
  const { data: files = [] } = useQuery({
    queryKey: ['file_stats', projectId],
    queryFn: () => invoke<FileStats[]>('get_file_stats', { projectId }),
  })

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground/50">
        No files extracted yet
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
      {files.map(f => {
        const short = f.file_path.split('/').pop() ?? f.file_path
        const donePct = f.total > 0 ? Math.round((f.translated / f.total) * 100) : 0
        const warningPct = f.total > 0 ? Math.round((f.warning / f.total) * 100) : 0

        return (
          <button
            key={f.file_path}
            onClick={() => onFileClick(f.file_path)}
            className="w-full text-left px-3 py-2.5 rounded-md hover:bg-white/4 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono text-foreground/80 group-hover:text-foreground truncate max-w-[60%]" title={f.file_path}>
                {short}
              </span>
              <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono">
                {f.warning > 0 && (
                  <span className="text-amber-400/70">{f.warning}⚠</span>
                )}
                {f.pending > 0 && (
                  <span className="text-muted-foreground/50">{f.pending} pending</span>
                )}
                <span className="text-muted-foreground/40">{f.translated}/{f.total}</span>
                <span className={`font-semibold tabular-nums ${donePct === 100 ? 'text-emerald-400' : 'text-foreground/60'}`}>
                  {donePct}%
                </span>
              </div>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500/60 transition-all"
                style={{ width: `${donePct}%` }}
              />
              {f.warning > 0 && (
                <div
                  className="h-full bg-amber-400/50 transition-all"
                  style={{ width: `${warningPct}%` }}
                />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
