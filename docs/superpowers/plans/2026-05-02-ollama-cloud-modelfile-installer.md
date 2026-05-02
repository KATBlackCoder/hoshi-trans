# Modelfile Installer + Model Badge Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click Modelfile installer for all three local hoshi-translator models (including the new abliterated-4b), display a compact base-model badge next to every model selector, and remove the deprecated RunPod references.

**Architecture:** A new `src/lib/models.ts` shared constant maps model names to badge labels. The `install_modelfile` Rust command embeds all three Modelfiles at compile time, writes to temp, and streams `ollama create` stderr as Tauri events. OllamaPage gains a vertical Install Models section and updated chips. BatchControls model selectors show the badge inline. No changes to Settings, hooks, or Rust Ollama auth.

**Tech Stack:** Tauri v2, Rust (tokio, std::process), React 19, Zustand, shadcn/ui.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src-tauri/modelfiles/hoshi-translator-abliterated-4b.Modelfile` | Create | fp16 higher-quality 4B variant (FROM huihui_ai/qwen3-abliterated:4b-instruct-2507-fp16) |
| `src/lib/models.ts` | Create | `HOSHI_MODEL_INFO` — model name → badge label (shared constant) |
| `src/features/translation/BatchControls.tsx` | Modify | Model selectors show `hoshi-translator` + base badge; trigger width `w-40` → `w-52` |
| `src/features/ollama/OllamaPage.tsx` | Modify | Remove `isRunPod`; chips show badge; add Install Models section |
| `src/features/about/AboutPage.tsx` | Modify | Remove RunPod accordion + state; update 30B chip sub label |
| `src-tauri/src/commands/install.rs` | Create | `install_modelfile` command — 3 models, stream progress events |
| `src-tauri/src/commands/mod.rs` | Modify | Add `pub mod install` |
| `src-tauri/src/lib.rs` | Modify | Register `install_modelfile` in `generate_handler!` |
| `docs/CONTEXT.md` | Modify | Document Modelfile installer command |

---

## Task 0: New Modelfile — abliterated-4b (fp16)

**Files:**
- Create: `src-tauri/modelfiles/hoshi-translator-abliterated-4b.Modelfile`

- [ ] **Step 1: Create the abliterated-4b Modelfile**

Create `src-tauri/modelfiles/hoshi-translator-abliterated-4b.Modelfile`:

```
FROM huihui_ai/qwen3-abliterated:4b-instruct-2507-fp16

# --- Sampling ---
PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER repeat_penalty 1.1
PARAMETER min_p 0.05

# --- Generation ---
PARAMETER num_predict 600
PARAMETER num_ctx 4096

SYSTEM """
MARKER RULE (HIGHEST PRIORITY — NEVER BREAK):
❬0❭ ❬1❭ ❬2❭ ❬3❭ are untranslatable engine codes. Treat them like punctuation.
- Copy EVERY ❬n❭ token into your output EXACTLY where it appears
- ❬n❭ tokens are invisible to the reader — keep them at the same relative position
- NEVER drop, merge, replace, or invent any ❬n❭ token
Honorifics: keep as-is (-san, -kun, -chan, -sama, -senpai)
Ellipses: preserve exactly (… stays …, …… stays ……)
No censorship — handle adult content faithfully.
"""

# Marker mid-sentence
MESSAGE user "❬0❭は剣を手に入れた！"
MESSAGE assistant "❬0❭ obtained a sword!"

# Name + newline marker + dialogue (Wolf RPG pattern)
MESSAGE user "ウルファール❬0❭「準備はいいか？」"
MESSAGE assistant "Ulfar❬0❭\"Are you ready?\""

