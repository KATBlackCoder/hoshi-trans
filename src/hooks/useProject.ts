import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useMutation } from '@tanstack/react-query'
import type { ProjectFile } from '@/types'

export function useOpenProject() {
  return useMutation({
    mutationFn: async (): Promise<ProjectFile | null> => {
      const dir = await open({ directory: true, multiple: false })
      if (!dir) return null

      const project = await invoke<ProjectFile>('open_project', { gameDir: dir })

      // Auto-extract after opening (INSERT OR IGNORE — safe to re-run)
      await invoke<number>('extract_strings', {
        projectId: project.project_id,
        gameDir: dir,
      })

      return project
    },
  })
}
