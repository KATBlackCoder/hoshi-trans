import { useOllamaStatus } from '@/hooks/useOllamaStatus'
import { useAppStore } from '@/stores/appStore'
import { OnboardingPage } from '@/features/onboarding'
import { FileImportButton } from '@/features/file-import'
import { TranslationView } from '@/features/translation'
import { SettingsPage } from '@/features/settings'
import { GlossaryPage } from '@/features/glossary'
import { ProjectLibrary } from '@/features/project-library'
import { AboutPage } from '@/features/about'
import { OllamaPage } from '@/features/ollama'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import React, { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { BookOpen, ChevronLeft, Info, Languages, Settings, Trash2, Cpu, Timer, Bug } from 'lucide-react'
import type { ProjectFile } from '@/types'

type View = 'library' | 'translation' | 'settings' | 'glossary' | 'about' | 'ollama'

// Approximate safe chars/line for Wolf RPG at a given font size.
// Based on ~480px text area width and avg Latin char width ratio.
function wolfCharsPerLine(size: number): number {
  return Math.round(10560 / (size * 10))
}

function WolfRpgFontPanel({
  project,
  onUpdate,
}: {
  project: ProjectFile
  onUpdate: (p: ProjectFile) => void
}) {
  const [value, setValue] = useState<string>(
    project.wolf_rpg_font_size != null ? String(project.wolf_rpg_font_size) : ''
  )
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function applyFont(newValue: string) {
    const parsed = newValue === '' ? null : parseInt(newValue, 10)
    if (parsed !== null && (isNaN(parsed) || parsed < 8 || parsed > 64)) return
    setSaving(true)
    try {
      const updated: ProjectFile = await invoke('update_wolf_rpg_font', {
        gameDir: project.game_dir,
        fontSize: parsed,
      })
      onUpdate(updated)
    } finally {
      setSaving(false)
    }
  }

  const numVal = value === '' ? null : parseInt(value, 10)
  const charsHint = numVal != null && !isNaN(numVal) ? wolfCharsPerLine(numVal) : null

  return (
    <div className="rounded-sm border border-sidebar-border bg-card/50 px-2.5 py-2 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
          Wolf RPG font
        </span>
        {charsHint != null && (
          <span className="text-[9px] font-mono text-muted-foreground/60">~{charsHint} chars/line</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            const v = Math.max(8, (numVal ?? 22) - 1)
            const s = String(v)
            setValue(s)
            applyFont(s)
          }}
          className="w-6 h-6 rounded-sm border border-border flex items-center justify-center text-muted-foreground hover:text-primary-foreground hover:bg-primary transition-colors text-xs font-bold shrink-0"
        >−</button>
        <input
          ref={inputRef}
          type="number"
          min={8}
          max={64}
          value={value}
          placeholder="default"
          onChange={e => setValue(e.target.value)}
          onBlur={e => applyFont(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applyFont(value) }}
          className="flex-1 min-w-0 bg-card border border-sidebar-border rounded-sm px-1.5 py-0.5 text-xs text-center font-mono font-bold text-sidebar-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/55 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          onClick={() => {
            const v = Math.min(64, (numVal ?? 22) + 1)
            const s = String(v)
            setValue(s)
            applyFont(s)
          }}
          className="w-6 h-6 rounded-sm border border-border flex items-center justify-center text-muted-foreground hover:text-primary-foreground hover:bg-primary transition-colors text-xs font-bold shrink-0"
        >+</button>
        {value !== '' && (
          <button
            onClick={() => { setValue(''); applyFont('') }}
            className="text-[10px] text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
            title="Reset to game default"
          >✕</button>
        )}
      </div>
      {saving && <span className="text-[9px] font-mono text-muted-foreground/60 text-center">saving…</span>}
      <p className="text-[9px] text-muted-foreground/55 leading-relaxed">
        Try the game first before changing the font. Ideal: <span className="text-primary font-bold">20–22</span>.
      </p>
    </div>
  )
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

function TranslationTimer() {
  const batchStartedAt = useAppStore((s) => s.batchStartedAt)
  const batchLastDuration = useAppStore((s) => s.batchLastDuration)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (batchStartedAt === null) return
    setElapsed(Date.now() - batchStartedAt)
    const id = setInterval(() => setElapsed(Date.now() - batchStartedAt), 1000)
    return () => clearInterval(id)
  }, [batchStartedAt])

  if (batchStartedAt === null && batchLastDuration === null) return null

  const running = batchStartedAt !== null

  return (
    <div className="rounded-sm border border-sidebar-border bg-card/50 px-2.5 py-2 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
          Translation time
        </span>
        <Timer className={`w-3 h-3 ${running ? 'text-primary animate-pulse' : 'text-muted-foreground/40'}`} />
      </div>
      <span className="text-base font-mono font-bold tabular-nums text-primary text-center tracking-wider">
        {running ? formatDuration(elapsed) : formatDuration(batchLastDuration!)}
      </span>
      {!running && (
        <span className="text-[9px] font-mono text-muted-foreground/55 text-center uppercase tracking-wider">last batch</span>
      )}
    </div>
  )
}

