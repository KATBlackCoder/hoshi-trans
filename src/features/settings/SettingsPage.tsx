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


export function SettingsPage() {
  const { settings, updateSettings } = useAppStore()

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b-2 border-primary flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-tight">Settings</h2>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">Application // Preferences</p>
        </div>
      </div>

      {/* ── Body: two columns ──────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT ── Appearance */}
        <div className="w-105 shrink-0 border-r border-border overflow-y-auto">
          <div className="p-5 flex flex-col gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Appearance</p>

            {/* Theme */}
            <div className="rounded-sm border border-border bg-card/40 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Theme</span>
                <p className="text-[9.5px] text-muted-foreground/60 mt-0.5">Light or dark interface</p>
              </div>
              <div className="p-3 flex gap-2">
                {([
                  { value: 'dark',  label: 'Dark',  icon: <Moon className="w-3.5 h-3.5" /> },
                  { value: 'light', label: 'Light', icon: <Sun  className="w-3.5 h-3.5" /> },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => updateSettings({ theme: opt.value })}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-sm border text-[11px] font-bold uppercase tracking-wider transition-colors ${
                      settings.theme === opt.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-card/70 hover:text-foreground'
                    }`}
                  >
                    {opt.icon}{opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent color */}
            <div className="rounded-sm border border-border bg-card/40 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Accent color</span>
                <p className="text-[9.5px] text-muted-foreground/60 mt-0.5">Primary UI color</p>
              </div>
              <div className="p-3 grid grid-cols-4 gap-1.5">
                {ACCENT_PRESETS.map((preset) => {
                  const active = settings.accentColor === preset.value
                  return (
                    <button
                      key={preset.name}
                      onClick={() => updateSettings({ accentColor: preset.value })}
                      title={preset.name}
                      className={`flex flex-col items-center gap-2 px-2 py-3 rounded-sm border text-[9.5px] font-bold uppercase tracking-wider transition-colors ${
                        active
                          ? 'border-primary bg-card text-foreground'
                          : 'border-border bg-background text-muted-foreground hover:bg-card/70 hover:text-foreground'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-sm shrink-0"
                        style={{ backgroundColor: preset.dot, boxShadow: active ? `0 0 10px 2px ${preset.dot}60` : 'none' }}
                      />
                      {preset.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT ── Translation */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 flex flex-col gap-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Translation</p>

            {/* Temperature */}
            <div className="rounded-sm border border-border bg-card/40 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Temperature</span>
                <p className="text-[9.5px] text-muted-foreground/60 mt-0.5">Lower = strict &amp; consistent · Higher = creative</p>
              </div>
              <div className="p-4 flex flex-col gap-4">
                {/* Slider row */}
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
                  <span className="font-mono font-bold text-lg text-primary tabular-nums w-12 text-right">
                    {settings.temperature.toFixed(1)}
                  </span>
                </div>
                {/* Presets */}
                <div className="flex gap-1.5">
                  {TEMP_PRESETS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => updateSettings({ temperature: p.value })}
                      className={`flex-1 py-2 rounded-sm text-[9.5px] font-bold uppercase tracking-wider transition-colors ${
                        Math.abs(settings.temperature - p.value) < 0.05
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border text-muted-foreground hover:bg-card hover:text-foreground'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
