import { useOllamaStatus } from '@/hooks/useOllamaStatus'
import { useAppStore } from '@/stores/appStore'
import { OnboardingPage } from '@/features/onboarding'
import { FileImportButton } from '@/features/file-import'
import { DebugExportButton, ExportButton } from '@/features/file-export'
import { TranslationView } from '@/features/translation'
import { SettingsPage } from '@/features/settings'
import { GlossaryPanel } from '@/features/glossary'
import { Separator } from '@/components/ui/separator'
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
import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Languages, Settings, Trash2 } from 'lucide-react'
import type { ProjectFile } from '@/types'

function Sidebar({ activeProject, onProjectOpened, onProjectDeleted, view, onSettingsToggle }: {
  activeProject: ProjectFile | null
  onProjectOpened: (p: ProjectFile) => void
  onProjectDeleted: () => void
  view: 'main' | 'settings'
  onSettingsToggle: () => void
}) {
  async function handleDelete() {
    await invoke('delete_project', {
      projectId: activeProject!.project_id,
      gameDir: activeProject!.game_dir,
    })
    onProjectDeleted()
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <div className="flex items-center justify-center w-6 h-6 rounded bg-primary/15 shrink-0">
          <span className="text-primary text-[11px] font-bold leading-none select-none">星</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">hoshi</span>
          <span className="text-sm font-light text-muted-foreground tracking-tight">trans</span>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="flex flex-col gap-2.5 p-3 flex-1 overflow-y-auto">
        <FileImportButton onProjectOpened={onProjectOpened} />

        {activeProject && (
          <div className="flex flex-col gap-2">
            {/* Active project card */}
            <div className="rounded border border-sidebar-border bg-sidebar-accent/30 overflow-hidden">
              <div className="flex items-start gap-2 p-2.5 pb-1.5">
                <Languages className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                <p className="text-xs font-medium text-sidebar-foreground leading-tight flex-1 min-w-0 wrap-break-word">
                  {activeProject.game_title}
                </p>
                <AlertDialog>
                  <AlertDialogTrigger
                    title="Delete project"
                    className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0 mt-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove <strong>{activeProject.game_title}</strong> and
                        all its translations from the database. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <p className="text-[10px] text-muted-foreground/60 font-mono px-2.5 pb-2">
                {activeProject.engine.replace(/_/g, ' ')}
              </p>
            </div>

            <ExportButton
              projectId={activeProject.project_id}
              gameDir={activeProject.game_dir}
              outputDir={activeProject.output_dir}
            />
            <DebugExportButton
              projectId={activeProject.project_id}
              outputDir={activeProject.output_dir}
            />

            <div className="pt-1">
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest px-0.5 mb-1.5">
                Glossary
              </p>
              <GlossaryPanel projectId={activeProject.project_id} />
            </div>
          </div>
        )}
      </div>

      {/* Settings button — bottom of sidebar */}
      <Separator className="bg-sidebar-border" />
      <button
        onClick={onSettingsToggle}
        className={`flex items-center gap-2 px-3.5 py-2.5 text-xs transition-colors ${
          view === 'settings'
            ? 'text-primary font-medium bg-primary/8'
            : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
        }`}
      >
        <Settings className="w-3.5 h-3.5" />
        Settings
      </button>
    </aside>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-8 relative overflow-hidden">
      {/* Decorative kanji watermark */}
      <span
        className="absolute text-[200px] font-bold leading-none select-none pointer-events-none"
        style={{ color: 'oklch(1 0 0 / 3%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        aria-hidden
      >
        翻
      </span>
      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center border border-border">
          <Languages className="w-5 h-5 text-muted-foreground/50" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted-foreground">No game selected</p>
          <p className="text-xs text-muted-foreground/50">
            Open a game folder to start translating
          </p>
        </div>
      </div>
    </div>
  )
}

function MainLayout() {
  const [activeProject, setActiveProject] = useState<ProjectFile | null>(null)
  const [view, setView] = useState<'main' | 'settings'>('main')

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        activeProject={activeProject}
        onProjectOpened={(p) => { setActiveProject(p); setView('main') }}
        onProjectDeleted={() => setActiveProject(null)}
        view={view}
        onSettingsToggle={() => setView(v => v === 'settings' ? 'main' : 'settings')}
      />
      <main className="flex-1 overflow-hidden">
        {view === 'settings'
          ? <SettingsPage />
          : activeProject
            ? <TranslationView projectId={activeProject.project_id} gameTitle={activeProject.game_title} />
            : <EmptyState />}
      </main>
    </div>
  )
}

export default function App() {
  useOllamaStatus()
  const ollamaOnline = useAppStore((s) => s.ollamaOnline)
  const loadSettings = useAppStore((s) => s.loadSettings)
  useEffect(() => { loadSettings() }, [loadSettings])

  return ollamaOnline ? <MainLayout /> : <OnboardingPage />
}
