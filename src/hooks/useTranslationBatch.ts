import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useState, useCallback } from 'react'
import type { TranslationProgress } from '@/types'

export function useTranslationBatch() {
  const [progress, setProgress] = useState<TranslationProgress | null>(null)
  const [running, setRunning] = useState(false)

  const start = useCallback(async (
    projectId: string,
    model: string,
    targetLang: string,
    systemPrompt: string,
    ollamaHost: string,
    concurrency: number = 4,
    limit: number = 0,
    temperature: number = 0.3,
  ) => {
    setRunning(true)
    setProgress(null)

    const unlisten = await listen<TranslationProgress>(
      'translation:progress',
      (e) => setProgress(e.payload),
    )

    try {
      await invoke('translate_batch', {
        projectId,
        model,
        targetLang,
        systemPrompt,
        ollamaHost,
        concurrency,
        limit,
        temperature,
      })
    } finally {
      unlisten()
      setRunning(false)
    }
  }, [])

  const cancel = useCallback(() => invoke('cancel_batch'), [])

  return { progress, running, start, cancel }
}
