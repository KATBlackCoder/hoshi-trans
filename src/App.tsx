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
import { Separator } from '@/components/ui/separator'
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
    <div className="rounded-lg border border-sidebar-border/60 bg-sidebar-accent/10 px-2.5 py-2 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider">
          Wolf RPG font
        </span>
        {charsHint != null && (
          <span className="text-[9px] text-muted-foreground/40">~{charsHint} chars/line</span>
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
          className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-sidebar-accent/60 transition-colors text-xs shrink-0"
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
          className="flex-1 min-w-0 bg-transparent border border-sidebar-border/50 rounded px-1.5 py-0.5 text-[11px] text-center text-sidebar-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          onClick={() => {
            const v = Math.min(64, (numVal ?? 22) + 1)
            const s = String(v)
            setValue(s)
            applyFont(s)
          }}
          className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-sidebar-accent/60 transition-colors text-xs shrink-0"
        >+</button>
        {value !== '' && (
          <button
            onClick={() => { setValue(''); applyFont('') }}
            className="text-[9px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors shrink-0"
            title="Reset to game default"
          >✕</button>
        )}
      </div>
      {saving && <span className="text-[9px] text-muted-foreground/40 text-center">saving…</span>}
      <p className="text-[9px] text-muted-foreground/35 leading-relaxed">
        Try the game first before changing the font. Ideal size for Latin text: <span className="text-muted-foreground/55 font-medium">20–22</span>.
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
    <div className="rounded-lg border border-sidebar-border/60 bg-sidebar-accent/10 px-2.5 py-2 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider">
          Translation time
        </span>
        <Timer className={`w-3 h-3 ${running ? 'text-primary/70 animate-pulse' : 'text-muted-foreground/30'}`} />
      </div>
      <span className="text-[13px] font-mono tabular-nums text-sidebar-foreground/80 text-center">
        {running ? formatDuration(elapsed) : formatDuration(batchLastDuration!)}
      </span>
      {!running && (
        <span className="text-[9px] text-muted-foreground/35 text-center">last batch</span>
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
        className={`relative flex items-center gap-2 px-3.5 py-2 text-xs transition-colors ${
          active
            ? 'text-foreground font-medium'
            : 'text-muted-foreground/60 hover:text-foreground hover:bg-sidebar-accent/40'
        }`}
      >
        {active && <span className="absolute left-0 inset-y-1.5 w-0.5 bg-primary rounded-r" />}
        {icon}
        {label}
      </button>
    )
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-primary/12 border border-primary/20 shrink-0">
          <span className="text-primary text-[13px] font-bold leading-none select-none">星</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">hoshi</span>
          <span className="text-sm font-light text-muted-foreground/50 tracking-tight">trans</span>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <div className="flex flex-col gap-2 p-3 flex-1 overflow-y-auto">
        <FileImportButton onProjectOpened={(p) => { onProjectOpened(p); onViewChange('translation') }} />

        {activeProject && (
          <div className="flex flex-col gap-1">
            {/* Back to library */}
            <button
              onClick={() => onViewChange('library')}
              className="flex items-center gap-1 text-[10px] text-muted-foreground/35 hover:text-muted-foreground/70 transition-colors px-1 py-0.5"
            >
              <ChevronLeft className="w-3 h-3" />
              All projects
            </button>

            {/* Active project card */}
            <div
              onClick={() => onViewChange('translation')}
              className={`rounded-lg border overflow-hidden cursor-pointer transition-all duration-150 ${
                view === 'translation'
                  ? 'border-primary/35 bg-primary/6'
                  : 'border-sidebar-border/80 bg-sidebar-accent/20 hover:bg-sidebar-accent/40 hover:border-sidebar-border'
              }`}
            >
              <div className="flex items-start gap-2 p-2.5 pb-1.5">
                <Languages className="w-3 h-3 text-primary/70 mt-0.5 shrink-0" />
                <p className="text-[11px] font-medium text-sidebar-foreground leading-tight flex-1 min-w-0 wrap-break-word">
                  {activeProject.game_title}
                </p>
                <AlertDialog>
                  <AlertDialogTrigger
                    onClick={e => e.stopPropagation()}
                    title="Delete project"
                    className="text-muted-foreground/30 hover:text-destructive transition-colors shrink-0 mt-0.5 p-0.5 rounded hover:bg-destructive/10"
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
              <p className="text-[9px] text-muted-foreground/40 font-mono px-2.5 pb-2 uppercase tracking-wider">
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

      {/* Nav buttons — bottom of sidebar */}
      <Separator className="bg-sidebar-border" />
      {activeProject && (
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
                className="relative flex items-center gap-2 px-3.5 py-2 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-sidebar-accent/40 transition-colors"
              >
                <Bug className="w-3.5 h-3.5" />
                {label}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex flex-col py-1">
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
