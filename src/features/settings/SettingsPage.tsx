import { useAppStore } from '@/stores/appStore'
import { Moon, Sun } from 'lucide-react'

const ACCENT_PRESETS = [
  { name: 'Amber',  value: 'oklch(0.76 0.16 65)',  dot: '#f59e0b' },
  { name: 'Blue',   value: 'oklch(0.65 0.18 240)', dot: '#3b82f6' },
  { name: 'Green',  value: 'oklch(0.68 0.18 145)', dot: '#22c55e' },
  { name: 'Rose',   value: 'oklch(0.68 0.22 10)',  dot: '#f43f5e' },
  { name: 'Purple', value: 'oklch(0.68 0.18 285)', dot: '#a855f7' },
  { name: 'Cyan',   value: 'oklch(0.72 0.16 200)', dot: '#06b6d4' },
]

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/40 bg-card/30 overflow-hidden">
      <div className="px-3.5 py-2 border-b border-border/30 bg-muted/20">
        <span className="text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground/40">{title}</span>
      </div>
      <div className="px-3.5 py-3 flex flex-col gap-4">{children}</div>
    </div>
  )
}

function PanelRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-28 shrink-0 pt-0.5">
        <span className="text-[11px] text-muted-foreground/50 font-medium">{label}</span>
        {hint && <p className="text-[9.5px] text-muted-foreground/30 mt-0.5 leading-tight">{hint}</p>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const { settings, updateSettings } = useAppStore()

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl p-6 flex flex-col gap-4">

        <div>
          <h2 className="text-sm font-semibold">Settings</h2>
          <p className="text-[11px] text-muted-foreground/40 mt-0.5">Application preferences.</p>
        </div>

        <Panel title="Appearance">

          <PanelRow label="Theme" hint="Light or dark interface">
            <div className="flex gap-2">
              <button
                onClick={() => updateSettings({ theme: 'dark' })}
                className={`flex items-center gap-2 px-3.5 py-2 rounded border text-xs transition-colors ${
                  settings.theme === 'dark'
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border/30 bg-background/30 text-muted-foreground/50 hover:bg-muted/20'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
              <button
                onClick={() => updateSettings({ theme: 'light' })}
                className={`flex items-center gap-2 px-3.5 py-2 rounded border text-xs transition-colors ${
                  settings.theme === 'light'
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border/30 bg-background/30 text-muted-foreground/50 hover:bg-muted/20'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Light
              </button>
            </div>
          </PanelRow>

          <PanelRow label="Accent color" hint="Primary UI color">
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => updateSettings({ accentColor: preset.value })}
                  title={preset.name}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs transition-colors ${
                    settings.accentColor === preset.value
                      ? 'border-foreground/20 bg-muted/30 text-foreground/80'
                      : 'border-border/20 bg-background/20 text-muted-foreground/40 hover:bg-muted/20 hover:text-muted-foreground/60'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: preset.dot, boxShadow: settings.accentColor === preset.value ? `0 0 6px 1px ${preset.dot}80` : 'none' }}
                  />
                  {preset.name}
                </button>
              ))}
            </div>
          </PanelRow>

        </Panel>

      </div>
    </div>
  )
}
