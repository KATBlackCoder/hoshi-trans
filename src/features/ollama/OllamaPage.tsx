import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useAppStore, DEFAULT_OLLAMA_HOST } from '@/stores/appStore'
import { HOSHI_MODEL_INFO } from '@/lib/models'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Globe, Cpu, Wifi, WifiOff, Check, Trash2, X, AlertTriangle, HardDrive, Layers } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">
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
  type ModelId = '4b' | 'abliterated-4b' | '30b'
  interface ResourceCheck {
    disk_free_gb: number; ram_total_gb: number; vram_free_gb: number | null
    required_disk_gb: number; required_vram_gb: number
    disk_ok: boolean; vram_ok: boolean | null
  }

  const [confirmingModel, setConfirmingModel] = useState<ModelId | null>(null)
  const [resourceCheck, setResourceCheck] = useState<ResourceCheck | null>(null)
  const [checkingResources, setCheckingResources] = useState(false)
  const [installingModel, setInstallingModel] = useState<ModelId | null>(null)
  const [installLog, setInstallLog] = useState<string[]>([])
  const [installFallback, setInstallFallback] = useState<string | null>(null)
  const [installStatus, setInstallStatus] = useState<'done' | 'cancelled' | null>(null)
  const [deletingModel, setDeletingModel] = useState<ModelId | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unlistenProgress = listen<{ line: string }>('modelfile:progress', (e) => {
      setInstallLog((prev) => [...prev.slice(-80), e.payload.line])
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999 }), 10)
    })
    const unlistenDone = listen<string>('modelfile:done', () => {
      setInstallingModel(null)
      setInstallStatus('done')
    })
    const unlistenCancelled = listen('modelfile:cancelled', () => {
      setInstallingModel(null)
      setInstallStatus('cancelled')
    })
    const unlistenFallback = listen<{ command: string }>('modelfile:fallback', (e) => {
      setInstallingModel(null)
      setInstallFallback(e.payload.command)
    })
    const unlistenDeleted = listen('modelfile:deleted', () => {
      setDeletingModel(null)
    })
    return () => {
      unlistenProgress.then((f) => f())
      unlistenDone.then((f) => f())
      unlistenCancelled.then((f) => f())
      unlistenFallback.then((f) => f())
      unlistenDeleted.then((f) => f())
    }
  }, [])

  async function requestInstall(model: ModelId) {
    setConfirmingModel(model)
    setResourceCheck(null)
    setCheckingResources(true)
    try {
      const res = await invoke<ResourceCheck>('check_system_resources', { model })
      setResourceCheck(res)
    } catch {
      // ignore — let user proceed without check
    } finally {
      setCheckingResources(false)
    }
  }

  async function confirmInstall(model: ModelId) {
    setConfirmingModel(null)
    setInstallingModel(model)
    setInstallLog([])
    setInstallFallback(null)
    setInstallStatus(null)
    try {
      await invoke('install_modelfile', { model })
    } catch (e) {
      setInstallingModel(null)
      setInstallLog((prev) => [...prev, `Error: ${e}`])
    }
  }

  async function cancelInstall() {
    try { await invoke('cancel_install') } catch { /* ignore */ }
  }

  async function deleteModel(model: ModelId) {
    setDeletingModel(model)
    try {
      await invoke('delete_modelfile', { model })
    } catch (e) {
      setDeletingModel(null)
      setInstallLog([`Delete error: ${e}`])
    }
  }

  const MODEL_KEY: Record<string, ModelId> = {
    'hoshi-translator-4b': '4b',
    'hoshi-translator-abliterated-4b': 'abliterated-4b',
    'hoshi-translator-30b': '30b',
  }
  const installedIds = new Set(availableModels.map(m => MODEL_KEY[m]).filter(Boolean))

  const langLabel = settings.targetLang === 'en' ? 'English' : 'French'

  function saveHost() {
    const trimmed = hostDraft.trim() || DEFAULT_OLLAMA_HOST
    setHostDraft(trimmed)
    updateSettings({ ollamaHost: trimmed })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b-2 border-primary flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-tight">Ollama</h2>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5 uppercase tracking-wider">Connection // Model // Settings</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
          ollamaOnline
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
        }`}>
          {ollamaOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span>{ollamaOnline ? 'Online' : 'Offline'}</span>
          {availableModels.length > 0 && <span className="opacity-60">// {availableModels.length} hoshi</span>}
          <span className="text-primary">//</span>
          <span className="opacity-70">Local</span>
        </div>
      </div>

      {/* ── Body: two columns ──────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT ── Connection settings (fixed width, independently scrollable) */}
        <div className="w-96 shrink-0 border-r border-border flex flex-col overflow-y-auto">
          <div className="p-5 flex flex-col gap-5">

            {/* Connection & Model */}
            <section className="flex flex-col gap-2">
              <SectionLabel>Connection &amp; Model</SectionLabel>
              <div className="rounded-sm border border-border bg-card/40 p-4 flex flex-col gap-4">

                {/* Host URL */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Host URL</Label>
                  <div className="flex gap-1.5">
                    <Input
                      value={hostDraft}
                      onChange={(e) => setHostDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveHost()}
                      className="font-mono text-xs flex-1"
                      placeholder="http://localhost:11434"
                    />
                    <Button size="sm" variant="outline" onClick={() => setHostDraft(DEFAULT_OLLAMA_HOST)}>
                      Local
                    </Button>
                    <Button size="sm" onClick={saveHost}>
                      {saved ? <Check className="w-3.5 h-3.5" /> : 'Save'}
                    </Button>
                  </div>
                </div>

                {/* Model */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Model</Label>
                  <Select value={settings.ollamaModel} onValueChange={(v) => updateSettings({ ollamaModel: v ?? '' })}>
                    <SelectTrigger className="font-mono text-xs">
                      <SelectValue placeholder="Select a model…" />
                    </SelectTrigger>
                    <SelectContent className="max-w-none w-auto min-w-(--radix-select-trigger-width)">
                      {availableModels.map((m) => (
                        <SelectItem key={m} value={m} className="font-mono text-xs">
                          <span>hoshi-translator</span>
                          {HOSHI_MODEL_INFO[m] && (
                            <span className="ml-1.5 text-[9px] text-primary font-bold">{HOSHI_MODEL_INFO[m]}</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Language */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Language</Label>
                  <Select value={settings.targetLang} onValueChange={(v) => updateSettings({ targetLang: v as 'en' | 'fr' })}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </section>

            {/* Available models — quick switch */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <SectionLabel>Available models</SectionLabel>
                {availableModels.length > 0 && (
                  <span className="text-[10px] font-mono font-bold text-primary mb-2">{availableModels.length}</span>
                )}
              </div>
              {availableModels.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {availableModels.map((m) => {
                    const base = HOSHI_MODEL_INFO[m]
                    const active = settings.ollamaModel === m
                    return (
                      <button
                        key={m}
                        onClick={() => updateSettings({ ollamaModel: m })}
                        className={`flex items-center justify-between px-3 py-2 rounded-sm border text-left transition-all ${
                          active
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border bg-card/40 text-muted-foreground hover:border-primary/50 hover:bg-card/70 hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {active && <span className="w-1.5 h-1.5 rounded-sm bg-primary shrink-0" />}
                          <span className="text-[10.5px] font-mono font-bold truncate">hoshi-translator</span>
                        </div>
                        {base && (
                          <span className={`text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 ml-2 px-1.5 py-0.5 rounded-sm border ${
                            active ? 'border-primary/40 text-primary bg-primary/15' : 'border-border text-muted-foreground'
                          }`}>{base}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[10.5px] text-muted-foreground leading-relaxed rounded-sm border border-border bg-card/40 px-3 py-2.5">
                  No hoshi-translator models found. Install one using the panel on the right.
                </p>
              )}
            </section>

          </div>
        </div>

        {/* RIGHT ── Status + Install + Tips (scrollable) */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 flex flex-col gap-5">

            {/* Active configuration — 3 equal columns */}
            <section className="flex flex-col gap-2">
              <SectionLabel>Active configuration</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    icon: <Cpu className="w-3.5 h-3.5" />,
                    label: 'Model',
                    value: settings.ollamaModel || 'None selected',
                    sub: 'Local Ollama',
                  },
                  {
                    icon: <Globe className="w-3.5 h-3.5" />,
                    label: 'Language',
                    value: langLabel,
                    sub: `JP → ${langLabel}`,
                  },
                  {
                    icon: ollamaOnline
                      ? <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      : <WifiOff className="w-3.5 h-3.5 text-amber-400" />,
                    label: 'Endpoint',
                    value: settings.ollamaHost.replace(/https?:\/\//, ''),
                    sub: ollamaOnline ? 'Reachable' : 'Not reachable',
                  },
                ].map(({ icon, label, value, sub }) => (
                  <div key={label} className="flex items-start gap-2.5 p-3 rounded-sm border border-border bg-card/40">
                    <div className="mt-0.5 text-primary shrink-0">{icon}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                      <p className="text-[11px] font-mono font-bold text-foreground mt-0.5 truncate">{value}</p>
                      {sub && <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70 mt-0.5">{sub}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Install Models */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <SectionLabel>Install models</SectionLabel>
                <span className="text-[9px] font-mono font-bold text-muted-foreground mb-2 uppercase tracking-wider">local</span>
              </div>
              <div className="rounded-sm border border-border bg-card/40 p-3 flex flex-col gap-2">

                {/* Model rows */}
                <div className="flex flex-col gap-1.5">
                  {([
                    { id: '4b' as const, label: 'hoshi-translator-4b', vram: '~4 GB', disk: '~5 GB' },
                    { id: 'abliterated-4b' as const, label: 'hoshi-translator-abliterated-4b', vram: '~8 GB', disk: '~9 GB' },
                    { id: '30b' as const, label: 'hoshi-translator-30b', vram: 'min 24 GB', disk: '~21 GB' },
                  ]).map(({ id, label, vram, disk }) => {
                    const isInstalled = installedIds.has(id)
                    const isInstalling = installingModel === id
                    const isConfirming = confirmingModel === id
                    const isDeleting = deletingModel === id
                    const busy = installingModel !== null || deletingModel !== null

                    return (
                      <div key={id} className="flex flex-col gap-1">
                        {/* Main row */}
                        <div className={`flex items-center justify-between px-3 py-2.5 rounded-sm border transition-all ${
                          isInstalling ? 'border-primary/50 bg-primary/8'
                          : isInstalled ? 'border-emerald-500/30 bg-emerald-500/8'
                          : isConfirming ? 'border-primary/30 bg-primary/5'
                          : 'border-border bg-background'
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {isInstalled && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                            <span className={`text-[10.5px] font-mono font-bold truncate ${
                              isInstalled ? 'text-foreground' : 'text-muted-foreground'
                            }`}>{label}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {isInstalling ? (
                              <>
                                <span className="text-[9px] text-primary font-mono font-bold uppercase tracking-wider animate-pulse">Installing…</span>
                                <button
                                  onClick={cancelInstall}
                                  className="flex items-center gap-1 px-2 py-1 rounded-sm border border-destructive/40 bg-destructive/10 text-[9px] font-bold uppercase tracking-wider text-destructive hover:bg-destructive/20 transition-colors"
                                >
                                  <X className="w-2.5 h-2.5" /> Stop
                                </button>
                              </>
                            ) : isDeleting ? (
                              <span className="text-[9px] text-destructive font-mono font-bold uppercase tracking-wider animate-pulse">Deleting…</span>
                            ) : isInstalled ? (
                              <button
                                onClick={() => deleteModel(id)}
                                disabled={busy}
                                className="flex items-center gap-1 px-2 py-1 rounded-sm border border-destructive/30 text-[9px] font-bold uppercase tracking-wider text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-30"
                              >
                                <Trash2 className="w-2.5 h-2.5" /> Remove
                              </button>
                            ) : isConfirming ? (
                              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{vram} · {disk}</span>
                            ) : (
                              <>
                                <span className="text-[9px] font-mono text-muted-foreground">{vram}</span>
                                <button
                                  onClick={() => requestInstall(id)}
                                  disabled={busy}
                                  className="px-2.5 py-1 rounded-sm border border-primary/40 bg-primary/8 text-[9px] font-bold uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors disabled:opacity-30"
                                >
                                  Install
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Confirmation panel */}
                        {isConfirming && (
                          <div className="ml-3 px-3 py-3 rounded-sm border border-primary/25 bg-primary/5 flex flex-col gap-3">
                            {checkingResources ? (
                              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground animate-pulse">Checking disk and VRAM…</p>
                            ) : resourceCheck ? (
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                  <HardDrive className="w-3 h-3 text-muted-foreground shrink-0" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Disk</span>
                                  <span className={`text-[10px] font-mono font-bold ${resourceCheck.disk_ok ? 'text-emerald-400' : 'text-destructive'}`}>
                                    {resourceCheck.disk_free_gb.toFixed(1)} GB free
                                  </span>
                                  <span className="text-[9px] text-muted-foreground">/ {resourceCheck.required_disk_gb} GB needed</span>
                                  {!resourceCheck.disk_ok && <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />}
                                </div>
                                {resourceCheck.vram_free_gb !== null ? (
                                  <div className="flex items-center gap-2">
                                    <Layers className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">VRAM</span>
                                    <span className={`text-[10px] font-mono font-bold ${resourceCheck.vram_ok === false ? 'text-amber-400' : 'text-emerald-400'}`}>
                                      {resourceCheck.vram_free_gb.toFixed(1)} GB free
                                    </span>
                                    <span className="text-[9px] text-muted-foreground">/ {resourceCheck.required_vram_gb} GB needed</span>
                                    {resourceCheck.vram_ok === false && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
                                  </div>
                                ) : (
                                  <p className="text-[9px] text-muted-foreground italic">VRAM not detectable — ensure sufficient GPU memory before installing.</p>
                                )}
                              </div>
                            ) : null}
                            <div className="flex items-center gap-2 pt-1 border-t border-border">
                              <Button size="xs" variant="outline" onClick={() => setConfirmingModel(null)}>Cancel</Button>
                              <Button
                                size="xs"
                                onClick={() => confirmInstall(id)}
                                disabled={resourceCheck !== null && !resourceCheck.disk_ok}
                              >
                                {resourceCheck?.disk_ok === false ? 'Not enough disk space' : 'Confirm install'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Terminal progress log */}
                {(installLog.length > 0 || installingModel !== null) && (
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Output</span>
                      {installingModel === null && (
                        <button onClick={() => setInstallLog([])} className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">clear</button>
                      )}
                    </div>
                    <div ref={scrollRef} className="max-h-36 overflow-y-auto rounded-sm border border-zinc-700/60 bg-zinc-950 px-3 py-2">
                      {installLog.map((line, i) => (
                        <p key={i} className="text-[9.5px] font-mono text-emerald-400/80 leading-relaxed whitespace-pre-wrap">{line}</p>
                      ))}
                      {installingModel !== null && installLog.length === 0 && (
                        <p className="text-[9.5px] font-mono text-zinc-500 animate-pulse">Starting…</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Status banners */}
                {installStatus === 'done' && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-sm border border-emerald-500/30 bg-emerald-500/8">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">Model created — list updates in a few seconds</span>
                  </div>
                )}
                {installStatus === 'cancelled' && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-sm border border-amber-500/30 bg-amber-500/8">
                    <X className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">Install cancelled</span>
                  </div>
                )}

                {/* Fallback copy command */}
                {installFallback && (
                  <div className="flex flex-col gap-2 pt-1 border-t border-border">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      ollama not found in PATH — run manually:
                    </p>
                    <div className="relative group">
                      <pre className="text-[9.5px] font-mono bg-zinc-950 border border-zinc-700/60 rounded-sm px-3 py-2 text-emerald-400/80 whitespace-pre-wrap break-all">
                        {installFallback}
                      </pre>
                      <button
                        onClick={() => navigator.clipboard.writeText(installFallback)}
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded-sm bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </section>

            {/* Tips */}
            <section className="flex flex-col gap-2">
              <SectionLabel>Tips</SectionLabel>
              <div className="rounded-sm border border-border bg-card/40 px-4 py-3.5">
                <ul className="flex flex-col gap-2.5">
                  {[
                    'For batch jobs, the 4B model is fast (~50 lines/min on a 4 GB GPU). The 30B variant is slower but better at long context.',
                    'After translation, run a Refine pass with the same or a stronger model to catch awkward phrasing.',
                    'Click any cell to edit a translation manually — your edits are saved as glossary candidates.',
                    'Game files stay on disk. No data is sent outside your machine, ever.',
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="text-primary mt-0.5 shrink-0 font-bold text-xs">▸</span>
                      <span className="text-[11px] text-muted-foreground leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

          </div>
        </div>

      </div>
    </div>
  )
}
