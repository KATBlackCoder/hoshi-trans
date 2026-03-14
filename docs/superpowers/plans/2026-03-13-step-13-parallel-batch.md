# Parallel Batch Translation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace sequential Ollama translation (1 call at a time) with concurrent requests limited by a configurable semaphore, reducing total translation time by ~N× for N concurrent tasks.

**Architecture:** Add a `concurrency: u32` parameter to `translate_batch`. Use `tokio::sync::Semaphore` (already in tokio, no new crate) to cap simultaneous Ollama calls. Each entry is spawned as a `tokio::task` that acquires a semaphore permit before calling Ollama. The cancel flag (`Arc<AtomicBool>`) is checked before each spawn and inside each task. Progress is tracked with `Arc<AtomicU32>` shared across tasks. Frontend adds a concurrency selector (1/2/4/8) in the translation header.

**Tech Stack:** tokio (Semaphore, JoinSet, AtomicU32), existing Arc<AtomicBool> cancel flag, sqlx (pool is Clone/Arc-backed), tauri::Window (Clone)

---

## No New Packages

- `tokio::sync::Semaphore` and `tokio::task::JoinSet` are already available via the tokio dependency
- `std::sync::atomic::AtomicU32` is in std

---

## File Structure

- Modify: `src-tauri/src/commands/ollama.rs` — replace sequential loop with semaphore + JoinSet
- Modify: `src/hooks/useTranslationBatch.ts` — add `concurrency` param to `start()`
- Modify: `src/features/translation/TranslationView.tsx` — add concurrency selector UI

---

## Task 1: Parallel translate_batch in Rust

**Files:**
- Modify: `src-tauri/src/commands/ollama.rs`

### Context: current sequential loop

```rust
for (i, entry) in entries.iter().enumerate() {
    if cancel_flag.load(Ordering::Relaxed) { break; }
    // one ollama call...
    window.emit("translation:progress", ...);
}
```

### Why these types are safe to share across tasks

- `SqlitePool` — implements `Clone`, internally `Arc`-backed. Each task can hold its own clone.
- `Arc<AtomicBool>` — already `Arc`, just `.clone()` it.
- `tauri::Window` — implements `Clone`, safe to send across tasks.
- `String` fields (`model`, `system_prompt`, `target_lang`) — just `.clone()` per task.
- `TranslationEntry` — add `#[derive(Clone)]` to the model if not already present.

### How the semaphore works

```
concurrency = 4:

entries: [e1, e2, e3, e4, e5, e6, ...]
          ↓   ↓   ↓   ↓
         [task task task task]  ← 4 running, semaphore full
                                  e5 waits until a permit is released
```

Each task holds a permit until it finishes. When it drops the permit, the next waiting task can start.

- [ ] **Step 1: Check that TranslationEntry derives Clone**

