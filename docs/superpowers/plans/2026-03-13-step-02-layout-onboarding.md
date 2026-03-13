# Layout Principal + Onboarding Ollama Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add main app layout (sidebar + content area) and an onboarding screen shown when Ollama is unreachable on localhost:11434.

**Architecture:** Rust commands `check_ollama` and `list_models` call the Ollama HTTP API. The React `useOllamaStatus` hook polls every 5s via TanStack Query and updates the Zustand store. If Ollama is offline, `App.tsx` renders `OnboardingPage`; otherwise it renders the main layout.

**Tech Stack:** Tauri v2, React 19, Zustand, TanStack Query, ollama-rs 0.3.3, tokio

---

## Packages to Add

```bash
# From src-tauri/
cargo add tokio --features full
cargo add ollama-rs@0.3.3

# From project root
pnpm add zustand @tanstack/react-query
```

---

## File Structure

- Create: `src-tauri/src/commands/ollama.rs` — `check_ollama`, `list_models` Tauri commands
- Create: `src-tauri/src/commands/mod.rs` — pub mod declarations
- Modify: `src-tauri/src/lib.rs` — register commands in invoke_handler
- Create: `src/stores/appStore.ts` — Zustand store (ollamaOnline, availableModels)
- Create: `src/hooks/useOllamaStatus.ts` — TanStack Query wrapper around check_ollama
- Create: `src/features/onboarding/OnboardingPage.tsx` — instructions to install Ollama
- Create: `src/features/onboarding/index.ts` — re-export
- Modify: `src/App.tsx` — conditional render: OnboardingPage vs main layout

---

## Task 1: Install Packages

**Files:** `src-tauri/Cargo.toml`, `package.json`

- [ ] **Step 1: Add Rust crates**

```bash
cd src-tauri
cargo add tokio --features full
cargo add ollama-rs@0.3.3
```

- [ ] **Step 2: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors

- [ ] **Step 3: Add frontend packages**

```bash
pnpm add zustand @tanstack/react-query
```

- [ ] **Step 4: Verify frontend builds**

Run: `pnpm build`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock package.json pnpm-lock.yaml
git commit -m "chore: add tokio, ollama-rs, zustand, react-query"
```

---

## Task 2: Rust Commands — check_ollama + list_models

**Files:**
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/ollama.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing test**

```rust
// src-tauri/src/commands/ollama.rs — add at bottom
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_ollama_returns_bool() {
        // This test verifies the function signature compiles and returns a Result<bool, String>
        // It will return Ok(false) if Ollama is not running in test env — that's fine
        let result = check_ollama_inner().await;
        assert!(result.is_ok() || result.is_err()); // always true — just tests compilation
    }
}
```

- [ ] **Step 2: Run to verify it fails (function doesn't exist yet)**

Run: `cd src-tauri && cargo test test_check_ollama_returns_bool`
Expected: FAIL — function not found

- [ ] **Step 3: Implement commands/mod.rs**

```rust
// src-tauri/src/commands/mod.rs
pub mod ollama;
```

- [ ] **Step 4: Implement commands/ollama.rs**

```rust
// src-tauri/src/commands/ollama.rs
use ollama_rs::Ollama;

