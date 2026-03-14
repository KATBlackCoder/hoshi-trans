import { useAppStore } from '@/stores/appStore'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function SettingCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-border/50 bg-card/40 p-4 flex flex-col gap-3">
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-1">
      {children}
    </p>
  )
}

export function SettingsPage() {
  const { settings, updateSettings, availableModels } = useAppStore()

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-sm font-semibold">Settings</h2>
          <p className="text-xs text-muted-foreground/50 mt-0.5">Configured per session, persisted across restarts.</p>
        </div>

        {/* Model & Language */}
        <div>
          <SectionLabel>Model</SectionLabel>
          <SettingCard>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Ollama model</Label>
              <Select
                value={settings.ollamaModel}
                onValueChange={(v) => updateSettings({ ollamaModel: v ?? '' })}
              >
                <SelectTrigger className="font-mono text-xs">
                  <SelectValue placeholder="Select a model…" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m} value={m} className="font-mono text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Target language</Label>
              <Select
                value={settings.targetLang}
                onValueChange={(v) => updateSettings({ targetLang: v as 'en' | 'fr' })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SettingCard>
        </div>

        {/* Temperature */}
        <div>
          <SectionLabel>Generation</SectionLabel>
          <SettingCard>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Temperature</Label>
                <span className="text-xs font-mono text-primary">{settings.temperature.toFixed(1)}</span>
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
              <div className="flex justify-between text-[9.5px] text-muted-foreground/40 font-mono">
                <span>0.0 — consistent</span>
                <span>1.0 — creative</span>
              </div>
            </div>
          </SettingCard>
        </div>

        {/* System Prompt */}
        <div>
          <SectionLabel>Prompt</SectionLabel>
          <SettingCard>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">System prompt</Label>
              <Textarea
                value={settings.systemPrompt}
                onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                rows={6}
                className="font-mono text-[11.5px] leading-relaxed resize-none bg-background/50"
              />
              <p className="text-[10.5px] text-muted-foreground/40">
                Use <code className="font-mono bg-muted/60 px-1 rounded text-[10px]">{'{lang}'}</code> as placeholder for the target language name.
              </p>
            </div>
          </SettingCard>
        </div>
      </div>
    </div>
  )
}
