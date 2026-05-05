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
  rpgmaker_mv_mz: 'text-violet-400',
  wolf_rpg: 'text-sky-400',
  bakin: 'text-amber-400',
}

function ProgressBar({ translated, total }: { translated: number; total: number }) {
  const pct = total > 0 ? Math.round((translated / total) * 100) : 0
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold font-mono text-muted-foreground uppercase tracking-widest">Progress</span>
        <span className="text-[10px] font-mono font-bold text-primary tabular-nums">{pct}%</span>
      </div>
      <div className="h-1 bg-background border border-border rounded-sm overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct === 100
              ? 'oklch(0.72 0.19 145)'
              : 'oklch(0.86 0.17 95)',
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
      <div className="px-8 pt-7 pb-5 shrink-0 flex items-center justify-between gap-4 border-b-2 border-primary">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-extrabold uppercase tracking-tight">Projects</h1>
          {projects.length > 0 && (
            <span className="text-[10px] font-mono font-bold text-primary-foreground bg-primary px-1.5 py-0.5 rounded-sm tabular-nums uppercase tracking-wider">
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
                className="group relative rounded-sm border border-border bg-card/40 p-4 cursor-pointer hover:border-primary/55 hover:bg-card/70 transition-all duration-150 overflow-hidden"
              >
                {/* Top yellow accent on hover */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

                <AlertDialog>
                  <AlertDialogTrigger
                    onClick={e => e.stopPropagation()}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/15"
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

                <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${ENGINE_COLOR[p.engine] ?? 'text-muted-foreground'}`}>
                  {ENGINE_LABEL[p.engine] ?? p.engine}
                </span>

                <p className="text-sm font-bold uppercase tracking-tight mt-1.5 pr-6 leading-snug line-clamp-2 text-foreground">
                  {p.game_title}
                </p>

                <div className="flex items-center gap-2 mt-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500 shrink-0" />
                    <span className="text-[10px] font-mono font-bold text-emerald-400 tabular-nums">{p.translated}</span>
                  </div>
                  <span className="text-primary text-[10px] font-bold">/</span>
                  <span className="text-[10px] font-mono font-bold text-muted-foreground tabular-nums">{p.total} total</span>
                </div>

                <ProgressBar translated={p.translated} total={p.total} />

                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border">
                  <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
                    {p.target_lang === 'fr' ? '🇫🇷 French' : '🇬🇧 English'}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-0.5">
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
