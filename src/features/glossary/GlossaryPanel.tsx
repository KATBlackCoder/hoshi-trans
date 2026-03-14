import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus } from 'lucide-react'
import type { GlossaryTerm } from '@/types'

interface Props {
  projectId: string
}

export function GlossaryPanel({ projectId }: Props) {
  const qc = useQueryClient()
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')

  const { data: terms = [] } = useQuery<GlossaryTerm[]>({
    queryKey: ['glossary', projectId],
    queryFn: () => invoke('get_glossary', { projectId }),
  })

  const upsert = useMutation({
    mutationFn: (vars: { source_term: string; target_term: string }) =>
      invoke('upsert_glossary_term', {
        projectId,
        sourceTerm: vars.source_term,
        targetTerm: vars.target_term,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['glossary', projectId] })
      setSource('')
      setTarget('')
    },
  })

  const deleteTerm = useMutation({
    mutationFn: (id: string) => invoke('delete_glossary_term', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['glossary', projectId] }),
  })

  function handleAdd() {
    const s = source.trim()
    const t = target.trim()
    if (!s || !t) return
    upsert.mutate({ source_term: s, target_term: t })
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wider">
        Glossary
      </h3>

      {terms.length > 0 && (
        <div className="flex flex-col gap-1">
          {terms.map((term) => (
            <div key={term.id} className="flex items-center gap-1.5 group">
              <span className="text-xs font-mono flex-1 truncate text-foreground/80">
                {term.source_term}
              </span>
              <span className="text-xs text-muted-foreground">→</span>
              <span className="text-xs font-mono flex-1 truncate text-foreground/80">
                {term.target_term}
              </span>
              <button
                onClick={() => deleteTerm.mutate(term.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {terms.length === 0 && (
        <p className="text-xs text-muted-foreground/60 italic">No terms yet.</p>
      )}

      <div className="flex flex-col gap-1.5">
        <Input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="JP source"
          className="h-7 text-xs font-mono"
        />
        <Input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Translation"
          className="h-7 text-xs font-mono"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleAdd}
          disabled={!source.trim() || !target.trim() || upsert.isPending}
          className="h-7 gap-1.5 text-xs w-full"
        >
          <Plus className="w-3 h-3" />
          Add term
        </Button>
      </div>

      {terms.length >= 20 && (
        <p className="text-xs text-yellow-500">
          Max 20 terms — oldest terms beyond limit are ignored during translation.
        </p>
      )}
    </div>
  )
}
