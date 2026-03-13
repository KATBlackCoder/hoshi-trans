# UX Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** System notification "Batch complete" when app is backgrounded, window size/position persistence between sessions, and a larger default window (1200×800).

**Architecture:** Notifications are triggered from Rust inside `translate_batch` after the loop completes. `tauri-plugin-window-state` automatically saves and restores window geometry. Window dimensions are set in `tauri.conf.json`.

**Tech Stack:** tauri-plugin-notification, tauri-plugin-window-state

---

## Prerequisite

STEP-06 (`translate_batch`) must be fully implemented and working.

---

## Packages to Add

```bash
pnpm tauri add notification
pnpm tauri add window-state
```

> ⚠️ After `pnpm tauri add window-state`, update `lib.rs` to use the builder:
> ```rust
> .plugin(tauri_plugin_window_state::Builder::default().build())
> ```

---

## File Structure

- Modify: `src-tauri/src/lib.rs` — register window-state plugin with builder
- Modify: `src-tauri/src/commands/ollama.rs` — add notification after batch completes
- Modify: `src-tauri/tauri.conf.json` — window dimensions 1200×800
- Modify: `src-tauri/capabilities/default.json` — add notification permission

---

## Task 1: Install Plugins

- [ ] **Step 1: Add plugins**

```bash
pnpm tauri add notification
pnpm tauri add window-state
```

- [ ] **Step 2: Update lib.rs — use window-state builder**

```rust
// src-tauri/src/lib.rs — replace generated window-state init with:
.plugin(tauri_plugin_window_state::Builder::default().build())
```

- [ ] **Step 3: Verify notification permission was added**

```bash
grep "notification" src-tauri/capabilities/default.json
```
Expected: `"notification:default"` present

- [ ] **Step 4: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/ package.json pnpm-lock.yaml
git commit -m "chore: add tauri-plugin-notification and tauri-plugin-window-state"
```

---

## Task 2: Window Size in tauri.conf.json

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Write the failing check**

```bash
grep '"width"' src-tauri/tauri.conf.json
```
Expected: some smaller default value

- [ ] **Step 2: Update window configuration**

```json
// src-tauri/tauri.conf.json — in app.windows[0]:
{
  "label": "main",
  "title": "hoshi-trans",
  "width": 1200,
  "height": 800,
  "minWidth": 900,
  "minHeight": 600,
  "center": true
}
```

- [ ] **Step 3: Verify in app**

Run: `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev`
Expected: App launches at 1200×800

- [ ] **Step 4: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore: set default window size to 1200x800"
```

---

## Task 3: Window State Persistence

**Files:**
- Modify: `src-tauri/src/lib.rs` — already done in Task 1

- [ ] **Step 1: Verify window-state plugin is registered**

```bash
grep "window_state" src-tauri/src/lib.rs
```
Expected: `tauri_plugin_window_state::Builder::default().build()` present

- [ ] **Step 2: Test persistence manually**

Run: `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev`
1. Resize and move the window
2. Close the app
3. Reopen the app
Expected: Window opens at the saved size and position

- [ ] **Step 3: Commit (if any lib.rs changes remain)**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: persist window size and position with tauri-plugin-window-state"
```

---

## Task 4: Batch Complete Notification

**Files:**
- Modify: `src-tauri/src/commands/ollama.rs`

- [ ] **Step 1: Write the failing test**

```rust
// No unit test possible for notifications (platform API)
// Manually verify in Task 4 Step 3
```

- [ ] **Step 2: Add notification import and AppHandle to translate_batch**

```rust
// src-tauri/src/commands/ollama.rs — update translate_batch signature
#[tauri::command]
pub async fn translate_batch(
    window: tauri::Window,
    app: tauri::AppHandle,   // ← add this
    pool: tauri::State<'_, SqlitePool>,
    cancel_flag: tauri::State<'_, Arc<AtomicBool>>,
    project_id: String,
    model: String,
    target_lang: String,
    system_prompt: String,
) -> Result<(), String> {
    // ... existing loop code unchanged ...

    // After loop completes, send notification
    use tauri_plugin_notification::NotificationExt;
    let cancelled = cancel_flag.load(Ordering::Relaxed);
    let message = if cancelled {
        format!("Batch cancelled after {} entries.", done)
    } else {
        format!("Batch complete: {} entries translated.", done)
    };

    // Only show notification — don't fail if it errors (user may have denied permission)
    let _ = app
        .notification()
        .builder()
        .title("hoshi-trans")
        .body(&message)
        .show();

    Ok(())
}
```

> Note: `done` is the counter variable already in the loop. Ensure it is declared as `let mut done: u32 = 0;` and incremented each iteration.

- [ ] **Step 3: Test notification manually**

Run: `WEBKIT_DISABLE_COMPOSITING_MODE=1 GDK_BACKEND=x11 pnpm tauri dev`
1. Open a game, translate a few entries
2. Minimize or background the app
3. Wait for batch to complete
Expected: System notification "hoshi-trans — Batch complete: N entries translated."

- [ ] **Step 4: Compile check**

Run: `cd src-tauri && cargo check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/ollama.rs
git commit -m "feat: send system notification when translation batch completes"
```
