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
import React, { useEffect, useState } from 'react'
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

  const navBtn = (v: View, label: string, icon: React.ReactNode) => {
    const active = view === v
    const toggle = active ? (activeProject ? 'translation' : 'library') : v
    return (
      <button
        onClick={() => onViewChange(toggle)}
        className={`relative flex items-center gap-2 px-3.5 py-2 text-xs transition-colors ${
          active
            ? 'text-foreground font-medium'
            : 'text-muted-foreground/60 hover:text-foreground hover:bg-sidebar-accent/40'
        }`}
      >
        {active && <span className="absolute left-0 inset-y-1.5 w-0.5 bg-primary rounded-r" />}
        {icon}
        {label}
      </button>
    )
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-primary/12 border border-primary/20 shrink-0">
          <span className="text-primary text-[13px] font-bold leading-none select-none">星</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">hoshi</span>
          <span className="text-sm font-light text-muted-foreground/50 tracking-tight">trans</span>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="flex flex-col gap-2 p-3 flex-1 overflow-y-auto">
        <FileImportButton onProjectOpened={(p) => { onProjectOpened(p); onViewChange('translation') }} />

        {activeProject && (
          <div className="flex flex-col gap-1">
            {/* Back to library */}
            <button
              onClick={() => onViewChange('library')}
              className="flex items-center gap-1 text-[10px] text-muted-foreground/35 hover:text-muted-foreground/70 transition-colors px-1 py-0.5"
            >
              <ChevronLeft className="w-3 h-3" />
              All projects
            </button>

            {/* Active project card */}
            <div
              onClick={() => onViewChange('translation')}
              className={`rounded-lg border overflow-hidden cursor-pointer transition-all duration-150 ${
                view === 'translation'
                  ? 'border-primary/35 bg-primary/6'
                  : 'border-sidebar-border/80 bg-sidebar-accent/20 hover:bg-sidebar-accent/40 hover:border-sidebar-border'
              }`}
            >
              <div className="flex items-start gap-2 p-2.5 pb-1.5">
                <Languages className="w-3 h-3 text-primary/70 mt-0.5 shrink-0" />
                <p className="text-[11px] font-medium text-sidebar-foreground leading-tight flex-1 min-w-0 wrap-break-word">
                  {activeProject.game_title}
                </p>
                <AlertDialog>
                  <AlertDialogTrigger
                    onClick={e => e.stopPropagation()}
                    title="Delete project"
                    className="text-muted-foreground/30 hover:text-destructive transition-colors shrink-0 mt-0.5 p-0.5 rounded hover:bg-destructive/10"
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
              <p className="text-[9px] text-muted-foreground/40 font-mono px-2.5 pb-2 uppercase tracking-wider">
                {activeProject.engine.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Nav buttons — bottom of sidebar */}
      <Separator className="bg-sidebar-border" />
      <div className="flex flex-col py-1">
        {navBtn('glossary', 'Glossary', <BookOpen className="w-3.5 h-3.5" />)}
        {navBtn('settings', 'Settings', <Settings className="w-3.5 h-3.5" />)}
        {navBtn('about', 'About', <Info className="w-3.5 h-3.5" />)}
      </div>
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