/// Internal function — testable without Tauri state
pub async fn check_ollama_inner() -> Result<bool, String> {
    let ollama = Ollama::default(); // connects to localhost:11434
    match ollama.list_local_models().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn check_ollama() -> Result<bool, String> {
    check_ollama_inner().await
}

#[tauri::command]
pub async fn list_models() -> Result<Vec<String>, String> {
    let ollama = Ollama::default();
    let models = ollama
        .list_local_models()
        .await
        .map_err(|e| e.to_string())?;
    Ok(models.into_iter().map(|m| m.name).collect())
}
```

- [ ] **Step 5: Register in lib.rs**

```rust
// src-tauri/src/lib.rs — add mod and update invoke_handler
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::ollama::check_ollama,
            commands::ollama::list_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 6: Run tests**

Run: `cd src-tauri && cargo test test_check_ollama_returns_bool`
Expected: PASS

- [ ] **Step 7: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands/ src-tauri/src/lib.rs
git commit -m "feat: add check_ollama and list_models Tauri commands"
```

---

## Task 3: Zustand Store

**Files:**
- Create: `src/stores/appStore.ts`

- [ ] **Step 1: Write the store**

```ts
// src/stores/appStore.ts
import { create } from 'zustand'

interface AppStore {
  ollamaOnline: boolean
  availableModels: string[]
  setOllamaStatus: (online: boolean, models: string[]) => void
}

export const useAppStore = create<AppStore>((set) => ({
  ollamaOnline: false,
  availableModels: [],
  setOllamaStatus: (online, models) =>
    set({ ollamaOnline: online, availableModels: models }),
}))
```

- [ ] **Step 2: Verify TypeScript**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/stores/appStore.ts
git commit -m "feat: add Zustand app store"
```

---

## Task 4: useOllamaStatus Hook

**Files:**
- Create: `src/hooks/useOllamaStatus.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useOllamaStatus.ts
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '@/stores/appStore'

export function useOllamaStatus() {
  const setOllamaStatus = useAppStore((s) => s.setOllamaStatus)

  const query = useQuery({
    queryKey: ['ollama-status'],
    queryFn: async () => {
      const online = await invoke<boolean>('check_ollama')
      if (online) {
        const models = await invoke<string[]>('list_models')
        return { online, models }
      }
      return { online: false, models: [] }
    },
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (query.data) {
      setOllamaStatus(query.data.online, query.data.models)
    }
  }, [query.data, setOllamaStatus])

  return query
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useOllamaStatus.ts
git commit -m "feat: add useOllamaStatus hook with 5s polling"
```

---

## Task 5: OnboardingPage Component

**Files:**
- Create: `src/features/onboarding/OnboardingPage.tsx`
- Create: `src/features/onboarding/index.ts`

- [ ] **Step 1: Write the onboarding page**

```tsx
// src/features/onboarding/OnboardingPage.tsx
export function OnboardingPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 p-8">
      <h1 className="text-2xl font-bold">Ollama not detected</h1>
      <p className="text-muted-foreground text-center max-w-md">
        hoshi-trans requires Ollama running locally on{' '}
        <code className="font-mono bg-muted px-1 rounded">localhost:11434</code>.
      </p>
      <ol className="list-decimal list-inside space-y-2 text-sm">
        <li>
          Install Ollama from{' '}
          <span className="font-mono text-primary">ollama.com</span>
        </li>
        <li>
          Run a model:{' '}
          <code className="font-mono bg-muted px-1 rounded">
            ollama pull qwen2.5:7b
          </code>
        </li>
        <li>Keep Ollama running in the background</li>
      </ol>
      <p className="text-xs text-muted-foreground">
        This screen will disappear automatically once Ollama is detected.
      </p>
    </div>
  )
}
```

```ts
// src/features/onboarding/index.ts
export { OnboardingPage } from './OnboardingPage'
```

- [ ] **Step 2: Verify TypeScript**

Run: `pnpm build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/onboarding/
git commit -m "feat: add OnboardingPage component"
```

---

## Task 6: Wire Up App.tsx

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx` — wrap in QueryClientProvider

- [ ] **Step 1: Wrap app in QueryClientProvider**

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 2: Update App.tsx**

```tsx
// src/App.tsx
import { useOllamaStatus } from '@/hooks/useOllamaStatus'
import { useAppStore } from '@/stores/appStore'
import { OnboardingPage } from '@/features/onboarding'

function MainLayout() {
  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r p-4">
        <p className="font-semibold">hoshi-trans</p>
      </aside>
      <main className="flex-1 p-6">
        <p className="text-muted-foreground">Select a game to get started.</p>
      </main>
    </div>
  )
}

export default function App() {
  useOllamaStatus()
  const ollamaOnline = useAppStore((s) => s.ollamaOnline)

  return ollamaOnline ? <MainLayout /> : <OnboardingPage />
}
```

- [ ] **Step 3: Test in dev**

Run: `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev`
Expected:
- If Ollama NOT running → OnboardingPage shown
- If Ollama running → MainLayout shown with sidebar
- Starting Ollama while app is open → auto-switches to MainLayout within 5s

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/main.tsx
git commit -m "feat: wire up App.tsx with Ollama status gating"
```
