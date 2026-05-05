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
          color: 'oklch(0.86 0.17 95 / 3%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-44%, -50%)',
        }}
        aria-hidden
      >
        星
      </span>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-xs w-full px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-14 h-14 rounded-sm border border-primary/40 animate-ping" style={{ animationDuration: '2.4s' }} />
            <span className="absolute w-10 h-10 rounded-sm border border-primary/60 animate-ping" style={{ animationDuration: '2.4s', animationDelay: '0.4s' }} />
            <div className="relative w-12 h-12 rounded-sm bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xl font-bold leading-none select-none">星</span>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-base font-extrabold uppercase tracking-tight">
              <span className="text-foreground">hoshi</span>
              <span className="text-primary">-trans</span>
            </h1>
            <div className="flex items-center justify-center gap-1.5 mt-1.5">
              <span className="w-1.5 h-1.5 rounded-sm bg-amber-400 animate-pulse" />
              <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Waiting for Ollama…</p>
            </div>
          </div>
        </div>

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
              <code className="font-mono bg-background border border-border px-1.5 py-0.5 rounded-sm text-[11px] text-foreground">
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

        <div className="w-full flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={hostDraft}
              onChange={(e) => setHostDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveHost()}
              placeholder="http://localhost:11434"
            />
            <Button size="sm" onClick={saveHost}>
              {saved ? '✓' : 'Connect'}
            </Button>
          </div>
          <button
            className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/55 hover:text-primary transition-colors text-left"
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
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-sm border border-border bg-card/40">
      <div className="w-5 h-5 rounded-sm bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 text-primary mt-0.5">
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9.5px] font-mono font-bold text-primary uppercase tracking-widest">Step {number}</span>
        </div>
        <p className="text-xs font-bold uppercase tracking-wider">{title}</p>
        <div className="text-[11px] text-muted-foreground">{description}</div>
      </div>
    </div>
  )
}
