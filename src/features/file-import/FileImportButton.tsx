import { useOpenProject } from '@/hooks/useProject'
import { Button } from '@/components/ui/button'
import { FolderOpen } from 'lucide-react'

export function FileImportButton() {
  const { mutate, isPending, error } = useOpenProject()

  return (
    <div>
      <Button
        onClick={() => mutate()}
        disabled={isPending}
        variant="outline"
        className="w-full"
      >
        <FolderOpen className="mr-2 h-4 w-4" />
        {isPending ? 'Opening…' : 'Open a game'}
      </Button>
      {error && (
        <p className="mt-2 text-xs text-destructive">{error.message}</p>
      )}
    </div>
  )
}
