import { useState } from 'react'
import { useAppStore, DEFAULT_OLLAMA_HOST } from '@/stores/appStore'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Copy, Check, ExternalLink, ChevronDown, ChevronRight, Cpu, Thermometer, Globe, Zap } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function CopyableUrl({ url, hideCode }: { url: string; hideCode?: boolean }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  if (hideCode) {
    return (
      <Button size="sm" variant="outline" className="h-6 gap-1.5 px-2 text-[10px]" onClick={copy}>
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 text-[10.5px] font-mono bg-muted/40 border border-border/30 rounded px-2.5 py-1.5 text-foreground/70 truncate">
        {url}
      </code>
      <Button size="sm" variant="outline" className="h-7 w-7 p-0 shrink-0" onClick={copy}>
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      </Button>
    </div>
  )
}

function PanelRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-border/20 last:border-0">
      <div className="w-28 shrink-0 pt-0.5">
        <span className="text-[11px] text-muted-foreground/50 font-medium">{label}</span>
        {hint && <p className="text-[9.5px] text-muted-foreground/30 mt-0.5 leading-tight">{hint}</p>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/40 bg-card/30 overflow-hidden">
      <div className="px-3.5 py-2 border-b border-border/30 bg-muted/20">
        <span className="text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground/40">{title}</span>
      </div>
      <div className="px-3.5">{children}</div>
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded border border-border/30 bg-background/30">
      <div className="mt-0.5 text-muted-foreground/30 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[9.5px] text-muted-foreground/40 uppercase tracking-wider">{label}</p>
        <p className="text-xs font-mono text-foreground/80 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-[9.5px] text-muted-foreground/30 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export function OllamaPage() {
  const { settings, updateSettings, availableModels } = useAppStore()
  const ollamaOnline = useAppStore((s) => s.ollamaOnline)
  const [hostDraft, setHostDraft] = useState(settings.ollamaHost)
  const [saved, setSaved] = useState(false)
  const [runpodOpen, setRunpodOpen] = useState(false)
  const [runpodModel, setRunpodModel] = useState<'30b' | '27b'>('27b')

  const isRunPod = settings.ollamaHost.includes('runpod.net')

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
    <div className="h-full overflow-y-auto">
      <div className="p-6 flex flex-col gap-4 h-full">

        {/* Page header with inline status */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold">Ollama</h2>
            <p className="text-[11px] text-muted-foreground/40 mt-0.5">Connection, model, and generation settings.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/40 bg-card/30">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ollamaOnline ? 'bg-green-500 shadow-[0_0_6px_1px_rgba(34,197,94,0.5)]' : 'bg-amber-500'}`} />
            <span className="text-[10.5px] font-mono text-muted-foreground/60">
              {ollamaOnline ? 'Online' : 'Offline'}
            </span>
            {availableModels.length > 0 && (
              <>
                <span className="text-muted-foreground/20">·</span>
                <span className="text-[10.5px] font-mono text-muted-foreground/40">{availableModels.length} models</span>
              </>
            )}
            <span className="text-muted-foreground/20">·</span>
            <span className="text-[10.5px] font-mono text-muted-foreground/40">{isRunPod ? 'RunPod' : 'Local'}</span>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-5 flex-1 min-h-0">

          {/* LEFT — Settings panels */}
          <div className="flex flex-col gap-4 w-105 shrink-0 overflow-y-auto pr-1">

            <Panel title="Connection & Model">
              <PanelRow label="Host URL" hint="Include the port">
                <div className="flex gap-2">
                  <Input
                    value={hostDraft}
                    onChange={(e) => setHostDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveHost()}
                    className="font-mono text-xs h-7 flex-1"
                    placeholder="http://localhost:11434"
                  />
                  <Button size="sm" variant="outline" className="text-[10.5px] h-7 px-2.5 shrink-0" onClick={() => setHostDraft(DEFAULT_OLLAMA_HOST)}>
                    Local
                  </Button>
                  <Button size="sm" className="text-[10.5px] h-7 px-2.5 shrink-0" onClick={saveHost}>
                    {saved ? '✓' : 'Save'}
                  </Button>
                </div>
              </PanelRow>

              <PanelRow label="Model">
                <Select
                  value={settings.ollamaModel}
                  onValueChange={(v) => updateSettings({ ollamaModel: v ?? '' })}
                >
                  <SelectTrigger className="font-mono text-xs h-7">
                    <SelectValue placeholder="Select a model…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((m) => (
                      <SelectItem key={m} value={m} className="font-mono text-xs">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PanelRow>

              <PanelRow label="Language">
                <Select
                  value={settings.targetLang}
                  onValueChange={(v) => updateSettings({ targetLang: v as 'en' | 'fr' })}
                >
                  <SelectTrigger className="text-xs h-7 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                  </SelectContent>
                </Select>
              </PanelRow>
            </Panel>

            <Panel title="Generation">
              <PanelRow label="Temperature" hint="Consistency ↔ creativity">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={settings.temperature}
                    onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
                    className="flex-1 accent-amber-400 h-1"
                  />
                  <span className="text-xs font-mono text-primary w-6 text-right shrink-0">{settings.temperature.toFixed(1)}</span>
                </div>
              </PanelRow>

              <PanelRow label="System prompt" hint={`Use {lang} for language`}>
                <Textarea
                  value={settings.systemPrompt}
                  onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                  rows={5}
                  className="font-mono text-[11px] leading-relaxed resize-none bg-background/50 text-foreground/80"
                />
              </PanelRow>
            </Panel>

            {/* RunPod — collapsible */}
            <div className="rounded-md border border-border/30 bg-card/20 overflow-hidden">
              <button
                onClick={() => setRunpodOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-muted/20 transition-colors"
              >
                <span className="text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground/40">RunPod Cloud GPU</span>
                {runpodOpen
                  ? <ChevronDown className="w-3 h-3 text-muted-foreground/30" />
                  : <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
                }
              </button>

              {runpodOpen && (
                <div className="px-3.5 pb-3.5 border-t border-border/20 flex flex-col gap-3 pt-3">

                  {/* Model selector */}
                  <div className="flex gap-1.5">
                    {([
                      { id: '27b', label: '27B Dense', sub: 'RTX 4090 · ~16GB' },
                      { id: '30b', label: '30B MoE',   sub: 'RTX 4090 · 3B active' },
                    ] as const).map(({ id, label, sub }) => (
                      <button
                        key={id}
                        onClick={() => setRunpodModel(id)}
                        className={`flex-1 flex flex-col items-center py-1.5 rounded border text-center transition-colors ${
                          runpodModel === id
                            ? 'border-primary/40 bg-primary/10 text-foreground'
                            : 'border-border/30 bg-background/20 text-muted-foreground/40 hover:bg-muted/20'
                        }`}
                      >
                        <span className="text-[11px] font-mono font-medium">{label}</span>
                        <span className="text-[9px] text-muted-foreground/40 mt-0.5">{sub}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label className="text-[9.5px] text-muted-foreground/40 uppercase tracking-wider">Pod URL format</Label>
                    <code className="text-[10.5px] font-mono text-muted-foreground/50 bg-muted/30 rounded px-2.5 py-1.5 border border-border/20">
                      https://&lt;POD_ID&gt;-11434.proxy.runpod.net
                    </code>
                  </div>

                  {isRunPod && (
                    <div className="flex flex-col gap-1">
                      <Label className="text-[9.5px] text-muted-foreground/40 uppercase tracking-wider">Current pod</Label>
                      <CopyableUrl url={settings.ollamaHost} />
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[9.5px] text-muted-foreground/40 uppercase tracking-wider">Container start command</Label>
                      <CopyableUrl
                        hideCode
                        url={runpodModel === '27b'
                          ? `bash -c "\napt update && apt install -y curl lshw zstd &&\ncurl -fsSL https://ollama.com/install.sh | sh &&\nOLLAMA_HOST=0.0.0.0 nohup ollama serve > /root/ollama.log 2>&1 &\nsleep 60 &&\nollama pull huihui_ai/qwen3.5-abliterated:27b-Claude-4.6-Opus-q4_K &&\ncurl -f -L -o /tmp/hoshi-translator-27b.Modelfile https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/hoshi-translator-27b.Modelfile || exit 1 &&\nollama create hoshi-translator -f /tmp/hoshi-translator-27b.Modelfile || exit 1 &&\necho 'hoshi-translator 27B ready' && sleep infinity\n"`
                          : `bash -c "\napt update && apt install -y curl lshw zstd &&\ncurl -fsSL https://ollama.com/install.sh | sh &&\nOLLAMA_HOST=0.0.0.0 nohup ollama serve > /root/ollama.log 2>&1 &\nsleep 60 &&\nollama pull huihui_ai/qwen3-abliterated:30b-a3b-instruct-2507-q4_K_M &&\ncurl -f -L -o /tmp/hoshi-translator-30b.Modelfile https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/hoshi-translator-30b.Modelfile || exit 1 &&\nollama create hoshi-translator -f /tmp/hoshi-translator-30b.Modelfile || exit 1 &&\necho 'hoshi-translator 30B ready' && sleep infinity\n"`
                        }
                      />
                    </div>
                    {runpodModel === '27b' ? (
                      <pre className="text-[9.5px] font-mono bg-muted/30 border border-border/20 rounded px-2.5 py-2 overflow-x-auto text-foreground/50 leading-relaxed whitespace-pre-wrap">{`bash -c "
apt update && apt install -y curl lshw zstd &&
curl -fsSL https://ollama.com/install.sh | sh &&
OLLAMA_HOST=0.0.0.0 nohup ollama serve > /root/ollama.log 2>&1 &
sleep 60 &&
ollama pull huihui_ai/qwen3.5-abliterated:27b-Claude-4.6-Opus-q4_K &&
curl -f -L -o /tmp/hoshi-translator-27b.Modelfile https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/hoshi-translator-27b.Modelfile || exit 1 &&
ollama create hoshi-translator -f /tmp/hoshi-translator-27b.Modelfile || exit 1 &&
echo 'hoshi-translator 27B ready' && sleep infinity
"`}</pre>
                    ) : (
                      <pre className="text-[9.5px] font-mono bg-muted/30 border border-border/20 rounded px-2.5 py-2 overflow-x-auto text-foreground/50 leading-relaxed whitespace-pre-wrap">{`bash -c "
apt update && apt install -y curl lshw zstd &&
curl -fsSL https://ollama.com/install.sh | sh &&
OLLAMA_HOST=0.0.0.0 nohup ollama serve > /root/ollama.log 2>&1 &
sleep 60 &&
ollama pull huihui_ai/qwen3-abliterated:30b-a3b-instruct-2507-q4_K_M &&
curl -f -L -o /tmp/hoshi-translator-30b.Modelfile https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/hoshi-translator-30b.Modelfile || exit 1 &&
ollama create hoshi-translator -f /tmp/hoshi-translator-30b.Modelfile || exit 1 &&
echo 'hoshi-translator 30B ready' && sleep infinity
"`}</pre>
                    )}
                  </div>

                  <a
                    href="https://github.com/KATBlackCoder/hoshi-trans/blob/main/RUNPOD.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10.5px] text-primary/60 hover:text-primary transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Full setup guide (RUNPOD.md)
                  </a>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT — Summary sidebar */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">

            {/* Active config summary */}
            <div className="rounded-md border border-border/30 bg-card/20 overflow-hidden">
              <div className="px-3.5 py-2 border-b border-border/20 bg-muted/10">
                <span className="text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground/35">Active configuration</span>
              </div>
              <div className="p-3 grid grid-cols-1 gap-2">
                <StatCard
                  icon={<Cpu className="w-3.5 h-3.5" />}
                  label="Model"
                  value={settings.ollamaModel || 'None selected'}
                  sub={isRunPod ? 'RunPod (cloud)' : 'Local Ollama'}
                />
                <StatCard
                  icon={<Globe className="w-3.5 h-3.5" />}
                  label="Target language"
                  value={langLabel}
                  sub={`JP → ${langLabel}`}
                />
                <StatCard
                  icon={<Thermometer className="w-3.5 h-3.5" />}
                  label="Temperature"
                  value={settings.temperature.toFixed(1)}
                  sub={tempLabel}
                />
                <StatCard
                  icon={<Zap className="w-3.5 h-3.5" />}
                  label="Endpoint"
                  value={settings.ollamaHost.replace('http://', '').replace('https://', '')}
                  sub={ollamaOnline ? 'Reachable' : 'Not reachable'}
                />
              </div>
            </div>

            {/* Available models list */}
            {availableModels.length > 0 && (
              <div className="rounded-md border border-border/30 bg-card/20 overflow-hidden">
                <div className="px-3.5 py-2 border-b border-border/20 bg-muted/10">
                  <span className="text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground/35">
                    Available models
                    <span className="ml-2 text-muted-foreground/25 font-normal normal-case tracking-normal">{availableModels.length} found</span>
                  </span>
                </div>
                <div className="p-2 flex flex-col gap-0.5 max-h-52 overflow-y-auto">
                  {availableModels.map((m) => (
                    <button
                      key={m}
                      onClick={() => updateSettings({ ollamaModel: m })}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors ${
                        settings.ollamaModel === m
                          ? 'bg-primary/12 border border-primary/25'
                          : 'hover:bg-muted/30 border border-transparent'
                      }`}
                    >
                      {settings.ollamaModel === m && (
                        <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                      )}
                      <span className={`text-[11px] font-mono truncate ${settings.ollamaModel === m ? 'text-foreground/90' : 'text-muted-foreground/50'}`}>
                        {m}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="rounded-md border border-border/20 bg-card/10 p-3.5 flex flex-col gap-2.5">
              <span className="text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground/25">Tips</span>
              <ul className="flex flex-col gap-2">
                {[
                  { tip: 'Lower temperature (0.1–0.3) gives more consistent translations for game text.' },
                  { tip: 'Use {lang} in your prompt — it\'s replaced with "English" or "French" at runtime.' },
                  { tip: 'Models with 7B–14B parameters work well for Japanese RPG dialogue.' },
                  { tip: 'Set concurrency to 4× or 8× in the translation view to speed up batch jobs.' },
                ].map(({ tip }, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary/30 mt-0.5 shrink-0 text-[9px]">▸</span>
                    <span className="text-[10.5px] text-muted-foreground/35 leading-relaxed">{tip}</span>
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
