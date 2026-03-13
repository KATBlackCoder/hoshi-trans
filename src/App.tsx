import { useOllamaStatus } from '@/hooks/useOllamaStatus'
import { useAppStore } from '@/stores/appStore'
import { OnboardingPage } from '@/features/onboarding'
import { FileImportButton } from '@/features/file-import'
import { TranslationView } from '@/features/translation'
import { useState } from 'react'
import type { ProjectFile } from '@/types'

function MainLayout() {
  const [activeProject, setActiveProject] = useState<ProjectFile | null>(null)

  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r p-4 flex flex-col gap-4">
        <p className="font-semibold">hoshi-trans</p>
        <FileImportButton onProjectOpened={setActiveProject} />
        {activeProject && (
          <p className="text-xs text-muted-foreground truncate">{activeProject.game_title}</p>
        )}
      </aside>
      <main className="flex-1 overflow-y-auto">
        {activeProject ? (
          <TranslationView projectId={activeProject.project_id} />
        ) : (
          <div className="p-6">
            <p className="text-muted-foreground">Select a game to get started.</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default function App() {
  useOllamaStatus()
  const ollamaOnline = useAppStore((s) => s.ollamaOnline)

  return ollamaOnline ? <MainLayout /> : <OnboardingPage />
}