# Consecutive markers
MESSAGE user "❬0❭❬1❭❬2❭は❬3❭ゴールドを持っている。"
MESSAGE assistant "❬0❭❬1❭❬2❭ has ❬3❭ gold."
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/modelfiles/hoshi-translator-abliterated-4b.Modelfile
git commit -m "feat(modelfiles): add hoshi-translator-abliterated-4b (fp16, ~8 GB VRAM)"
```

---

## Task 1: Create `src/lib/models.ts` — shared HOSHI_MODEL_INFO

**Files:**
- Create: `src/lib/models.ts`

- [ ] **Step 1: Create the file**

```ts
export const HOSHI_MODEL_INFO: Record<string, string> = {
  'hoshi-translator-4b': 'q8_0 · 4B',
  'hoshi-translator-abliterated-4b': 'fp16 · 4B',
  'hoshi-translator-30b': 'q4_K_M · 30B',
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: `✓ built` — no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/models.ts
git commit -m "feat(lib): add HOSHI_MODEL_INFO — model name to base badge label"
```

---

## Task 2: BatchControls — badge in model selectors

**Files:**
- Modify: `src/features/translation/BatchControls.tsx`

- [ ] **Step 1: Add the import**

At the top of `src/features/translation/BatchControls.tsx`, add:

```ts
import { HOSHI_MODEL_INFO } from '@/lib/models'
```

- [ ] **Step 2: Update both model SelectItems**

The file has two model selectors (TL and RF). Find both occurrences of:

```tsx
<SelectTrigger className="h-6 w-40 text-xs font-mono border-0 bg-transparent px-1 focus:ring-0">
```

Replace both with:

```tsx
<SelectTrigger className="h-6 w-52 text-xs font-mono border-0 bg-transparent px-1 focus:ring-0">
```

Then find both occurrences of:

```tsx
{availableModels.map(m => (
  <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>
))}
```

Replace both with:

```tsx
{availableModels.map(m => (
  <SelectItem key={m} value={m} className="text-xs font-mono">
    <span>hoshi-translator</span>
    {HOSHI_MODEL_INFO[m] && (
      <span className="ml-1.5 text-[9px] text-muted-foreground/50 font-normal">{HOSHI_MODEL_INFO[m]}</span>
    )}
  </SelectItem>
))}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: `✓ built` — no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/translation/BatchControls.tsx
git commit -m "feat(ui): show hoshi-translator + base badge in BatchControls model selectors"
```

---

## Task 3: OllamaPage — remove RunPod, add badges to chips

**Files:**
- Modify: `src/features/ollama/OllamaPage.tsx`

- [ ] **Step 1: Update imports**

Replace:

```ts
import { useAppStore, DEFAULT_OLLAMA_HOST } from '@/stores/appStore'
```

With:

```ts
import { useAppStore, DEFAULT_OLLAMA_HOST } from '@/stores/appStore'
import { HOSHI_MODEL_INFO } from '@/lib/models'
```

- [ ] **Step 2: Remove `isRunPod`, add nothing**

Replace:

```ts
const [hostDraft, setHostDraft] = useState(settings.ollamaHost)
const [saved, setSaved] = useState(false)
const isRunPod = settings.ollamaHost.includes('runpod.net')
```

With:

```ts
const [hostDraft, setHostDraft] = useState(settings.ollamaHost)
const [saved, setSaved] = useState(false)
```

- [ ] **Step 3: Update the status badge**

In the header status badge, replace:

```tsx
<span className="opacity-50">{isRunPod ? 'RunPod' : 'Local'}</span>
```

With:

```tsx
<span className="opacity-50">Local</span>
```

- [ ] **Step 4: Update the Active configuration card**

Replace:

```tsx
sub: isRunPod ? 'RunPod (cloud)' : 'Local Ollama',
```

With:

```tsx
sub: 'Local Ollama',
```

- [ ] **Step 5: Update the "no models" hint**

Replace:

```tsx
No hoshi-translator models found. See <span className="text-primary/60">About → Setup Guides</span> to install them.
```

With:

```tsx
No hoshi-translator models found. Use the Install Models section below to create them.
```

- [ ] **Step 6: Update the Available models chips**

Replace the entire chip `{availableModels.map(...)}` block:

```tsx
{availableModels.map((m) => (
  <button
    key={m}
    onClick={() => updateSettings({ ollamaModel: m })}
    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono transition-all ${
      settings.ollamaModel === m
        ? 'border-primary/40 bg-primary/10 text-foreground/90'
        : 'border-border/25 bg-background/20 text-muted-foreground/45 hover:border-border/50 hover:text-muted-foreground/70'
    }`}
  >
    {settings.ollamaModel === m && (
      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
    )}
    {m}
  </button>
))}
```

With:

```tsx
{availableModels.map((m) => {
  const base = HOSHI_MODEL_INFO[m]
  return (
    <button
      key={m}
      onClick={() => updateSettings({ ollamaModel: m })}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono transition-all ${
        settings.ollamaModel === m
          ? 'border-primary/40 bg-primary/10 text-foreground/90'
          : 'border-border/25 bg-background/20 text-muted-foreground/45 hover:border-border/50 hover:text-muted-foreground/70'
      }`}
    >
      {settings.ollamaModel === m && (
        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
      )}
      <span>hoshi-translator</span>
      {base && (
        <span className="text-[9px] text-muted-foreground/50 font-normal border border-border/30 rounded px-1 py-0.5 ml-0.5">
          {base}
        </span>
      )}
    </button>
  )
})}
```

- [ ] **Step 7: Update model SelectItems in Connection section**

Replace:

```tsx
{availableModels.map((m) => (
  <SelectItem key={m} value={m} className="font-mono text-xs">{m}</SelectItem>
))}
```

With:

```tsx
{availableModels.map((m) => (
  <SelectItem key={m} value={m} className="font-mono text-xs">
    <span>hoshi-translator</span>
    {HOSHI_MODEL_INFO[m] && (
      <span className="ml-1.5 text-[9px] text-muted-foreground/50 font-normal">{HOSHI_MODEL_INFO[m]}</span>
    )}
  </SelectItem>
))}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: `✓ built` — no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/features/ollama/OllamaPage.tsx
git commit -m "feat(ui): OllamaPage — remove RunPod, add HOSHI_MODEL_INFO badges to chips and select"
```

---

## Task 4: AboutPage — remove RunPod

**Files:**
- Modify: `src/features/about/AboutPage.tsx`

- [ ] **Step 1: Remove RunPod state and variable**

In the `SetupGuides` function, remove these two lines:

```ts
const [runpodOpen, setRunpodOpen] = useState(false)
const runpodCmd = `bash -c "..."`
```

- [ ] **Step 2: Remove the RunPod accordion block**

Delete the entire `{/* RunPod */}` block — from the `<div className="rounded border...">` containing "RunPod Cloud GPU" through its closing `</div>` (the one that ends the `runpodOpen && (...)` branch).

- [ ] **Step 3: Update the 30B chip sub label**

Replace:

```tsx
{ id: '30b' as const, label: '30B MoE', sub: 'RunPod · ~20 GB' },
```

With:

```tsx
{ id: '30b' as const, label: '30B MoE', sub: 'min 24 GB VRAM' },
```

- [ ] **Step 4: Remove `Zap` from lucide-react import if unused**

```bash
grep -n "Zap" src/features/about/AboutPage.tsx
```

If `Zap` appears only in the import (no usages), remove it from the import line.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: `✓ built` — no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/about/AboutPage.tsx
git commit -m "feat(ui): remove RunPod from About page, update 30B chip label"
```

