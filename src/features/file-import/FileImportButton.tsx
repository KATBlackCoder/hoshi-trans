import { useOpenProject } from '@/hooks/useProject'
import { Button } from '@/components/ui/button'
import { FolderOpen } from 'lucide-react'
import { useState } from 'react'

interface Props {
  onProjectOpened?: (project: import('@/types').ProjectFile) => void
}

export function FileImportButton({ onProjectOpened }: Props) {
  const { mutateAsync, isPending } = useOpenProject()
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  async function handleClick() {
    setMessage(null)
    try {
      const project = await mutateAsync()
      if (project) {
        setMessage({ type: 'success', text: `Opened: ${project.game_title}` })
        onProjectOpened?.(project)
      }
    } catch (e) {
      setMessage({ type: 'error', text: String(e) })
    }
  }

  return (
    <div>
      <Button
        onClick={handleClick}
        disabled={isPending}
        variant="outline"
        className="w-full"
      >
        <FolderOpen className="mr-2 h-4 w-4" />
        {isPending ? 'Opening…' : 'Open a game'}
      </Button>
      {message && (
        <p className={`mt-2 text-xs ${message.type === 'error' ? 'text-destructive' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
