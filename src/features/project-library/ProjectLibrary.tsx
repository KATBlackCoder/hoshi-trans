import { invoke } from '@tauri-apps/api/core'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Languages, Trash2, ChevronRight } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { ProjectFile } from '@/types'

interface ProjectSummary {
  id: string
  game_dir: string
  game_title: string
  engine: string
  target_lang: string
  total: number
  translated: number
  pending: number
}

interface Props {
  onOpen: (project: ProjectFile) => void
}

const ENGINE_LABEL: Record<string, string> = {
  rpgmaker_mv_mz: 'RPG Maker MV/MZ',
  wolf_rpg: 'Wolf RPG',
  bakin: 'RPG Developer Bakin',
}

function ProgressBar({ translated, total }: { translated: number; total: number }) {
  const pct = total > 0 ? Math.round((translated / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1 bg-border/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500/70 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0 tabular-nums">
        {pct}%
      </span>
    </div>
  )
}

export function ProjectLibrary({ onOpen }: Props) {
  const qc = useQueryClient()

  const { data: projects = [] } = useQuery<ProjectSummary[]>({
    queryKey: ['projects-with-stats'],
    queryFn: () => invoke('get_projects_with_stats'),
  })

  const deleteProject = useMutation({
    mutationFn: ({ id, gameDir }: { id: string; gameDir: string }) =>
      invoke('delete_project', { projectId: id, gameDir }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects-with-stats'] })
      qc.invalidateQueries({ queryKey: ['projects-list'] })
    },
  })

  async function handleOpen(p: ProjectSummary) {
    const project = await invoke<ProjectFile>('open_project', { gameDir: p.game_dir })
    onOpen(project)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 shrink-0">
        <h1 className="text-base font-semibold">Projects</h1>
        <p className="text-xs text-muted-foreground/60 mt-0.5">
          Click a project to open it, or use "Open a game" to add a new one.
        </p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center border border-border">
              <Languages className="w-4 h-4 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">No projects yet</p>
              <p className="text-xs text-muted-foreground/50 mt-0.5">
                Use "Open a game" in the sidebar to get started.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => handleOpen(p)}
                className="group relative rounded-lg border border-border/60 bg-card/50 p-4 cursor-pointer hover:border-primary/40 hover:bg-card transition-all"
              >
                {/* Delete button */}
                <AlertDialog>
                  <AlertDialogTrigger
                    onClick={e => e.stopPropagation()}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/30 hover:text-destructive"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove <strong>{p.game_title}</strong> and all its
                        translations. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={e => {
                          e.stopPropagation()
                          deleteProject.mutate({ id: p.id, gameDir: p.game_dir })
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Engine badge */}
                <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  {ENGINE_LABEL[p.engine] ?? p.engine}
                </span>

                {/* Title */}
                <p className="text-sm font-medium mt-1 pr-5 leading-snug line-clamp-2">
                  {p.game_title}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-3 mt-2 text-[11px] font-mono">
                  <span className="text-emerald-500/80">{p.translated} done</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground/60">{p.pending} pending</span>
                </div>

                <ProgressBar translated={p.translated} total={p.total} />

                {/* Open arrow */}
                <div className="flex items-center justify-end mt-3">
                  <span className="text-[10px] text-muted-foreground/30 group-hover:text-primary/60 transition-colors flex items-center gap-0.5">
                    Open <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
