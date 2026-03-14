import { useOllamaStatus } from '@/hooks/useOllamaStatus'
import { useAppStore } from '@/stores/appStore'
import { OnboardingPage } from '@/features/onboarding'
import { FileImportButton } from '@/features/file-import'
import { ExportButton } from '@/features/file-export'
import { TranslationView } from '@/features/translation'
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
import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Languages, Star, Trash2 } from 'lucide-react'
import type { ProjectFile } from '@/types'

function Sidebar({ activeProject, onProjectOpened, onProjectDeleted }: {
  activeProject: ProjectFile | null
  onProjectOpened: (p: ProjectFile) => void
  onProjectDeleted: () => void
}) {
  async function handleDelete() {
    await invoke('delete_project', {
      projectId: activeProject!.project_id,
      gameDir: activeProject!.game_dir,
    })
    onProjectDeleted()
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10">
          <Star className="w-4 h-4 text-primary" />
        </div>
        <span className="font-semibold tracking-tight text-sidebar-foreground">hoshi-trans</span>
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="flex flex-col gap-3 p-4 flex-1">
        <FileImportButton onProjectOpened={onProjectOpened} />

        {activeProject && (
          <div className="flex flex-col gap-2">
            <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <p className="text-xs font-medium text-sidebar-foreground truncate flex-1">
                  {activeProject.game_title}
                </p>

                <AlertDialog>
                  <AlertDialogTrigger
                    title="Delete project"
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
              <p className="text-xs text-muted-foreground pl-5">
                {activeProject.engine.replace('_', ' ')}
              </p>
            </div>
            <ExportButton
              projectId={activeProject.project_id}
              gameDir={activeProject.game_dir}
              outputDir={activeProject.output_dir}
            />
          </div>
        )}
      </div>
    </aside>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <Languages className="w-8 h-8 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium">No game selected</p>
        <p className="text-sm text-muted-foreground">
          Open a game folder to start translating
        </p>
      </div>
    </div>
  )
}

function MainLayout() {
  const [activeProject, setActiveProject] = useState<ProjectFile | null>(null)

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        activeProject={activeProject}
        onProjectOpened={setActiveProject}
        onProjectDeleted={() => setActiveProject(null)}
      />
      <main className="flex-1 overflow-hidden">
        {activeProject
          ? <TranslationView projectId={activeProject.project_id} gameTitle={activeProject.game_title} />
          : <EmptyState />}
      </main>
    </div>
  )
}

export default function App() {
  useOllamaStatus()
  const ollamaOnline = useAppStore((s) => s.ollamaOnline)

  return ollamaOnline ? <MainLayout /> : <OnboardingPage />
}
