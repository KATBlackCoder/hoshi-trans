# File Import — Project Creation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** "Open a game" button opens a native folder picker, auto-detects the game engine, creates a project in SQLite, and writes `hoshi-trans.json` into the game folder.

**Architecture:** Rust handles all engine detection, DB writes, and JSON file creation. React uses `@tauri-apps/plugin-dialog` for the folder picker and calls `invoke('open_project')` or `invoke('create_project')`. The `GameEngine` trait defines the contract for all engine modules. Read-only game folders fall back to storing the JSON in `app_data_dir`.

**Tech Stack:** Tauri v2, tauri-plugin-dialog, tauri-plugin-fs, tauri-plugin-single-instance, async-trait, walkdir, thiserror

---

## Packages to Add

```bash
# Tauri plugins (handles Cargo.toml + package.json + capabilities in one command)
pnpm tauri add dialog
pnpm tauri add fs
pnpm tauri add single-instance

# Pure Rust crates (from src-tauri/)
cargo add walkdir
cargo add thiserror
cargo add async-trait
```

> ⚠️ `single-instance` has no JS package. After `pnpm tauri add single-instance`, manually update lib.rs:
> ```rust
> .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
>     let _ = app.get_webview_window("main").map(|w| w.set_focus());
> }))
> ```

---

## File Structure

- Create: `src-tauri/src/engines/mod.rs` — `GameEngine` trait
- Create: `src-tauri/src/engines/rpgmaker_mv_mz/mod.rs` — RPG Maker detect() impl
- Create: `src-tauri/src/commands/project.rs` — `create_project`, `get_projects`, `open_project`
- Modify: `src-tauri/src/commands/mod.rs` — add pub mod project
- Modify: `src-tauri/src/lib.rs` — register project commands + single-instance plugin
- Create: `src/features/file-import/FileImportButton.tsx` — folder picker button
- Create: `src/features/file-import/index.ts` — re-export
- Modify: `src/hooks/useProject.ts` — invoke wrapper for project commands
- Modify: `src/App.tsx` — add FileImportButton to sidebar

---

## Task 1: Install Packages

- [x] **Step 1: Add Tauri plugins**

```bash
pnpm tauri add dialog
pnpm tauri add fs
pnpm tauri add single-instance
```

- [x] **Step 2: Add Rust crates**

```bash
cd src-tauri
cargo add walkdir
cargo add thiserror
cargo add async-trait
```

- [x] **Step 3: Verify capabilities added**

```bash
grep -E "dialog|fs:default" src-tauri/capabilities/default.json
```
Expected: Both permissions present

- [x] **Step 4: Update lib.rs for single-instance**

```rust
// In lib.rs setup chain, add before .invoke_handler:
.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
    let _ = app.get_webview_window("main").map(|w| w.set_focus());
}))
```

- [x] **Step 5: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [x] **Step 6: Commit**

```bash
git add src-tauri/ package.json pnpm-lock.yaml
git commit -m "chore: add dialog, fs, single-instance plugins + walkdir, thiserror, async-trait"
```

---

## Task 2: GameEngine Trait

**Files:**
- Create: `src-tauri/src/engines/mod.rs`
- Create: `src-tauri/src/engines/rpgmaker_mv_mz/mod.rs`

- [x] **Step 1: Write the failing test**

```rust
// src-tauri/src/engines/rpgmaker_mv_mz/mod.rs — add at bottom
#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_detect_returns_false_for_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!detect(dir.path()));
    }

    #[test]
    fn test_detect_returns_true_when_system_json_exists() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("data")).unwrap();
        std::fs::write(dir.path().join("data/System.json"), r#"{"gameTitle":"Test"}"#).unwrap();
        assert!(detect(dir.path()));
    }
}
```

- [x] **Step 2: Run to verify it fails**

Run: `cd src-tauri && cargo test test_detect_returns`
Expected: FAIL — module not found

- [x] **Step 3: Write engines/mod.rs**

