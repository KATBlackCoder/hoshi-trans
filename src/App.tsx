import { useOllamaStatus } from '@/hooks/useOllamaStatus'
import { useAppStore } from '@/stores/appStore'
import { OnboardingPage } from '@/features/onboarding'

function MainLayout() {
  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r p-4">
        <p className="font-semibold">hoshi-trans</p>
      </aside>
      <main className="flex-1 p-6">
        <p className="text-muted-foreground">Select a game to get started.</p>
      </main>
    </div>
  )
}

export default function App() {
  useOllamaStatus()
  const ollamaOnline = useAppStore((s) => s.ollamaOnline)

  return ollamaOnline ? <MainLayout /> : <OnboardingPage />
}
