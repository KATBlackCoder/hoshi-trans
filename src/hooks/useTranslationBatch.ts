import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useState, useCallback, useEffect } from 'react'
import type { TranslationProgress } from '@/types'
import { useAppStore } from '@/stores/appStore'

export function useTranslationBatch() {
  const [progress, setProgress] = useState<TranslationProgress | null>(null)
  const [running, setRunning] = useState(false)
  const setBatchStarted = useAppStore((s) => s.setBatchStarted)
  const setBatchFinished = useAppStore((s) => s.setBatchFinished)

  // Re-subscribe if a batch was already running when this hook mounted
  // (e.g. the webview reloaded mid-batch)
  useEffect(() => {
    let unlistenProgress: (() => void) | null = null
    let unlistenComplete: (() => void) | null = null

    invoke<boolean>('is_batch_running').then(async (isRunning) => {
      if (!isRunning) return
      setRunning(true)
      unlistenProgress = await listen<TranslationProgress>(
        'translation:progress',
        (e) => setProgress(e.payload),
      )
      unlistenComplete = await listen('translation:complete', () => {
        setRunning(false)
        unlistenProgress?.()
        unlistenComplete?.()
      })
    })

    return () => {
      unlistenProgress?.()
      unlistenComplete?.()
    }
  }, [])

  const start = useCallback(async (
    projectId: string,
    model: string,
    ollamaHost: string,
    limit: number = 0,
    temperature: number = 0.3,
    entryIds?: string[],
  ) => {
    setRunning(true)
    setProgress(null)
    setBatchStarted()

    const unlisten = await listen<TranslationProgress>(
      'translation:progress',
      (e) => setProgress(e.payload),
    )

    try {
      await invoke('translate_batch', {
        projectId,
        model,
        ollamaHost,
        limit,
        temperature,
        entryIds: entryIds ?? null,
      })
    } finally {
      unlisten()
      setRunning(false)
      setBatchFinished()
    }
  }, [])

  const cancel = useCallback(() => invoke('cancel_batch'), [])

  return { progress, running, start, cancel }
}