```rust
// src-tauri/src/engines/mod.rs
pub mod common;
pub mod rpgmaker_mv_mz;

use crate::models::TranslationEntry;

#[async_trait::async_trait]
pub trait GameEngine {
    fn detect(game_dir: &std::path::Path) -> bool;
    async fn extract(game_dir: &std::path::Path) -> anyhow::Result<Vec<TranslationEntry>>;
    async fn inject(
        game_dir: &std::path::Path,
        entries: &[TranslationEntry],
        output_dir: &std::path::Path,
    ) -> anyhow::Result<()>;
}
```

- [x] **Step 4: Write rpgmaker_mv_mz/mod.rs**

```rust
// src-tauri/src/engines/rpgmaker_mv_mz/mod.rs
pub fn detect(game_dir: &std::path::Path) -> bool {
    game_dir.join("data/System.json").exists()
}

pub fn get_game_title(game_dir: &std::path::Path) -> anyhow::Result<String> {
    let path = game_dir.join("data/System.json");
    let content = std::fs::read_to_string(path)?;
    let json: serde_json::Value = serde_json::from_str(&content)?;
    Ok(json["gameTitle"]
        .as_str()
        .unwrap_or("Unknown")
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_returns_false_for_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!detect(dir.path()));
    }

    #[test]
    fn test_detect_returns_true_when_system_json_exists() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("data")).unwrap();
        std::fs::write(
            dir.path().join("data/System.json"),
            r#"{"gameTitle":"テストゲーム"}"#,
        )
        .unwrap();
        assert!(detect(dir.path()));
    }

    #[test]
    fn test_get_game_title() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("data")).unwrap();
        std::fs::write(
            dir.path().join("data/System.json"),
            r#"{"gameTitle":"テストゲーム"}"#,
        )
        .unwrap();
        assert_eq!(get_game_title(dir.path()).unwrap(), "テストゲーム");
    }
}
```

- [x] **Step 5: Create engines/common/mod.rs placeholder**

```rust
// src-tauri/src/engines/common/mod.rs
// Populated in STEP-05
```

- [x] **Step 6: Add engines mod to lib.rs**

```rust
// src-tauri/src/lib.rs — add
mod engines;
```

- [x] **Step 7: Run tests**

Run: `cd src-tauri && cargo test test_detect`
Expected: PASS

- [x] **Step 8: Commit**

```bash
git add src-tauri/src/engines/
git commit -m "feat: add GameEngine trait and RPG Maker MV/MZ detect()"
```

---

## Task 3: Project DB Queries

**Files:**
- Modify: `src-tauri/src/db/queries.rs`

- [x] **Step 1: Write the failing test**

```rust
// src-tauri/src/db/queries.rs — add at bottom
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_pool;

    #[tokio::test]
    async fn test_create_and_get_project() {
        let dir = tempfile::tempdir().unwrap();
        let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();

        create_project(
            &pool,
            "proj-1",
            "/games/mygame",
            "rpgmaker_mv_mz",
            "My Game",
            "en",
            None,
        )
        .await
        .unwrap();

        let projects = get_projects(&pool).await.unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].0, "proj-1");
    }
}
```

- [x] **Step 2: Run to verify it fails**

Run: `cd src-tauri && cargo test test_create_and_get_project`
Expected: FAIL

- [x] **Step 3: Implement queries**

```rust
// src-tauri/src/db/queries.rs
use sqlx::SqlitePool;

pub async fn create_project(
    pool: &SqlitePool,
    id: &str,
    game_dir: &str,
    engine: &str,
    game_title: &str,
    target_lang: &str,
    json_path: Option<&str>,
) -> anyhow::Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;
    sqlx::query!(
        "INSERT INTO projects (id, game_dir, engine, game_title, target_lang, json_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        id, game_dir, engine, game_title, target_lang, json_path, now, now
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Returns (id, game_dir, engine, game_title, target_lang, json_path)
pub async fn get_projects(pool: &SqlitePool) -> anyhow::Result<Vec<(String, String, String, String, String, Option<String>)>> {
    let rows = sqlx::query!(
        "SELECT id, game_dir, engine, game_title, target_lang, json_path FROM projects ORDER BY updated_at DESC"
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|r| (r.id, r.game_dir, r.engine, r.game_title, r.target_lang, r.json_path)).collect())
}

pub async fn get_project_by_game_dir(pool: &SqlitePool, game_dir: &str) -> anyhow::Result<Option<(String, String, String, String, Option<String>)>> {
    let row = sqlx::query!(
        "SELECT id, engine, game_title, target_lang, json_path FROM projects WHERE game_dir = ?",
        game_dir
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|r| (r.id, r.engine, r.game_title, r.target_lang, r.json_path)))
}
```