function Sidebar({ activeProject, onProjectOpened, onProjectDeleted, onProjectUpdated, view, onViewChange }: {
  activeProject: ProjectFile | null
  onProjectOpened: (p: ProjectFile) => void
  onProjectDeleted: () => void
  onProjectUpdated: (p: ProjectFile) => void
  view: View
  onViewChange: (v: View) => void
}) {
  async function handleDelete() {
    await invoke('delete_project', {
      projectId: activeProject!.project_id,
      gameDir: activeProject!.game_dir,
    })
    onProjectDeleted()
  }

  const navBtn = (v: View, label: string, icon: React.ReactNode) => {
    const active = view === v
    const toggle = active ? (activeProject ? 'translation' : 'library') : v
    return (
      <button
        onClick={() => onViewChange(toggle)}
        className={`flex items-center gap-2 px-3 py-2 rounded-sm text-[11px] font-bold uppercase tracking-wider transition-colors ${
          active
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
        }`}
      >
        {icon}
        {label}
      </button>
    )
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3.5 py-3.5 border-b-2 border-primary">
        <div className="flex items-center justify-center w-8 h-8 rounded-sm bg-primary shrink-0">
          <span className="text-primary-foreground text-base font-bold leading-none select-none">星</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-extrabold tracking-tight uppercase text-sidebar-foreground">hoshi</span>
          <span className="text-[11px] font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded-sm px-1.5 py-0.5">trans</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3 flex-1 overflow-y-auto">
        <FileImportButton onProjectOpened={(p) => { onProjectOpened(p); onViewChange('translation') }} />

        {activeProject && (
          <div className="flex flex-col gap-1.5">
            {/* Back to library */}
            <button
              onClick={() => onViewChange('library')}
              className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/55 hover:text-foreground transition-colors px-1 py-0.5"
            >
              <ChevronLeft className="w-3 h-3" />
              All projects
            </button>

            {/* Active project card */}
            <div
              onClick={() => onViewChange('translation')}
              className={`rounded-sm border bg-card/40 overflow-hidden cursor-pointer transition-all duration-150 ${
                view === 'translation'
                  ? 'border-l-[3px] border-l-primary border-y-border border-r-border'
                  : 'border-sidebar-border hover:bg-card/70'
              }`}
            >
              <div className="flex items-start gap-2 p-2.5 pb-1.5">
                <Languages className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] font-bold text-sidebar-foreground leading-tight flex-1 min-w-0 wrap-break-word">
                  {activeProject.game_title}
                </p>
                <AlertDialog>
                  <AlertDialogTrigger
                    onClick={e => e.stopPropagation()}
                    title="Delete project"
                    className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0 mt-0.5 p-0.5 rounded-sm hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3 h-3" />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove <strong>{activeProject.game_title}</strong> and
                        all its translations from the database. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <p className="text-[9px] text-primary font-mono font-bold px-2.5 pb-2 uppercase tracking-widest">
                {activeProject.engine.replace(/_/g, ' ')}
              </p>
            </div>
            {activeProject.engine === 'wolf_rpg' && (
              <WolfRpgFontPanel project={activeProject} onUpdate={onProjectUpdated} />
            )}
            <TranslationTimer />
          </div>
        )}
      </div>

      {/* Debug buttons — DEV only (Bug fix #3) */}
      {activeProject && import.meta.env.DEV && (
        <>
          <div className="h-px bg-sidebar-border" />
          <div className="flex flex-col py-1 border-b border-sidebar-border">
            {(['export_debug_json', 'export_debug_review_json', 'export_debug_warning_json', 'export_debug_prompts_json'] as const).map((cmd, i) => {
              const label = i === 0 ? 'Debug JSON' : i === 1 ? 'Debug Review' : i === 2 ? 'Debug Warning' : 'Debug Prompts'
              return (
                <button
                  key={cmd}
                  onClick={async () => {
                    const { openPath } = await import('@tauri-apps/plugin-opener')
                    const args = cmd === 'export_debug_prompts_json'
                      ? { outputDir: activeProject.output_dir }
                      : { projectId: activeProject.project_id, outputDir: activeProject.output_dir }
                    const path = await invoke<string>(cmd, args)
                    await openPath(path)
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
                >
                  <Bug className="w-3.5 h-3.5" />
                  {label}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Nav buttons */}
      <div className="h-px bg-sidebar-border" />
      <div className="flex flex-col gap-0.5 p-1.5">
        {navBtn('glossary', 'Glossary', <BookOpen className="w-3.5 h-3.5" />)}
        {navBtn('ollama', 'Ollama', <Cpu className="w-3.5 h-3.5" />)}
        {navBtn('settings', 'Settings', <Settings className="w-3.5 h-3.5" />)}
        {navBtn('about', 'About', <Info className="w-3.5 h-3.5" />)}
      </div>
    </aside>
  )
}

function MainLayout() {
  const [activeProject, setActiveProject] = useState<ProjectFile | null>(null)
  const [view, setView] = useState<View>('library')

  function handleProjectOpened(p: ProjectFile) {
    setActiveProject(p)
    setView('translation')
  }

  function handleProjectDeleted() {
    setActiveProject(null)
    setView('library')
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        activeProject={activeProject}
        onProjectOpened={handleProjectOpened}
        onProjectDeleted={handleProjectDeleted}
        onProjectUpdated={setActiveProject}
        view={view}
        onViewChange={setView}
      />
      <main className="flex-1 overflow-hidden">
        {view === 'ollama' ? (
          <OllamaPage />
        ) : view === 'settings' ? (
          <SettingsPage />
        ) : view === 'glossary' ? (
          <GlossaryPage />
        ) : view === 'about' ? (
          <AboutPage />
        ) : view === 'translation' && activeProject ? (
          <TranslationView
            projectId={activeProject.project_id}
            gameTitle={activeProject.game_title}
            gameDir={activeProject.game_dir}
            outputDir={activeProject.output_dir}
          />
        ) : (
          <ProjectLibrary onOpen={handleProjectOpened} />
        )}
      </main>
    </div>
  )
}

export default function App() {
  useOllamaStatus()
  const ollamaOnline = useAppStore((s) => s.ollamaOnline)
  const loadSettings = useAppStore((s) => s.loadSettings)
  useEffect(() => { loadSettings() }, [loadSettings])

  return ollamaOnline ? <MainLayout /> : <OnboardingPage />
}
