# Wolf RPG Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support Wolf RPG games by calling UberWolf and WolfTL sidecar executables to decrypt, dump, translate, and re-patch game files.

**Architecture:** Two Windows EXE sidecars (`UberWolf.exe`, `WolfTL.exe`) are bundled in `src-tauri/bin/` with target-triple suffixes. Rust calls them via `tauri-plugin-shell`. On Linux, Wine runs the EXEs transparently. Wolf RPG text uses Shift-JIS encoding decoded via `encoding_rs`. The `WolfRpgEngine` implements the `GameEngine` trait.

**Tech Stack:** tauri-plugin-shell, tauri-plugin-process, encoding_rs, Wine (Linux)

---

## ⚠️ PREREQUISITE

**Start ONLY after STEP-05 (RPG Maker extractor) and STEP-07 (injection/export) are 100% functional and tested on real games.**

---

## Packages to Add

```bash
pnpm tauri add shell
pnpm tauri add process

# From src-tauri/
cargo add encoding_rs
```

---

## File Structure

- Modify: `src-tauri/tauri.conf.json` — add `bundle.externalBin` for sidecars
- Modify: `src-tauri/capabilities/default.json` — add shell:default, process:default
- Create: `src-tauri/bin/WolfTL-x86_64-pc-windows-msvc.exe` — (place binary manually)
- Create: `src-tauri/bin/UberWolf-x86_64-pc-windows-msvc.exe` — (place binary manually)
- Create: `src-tauri/src/engines/wolf_rpg/mod.rs` — implements GameEngine trait, detect()
- Create: `src-tauri/src/engines/wolf_rpg/sidecar.rs` — calls UberWolf + WolfTL
- Create: `src-tauri/src/engines/wolf_rpg/placeholders.rs` — Wolf codes ↔ {{NAME}}
- Create: `src-tauri/src/engines/wolf_rpg/skip.rs` — Wolf skip + delegates to common
- Create: `src-tauri/src/engines/wolf_rpg/ENGINE_NOTES.md`
- Modify: `src-tauri/src/engines/mod.rs` — add pub mod wolf_rpg
- Modify: `src-tauri/src/commands/project.rs` — add WolfRpg engine detection

---

## Task 1: Install Packages + Configure Sidecars

- [ ] **Step 1: Add plugins**

```bash
pnpm tauri add shell
pnpm tauri add process
```

- [ ] **Step 2: Add encoding_rs**

```bash
cd src-tauri && cargo add encoding_rs
```

- [ ] **Step 3: Verify capabilities**

```bash
grep -E "shell|process" src-tauri/capabilities/default.json
```
Expected: `"shell:default"` and `"process:default"` present

- [ ] **Step 4: Add externalBin to tauri.conf.json**

```json
// src-tauri/tauri.conf.json — add/update bundle section:
"bundle": {
  "externalBin": [
    "bin/WolfTL",
    "bin/UberWolf"
  ]
}
```

- [ ] **Step 5: Place sidecar binaries**

```bash
# Place binaries in src-tauri/bin/ with target-triple suffix
ls src-tauri/bin/
# Expected: WolfTL-x86_64-pc-windows-msvc.exe, UberWolf-x86_64-pc-windows-msvc.exe
```

> ℹ️ The `.exe` files are Windows binaries. On Linux, Tauri/Wine runs them transparently when called via `tauri-plugin-shell`. The target-triple suffix is mandatory for Tauri to bundle them.

- [ ] **Step 6: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src-tauri/tauri.conf.json src-tauri/capabilities/ src-tauri/Cargo.toml
git commit -m "chore: add shell, process plugins and configure Wolf RPG sidecars"
```

---

## Task 2: Wolf RPG Detection

**Files:**
- Create: `src-tauri/src/engines/wolf_rpg/mod.rs`
- Modify: `src-tauri/src/engines/mod.rs`

- [ ] **Step 1: Write the failing tests**

```rust
// src-tauri/src/engines/wolf_rpg/mod.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_false_for_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!detect(dir.path()));
    }

    #[test]
    fn test_detect_true_when_wolf_structure_present() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("Game.exe"), b"").unwrap();
        std::fs::create_dir_all(dir.path().join("Data/BasicData")).unwrap();
        assert!(detect(dir.path()));
    }

    #[test]
    fn test_not_wolf_without_basic_data() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("Game.exe"), b"").unwrap();
        // No Data/BasicData
        assert!(!detect(dir.path()));
    }
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd src-tauri && cargo test test_detect_false_for_empty test_detect_true_when_wolf test_not_wolf`
Expected: FAIL

- [ ] **Step 3: Implement mod.rs**

```rust
// src-tauri/src/engines/wolf_rpg/mod.rs
pub mod sidecar;
pub mod placeholders;
pub mod skip;

