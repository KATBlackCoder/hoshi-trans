# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is hoshi-trans

Desktop app (Tauri + React + TypeScript) for translating Japanese game text (RPG Maker MV/MZ, Wolf RPG, Bakin) via Ollama running locally. Pipeline: extract → batch translate (offline) → inject. Languages: JP → EN, JP → FR.

## Commands

```bash
# Frontend dev server only
pnpm dev

# Full Tauri dev (Linux)
pnpm tauri:linux
# or
WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev

# Build
pnpm build          # TypeScript check + Vite build
pnpm tauri build    # Full Tauri release build

# Rust only (from src-tauri/)
cargo build
cargo test
cargo test <test_name>   # run single test
cargo check              # fast type-check without building
```

## Architecture

### Strict Rust / React separation

```
RUST  → file system access, game parsing/injection, Ollama calls, SQLite (sqlx), hoshi-trans.json
REACT → all UI, Zustand state, Tauri command invocations, file picker, notifications, QR codes
```

**React never touches SQLite directly.** All DB operations go through Tauri commands. Use `invoke('command_name', {...})`, never `@tauri-apps/plugin-sql`.

**`hoshi-trans.json` is managed by Rust only.** React receives it via serialized Tauri command response.

### Frontend (`src/`)

- `features/` — one folder per major screen/flow: `onboarding`, `translation`, `file-import`, `file-export`, `settings`, `donations`
- `hooks/` — Tauri command wrappers (`useOllamaStatus`, `useProject`, `useTranslationBatch`)
- `stores/appStore.ts` — Zustand (active project, batch status, Ollama config)
- `types/index.ts` — TypeScript mirror types for all Rust structs — must stay in sync
- `components/ui/` — shadcn/ui components, do not modify

Frontend stack: React 19, TypeScript strict, Tailwind CSS + shadcn/ui, Zustand, TanStack Query.

> **Note:** The global CSS entry point is `src/App.css` (not `index.css`). Import it in `main.tsx`.

### App boot flow

`main.tsx` wraps `<App>` in `<QueryClientProvider>`. `App` calls `useOllamaStatus()` (TanStack Query, polls every 5s via `check_ollama` Tauri command) and reads `ollamaOnline` from Zustand. If false → `<OnboardingPage>`; if true → `<MainLayout>` (sidebar + content area).

### Backend (`src-tauri/src/`)

- `commands/` — Tauri commands exposed to frontend: `project.rs`, `entries.rs`, `extract.rs`, `inject.rs`, `ollama.rs`
- `db/` — SQLx pool init + all queries (never add queries elsewhere)
- `engines/` — one module per game engine, each implements the `GameEngine` trait
  - `common/` — shared `skip.rs` (universal skip logic) and `placeholders.rs` (JP detection, placeholder validation)
  - `rpgmaker_mv_mz/`, `wolf_rpg/`, `bakin/` — engine-specific extractor, injector, placeholders, skip
- `models/` — `TranslationEntry`, `TranslationStatus`, `ProjectFile`, `ProjectStats`, `EngineType`

### GameEngine trait

```rust
#[async_trait::async_trait]
pub trait GameEngine {
    fn detect(game_dir: &std::path::Path) -> bool;
    async fn extract(game_dir: &std::path::Path) -> anyhow::Result<Vec<TranslationEntry>>;
    async fn inject(game_dir: &std::path::Path, entries: &[TranslationEntry], output_dir: &std::path::Path) -> anyhow::Result<()>;
}
```

All engine methods are `async` (required by tokio runtime). New engines must implement this trait with `#[async_trait]`.

### Key rules

- Engine `skip.rs` always calls `common::skip::should_skip()` first, then adds engine-specific rules
- Engine `placeholders.rs`: `encode()` before sending to Ollama, `decode()` after — returns `Warning` status if any placeholder is missing from translation
- Injection is always non-destructive — writes to `output/`, never modifies original game files
- `order_index` on entries is critical for injection — preserve ordering from source files
- Ollama batch only — no calls while a game is running; show onboarding screen if Ollama is unreachable

### Wolf RPG sidecars

Binaries in `src-tauri/bin/` with target-triple suffix (e.g. `WolfTL-x86_64-pc-windows-msvc.exe`). Called via `tauri-plugin-shell`. Requires Wine on Linux.

Pipeline: `[encrypted] → UberWolf.exe → [decrypted] → WolfTL.exe dump → [JSON] → translate → WolfTL.exe patch`

### Project file (`hoshi-trans.json`)

Created automatically in the game folder on first extraction. Contains metadata + stats + link to DB. If the game folder is read-only, stored in `app_data_dir/projects/<uuid>.json` instead (path recorded in `projects.json_path` DB column).

### Database

SQLite via `sqlx`, stored in `app_data_dir/hoshi-trans.db`. Migrations in `src-tauri/migrations/`. Pool initialized in `db/mod.rs` and shared via `tauri::State<SqlitePool>`.

> **Note:** `use tauri::Manager;` is required in `lib.rs` to call `.path()` and `.manage()` on `&mut tauri::App` in the `setup()` closure.
> **Note:** `src-tauri/.env` with `DATABASE_URL=sqlite:./dev.db` is required for sqlx compile-time macro checks.

Key tables: `projects` (one row per game+language), `entries` (all translatable strings with `order_index`, `status`, `file_path`).

### Cancel flag for batch translation

`Arc<AtomicBool>` managed via `tauri::State`, set by a cancel command, checked before each entry in `translate_batch`. Progress emitted via `window.emit("translation:progress", ...)`.

## TypeScript types

`src/types/index.ts` must mirror Rust structs exactly. Rust enums with `#[serde(rename_all = "snake_case")]` serialize as string literals (e.g. `'pending'`, `'translated'`). Enums with data serialize as `{ error: string }` / `{ warning: string }`.

## Adding packages

```bash
# Tauri official plugins (handles Cargo.toml + package.json + lib.rs registration)
pnpm tauri add <plugin>   # e.g. pnpm tauri add dialog

# Pure Rust crates (from src-tauri/)
cargo add <crate>

# Pure frontend packages
pnpm add <package>
```

## Docs

- `docs/CONTEXT.md` — full architecture reference, DB schema, struct definitions, engine details
- `docs/ENGINE_NOTES.md` and per-engine `ENGINE_NOTES.md` — update after testing on real games
- `docs/PRD.md` — product requirements
- `docs/superpowers/plans/` — implementation plans (writing-plans format) with TDD steps, exact code, and commit checkpoints
