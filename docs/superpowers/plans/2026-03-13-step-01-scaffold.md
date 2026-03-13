# Scaffold & Setup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tauri v2 + React + TypeScript project operational with minimal packages and strict configuration.

**Architecture:** Vite frontend with TypeScript strict mode and Tailwind CSS v4 + shadcn/ui. Rust backend with minimal Cargo.toml dependencies. A working `greet` test command validates the full IPC stack.

**Tech Stack:** Tauri v2, React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui, Vite, Rust/serde/anyhow

---

> ✅ **STATUS: DONE** — All tasks below are already completed.

---

## File Structure

- Modified: `vite.config.ts` — port 1420, alias `@/`, HMR config
- Modified: `tsconfig.json` / `tsconfig.node.json` — strict mode + paths
- Modified: `src/App.tsx` — minimal test with greet command
- Modified: `src-tauri/Cargo.toml` — minimal deps only
- Modified: `src-tauri/tauri.conf.json` — base capabilities
- Modified: `src-tauri/capabilities/default.json` — base permissions

---

## Task 1: Vite Configuration

**Files:**
- Modify: `vite.config.ts`

- [x] **Step 1: Write the failing test**

```bash
# Verify port and alias are NOT configured yet
grep "1420" vite.config.ts || echo "port not set"
```

- [x] **Step 2: Run to verify state**

Run: `pnpm dev`
Expected: Default Vite port (5173), no `@/` alias

- [x] **Step 3: Configure Vite**

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
})
```

- [x] **Step 4: Verify**

Run: `pnpm dev`
Expected: Server on port 1420, `@/` imports resolve

- [x] **Step 5: Commit**

```bash
git add vite.config.ts
git commit -m "chore: configure vite port 1420 and @ alias"
```

---

## Task 2: TypeScript Strict Mode

**Files:**
- Modify: `tsconfig.json`
- Modify: `tsconfig.node.json`

- [x] **Step 1: Check current state**

```bash
grep "strict" tsconfig.json
```

- [x] **Step 2: Enable strict mode**

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

- [x] **Step 3: Verify**

Run: `pnpm build`
Expected: TypeScript compiles with no errors

- [x] **Step 4: Commit**

```bash
git add tsconfig.json tsconfig.node.json
git commit -m "chore: enable TypeScript strict mode"
```

---

## Task 3: Tailwind CSS v4 + shadcn/ui

**Files:**
- Modify: `src/index.css`
- Modify: `components.json`

- [x] **Step 1: Install packages**

```bash
pnpm add tailwindcss @tailwindcss/vite
pnpm dlx shadcn@latest init
```

- [x] **Step 2: Verify Tailwind loads**

Run: `pnpm dev`
Expected: App renders with Tailwind styles, no errors

- [x] **Step 3: Add first shadcn component**

```bash
pnpm dlx shadcn@latest add button
```

- [x] **Step 4: Verify component exists**

```bash
ls src/components/ui/button.tsx
```
Expected: File exists

- [x] **Step 5: Commit**

```bash
git add src/ components.json
git commit -m "chore: add Tailwind CSS v4 and shadcn/ui"
```

---

## Task 4: Tauri Greet Command

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/App.tsx`

- [x] **Step 1: Verify greet command exists in Rust**

```bash
grep "greet" src-tauri/src/lib.rs
```

- [x] **Step 2: Test full IPC stack**

Run: `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev`
Expected: App launches, greet button works, response appears in UI

- [x] **Step 3: Commit**

```bash
git add src-tauri/ src/
git commit -m "feat: scaffold Tauri + React with greet test command"
```
