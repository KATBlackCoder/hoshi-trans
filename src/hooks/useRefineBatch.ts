import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { TranslationProgress } from '@/types'

export function useRefineBatch() {
  const [progress, setProgress] = useState<TranslationProgress | null>(null)
  const [running, setRunning] = useState(false)
  const unlistenRef = useRef<(() => void) | null>(null)
  const { setBatchStarted, setBatchFinished } = useAppStore()

  useEffect(() => {
    invoke<boolean>('is_refine_running').then(r => setRunning(r))

    const setup = async () => {
      const unlisten1 = await listen<TranslationProgress>('refine:progress', e => {
        setProgress(e.payload)
      })
      const unlisten2 = await listen('refine:complete', () => {
        setRunning(false)
        setProgress(null)
        setBatchFinished()
      })
      unlistenRef.current = () => { unlisten1(); unlisten2() }
    }
    setup()
    return () => { unlistenRef.current?.() }
  }, [])

  async function start(
    projectId: string,
    model: string,
    targetLang: string,
    ollamaHost: string,
    concurrency: number,
    entryIds?: string[],
  ) {
    setRunning(true)
    setProgress(null)
    setBatchStarted()
    try {
      await invoke('refine_batch', {
        projectId,
        model,
        targetLang,
        ollamaHost,
        concurrency,
        entryIds: entryIds ?? null,
      })
    } finally {
      setRunning(false)
      setBatchFinished()
    }
  }

  async function cancel() {
    await invoke('cancel_refine')
  }

  return { progress, running, start, cancel }
}
