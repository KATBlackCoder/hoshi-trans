# GitHub Release CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On every `v*.*.*` tag push, build a Linux AppImage and a Windows NSIS installer in parallel and attach both to a GitHub Release automatically.

**Architecture:** Two independent build jobs (`build-linux` on `ubuntu-22.04`, `build-windows` on `windows-latest`) run in parallel, upload artifacts, then a third `release` job downloads them and creates the GitHub Release via `softprops/action-gh-release`. `ubuntu-22.04` is pinned (not `ubuntu-latest`) to avoid glibc incompatibility with older Linux distros.

**Tech Stack:** GitHub Actions, Tauri v2 CLI (`pnpm tauri build`), pnpm, Rust stable, `Swatinem/rust-cache@v2`, `softprops/action-gh-release@v2`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src-tauri/tauri.conf.json` | Modify | Add `bundle.windows` config (WebView2 + NSIS install mode) |
| `.github/workflows/release.yml` | Create | Full CI/CD pipeline: build Linux + Windows → GitHub Release |

---

## Task 1: Add Windows bundle config to `tauri.conf.json`

`tauri.conf.json` currently has no `bundle.windows` section. Without it, the NSIS installer uses defaults that may prompt for admin rights unnecessarily. `downloadBootstrapper` for WebView2 is the lightest option — it downloads the runtime on first install instead of embedding it.

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Add the `windows` key inside `bundle`**

Replace the current `bundle` block in `src-tauri/tauri.conf.json`:

```json
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "webviewInstallMode": { "type": "downloadBootstrapper" },
      "nsis": { "installMode": "perUser" }
    }
  }
```

- [ ] **Step 2: Verify the local build still compiles**

```bash
pnpm build
```

Expected: `dist/` generated, no TypeScript errors (pre-existing `OllamaPage.tsx` TS6133 is acceptable).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat(bundle): add Windows NSIS perUser + WebView2 downloadBootstrapper config"
```

---

## Task 2: Create the GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write the workflow file**

Create `.github/workflows/release.yml` with this exact content:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:

  # ── Linux AppImage ───────────────────────────────────────────────────────
  build-linux:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libappindicator3-dev \
            librsvg2-dev \
            patchelf \
            libssl-dev \
            libgtk-3-dev \
            libayatana-appindicator3-dev

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Cache Rust build
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install frontend dependencies
        run: npm install -g pnpm && pnpm install

      - name: Build AppImage
        run: pnpm tauri build --bundles appimage

      - name: Upload AppImage artifact
        uses: actions/upload-artifact@v4
        with:
          name: linux-appimage
          path: src-tauri/target/release/bundle/appimage/*.AppImage
          if-no-files-found: error

  # ── Windows NSIS installer ───────────────────────────────────────────────
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Cache Rust build
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install frontend dependencies
        run: npm install -g pnpm && pnpm install

      - name: Build Windows installer
        run: pnpm tauri build --bundles nsis

      - name: Upload NSIS installer artifact
        uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: src-tauri/target/release/bundle/nsis/*-setup.exe
          if-no-files-found: error

  # ── GitHub Release ───────────────────────────────────────────────────────
  release:
    needs: [build-linux, build-windows]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Download AppImage
        uses: actions/download-artifact@v4
        with:
          name: linux-appimage
          path: artifacts/

      - name: Download Windows installer
        uses: actions/download-artifact@v4
        with:
          name: windows-installer
          path: artifacts/

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: artifacts/*
          generate_release_notes: true
```

- [ ] **Step 3: Validate the YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add GitHub Actions release workflow — AppImage + NSIS on tag push"
```

---

## Task 3: Trigger and verify the release

- [ ] **Step 1: Push the branch to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Create and push a release tag**

```bash
git tag v0.1.0
git push origin v0.1.0
```

- [ ] **Step 3: Monitor the workflow**

Go to `https://github.com/<your-username>/hoshi-trans/actions`. You should see a workflow run named `Release` triggered by the tag. It has 3 jobs:
- `build-linux` (~15 min first run, ~5 min with cache)
- `build-windows` (~15 min first run, ~5 min with cache)
- `release` (runs after both complete, ~1 min)

- [ ] **Step 4: Verify the GitHub Release**

Go to `https://github.com/<your-username>/hoshi-trans/releases`. The release `v0.1.0` should exist with two attached files:
- `hoshitrans_0.1.0_amd64.AppImage`
- `hoshitrans_0.1.0_x64-setup.exe`

If either file is missing, check the failed job's logs in the Actions tab.

---

## Summary of commits

| # | Message |
|---|---------|
| 1 | `feat(bundle): add Windows NSIS perUser + WebView2 downloadBootstrapper config` |
| 2 | `ci: add GitHub Actions release workflow — AppImage + NSIS on tag push` |

## What does NOT change

- App source code — zero changes to Rust or React
- Local dev workflow — `pnpm tauri:linux` still works as before
- `tauri.conf.json` build/app sections — untouched

## Notes

- **`--bundles appimage`** and **`--bundles nsis`** — build only the target format instead of all formats (`targets: all` in config still bundles everything locally, but CI only builds what's needed per platform)
- **`if-no-files-found: error`** — makes the job fail clearly if the artifact path glob matches nothing, instead of silently uploading an empty artifact
- **`generate_release_notes: true`** — auto-generates changelog from commits between tags
- **glibc** — `ubuntu-22.04` is pinned. Never change to `ubuntu-latest` — a glibc built on 24.04 refuses to run on Ubuntu 20.04 / Debian 11
