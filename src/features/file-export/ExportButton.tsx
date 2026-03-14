import { invoke } from '@tauri-apps/api/core'
import { openPath } from '@tauri-apps/plugin-opener'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { FolderOpen, Loader2 } from 'lucide-react'

interface Props {
  projectId: string
  gameDir: string
  outputDir: string
}

export function ExportButton({ projectId, gameDir, outputDir }: Props) {
  const { mutate, isPending, isSuccess, error } = useMutation({
    mutationFn: async () => {
      const count = await invoke<number>('inject_translations', {
        projectId,
        gameDir,
        outputDir,
      })
      await openPath(outputDir)
      return count
    },
  })

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => mutate()}
        disabled={isPending}
        className="w-full justify-start gap-2"
      >
        {isPending
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <FolderOpen className="w-3.5 h-3.5" />}
        {isPending ? 'Exporting…' : 'Export translated files'}
      </Button>
      {isSuccess && (
        <p className="text-xs text-green-500 px-1">Export complete — folder opened.</p>
      )}
      {error && (
        <p className="text-xs text-destructive px-1">{(error as Error).message}</p>
      )}
    </div>
  )
}
