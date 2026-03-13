# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settings page for Ollama model, target language, system prompt, and temperature — persisted across sessions via `tauri-plugin-store`, with structured logging via `tauri-plugin-log`.

**Architecture:** `tauri-plugin-store` persists settings as a JSON file in `app_data_dir`. The Zustand store syncs settings on startup (load) and on each change (save). No Rust commands needed for settings — the plugin exposes a JS API directly. Logging is wired in Rust via `tauri-plugin-log`.

**Tech Stack:** tauri-plugin-store, tauri-plugin-log, tracing, tracing-subscriber, Zustand

---

## Packages to Add

```bash
pnpm tauri add store
pnpm tauri add log

# From src-tauri/
cargo add tracing
cargo add tracing-subscriber --features env-filter
```

> ⚠️ After `pnpm tauri add log`, update `lib.rs` to use the builder:
> ```rust
> .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
> ```

---

## File Structure

- Modify: `src-tauri/src/lib.rs` — register tauri-plugin-log with builder
- Modify: `src/stores/appStore.ts` — add Settings state + loadSettings/updateSettings
- Create: `src/features/settings/SettingsPage.tsx` — form (model selector, language, prompt, temperature)
- Create: `src/features/settings/index.ts` — re-export
- Modify: `src/App.tsx` — add Settings navigation + render SettingsPage

---

## Task 1: Install Packages

- [ ] **Step 1: Add Tauri plugins**

```bash
pnpm tauri add store
pnpm tauri add log
```

- [ ] **Step 2: Add Rust crates**

```bash
cd src-tauri
cargo add tracing
cargo add tracing-subscriber --features env-filter
```

- [ ] **Step 3: Update lib.rs — replace generated log init with builder**

```rust
// src-tauri/src/lib.rs — update the log plugin registration
.plugin(
    tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
)
```

- [ ] **Step 4: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/ package.json pnpm-lock.yaml
git commit -m "chore: add tauri-plugin-store, tauri-plugin-log, tracing"
```

---

## Task 2: Settings in Zustand Store

**Files:**
- Modify: `src/stores/appStore.ts`

- [ ] **Step 1: Define settings types and defaults**

```ts
// src/stores/appStore.ts — add to file

import { load } from '@tauri-apps/plugin-store'

export interface Settings {
  ollamaModel: string
  targetLang: 'en' | 'fr'
  systemPrompt: string
  temperature: number
}

const DEFAULT_SETTINGS: Settings = {
  ollamaModel: '',
  targetLang: 'en',
  systemPrompt:
    'You are a professional Japanese game translator. Translate the following text to {lang}. ' +
    'Preserve all placeholders like {{ACTOR_NAME[1]}} exactly as-is. ' +
    'Output only the translation, nothing else.',
  temperature: 0.3,
}

async function getStore() {
  return load('settings.json', { autoSave: true })
}
```

- [ ] **Step 2: Extend the Zustand store**

```ts
// src/stores/appStore.ts — full updated file

import { create } from 'zustand'
import { load } from '@tauri-apps/plugin-store'

export interface Settings {
  ollamaModel: string
  targetLang: 'en' | 'fr'
  systemPrompt: string
  temperature: number
}

const DEFAULT_SETTINGS: Settings = {
  ollamaModel: '',
  targetLang: 'en',
  systemPrompt:
    'You are a professional Japanese game translator. Translate to {lang}. ' +
    'Preserve all {{PLACEHOLDER}} tokens exactly. Output only the translation.',
  temperature: 0.3,
}

interface AppStore {
  ollamaOnline: boolean
  availableModels: string[]
  setOllamaStatus: (online: boolean, models: string[]) => void
  settings: Settings
  loadSettings: () => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
}

