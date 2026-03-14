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
    'You are a professional Japanese-to-{lang} game translator.\n\n' +
    'Rules:\n' +
    '- Output ONLY the translated text, nothing else. No explanations, no quotes, no notes.\n' +
    '- Any token matching the pattern {{...}} (examples: {{PH:N[1]}}, {{PC[1]}}, {{FONT_UP}}, {{WAIT_S}}) is a game engine code. Copy it EXACTLY character-for-character in the same position. Never modify, remove, or invent {{...}} tokens.\n' +
    '- For Japanese proper names (character names, place names) with no standard {lang} form, romanize them.\n' +
    '- Preserve punctuation style and ellipses (…→...).',
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
    const store = await load('settings.json', )
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
    const store = await load('settings.json', )
    for (const [k, v] of Object.entries(patch)) {
      await store.set(k, v)
    }
  },
}))