---

## Task 5: Rust — `install_modelfile` command

**Files:**
- Create: `src-tauri/src/commands/install.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create `src-tauri/src/commands/install.rs`**

```rust
use tauri::Emitter;

#[derive(serde::Serialize, Clone)]
pub struct ModelfileProgress {
    pub line: String,
}

#[derive(serde::Serialize, Clone)]
pub struct ModelfileFallback {
    pub command: String,
}

#[tauri::command]
pub async fn install_modelfile(
    window: tauri::Window,
    model: String,
) -> Result<(), String> {
    let (content, model_name) = match model.as_str() {
        "4b" => (
            include_str!("../../modelfiles/hoshi-translator-4b.Modelfile"),
            "hoshi-translator-4b",
        ),
        "abliterated-4b" => (
            include_str!("../../modelfiles/hoshi-translator-abliterated-4b.Modelfile"),
            "hoshi-translator-abliterated-4b",
        ),
        "30b" => (
            include_str!("../../modelfiles/hoshi-translator-30b.Modelfile"),
            "hoshi-translator-30b",
        ),
        _ => return Err(format!("Unknown model: {}", model)),
    };

    let tmp_path = std::env::temp_dir().join(format!("hoshi-{}.Modelfile", model));
    std::fs::write(&tmp_path, content).map_err(|e| e.to_string())?;

    // Check if ollama is in PATH
    if std::process::Command::new("ollama").arg("--version").output().is_err() {
        let fallback_cmd = format!(
            "ollama create {} -f {}",
            model_name,
            tmp_path.to_string_lossy()
        );
        window
            .emit("modelfile:fallback", ModelfileFallback { command: fallback_cmd })
            .ok();
        return Ok(());
    }

    let tmp_path_str = tmp_path.to_string_lossy().to_string();
    let model_name_owned = model_name.to_string();
    let window_clone = window.clone();

    let (tx, mut rx) = tokio::sync::mpsc::channel::<Result<String, String>>(64);

    tokio::task::spawn_blocking(move || {
        use std::io::BufRead;
        use std::process::{Command, Stdio};

        let mut child = match Command::new("ollama")
            .args(["create", &model_name_owned, "-f", &tmp_path_str])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                let _ = tx.blocking_send(Err(e.to_string()));
                return;
            }
        };

        // ollama writes progress to stderr
        if let Some(stderr) = child.stderr.take() {
            for line in std::io::BufReader::new(stderr).lines() {
                match line {
                    Ok(l) => {
                        if tx.blocking_send(Ok(l)).is_err() {
                            break;
                        }
                    }
                    Err(e) => {
                        let _ = tx.blocking_send(Err(e.to_string()));
                        break;
                    }
                }
            }
        }

        let _ = child.wait();
    });

    while let Some(msg) = rx.recv().await {
        match msg {
            Ok(line) => {
                window_clone
                    .emit("modelfile:progress", ModelfileProgress { line })
                    .ok();
            }
            Err(e) => return Err(e),
        }
    }

    window_clone.emit("modelfile:done", model_name.to_string()).ok();
    Ok(())
}
```

- [ ] **Step 2: Register the module in `src-tauri/src/commands/mod.rs`**

Add to the existing list:

```rust
pub mod install;
```

- [ ] **Step 3: Register the command in `src-tauri/src/lib.rs`**

In the `generate_handler![]` array, add:

```rust
commands::install::install_modelfile,
```

- [ ] **Step 4: Verify Rust compiles**

```bash
cd src-tauri && cargo check 2>&1 | grep "^error" | head -10
```

Expected: no errors (warnings OK).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/install.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(rust): install_modelfile command — stream ollama create progress events"
```

