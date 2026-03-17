import { useState } from 'react'
import { Terminal, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore, DEFAULT_OLLAMA_HOST } from '@/stores/appStore'

export function OnboardingPage() {
  const { settings, updateSettings } = useAppStore()
  const [hostDraft, setHostDraft] = useState(settings.ollamaHost)
  const [saved, setSaved] = useState(false)

  function saveHost() {
    const trimmed = hostDraft.trim() || DEFAULT_OLLAMA_HOST
    setHostDraft(trimmed)
    updateSettings({ ollamaHost: trimmed })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex items-center justify-center h-screen bg-background relative overflow-hidden">
      {/* Decorative 星 kanji watermark */}
      <span
        className="absolute select-none pointer-events-none font-bold leading-none"
        style={{
          fontSize: '38vw',
          color: 'oklch(1 0 0 / 2.5%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-44%, -50%)',
        }}
        aria-hidden
      >
        星
      </span>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-xs w-full px-6">
        {/* Logo + animated waiting indicator */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            {/* Pulsing rings */}
            <span className="absolute w-14 h-14 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '2.4s' }} />
            <span className="absolute w-10 h-10 rounded-full border border-primary/30 animate-ping" style={{ animationDuration: '2.4s', animationDelay: '0.4s' }} />
            {/* Icon */}
            <div className="relative w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center shadow-lg">
              <span className="text-primary text-xl font-bold leading-none select-none">星</span>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-base font-semibold tracking-tight">
              <span className="text-foreground">hoshi</span>
              <span className="text-muted-foreground font-light">-trans</span>
            </h1>
            <div className="flex items-center justify-center gap-1.5 mt-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 animate-pulse" />
              <p className="text-xs text-muted-foreground/60">Waiting for Ollama…</p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="w-full flex flex-col gap-2">
          <Step number={1}
            icon={<Wifi className="w-3.5 h-3.5" />}
            title="Install Ollama"
            description={<>Download from <span className="font-mono text-primary text-[11px]">ollama.com</span></>}
          />
          <Step number={2}
            icon={<Terminal className="w-3.5 h-3.5" />}
            title="Pull a model"
            description={
              <code className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[11px] text-foreground/70">
                ollama pull qwen2.5:7b
              </code>
            }
          />
          <Step number={3}
            icon={<span className="text-[11px] font-bold text-primary">→</span>}
            title="Keep it running"
            description="This screen disappears automatically"
          />
        </div>

        {/* Ollama host override */}
        <div className="w-full flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={hostDraft}
              onChange={(e) => setHostDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveHost()}
              className="font-mono text-xs h-7 bg-card/50"
              placeholder="http://localhost:11434"
            />
            <Button size="sm" className="text-xs h-7 shrink-0" onClick={saveHost}>
              {saved ? '✓' : 'Connect'}
            </Button>
          </div>
          <button
            className="text-[10px] text-muted-foreground/40 font-mono hover:text-muted-foreground/70 transition-colors text-left"
            onClick={() => { setHostDraft(DEFAULT_OLLAMA_HOST); updateSettings({ ollamaHost: DEFAULT_OLLAMA_HOST }) }}
          >
            Reset to localhost:11434
          </button>
        </div>
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
    <div className="flex items-start gap-3 px-3 py-2.5 rounded border border-border/50 bg-card/50">
      <div className="w-5 h-5 rounded bg-muted/60 flex items-center justify-center shrink-0 text-muted-foreground mt-0.5">
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9.5px] font-mono text-muted-foreground/40 uppercase tracking-widest">Step {number}</span>
        </div>
        <p className="text-xs font-medium">{title}</p>
        <div className="text-[11px] text-muted-foreground/60">{description}</div>
      </div>
    </div>
  )
}