pub fn detect(game_dir: &std::path::Path) -> bool {
    game_dir.join("Game.exe").exists()
        && game_dir.join("Data/BasicData").exists()
}
```

- [ ] **Step 4: Update engines/mod.rs**

```rust
// src-tauri/src/engines/mod.rs — add
pub mod wolf_rpg;
```

- [ ] **Step 5: Run tests**

Run: `cd src-tauri && cargo test test_detect_false_for_empty test_detect_true_when_wolf test_not_wolf`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/engines/wolf_rpg/mod.rs src-tauri/src/engines/mod.rs
git commit -m "feat: add Wolf RPG engine detection"
```

---

## Task 3: Wolf RPG skip.rs

**Files:**
- Create: `src-tauri/src/engines/wolf_rpg/skip.rs`

- [ ] **Step 1: Write the failing tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_delegates_to_common() {
        assert!(should_skip(""));
        assert!(should_skip("Hello"));
    }

    #[test]
    fn test_skip_wolf_db_reference() {
        // Wolf RPG internal database references should be skipped
        assert!(should_skip("cdb[sdb:0:0]"));
    }

    #[test]
    fn test_keep_japanese() {
        assert!(!should_skip("勇者よ、立ち上がれ！"));
    }
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd src-tauri && cargo test test_delegates_to_common test_skip_wolf test_keep_japanese`
Expected: FAIL

- [ ] **Step 3: Implement**

```rust
// src-tauri/src/engines/wolf_rpg/skip.rs
use crate::engines::common::skip as common_skip;

pub fn should_skip(text: &str) -> bool {
    if common_skip::should_skip(text) {
        return true;
    }
    is_wolf_db_reference(text)
}

fn is_wolf_db_reference(text: &str) -> bool {
    // Wolf RPG internal DB lookup syntax
    text.contains("cdb[") || text.starts_with("sdb:")
}
```

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test test_delegates_to_common test_skip_wolf test_keep_japanese`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/engines/wolf_rpg/skip.rs
git commit -m "feat: add Wolf RPG skip.rs"
```

---

## Task 4: Wolf RPG placeholders.rs

**Files:**
- Create: `src-tauri/src/engines/wolf_rpg/placeholders.rs`

- [ ] **Step 1: Write the failing tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_self_var() {
        assert_eq!(encode(r"\self[1]"), "{{SELF_VAR[1]}}");
    }

    #[test]
    fn test_decode_self_var() {
        let (decoded, intact) = decode("{{SELF_VAR[1]}}");
        assert_eq!(decoded, r"\self[1]");
        assert!(intact);
    }

    #[test]
    fn test_roundtrip_no_codes() {
        let text = "ゲームオーバー";
        let encoded = encode(text);
        assert_eq!(encoded, text);
        let (decoded, intact) = decode(&encoded);
        assert_eq!(decoded, text);
        assert!(intact);
    }
}
```

- [ ] **Step 2: Run to verify fail**

Run: `cd src-tauri && cargo test test_encode_self_var test_decode_self_var`
Expected: FAIL

- [ ] **Step 3: Implement**

```rust
// src-tauri/src/engines/wolf_rpg/placeholders.rs
// Wolf RPG uses \self[n] for self variables and \cdb[...] for DB references

pub fn encode(text: &str) -> String {
    let mut s = text.to_string();
    // \self[n] → {{SELF_VAR[n]}}
    let re = regex::Regex::new(r"\\self\[(\d+)\]").unwrap();
    s = re.replace_all(&s, "{{SELF_VAR[$1]}}").into_owned();
    s
}

pub fn decode(text: &str) -> (String, bool) {
    let mut s = text.to_string();
    let re = regex::Regex::new(r"\{\{SELF_VAR\[(\d+)\]\}\}").unwrap();
    s = re.replace_all(&s, r"\self[$1]").into_owned();
    let intact = !regex::Regex::new(r"\{\{[^}]+\}\}").unwrap().is_match(&s);
    (s, intact)
}

#[cfg(test)]
mod tests { /* see step 1 */ }
```

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test test_encode_self_var test_decode_self_var test_roundtrip_no_codes`
Expected: All PASS

> ℹ️ Update the placeholder table in `ENGINE_NOTES.md` after testing on a real Wolf RPG game.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/engines/wolf_rpg/placeholders.rs
git commit -m "feat: add Wolf RPG placeholder encode/decode"
```

---

## Task 5: Sidecar Calls

**Files:**
- Create: `src-tauri/src/engines/wolf_rpg/sidecar.rs`

- [ ] **Step 1: Write sidecar.rs**

