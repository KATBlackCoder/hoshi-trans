import { Star, Terminal, Wifi } from 'lucide-react'

export function OnboardingPage() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-8 max-w-sm w-full px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Star className="w-7 h-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">hoshi-trans</h1>
            <p className="text-sm text-muted-foreground mt-1">Ollama not detected</p>
          </div>
        </div>

        {/* Steps */}
        <div className="w-full flex flex-col gap-3">
          <Step icon={<Wifi className="w-4 h-4" />} number={1}
            title="Install Ollama"
            description={<>Download from <span className="font-mono text-primary text-xs">ollama.com</span></>}
          />
          <Step icon={<Terminal className="w-4 h-4" />} number={2}
            title="Pull a model"
            description={
              <code className="font-mono bg-muted px-2 py-0.5 rounded text-xs">
                ollama pull qwen2.5:7b
              </code>
            }
          />
          <Step icon={<Star className="w-4 h-4" />} number={3}
            title="Keep Ollama running"
            description="This screen disappears automatically once detected"
          />
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Connecting to{' '}
          <code className="font-mono bg-muted px-1.5 py-0.5 rounded">localhost:11434</code>
        </p>
      </div>
    </div>
  )
}

function Step({ number, icon, title, description }: {
  number: number
  icon: React.ReactNode
  title: string
  description: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Step {number}</span>
        </div>
        <p className="text-sm font-medium">{title}</p>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  )
}
