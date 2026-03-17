import { invoke } from '@tauri-apps/api/core'
import { useQuery } from '@tanstack/react-query'
import { Globe } from 'lucide-react'
import type { GlossaryTerm } from '@/types'

interface Props {
  projectId: string
  targetLang: string
}

export function GlossaryPanel({ projectId, targetLang }: Props) {
  const { data: all = [] } = useQuery<GlossaryTerm[]>({
    queryKey: ['glossary-all'],
    queryFn: () => invoke('get_all_glossary_terms'),
  })

  // Show global terms matching target_lang + project-specific terms
  const terms = all.filter(
    t =>
      t.target_lang === targetLang &&
      (t.project_id === null || t.project_id === projectId)
  )

  if (terms.length === 0) {
    return (
      <p className="text-[10.5px] text-muted-foreground/30 italic px-0.5">No terms yet.</p>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      {terms.map(term => (
        <div key={term.id} className="flex items-center gap-1 py-0.5 px-0.5 rounded">
          <span className="text-[10.5px] font-mono flex-1 truncate text-foreground/70">
            {term.source_term}
          </span>
          <span className="text-[9px] text-muted-foreground/30 shrink-0">→</span>
          <span className="text-[10.5px] font-mono flex-1 truncate text-foreground/70">
            {term.target_term}
          </span>
          {term.project_id === null && (
            <Globe className="w-2.5 h-2.5 shrink-0 text-primary/40" />
          )}
        </div>
      ))}
    </div>
  )
}
