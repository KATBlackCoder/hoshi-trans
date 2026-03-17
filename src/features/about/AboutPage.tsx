import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/button'
import { Copy, Check, ExternalLink } from 'lucide-react'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground/60 shrink-0">{label}</span>
      <span className="text-xs font-mono text-foreground/80 text-right truncate">{value}</span>
    </div>
  )
}

function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <code className="flex-1 text-[11px] font-mono bg-muted/50 border border-border/40 rounded px-3 py-2 text-foreground/80 truncate">
        {url}
      </code>
      <Button size="sm" variant="outline" className="h-8 w-8 p-0 shrink-0" onClick={copy} title="Copy URL">
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>
    </div>
  )
}

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

export function AboutPage() {
  const { settings } = useAppStore()
  const ollamaOnline = useAppStore((s) => s.ollamaOnline)
  const availableModels = useAppStore((s) => s.availableModels)

  const isRunPod = settings.ollamaHost.includes('runpod.net')

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg p-6 flex flex-col gap-6">

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

        {/* Ollama connection */}
        <div>
          <SectionLabel>Ollama Connection</SectionLabel>
          <Card>
            <InfoRow
              label="Status"
              value={
                <span className={ollamaOnline ? 'text-green-500' : 'text-amber-500'}>
                  {ollamaOnline ? '● Online' : '● Offline'}
                </span>
              }
            />
            <InfoRow label="Host" value={settings.ollamaHost} />
            <InfoRow label="Provider" value={isRunPod ? 'RunPod (cloud)' : 'Local'} />
            {availableModels.length > 0 && (
              <InfoRow label="Models" value={`${availableModels.length} available`} />
            )}
          </Card>
        </div>

        {/* RunPod section */}
        <div>
          <SectionLabel>RunPod Cloud GPU</SectionLabel>
          <Card>
            <p className="text-xs text-muted-foreground/60 mb-3">
              Use a cloud GPU to translate with <code className="font-mono bg-muted/60 px-1 rounded text-[10px]">hoshi-translator</code> (30B MoE).
              Your pod URL to paste in Settings:
            </p>
            <div className="flex flex-col gap-1.5">
              <p className="text-[10.5px] text-muted-foreground/40 font-mono">
                https://&lt;POD_ID&gt;-11434.proxy.runpod.net
              </p>
              {isRunPod && (
                <>
                  <p className="text-[10.5px] text-muted-foreground/60 mt-1">Current pod URL:</p>
                  <CopyableUrl url={settings.ollamaHost} />
                </>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-[10.5px] text-muted-foreground/40 mb-2">Container Start Command:</p>
              <pre className="text-[10px] font-mono bg-muted/40 border border-border/30 rounded p-3 overflow-x-auto text-foreground/70 leading-relaxed whitespace-pre-wrap">{`bash -c "
apt update && apt install -y curl lshw zstd &&
curl -fsSL https://ollama.com/install.sh | sh &&
OLLAMA_HOST=0.0.0.0 nohup ollama serve > /root/ollama.log 2>&1 &
sleep 60 &&
ollama pull huihui_ai/qwen3-abliterated:30b-a3b-instruct-2507-q4_K_M &&
curl -f -L -o /tmp/hoshi-translator-30b.Modelfile https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/hoshi-translator-30b.Modelfile || exit 1 &&
ollama create hoshi-translator -f /tmp/hoshi-translator-30b.Modelfile || exit 1 &&
echo 'hoshi-translator 30B ready' &&
sleep infinity
"`}</pre>
            </div>
            <a
              href="https://github.com/KATBlackCoder/hoshi-trans/blob/main/RUNPOD.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10.5px] text-primary/70 hover:text-primary transition-colors mt-2"
            >
              <ExternalLink className="w-3 h-3" />
              Full setup guide (RUNPOD.md)
            </a>
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
                KATBlackCoder/hoshi-trans <ExternalLink className="w-3 h-3" />
              </a>
            } />
          </Card>
        </div>

      </div>
    </div>
  )
}
