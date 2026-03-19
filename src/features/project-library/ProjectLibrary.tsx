import { invoke } from '@tauri-apps/api/core'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, ArrowRight, FolderOpen } from 'lucide-react'
import { FileImportButton } from '@/features/file-import'
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

const ENGINE_COLOR: Record<string, string> = {
  rpgmaker_mv_mz: 'text-violet-400/70',
  wolf_rpg: 'text-sky-400/70',
  bakin: 'text-amber-400/70',
}

function ProgressBar({ translated, total }: { translated: number; total: number }) {
  const pct = total > 0 ? Math.round((translated / total) * 100) : 0
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider">Progress</span>
        <span className="text-[10px] font-mono text-muted-foreground/50 tabular-nums">{pct}%</span>
      </div>
      <div className="h-0.75 bg-border/30 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct === 100
              ? 'oklch(0.72 0.17 145)'
              : 'linear-gradient(90deg, oklch(0.72 0.17 145 / 80%), oklch(0.80 0.15 145))',
          }}
        />
      </div>
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
      <div className="px-8 pt-7 pb-5 shrink-0 flex items-center justify-between gap-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-tight">Projects</h1>
          {projects.length > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground/40 bg-muted/40 px-1.5 py-0.5 rounded-md tabular-nums">
              {projects.length}
            </span>
          )}
        </div>
        <FileImportButton onProjectOpened={onOpen} />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pb-12">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-muted-foreground/30" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm font-medium text-foreground/70">No projects yet</p>
              <p className="text-xs text-muted-foreground/40">Open a game folder to get started</p>
            </div>
            <FileImportButton onProjectOpened={onOpen} />
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => handleOpen(p)}
                className="group relative rounded-xl border border-border/50 bg-card/40 p-4 cursor-pointer hover:border-primary/30 hover:bg-card/80 transition-all duration-200 overflow-hidden"
              >
                {/* Subtle top gradient accent */}
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-border/60 to-transparent group-hover:via-primary/30 transition-all" />

                {/* Delete button */}
                <AlertDialog>
                  <AlertDialogTrigger
                    onClick={e => e.stopPropagation()}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10"
                    title="Delete project"
                  >
                    <Trash2 className="w-3 h-3" />
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
                <span className={`text-[9px] font-mono uppercase tracking-widest font-medium ${ENGINE_COLOR[p.engine] ?? 'text-muted-foreground/40'}`}>
                  {ENGINE_LABEL[p.engine] ?? p.engine}
                </span>

                {/* Title */}
                <p className="text-sm font-semibold mt-1.5 pr-6 leading-snug line-clamp-2 text-foreground/90">
                  {p.game_title}
                </p>

                {/* Stats row */}
                <div className="flex items-center gap-2 mt-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 shrink-0" />
                    <span className="text-[10px] font-mono text-emerald-500/70 tabular-nums">{p.translated}</span>
                  </div>
                  <span className="text-muted-foreground/25 text-[10px]">/</span>
                  <span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums">{p.total} total</span>
                </div>

                <ProgressBar translated={p.translated} total={p.total} />

                {/* Open indicator */}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/30">
                  <span className="text-[9px] font-mono text-muted-foreground/25 uppercase tracking-wider">
                    {p.target_lang === 'fr' ? '🇫🇷 French' : '🇬🇧 English'}
                  </span>
                  <span className="text-[10px] text-muted-foreground/25 group-hover:text-primary/50 transition-colors flex items-center gap-0.5 font-medium">
                    Open <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
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
