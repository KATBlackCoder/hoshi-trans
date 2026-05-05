import { useAppStore } from '@/stores/appStore'
import { Moon, Sun, Thermometer } from 'lucide-react'

const ACCENT_PRESETS = [
  { name: 'Voltage',  value: 'oklch(0.86 0.17 95)',  dot: '#facc15' },
  { name: 'Amber',    value: 'oklch(0.76 0.16 65)',  dot: '#f59e0b' },
  { name: 'Blue',     value: 'oklch(0.65 0.18 240)', dot: '#3b82f6' },
  { name: 'Green',    value: 'oklch(0.68 0.18 145)', dot: '#22c55e' },
  { name: 'Rose',     value: 'oklch(0.68 0.22 10)',  dot: '#f43f5e' },
  { name: 'Purple',   value: 'oklch(0.68 0.18 285)', dot: '#a855f7' },
  { name: 'Cyan',     value: 'oklch(0.72 0.16 200)', dot: '#06b6d4' },
]

const TEMP_PRESETS = [
  { value: 0.1, label: 'Very strict' },
  { value: 0.3, label: 'Consistent' },
  { value: 0.5, label: 'Balanced' },
  { value: 0.7, label: 'Creative' },
  { value: 0.9, label: 'Very creative' },
]

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border bg-card/40 overflow-hidden">
      <div className="px-3.5 py-2 border-b-2 border-primary">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{title}</span>
      </div>
      <div className="px-3.5 py-3.5 flex flex-col gap-4">{children}</div>
    </div>
  )
}

function PanelRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-28 shrink-0 pt-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        {hint && <p className="text-[9.5px] text-muted-foreground/55 mt-0.5 leading-tight">{hint}</p>}
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
          <h2 className="text-sm font-extrabold uppercase tracking-tight">Settings</h2>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-1">Application // Preferences</p>
        </div>

        <Panel title="Appearance">

          <PanelRow label="Theme" hint="Light or dark interface">
            <div className="flex gap-2">
              <button
                onClick={() => updateSettings({ theme: 'dark' })}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-sm border text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  settings.theme === 'dark'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-card/70 hover:text-foreground'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
              <button
                onClick={() => updateSettings({ theme: 'light' })}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-sm border text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  settings.theme === 'light'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-card/70 hover:text-foreground'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Light
              </button>
            </div>
          </PanelRow>

          <PanelRow label="Accent" hint="Primary UI color">
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => updateSettings({ accentColor: preset.value })}
                  title={preset.name}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    settings.accentColor === preset.value
                      ? 'border-primary bg-card text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-card/70 hover:text-foreground'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: preset.dot, boxShadow: settings.accentColor === preset.value ? `0 0 8px 1px ${preset.dot}80` : 'none' }}
                  />
                  {preset.name}
                </button>
              ))}
            </div>
          </PanelRow>

        </Panel>

        <Panel title="Translation">

          <PanelRow label="Temperature" hint="Lower = strict & consistent, higher = creative">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Thermometer className="w-4 h-4 text-primary shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={settings.temperature}
                  onChange={e => updateSettings({ temperature: parseFloat(e.target.value) })}
                  className="flex-1 accent-primary"
                />
                <span className="font-mono font-bold text-sm text-primary tabular-nums w-10 text-right">{settings.temperature.toFixed(1)}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {TEMP_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => updateSettings({ temperature: p.value })}
                    className={`px-2 py-1 rounded-sm text-[9.5px] font-bold uppercase tracking-wider transition-colors ${
                      Math.abs(settings.temperature - p.value) < 0.05
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-card hover:text-foreground border border-border'
                    }`}
                  >{p.label}</button>
                ))}
              </div>
            </div>
          </PanelRow>

        </Panel>

      </div>
    </div>
  )
}