- [x] **Step 4: Run tests**

Run: `cd src-tauri && cargo test test_create_and_get_project`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/db/queries.rs
git commit -m "feat: add create_project and get_projects DB queries"
```

---

## Task 4: Project Commands

**Files:**
- Create: `src-tauri/src/commands/project.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [x] **Step 1: Write project.rs commands**

```rust
// src-tauri/src/commands/project.rs
use sqlx::SqlitePool;
use uuid::Uuid;
use crate::db::queries;
use crate::engines::rpgmaker_mv_mz;
use crate::models::{ProjectFile, ProjectStats, EngineType};

fn build_project_file(
    project_id: &str,
    game_dir: &str,
    engine: EngineType,
    game_title: &str,
    target_lang: &str,
    app_data_dir: &str,
) -> ProjectFile {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    ProjectFile {
        version: "1".into(),
        project_id: project_id.into(),
        created_at: now,
        updated_at: now,
        game_dir: game_dir.into(),
        engine,
        game_title: game_title.into(),
        target_lang: target_lang.into(),
        stats: ProjectStats::default(),
        last_model: None,
        output_dir: format!("{}/hoshi-trans-output", game_dir),
    }
}

fn write_project_file(project: &ProjectFile, game_dir: &str, app_data_dir: &str) -> anyhow::Result<Option<String>> {
    let json = serde_json::to_string_pretty(project)?;
    let local_path = std::path::Path::new(game_dir).join("hoshi-trans.json");
    match std::fs::write(&local_path, &json) {
        Ok(_) => Ok(None), // written locally, no fallback path needed
        Err(_) => {
            // Game dir is read-only — write to app_data_dir
            let fallback_dir = std::path::Path::new(app_data_dir).join("projects");
            std::fs::create_dir_all(&fallback_dir)?;
            let fallback_path = fallback_dir.join(format!("{}.json", project.project_id));
            std::fs::write(&fallback_path, &json)?;
            Ok(Some(fallback_path.to_string_lossy().to_string()))
        }
    }
}

#[tauri::command]
pub async fn create_project(
    pool: tauri::State<'_, SqlitePool>,
    app: tauri::AppHandle,
    game_dir: String,
    target_lang: String,
) -> Result<ProjectFile, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    let game_path = std::path::Path::new(&game_dir);

    // Detect engine
    let (engine_type, engine_str, game_title) = if rpgmaker_mv_mz::detect(game_path) {
        let title = rpgmaker_mv_mz::get_game_title(game_path)
            .unwrap_or_else(|_| "Unknown".into());
        (EngineType::RpgmakerMvMz, "rpgmaker_mv_mz", title)
    } else {
        return Err("Unsupported game engine — no recognized game files found".into());
    };

    let project_id = Uuid::new_v4().to_string();
    let project = build_project_file(&project_id, &game_dir, engine_type, &game_title, &target_lang, &app_data_dir);

    // Write hoshi-trans.json
    let json_path = write_project_file(&project, &game_dir, &app_data_dir)
        .map_err(|e| e.to_string())?;

    // Insert in DB
    queries::create_project(
        &pool,
        &project_id,
        &game_dir,
        &engine_str,
        &game_title,
        &target_lang,
        json_path.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(project)
}

#[tauri::command]
pub async fn open_project(
    pool: tauri::State<'_, SqlitePool>,
    app: tauri::AppHandle,
    game_dir: String,
) -> Result<ProjectFile, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    // Try to read hoshi-trans.json
    let local_json = std::path::Path::new(&game_dir).join("hoshi-trans.json");
    if local_json.exists() {
        let content = std::fs::read_to_string(&local_json).map_err(|e| e.to_string())?;
        let project: ProjectFile = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        return Ok(project);
    }

    // No json found — treat as new project (default to 'en')
    create_project(pool, app, game_dir, "en".into()).await
}

#[tauri::command]
pub async fn get_projects(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Vec<serde_json::Value>, String> {
    let rows = queries::get_projects(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let result = rows
        .into_iter()
        .map(|(id, game_dir, engine, game_title, target_lang, json_path)| {
            serde_json::json!({
                "id": id,
                "game_dir": game_dir,
                "engine": engine,
                "game_title": game_title,
                "target_lang": target_lang,
                "json_path": json_path,
            })
        })
        .collect();
    Ok(result)
}
```