Open `src-tauri/src/models/translation.rs`. The struct must derive `Clone`:

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct TranslationEntry { ... }
```

Add `Clone` to the derive if missing.

- [ ] **Step 2: Write a unit test for the concurrency logic**

Add to `src-tauri/src/commands/ollama.rs` tests:

```rust
#[tokio::test]
async fn test_semaphore_limits_concurrency() {
    use tokio::sync::Semaphore;
    use std::sync::{Arc, atomic::{AtomicU32, Ordering}};

    let semaphore = Arc::new(Semaphore::new(2)); // max 2 concurrent
    let active = Arc::new(AtomicU32::new(0));
    let max_seen = Arc::new(AtomicU32::new(0));
    let mut join_set = tokio::task::JoinSet::new();

    for _ in 0..8 {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        let active = active.clone();
        let max_seen = max_seen.clone();
        join_set.spawn(async move {
            let current = active.fetch_add(1, Ordering::SeqCst) + 1;
            // Track peak concurrency
            let mut seen = max_seen.load(Ordering::SeqCst);
            while current > seen {
                match max_seen.compare_exchange(seen, current, Ordering::SeqCst, Ordering::SeqCst) {
                    Ok(_) => break,
                    Err(x) => seen = x,
                }
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            active.fetch_sub(1, Ordering::SeqCst);
            drop(permit);
        });
    }

    while join_set.join_next().await.is_some() {}
    assert!(max_seen.load(Ordering::SeqCst) <= 2, "concurrency exceeded semaphore limit");
}
```

- [ ] **Step 3: Run to verify it passes (this tests tokio itself, should be green)**

```bash
cd src-tauri && cargo test test_semaphore_limits_concurrency
```

Expected: PASS

- [ ] **Step 4: Rewrite translate_batch with concurrency**

Replace the entire `translate_batch` function in `src-tauri/src/commands/ollama.rs`:

```rust
#[tauri::command]
pub async fn translate_batch(
    window: tauri::Window,
    pool: tauri::State<'_, SqlitePool>,
    cancel_flag: tauri::State<'_, Arc<AtomicBool>>,
    project_id: String,
    model: String,
    target_lang: String,
    system_prompt: String,
    concurrency: u32,
) -> Result<(), String> {
    use tokio::sync::Semaphore;
    use std::sync::atomic::AtomicU32;

    cancel_flag.store(false, Ordering::Relaxed);

    let entries = queries::get_pending_entries(&pool, &project_id)
        .await
        .map_err(|e| e.to_string())?;

    let total = entries.len() as u32;
    let concurrency = concurrency.max(1).min(16) as usize; // clamp 1..=16
    let semaphore = Arc::new(Semaphore::new(concurrency));
    let done_count = Arc::new(AtomicU32::new(0));
    let cancel = cancel_flag.inner().clone();
    let pool_inner = pool.inner().clone();
    let mut join_set = tokio::task::JoinSet::new();

    for entry in entries {
        // Check cancel before acquiring permit (avoids spawning unnecessary tasks)
        if cancel.load(Ordering::Relaxed) {
            break;
        }

        let permit = semaphore.clone().acquire_owned().await.unwrap();

        // Check again — cancel may have been set while waiting for permit
        if cancel.load(Ordering::Relaxed) {
            break;
        }

        let pool = pool_inner.clone();
        let cancel = cancel.clone();
        let window = window.clone();
        let model = model.clone();
        let system_prompt = system_prompt.clone();
        let target_lang = target_lang.clone();
        let done_count = done_count.clone();

        join_set.spawn(async move {
            let _permit = permit; // released when this task ends

            if cancel.load(Ordering::Relaxed) {
                return;
            }

            let encoded = crate::engines::rpgmaker_mv_mz::placeholders::encode(&entry.source_text);
            let prompt = format!("{}\n\nTranslate to {}:\n{}", system_prompt, target_lang, encoded);
            let ollama = Ollama::default();
            let request = GenerationRequest::new(model.clone(), prompt);

            match ollama.generate(request).await {
                Ok(response) => {
                    let translated = response.response.trim().to_string();
                    let (decoded, intact) = crate::engines::rpgmaker_mv_mz::placeholders::decode(&translated);
                    let status = if intact { "translated" } else { "warning:missing_placeholder" };
                    let _ = queries::update_translation(&pool, &entry.id, &decoded, status).await;
                }
                Err(e) => {
                    let _ = queries::update_status(&pool, &entry.id, &format!("error:{}", e)).await;
                }
            }

            let done = done_count.fetch_add(1, Ordering::Relaxed) + 1;
            let _ = window.emit("translation:progress", TranslationProgress {
                done,
                total,
                entry_id: entry.id.clone(),
            });
        });
    }

    // Wait for all in-flight tasks to complete
    while join_set.join_next().await.is_some() {}

    Ok(())
}
```

> **Note:** The current sequential loop sends raw `source_text` to Ollama without calling `encode()` first — RPG Maker control codes like `\n[1]` are exposed directly to the LLM. The new version correctly calls `encode()` on `source_text` before building the prompt (converting codes to `{{PLACEHOLDER}}` tokens), then `decode()` on the response to restore them.

- [ ] **Step 5: Compile check**

```bash
cd src-tauri && cargo check
```

Expected: no errors (warnings about dead code are pre-existing)

- [ ] **Step 6: Run tests**

```bash
cd src-tauri && cargo test test_semaphore
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/ollama.rs src-tauri/src/models/translation.rs
git commit -m "feat: parallel translate_batch with semaphore concurrency control"
```

---

## Task 2: Frontend — concurrency param + selector

**Files:**
- Modify: `src/hooks/useTranslationBatch.ts`
- Modify: `src/features/translation/TranslationView.tsx`

- [ ] **Step 1: Update useTranslationBatch to accept concurrency**

```ts
// src/hooks/useTranslationBatch.ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useState, useCallback } from 'react'
import type { TranslationProgress } from '@/types'

export function useTranslationBatch() {
  const [progress, setProgress] = useState<TranslationProgress | null>(null)
  const [running, setRunning] = useState(false)

  const start = useCallback(async (
    projectId: string,
    model: string,
    targetLang: string,
    systemPrompt: string,
    concurrency: number = 4,
  ) => {
    setRunning(true)
    setProgress(null)

    const unlisten = await listen<TranslationProgress>(
      'translation:progress',
      (e) => setProgress(e.payload),
    )

    try {
      await invoke('translate_batch', {
        projectId,
        model,
        targetLang,
        systemPrompt,
        concurrency,
      })
    } finally {
      unlisten()
      setRunning(false)
    }
  }, [])

  const cancel = useCallback(() => invoke('cancel_batch'), [])

  return { progress, running, start, cancel }
}
```

- [ ] **Step 2: Add concurrency state + selector to TranslationView**

In `src/features/translation/TranslationView.tsx`:

Add state near the top:
```ts
const [concurrency, setConcurrency] = useState(4)
```

Update the `start()` call to pass concurrency:
```ts
onClick={() => start(projectId, model, 'en', 'Translate to English. Preserve all {{PLACEHOLDER}} tokens exactly.', concurrency)}
```

Add the concurrency selector next to the Translate button (in the header batch controls section):
```tsx
{/* Concurrency selector */}
<div className="flex items-center gap-1">
  {[1, 2, 4, 8].map(n => (
    <button
      key={n}
      onClick={() => setConcurrency(n)}
      disabled={running}
      className={`w-7 h-7 rounded text-xs font-mono transition-colors ${
        concurrency === n
          ? 'bg-secondary text-secondary-foreground font-semibold'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
      }`}
    >
      {n}×
    </button>
  ))}
</div>
```

Place the selector between the progress section and the Translate button.

- [ ] **Step 3: TypeScript build check**

```bash
pnpm build
```

Expected: no TS errors, build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTranslationBatch.ts src/features/translation/TranslationView.tsx
git commit -m "feat: add concurrency selector to translation UI (1×/2×/4×/8×)"
```

---

## Task 3: Manual end-to-end test

- [ ] **Step 1: Start the app**

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev
```

- [ ] **Step 2: Open a Japanese game (e.g. osana_isekai_v1.06 with ~20k entries)**

- [ ] **Step 3: Test each concurrency level**

Select `1×` → click Translate all → observe progress speed (baseline).
Cancel. Select `4×` → click Translate all → progress should advance ~4× faster.

- [ ] **Step 4: Test cancel mid-batch**

Start at `4×`, click Cancel after a few seconds. Verify translation stops cleanly (no crash, remaining entries stay `pending`).

- [ ] **Step 5: Verify DB integrity**

Translated entries should have `status = 'translated'`. No duplicate writes or lost updates. Check in the UI with the status filter tabs.
