import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useAppStore, DEFAULT_OLLAMA_HOST } from '@/stores/appStore'
import { HOSHI_MODEL_INFO } from '@/lib/models'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Thermometer, Globe, Cpu, Wifi, WifiOff, Check } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
      {children}
    </p>
  )
}

export function OllamaPage() {
  const { settings, updateSettings, availableModels: allModels } = useAppStore()
  const availableModels = allModels.filter(m => m.includes('hoshi-translator'))
  const ollamaOnline = useAppStore((s) => s.ollamaOnline)
  const [hostDraft, setHostDraft] = useState(settings.ollamaHost)
  const [saved, setSaved] = useState(false)
  const [installing, setInstalling] = useState<'4b' | 'abliterated-4b' | '30b' | null>(null)
  const [installLines, setInstallLines] = useState<string[]>([])
  const [installFallback, setInstallFallback] = useState<string | null>(null)
  const [installDone, setInstallDone] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unlistenProgress = listen<{ line: string }>('modelfile:progress', (e) => {
      setInstallLines((prev) => [...prev.slice(-50), e.payload.line])
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999 }), 10)
    })
    const unlistenDone = listen<string>('modelfile:done', (e) => {
      setInstalling(null)
      setInstallDone(e.payload)
    })
    const unlistenFallback = listen<{ command: string }>('modelfile:fallback', (e) => {
      setInstalling(null)
      setInstallFallback(e.payload.command)
    })
    return () => {
      unlistenProgress.then((f) => f())
      unlistenDone.then((f) => f())
      unlistenFallback.then((f) => f())
    }
  }, [])

  async function startInstall(model: '4b' | 'abliterated-4b' | '30b') {
    setInstalling(model)
    setInstallLines([])
    setInstallFallback(null)
    setInstallDone(null)
    try {
      await invoke('install_modelfile', { model })
    } catch (e) {
      setInstalling(null)
      setInstallLines((prev) => [...prev, `Error: ${e}`])
    }
  }

  const langLabel = settings.targetLang === 'en' ? 'English' : 'French'
  const tempLabel = settings.temperature <= 0.2
    ? 'Very consistent'
    : settings.temperature <= 0.4
    ? 'Consistent'
    : settings.temperature <= 0.6
    ? 'Balanced'
    : settings.temperature <= 0.8
    ? 'Creative'
    : 'Very creative'

  function saveHost() {
    const trimmed = hostDraft.trim() || DEFAULT_OLLAMA_HOST
    setHostDraft(trimmed)
    updateSettings({ ollamaHost: trimmed })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 pb-0 flex flex-col gap-5 flex-1 min-h-0">

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Ollama</h2>
            <p className="text-[11px] text-muted-foreground/40 mt-0.5">Connection, model, and generation settings.</p>
          </div>

          <div className={`flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full border text-[10.5px] font-mono transition-colors ${
            ollamaOnline
              ? 'border-green-500/20 bg-green-500/5 text-green-400/80'
              : 'border-amber-500/20 bg-amber-500/5 text-amber-400/80'
          }`}>
            {ollamaOnline
              ? <Wifi className="w-3 h-3" />
              : <WifiOff className="w-3 h-3" />
            }
            <span>{ollamaOnline ? 'Online' : 'Offline'}</span>
            {availableModels.length > 0 && (
              <span className="opacity-40">· {availableModels.length} hoshi</span>
            )}
            <span className="opacity-30">·</span>
            <span className="opacity-50">Local</span>
          </div>
        </div>

        {/* ── Two-column layout ─────────────────────────────────── */}
        <div className="flex gap-5 flex-1 min-h-0">

          {/* LEFT ─ Settings */}
          <div className="flex flex-col gap-5 w-105 shrink-0 overflow-y-auto pr-1 pb-6">

            {/* Connection & Model */}
            <div className="rounded-lg border border-border/30 bg-card/20 overflow-hidden">
              <div className="px-4 pt-3.5 pb-0.5">
                <SectionLabel>Connection &amp; Model</SectionLabel>
              </div>
              <div className="px-4 pb-4 flex flex-col gap-3.5">

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10.5px] text-muted-foreground/70">Host URL</Label>
                  <div className="flex gap-1.5">
                    <Input
                      value={hostDraft}
                      onChange={(e) => setHostDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveHost()}
                      className="font-mono text-xs h-8 flex-1 bg-background/60"
                      placeholder="http://localhost:11434"
                    />
                    <Button size="sm" variant="outline" className="text-[10.5px] h-8 px-3 shrink-0 text-muted-foreground/60" onClick={() => setHostDraft(DEFAULT_OLLAMA_HOST)}>
                      Local
                    </Button>
                    <Button size="sm" className="text-[10.5px] h-8 px-3 shrink-0" onClick={saveHost}>
                      {saved ? <Check className="w-3.5 h-3.5 text-green-400" /> : 'Save'}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3.5">
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <Label className="text-[10.5px] text-muted-foreground/70">Model</Label>
                    <Select
                      value={settings.ollamaModel}
                      onValueChange={(v) => updateSettings({ ollamaModel: v ?? '' })}
                    >
                      <SelectTrigger className="font-mono text-xs h-8 bg-background/60">
                        <SelectValue placeholder="Select a model…" />
                      </SelectTrigger>
                      <SelectContent className="max-w-none w-auto min-w-(--radix-select-trigger-width)">
                        {availableModels.map((m) => (
                          <SelectItem key={m} value={m} className="font-mono text-xs">
                            <span>hoshi-translator</span>
                            {HOSHI_MODEL_INFO[m] && (
                              <span className="ml-1.5 text-[9px] text-muted-foreground/50 font-normal">{HOSHI_MODEL_INFO[m]}</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5 w-36 shrink-0">
                    <Label className="text-[10.5px] text-muted-foreground/70">Language</Label>
                    <Select
                      value={settings.targetLang}
                      onValueChange={(v) => updateSettings({ targetLang: v as 'en' | 'fr' })}
                    >
                      <SelectTrigger className="text-xs h-8 bg-background/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Generation */}
            <div className="rounded-lg border border-border/30 bg-card/20 overflow-hidden">
              <div className="px-4 pt-3.5 pb-0.5">
                <SectionLabel>Generation</SectionLabel>
              </div>
              <div className="px-4 pb-4 flex flex-col gap-3.5">

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10.5px] text-muted-foreground/70">Temperature</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[9.5px] text-muted-foreground/55">{tempLabel}</span>
                      <span className="text-xs font-mono text-primary tabular-nums">{settings.temperature.toFixed(1)}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={settings.temperature}
                    onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
                    className="w-full accent-amber-400 h-1"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10.5px] text-muted-foreground/70">System prompt</Label>
                    <span className="text-[9.5px] text-muted-foreground/50">Use <code className="font-mono">{'{lang}'}</code> for language</span>
                  </div>
                  <Textarea
                    value={settings.systemPrompt}
                    onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                    rows={5}
                    className="font-mono text-[11px] leading-relaxed resize-none bg-background/60 text-foreground/80"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT ─ Summary */}
          <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pb-6">

            {/* Active config */}
            <div className="rounded-lg border border-border/30 bg-card/20 overflow-hidden">
              <div className="px-4 pt-3.5 pb-1">
                <SectionLabel>Active configuration</SectionLabel>
              </div>
              <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                {[
                  {
                    icon: <Cpu className="w-3.5 h-3.5" />,
                    label: 'Model',
                    value: settings.ollamaModel || 'None selected',
                    sub: 'Local Ollama',
                  },
                  {
                    icon: <Globe className="w-3.5 h-3.5" />,
                    label: 'Target language',
                    value: langLabel,
                    sub: `JP → ${langLabel}`,
                  },
                  {
                    icon: <Thermometer className="w-3.5 h-3.5" />,
                    label: 'Temperature',
                    value: settings.temperature.toFixed(1),
                    sub: tempLabel,
                  },
                  {
                    icon: ollamaOnline
                      ? <Wifi className="w-3.5 h-3.5 text-green-500/60" />
                      : <WifiOff className="w-3.5 h-3.5 text-amber-500/60" />,
                    label: 'Endpoint',
                    value: settings.ollamaHost.replace('http://', '').replace('https://', ''),
                    sub: ollamaOnline ? 'Reachable' : 'Not reachable',
                  },
                ].map(({ icon, label, value, sub }) => (
                  <div key={label} className="flex items-start gap-2.5 p-3 rounded-md border border-border/20 bg-background/20">
                    <div className="mt-0.5 text-muted-foreground/25 shrink-0">{icon}</div>
                    <div className="min-w-0">
                      <p className="text-[9.5px] text-muted-foreground/50 uppercase tracking-wider">{label}</p>
                      <p className="text-[11.5px] font-mono text-foreground/85 mt-0.5 truncate">{value}</p>
                      {sub && <p className="text-[9.5px] text-muted-foreground/45 mt-0.5">{sub}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Available models */}
            <div className="rounded-lg border border-border/30 bg-card/20 overflow-hidden">
              <div className="px-4 pt-3.5 pb-1 flex items-center justify-between">
                <SectionLabel>Available models</SectionLabel>
                {availableModels.length > 0 && (
                  <span className="text-[9px] text-muted-foreground/25 font-mono mb-2">{availableModels.length}</span>
                )}
              </div>
              {availableModels.length > 0 ? (
                <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                  {availableModels.map((m) => {
                    const base = HOSHI_MODEL_INFO[m]
                    return (
                      <button
                        key={m}
                        onClick={() => updateSettings({ ollamaModel: m })}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono transition-all ${
                          settings.ollamaModel === m
                            ? 'border-primary/40 bg-primary/10 text-foreground/90'
                            : 'border-border/25 bg-background/20 text-muted-foreground/45 hover:border-border/50 hover:text-muted-foreground/70'
                        }`}
                      >
                        {settings.ollamaModel === m && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                        <span>hoshi-translator</span>
                        {base && (
                          <span className="text-[9px] text-muted-foreground/50 font-normal border border-border/30 rounded px-1 py-0.5 ml-0.5">
                            {base}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="px-4 pb-4 text-[10.5px] text-muted-foreground/45 leading-relaxed">
                  No hoshi-translator models found. Use the Install Models section below to create them.
                </p>
              )}
            </div>

            {/* Install Models */}
            <div className="rounded-lg border border-border/30 bg-card/20 overflow-hidden">
              <div className="px-4 pt-3.5 pb-1 flex items-center justify-between">
                <SectionLabel>Install models</SectionLabel>
                <span className="text-[9px] text-muted-foreground/25 font-mono mb-2">local</span>
              </div>
              <div className="px-3 pb-3 flex flex-col gap-2">
                <p className="text-[10px] text-muted-foreground/45 leading-relaxed px-1">
                  Creates the hoshi-translator models from embedded Modelfiles. Requires Ollama + base model already pulled.
                </p>

                <div className="flex flex-col gap-1.5">
                  {([
                    { id: '4b' as const, label: 'hoshi-translator-4b', sub: 'q8_0 · ~4 GB VRAM' },
                    { id: 'abliterated-4b' as const, label: 'hoshi-translator-abliterated-4b', sub: 'fp16 · ~8 GB VRAM' },
                    { id: '30b' as const, label: 'hoshi-translator-30b', sub: 'q4_K_M · min 24 GB VRAM' },
                  ]).map(({ id, label, sub }) => (
                    <button
                      key={id}
                      onClick={() => startInstall(id)}
                      disabled={installing !== null}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded border transition-all ${
                        installing === id
                          ? 'border-primary/40 bg-primary/10 text-foreground cursor-wait'
                          : 'border-border/25 bg-background/20 text-muted-foreground/50 hover:border-border/50 hover:text-muted-foreground/70 disabled:opacity-40'
                      }`}
                    >
                      <span className="text-[10px] font-mono font-medium">{label}</span>
                      <span className="text-[9px] text-muted-foreground/40">
                        {installing === id ? <span className="text-primary/60 animate-pulse">Installing…</span> : sub}
                      </span>
                    </button>
                  ))}
                </div>

                {installLines.length > 0 && (
                  <div
                    ref={scrollRef}
                    className="max-h-28 overflow-y-auto rounded border border-border/20 bg-background/40 px-2.5 py-2"
                  >
                    {installLines.map((line, i) => (
                      <p key={i} className="text-[9.5px] font-mono text-muted-foreground/55 leading-relaxed">{line}</p>
                    ))}
                  </div>
                )}

                {installDone && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-green-500/20 bg-green-500/5">
                    <Check className="w-3 h-3 text-green-400 shrink-0" />
                    <span className="text-[10px] text-green-400/80 font-mono">{installDone} created — reload model list</span>
                  </div>
                )}

                {installFallback && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[9.5px] text-amber-400/70 px-1">
                      `ollama` not found in PATH. Run this command manually:
                    </p>
                    <div className="relative group">
                      <pre className="text-[9.5px] font-mono bg-background/60 border border-border/50 rounded px-2.5 py-2 text-foreground/70 whitespace-pre-wrap break-all">
                        {installFallback}
                      </pre>
                      <button
                        onClick={() => navigator.clipboard.writeText(installFallback)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded bg-background/80 border border-border/50 text-[9px] text-muted-foreground/60 hover:text-foreground"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tips */}
            <div className="rounded-lg border border-border/20 bg-card/10 px-4 py-3.5 flex flex-col gap-2.5">
              <SectionLabel>Tips</SectionLabel>
              <ul className="flex flex-col gap-2">
                {[
                  'Lower temperature (0.1–0.3) gives more consistent translations for game text.',
                  'Use {lang} in your prompt — it\'s replaced with "English" or "French" at runtime.',
                  'Models with 7B–14B parameters work well for Japanese RPG dialogue.',
                  'Set concurrency to 4× or 8× in the translation view to speed up batch jobs.',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary/25 mt-0.5 shrink-0">▸</span>
                    <span className="text-[10.5px] text-muted-foreground/55 leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
