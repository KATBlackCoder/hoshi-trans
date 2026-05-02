import { useState } from 'react'
import { ExternalLink, Github, ChevronDown, ChevronRight, Cpu, Copy, Check, Coins } from 'lucide-react'

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


function CryptoRow({ symbol, name, address }: { symbol: string; name: string; address: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded border border-border/50 bg-background/40">
      <Coins className="w-4 h-4 text-amber-400/70 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground/80">{symbol} <span className="text-[10px] text-muted-foreground/40 font-normal">— {name}</span></p>
        <p className="text-[10px] font-mono text-muted-foreground/40 truncate mt-0.5">{address}</p>
      </div>
      <button
        onClick={copy}
        className="flex items-center gap-1 px-2 py-1 rounded border border-border/40 text-[9.5px] text-muted-foreground/50 hover:text-foreground/70 hover:border-border/70 transition-colors shrink-0"
      >
        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function SetupGuides() {
  const [localOpen, setLocalOpen] = useState(false)

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
            <span className="text-[10px] text-muted-foreground/40 font-mono">— Linux / Windows</span>
          </div>
          {localOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground/50" /> : <ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
        </button>

        {localOpen && (
          <div className="px-4 pb-5 border-t border-border/40 bg-background/20 flex flex-col gap-4 pt-4">

            <div className="flex flex-col gap-1.5">
              <StepLabel>1. Install Ollama</StepLabel>
              <CodeBlock>curl -fsSL https://ollama.com/install.sh | sh</CodeBlock>
              <p className="text-[10px] text-muted-foreground/45 leading-relaxed mt-0.5">
                Or download the Windows installer at <span className="font-mono text-foreground/60">ollama.com</span>.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <StepLabel>2. Install a hoshi-translator model</StepLabel>
              <p className="text-[10.5px] text-muted-foreground/55 leading-relaxed">
                Go to the <span className="font-mono text-foreground/70">Ollama</span> page → <span className="font-mono text-foreground/70">Install Models</span> → click the model you want. hoshi-trans runs <span className="font-mono text-foreground/60">ollama create</span> for you — it pulls the base model automatically if needed.
              </p>
              <div className="flex flex-col gap-1 mt-1">
                {([
                  { name: 'hoshi-translator-4b', vram: '~4 GB VRAM', note: 'recommended' },
                  { name: 'hoshi-translator-abliterated-4b', vram: '~8 GB VRAM', note: 'higher quality' },
                  { name: 'hoshi-translator-30b', vram: 'min 24 GB VRAM', note: 'best quality' },
                ]).map(({ name, vram, note }) => (
                  <div key={name} className="flex items-center gap-2 px-2 py-1 rounded bg-background/30 border border-border/20">
                    <span className="text-[10px] font-mono text-foreground/70 flex-1">{name}</span>
                    <span className="text-[9px] text-muted-foreground/35">{vram}</span>
                    <span className="text-[9px] text-primary/40 italic">{note}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <StepLabel>3. Select the model</StepLabel>
              <p className="text-[10.5px] text-muted-foreground/55 leading-relaxed">
                In the <span className="font-mono text-foreground/70">Ollama</span> page → <span className="font-mono text-foreground/70">Connection &amp; Model</span>, select the installed model as your translation model.
              </p>
            </div>

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
              hoshi-trans is free and open source — no subscription, no limits.
              If it saved you hours on a translation project, a crypto donation
              helps keep development going and new engines supported.
            </p>
            <div className="flex flex-col gap-2">
              {([
                { symbol: 'BTC', name: 'Bitcoin', address: 'YOUR_BTC_ADDRESS' },
                { symbol: 'ETH', name: 'Ethereum', address: 'YOUR_ETH_ADDRESS' },
                { symbol: 'XMR', name: 'Monero', address: 'YOUR_XMR_ADDRESS' },
              ]).map(({ symbol, name, address }) => (
                <CryptoRow key={symbol} symbol={symbol} name={name} address={address} />
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border/20 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/35">Free to support:</span>
              <a
                href="https://github.com/KATBlackCoder/hoshi-trans"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-muted-foreground/45 hover:text-foreground/70 transition-colors"
              >
                <Github className="w-3 h-3" />
                Star on GitHub
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
