# SQLite Database Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Initialize SQLite connection pool with migrations at app startup and share it via `tauri::State`.

**Architecture:** `sqlx` (not `tauri-plugin-sql`) handles all DB access in Rust. The pool is initialized during `tauri::Builder::setup()` and managed as app state. React never touches SQLite — all DB operations go through Tauri commands.

**Tech Stack:** sqlx 0.8 (sqlite + runtime-tokio + macros), uuid v4, Rust async/tokio

---

## Packages to Add

```bash
# From src-tauri/
cargo add sqlx --features sqlite,runtime-tokio,macros
cargo add uuid --features v4,serde
```

Also create `src-tauri/.env` for sqlx compile-time checks:
```
DATABASE_URL=sqlite:./dev.db
```

---

## File Structure

- Create: `src-tauri/migrations/001_init.sql` — projects + entries tables + indexes
- Create: `src-tauri/src/db/mod.rs` — `init_pool()` function
- Create: `src-tauri/src/db/queries.rs` — placeholder file (populated in later steps)
- Create: `src-tauri/src/models/mod.rs` — pub mod declarations
- Create: `src-tauri/src/models/translation.rs` — TranslationEntry, TranslationStatus
- Create: `src-tauri/src/models/project.rs` — ProjectFile, ProjectStats, EngineType
- Modify: `src-tauri/src/lib.rs` — call init_pool() in setup, manage pool
- Create: `src-tauri/.env` — DATABASE_URL for sqlx macros

---

## Task 1: Install Packages + .env

**Files:** `src-tauri/Cargo.toml`, `src-tauri/.env`

- [x] **Step 1: Add crates**

```bash
cd src-tauri
cargo add sqlx --features sqlite,runtime-tokio,macros
cargo add uuid --features v4,serde
```

- [x] **Step 2: Create .env for sqlx compile-time checks**

```bash
# src-tauri/.env
DATABASE_URL=sqlite:./dev.db
```

- [x] **Step 3: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: Compiles (sqlx macros will use DATABASE_URL from .env)

- [x] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/.env
git commit -m "chore: add sqlx and uuid crates"
```

---

## Task 2: SQL Migration

**Files:**
- Create: `src-tauri/migrations/001_init.sql`

- [x] **Step 1: Write the migration**

```sql
-- src-tauri/migrations/001_init.sql

CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    game_dir    TEXT NOT NULL UNIQUE,
    engine      TEXT NOT NULL,
    game_title  TEXT NOT NULL,
    target_lang TEXT NOT NULL DEFAULT 'en',
    json_path   TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);
-- Note: json_path is NULL when hoshi-trans.json is in game_dir.
-- When game_dir is read-only, json_path stores the fallback location.

CREATE TABLE IF NOT EXISTS entries (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL,
    source_text  TEXT NOT NULL,
    translation  TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',
    context      TEXT,
    file_path    TEXT NOT NULL,
    order_index  INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
-- order_index is CRITICAL for injection — must preserve source file ordering

CREATE INDEX IF NOT EXISTS idx_entries_project_status ON entries(project_id, status);
CREATE INDEX IF NOT EXISTS idx_entries_order ON entries(project_id, file_path, order_index);
```

- [x] **Step 2: Commit**

```bash
git add src-tauri/migrations/
git commit -m "chore: add 001_init.sql migration"
```

---

## Task 3: DB Module

**Files:**
- Create: `src-tauri/src/db/mod.rs`
- Create: `src-tauri/src/db/queries.rs`

- [x] **Step 1: Write the failing test**

```rust
// src-tauri/src/db/mod.rs — add at bottom
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_init_pool_creates_tables() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_str().unwrap();
        let pool = init_pool(path).await.unwrap();

        // Verify tables exist
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('projects', 'entries')"
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(row.0, 2);
    }
}
```

> Note: add `tempfile` to dev dependencies: `cargo add --dev tempfile`

- [x] **Step 2: Run to verify it fails**

Run: `cd src-tauri && cargo test test_init_pool_creates_tables`
Expected: FAIL — `init_pool` not found

- [x] **Step 3: Implement db/mod.rs**

```rust
// src-tauri/src/db/mod.rs
pub mod queries;

use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};

pub async fn init_pool(app_data_dir: &str) -> anyhow::Result<SqlitePool> {
    let db_path = format!("{}/hoshi-trans.db", app_data_dir);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&format!("sqlite://{}?mode=rwc", db_path))
        .await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}