```rust
// src-tauri/src/engines/wolf_rpg/sidecar.rs
use tauri_plugin_shell::ShellExt;
use std::path::Path;

/// Run UberWolf to decrypt the game files
pub async fn run_uberwolf(
    app: &tauri::AppHandle,
    game_dir: &Path,
    output_dir: &Path,
) -> anyhow::Result<()> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("UberWolf")?
        .args([
            game_dir.to_str().unwrap(),
            output_dir.to_str().unwrap(),
        ])
        .spawn()?;

    // Drain output to avoid blocking
    while let Some(event) = rx.recv().await {
        use tauri_plugin_shell::process::CommandEvent;
        match event {
            CommandEvent::Stderr(line) => {
                tracing::warn!("UberWolf stderr: {}", String::from_utf8_lossy(&line));
            }
            CommandEvent::Error(e) => {
                return Err(anyhow::anyhow!("UberWolf error: {}", e));
            }
            CommandEvent::Terminated(status) => {
                if status.code != Some(0) {
                    return Err(anyhow::anyhow!(
                        "UberWolf exited with code {:?}",
                        status.code
                    ));
                }
                break;
            }
            _ => {}
        }
    }
    Ok(())
}

/// Run WolfTL to dump game data to JSON
pub async fn run_wolftl_dump(
    app: &tauri::AppHandle,
    game_dir: &Path,
    json_output_dir: &Path,
) -> anyhow::Result<()> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("WolfTL")?
        .args(["dump", game_dir.to_str().unwrap(), json_output_dir.to_str().unwrap()])
        .spawn()?;

    while let Some(event) = rx.recv().await {
        use tauri_plugin_shell::process::CommandEvent;
        if let CommandEvent::Terminated(status) = event {
            if status.code != Some(0) {
                return Err(anyhow::anyhow!("WolfTL dump failed: code {:?}", status.code));
            }
            break;
        }
    }
    Ok(())
}

/// Run WolfTL to patch translated JSON back into game files
pub async fn run_wolftl_patch(
    app: &tauri::AppHandle,
    game_dir: &Path,
    json_dir: &Path,
    output_dir: &Path,
) -> anyhow::Result<()> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("WolfTL")?
        .args([
            "patch",
            game_dir.to_str().unwrap(),
            json_dir.to_str().unwrap(),
            output_dir.to_str().unwrap(),
        ])
        .spawn()?;

    while let Some(event) = rx.recv().await {
        use tauri_plugin_shell::process::CommandEvent;
        if let CommandEvent::Terminated(status) = event {
            if status.code != Some(0) {
                return Err(anyhow::anyhow!("WolfTL patch failed: code {:?}", status.code));
            }
            break;
        }
    }
    Ok(())
}
```

> ⚠️ Sidecar calls cannot be unit-tested without the actual binaries and a real game. Test manually with a Wolf RPG game after binaries are placed.

- [ ] **Step 2: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/engines/wolf_rpg/sidecar.rs
git commit -m "feat: add Wolf RPG sidecar calls (UberWolf + WolfTL)"
```

---

## Task 6: Wire Wolf RPG into Engine Detection + ENGINE_NOTES.md

**Files:**
- Modify: `src-tauri/src/commands/project.rs`
- Create: `src-tauri/src/engines/wolf_rpg/ENGINE_NOTES.md`

- [ ] **Step 1: Add Wolf RPG to engine detection in create_project**

```rust
// src-tauri/src/commands/project.rs — update engine detection:
use crate::engines::{rpgmaker_mv_mz, wolf_rpg};

let (engine_type, engine_str, game_title) = if rpgmaker_mv_mz::detect(game_path) {
    let title = rpgmaker_mv_mz::get_game_title(game_path).unwrap_or_else(|_| "Unknown".into());
    (EngineType::RpgmakerMvMz, "rpgmaker_mv_mz", title)
} else if wolf_rpg::detect(game_path) {
    (EngineType::WolfRpg, "wolf_rpg", "Unknown".into()) // Wolf RPG title requires binary extraction
} else {
    return Err("Unsupported game engine".into());
};
```

- [ ] **Step 2: Create ENGINE_NOTES.md**

```markdown
# Wolf RPG Engine Notes

## Detection
- `Game.exe` must exist in game root
- `Data/BasicData/` folder must exist

## Pipeline
1. UberWolf.exe — decrypt encrypted .wolf files
2. WolfTL.exe dump — extract text to JSON
3. Translate via Ollama
4. WolfTL.exe patch — inject translations back

## Text Encoding
- Source files: Shift-JIS
- Use `encoding_rs::SHIFT_JIS` to decode before processing

## Known placeholder codes
| Wolf RPG | Encoded |
|----------|---------|
| `\self[n]` | `{{SELF_VAR[n]}}` |

> Update after testing on a real Wolf RPG game

## Tested on
<!-- Update after each real game test -->
- [ ] Wolf RPG game (name: )

## Linux notes
- Requires Wine installed and in PATH
- Tauri-plugin-shell invokes sidecars; Wine intercepts .exe automatically on Linux
```

- [ ] **Step 3: Compile check**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/project.rs src-tauri/src/engines/wolf_rpg/ENGINE_NOTES.md
git commit -m "feat: add Wolf RPG engine to detection pipeline"
```
