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
    <div className="flex flex-col gap-2">
      {terms.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {terms.map((term) => (
            <div key={term.id} className="flex items-center gap-1 group py-0.5 px-0.5 rounded hover:bg-sidebar-accent/40 transition-colors">
              <span className="text-[10.5px] font-mono flex-1 truncate text-foreground/70">
                {term.source_term}
              </span>
              <span className="text-[9px] text-muted-foreground/30 shrink-0">→</span>
              <span className="text-[10.5px] font-mono flex-1 truncate text-foreground/70">
                {term.target_term}
              </span>
              <button
                onClick={() => deleteTerm.mutate(term.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/30 hover:text-destructive shrink-0 ml-0.5"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {terms.length === 0 && (
        <p className="text-[10.5px] text-muted-foreground/30 italic px-0.5">No terms yet.</p>
      )}

      <div className="flex flex-col gap-1">
        <Input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="JP term"
          className="h-6 text-[10.5px] font-mono px-2 bg-transparent"
        />
        <Input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Translation"
          className="h-6 text-[10.5px] font-mono px-2 bg-transparent"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleAdd}
          disabled={!source.trim() || !target.trim() || upsert.isPending}
          className="h-6 gap-1 text-[10.5px] w-full text-muted-foreground/50 hover:text-foreground border border-border/40 border-dashed"
        >
          <Plus className="w-2.5 h-2.5" />
          Add
        </Button>
      </div>

      {terms.length >= 20 && (
        <p className="text-[10px] text-amber-400/60 font-mono">
          Max 20 terms reached.
        </p>
      )}
    </div>
  )
}