```

```rust
// src-tauri/src/db/queries.rs
// Populated in later steps
```

- [x] **Step 4: Add tempfile dev dependency**

```bash
cd src-tauri && cargo add --dev tempfile
```

- [x] **Step 5: Run tests**

Run: `cd src-tauri && cargo test test_init_pool_creates_tables`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add src-tauri/src/db/
git commit -m "feat: add init_pool with sqlx migrations"
```

---

## Task 4: Models

**Files:**
- Create: `src-tauri/src/models/mod.rs`
- Create: `src-tauri/src/models/translation.rs`
- Create: `src-tauri/src/models/project.rs`

- [x] **Step 1: Write models/translation.rs**

```rust
// src-tauri/src/models/translation.rs
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct TranslationEntry {
    pub id: String,
    pub project_id: String,
    pub source_text: String,
    pub translation: Option<String>,
    pub status: String, // stored as string in DB; use TranslationStatus for app logic
    pub context: Option<String>,
    pub file_path: String,
    pub order_index: i64, // CRITICAL for injection ordering
}

/// Rust enum for app logic — serialized as snake_case strings for IPC
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranslationStatus {
    Pending,
    Translated,
    Reviewed,
    Skipped,
    Error(String),
    Warning(String),
}

impl TranslationStatus {
    pub fn as_db_str(&self) -> String {
        match self {
            Self::Pending => "pending".into(),
            Self::Translated => "translated".into(),
            Self::Reviewed => "reviewed".into(),
            Self::Skipped => "skipped".into(),
            Self::Error(msg) => format!("error:{}", msg),
            Self::Warning(msg) => format!("warning:{}", msg),
        }
    }
}
```

- [x] **Step 2: Write models/project.rs**

```rust
// src-tauri/src/models/project.rs
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProjectFile {
    pub version: String,
    pub project_id: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub game_dir: String,
    pub engine: EngineType,
    pub game_title: String,
    pub target_lang: String,
    pub stats: ProjectStats,
    pub last_model: Option<String>,
    pub output_dir: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct ProjectStats {
    pub total: u32,
    pub translated: u32,
    pub reviewed: u32,
    pub skipped: u32,
    pub error: u32,
    pub pending: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EngineType {
    RpgmakerMvMz,
    WolfRpg,
    Bakin,
}

impl std::fmt::Display for EngineType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::RpgmakerMvMz => write!(f, "rpgmaker_mv_mz"),
            Self::WolfRpg => write!(f, "wolf_rpg"),
            Self::Bakin => write!(f, "bakin"),
        }
    }
}
```

- [x] **Step 3: Write models/mod.rs**

```rust
// src-tauri/src/models/mod.rs
pub mod translation;
pub mod project;

pub use translation::{TranslationEntry, TranslationStatus};
pub use project::{ProjectFile, ProjectStats, EngineType};
```

- [x] **Step 4: Write the failing test**

```rust
// src-tauri/src/models/translation.rs — add at bottom
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_serializes_to_snake_case() {
        let status = TranslationStatus::Pending;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, r#""pending""#);
    }

    #[test]
    fn test_error_status_serializes_with_data() {
        let status = TranslationStatus::Error("timeout".into());
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, r#"{"error":"timeout"}"#);
    }

    #[test]
    fn test_as_db_str() {
        assert_eq!(TranslationStatus::Pending.as_db_str(), "pending");
        assert_eq!(TranslationStatus::Error("x".into()).as_db_str(), "error:x");
    }
}
```

- [x] **Step 5: Add models mod to lib.rs**

```rust
// src-tauri/src/lib.rs — add
mod models;
mod db;
```

- [x] **Step 6: Run tests**

Run: `cd src-tauri && cargo test test_status_serializes`
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add src-tauri/src/models/
git commit -m "feat: add TranslationEntry, TranslationStatus, ProjectFile models"
```

---

## Task 5: Wire Pool into Tauri App

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [x] **Step 1: Update lib.rs to initialize pool on startup**

```rust
// src-tauri/src/lib.rs
mod commands;
mod db;
mod models;

use sqlx::SqlitePool;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()?
                .to_string_lossy()
                .to_string();
            let pool: SqlitePool = tauri::async_runtime::block_on(
                db::init_pool(&app_data_dir)
            )?;
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ollama::check_ollama,
            commands::ollama::list_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [x] **Step 2: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [x] **Step 3: Test in app**

Run: `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev`
Expected: App launches, no panics, DB file created in app_data_dir

- [x] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: initialize SQLite pool on app startup via tauri::State"
```