- [x] **Step 2: Update commands/mod.rs**

```rust
// src-tauri/src/commands/mod.rs
pub mod ollama;
pub mod project;
```

- [x] **Step 3: Register in lib.rs**

```rust
// lib.rs — update invoke_handler
.invoke_handler(tauri::generate_handler![
    commands::ollama::check_ollama,
    commands::ollama::list_models,
    commands::project::create_project,
    commands::project::open_project,
    commands::project::get_projects,
])
```

- [x] **Step 4: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/commands/
git commit -m "feat: add create_project, open_project, get_projects commands"
```

---

## Task 5: Frontend FileImportButton

**Files:**
- Create: `src/features/file-import/FileImportButton.tsx`
- Create: `src/features/file-import/index.ts`
- Modify: `src/hooks/useProject.ts`

- [x] **Step 1: Write useProject hook**

```ts
// src/hooks/useProject.ts
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useMutation } from '@tanstack/react-query'
import type { ProjectFile } from '@/types'

export function useOpenProject() {
  return useMutation({
    mutationFn: async (): Promise<ProjectFile | null> => {
      const dir = await open({ directory: true, multiple: false })
      if (!dir) return null
      return invoke<ProjectFile>('open_project', { gameDir: dir })
    },
  })
}
```

- [x] **Step 2: Write FileImportButton**

```tsx
// src/features/file-import/FileImportButton.tsx
import { useOpenProject } from '@/hooks/useProject'
import { Button } from '@/components/ui/button'
import { FolderOpen } from 'lucide-react'

export function FileImportButton() {
  const { mutate, isPending, error } = useOpenProject()

  return (
    <div>
      <Button
        onClick={() => mutate()}
        disabled={isPending}
        variant="outline"
        className="w-full"
      >
        <FolderOpen className="mr-2 h-4 w-4" />
        {isPending ? 'Opening…' : 'Open a game'}
      </Button>
      {error && (
        <p className="mt-2 text-xs text-destructive">{error.message}</p>
      )}
    </div>
  )
}
```

```ts
// src/features/file-import/index.ts
export { FileImportButton } from './FileImportButton'
```

- [x] **Step 3: Add to App.tsx sidebar**

```tsx
// src/App.tsx — in MainLayout sidebar
import { FileImportButton } from '@/features/file-import'

function MainLayout() {
  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r p-4 flex flex-col gap-4">
        <p className="font-semibold">hoshi-trans</p>
        <FileImportButton />
      </aside>
      <main className="flex-1 p-6">
        <p className="text-muted-foreground">Select a game to get started.</p>
      </main>
    </div>
  )
}
```

- [x] **Step 4: Test in app**

Run: `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev`
Expected:
- Click "Open a game" → native folder picker opens
- Select an RPG Maker MV/MZ game folder → `hoshi-trans.json` created in game folder
- Select unsupported folder → error message shown below button

- [x] **Step 5: Commit**

```bash
git add src/features/file-import/ src/hooks/useProject.ts src/App.tsx
git commit -m "feat: add FileImportButton with native folder picker and engine detection"
```
