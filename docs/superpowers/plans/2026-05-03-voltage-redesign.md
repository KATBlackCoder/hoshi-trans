# Voltage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte complète du frontend hoshi-trans avec le design "Voltage" (jaune électrique brutalist) + correction simultanée de 5 bugs identifiés.

**Architecture:** On commence par les fondations (variables CSS, primitives shadcn) puis on remonte page par page. Chaque commit produit une UI cohérente même si toutes les pages ne sont pas encore migrées (les variables CSS partagées garantissent un look unifié au niveau des couleurs/bordures, même quand le layout d'une page n'a pas encore été réécrit). Les 5 bug fixes sont intégrés dans les tâches qui touchent leurs fichiers respectifs (pas de tâches "bug fix" séparées).

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui, Tauri v2, Zustand, TanStack Query.

**Verification:** Pas de tests unitaires (app desktop, vérification visuelle). Après chaque tâche, lancer `pnpm tauri:linux` et vérifier visuellement la zone modifiée.

---

## File Structure

**Modified files (existing, no new files needed):**

| File | Responsibility |
|------|---------------|
| `src/App.css` | Design tokens (couleurs OKLCH, radius, status strips) |
| `src/App.tsx` | Sidebar + nav + WolfRpgFontPanel + TranslationTimer |
| `src/components/ui/button.tsx` | Variants Voltage (sharp corners, uppercase, bold) |
| `src/components/ui/input.tsx` | Bordure jaune au focus |
| `src/components/ui/select.tsx` | Aligné sur input/button |
| `src/features/translation/TranslationView.tsx` | Header + toolbar |
| `src/features/translation/TranslationRow.tsx` | Status badges carrés + cells |
| `src/features/translation/BatchControls.tsx` | Boutons TL/RF voltage style |
| `src/features/translation/FileStatsPanel.tsx` | Liste fichiers + progress bars |
| `src/features/ollama/OllamaPage.tsx` | Cards + Tips (bug #4) + temp display (bug #5) |
| `src/features/settings/SettingsPage.tsx` | Panels + slider température (bug #5) |
| `src/features/glossary/GlossaryPage.tsx` | Header + form + filter bar + table |
| `src/features/about/AboutPage.tsx` | Cards + version v0.1.1 (bug #1) + retirer Bakin (bug #2) |
| `src/features/onboarding/OnboardingPage.tsx` | Hero + steps |
| `src/features/project-library/ProjectLibrary.tsx` | Grid + cards |
| `src/features/file-import/FileImportButton.tsx` | Bouton import |

---

## Bug Fix Integration Map

| Bug | Tâche d'intégration |
|-----|---------------------|
| #1 — Version "v0.1.0" → "v0.1.1" dans AboutPage | Task 13 |
| #2 — "Bakin" mentionné dans description AboutPage | Task 13 |
| #3 — Boutons Debug visibles en prod (App.tsx:288-311) | Task 5 |
| #4 — Tips obsolètes dans OllamaPage | Task 10 |
| #5 — Température affichée sans contrôle UI | Task 10 (display) + Task 11 (slider in Settings) |

---

## Task 1: Refonte des variables CSS de thème (App.css)

**Files:**
- Modify: `src/App.css:9-69` (variables `:root` + `.dark`)

- [ ] **Step 1: Remplacer la section `:root` (light theme) et `.dark` (dark theme)**

Ouvrir `src/App.css`, remplacer les blocs `:root` et `.dark` par :

```css
/* Light theme (fallback — rarely used, app defaults to dark) */
:root {
  --background: oklch(0.99 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.86 0.17 95);
  --primary-foreground: oklch(0.145 0 0);
  --secondary: oklch(0.96 0 0);
  --secondary-foreground: oklch(0.145 0 0);
  --muted: oklch(0.96 0 0);
  --muted-foreground: oklch(0.5 0 0);
  --accent: oklch(0.96 0 0);
  --accent-foreground: oklch(0.145 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.92 0 0);
  --input: oklch(0.92 0 0);
  --ring: oklch(0.86 0.17 95);
  --radius: 0.25rem;
  --sidebar: oklch(0.98 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.86 0.17 95);
  --sidebar-primary-foreground: oklch(0.145 0 0);
  --sidebar-accent: oklch(0.94 0 0);
  --sidebar-accent-foreground: oklch(0.145 0 0);
  --sidebar-border: oklch(0.92 0 0);
  --sidebar-ring: oklch(0.86 0.17 95);
}

/* Dark theme — "Voltage" — electric yellow brutalist */
.dark {
  --background: oklch(0.16 0 0);
  --foreground: oklch(0.97 0 0);
  --card: oklch(0.21 0 0);
  --card-foreground: oklch(0.97 0 0);
  --popover: oklch(0.21 0 0);
  --popover-foreground: oklch(0.97 0 0);
  --primary: oklch(0.86 0.17 95);
  --primary-foreground: oklch(0.16 0 0);
  --secondary: oklch(0.25 0 0);
  --secondary-foreground: oklch(0.97 0 0);
  --muted: oklch(0.21 0 0);
  --muted-foreground: oklch(0.62 0 0);
  --accent: oklch(0.25 0 0);
  --accent-foreground: oklch(0.97 0 0);
  --destructive: oklch(0.62 0.22 22);
  --border: oklch(0.86 0.17 95 / 12%);
  --input: oklch(0.86 0.17 95 / 14%);
  --ring: oklch(0.86 0.17 95);
  --radius: 0.25rem;
  --sidebar: oklch(0.18 0 0);
  --sidebar-foreground: oklch(0.97 0 0);
  --sidebar-primary: oklch(0.86 0.17 95);
  --sidebar-primary-foreground: oklch(0.16 0 0);
  --sidebar-accent: oklch(0.25 0 0);
  --sidebar-accent-foreground: oklch(0.97 0 0);
  --sidebar-border: oklch(0.86 0.17 95 / 10%);
  --sidebar-ring: oklch(0.86 0.17 95);
}
```

- [ ] **Step 2: Vérifier visuellement**

Run: `pnpm tauri:linux`
Expected: L'app affiche maintenant un fond noir avec accents jaunes. Les composants ne sont pas encore stylés mais le primary est passé d'ambre à jaune électrique. La navigation devrait montrer la nouvelle couleur sur l'item actif.

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "feat(design): introduce Voltage theme tokens (yellow brutalist)"
```

---

## Task 2: Status strips et animation shimmer (App.css)

**Files:**
- Modify: `src/App.css:135-176` (utilities)

- [ ] **Step 1: Remplacer les utilities status-strip pour matcher Voltage**

Dans `src/App.css`, remplacer le bloc `@layer utilities { ... }` par :

```css
/* Status strip colors for translation rows */
@layer utilities {
  .status-strip-pending    { border-left: 3px solid oklch(1 0 0 / 8%); }
  .status-strip-translated { border-left: 3px solid oklch(0.72 0.19 145); }
  .status-strip-warning    { border-left: 3px solid oklch(0.86 0.17 95); }
  .status-strip-error      { border-left: 3px solid oklch(0.62 0.22 22); }
  .status-strip-skipped    { border-left: 3px solid oklch(1 0 0 / 5%); }
  .status-strip-reviewed   { border-left: 3px solid oklch(0.62 0.20 250); }

  .status-row-warning  { background-color: oklch(0.86 0.17 95 / 3%); }
  .status-row-reviewed { background-color: oklch(0.62 0.20 250 / 3%); }
  .status-row-error    { background-color: oklch(0.62 0.22 22 / 3%); }

  /* Shimmer for progress bar — solid yellow now, no shimmer needed but keep keyframe */
  @keyframes shimmer {
    0%   { opacity: 0.85; }
    50%  { opacity: 1; }
    100% { opacity: 0.85; }
  }
  .shimmer {
    background: var(--primary);
    animation: shimmer 1.4s ease-in-out infinite;
  }

  /* Pulse ring for onboarding */
  @keyframes pulse-ring {
    0%   { transform: scale(1);   opacity: 0.6; }
    100% { transform: scale(1.8); opacity: 0; }
  }
  .pulse-ring::before {
    content: '';
    position: absolute;
    inset: -8px;
    border: 1.5px solid var(--primary);
    animation: pulse-ring 2s ease-out infinite;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.css
git commit -m "feat(design): update status strips and progress shimmer for Voltage"
```

---

## Task 3: Variants Button (Voltage style)

**Files:**
- Modify: `src/components/ui/button.tsx:6-41` (cva variants)

- [ ] **Step 1: Mettre à jour le `cva` du Button**

Remplacer le bloc `const buttonVariants = cva(...)` par :

```tsx
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-sm border border-transparent bg-clip-padding text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border-primary/30 bg-transparent text-foreground/85 hover:bg-primary/10 hover:border-primary/55 hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "text-foreground/70 hover:bg-primary/10 hover:text-foreground border-transparent hover:border-primary/20",
        destructive:
          "bg-destructive/15 text-destructive hover:bg-destructive/25 border-destructive/30",
        link: "text-primary underline-offset-4 hover:underline border-none",
      },
      size: {
        default: "h-8 gap-1.5 px-3",
        xs: "h-6 gap-1 px-2 text-[10px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 px-2.5 text-[11px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-4 text-[13px]",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

- [ ] **Step 2: Vérifier le rendu**

Run: `pnpm tauri:linux`
Expected: Tous les boutons sont maintenant en `UPPERCASE BOLD`, coins carrés, fond jaune solide pour le primary, bordure jaune fine pour outline.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat(design): voltage variants for Button (sharp, uppercase, bold)"
```

---

## Task 4: Input & Select primitives

**Files:**
- Modify: `src/components/ui/input.tsx:6-18`
- Modify: `src/components/ui/select.tsx` (SelectTrigger className)

- [ ] **Step 1: Mettre à jour Input**

Remplacer le contenu de `src/components/ui/input.tsx` par :

```tsx
import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-sm border border-input bg-card/40 px-2.5 py-1 text-xs font-mono transition-colors outline-none placeholder:text-muted-foreground/40 focus-visible:border-primary/55 focus-visible:ring-2 focus-visible:ring-primary/15 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
```

- [ ] **Step 2: Mettre à jour SelectTrigger dans select.tsx**

Lire `src/components/ui/select.tsx` puis localiser la fonction `SelectTrigger`. Remplacer son `className` (la string passée à `cn(...)`) par :

```tsx
"flex h-8 w-full items-center justify-between gap-2 rounded-sm border border-input bg-card/40 px-2.5 py-1 text-xs font-mono whitespace-nowrap transition-colors outline-none focus-visible:border-primary/55 focus-visible:ring-2 focus-visible:ring-primary/15 data-[placeholder]:text-muted-foreground/40 disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:shrink-0 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5"
```

(Conserver le reste du fichier inchangé.)

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/input.tsx src/components/ui/select.tsx
git commit -m "feat(design): voltage style for Input and SelectTrigger"
```

---

## Task 5: App.tsx — Sidebar redesign + Bug Fix #3 (debug buttons)

**Files:**
- Modify: `src/App.tsx:36-320`

- [ ] **Step 1: Mettre à jour `WolfRpgFontPanel` (lignes 36-122)**

Remplacer la fonction `WolfRpgFontPanel` par :

```tsx
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
```

- [ ] **Step 2: Mettre à jour `TranslationTimer` (lignes 134-166)**

Remplacer la fonction `TranslationTimer` par :

```tsx
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
```

- [ ] **Step 3: Réécrire `Sidebar` (lignes 168-320) — inclut bug fix #3**

Remplacer la fonction `Sidebar` par :

```tsx
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
```

- [ ] **Step 4: Retirer `Separator` import (plus utilisé)**

À la ligne 11 de `src/App.tsx`, supprimer la ligne :
```tsx
import { Separator } from '@/components/ui/separator'
```

- [ ] **Step 5: Vérifier**

Run: `pnpm tauri:linux`
Expected: La sidebar a maintenant un logo carré jaune avec 星 noir + pill jaune "TRANS", la nav active est un bloc jaune solide, les boutons Debug ne sont visibles qu'en mode dev (`pnpm tauri:linux` les affiche puisqu'on est en dev), un build prod (`pnpm tauri build`) ne les inclura pas.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(design): Voltage redesign for sidebar + hide debug buttons in prod (bug #3)"
```

---

## Task 6: TranslationView — Header

**Files:**
- Modify: `src/features/translation/TranslationView.tsx:222-271`

- [ ] **Step 1: Remplacer le bloc `Header` du composant TranslationView**

Localiser le commentaire `{/* Header */}` (ligne ~223) et remplacer le `<div>` Header complet (jusqu'à la fermeture `</div>` qui contient `<BatchControls ... />`) par :

```tsx
{/* Header */}
<div className="px-5 py-3 border-b-2 border-primary flex items-center justify-between gap-4 shrink-0 bg-background">
  <div className="flex flex-col gap-1 min-w-0">
    <h2 className="font-extrabold text-sm uppercase tracking-tight truncate text-foreground">
      {gameTitle ?? 'Translation'}
    </h2>
    <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider">
      <span className="tabular-nums text-foreground/80">{entries.length.toLocaleString()}</span>
      <span className="text-muted-foreground">entries</span>
      {(running ? (progress?.done ?? 0) : translatedCount) > 0 && (
        <><span className="text-primary">//</span><span className="tabular-nums text-emerald-400">{(running ? (progress?.done ?? 0) : translatedCount).toLocaleString()} done</span></>
      )}
      {(running ? ((progress?.total ?? 0) - (progress?.done ?? 0)) : pendingCount) > 0 && (
        <><span className="text-primary">//</span><span className="tabular-nums text-muted-foreground">{(running ? ((progress?.total ?? 0) - (progress?.done ?? 0)) : pendingCount).toLocaleString()} pending</span></>
      )}
      {search && (
        <><span className="text-primary">//</span><span className="tabular-nums text-primary">{filtered.length} found</span></>
      )}
      {fileFilter && (
        <>
          <span className="text-primary">//</span>
          <span className="text-primary font-mono truncate max-w-24">
            {fileFilter.split('/').pop()}
          </span>
          <button onClick={() => setFileFilter(undefined)} className="text-muted-foreground hover:text-foreground">
            <X className="w-2.5 h-2.5" />
          </button>
        </>
      )}
    </div>
  </div>

  <BatchControls
    availableModels={availableModels}
    model={model}
    onModelChange={setSelectedModel}
    refineModel={refineModel}
    onRefineModelChange={setSelectedRefineModel}
    running={running}
    progress={progress}
    onStart={handleStart}
    onCancel={cancel}
    selectedCount={selectedIds.size}
    refining={refining}
    refineProgress={refineProgress}
    onRefine={handleRefine}
    onCancelRefine={cancelRefine}
    limit={limit}
    onLimitChange={setLimit}
  />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/translation/TranslationView.tsx
git commit -m "feat(design): Voltage header for TranslationView"
```

---

## Task 7: TranslationView — Toolbar

**Files:**
- Modify: `src/features/translation/TranslationView.tsx:273-386`

- [ ] **Step 1: Remplacer le bloc `Toolbar`**

Localiser `{/* Toolbar */}` et remplacer le `<div className="flex items-center gap-3 px-5 py-1.5 border-b border-border/40 shrink-0">...</div>` complet par :

```tsx
{/* Toolbar */}
<div className="flex items-center gap-2 px-5 py-1.5 border-b border-border/60 shrink-0">
  <div className="flex items-center gap-1">
    {STATUS_FILTERS.map(f => (
      <button key={f.label} onClick={() => setStatusFilter(f.value)}
        className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors ${
          statusFilter === f.value
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
        }`}
      >{f.label}</button>
    ))}
  </div>

  {inconsistentTexts.length > 0 && (
    <button
      onClick={() => setShowInconsistent(v => !v)}
      title={`${inconsistentTexts.length} source text(s) with inconsistent translations`}
      className={`flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors ${
        showInconsistent
          ? 'bg-amber-500 text-background'
          : 'text-amber-400 hover:bg-amber-500/15 border border-amber-500/30'
      }`}
    >
      <AlertTriangle className="w-3 h-3" />
      {inconsistentTexts.length} inconsistent
    </button>
  )}

  {uniqueFiles.length > 1 && (
    <Select value={fileFilter ?? '__all__'} onValueChange={(v) => setFileFilter(!v || v === '__all__' ? undefined : v)}>
      <SelectTrigger className="h-7 w-48 text-[11px] font-mono">
        <SelectValue placeholder="ALL FILES" />
      </SelectTrigger>
      <SelectContent className="max-w-none w-auto min-w-(--radix-select-trigger-width) max-h-64">
        <SelectItem value="__all__" className="text-xs font-mono">All files</SelectItem>
        {uniqueFiles.map(f => {
          const short = f.split('/').pop() ?? f
          return (
            <SelectItem key={f} value={f} className="text-xs font-mono" title={f}>
              {short}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )}

  <div className="flex items-center border border-border rounded-sm overflow-hidden">
    <button
      onClick={() => setViewMode('list')}
      title="List view"
      className={`w-7 h-7 flex items-center justify-center transition-colors ${
        viewMode === 'list'
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
      }`}
    >
      <LayoutList className="w-3.5 h-3.5" />
    </button>
    <button
      onClick={() => setViewMode('files')}
      title="Files view"
      className={`w-7 h-7 flex items-center justify-center transition-colors border-l border-border ${
        viewMode === 'files'
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
      }`}
    >
      <BarChart2 className="w-3.5 h-3.5" />
    </button>
  </div>

  <div className="flex-1" />

  <Button
    variant="ghost"
    size="sm"
    onClick={handleRetranslateWarnings}
    disabled={running || refining || entries.filter(e => typeof e.status === 'string' && e.status.startsWith('warning')).length === 0}
    title="Retranslate all warning entries"
    className="hover:text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/30"
  >
    {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
    Retry warnings
  </Button>

  <Button
    variant="ghost"
    size="sm"
    onClick={() => exportTranslated.mutate()}
    disabled={exportTranslated.isPending || running}
    title="Inject translations and open output folder"
  >
    {exportTranslated.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderOpen className="w-3 h-3" />}
    Export
  </Button>

  {!model && (
    <span className="text-[10px] text-amber-400 font-mono font-bold uppercase tracking-wider">no model</span>
  )}

  <div className="relative w-44">
    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40 pointer-events-none" />
    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="SEARCH…" className="h-7 pl-6 text-[11px] uppercase placeholder:uppercase" />
    {search && (
      <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground">
        <X className="w-3 h-3" />
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 2: Mettre à jour les colonnes du tableau (header)**

Localiser dans le même fichier `<TableHead style={{ width: '50%' }} className="px-6 py-2">` (deux occurrences). Remplacer le bloc `<TableHeader>...</TableHeader>` par :

```tsx
<TableHeader style={{ display: 'grid', position: 'sticky', top: 0, zIndex: 10 }} className="bg-card/80 backdrop-blur-sm">
  <TableRow style={{ display: 'flex' }} className="border-b border-border hover:bg-transparent">
    <TableHead style={{ width: '50%' }} className="px-6 py-2.5">
      <div className="flex items-center gap-3">
        <button onClick={() => handleSort('order')} className="flex items-center text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-opacity">
          Original (JP)
          <SortIcon col="order" sortKey={sortKey} sortDir={sortDir} />
        </button>
        <button onClick={() => handleSort('file')} className={`flex items-center text-[10px] font-bold uppercase tracking-widest transition-opacity ${sortKey === 'file' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          by file
          <SortIcon col="file" sortKey={sortKey} sortDir={sortDir} />
        </button>
      </div>
    </TableHead>

    <TableHead style={{ width: '50%' }} className="px-6 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Translation</span>
        <button onClick={() => handleSort('status')} className={`flex items-center text-[10px] font-bold uppercase tracking-widest transition-opacity ${sortKey === 'status' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          by status
          <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
        </button>
      </div>
    </TableHead>
  </TableRow>
</TableHeader>
```

- [ ] **Step 3: Mettre à jour la progress bar (bottom)**

Localiser `{/* Progress bar — bottom amber shimmer */}` (ligne ~458). Remplacer ce bloc par :

```tsx
{/* Progress bar — bottom yellow */}
<div className="h-[3px] bg-card shrink-0 overflow-hidden">
  {running && (
    <div
      className="h-full bg-primary transition-all duration-500 ease-out shimmer"
      style={{ width: `${progressPct}%` }}
    />
  )}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/features/translation/TranslationView.tsx
git commit -m "feat(design): Voltage toolbar + table header for TranslationView"
```

---

## Task 8: BatchControls

**Files:**
- Modify: `src/features/translation/BatchControls.tsx:42-166`

- [ ] **Step 1: Remplacer le `return` complet du composant `BatchControls`**

Remplacer tout le contenu du `return (...)` par :

```tsx
return (
  <div className="flex items-center gap-2 shrink-0">

    {/* ── TRANSLATE SECTION ── */}
    <div className="flex items-center gap-1.5 border border-primary/30 rounded-sm px-2 py-1 bg-card/30">
      <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-primary mr-0.5 select-none">
        TL
      </span>

      <Select value={model} onValueChange={(v) => onModelChange(v ?? '')} disabled={running}>
        <SelectTrigger className="h-6 w-52 text-[11px] font-mono border-0 bg-transparent px-1 focus:ring-0 focus-visible:ring-0">
          <SelectValue placeholder="No model" />
        </SelectTrigger>
        <SelectContent className="max-w-none w-auto min-w-(--radix-select-trigger-width)">
          {availableModels.map(m => (
            <SelectItem key={m} value={m} className="text-xs font-mono">
              <span>hoshi-translator</span>
              {HOSHI_MODEL_INFO[m] && (
                <span className="ml-1.5 text-[9px] text-primary font-bold uppercase">{HOSHI_MODEL_INFO[m]}</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger
          className="inline-flex h-6 w-6 items-center justify-center p-0 rounded-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
          title="Batch settings"
          disabled={running}
        >
          <Settings2 className="w-3 h-3" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-3 space-y-3">
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Limit
            </p>
            <div className="flex items-center border border-border rounded-sm overflow-hidden">
              {LIMIT_OPTIONS.map(o => (
                <button key={o.value} onClick={() => onLimitChange(o.value)}
                  title={o.value === 0 ? 'All pending' : `Next ${o.value}`}
                  className={`flex-1 h-7 text-[10px] font-bold font-mono uppercase tracking-wider transition-colors border-r border-border last:border-r-0 ${
                    limit === o.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
                  }`}
                >{o.label}</button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {running ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-primary font-mono font-bold tabular-nums min-w-12 text-right">
            {progress?.done}<span className="text-muted-foreground">/</span>{progress?.total}
          </span>
          <Button variant="ghost" size="icon-xs" onClick={onCancel}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <Button
          size="xs"
          onClick={onStart}
          disabled={!model}
        >
          <Sparkles className="w-3 h-3" />
          {selectedCount > 0 ? `Translate ${selectedCount}` : 'Translate'}
        </Button>
      )}
    </div>

    {/* ── REFINE SECTION ── */}
    <div className="flex items-center gap-1.5 border border-amber-500/30 rounded-sm px-2 py-1 bg-card/30">
      <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-amber-400 mr-0.5 select-none">
        RF
      </span>

      <Select value={refineModel} onValueChange={(v) => onRefineModelChange(v ?? '')} disabled={refining}>
        <SelectTrigger className="h-6 w-52 text-[11px] font-mono border-0 bg-transparent px-1 focus:ring-0 focus-visible:ring-0">
          <SelectValue placeholder="No model" />
        </SelectTrigger>
        <SelectContent className="max-w-none w-auto min-w-(--radix-select-trigger-width)">
          {availableModels.map(m => (
            <SelectItem key={m} value={m} className="text-xs font-mono">
              <span>hoshi-translator</span>
              {HOSHI_MODEL_INFO[m] && (
                <span className="ml-1.5 text-[9px] text-amber-400 font-bold uppercase">{HOSHI_MODEL_INFO[m]}</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {refining ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-amber-400 font-mono font-bold tabular-nums min-w-12 text-right">
            {refineProgress?.done}<span className="text-muted-foreground">/</span>{refineProgress?.total}
          </span>
          <Button variant="ghost" size="icon-xs" onClick={onCancelRefine}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <Button
          size="xs"
          variant="outline"
          onClick={onRefine}
          disabled={running || !refineModel}
          className="border-amber-500/40 text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/60 hover:text-amber-300"
        >
          <Wand2 className="w-3 h-3" />
          {selectedCount > 0 ? `Refine ${selectedCount}` : 'Refine'}
        </Button>
      )}
    </div>
  </div>
)
```

- [ ] **Step 2: Commit**

```bash
git add src/features/translation/BatchControls.tsx
git commit -m "feat(design): Voltage style for BatchControls TL/RF blocks"
```

---

## Task 9: TranslationRow — Status badges + cells

**Files:**
- Modify: `src/features/translation/TranslationRow.tsx:17-33` (getStatusMeta)
- Modify: `src/features/translation/TranslationRow.tsx:88-239` (return JSX)

- [ ] **Step 1: Remplacer la fonction `getStatusMeta`**

```tsx
function getStatusMeta(status: TranslationStatus): { label: string; strip: string; bgCls: string; labelCls: string; rowCls: string } {
  if (status === 'translated')
    return { label: 'Translated', strip: 'status-strip-translated', bgCls: 'bg-emerald-500/15 border-emerald-500/40', labelCls: 'text-emerald-400', rowCls: '' }
  if (status === 'reviewed')
    return { label: 'Reviewed', strip: 'status-strip-reviewed', bgCls: 'bg-blue-500/15 border-blue-500/40', labelCls: 'text-blue-400', rowCls: 'status-row-reviewed' }
  if (status === 'skipped')
    return { label: 'Skipped', strip: 'status-strip-skipped', bgCls: 'bg-muted/40 border-border', labelCls: 'text-muted-foreground', rowCls: '' }
  if (typeof status === 'string' && status.startsWith('warning')) {
    const ratio = parseWarningRatio(status)
    return { label: ratio ? `Warn ${ratio}` : 'Warning', strip: 'status-strip-warning', bgCls: 'bg-amber-500/15 border-amber-500/40', labelCls: 'text-amber-400', rowCls: 'status-row-warning' }
  }
  if (typeof status === 'object' && 'error' in status)
    return { label: 'Error', strip: 'status-strip-error', bgCls: 'bg-red-500/15 border-red-500/40', labelCls: 'text-red-400', rowCls: 'status-row-error' }
  if (typeof status === 'object' && 'warning' in status)
    return { label: 'Warning', strip: 'status-strip-warning', bgCls: 'bg-amber-500/15 border-amber-500/40', labelCls: 'text-amber-400', rowCls: 'status-row-warning' }
  return { label: 'Pending', strip: 'status-strip-pending', bgCls: 'bg-card/60 border-border', labelCls: 'text-muted-foreground', rowCls: '' }
}
```

- [ ] **Step 2: Mettre à jour la ligne de déstructuration**

La signature de `getStatusMeta` change (`dotCls` → `bgCls`). Localiser ligne ~64 :

```tsx
const { label, strip, dotCls, labelCls, rowCls } = getStatusMeta(entry.status)
```

La remplacer par :

```tsx
const { label, strip, bgCls, labelCls, rowCls } = getStatusMeta(entry.status)
```

- [ ] **Step 3: Remplacer le `return` du composant `TranslationRow`**

Remplacer le bloc `return ( <TableRow ... > ... </TableRow> )` par :

```tsx
return (
  <TableRow
    ref={measureRef}
    data-index={dataIndex}
    style={style}
    className={`group absolute top-0 left-0 w-full flex border-b border-border/40 ${strip} ${rowCls} ${
      selected ? 'bg-primary/8 hover:bg-primary/12' : 'hover:bg-card/40'
    }`}
  >
    {/* Source — JP text */}
    <TableCell className="w-1/2 min-w-0 align-top py-3 px-4 overflow-hidden">
      <div className="flex items-start gap-2">
        <button
          onClick={e => { e.stopPropagation(); onToggleSelect?.() }}
          className={`mt-0.5 shrink-0 w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${
            selected
              ? 'bg-primary border-primary text-primary-foreground opacity-100'
              : selectionActive
                ? 'border-border opacity-100 hover:border-primary'
                : 'border-border opacity-0 group-hover:opacity-100 hover:border-primary'
          }`}
        >
          {selected && <Check className="w-2 h-2" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap wrap-break-word">
            {entry.source_text}
          </p>
          <span className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-wider mt-1 block">
            {filename} <span className="text-primary">·</span> #{entry.order_index}
            {translatedAtStr && (
              <span className="ml-2 text-muted-foreground/60 normal-case tracking-normal font-normal">{translatedAtStr}</span>
            )}
            {(entry.prompt_tokens != null || entry.output_tokens != null) && (
              <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400/70 normal-case tracking-normal font-normal">
                {entry.prompt_tokens != null && <>in:{entry.prompt_tokens} </>}
                {entry.output_tokens != null && <>out:{entry.output_tokens}</>}
              </span>
            )}
          </span>
        </div>
      </div>
    </TableCell>

    {/* Translation */}
    <TableCell className="w-1/2 min-w-0 align-top py-3 px-4 border-l border-border/40 overflow-hidden">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          {/* Status badge — Voltage square pill */}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[9px] font-bold font-mono uppercase tracking-widest ${bgCls} ${labelCls}`}>
            {label}
          </span>
          {!editing && (
            <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={e => { e.stopPropagation(); onTranslateSingle?.() }}
                disabled={translating || refining}
                title="Translate this entry"
                className="text-muted-foreground hover:text-primary"
              >
                {translating
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Sparkles className="w-3 h-3" />}
              </Button>
              {(entry.status === 'translated' || (typeof entry.status === 'object' && 'warning' in entry.status) || (typeof entry.status === 'string' && entry.status.startsWith('warning'))) && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={e => { e.stopPropagation(); onRefineSingle?.() }}
                  disabled={refining || translating}
                  title="Refine this entry"
                  className="text-muted-foreground hover:text-amber-400"
                >
                  {refining
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Wand2 className="w-3 h-3" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setEditing(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {entry.ph_count_source != null && entry.ph_count_draft != null
          && entry.ph_count_source !== entry.ph_count_draft && (
          <span className="text-[9px] text-amber-400 font-mono font-bold uppercase tracking-wider">
            ⚠ {entry.ph_count_draft}/{entry.ph_count_source} ph
          </span>
        )}

        {editing ? (
          <div className="flex flex-col gap-1.5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="text-xs font-mono resize-none bg-card/60"
              autoFocus
            />
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="xs" onClick={discard}>
                <X className="w-3 h-3" />Discard
              </Button>
              <Button size="xs" onClick={save}>
                <Check className="w-3 h-3" />Save
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="text-xs leading-relaxed whitespace-pre-wrap wrap-break-word text-foreground/75 font-mono cursor-text hover:text-foreground transition-colors"
            onClick={() => setEditing(true)}
            title="Click to edit"
          >
            {entry.refined_text && entry.refined_status !== 'unchanged' ? (
              <>
                <span className="text-amber-400 mr-1 text-[9px] font-bold">
                  {entry.refined_status === 'manual' ? '✎' : '✦'}
                </span>
                {entry.refined_text}
                {entry.refined_status === 'reviewed' && entry.translation && (
                  <div className="mt-1 text-[10px] text-muted-foreground/40 line-through leading-relaxed">
                    {entry.translation}
                  </div>
                )}
              </>
            ) : (
              <>
                {entry.translation ?? <span className="text-muted-foreground/50 italic font-sans uppercase text-[10px] font-bold tracking-wider">// not translated</span>}
                {entry.refined_status === 'unchanged' && (
                  <span className="ml-1.5 text-[9px] text-emerald-500/60">✓</span>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </TableCell>
  </TableRow>
)
```

- [ ] **Step 4: Vérifier**

Run: `pnpm tauri:linux`
Expected: Status badges = pills carrés avec fond teinté + bordure. Filename en uppercase mono bold. "// not translated" placeholder visible et stylé.

- [ ] **Step 5: Commit**

```bash
git add src/features/translation/TranslationRow.tsx
git commit -m "feat(design): Voltage status badges and rows for TranslationRow"
```

---

## Task 10: OllamaPage — Header + cards + Bug Fix #4 (Tips) + Bug Fix #5 (temp display)

**Files:**
- Modify: `src/features/ollama/OllamaPage.tsx:18-24` (SectionLabel)
- Modify: `src/features/ollama/OllamaPage.tsx:146-554` (entire return)

- [ ] **Step 1: Mettre à jour `SectionLabel`**

Remplacer la fonction `SectionLabel` par :

```tsx
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">
      {children}
    </p>
  )
}
```

- [ ] **Step 2: Mettre à jour le Header (lignes ~150-173)**

Localiser `{/* ── Header ────────────... */}`. Remplacer le bloc complet (jusqu'à la fermeture du `</div>` du status pill) par :

```tsx
{/* ── Header ────────────────────────────────────────────── */}
<div className="flex items-start justify-between shrink-0 pb-3 border-b-2 border-primary">
  <div>
    <h2 className="text-sm font-extrabold uppercase tracking-tight">Ollama</h2>
    <p className="text-[11px] font-mono text-muted-foreground mt-1 uppercase tracking-wider">Connection // Model // Settings</p>
  </div>

  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
    ollamaOnline
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
      : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
  }`}>
    {ollamaOnline
      ? <Wifi className="w-3 h-3" />
      : <WifiOff className="w-3 h-3" />
    }
    <span>{ollamaOnline ? 'Online' : 'Offline'}</span>
    {availableModels.length > 0 && (
      <span className="opacity-60">// {availableModels.length} hoshi</span>
    )}
    <span className="text-primary">//</span>
    <span className="opacity-70">Local</span>
  </div>
</div>
```

- [ ] **Step 3: Mettre à jour les wrappers de cards (cherche "rounded-lg border border-border/30 bg-card/20")**

Dans tout le fichier `OllamaPage.tsx`, remplacer (`replace_all` si possible) :

- `rounded-lg border border-border/30 bg-card/20` → `rounded-sm border border-border bg-card/40`
- `rounded-lg border border-border/20 bg-card/10` → `rounded-sm border border-border/60 bg-card/30`

- [ ] **Step 4: Active configuration — supprimer la card Temperature (Bug #5 part 1)**

Localiser le tableau dans `Active configuration` (ligne ~260). Trouver l'objet contenant `label: 'Temperature'`. Le retirer du tableau. Le tableau résultant ne doit contenir que 3 entrées : Model, Target language, Endpoint.

```tsx
{[
  {
    icon: <Cpu className="w-3.5 h-3.5" />,
    label: 'Model',
    value: settings.ollamaModel || 'None selected',
    sub: 'Local Ollama',
  },
  {
    icon: <Globe className="w-3.5 h-3.5" />,
    label: 'Target language',
    value: langLabel,
    sub: `JP → ${langLabel}`,
  },
  {
    icon: ollamaOnline
      ? <Wifi className="w-3.5 h-3.5 text-emerald-500" />
      : <WifiOff className="w-3.5 h-3.5 text-amber-500" />,
    label: 'Endpoint',
    value: settings.ollamaHost.replace('http://', '').replace('https://', ''),
    sub: ollamaOnline ? 'Reachable' : 'Not reachable',
  },
].map(({ icon, label, value, sub }) => (
  <div key={label} className="flex items-start gap-2.5 p-3 rounded-sm border border-border bg-background">
    <div className="mt-0.5 text-primary shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">{label}</p>
      <p className="text-[11px] font-mono font-bold text-foreground mt-0.5 truncate">{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground/70 mt-0.5 font-mono uppercase tracking-wider">{sub}</p>}
    </div>
  </div>
))}
```

Aussi : retirer l'import de `Thermometer` au top de `OllamaPage.tsx` puisqu'il n'est plus utilisé.

- [ ] **Step 5: Aussi retirer la variable `tempLabel`**

Au début du composant `OllamaPage`, retirer le bloc :

```tsx
const tempLabel = settings.temperature <= 0.2
  ? 'Very consistent'
  : settings.temperature <= 0.4
  ? 'Consistent'
  : settings.temperature <= 0.6
  ? 'Balanced'
  : settings.temperature <= 0.8
  ? 'Creative'
  : 'Very creative'
```

(Plus utilisé.)

- [ ] **Step 6: Tips — Bug Fix #4 (remplacer les conseils obsolètes)**

Localiser le bloc Tips à la fin de la colonne RIGHT (`{/* Tips */}` ~ligne 532). Remplacer le `<ul>` complet par :

```tsx
<ul className="flex flex-col gap-2">
  {[
    'For batch jobs, the 4B model is fast (~50 lines/min on a 4 GB GPU). The 30B variant is slower but better at long context.',
    'After translation, run a Refine pass with the same or a stronger model to catch awkward phrasing.',
    'Click any cell to edit a translation manually — your edits are saved as glossary candidates.',
    'Game files stay on disk. No data is sent outside your machine, ever.',
  ].map((tip, i) => (
    <li key={i} className="flex items-start gap-2">
      <span className="text-primary mt-0.5 shrink-0 font-bold">▸</span>
      <span className="text-[11px] text-muted-foreground leading-relaxed">{tip}</span>
    </li>
  ))}
</ul>
```

- [ ] **Step 7: Vérifier**

Run: `pnpm tauri:linux`
Expected: La page Ollama affiche un header avec border-bottom jaune, l'Active configuration n'a plus que 3 cards (sans température), les Tips sont à jour.

- [ ] **Step 8: Commit**

```bash
git add src/features/ollama/OllamaPage.tsx
git commit -m "feat(design): Voltage redesign for OllamaPage + remove temp card (bug #5) + update tips (bug #4)"
```

---

## Task 11: SettingsPage redesign + Bug Fix #5 part 2 (slider température)

**Files:**
- Modify: `src/features/settings/SettingsPage.tsx`

- [ ] **Step 1: Remplacer le contenu complet de `SettingsPage.tsx`**

```tsx
import { useAppStore } from '@/stores/appStore'
import { Moon, Sun, Thermometer } from 'lucide-react'

const ACCENT_PRESETS = [
  { name: 'Voltage',  value: 'oklch(0.86 0.17 95)',  dot: '#facc15' },
  { name: 'Amber',    value: 'oklch(0.76 0.16 65)',  dot: '#f59e0b' },
  { name: 'Blue',     value: 'oklch(0.65 0.18 240)', dot: '#3b82f6' },
  { name: 'Green',    value: 'oklch(0.68 0.18 145)', dot: '#22c55e' },
  { name: 'Rose',     value: 'oklch(0.68 0.22 10)',  dot: '#f43f5e' },
  { name: 'Purple',   value: 'oklch(0.68 0.18 285)', dot: '#a855f7' },
  { name: 'Cyan',     value: 'oklch(0.72 0.16 200)', dot: '#06b6d4' },
]

const TEMP_PRESETS = [
  { value: 0.1, label: 'Very strict' },
  { value: 0.3, label: 'Consistent' },
  { value: 0.5, label: 'Balanced' },
  { value: 0.7, label: 'Creative' },
  { value: 0.9, label: 'Very creative' },
]

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border bg-card/40 overflow-hidden">
      <div className="px-3.5 py-2 border-b-2 border-primary">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{title}</span>
      </div>
      <div className="px-3.5 py-3.5 flex flex-col gap-4">{children}</div>
    </div>
  )
}

function PanelRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-28 shrink-0 pt-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        {hint && <p className="text-[9.5px] text-muted-foreground/55 mt-0.5 leading-tight">{hint}</p>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const { settings, updateSettings } = useAppStore()

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl p-6 flex flex-col gap-4">

        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-tight">Settings</h2>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-1">Application // Preferences</p>
        </div>

        <Panel title="Appearance">

          <PanelRow label="Theme" hint="Light or dark interface">
            <div className="flex gap-2">
              <button
                onClick={() => updateSettings({ theme: 'dark' })}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-sm border text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  settings.theme === 'dark'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-card/70 hover:text-foreground'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
              <button
                onClick={() => updateSettings({ theme: 'light' })}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-sm border text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  settings.theme === 'light'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-card/70 hover:text-foreground'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Light
              </button>
            </div>
          </PanelRow>

          <PanelRow label="Accent" hint="Primary UI color">
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => updateSettings({ accentColor: preset.value })}
                  title={preset.name}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    settings.accentColor === preset.value
                      ? 'border-primary bg-card text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-card/70 hover:text-foreground'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: preset.dot, boxShadow: settings.accentColor === preset.value ? `0 0 8px 1px ${preset.dot}80` : 'none' }}
                  />
                  {preset.name}
                </button>
              ))}
            </div>
          </PanelRow>

        </Panel>

        <Panel title="Translation">

          <PanelRow label="Temperature" hint="Lower = strict & consistent, higher = creative">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Thermometer className="w-4 h-4 text-primary shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={settings.temperature}
                  onChange={e => updateSettings({ temperature: parseFloat(e.target.value) })}
                  className="flex-1 accent-primary"
                />
                <span className="font-mono font-bold text-sm text-primary tabular-nums w-10 text-right">{settings.temperature.toFixed(1)}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {TEMP_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => updateSettings({ temperature: p.value })}
                    className={`px-2 py-1 rounded-sm text-[9.5px] font-bold uppercase tracking-wider transition-colors ${
                      Math.abs(settings.temperature - p.value) < 0.05
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-card hover:text-foreground border border-border'
                    }`}
                  >{p.label}</button>
                ))}
              </div>
            </div>
          </PanelRow>

        </Panel>

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier**

Run: `pnpm tauri:linux`
Expected: Settings affiche maintenant un panel "Translation" avec un slider de température fonctionnel + 5 presets cliquables (Very strict / Consistent / Balanced / Creative / Very creative). La valeur affichée correspond à `settings.temperature`. Changer la valeur met à jour le store Zustand.

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/SettingsPage.tsx
git commit -m "feat(design): Voltage redesign for SettingsPage + temperature slider (bug #5)"
```

---

## Task 12: GlossaryPage redesign

**Files:**
- Modify: `src/features/glossary/GlossaryPage.tsx`

- [ ] **Step 1: Remplacer le contenu complet de `GlossaryPage.tsx`**

Garder les imports + state + queries + mutations + `filteredTerms` useMemo + `handleAdd` + `projectName` à l'identique (lignes 1-134). Seul le `return (...)` à partir de la ligne 135 est remplacé. Le code complet du `return` à utiliser :

```tsx
return (
  <div className="flex flex-col h-full">
    {/* Header */}
    <div className="px-6 py-4 border-b-2 border-primary shrink-0 flex items-center justify-between gap-4">
      <div>
        <h2 className="font-extrabold text-sm uppercase tracking-tight">Glossary</h2>
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-1">
          Global // applies everywhere · Project // overrides global for that project
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {selectedIds.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteSelected.mutate(Array.from(selectedIds))}
            disabled={deleteSelected.isPending}
            className="text-destructive hover:text-destructive hover:bg-destructive/15"
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
        >
          <Upload className="w-3.5 h-3.5" />
          Import
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => exportGlossary.mutate()}
          disabled={exportGlossary.isPending || terms.length === 0}
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </Button>
      </div>
    </div>

    {/* Add form */}
    <div className="px-6 py-3 border-b border-border shrink-0">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">JP Term</label>
          <Input
            value={source}
            onChange={e => setSource(e.target.value)}
            placeholder="六花"
            className="h-7 w-32 text-xs font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Translation</label>
          <Input
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder="Rikka"
            className="h-7 w-32 text-xs font-mono"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lang</label>
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
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Scope</label>
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
          className="mb-0"
        >
          <Plus className="w-3 h-3" />
          Add
        </Button>
      </div>
    </div>

    {/* Filter bar */}
    <div className="px-6 py-2 border-b border-border shrink-0 flex items-center gap-3 flex-wrap">
      <div className="relative w-44">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40 pointer-events-none" />
        <Input
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          placeholder="SEARCH TERMS…"
          className="h-7 pl-6 text-[11px] uppercase placeholder:uppercase"
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
            className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors ${
              filterScope === s
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
            }`}
          >{s}</button>
        ))}
        <Select
          value={typeof filterScope === 'string' && filterScope !== 'all' && filterScope !== 'global' ? filterScope : '__none__'}
          onValueChange={v => { if (v && v !== '__none__') setFilterScope(v) }}
        >
          <SelectTrigger className={`h-7 w-32 text-xs font-mono ${typeof filterScope === 'string' && filterScope !== 'all' && filterScope !== 'global' ? 'bg-primary/10 border-primary/40' : ''}`}>
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
            className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors ${
              filterLang === l
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
            }`}
          >{l === 'all' ? 'All' : l}</button>
        ))}
      </div>

      {(filterSearch || filterScope !== 'all' || filterLang !== 'all') && (
        <span className="text-[10px] font-mono font-bold text-primary ml-auto tabular-nums uppercase tracking-wider">
          {filteredTerms.length} / {terms.length}
        </span>
      )}
    </div>

    {/* Table */}
    <div className="flex-1 overflow-y-auto">
      {terms.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          No glossary terms yet.
        </div>
      ) : filteredTerms.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          No terms match the current filters.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card/80 backdrop-blur-sm border-b-2 border-primary">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={filteredTerms.length > 0 && filteredTerms.every(t => selectedIds.has(t.id))}
                  onChange={e => setSelectedIds(e.target.checked ? new Set(filteredTerms.map(t => t.id)) : new Set())}
                  className="w-3.5 h-3.5 accent-primary cursor-pointer"
                />
              </th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-primary uppercase tracking-widest w-[28%]">JP Term</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-primary uppercase tracking-widest w-[28%]">Translation</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-primary uppercase tracking-widest w-[12%]">Lang</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-primary uppercase tracking-widest w-[22%]">Scope</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {filteredTerms.map(term => {
              const isEditing = editState?.id === term.id
              return (
                <tr key={term.id} className={`group border-b border-border/60 hover:bg-card/40 transition-colors ${selectedIds.has(term.id) ? 'bg-primary/8' : ''}`}>
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
                  <td className="px-4 py-1.5 font-mono text-foreground/85">
                    {isEditing ? (
                      <Input
                        value={editState.source_term}
                        onChange={e => setEditState(s => s && { ...s, source_term: e.target.value })}
                        className="h-6 text-xs font-mono w-full"
                        autoFocus
                      />
                    ) : term.source_term}
                  </td>
                  <td className="px-4 py-1.5 font-mono text-foreground/85">
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
                      <span className="px-2 py-0.5 rounded-sm text-[9px] font-mono font-bold uppercase tracking-widest bg-primary/15 text-primary border border-primary/30">
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
                      <span className="flex items-center gap-1 text-primary text-[11px] font-bold uppercase tracking-wider">
                        <Globe className="w-3 h-3" />Global
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground text-[11px] truncate">
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
                          className="text-primary hover:opacity-80 transition-opacity"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditState(null)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
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
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteTerm.mutate(term.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
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
```

- [ ] **Step 2: Vérifier**

Run: `pnpm tauri:linux`
Expected: GlossaryPage a un header `border-b-2` jaune, filter buttons en pilules carrées avec actif jaune solide, badge `LANG` en pill jaune avec border, header de table en `border-b-2` jaune avec text primary uppercase widest.

- [ ] **Step 3: Commit**

```bash
git add src/features/glossary/GlossaryPage.tsx
git commit -m "feat(design): Voltage redesign for GlossaryPage"
```

---

## Task 13: AboutPage redesign + Bug Fix #1 (version) + Bug Fix #2 (Bakin)

**Files:**
- Modify: `src/features/about/AboutPage.tsx`

- [ ] **Step 1: Remplacer le contenu complet de `AboutPage.tsx`**

```tsx
import { useState } from 'react'
import { ExternalLink, Github, ChevronDown, ChevronRight, Cpu, Copy, Check, Coins } from 'lucide-react'
import pkg from '../../../package.json'

const APP_VERSION = pkg.version

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
      {children}
    </p>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border bg-card/40 p-4 flex flex-col gap-1">
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-mono text-foreground text-right truncate">{value}</span>
    </div>
  )
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5">{children}</p>
  )
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative group">
      <pre className="text-[10.5px] font-mono bg-background border border-border rounded-sm px-3 py-2.5 text-foreground/85 leading-relaxed whitespace-pre-wrap overflow-x-auto">
        {children}
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-0.5 rounded-sm bg-primary text-primary-foreground border border-primary text-[9.5px] font-bold uppercase tracking-wider"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function CryptoRow({ symbol, name, address }: { symbol: string; name: string; address: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-sm border border-border bg-background">
      <Coins className="w-4 h-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground uppercase tracking-wider">{symbol} <span className="text-[10px] text-muted-foreground font-normal normal-case tracking-normal">— {name}</span></p>
        <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">{address}</p>
      </div>
      <button
        onClick={copy}
        className="flex items-center gap-1 px-2 py-1 rounded-sm border border-border text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function SetupGuides() {
  const [localOpen, setLocalOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">

      <div className="rounded-sm border border-border bg-card/40 overflow-hidden">
        <button
          onClick={() => setLocalOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-card/70 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Cpu className="w-3.5 h-3.5 text-primary" />
            <span className="text-[12px] font-bold text-foreground uppercase tracking-wider">Local Setup</span>
            <span className="text-[10px] text-muted-foreground font-mono">// Linux / Windows</span>
          </div>
          {localOpen ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>

        {localOpen && (
          <div className="px-4 pb-5 border-t border-border bg-background flex flex-col gap-4 pt-4">

            <div className="flex flex-col gap-1.5">
              <StepLabel>1. Install Ollama</StepLabel>
              <CodeBlock>curl -fsSL https://ollama.com/install.sh | sh</CodeBlock>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed mt-0.5">
                Or download the Windows installer at <span className="font-mono text-primary">ollama.com</span>.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <StepLabel>2. Install a hoshi-translator model</StepLabel>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Go to the <span className="font-mono font-bold text-foreground">Ollama</span> page → <span className="font-mono font-bold text-primary">Install Models</span> → click the model you want. hoshi-trans runs <span className="font-mono text-foreground">ollama create</span> for you — it pulls the base model automatically if needed.
              </p>
              <div className="flex flex-col gap-1 mt-1">
                {([
                  { name: 'hoshi-translator-4b', vram: '~4 GB VRAM', note: 'recommended' },
                  { name: 'hoshi-translator-abliterated-4b', vram: '~8 GB VRAM', note: 'higher quality' },
                  { name: 'hoshi-translator-30b', vram: 'min 24 GB VRAM', note: 'best quality' },
                ]).map(({ name, vram, note }) => (
                  <div key={name} className="flex items-center gap-2 px-2 py-1 rounded-sm bg-background border border-border">
                    <span className="text-[10px] font-mono font-bold text-foreground flex-1">{name}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">{vram}</span>
                    <span className="text-[9px] font-bold text-primary uppercase tracking-wider">{note}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <StepLabel>3. Select the model</StepLabel>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                In the <span className="font-mono font-bold text-foreground">Ollama</span> page → <span className="font-mono font-bold text-primary">Connection &amp; Model</span>, select the installed model as your translation model.
              </p>
            </div>

          </div>
        )}
      </div>

    </div>
  )
}

export function AboutPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl p-6 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b-2 border-primary">
          <div className="flex items-center justify-center w-10 h-10 rounded-sm bg-primary shrink-0">
            <span className="text-primary-foreground text-lg font-bold leading-none select-none">星</span>
          </div>
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-tight">hoshi-trans</h2>
            <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-primary">v{APP_VERSION} // Japanese game translator</p>
          </div>
        </div>

        {/* About */}
        <div>
          <SectionLabel>About</SectionLabel>
          <Card>
            <p className="text-xs text-muted-foreground leading-relaxed">
              hoshi-trans is a free, offline-first desktop app for translating Japanese RPG games
              (RPG Maker MV/MZ, Wolf RPG) using local AI models via Ollama.
              No data leaves your machine.
            </p>
          </Card>
        </div>

        {/* Setup Guides */}
        <div>
          <SectionLabel>Setup Guides</SectionLabel>
          <SetupGuides />
        </div>

        {/* Support */}
        <div>
          <SectionLabel>Support the project</SectionLabel>
          <Card>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              hoshi-trans is free and open source — no subscription, no limits.
              If it saved you hours on a translation project, a crypto donation
              helps keep development going and new engines supported.
            </p>
            <div className="flex flex-col gap-2">
              {([
                { symbol: 'BTC', name: 'Bitcoin', address: 'bc1qmr578evx5fzwyr754a00j9hkekd2gzpvs8zxzz' },
                { symbol: 'ETH', name: 'Ethereum', address: '0x29652Fd86095913d472fF08BFEE5a15c5E7C9D51' },
              ]).map(({ symbol, name, address }) => (
                <CryptoRow key={symbol} symbol={symbol} name={name} address={address} />
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Free to support:</span>
              <a
                href="https://github.com/KATBlackCoder/hoshi-trans"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
              >
                <Github className="w-3 h-3" />
                Star on GitHub
              </a>
            </div>
          </Card>
        </div>

        {/* Links */}
        <div>
          <SectionLabel>Links</SectionLabel>
          <Card>
            <InfoRow label="GitHub" value={
              <a
                href="https://github.com/KATBlackCoder/hoshi-trans"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:opacity-80 transition-opacity flex items-center gap-1"
              >
                <Github className="w-3 h-3" />
                KATBlackCoder/hoshi-trans <ExternalLink className="w-3 h-3" />
              </a>
            } />
            <InfoRow label="Issues" value={
              <a
                href="https://github.com/KATBlackCoder/hoshi-trans/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:opacity-80 transition-opacity flex items-center gap-1"
              >
                Report a bug <ExternalLink className="w-3 h-3" />
              </a>
            } />
          </Card>
        </div>

      </div>
    </div>
  )
}
```

Notes :
- `APP_VERSION = pkg.version` lit la version depuis `package.json` (corrige le **bug #1** durablement — futurs bumps de version seront automatiques). `tsconfig.json` a déjà `resolveJsonModule: true`, donc l'import JSON fonctionne.
- La description "RPG Maker MV/MZ, Wolf RPG" (sans Bakin) corrige le **bug #2**.

- [ ] **Step 2: Vérifier**

Run: `pnpm tauri:linux`
Expected: La page About affiche `v0.1.1` à côté du titre, la description ne mentionne plus Bakin, le tout en style Voltage (jaune, bold, uppercase, sharp corners).

- [ ] **Step 3: Commit**

```bash
git add src/features/about/AboutPage.tsx
git commit -m "feat(design): Voltage redesign for AboutPage + fix version (bug #1) + remove Bakin (bug #2)"
```

---

## Task 14: OnboardingPage redesign

**Files:**
- Modify: `src/features/onboarding/OnboardingPage.tsx`

- [ ] **Step 1: Remplacer le contenu complet de `OnboardingPage.tsx`**

```tsx
import { useState } from 'react'
import { Terminal, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore, DEFAULT_OLLAMA_HOST } from '@/stores/appStore'

export function OnboardingPage() {
  const { settings, updateSettings } = useAppStore()
  const [hostDraft, setHostDraft] = useState(settings.ollamaHost)
  const [saved, setSaved] = useState(false)

  function saveHost() {
    const trimmed = hostDraft.trim() || DEFAULT_OLLAMA_HOST
    setHostDraft(trimmed)
    updateSettings({ ollamaHost: trimmed })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex items-center justify-center h-screen bg-background relative overflow-hidden">
      {/* Decorative 星 kanji watermark */}
      <span
        className="absolute select-none pointer-events-none font-bold leading-none"
        style={{
          fontSize: '38vw',
          color: 'oklch(0.86 0.17 95 / 3%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-44%, -50%)',
        }}
        aria-hidden
      >
        星
      </span>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-xs w-full px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-14 h-14 rounded-sm border border-primary/40 animate-ping" style={{ animationDuration: '2.4s' }} />
            <span className="absolute w-10 h-10 rounded-sm border border-primary/60 animate-ping" style={{ animationDuration: '2.4s', animationDelay: '0.4s' }} />
            <div className="relative w-12 h-12 rounded-sm bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xl font-bold leading-none select-none">星</span>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-base font-extrabold uppercase tracking-tight">
              <span className="text-foreground">hoshi</span>
              <span className="text-primary">-trans</span>
            </h1>
            <div className="flex items-center justify-center gap-1.5 mt-1.5">
              <span className="w-1.5 h-1.5 rounded-sm bg-amber-400 animate-pulse" />
              <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Waiting for Ollama…</p>
            </div>
          </div>
        </div>

        <div className="w-full flex flex-col gap-2">
          <Step number={1}
            icon={<Wifi className="w-3.5 h-3.5" />}
            title="Install Ollama"
            description={<>Download from <span className="font-mono text-primary text-[11px]">ollama.com</span></>}
          />
          <Step number={2}
            icon={<Terminal className="w-3.5 h-3.5" />}
            title="Pull a model"
            description={
              <code className="font-mono bg-background border border-border px-1.5 py-0.5 rounded-sm text-[11px] text-foreground">
                ollama pull qwen2.5:7b
              </code>
            }
          />
          <Step number={3}
            icon={<span className="text-[11px] font-bold text-primary">→</span>}
            title="Keep it running"
            description="This screen disappears automatically"
          />
        </div>

        <div className="w-full flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={hostDraft}
              onChange={(e) => setHostDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveHost()}
              placeholder="http://localhost:11434"
            />
            <Button size="sm" onClick={saveHost}>
              {saved ? '✓' : 'Connect'}
            </Button>
          </div>
          <button
            className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/55 hover:text-primary transition-colors text-left"
            onClick={() => { setHostDraft(DEFAULT_OLLAMA_HOST); updateSettings({ ollamaHost: DEFAULT_OLLAMA_HOST }) }}
          >
            Reset to localhost:11434
          </button>
        </div>
      </div>
    </div>
  )
}

function Step({ number, icon, title, description }: {
  number: number
  icon: React.ReactNode
  title: string
  description: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-sm border border-border bg-card/40">
      <div className="w-5 h-5 rounded-sm bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 text-primary mt-0.5">
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9.5px] font-mono font-bold text-primary uppercase tracking-widest">Step {number}</span>
        </div>
        <p className="text-xs font-bold uppercase tracking-wider">{title}</p>
        <div className="text-[11px] text-muted-foreground">{description}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/onboarding/OnboardingPage.tsx
git commit -m "feat(design): Voltage redesign for OnboardingPage"
```

---

## Task 15: ProjectLibrary + FileImportButton + FileStatsPanel

**Files:**
- Modify: `src/features/project-library/ProjectLibrary.tsx`
- Modify: `src/features/file-import/FileImportButton.tsx`
- Modify: `src/features/translation/FileStatsPanel.tsx`

- [ ] **Step 1: Mettre à jour `FileImportButton.tsx` (contenu complet)**

```tsx
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
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <FolderOpen className="w-4 h-4" />}
      {isPending ? 'Extracting…' : 'Open a game'}
    </Button>
  )
}
```

- [ ] **Step 2: Mettre à jour `FileStatsPanel.tsx`**

Remplacer le `return` du composant `FileStatsPanel` par :

```tsx
return (
  <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
    {files.map(f => {
      const short = f.file_path.split('/').pop() ?? f.file_path
      const donePct = f.total > 0 ? Math.round((f.translated / f.total) * 100) : 0
      const warningPct = f.total > 0 ? Math.round((f.warning / f.total) * 100) : 0

      return (
        <button
          key={f.file_path}
          onClick={() => onFileClick(f.file_path)}
          className="w-full text-left px-3 py-2.5 rounded-sm border border-border bg-card/40 hover:border-primary/40 hover:bg-card/70 transition-colors group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-foreground/85 group-hover:text-foreground truncate max-w-[60%]" title={f.file_path}>
              {short}
            </span>
            <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono font-bold">
              {f.warning > 0 && (
                <span className="text-amber-400">{f.warning}⚠</span>
              )}
              {f.pending > 0 && (
                <span className="text-muted-foreground">{f.pending} pending</span>
              )}
              <span className="text-muted-foreground/60">{f.translated}/{f.total}</span>
              <span className={`tabular-nums ${donePct === 100 ? 'text-emerald-400' : 'text-primary'}`}>
                {donePct}%
              </span>
            </div>
          </div>
          <div className="h-1 w-full bg-background border border-border rounded-sm overflow-hidden flex">
            <div
              className="h-full bg-emerald-500/70 transition-all"
              style={{ width: `${donePct}%` }}
            />
            {f.warning > 0 && (
              <div
                className="h-full bg-amber-400/60 transition-all"
                style={{ width: `${warningPct}%` }}
              />
            )}
          </div>
        </button>
      )
    })}
  </div>
)
```

- [ ] **Step 3: Mettre à jour `ProjectLibrary.tsx`**

Mettre à jour `ENGINE_COLOR` (ligne ~39) :

```tsx
const ENGINE_COLOR: Record<string, string> = {
  rpgmaker_mv_mz: 'text-violet-400',
  wolf_rpg: 'text-sky-400',
  bakin: 'text-amber-400',
}
```

Remplacer `ProgressBar` par :

```tsx
function ProgressBar({ translated, total }: { translated: number; total: number }) {
  const pct = total > 0 ? Math.round((translated / total) * 100) : 0
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold font-mono text-muted-foreground uppercase tracking-widest">Progress</span>
        <span className="text-[10px] font-mono font-bold text-primary tabular-nums">{pct}%</span>
      </div>
      <div className="h-1 bg-background border border-border rounded-sm overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct === 100
              ? 'oklch(0.72 0.19 145)'
              : 'oklch(0.86 0.17 95)',
          }}
        />
      </div>
    </div>
  )
}
```

Localiser le `<div>` Header (ligne ~93) et le remplacer par :

```tsx
<div className="px-8 pt-7 pb-5 shrink-0 flex items-center justify-between gap-4 border-b-2 border-primary">
  <div className="flex items-center gap-3">
    <h1 className="text-sm font-extrabold uppercase tracking-tight">Projects</h1>
    {projects.length > 0 && (
      <span className="text-[10px] font-mono font-bold text-primary-foreground bg-primary px-1.5 py-0.5 rounded-sm tabular-nums uppercase tracking-wider">
        {projects.length}
      </span>
    )}
  </div>
  <FileImportButton onProjectOpened={onOpen} />
</div>
```

Localiser la grid card (`className="group relative rounded-xl..."`) et remplacer cette card par :

```tsx
<div
  key={p.id}
  onClick={() => handleOpen(p)}
  className="group relative rounded-sm border border-border bg-card/40 p-4 cursor-pointer hover:border-primary/55 hover:bg-card/70 transition-all duration-150 overflow-hidden"
>
  {/* Top yellow accent on hover */}
  <div className="absolute inset-x-0 top-0 h-0.5 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

  <AlertDialog>
    <AlertDialogTrigger
      onClick={e => e.stopPropagation()}
      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/15"
      title="Delete project"
    >
      <Trash2 className="w-3 h-3" />
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete project?</AlertDialogTitle>
        <AlertDialogDescription>
          This will permanently remove <strong>{p.game_title}</strong> and all its
          translations. This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={e => {
            e.stopPropagation()
            deleteProject.mutate({ id: p.id, gameDir: p.game_dir })
          }}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${ENGINE_COLOR[p.engine] ?? 'text-muted-foreground'}`}>
    {ENGINE_LABEL[p.engine] ?? p.engine}
  </span>

  <p className="text-sm font-bold uppercase tracking-tight mt-1.5 pr-6 leading-snug line-clamp-2 text-foreground">
    {p.game_title}
  </p>

  <div className="flex items-center gap-2 mt-2.5">
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500 shrink-0" />
      <span className="text-[10px] font-mono font-bold text-emerald-400 tabular-nums">{p.translated}</span>
    </div>
    <span className="text-primary text-[10px] font-bold">/</span>
    <span className="text-[10px] font-mono font-bold text-muted-foreground tabular-nums">{p.total} total</span>
  </div>

  <ProgressBar translated={p.translated} total={p.total} />

  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border">
    <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
      {p.target_lang === 'fr' ? '🇫🇷 French' : '🇬🇧 English'}
    </span>
    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-0.5">
      Open <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
    </span>
  </div>
</div>
```

- [ ] **Step 4: Vérifier**

Run: `pnpm tauri:linux`
Expected: ProjectLibrary affiche un header avec border-bottom jaune + counter en pill jaune. Cards sharp corners avec accent jaune au hover. FileStatsPanel a des cards bordées avec progression mixte vert/ambre.

- [ ] **Step 5: Commit**

```bash
git add src/features/project-library/ProjectLibrary.tsx src/features/file-import/FileImportButton.tsx src/features/translation/FileStatsPanel.tsx
git commit -m "feat(design): Voltage redesign for ProjectLibrary, FileImport, FileStats"
```

---

## Task 16: Final visual review

**Files:** None (verification only)

- [ ] **Step 1: Vérifier que `src-tauri/tauri.conf.json` n'a rien à modifier**

Run: `cat src-tauri/tauri.conf.json | grep -E "(productName|title|version)"`
Expected: `productName: "hoshitrans"`, `title: "hoshitrans"`, `version: "0.1.1"`. Le redesign ne change pas le titre de la fenêtre native ni le bundle name. Si l'app crashe au démarrage avec une erreur de fenêtre, vérifier que `tauri.conf.json` n'a pas été touché par accident.

- [ ] **Step 2: Build complete pour vérifier qu'aucun warning TypeScript ne casse le build**

Run: `pnpm build`
Expected: `tsc && vite build` passe sans erreur. Aucun import inutilisé, aucun type any introduit.

- [ ] **Step 3: Tester chaque page manuellement**

Run: `pnpm tauri:linux`

Vérifier visuellement chacune de ces pages :
- [ ] Sidebar (logo, nav, project card, timer, debug buttons en mode dev uniquement)
- [ ] ProjectLibrary (header, grille, cards, état vide)
- [ ] OnboardingPage (couper Ollama → vérifier l'écran de waiting)
- [ ] TranslationView (header, toolbar, table, progress bar)
- [ ] TranslationRow (status badges, hover actions, edit mode)
- [ ] BatchControls (TL/RF blocs, progress, popover)
- [ ] FileStatsPanel (mode "files" du toolbar)
- [ ] OllamaPage (header, install models, tips à jour, pas de température)
- [ ] SettingsPage (theme + accent + slider température fonctionnel)
- [ ] GlossaryPage (header, form, filters, table)
- [ ] AboutPage (version v0.1.1 visible, pas de "Bakin")

- [ ] **Step 4: Vérifier les bug fixes**

- [ ] **Bug #1** : AboutPage affiche `v0.1.1` (lu depuis `package.json`)
- [ ] **Bug #2** : AboutPage description ne mentionne plus "Bakin"
- [ ] **Bug #3** : `pnpm build` puis inspecter le bundle — les boutons Debug ne doivent pas apparaître. Sinon, ouvrir le DOM en dev (devrait les afficher).
- [ ] **Bug #4** : OllamaPage Tips ne mentionnent plus `{lang}`, "concurrency", "7B–14B"
- [ ] **Bug #5** : SettingsPage a un slider de température fonctionnel ; OllamaPage Active config n'affiche plus la température

- [ ] **Step 5: Final commit (si reste des fixes mineurs)**

```bash
git status
# Si rien à commiter : pas de commit final.
# Si fixes mineurs (imports inutilisés, etc.) :
git add .
git commit -m "chore: post-redesign cleanup and final polish"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Voltage colors / theme tokens | Task 1 |
| Status strips updated | Task 2 |
| Button variants | Task 3 |
| Input + Select | Task 4 |
| Sidebar redesign | Task 5 |
| Bug #3 (debug buttons) | Task 5 |
| TranslationView header | Task 6 |
| TranslationView toolbar | Task 7 |
| BatchControls | Task 8 |
| TranslationRow | Task 9 |
| OllamaPage redesign | Task 10 |
| Bug #4 (Tips) | Task 10 |
| Bug #5 (temp display removed) | Task 10 |
| Bug #5 (temp slider in Settings) | Task 11 |
| SettingsPage redesign | Task 11 |
| GlossaryPage | Task 12 |
| AboutPage redesign | Task 13 |
| Bug #1 (version v0.1.1) | Task 13 |
| Bug #2 (Bakin removed) | Task 13 |
| OnboardingPage | Task 14 |
| ProjectLibrary | Task 15 |
| FileImportButton | Task 15 |
| FileStatsPanel | Task 15 |
| Final review | Task 16 |

All requirements covered. ✓

**Type consistency:** `getStatusMeta` signature change in Task 9 (`dotCls` → `bgCls`) — Task 9 explicitly notes the destructuring change. ✓

**Placeholder check:** No "TBD" / "implement later" / "similar to Task N" found. All steps include exact code. ✓
