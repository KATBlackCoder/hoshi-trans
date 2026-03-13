import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useMutation } from '@tanstack/react-query'
import type { ProjectFile } from '@/types'

export function useOpenProject() {
  return useMutation({
    mutationFn: async (): Promise<ProjectFile | null> => {
      const dir = await open({ directory: true, multiple: false })
      if (!dir) return null
      return invoke<ProjectFile>('open_project', { gameDir: dir })
    },
  })
}
