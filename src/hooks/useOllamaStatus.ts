import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '@/stores/appStore'

export function useOllamaStatus() {
  const setOllamaStatus = useAppStore((s) => s.setOllamaStatus)
  const ollamaHost = useAppStore((s) => s.settings.ollamaHost)

  const query = useQuery({
    queryKey: ['ollama-status', ollamaHost],
    queryFn: async () => {
      const online = await invoke<boolean>('check_ollama', { ollamaHost })
      if (online) {
        const models = await invoke<string[]>('list_models', { ollamaHost })
        return { online, models }
      }
      return { online: false, models: [] }
    },
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (query.data) {
      setOllamaStatus(query.data.online, query.data.models)
    }
  }, [query.data, setOllamaStatus])

  return query
}
