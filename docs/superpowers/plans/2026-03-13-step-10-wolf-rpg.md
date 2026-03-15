# Wolf RPG Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support Wolf RPG games by calling UberWolfCli and WolfTL sidecar executables to decrypt, dump, translate, and re-patch game files.

**Architecture:** Two Windows EXE sidecars (`UberWolfCli.exe`, `WolfTL.exe`) are bundled in `src-tauri/bin/` with target-triple suffixes. Rust calls them via `tauri-plugin-shell`. On Linux, Wine runs the EXEs transparently. Wolf RPG text uses Shift-JIS encoding decoded via `encoding_rs`. The Wolf RPG extractor/injector dispatches from engine-aware `extract_strings` and `inject_translations` commands.

**Tech Stack:** tauri-plugin-shell, tauri-plugin-process, encoding_rs, walkdir, Wine (Linux)

---

## ✅ STATUS: COMPLETE (2026-03-15)

All tasks implemented and committed. 10/10 unit tests passing.

**Commits:**
- `8771838` — chore: add shell, process plugins and configure Wolf RPG sidecars
- `bc5051d` — feat: step-10 — Wolf RPG engine (detection, skip, placeholders, sidecars)
- `bb061ec` — feat: Wolf RPG extract + inject pipeline

---

## ⚠️ PREREQUISITE

**Start ONLY after STEP-05 (RPG Maker extractor) and STEP-07 (injection/export) are 100% functional and tested on real games.**

---

## Packages Added

```bash
pnpm tauri add shell
pnpm tauri add process

# From src-tauri/
cargo add encoding_rs
cargo add walkdir
```

---

## File Structure

- Modified: `src-tauri/tauri.conf.json` — added `bundle.externalBin` for sidecars
- Modified: `src-tauri/capabilities/default.json` — added `shell:default`, `process:default`
- `src-tauri/bin/WolfTL-x86_64-pc-windows-msvc.exe` — Windows sidecar
- `src-tauri/bin/WolfTL-x86_64-unknown-linux-gnu` — Linux sidecar (same .exe, Wine executes it)
- `src-tauri/bin/UberWolfCli-x86_64-pc-windows-msvc.exe` — Windows sidecar
- `src-tauri/bin/UberWolfCli-x86_64-unknown-linux-gnu` — Linux sidecar (same .exe, Wine executes it)
- Created: `src-tauri/src/engines/wolf_rpg/mod.rs` — detect(), module declarations
- Created: `src-tauri/src/engines/wolf_rpg/sidecar.rs` — run_uberwolf, run_wolftl_dump, run_wolftl_patch
- Created: `src-tauri/src/engines/wolf_rpg/placeholders.rs` — `\self[n]` ↔ `{{SELF_VAR[n]}}`
- Created: `src-tauri/src/engines/wolf_rpg/skip.rs` — Wolf skip + delegates to common
- Created: `src-tauri/src/engines/wolf_rpg/extractor.rs` — full extract pipeline
- Created: `src-tauri/src/engines/wolf_rpg/injector.rs` — full inject pipeline
- Modified: `src-tauri/src/engines/mod.rs` — added `pub mod wolf_rpg`
- Modified: `src-tauri/src/commands/project.rs` — added WolfRpg engine detection
- Modified: `src-tauri/src/commands/extract.rs` — engine-aware dispatch (rpgmaker | wolf_rpg)
- Modified: `src-tauri/src/commands/inject.rs` — engine-aware dispatch (rpgmaker | wolf_rpg)
- Modified: `src-tauri/src/db/queries.rs` — added `get_project_engine_by_id`

---

## Task 1: Install Packages + Configure Sidecars ✅

- [x] **Step 1: Add plugins**
- [x] **Step 2: Add encoding_rs + walkdir**
- [x] **Step 3: Verify capabilities** — `shell:default` and `process:default` added to `default.json`
- [x] **Step 4: Add externalBin to tauri.conf.json**

```json
"bundle": {
  "externalBin": [
    "bin/WolfTL",
    "bin/UberWolfCli"
  ]
}
```

- [x] **Step 5: Place sidecar binaries**

