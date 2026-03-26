import { useState } from 'react'
import { ExternalLink, Heart, Coffee, Github, ChevronDown, ChevronRight, Cpu, Zap, Copy, Check } from 'lucide-react'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-2">
      {children}
    </p>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-border/50 bg-card/40 p-4 flex flex-col gap-1">
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground/60 shrink-0">{label}</span>
      <span className="text-xs font-mono text-foreground/80 text-right truncate">{value}</span>
    </div>
  )
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1.5">{children}</p>
  )
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative group">
      <pre className="text-[10.5px] font-mono bg-background/60 border border-border/50 rounded-md px-3 py-2.5 text-foreground/75 leading-relaxed whitespace-pre-wrap overflow-x-auto">
        {children}
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/80 border border-border/50 text-[9.5px] text-muted-foreground/60 hover:text-foreground"
      >
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function GuideChip({ label, sub, selected, onClick }: { label: string; sub: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center py-2 rounded border text-center transition-all ${
        selected
          ? 'border-primary/50 bg-primary/10 text-foreground'
          : 'border-border/40 bg-background/30 text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground/70'
      }`}
    >
      <span className="text-[11.5px] font-semibold">{label}</span>
      <span className="text-[10px] text-muted-foreground/50 mt-0.5">{sub}</span>
    </button>
  )
}

function SetupGuides() {
  const [runpodOpen, setRunpodOpen] = useState(false)
  const [localOpen, setLocalOpen] = useState(false)
  const [localModel, setLocalModel] = useState<'4b' | '27b' | '30b'>('4b')

  const localModelName = localModel === '4b' ? 'hoshi-translator' : `hoshi-translator-${localModel}`

  const runpodCmd = `bash -c "
apt update && apt install -y curl lshw zstd &&
curl -fsSL https://ollama.com/install.sh | sh &&
OLLAMA_HOST=0.0.0.0 nohup ollama serve > /root/ollama.log 2>&1 &
sleep 60 &&
ollama pull huihui_ai/qwen3-abliterated:30b-a3b-instruct-2507-q4_K_M &&
ollama pull huihui_ai/qwen3.5-abliterated:27b-Claude &&
curl -f -L -o /tmp/hoshi-translator-30b-trans.Modelfile \\
  https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/trans/hoshi-translator-30b-trans.Modelfile || exit 1 &&
ollama create hoshi-translator-30b-trans -f /tmp/hoshi-translator-30b-trans.Modelfile || exit 1 &&
curl -f -L -o /tmp/hoshi-translator-27b-rev.Modelfile \\
  https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/rev/hoshi-translator-27b-rev.Modelfile || exit 1 &&
ollama create hoshi-translator-27b-rev -f /tmp/hoshi-translator-27b-rev.Modelfile || exit 1 &&
echo 'hoshi-translator ready' && sleep infinity
"`

  const localPullCmd = localModel === '4b'
    ? `ollama pull huihui_ai/qwen3.5-abliterated:4b-Claude\nollama pull huihui_ai/qwen3-abliterated:4b-instruct-2507-q4_K_M`
    : localModel === '27b'
    ? `ollama pull huihui_ai/qwen3.5-abliterated:27b-Claude-4.6-Opus-q4_K`
    : `ollama pull huihui_ai/qwen3-abliterated:30b-a3b-instruct-2507-q4_K_M`

  const localCreateCmd = localModel === '4b'
    ? `# Translation models (instruct + claude variants)
curl -f -L -o /tmp/hoshi-translator-4b-trans.Modelfile \\
  https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/trans/hoshi-translator-4b-trans.Modelfile
ollama create hoshi-translator-4b-trans -f /tmp/hoshi-translator-4b-trans.Modelfile
curl -f -L -o /tmp/hoshi-translator-claude-trans.Modelfile \\
  https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/trans/hoshi-translator-claude-trans.Modelfile
ollama create hoshi-translator-claude-trans -f /tmp/hoshi-translator-claude-trans.Modelfile

# Review models (claude + instruct variants)
curl -f -L -o /tmp/hoshi-translator-rev.Modelfile \\
  https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/rev/hoshi-translator-rev.Modelfile
ollama create hoshi-translator-rev -f /tmp/hoshi-translator-rev.Modelfile
curl -f -L -o /tmp/hoshi-translator-4b-rev.Modelfile \\
  https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/rev/hoshi-translator-4b-rev.Modelfile
ollama create hoshi-translator-4b-rev -f /tmp/hoshi-translator-4b-rev.Modelfile`
    : localModel === '27b'
    ? `# Translation model
curl -f -L -o /tmp/hoshi-translator-27b-trans.Modelfile \\
  https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/trans/hoshi-translator-27b-trans.Modelfile
ollama create hoshi-translator-27b-trans -f /tmp/hoshi-translator-27b-trans.Modelfile

# Review model
curl -f -L -o /tmp/hoshi-translator-27b-rev.Modelfile \\
  https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/rev/hoshi-translator-27b-rev.Modelfile
ollama create hoshi-translator-27b-rev -f /tmp/hoshi-translator-27b-rev.Modelfile`
    : `# Translation model
curl -f -L -o /tmp/hoshi-translator-30b-trans.Modelfile \\
  https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/trans/hoshi-translator-30b-trans.Modelfile
ollama create hoshi-translator-30b-trans -f /tmp/hoshi-translator-30b-trans.Modelfile

# Review model
curl -f -L -o /tmp/hoshi-translator-30b-rev.Modelfile \\
  https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/rev/hoshi-translator-30b-rev.Modelfile
ollama create hoshi-translator-30b-rev -f /tmp/hoshi-translator-30b-rev.Modelfile`

  return (
    <div className="flex flex-col gap-2">

      {/* Local Setup */}
      <div className="rounded border border-border/40 bg-card/30 overflow-hidden">
        <button
          onClick={() => setLocalOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Cpu className="w-3.5 h-3.5 text-primary/50" />
            <span className="text-[12px] font-medium text-foreground/80">Local Setup</span>
            <span className="text-[10px] text-muted-foreground/40 font-mono">— Linux / macOS / Windows</span>
          </div>
          {localOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground/50" /> : <ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
        </button>

        {localOpen && (
          <div className="px-4 pb-5 border-t border-border/40 bg-background/20 flex flex-col gap-4 pt-4">

            <div className="flex gap-1.5">
              {([
                { id: '4b' as const, label: '4B', sub: 'Local · ~3 GB' },
                { id: '27b' as const, label: '27B', sub: 'Dense · ~16 GB' },
                { id: '30b' as const, label: '30B', sub: 'MoE · ~20 GB' },
              ]).map(({ id, label, sub }) => (
                <GuideChip key={id} label={label} sub={sub} selected={localModel === id} onClick={() => setLocalModel(id)} />
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <StepLabel>1. Install Ollama</StepLabel>
              <CodeBlock>curl -fsSL https://ollama.com/install.sh | sh</CodeBlock>
            </div>

            <div className="flex flex-col gap-1.5">
              <StepLabel>2. Pull base model(s)</StepLabel>
              <CodeBlock>{localPullCmd}</CodeBlock>
            </div>

            <div className="flex flex-col gap-1.5">
              <StepLabel>3. Create hoshi-translator models</StepLabel>
              <CodeBlock>{localCreateCmd}</CodeBlock>
            </div>

            <div className="flex flex-col gap-1.5">
              <StepLabel>4. Configure hoshi-trans</StepLabel>
              <CodeBlock>http://localhost:11434</CodeBlock>
              <p className="text-[10.5px] text-muted-foreground/55 leading-relaxed mt-0.5">
                Set the host above in the Ollama page, then select{' '}
                <code className="font-mono text-foreground/70">{localModelName}-trans</code> as your model.
                The review pass will automatically use{' '}
                <code className="font-mono text-foreground/70">{localModelName}-rev</code>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* RunPod */}
      <div className="rounded border border-border/40 bg-card/30 overflow-hidden">
        <button
          onClick={() => setRunpodOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Zap className="w-3.5 h-3.5 text-amber-400/60" />
            <span className="text-[12px] font-medium text-foreground/80">RunPod Cloud GPU</span>
            <span className="text-[10px] text-muted-foreground/40 font-mono">— RTX 4090</span>
          </div>
          {runpodOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground/50" /> : <ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
        </button>

        {runpodOpen && (
          <div className="px-4 pb-5 border-t border-border/40 bg-background/20 flex flex-col gap-4 pt-4">

            <div className="flex gap-2 text-[10.5px] text-muted-foreground/60 leading-relaxed">
              <span className="px-2 py-0.5 rounded bg-muted/30 border border-border/30 font-mono">30b-trans</span>
              <span className="text-muted-foreground/30 self-center">+</span>
              <span className="px-2 py-0.5 rounded bg-muted/30 border border-border/30 font-mono">27b-rev</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <StepLabel>Pod URL format</StepLabel>
              <CodeBlock>{'https://<POD_ID>-11434.proxy.runpod.net'}</CodeBlock>
              <p className="text-[10.5px] text-muted-foreground/55 leading-relaxed mt-0.5">
                Paste this URL in the Ollama page → Host URL field once your pod is running.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <StepLabel>Container start command</StepLabel>
              <CodeBlock>{runpodCmd}</CodeBlock>
            </div>

            <a
              href="https://github.com/KATBlackCoder/hoshi-trans/blob/main/RUNPOD.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10.5px] text-primary/60 hover:text-primary transition-colors w-fit"
            >
              <ExternalLink className="w-3 h-3" />
              Full setup guide (RUNPOD.md)
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export function AboutPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl p-6 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 shrink-0">
            <span className="text-primary text-lg font-bold leading-none select-none">星</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold">hoshi-trans</h2>
            <p className="text-xs text-muted-foreground/50">v0.1.0 — Japanese game translator</p>
          </div>
        </div>

        {/* About */}
        <div>
          <SectionLabel>About</SectionLabel>
          <Card>
            <p className="text-xs text-muted-foreground/60 leading-relaxed">
              hoshi-trans is a free, offline-first desktop app for translating Japanese RPG games
              (RPG Maker MV/MZ, Wolf RPG, Bakin) using local AI models via Ollama.
              No data leaves your machine.
            </p>
          </Card>
        </div>

        {/* Setup Guides */}
        <div>
          <SectionLabel>Setup Guides</SectionLabel>
          <SetupGuides />
        </div>

        {/* Support */}
        <div>
          <SectionLabel>Support the project</SectionLabel>
          <Card>
            <p className="text-xs text-muted-foreground/60 mb-3 leading-relaxed">
              hoshi-trans is developed and maintained for free. If it saves you time on your translation projects,
              consider supporting its development.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="https://ko-fi.com/katblackcoder"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded border border-border/50 bg-background/40 hover:bg-primary/8 hover:border-primary/30 transition-colors group"
              >
                <Coffee className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">Ko-fi</p>
                  <p className="text-[10.5px] text-muted-foreground/40">Buy me a coffee</p>
                </div>
                <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary/60 transition-colors shrink-0" />
              </a>

              <a
                href="https://github.com/sponsors/KATBlackCoder"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded border border-border/50 bg-background/40 hover:bg-primary/8 hover:border-primary/30 transition-colors group"
              >
                <Heart className="w-4 h-4 text-pink-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">GitHub Sponsors</p>
                  <p className="text-[10.5px] text-muted-foreground/40">Monthly support</p>
                </div>
                <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary/60 transition-colors shrink-0" />
              </a>
            </div>
          </Card>
        </div>

        {/* Links */}
        <div>
          <SectionLabel>Links</SectionLabel>
          <Card>
            <InfoRow label="GitHub" value={
              <a
                href="https://github.com/KATBlackCoder/hoshi-trans"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
              >
                <Github className="w-3 h-3" />
                KATBlackCoder/hoshi-trans <ExternalLink className="w-3 h-3" />
              </a>
            } />
            <InfoRow label="Issues" value={
              <a
                href="https://github.com/KATBlackCoder/hoshi-trans/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
              >
                Report a bug <ExternalLink className="w-3 h-3" />
              </a>
            } />
          </Card>
        </div>

      </div>
    </div>
  )
}