---

## Task 6: OllamaPage — Install Models UI

**Files:**
- Modify: `src/features/ollama/OllamaPage.tsx`

- [ ] **Step 1: Add install state and event listeners**

Add imports at the top of `OllamaPage.tsx`:

```ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useRef } from 'react'
```

(Note: `useState` is already imported — just add the new imports alongside existing ones.)

Inside the `OllamaPage` component body, after the existing state declarations, add:

```ts
const [installing, setInstalling] = useState<'4b' | 'abliterated-4b' | '30b' | null>(null)
const [installLines, setInstallLines] = useState<string[]>([])
const [installFallback, setInstallFallback] = useState<string | null>(null)
const [installDone, setInstallDone] = useState<string | null>(null)
const scrollRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const unlistenProgress = listen<{ line: string }>('modelfile:progress', (e) => {
    setInstallLines((prev) => [...prev.slice(-50), e.payload.line])
    setTimeout(() => scrollRef.current?.scrollTo({ top: 99999 }), 10)
  })
  const unlistenDone = listen<string>('modelfile:done', (e) => {
    setInstalling(null)
    setInstallDone(e.payload)
  })
  const unlistenFallback = listen<{ command: string }>('modelfile:fallback', (e) => {
    setInstalling(null)
    setInstallFallback(e.payload.command)
  })
  return () => {
    unlistenProgress.then((f) => f())
    unlistenDone.then((f) => f())
    unlistenFallback.then((f) => f())
  }
}, [])

async function startInstall(model: '4b' | 'abliterated-4b' | '30b') {
  setInstalling(model)
  setInstallLines([])
  setInstallFallback(null)
  setInstallDone(null)
  try {
    await invoke('install_modelfile', { model })
  } catch (e) {
    setInstalling(null)
    setInstallLines((prev) => [...prev, `Error: ${e}`])
  }
}
```