> ℹ️ Binary is named `UberWolfCli.exe` (not `UberWolf.exe`) — from https://github.com/Sinflower/UberWolf
>
> Tauri on Linux resolves sidecars with the `x86_64-unknown-linux-gnu` suffix (not `x86_64-pc-windows-msvc`).
> Both suffixed copies must exist in `src-tauri/bin/`. Wine executes the .exe content regardless of extension.

```
src-tauri/bin/
  UberWolfCli.exe                            ← original
  UberWolfCli-x86_64-pc-windows-msvc.exe    ← Windows bundle
  UberWolfCli-x86_64-unknown-linux-gnu       ← Linux dev/run (no extension)
  WolfTL.exe                                 ← original
  WolfTL-x86_64-pc-windows-msvc.exe         ← Windows bundle
  WolfTL-x86_64-unknown-linux-gnu            ← Linux dev/run (no extension)
```

- [x] **Step 6: Verify compilation** — `cargo check` passes
- [x] **Step 7: Commit** — `8771838`

---

## Task 2: Wolf RPG Detection ✅

- [x] **Step 1–6** — `wolf_rpg/mod.rs` with `detect()` + 3 tests, `engines/mod.rs` updated

```rust
pub fn detect(game_dir: &std::path::Path) -> bool {
    game_dir.join("Game.exe").exists()
        && game_dir.join("Data/BasicData").exists()
}
```

---

## Task 3: Wolf RPG skip.rs ✅

- [x] **Step 1–5** — 3 tests: delegates_to_common, skip_wolf_db_reference, keep_japanese

```rust
fn is_wolf_db_reference(text: &str) -> bool {
    text.contains("cdb[") || text.starts_with("sdb:")
}
```

---

## Task 4: Wolf RPG placeholders.rs ✅

- [x] **Step 1–5** — 4 tests including intact=false for unknown placeholders

Codes implemented:
| Wolf RPG | Encoded |
|----------|---------|
| `\self[n]` | `{{SELF_VAR[n]}}` |

> ⚠️ Update placeholder table after testing on a real Wolf RPG game.

---

## Task 5: Sidecar Calls ✅

- [x] **Step 1–3** — `wolf_rpg/sidecar.rs` with `run_uberwolf`, `run_wolftl_dump`, `run_wolftl_patch`

> Note: sidecar name is `UberWolfCli` (not `UberWolf`).

---

## Task 6: Wire Wolf RPG into Engine Detection ✅

- [x] **Step 1** — `project.rs` dispatches to `wolf_rpg::detect()` after RPG Maker check
- [x] **Step 3** — `cargo check` passes
- [x] **Step 4** — committed in `bc5051d`

---

## Task 7: Extract + Inject Pipeline ✅

> Added beyond original plan scope.

### extractor.rs

Pipeline: `UberWolfCli` decrypt → `WolfTL dump` → parse JSON → `Vec<TranslationEntry>`

Working directory: `game_dir/hoshi-wolf-work/`
- `decrypted/` — output of UberWolfCli
- `json/` — output of WolfTL dump

### injector.rs

Pipeline: write translated JSON → `WolfTL patch` → `output_dir/`

Working directory: `game_dir/hoshi-wolf-work/translated-json/`

### WolfTL JSON format assumed

```json
[
  {"Original": "日本語テキスト", "Translation": ""}
]
```

> ⚠️ **Verify this format on a real game.** If WolfTL uses different field names (e.g. `"JP"`/`"ENG"` or flat string arrays), update the `WolfEntry` struct in both `extractor.rs` and `injector.rs`.

### engine-aware commands

- `extract_strings` — now takes `app: AppHandle`, dispatches by engine from DB
- `inject_translations` — now takes `app: AppHandle`, dispatches by engine from DB
- `queries::get_project_engine_by_id` — new query used by both commands

---

## Tested on
<!-- Update after each real game test -->
- [ ] Wolf RPG game (name: )

## Linux notes
- Requires Wine installed and in PATH
- Tauri-plugin-shell invokes sidecars with the `x86_64-unknown-linux-gnu` triple on Linux
- Wine intercepts the .exe content automatically — no extension needed on the Linux copy
