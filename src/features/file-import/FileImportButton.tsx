import { useOpenProject } from '@/hooks/useProject'
import { Button } from '@/components/ui/button'
import { FolderOpen, Loader2 } from 'lucide-react'

interface Props {
  onProjectOpened?: (project: import('@/types').ProjectFile) => void
}

export function FileImportButton({ onProjectOpened }: Props) {
  const { mutateAsync, isPending } = useOpenProject()

  async function handleClick() {
    try {
      const project = await mutateAsync()
      if (project) {
        onProjectOpened?.(project)
      }
    } catch (e) {
      console.error('Failed to open project:', e)
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      variant="outline"
      className="w-full"
    >
      {isPending
        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        : <FolderOpen className="mr-2 h-4 w-4" />}
      {isPending ? 'Extracting…' : 'Open a game'}
    </Button>
  )
}