- [ ] **Step 2: Add the Install Models section in the RIGHT column**

In the right column of OllamaPage, after the closing `</div>` of the "Available models" section and before the Tips section, add:

```tsx
{/* Install Models */}
<div className="rounded-lg border border-border/30 bg-card/20 overflow-hidden">
  <div className="px-4 pt-3.5 pb-1 flex items-center justify-between">
    <SectionLabel>Install models</SectionLabel>
    <span className="text-[9px] text-muted-foreground/25 font-mono mb-2">local</span>
  </div>
  <div className="px-3 pb-3 flex flex-col gap-2">
    <p className="text-[10px] text-muted-foreground/45 leading-relaxed px-1">
      Creates the hoshi-translator models from embedded Modelfiles. Requires Ollama + base model already pulled.
    </p>

    {/* Install buttons */}
    <div className="flex flex-col gap-1.5">
      {([
        { id: '4b' as const, label: 'hoshi-translator-4b', sub: 'q8_0 · ~4 GB VRAM' },
        { id: 'abliterated-4b' as const, label: 'hoshi-translator-abliterated-4b', sub: 'fp16 · ~8 GB VRAM' },
        { id: '30b' as const, label: 'hoshi-translator-30b', sub: 'q4_K_M · min 24 GB VRAM' },
      ]).map(({ id, label, sub }) => (
        <button
          key={id}
          onClick={() => startInstall(id)}
          disabled={installing !== null}
          className={`w-full flex items-center justify-between px-3 py-2 rounded border transition-all ${
            installing === id
              ? 'border-primary/40 bg-primary/10 text-foreground cursor-wait'
              : 'border-border/25 bg-background/20 text-muted-foreground/50 hover:border-border/50 hover:text-muted-foreground/70 disabled:opacity-40'
          }`}
        >
          <span className="text-[10px] font-mono font-medium">{label}</span>
          <span className="text-[9px] text-muted-foreground/40">
            {installing === id ? <span className="text-primary/60 animate-pulse">Installing…</span> : sub}
          </span>
        </button>
      ))}
    </div>

    {/* Progress log */}
    {installLines.length > 0 && (
      <div
        ref={scrollRef}
        className="max-h-28 overflow-y-auto rounded border border-border/20 bg-background/40 px-2.5 py-2"
      >
        {installLines.map((line, i) => (
          <p key={i} className="text-[9.5px] font-mono text-muted-foreground/55 leading-relaxed">{line}</p>
        ))}
      </div>
    )}

    {/* Success */}
    {installDone && (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-green-500/20 bg-green-500/5">
        <Check className="w-3 h-3 text-green-400 shrink-0" />
        <span className="text-[10px] text-green-400/80 font-mono">{installDone} created — reload model list</span>
      </div>
    )}

    {/* Fallback: ollama not in PATH */}
    {installFallback && (
      <div className="flex flex-col gap-1.5">
        <p className="text-[9.5px] text-amber-400/70 px-1">
          `ollama` not found in PATH. Run this command manually:
        </p>
        <div className="relative group">
          <pre className="text-[9.5px] font-mono bg-background/60 border border-border/50 rounded px-2.5 py-2 text-foreground/70 whitespace-pre-wrap break-all">
            {installFallback}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(installFallback)}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded bg-background/80 border border-border/50 text-[9px] text-muted-foreground/60 hover:text-foreground"
          >
            Copy
          </button>
        </div>
      </div>
    )}
  </div>
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: `✓ built` — no TypeScript errors.

- [ ] **Step 4: Manual smoke test**

Start the dev app (`pnpm tauri:linux`), go to the Ollama page. The "Install models" section should appear with three vertical buttons (4b, abliterated-4b, 30b). Click one — it should show the progress log or the fallback command if `ollama` is not in PATH.

- [ ] **Step 5: Commit**

```bash
git add src/features/ollama/OllamaPage.tsx
git commit -m "feat(ui): Install Models section in OllamaPage — 3 models, progress stream, fallback"
```

---

## Task 7: Update docs

**Files:**
- Modify: `docs/CONTEXT.md`

- [ ] **Step 1: Update the OllamaPage entry in the frontend structure**

Find the `ollama/` entry and update to:
```
├── ollama/   # OllamaPage: host, model, temperature, Install Models section (3 models)
```

- [ ] **Step 2: Document `install_modelfile` in the commands listing**

Add to the commands section:
```
- `install_modelfile(model: "4b" | "abliterated-4b" | "30b")` — embeds Modelfile via
  `include_str!`, writes to temp dir, runs `ollama create hoshi-translator-{model}` via
  tokio::task::spawn_blocking, streams stderr as `modelfile:progress` events, emits
  `modelfile:done` on success, `modelfile:fallback` (with copy-paste command) if
  `ollama` is not in PATH.
