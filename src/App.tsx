import { useOllamaStatus } from '@/hooks/useOllamaStatus'
import { useAppStore } from '@/stores/appStore'
import { OnboardingPage } from '@/features/onboarding'
import { FileImportButton } from '@/features/file-import'
import { TranslationView } from '@/features/translation'
import { Separator } from '@/components/ui/separator'
import { useState } from 'react'
import { Languages, Star } from 'lucide-react'
import type { ProjectFile } from '@/types'

function Sidebar({ activeProject, onProjectOpened }: {
  activeProject: ProjectFile | null
  onProjectOpened: (p: ProjectFile) => void
}) {
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
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {activeProject.game_title}
              </p>
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              {activeProject.engine.replace('_', ' ')}
            </p>
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
      <Sidebar activeProject={activeProject} onProjectOpened={setActiveProject} />
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
