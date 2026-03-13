import { create } from 'zustand'

interface AppStore {
  ollamaOnline: boolean
  availableModels: string[]
  setOllamaStatus: (online: boolean, models: string[]) => void
}

export const useAppStore = create<AppStore>((set) => ({
  ollamaOnline: false,
  availableModels: [],
  setOllamaStatus: (online, models) =>
    set({ ollamaOnline: online, availableModels: models }),
}))