```

- [ ] **Step 3: Update the model lineup note**

Add or update:
```
**Model lineup (all abliterated):**
- `hoshi-translator-4b` → `huihui_ai/qwen3-abliterated:4b-instruct-2507-q8_0` — ~4 GB VRAM, fast
- `hoshi-translator-abliterated-4b` → `huihui_ai/qwen3-abliterated:4b-instruct-2507-fp16` — ~8 GB VRAM, higher quality
- `hoshi-translator-30b` → `huihui_ai/qwen3-abliterated:30b-a3b-instruct-2507-q4_K_M` — min 24 GB VRAM, MoE 3.3B active
```

- [ ] **Step 4: Commit**

```bash
git add docs/CONTEXT.md
git commit -m "docs: document Modelfile installer command + model lineup"
```

---

## Summary of commits

| # | Message |
|---|---------|
| 0 | `feat(modelfiles): add hoshi-translator-abliterated-4b (fp16, ~8 GB VRAM)` |
| 1 | `feat(lib): add HOSHI_MODEL_INFO — model name to base badge label` |
| 2 | `feat(ui): show hoshi-translator + base badge in BatchControls model selectors` |
| 3 | `feat(ui): OllamaPage — remove RunPod, add HOSHI_MODEL_INFO badges` |
| 4 | `feat(ui): remove RunPod from About page, update 30B chip label` |
| 5 | `feat(rust): install_modelfile command — stream ollama create progress events` |
| 6 | `feat(ui): Install Models section in OllamaPage — 3 models, progress stream, fallback` |
| 7 | `docs: document Modelfile installer command + model lineup` |

## What does NOT change

- Settings, hooks, Rust Ollama auth — zero changes
- Translation/refine logic, placeholder handling, DB queries
- All other pages (Library, Translation, Glossary, Settings)
- `tauri.conf.json`, migrations, engine code

## Notes

- **`ollama create` PATH issue** — common on macOS (Ollama installed as GUI app without `/usr/local/bin/ollama` symlink). The fallback copy-paste path handles this gracefully.
- **Model lineup (all abliterated):**
  - `hoshi-translator-4b` → `huihui_ai/qwen3-abliterated:4b-instruct-2507-q8_0` — ~4 GB VRAM, fast
  - `hoshi-translator-abliterated-4b` → `huihui_ai/qwen3-abliterated:4b-instruct-2507-fp16` — ~8 GB VRAM, higher quality
  - `hoshi-translator-30b` → `huihui_ai/qwen3-abliterated:30b-a3b-instruct-2507-q4_K_M` — min 24 GB VRAM, MoE 3.3B active