export const useAppStore = create<AppStore>((set, get) => ({
  ollamaOnline: false,
  availableModels: [],
  setOllamaStatus: (online, models) => set({ ollamaOnline: online, availableModels: models }),

  settings: DEFAULT_SETTINGS,

  loadSettings: async () => {
    const store = await load('settings.json', { autoSave: true })
    const saved: Partial<Settings> = {}
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const val = await store.get<Settings[typeof key]>(key)
      if (val !== null && val !== undefined) {
        (saved as Record<string, unknown>)[key] = val
      }
    }
    set({ settings: { ...DEFAULT_SETTINGS, ...saved } })
  },

  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch }
    set({ settings: next })
    const store = await load('settings.json', { autoSave: true })
    for (const [k, v] of Object.entries(patch)) {
      await store.set(k, v)
    }
  },
}))
```

- [ ] **Step 3: Call loadSettings on app startup**

```tsx
// src/App.tsx — in App component, add:
import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'

export default function App() {
  const loadSettings = useAppStore((s) => s.loadSettings)
  useEffect(() => { loadSettings() }, [loadSettings])
  // ... rest unchanged
}
```

- [ ] **Step 4: Verify TypeScript**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/stores/appStore.ts src/App.tsx
git commit -m "feat: add settings persistence via tauri-plugin-store"
```

---

## Task 3: SettingsPage Component

**Files:**
- Create: `src/features/settings/SettingsPage.tsx`
- Create: `src/features/settings/index.ts`

- [ ] **Step 1: Install needed shadcn components**

```bash
pnpm dlx shadcn@latest add select slider label
```

- [ ] **Step 2: Write SettingsPage**

```tsx
// src/features/settings/SettingsPage.tsx
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

export function SettingsPage() {
  const { settings, updateSettings, availableModels } = useAppStore()

  return (
    <div className="flex flex-col gap-6 p-6 max-w-xl">
      <h2 className="text-xl font-semibold">Settings</h2>

      {/* Ollama Model */}
      <div className="flex flex-col gap-2">
        <Label>Ollama model</Label>
        <Select
          value={settings.ollamaModel}
          onValueChange={(v) => updateSettings({ ollamaModel: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a model…" />
          </SelectTrigger>
          <SelectContent>
            {availableModels.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Target Language */}
      <div className="flex flex-col gap-2">
        <Label>Target language</Label>
        <Select
          value={settings.targetLang}
          onValueChange={(v) => updateSettings({ targetLang: v as 'en' | 'fr' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="fr">French</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* System Prompt */}
      <div className="flex flex-col gap-2">
        <Label>System prompt</Label>
        <Textarea
          value={settings.systemPrompt}
          onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
          rows={5}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Use <code className="bg-muted px-1 rounded">{'{lang}'}</code> as a placeholder for the target language name.
        </p>
      </div>

      {/* Temperature */}
      <div className="flex flex-col gap-2">
        <Label>Temperature: {settings.temperature.toFixed(1)}</Label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={settings.temperature}
          onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Lower = more consistent, Higher = more creative. Recommended: 0.3
        </p>
      </div>
    </div>
  )
}
```

```ts
// src/features/settings/index.ts
export { SettingsPage } from './SettingsPage'
```

- [ ] **Step 3: Add Settings to navigation in App.tsx**

```tsx
// src/App.tsx — add settings navigation in sidebar
import { SettingsPage } from '@/features/settings'
import { Settings } from 'lucide-react'
import { useState } from 'react'

function MainLayout() {
  const [view, setView] = useState<'main' | 'settings'>('main')

  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r p-4 flex flex-col gap-4">
        <p className="font-semibold">hoshi-trans</p>
        <FileImportButton />
        <div className="mt-auto">
          <button
            onClick={() => setView(view === 'settings' ? 'main' : 'settings')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {view === 'settings' ? <SettingsPage /> : (
          <p className="p-6 text-muted-foreground">Select a game to get started.</p>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Test in app**

Run: `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev`
Expected:
- Settings page accessible via sidebar
- Model selector shows Ollama models
- Language selector shows EN/FR
- Prompt textarea editable
- Temperature slider updates value
- After closing and reopening app → settings are persisted

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/ src/App.tsx
git commit -m "feat: add SettingsPage with model, language, prompt, temperature"
```
