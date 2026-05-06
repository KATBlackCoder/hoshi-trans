import { useState } from 'react'
import { ExternalLink, Github, ChevronDown, ChevronRight, Cpu, Copy, Check, Coins } from 'lucide-react'
import pkg from '../../../package.json'

const APP_VERSION = pkg.version

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
      {children}
    </p>
  )
}


function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-mono text-foreground text-right truncate">{value}</span>
    </div>
  )
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5">{children}</p>
  )
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative group">
      <pre className="text-[10.5px] font-mono bg-background border border-border rounded-sm px-3 py-2.5 text-foreground/85 leading-relaxed whitespace-pre-wrap overflow-x-auto">
        {children}
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-0.5 rounded-sm bg-primary text-primary-foreground border border-primary text-[9.5px] font-bold uppercase tracking-wider"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
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
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm border border-border bg-background">
      <Coins className="w-4 h-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground uppercase tracking-wider">{symbol} <span className="text-[10px] text-muted-foreground font-normal normal-case tracking-normal">— {name}</span></p>
        <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">{address}</p>
      </div>
      <button
        onClick={copy}
        className="flex items-center gap-1 px-2 py-1 rounded-sm border border-border text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function SetupGuides() {
  const [localOpen, setLocalOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">

      <div className="rounded-sm border border-border bg-card/40 overflow-hidden">
        <button
          onClick={() => setLocalOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-card/70 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Cpu className="w-3.5 h-3.5 text-primary" />
            <span className="text-[12px] font-bold text-foreground uppercase tracking-wider">Local Setup</span>
            <span className="text-[10px] text-muted-foreground font-mono">// Linux / Windows</span>
          </div>
          {localOpen ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>

        {localOpen && (
          <div className="px-4 pb-5 border-t border-border bg-background flex flex-col gap-4 pt-4">

            <div className="flex flex-col gap-1.5">
              <StepLabel>1. Install Ollama</StepLabel>
              <CodeBlock>curl -fsSL https://ollama.com/install.sh | sh</CodeBlock>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed mt-0.5">
                Or download the Windows installer at <span className="font-mono text-primary">ollama.com</span>.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <StepLabel>2. Install a hoshi-translator model</StepLabel>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Go to the <span className="font-mono font-bold text-foreground">Ollama</span> page → <span className="font-mono font-bold text-primary">Install Models</span> → click the model you want. hoshi-trans runs <span className="font-mono text-foreground">ollama create</span> for you — it pulls the base model automatically if needed.
              </p>
              <div className="flex flex-col gap-1 mt-1">
                {([
                  { name: 'hoshi-translator-4b', vram: '~4 GB VRAM', note: 'recommended' },
                  { name: 'hoshi-translator-abliterated-4b', vram: '~8 GB VRAM', note: 'higher quality' },
                  { name: 'hoshi-translator-30b', vram: 'min 24 GB VRAM', note: 'best quality' },
                ]).map(({ name, vram, note }) => (
                  <div key={name} className="flex items-center gap-2 px-2 py-1 rounded-sm bg-background border border-border">
                    <span className="text-[10px] font-mono font-bold text-foreground flex-1">{name}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">{vram}</span>
                    <span className="text-[9px] font-bold text-primary uppercase tracking-wider">{note}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <StepLabel>3. Select the model</StepLabel>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                In the <span className="font-mono font-bold text-foreground">Ollama</span> page → <span className="font-mono font-bold text-primary">Connection &amp; Model</span>, select the installed model as your translation model.
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
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b-2 border-primary flex items-center gap-4 shrink-0">
        <div className="w-10 h-10 rounded-sm bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground text-lg font-bold leading-none select-none">星</span>
        </div>
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-tight">hoshi-trans</h2>
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-primary mt-0.5">
            v{APP_VERSION} // Japanese game translator
          </p>
        </div>
      </div>

      {/* ── Body: two columns ──────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT ── About + Setup Guide */}
        <div className="w-105 shrink-0 border-r border-border overflow-y-auto">
          <div className="p-5 flex flex-col gap-5">

            {/* About */}
            <section className="flex flex-col gap-2">
              <SectionLabel>About</SectionLabel>
              <div className="rounded-sm border border-border bg-card/40 p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  hoshi-trans is a free, offline-first desktop app for translating Japanese RPG games
                  (RPG Maker MV/MZ, Wolf RPG) using local AI models via Ollama.
                  No data leaves your machine.
                </p>
              </div>
            </section>

            {/* Setup Guide */}
            <section className="flex flex-col gap-2">
              <SectionLabel>Setup Guide</SectionLabel>
              <SetupGuides />
            </section>

          </div>
        </div>

        {/* RIGHT ── Support + Links */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 flex flex-col gap-5">

            {/* Support */}
            <section className="flex flex-col gap-2">
              <SectionLabel>Support the project</SectionLabel>
              <div className="rounded-sm border border-border bg-card/40 p-4 flex flex-col gap-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  hoshi-trans is free and open source — no subscription, no limits.
                  If it saved you hours on a translation project, a crypto donation
                  helps keep development going and new engines supported.
                </p>
                <div className="flex flex-col gap-2">
                  {([
                    { symbol: 'BTC', name: 'Bitcoin',  address: 'bc1qmr578evx5fzwyr754a00j9hkekd2gzpvs8zxzz' },
                    { symbol: 'ETH', name: 'Ethereum', address: '0x29652Fd86095913d472fF08BFEE5a15c5E7C9D51' },
                  ]).map(({ symbol, name, address }) => (
                    <CryptoRow key={symbol} symbol={symbol} name={name} address={address} />
                  ))}
                </div>
                <div className="pt-3 border-t border-border flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Free to support:</span>
                  <a
                    href="https://github.com/KATBlackCoder/hoshi-trans"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Github className="w-3 h-3" />
                    Star on GitHub
                  </a>
                </div>
              </div>
            </section>

            {/* Links */}
            <section className="flex flex-col gap-2">
              <SectionLabel>Links</SectionLabel>
              <div className="rounded-sm border border-border bg-card/40 p-4 flex flex-col">
                <InfoRow label="GitHub" value={
                  <a
                    href="https://github.com/KATBlackCoder/hoshi-trans"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:opacity-80 transition-opacity flex items-center gap-1"
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
                    className="text-primary hover:opacity-80 transition-opacity flex items-center gap-1"
                  >
                    Report a bug <ExternalLink className="w-3 h-3" />
                  </a>
                } />
              </div>
            </section>

          </div>
        </div>

      </div>
    </div>
  )
}
