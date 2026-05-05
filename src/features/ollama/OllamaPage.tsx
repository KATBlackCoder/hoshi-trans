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
    <div className="h-full overflow-hidden flex flex-col">
      <div className="p-6 pb-0 flex flex-col gap-5 flex-1 min-h-0">

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-start justify-between shrink-0 pb-3 border-b-2 border-primary">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-tight">Ollama</h2>
            <p className="text-[11px] font-mono text-muted-foreground mt-1 uppercase tracking-wider">Connection // Model // Settings</p>
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
            ollamaOnline
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
          }`}>
            {ollamaOnline
              ? <Wifi className="w-3 h-3" />
              : <WifiOff className="w-3 h-3" />
            }
            <span>{ollamaOnline ? 'Online' : 'Offline'}</span>
            {availableModels.length > 0 && (
              <span className="opacity-60">// {availableModels.length} hoshi</span>
            )}
            <span className="text-primary">//</span>
            <span className="opacity-70">Local</span>
          </div>
        </div>

        {/* ── Two-column layout ─────────────────────────────────── */}
        <div className="flex gap-5 flex-1 min-h-0">

          {/* LEFT ─ Settings */}
          <div className="flex flex-col gap-5 w-105 shrink-0 overflow-y-auto pr-1 pb-6">

            {/* Connection & Model */}
            <div className="rounded-sm border border-border bg-card/40 overflow-hidden">
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

          </div>

          {/* RIGHT ─ Summary */}
          <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pb-6">

            {/* Active config */}
            <div className="rounded-sm border border-border bg-card/40 overflow-hidden">
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
                    icon: ollamaOnline
                      ? <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                      : <WifiOff className="w-3.5 h-3.5 text-amber-500" />,
                    label: 'Endpoint',
                    value: settings.ollamaHost.replace('http://', '').replace('https://', ''),
                    sub: ollamaOnline ? 'Reachable' : 'Not reachable',
                  },
                ].map(({ icon, label, value, sub }) => (
                  <div key={label} className="flex items-start gap-2.5 p-3 rounded-sm border border-border bg-background">
                    <div className="mt-0.5 text-primary shrink-0">{icon}</div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">{label}</p>
                      <p className="text-[11px] font-mono font-bold text-foreground mt-0.5 truncate">{value}</p>
                      {sub && <p className="text-[9px] text-muted-foreground/70 mt-0.5 font-mono uppercase tracking-wider">{sub}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Available models */}
            <div className="rounded-sm border border-border bg-card/40 overflow-hidden">
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
            <div className="rounded-sm border border-border bg-card/40 overflow-hidden">
              <div className="px-4 pt-3.5 pb-1 flex items-center justify-between">
                <SectionLabel>Install models</SectionLabel>
                <span className="text-[9px] text-muted-foreground/25 font-mono mb-2">local</span>
              </div>
              <div className="px-3 pb-3 flex flex-col gap-2">

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
                        <div className={`flex items-center justify-between px-3 py-2 rounded border transition-all ${
                          isInstalling
                            ? 'border-primary/40 bg-primary/5'
                            : isInstalled
                            ? 'border-green-500/20 bg-green-500/5'
                            : isConfirming
                            ? 'border-primary/30 bg-primary/5'
                            : 'border-border/25 bg-background/20'
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {isInstalled && <Check className="w-3 h-3 text-green-400 shrink-0" />}
                            <span className={`text-[10px] font-mono font-medium truncate ${isInstalled ? 'text-foreground/80' : 'text-muted-foreground/60'}`}>{label}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {isInstalling ? (
                              <>
                                <span className="text-[9px] text-primary/70 animate-pulse font-mono">Installing…</span>
                                <button
                                  onClick={cancelInstall}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-[9px] text-red-400/80 hover:bg-red-500/20 transition-colors"
                                >
                                  <X className="w-2.5 h-2.5" /> Stop
                                </button>
                              </>
                            ) : isDeleting ? (
                              <span className="text-[9px] text-red-400/60 animate-pulse font-mono">Deleting…</span>
                            ) : isInstalled ? (
                              <button
                                onClick={() => deleteModel(id)}
                                disabled={busy}
                                className="flex items-center gap-1 px-2 py-0.5 rounded border border-red-500/20 bg-transparent text-[9px] text-red-400/50 hover:bg-red-500/10 hover:text-red-400/80 transition-colors disabled:opacity-30"
                              >
                                <Trash2 className="w-2.5 h-2.5" /> Remove
                              </button>
                            ) : isConfirming ? (
                              <span className="text-[9px] text-muted-foreground/40 font-mono">{vram} VRAM · {disk} disk</span>
                            ) : (
                              <>
                                <span className="text-[9px] text-muted-foreground/35 font-mono">{vram}</span>
                                <button
                                  onClick={() => requestInstall(id)}
                                  disabled={busy}
                                  className="px-2 py-0.5 rounded border border-border/40 bg-background/40 text-[9px] text-muted-foreground/60 hover:border-primary/40 hover:text-foreground/80 transition-colors disabled:opacity-30"
                                >
                                  Install
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Confirmation panel */}
                        {isConfirming && (
                          <div className="mx-1 px-3 py-2.5 rounded border border-primary/20 bg-primary/5 flex flex-col gap-2.5">
                            {checkingResources ? (
                              <p className="text-[9.5px] text-muted-foreground/40 animate-pulse">Checking disk and VRAM…</p>
                            ) : resourceCheck ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <HardDrive className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                                  <span className="text-[9.5px] text-muted-foreground/50">Disk free:</span>
                                  <span className={`text-[9.5px] font-mono ${resourceCheck.disk_ok ? 'text-green-400/80' : 'text-red-400/80'}`}>
                                    {resourceCheck.disk_free_gb.toFixed(1)} GB
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/30">/ {resourceCheck.required_disk_gb} GB needed</span>
                                  {!resourceCheck.disk_ok && <AlertTriangle className="w-3 h-3 text-red-400/70 shrink-0" />}
                                </div>
                                {resourceCheck.vram_free_gb !== null && (
                                  <div className="flex items-center gap-1.5">
                                    <Layers className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                                    <span className="text-[9.5px] text-muted-foreground/50">VRAM free:</span>
                                    <span className={`text-[9.5px] font-mono ${resourceCheck.vram_ok === false ? 'text-amber-400/80' : 'text-green-400/80'}`}>
                                      {resourceCheck.vram_free_gb.toFixed(1)} GB
                                    </span>
                                    <span className="text-[9px] text-muted-foreground/30">/ {resourceCheck.required_vram_gb} GB needed</span>
                                    {resourceCheck.vram_ok === false && <AlertTriangle className="w-3 h-3 text-amber-400/70 shrink-0" />}
                                  </div>
                                )}
                                {resourceCheck.vram_free_gb === null && (
                                  <p className="text-[9px] text-muted-foreground/30 italic">VRAM not detectable — ensure sufficient GPU memory before installing.</p>
                                )}
                              </div>
                            ) : null}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setConfirmingModel(null)}
                                className="px-2.5 py-1 rounded border border-border/40 text-[9.5px] text-muted-foreground/50 hover:text-foreground/70 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => confirmInstall(id)}
                                disabled={resourceCheck !== null && !resourceCheck.disk_ok}
                                className="px-2.5 py-1 rounded border border-primary/40 bg-primary/10 text-[9.5px] text-foreground/80 hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {resourceCheck?.disk_ok === false ? 'Not enough disk space' : 'Confirm install'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Terminal progress log */}
                {(installLog.length > 0 || installingModel !== null) && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[9px] text-muted-foreground/30 uppercase tracking-widest">Output</span>
                      {installingModel === null && (
                        <button onClick={() => setInstallLog([])} className="text-[9px] text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors">clear</button>
                      )}
                    </div>
                    <div
                      ref={scrollRef}
                      className="max-h-32 overflow-y-auto rounded border border-zinc-700/60 bg-zinc-950 px-2.5 py-2"
                    >
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
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-green-500/25 bg-green-500/8">
                    <Check className="w-3 h-3 text-green-400 shrink-0" />
                    <span className="text-[10px] text-green-300/80 font-mono">Model created — list updates in a few seconds</span>
                  </div>
                )}
                {installStatus === 'cancelled' && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-amber-500/20 bg-amber-500/5">
                    <X className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="text-[10px] text-amber-300/70 font-mono">Install cancelled</span>
                  </div>
                )}

                {/* Fallback copy command */}
                {installFallback && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[9.5px] text-amber-400/70 px-1">
                      `ollama` not found in PATH. Run this command manually:
                    </p>
                    <div className="relative group">
                      <pre className="text-[9.5px] font-mono bg-zinc-950 border border-zinc-700/60 rounded px-2.5 py-2 text-emerald-400/80 whitespace-pre-wrap break-all">
                        {installFallback}
                      </pre>
                      <button
                        onClick={() => navigator.clipboard.writeText(installFallback)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[9px] text-zinc-400 hover:text-white"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Tips */}
            <div className="rounded-sm border border-border/60 bg-card/30 px-4 py-3.5 flex flex-col gap-2.5">
              <SectionLabel>Tips</SectionLabel>
              <ul className="flex flex-col gap-2">
                {[
                  'For batch jobs, the 4B model is fast (~50 lines/min on a 4 GB GPU). The 30B variant is slower but better at long context.',
                  'After translation, run a Refine pass with the same or a stronger model to catch awkward phrasing.',
                  'Click any cell to edit a translation manually — your edits are saved as glossary candidates.',
                  'Game files stay on disk. No data is sent outside your machine, ever.',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5 shrink-0 font-bold">▸</span>
                    <span className="text-[11px] text-muted-foreground leading-relaxed">{tip}</span>
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
