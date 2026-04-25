import { useState, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save, open as openDialog } from '@tauri-apps/plugin-dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Plus, Globe, FolderOpen, Download, Upload, Pencil, Check, X, Search } from 'lucide-react'
import type { GlossaryTerm } from '@/types'

interface EditState {
  id: string
  source_term: string
  target_term: string
  target_lang: string
  project_id: string | null
}

interface ProjectRow {
  id: string
  game_title: string
  target_lang: string
}

const LANG_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'French', value: 'fr' },
]

export function GlossaryPage() {
  const qc = useQueryClient()
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [targetLang, setTargetLang] = useState('en')
  const [scopeProjectId, setScopeProjectId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [filterSearch, setFilterSearch] = useState('')
  const [filterScope, setFilterScope] = useState<'all' | 'global' | string>('all')
  const [filterLang, setFilterLang] = useState<'all' | 'en' | 'fr'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data: terms = [] } = useQuery<GlossaryTerm[]>({
    queryKey: ['glossary-all'],
    queryFn: () => invoke('get_all_glossary_terms'),
  })

  const { data: projects = [] } = useQuery<ProjectRow[]>({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const rows = await invoke<{ id: string; game_title: string; target_lang: string }[]>('get_projects_with_stats')
      return rows.map(r => ({ id: r.id, game_title: r.game_title, target_lang: r.target_lang }))
    },
  })

  const upsert = useMutation({
    mutationFn: () =>
      invoke('upsert_glossary_term', {
        projectId: scopeProjectId,
        sourceTerm: source.trim(),
        targetTerm: target.trim(),
        targetLang,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['glossary-all'] })
      setSource('')
      setTarget('')
    },
  })

  const deleteTerm = useMutation({
    mutationFn: (id: string) => invoke('delete_glossary_term', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['glossary-all'] }),
  })

  const deleteSelected = useMutation({
    mutationFn: (ids: string[]) => invoke('delete_glossary_terms', { ids }),
    onSuccess: () => {
      setSelectedIds(new Set())
      qc.invalidateQueries({ queryKey: ['glossary-all'] })
    },
  })

  const updateTerm = useMutation({
    mutationFn: (s: EditState) =>
      invoke('upsert_glossary_term', {
        id: s.id,
        projectId: s.project_id,
        sourceTerm: s.source_term.trim(),
        targetTerm: s.target_term.trim(),
        targetLang: s.target_lang,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['glossary-all'] })
      setEditState(null)
    },
  })

  const exportGlossary = useMutation({
    mutationFn: async () => {
      const path = await save({ defaultPath: 'glossary.json', filters: [{ name: 'JSON', extensions: ['json'] }] })
      if (!path) return
      await invoke('export_glossary', { path })
    },
  })

  const importGlossary = useMutation({
    mutationFn: async () => {
      const path = await openDialog({ filters: [{ name: 'JSON', extensions: ['json'] }], multiple: false })
      if (!path) return 0
      return invoke<number>('import_glossary', { path })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['glossary-all'] }),
  })

  const filteredTerms = useMemo(() => {
    const q = filterSearch.trim().toLowerCase()
    return terms.filter(t => {
      if (filterScope === 'global' && t.project_id !== null) return false
      if (filterScope !== 'all' && filterScope !== 'global' && t.project_id !== filterScope) return false
      if (filterLang !== 'all' && t.target_lang !== filterLang) return false
      if (q && !t.source_term.toLowerCase().includes(q) && !t.target_term.toLowerCase().includes(q)) return false
      return true
    })
  }, [terms, filterSearch, filterScope, filterLang])

  function handleAdd() {
    if (!source.trim() || !target.trim()) return
    upsert.mutate()
  }

  function projectName(id: string) {
    return projects.find(p => p.id === id)?.game_title ?? id.slice(0, 8)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/60 shrink-0 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-sm">Glossary</h2>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            Global terms apply to all projects. Project terms override global ones for the same source + language.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selectedIds.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteSelected.mutate(Array.from(selectedIds))}
              disabled={deleteSelected.isPending}
              className="h-7 px-2.5 text-xs gap-1.5 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete {selectedIds.size}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => importGlossary.mutate()}
            disabled={importGlossary.isPending}
            className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground/60 hover:text-foreground"
          >
            <Upload className="w-3.5 h-3.5" />
            Import
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportGlossary.mutate()}
            disabled={exportGlossary.isPending || terms.length === 0}
            className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground/60 hover:text-foreground"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Add form */}
      <div className="px-6 py-3 border-b border-border/40 shrink-0">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">JP Term</label>
            <Input
              value={source}
              onChange={e => setSource(e.target.value)}
              placeholder="六花"
              className="h-7 w-32 text-xs font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Translation</label>
            <Input
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder="Rikka"
              className="h-7 w-32 text-xs font-mono"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Lang</label>
            <Select value={targetLang} onValueChange={(v: string | null) => v && setTargetLang(v)}>
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANG_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Scope</label>
            <Select
              value={scopeProjectId ?? '__global__'}
              onValueChange={v => setScopeProjectId(v === '__global__' ? null : v)}
            >
              <SelectTrigger className="h-7 w-44 text-xs font-mono">
                <span className="flex items-center gap-1.5 truncate">
                  {scopeProjectId === null ? (
                    <><Globe className="w-3 h-3 shrink-0" />Global</>
                  ) : (
                    <><FolderOpen className="w-3 h-3 shrink-0" /><span className="truncate">{projects.find(p => p.id === scopeProjectId)?.game_title ?? scopeProjectId}</span></>
                  )}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__" className="text-xs">
                  <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" />Global</span>
                </SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-xs font-mono truncate max-w-45">
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="w-3 h-3 shrink-0" />
                      {p.game_title}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!source.trim() || !target.trim() || upsert.isPending}
            className="h-7 gap-1.5 text-xs mb-0"
          >
            <Plus className="w-3 h-3" />
            Add
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-2 border-b border-border/40 shrink-0 flex items-center gap-3 flex-wrap">
        <div className="relative w-44">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40 pointer-events-none" />
          <Input
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder="Search terms…"
            className="h-7 pl-6 text-xs bg-transparent"
          />
          {filterSearch && (
            <button onClick={() => setFilterSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {(['all', 'global'] as const).map(s => (
            <button key={s} onClick={() => setFilterScope(s)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors capitalize ${
                filterScope === s
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40'
              }`}
            >{s}</button>
          ))}
          <Select
            value={typeof filterScope === 'string' && filterScope !== 'all' && filterScope !== 'global' ? filterScope : '__none__'}
            onValueChange={v => { if (v && v !== '__none__') setFilterScope(v) }}
          >
            <SelectTrigger className={`h-7 w-32 text-xs font-mono border-border/40 ${typeof filterScope === 'string' && filterScope !== 'all' && filterScope !== 'global' ? 'bg-secondary' : ''}`}>
              <span className="flex items-center gap-1 truncate">
                {typeof filterScope === 'string' && filterScope !== 'all' && filterScope !== 'global'
                  ? <><FolderOpen className="w-3 h-3 shrink-0" /><span className="truncate">{projects.find(p => p.id === filterScope)?.game_title ?? filterScope}</span></>
                  : <span className="text-muted-foreground/50">Project…</span>
                }
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs text-muted-foreground/50">Project…</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs font-mono">
                  <span className="flex items-center gap-1.5"><FolderOpen className="w-3 h-3 shrink-0" />{p.game_title}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-0.5">
          {(['all', 'en', 'fr'] as const).map(l => (
            <button key={l} onClick={() => setFilterLang(l)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors uppercase ${
                filterLang === l
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40'
              }`}
            >{l === 'all' ? 'All' : l}</button>
          ))}
        </div>

        {(filterSearch || filterScope !== 'all' || filterLang !== 'all') && (
          <span className="text-[10px] text-muted-foreground/50 font-mono ml-auto tabular-nums">
            {filteredTerms.length} / {terms.length}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {terms.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground/40">
            No glossary terms yet.
          </div>
        ) : filteredTerms.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground/40">
            No terms match the current filters.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm border-b border-border/40">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={filteredTerms.length > 0 && filteredTerms.every(t => selectedIds.has(t.id))}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(filteredTerms.map(t => t.id)) : new Set())}
                    className="w-3.5 h-3.5 accent-primary cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider w-[28%]">JP Term</th>
                <th className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider w-[28%]">Translation</th>
                <th className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider w-[12%]">Lang</th>
                <th className="text-left px-4 py-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider w-[22%]">Scope</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {filteredTerms.map(term => {
                const isEditing = editState?.id === term.id
                return (
                  <tr key={term.id} className={`group border-b border-border/20 hover:bg-muted/30 transition-colors ${selectedIds.has(term.id) ? 'bg-primary/5' : ''}`}>
                    <td className="w-10 px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(term.id)}
                        onChange={e => setSelectedIds(prev => {
                          const next = new Set(prev)
                          e.target.checked ? next.add(term.id) : next.delete(term.id)
                          return next
                        })}
                        className="w-3.5 h-3.5 accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-1.5 font-mono text-foreground/80">
                      {isEditing ? (
                        <Input
                          value={editState.source_term}
                          onChange={e => setEditState(s => s && { ...s, source_term: e.target.value })}
                          className="h-6 text-xs font-mono w-full"
                          autoFocus
                        />
                      ) : term.source_term}
                    </td>
                    <td className="px-4 py-1.5 font-mono text-foreground/80">
                      {isEditing ? (
                        <Input
                          value={editState.target_term}
                          onChange={e => setEditState(s => s && { ...s, target_term: e.target.value })}
                          className="h-6 text-xs font-mono w-full"
                          onKeyDown={e => {
                            if (e.key === 'Enter') updateTerm.mutate(editState)
                            if (e.key === 'Escape') setEditState(null)
                          }}
                        />
                      ) : term.target_term}
                    </td>
                    <td className="px-4 py-1.5">
                      {isEditing ? (
                        <Select value={editState.target_lang} onValueChange={(v: string | null) => v && setEditState(s => s ? { ...s, target_lang: v } : null)}>
                          <SelectTrigger className="h-6 w-20 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LANG_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary/60 text-secondary-foreground">
                          {term.target_lang.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-1.5">
                      {isEditing ? (
                        <Select
                          value={editState.project_id ?? '__global__'}
                          onValueChange={v => setEditState(s => s && { ...s, project_id: v === '__global__' ? null : v })}
                        >
                          <SelectTrigger className="h-6 w-36 text-xs font-mono">
                            <span className="flex items-center gap-1 truncate">
                              {editState.project_id === null ? (
                                <><Globe className="w-3 h-3 shrink-0" />Global</>
                              ) : (
                                <><FolderOpen className="w-3 h-3 shrink-0" /><span className="truncate">{projects.find(p => p.id === editState.project_id)?.game_title}</span></>
                              )}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__global__" className="text-xs">
                              <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" />Global</span>
                            </SelectItem>
                            {projects.map(p => (
                              <SelectItem key={p.id} value={p.id} className="text-xs font-mono">
                                <span className="flex items-center gap-1.5"><FolderOpen className="w-3 h-3 shrink-0" />{p.game_title}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : term.project_id === null ? (
                        <span className="flex items-center gap-1 text-primary/70 text-[11px]">
                          <Globe className="w-3 h-3" />Global
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground/60 text-[11px] truncate">
                          <FolderOpen className="w-3 h-3 shrink-0" />
                          {projectName(term.project_id)}
                        </span>
                      )}
                    </td>
                    <td className="pr-4 text-right">
                      {isEditing ? (
                        <span className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => updateTerm.mutate(editState)}
                            disabled={updateTerm.isPending}
                            className="text-primary/60 hover:text-primary transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditState(null)}
                            className="text-muted-foreground/40 hover:text-foreground transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ) : (
                        <span className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditState({
                              id: term.id,
                              source_term: term.source_term,
                              target_term: term.target_term,
                              target_lang: term.target_lang,
                              project_id: term.project_id,
                            })}
                            className="text-muted-foreground/30 hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteTerm.mutate(term.id)}
                            className="text-muted-foreground/30 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
