import { useOllamaStatus } from '@/hooks/useOllamaStatus'
import { useAppStore } from '@/stores/appStore'
import { OnboardingPage } from '@/features/onboarding'
import { FileImportButton } from '@/features/file-import'
import { TranslationView } from '@/features/translation'
import { SettingsPage } from '@/features/settings'
import { GlossaryPage } from '@/features/glossary'
import { ProjectLibrary } from '@/features/project-library'
import { AboutPage } from '@/features/about'
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
import { BookOpen, ChevronLeft, Info, Languages, Settings, Trash2 } from 'lucide-react'
import type { ProjectFile } from '@/types'

type View = 'library' | 'translation' | 'settings' | 'glossary' | 'about'

function Sidebar({ activeProject, onProjectOpened, onProjectDeleted, view, onViewChange }: {
  activeProject: ProjectFile | null
  onProjectOpened: (p: ProjectFile) => void
  onProjectDeleted: () => void
  view: View
  onViewChange: (v: View) => void
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
        <FileImportButton onProjectOpened={(p) => { onProjectOpened(p); onViewChange('translation') }} />

        {activeProject && (
          <div className="flex flex-col gap-1.5">
            {/* Back to library */}
            <button
              onClick={() => onViewChange('library')}
              className="flex items-center gap-1 text-[10.5px] text-muted-foreground/40 hover:text-muted-foreground transition-colors px-0.5 mb-0.5"
            >
              <ChevronLeft className="w-3 h-3" />
              All projects
            </button>

            {/* Active project card — click to open translation view */}
            <div
              onClick={() => onViewChange('translation')}
              className={`rounded border overflow-hidden cursor-pointer transition-colors ${
                view === 'translation'
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-sidebar-border bg-sidebar-accent/30 hover:bg-sidebar-accent/50'
              }`}
            >
              <div className="flex items-start gap-2 p-2.5 pb-1.5">
                <Languages className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                <p className="text-xs font-medium text-sidebar-foreground leading-tight flex-1 min-w-0 wrap-break-word">
                  {activeProject.game_title}
                </p>
                <AlertDialog>
                  <AlertDialogTrigger
                    onClick={e => e.stopPropagation()}
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
          </div>
        )}
      </div>

      {/* Nav buttons — bottom of sidebar */}
      <Separator className="bg-sidebar-border" />
      <button
        onClick={() => onViewChange(view === 'glossary' ? (activeProject ? 'translation' : 'library') : 'glossary')}
        className={`flex items-center gap-2 px-3.5 py-2.5 text-xs transition-colors ${
          view === 'glossary'
            ? 'text-primary font-medium bg-primary/8'
            : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
        }`}
      >
        <BookOpen className="w-3.5 h-3.5" />
        Glossary
      </button>
      <button
        onClick={() => onViewChange(view === 'settings' ? (activeProject ? 'translation' : 'library') : 'settings')}
        className={`flex items-center gap-2 px-3.5 py-2.5 text-xs transition-colors ${
          view === 'settings'
            ? 'text-primary font-medium bg-primary/8'
            : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
        }`}
      >
        <Settings className="w-3.5 h-3.5" />
        Settings
      </button>
      <button
        onClick={() => onViewChange(view === 'about' ? (activeProject ? 'translation' : 'library') : 'about')}
        className={`flex items-center gap-2 px-3.5 py-2.5 text-xs transition-colors ${
          view === 'about'
            ? 'text-primary font-medium bg-primary/8'
            : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
        }`}
      >
        <Info className="w-3.5 h-3.5" />
        About
      </button>
    </aside>
  )
}

function MainLayout() {
  const [activeProject, setActiveProject] = useState<ProjectFile | null>(null)
  const [view, setView] = useState<View>('library')

  function handleProjectOpened(p: ProjectFile) {
    setActiveProject(p)
    setView('translation')
  }

  function handleProjectDeleted() {
    setActiveProject(null)
    setView('library')
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        activeProject={activeProject}
        onProjectOpened={handleProjectOpened}
        onProjectDeleted={handleProjectDeleted}
        view={view}
        onViewChange={setView}
      />
      <main className="flex-1 overflow-hidden">
        {view === 'settings' ? (
          <SettingsPage />
        ) : view === 'glossary' ? (
          <GlossaryPage />
        ) : view === 'about' ? (
          <AboutPage />
        ) : view === 'translation' && activeProject ? (
          <TranslationView
            projectId={activeProject.project_id}
            gameTitle={activeProject.game_title}
            gameDir={activeProject.game_dir}
            outputDir={activeProject.output_dir}
          />
        ) : (
          <ProjectLibrary onOpen={handleProjectOpened} />
        )}
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
