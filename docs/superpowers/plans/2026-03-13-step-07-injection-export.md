# Injection / Export RPG Maker MV/MZ Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate translated JSON game files in `hoshi-trans-output/` (non-destructive), decode all placeholders back to RPG Maker codes before writing, and allow the user to open the output folder from the UI.

**Architecture:** `rpgmaker_mv_mz/injector.rs` reads entries ordered by `(file_path, order_index)` from DB, loads original JSON files, substitutes translations, decodes placeholders, and writes to `output_dir/data/`. React calls `inject_translations` then uses `tauri-plugin-opener` to open the folder. Original game files are never modified.

**Tech Stack:** Rust, serde_json, sqlx, tauri-plugin-opener

---

## No New Packages

- `tauri-plugin-opener` already present from STEP-01

---

## File Structure

- Create: `src-tauri/src/engines/rpgmaker_mv_mz/injector.rs` — JSON reconstruction + placeholder decode
- Create: `src-tauri/src/commands/inject.rs` — `inject_translations` command
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/db/queries.rs` — add `get_entries_ordered` for injection
- Create: `src/features/file-export/ExportButton.tsx` — export + open output folder
- Create: `src/features/file-export/index.ts`

---

## Task 1: get_entries_ordered DB Query

**Files:**
- Modify: `src-tauri/src/db/queries.rs`

- [ ] **Step 1: Write the failing test**

```rust
#[tokio::test]
async fn test_get_entries_ordered_preserves_order() {
    let dir = tempfile::tempdir().unwrap();
    let pool = init_pool(dir.path().to_str().unwrap()).await.unwrap();
    create_project(&pool, "p1", "/g", "rpgmaker_mv_mz", "T", "en", None).await.unwrap();

    // Insert entries out of order
    sqlx::query!(
        "INSERT INTO entries (id,project_id,source_text,translation,status,file_path,order_index)
         VALUES ('e2','p1','b','B','translated','data/Map001.json',1)"
    ).execute(&pool).await.unwrap();
    sqlx::query!(
        "INSERT INTO entries (id,project_id,source_text,translation,status,file_path,order_index)
         VALUES ('e1','p1','a','A','translated','data/Map001.json',0)"
    ).execute(&pool).await.unwrap();

    let entries = get_translated_entries_ordered(&pool, "p1").await.unwrap();
    assert_eq!(entries[0].order_index, 0);
    assert_eq!(entries[1].order_index, 1);
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd src-tauri && cargo test test_get_entries_ordered`
Expected: FAIL

- [ ] **Step 3: Implement**

```rust
// src-tauri/src/db/queries.rs — add
pub async fn get_translated_entries_ordered(
    pool: &SqlitePool,
    project_id: &str,
) -> anyhow::Result<Vec<crate::models::TranslationEntry>> {
    let rows = sqlx::query_as!(
        crate::models::TranslationEntry,
        r#"SELECT id, project_id, source_text, translation, status, context, file_path, order_index
           FROM entries
           WHERE project_id = ?
           AND status IN ('translated', 'reviewed', 'warning')
           ORDER BY file_path, order_index"#,
        project_id,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}
```

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test test_get_entries_ordered`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/db/queries.rs
git commit -m "feat: add get_translated_entries_ordered query"
```

---

## Task 2: rpgmaker_mv_mz/injector.rs

**Files:**
- Create: `src-tauri/src/engines/rpgmaker_mv_mz/injector.rs`
- Modify: `src-tauri/src/engines/rpgmaker_mv_mz/mod.rs`

- [ ] **Step 1: Write failing test for a simple injection**

```rust
// src-tauri/src/engines/rpgmaker_mv_mz/injector.rs — add at bottom
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inject_dialogue_replaces_text() {
        let mut json = serde_json::json!({
            "events": [{
                "pages": [{
                    "list": [
                        {"code": 401, "parameters": ["こんにちは"]},
                        {"code": 401, "parameters": ["さようなら"]}
                    ]
                }]
            }]
        });

        let translations = vec![
            ("こんにちは", "Hello"),
            ("さようなら", "Goodbye"),
        ];

        inject_map_translations(&mut json, &translations);

        assert_eq!(json["events"][0]["pages"][0]["list"][0]["parameters"][0], "Hello");
        assert_eq!(json["events"][0]["pages"][0]["list"][1]["parameters"][0], "Goodbye");
    }
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd src-tauri && cargo test test_inject_dialogue`
Expected: FAIL

- [ ] **Step 3: Implement injector.rs**

```rust
// src-tauri/src/engines/rpgmaker_mv_mz/injector.rs
use crate::engines::rpgmaker_mv_mz::placeholders;
use crate::models::TranslationEntry;
use std::collections::HashMap;
use std::path::Path;

/// Inject translations into all RPG Maker JSON files, write to output_dir
pub async fn inject(
    game_dir: &Path,
    entries: &[TranslationEntry],
    output_dir: &Path,
) -> anyhow::Result<()> {
    // Group entries by file_path
    let mut by_file: HashMap<&str, Vec<&TranslationEntry>> = HashMap::new();
    for entry in entries {
        by_file.entry(&entry.file_path).or_default().push(entry);
    }

    // Ensure each file's entries are sorted by order_index
    for entries in by_file.values_mut() {
        entries.sort_by_key(|e| e.order_index);
    }

    let data_dir = game_dir.join("data");
    let out_data_dir = output_dir.join("data");
    std::fs::create_dir_all(&out_data_dir)?;

    for entry in std::fs::read_dir(&data_dir)? {
        let path = entry?.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let filename = path.file_name().unwrap().to_string_lossy().to_string();
        let file_rel = format!("data/{}", filename);

        let content = std::fs::read_to_string(&path)?;
        let mut json: serde_json::Value = serde_json::from_str(&content)?;

        if let Some(file_entries) = by_file.get(file_rel.as_str()) {
            let translations: Vec<(&str, &str)> = file_entries
                .iter()
                .filter_map(|e| e.translation.as_deref().map(|t| (e.source_text.as_str(), t)))
                .collect();

            if filename.starts_with("Map") && filename != "MapInfos.json" {
                inject_map_translations(&mut json, &translations);
            } else {
                inject_database_translations(&mut json, &translations);
            }
        }

        let out_path = out_data_dir.join(&filename);
        let out_content = serde_json::to_string_pretty(&json)?;
        std::fs::write(out_path, out_content)?;
    }

    Ok(())
}

pub fn inject_map_translations(json: &mut serde_json::Value, translations: &[(&str, &str)]) {
    let mut trans_iter = translations.iter();

    if let Some(events) = json["events"].as_array_mut() {
        for event in events.iter_mut().filter(|e| !e.is_null()) {
            if let Some(pages) = event["pages"].as_array_mut() {
                for page in pages.iter_mut() {
                    if let Some(list) = page["list"].as_array_mut() {
                        for cmd in list.iter_mut() {
                            let code = cmd["code"].as_i64().unwrap_or(0);
                            if matches!(code, 401 | 405 | 102) {
                                if let Some(t) = trans_iter.next() {
                                    let decoded = placeholders::decode(t.1).0;
                                    cmd["parameters"][0] = serde_json::Value::String(decoded);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

pub fn inject_database_translations(json: &mut serde_json::Value, translations: &[(&str, &str)]) {
    let mut trans_iter = translations.iter();
    if let Some(items) = json.as_array_mut() {
        for item in items.iter_mut().filter(|i| !i.is_null()) {
            for field in &["name", "description", "message1", "message2", "message3", "message4"] {
                if item[field].as_str().is_some() {
                    if let Some(t) = trans_iter.next() {
                        let decoded = placeholders::decode(t.1).0;
                        item[*field] = serde_json::Value::String(decoded);
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 4: Update rpgmaker_mv_mz/mod.rs**

```rust
// add
pub mod injector;
```

- [ ] **Step 5: Run tests**

Run: `cd src-tauri && cargo test test_inject_dialogue`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/engines/rpgmaker_mv_mz/injector.rs
git commit -m "feat: add RPG Maker injector with placeholder decode"
```

---

## Task 3: inject_translations Command

**Files:**
- Create: `src-tauri/src/commands/inject.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write inject.rs**

```rust
// src-tauri/src/commands/inject.rs
use sqlx::SqlitePool;
use crate::db::queries;
use crate::engines::rpgmaker_mv_mz::injector;

#[tauri::command]
pub async fn inject_translations(
    pool: tauri::State<'_, SqlitePool>,
    project_id: String,
    game_dir: String,
    output_dir: String,
) -> Result<(), String> {
    let entries = queries::get_translated_entries_ordered(&pool, &project_id)
        .await
        .map_err(|e| e.to_string())?;

    let game_path = std::path::Path::new(&game_dir);
    let out_path = std::path::Path::new(&output_dir);

    injector::inject(game_path, &entries, out_path)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

- [ ] **Step 2: Update mod.rs and lib.rs**

```rust
// commands/mod.rs
pub mod inject;

// lib.rs invoke_handler
commands::inject::inject_translations,
```

- [ ] **Step 3: Compile check**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/inject.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add inject_translations Tauri command"
```

---

## Task 4: Frontend ExportButton

**Files:**
- Create: `src/features/file-export/ExportButton.tsx`
- Create: `src/features/file-export/index.ts`

- [ ] **Step 1: Write ExportButton**

```tsx
// src/features/file-export/ExportButton.tsx
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { FolderOpen } from 'lucide-react'

interface Props {
  projectId: string
  gameDir: string
  outputDir: string
}

export function ExportButton({ projectId, gameDir, outputDir }: Props) {
  const { mutate, isPending, isSuccess, error } = useMutation({
    mutationFn: async () => {
      await invoke('inject_translations', { projectId, gameDir, outputDir })
      await openUrl(outputDir)
    },
  })

  return (
    <div>
      <Button onClick={() => mutate()} disabled={isPending}>
        <FolderOpen className="mr-2 h-4 w-4" />
        {isPending ? 'Exporting…' : 'Export & open folder'}
      </Button>
      {isSuccess && (
        <p className="mt-1 text-xs text-green-600">
          Export complete — output folder opened.
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-destructive">{(error as Error).message}</p>
      )}
    </div>
  )
}
```

```ts
// src/features/file-export/index.ts
export { ExportButton } from './ExportButton'
```

- [ ] **Step 2: Add ExportButton to the translation view or sidebar**

Add `<ExportButton projectId={...} gameDir={...} outputDir={...} />` in the appropriate location in `App.tsx` or `TranslationView.tsx`.

- [ ] **Step 3: Test end-to-end**

Run: `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev`
Expected:
- After translation, click "Export & open folder"
- `hoshi-trans-output/data/` is created with translated JSON files
- File manager opens to that folder
- Original game `data/` folder is untouched
- Manually test: copy `hoshi-trans-output/data/` into game folder → game should launch with translated text

- [ ] **Step 4: Commit**

```bash
git add src/features/file-export/ src/App.tsx
git commit -m "feat: add ExportButton with inject_translations and folder opener"
```
