# Monetization & Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maximize donations and visibility for hoshi-trans by overhauling the GitHub README, refining the in-app support section, and creating ready-to-post content for Reddit, Itch.io, and Ko-fi.

**Architecture:** Five independent deliverables: (1) README.md — the primary marketing document seen by every GitHub visitor; (2) AboutPage refinement — in-app support copy that converts active users; (3) Reddit post templates saved in `docs/marketing/` — copy-paste at launch; (4) Itch.io listing content in `docs/marketing/` — copy-paste into Itch.io dashboard; (5) Ko-fi page copy in `docs/marketing/` — fills the Ko-fi description + goal. No code architecture changes.

**Tech Stack:** Markdown, React/TSX (About page only), shadcn/ui.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `README.md` | Overwrite | Primary GitHub landing page — badges, GIF, features, install, setup |
| `src/features/about/AboutPage.tsx` | Modify | In-app support section copy — more compelling, usage-grounded |
| `docs/marketing/reddit-rpgmaker.md` | Create | r/RPGMaker launch post template |
| `docs/marketing/reddit-localllama.md` | Create | r/LocalLLaMA launch post template |
| `docs/marketing/itch-listing.md` | Create | Full Itch.io page content (description, tags, screenshots list) |
| `docs/marketing/kofi-page.md` | Create | Ko-fi page description + goal text |

---

## Task 1: README.md overhaul

**Files:**
- Overwrite: `README.md`

This is the highest-leverage change. Every GitHub visitor, every Reddit link, every Itch.io "source code" click lands here. The current README is the default Tauri template — it says nothing about the app.

- [ ] **Step 1: Capture 3 screenshots for the README**

Run the app (`pnpm tauri:linux`), open a project with translated entries, and take screenshots:

1. `docs/screenshots/translation-view.png` — TranslationView with a few translated entries visible, progress bar showing ~50%
2. `docs/screenshots/glossary.png` — GlossaryPage with some terms loaded
3. `docs/screenshots/ollama-page.png` — OllamaPage showing connection status + model selected

```bash
mkdir -p docs/screenshots
# Use your screenshot tool (e.g. Flameshot, KSnapshot) to capture each view
# Save as PNG, approx 1280×800
```

> **GIF note:** A 30-second screen recording showing: select game folder → extract → batch translate → show results is the single best marketing asset. Tools: `peek` or `kooha` (Linux), `ScreenToGif` (Windows). Save as `docs/screenshots/demo.gif`. Add it to the README once created — it doubles conversion.

- [ ] **Step 2: Write the new README.md**

Replace the entire content of `README.md` with:

```markdown
<div align="center">
  <h1>星 hoshi-trans</h1>
  <p><strong>Free, offline Japanese RPG game translator — powered by local AI via Ollama</strong></p>

  <p>
    <a href="https://github.com/KATBlackCoder/hoshi-trans/releases/latest">
      <img alt="Latest Release" src="https://img.shields.io/github/v/release/KATBlackCoder/hoshi-trans?style=flat-square&color=4f46e5">
    </a>
    <a href="https://github.com/KATBlackCoder/hoshi-trans/releases/latest">
      <img alt="Downloads" src="https://img.shields.io/github/downloads/KATBlackCoder/hoshi-trans/total?style=flat-square&color=4f46e5">
    </a>
    <a href="https://ko-fi.com/katblackcoder">
      <img alt="Ko-fi" src="https://img.shields.io/badge/Ko--fi-Support%20the%20project-FF5E5B?style=flat-square&logo=ko-fi&logoColor=white">
    </a>
    <a href="https://github.com/sponsors/KATBlackCoder">
      <img alt="GitHub Sponsors" src="https://img.shields.io/badge/GitHub%20Sponsors-♥-ea4aaa?style=flat-square">
    </a>
    <img alt="License" src="https://img.shields.io/github/license/KATBlackCoder/hoshi-trans?style=flat-square">
  </p>

  <p>
    <a href="https://github.com/KATBlackCoder/hoshi-trans/releases/latest/download/hoshitrans_0.1.0_amd64.AppImage">⬇ Download for Linux</a>
    ·
    <a href="https://github.com/KATBlackCoder/hoshi-trans/releases/latest/download/hoshitrans_0.1.0_x64-setup.exe">⬇ Download for Windows</a>
    ·
    <a href="#setup">Setup guide</a>
  </p>
</div>

---

<!-- Add demo.gif here once recorded:
![hoshi-trans demo](docs/screenshots/demo.gif)
-->

![Translation view](docs/screenshots/translation-view.png)

## What is hoshi-trans?

hoshi-trans is a **free desktop app** that translates Japanese RPG games using AI running entirely on your own machine. No subscription, no cloud, no data leaving your computer.

You point it at a game folder, it extracts all translatable text, runs it through an Ollama model in batches, then injects the translations back — ready to play in English or French.

## Supported game engines

| Engine | Status | Notes |
|--------|--------|-------|
| **RPG Maker MV / MZ** | ✅ Full | Game must be **decrypted** first — use [RPG Maker Decrypter](https://github.com/Petschko/RPG-Maker-MV-Decrypter) if needed |
| **Wolf RPG Editor** | ✅ Full | Requires [WolfTL](https://github.com/Sinflower/WolfTL) dump folder — decrypt first with [UberWolf](https://github.com/Sinflower/UberWolf) if the game is encrypted |
| **Bakin** | 🚫 Not yet | Coming in a future release |

## Features

- **Batch translation** — translates hundreds of lines in parallel, with cancel support
- **Refine pass** — second-pass quality review using a thinking model
- **Glossary** — project + global term lists auto-populated during translation, keep names consistent
- **Placeholder-safe** — game engine codes (`\N[1]`, `\f[20]`, etc.) are encoded before sending to the model and decoded after, never lost or corrupted
- **Click-to-edit** — fix any translation directly in the table, manual edits feed back into the glossary
- **Inconsistency detection** — flags source texts with multiple different translations
- **Dark/light theme** + accent color

## Screenshots

| Translation view | Glossary |
|---|---|
| ![Translation](docs/screenshots/translation-view.png) | ![Glossary](docs/screenshots/glossary.png) |

## Setup

### Requirements

- [Ollama](https://ollama.com) installed and running
- A hoshi-translator model installed (see below)
- **RPG Maker MV/MZ:** game files must be decrypted — use [RPG Maker Decrypter](https://github.com/Petschko/RPG-Maker-MV-Decrypter) if encrypted
- **Wolf RPG:** a `dump/` folder from [WolfTL](https://github.com/Sinflower/WolfTL) — if the game is encrypted, decrypt it first with [UberWolf](https://github.com/Sinflower/UberWolf)

### Install hoshi-trans

| Platform | Download |
|----------|----------|
| Linux (AppImage) | [hoshitrans_0.1.0_amd64.AppImage](https://github.com/KATBlackCoder/hoshi-trans/releases/latest/download/hoshitrans_0.1.0_amd64.AppImage) |
| Windows (installer) | [hoshitrans_0.1.0_x64-setup.exe](https://github.com/KATBlackCoder/hoshi-trans/releases/latest/download/hoshitrans_0.1.0_x64-setup.exe) |

### Install the translation model

The easiest way is the one-click **Install Models** button in the Ollama page — it runs `ollama create` for you and pulls the base model automatically.

Or manually (no app required):

```bash
curl -fL -o /tmp/hoshi-4b.Modelfile \
  https://raw.githubusercontent.com/KATBlackCoder/hoshi-trans/main/src-tauri/modelfiles/hoshi-translator-4b.Modelfile
ollama create hoshi-translator-4b -f /tmp/hoshi-4b.Modelfile
```

| Model | Base | VRAM |
|---|---|---|
| `hoshi-translator-4b` | `huihui_ai/qwen3-abliterated:4b-instruct-2507-q8_0` | ~4 GB |
| `hoshi-translator-abliterated-4b` | `huihui_ai/qwen3-abliterated:4b-instruct-2507-fp16` | ~8 GB |
| `hoshi-translator-30b` | `huihui_ai/qwen3-abliterated:30b-a3b-instruct-2507-q4_K_M` | min 24 GB |

### Translate a game

1. Open hoshi-trans → Library → **Add project**
2. Select the game folder (or `dump/` folder for Wolf RPG)
3. Click **Extract** — all translatable strings are pulled into a table
4. Click **Translate all** — batch runs in the background, progress shown live
5. When done, click **Export** — translated files written to `output/` (originals untouched)

## Why local AI?

- **Privacy** — your game files stay on your machine
- **Cost** — free after the one-time model download
- **Speed** — 4B model translates ~50 lines/min on a mid-range GPU
- **Quality** — purpose-built `hoshi-translator` modelfile tuned for RPG dialogue, honorifics, and game engine codes

## Support the project

hoshi-trans is free and open source. If it saved you hours on your translation project, consider supporting its development:

- ☕ [Ko-fi](https://ko-fi.com/katblackcoder) — one-time coffee
- ♥ [GitHub Sponsors](https://github.com/sponsors/KATBlackCoder) — monthly support

## Contributing

Bug reports and pull requests welcome. See [CONTEXT.md](docs/CONTEXT.md) for architecture notes.

## License

MIT
```

- [ ] **Step 3: Verify the markdown renders correctly**

```bash
# Install grip if not already available (renders GitHub-flavored markdown)
pip install grip 2>/dev/null || true
grip README.md --browser
```

Expected: page opens in browser, all badges load, images display (with placeholders for missing screenshots), links are correctly formatted.

If `grip` is not available, push to a test branch and preview on GitHub directly.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/screenshots/
git commit -m "docs: overhaul README — badges, features, install guide, screenshots"
```

---

## Task 2: About page — compelling support section

**Files:**
- Modify: `src/features/about/AboutPage.tsx`

> **⚠️ Sequencing:** Execute this task AFTER the Modelfile Installer plan (Task 4 of that plan also modifies `AboutPage.tsx` to remove RunPod). Apply these changes on top of the already-modified file.

The current support section says "hoshi-trans is developed and maintained for free." That's passive. It should connect the support ask to the user's actual benefit — they just translated a game.

- [ ] **Step 1: Replace the support section copy**

In `src/features/about/AboutPage.tsx`, find the `{/* Support */}` block and replace the paragraph inside the `<Card>`:

Replace:
```tsx
<p className="text-xs text-muted-foreground/60 mb-3 leading-relaxed">
  hoshi-trans is developed and maintained for free. If it saves you time on your translation projects,
  consider supporting its development.
</p>
```

With:
```tsx
<p className="text-xs text-muted-foreground/60 mb-3 leading-relaxed">
  hoshi-trans is free and open source — no subscription, no limits.
  If it saved you hours on a translation project, a coffee or a monthly sponsorship
  helps keep development going and new engines supported.
</p>
```

- [ ] **Step 2: Add a GitHub star nudge below the donation links**

After the closing `</div>` of the donation links flex column, add:

```tsx
<div className="mt-3 pt-3 border-t border-border/20 flex items-center gap-2">
  <span className="text-[10px] text-muted-foreground/35 leading-relaxed">
    Free to support:
  </span>
  <a
    href="https://github.com/KATBlackCoder/hoshi-trans"
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1 text-[10px] text-muted-foreground/45 hover:text-foreground/70 transition-colors"
  >
    <Github className="w-3 h-3" />
    Star on GitHub
  </a>
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: `✓ built` — no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/about/AboutPage.tsx
git commit -m "feat(ui): more compelling support section copy + GitHub star nudge"
```

---

## Task 3: Reddit post templates

**Files:**
- Create: `docs/marketing/reddit-rpgmaker.md`
- Create: `docs/marketing/reddit-localllama.md`

These are ready-to-post templates. Copy, adjust the screenshot link if you have one, and post. Best time to post: Tuesday–Thursday 10am–2pm UTC.

- [ ] **Step 1: Create `docs/marketing/` directory**

```bash
mkdir -p docs/marketing
```

- [ ] **Step 2: Create `docs/marketing/reddit-rpgmaker.md`**

```bash
cat > docs/marketing/reddit-rpgmaker.md << 'EOF'
# Reddit post — r/RPGMaker

**Subreddit:** r/RPGMaker
**Best flair:** Tool / Resources
**Post type:** Link (to GitHub) or Text with screenshots

---

## Title

I built a free offline desktop app to translate RPG Maker MV/MZ games using local AI — no subscription needed

---

## Body

Hey r/RPGMaker,

I've been working on **hoshi-trans** — a free, open-source desktop app that translates RPG Maker MV/MZ games (and Wolf RPG, Bakin) using Ollama running locally on your machine. No API key, no cloud service, no monthly fee.

**How it works:**
1. Point it at your game folder
2. It extracts all dialogue, item names, system text into a table (~1 min)
3. Run the batch translator — it processes everything in parallel, ~50 lines/min on a mid-range GPU
4. Export — translated files go into an `output/` folder, originals untouched

**What makes it different from just prompting ChatGPT:**
- **Placeholder-safe**: game codes like `\N[1]` (actor names), `\C[2]` (colors) are preserved — never corrupted
- **Glossary**: builds a term list during translation, keeps character names consistent across 1000+ lines
- **Refine pass**: optional second pass with a thinking model to catch awkward phrasing
- **Inconsistency detection**: flags lines where the same Japanese text got different translations

**Supported engines:**
- RPG Maker MV/MZ — game must be decrypted first (use RPG Maker Decrypter if needed)
- Wolf RPG — decrypt with [UberWolf](https://github.com/Sinflower/UberWolf) if encrypted, then extract with [WolfTL](https://github.com/Sinflower/WolfTL)
- Other engines coming in future releases

**Download:** https://github.com/KATBlackCoder/hoshi-trans/releases/latest
(Linux AppImage + Windows .exe)

It's v0.1.0 and actively developed. Happy to answer questions about the translation pipeline or how the placeholder system works.

---

*[Attach screenshot of the TranslationView showing progress bar + translated entries]*
EOF
```

- [ ] **Step 3: Create `docs/marketing/reddit-localllama.md`**

```bash
cat > docs/marketing/reddit-localllama.md << 'EOF'
# Reddit post — r/LocalLLaMA

**Subreddit:** r/LocalLLaMA
**Best flair:** Project
**Post type:** Text with screenshots + GIF if available

---

## Title

Built a Tauri desktop app that uses Ollama to batch-translate Japanese RPG games — placeholder-safe, glossary, refine pass

---

## Body

Hey r/LocalLLaMA,

**hoshi-trans** — free, open-source desktop app for translating Japanese RPG Maker / Wolf RPG games via a local Ollama model.

**Why I built this:** Existing translation tools either require cloud APIs (cost $$), don't handle game engine codes (corrupt saves/crashes), or have no consistency mechanism (same character name translated 5 different ways).

**The interesting technical parts:**

**Placeholder system:** RPG Maker codes like `\N[1]`, `\C[2]`, `\FS[24]` are encoded to `{{ACTOR_NAME[1]}}`, `{{COLOR[2]}}` before sending to the model, decoded after. The `PH:` prefix in token names prevents LLM hallucination. Any missing token flags the entry as `warning:missing_placeholder` instead of silently corrupting the output.

**Context injection:** Before each dialogue line, the 5 preceding translated lines from the same file are injected as `[Previous lines]\n- src → tgt`. Dramatically improves pronoun consistency and scene continuity.

**Auto-glossary:** Short source texts (≤10 chars, non-dialogue) that get translated are automatically added to a per-project glossary. After the refine pass, reviewed short entries feed back in too. The glossary is injected into every subsequent prompt.

**Two-pass pipeline:** Phase 1 translates item/UI text first (builds the glossary), Phase 2 translates dialogue with that context. Refine pass uses a thinking model to critique and improve.

**Model:** Purpose-built `hoshi-translator` Modelfile on top of `huihui_ai/qwen3-abliterated:4b-instruct-2507-q8_0`. The system prompt uses `❬n❭` marker tokens (not `{{...}}` which the LLM might try to translate) for the few-shot examples. 4B runs at ~50 lines/min on an RTX 3070.

**Stack:** Tauri v2 (Rust + React), SQLite via sqlx, ollama-rs.

GitHub: https://github.com/KATBlackCoder/hoshi-trans
Download: https://github.com/KATBlackCoder/hoshi-trans/releases/latest

Happy to go deeper on any part of the pipeline.

---

*[Attach screenshot of TranslationView + GIF of batch running]*
EOF
```

- [ ] **Step 4: Commit**

```bash
git add docs/marketing/
git commit -m "docs: add Reddit launch post templates for r/RPGMaker and r/LocalLLaMA"
```

---

## Task 4: Itch.io listing content

**Files:**
- Create: `docs/marketing/itch-listing.md`

Itch.io is the right home for game dev tools. The RPG Maker community is very active there. A listing gives a permanent URL you can share, and Itch.io has its own search and discovery.

**Setup steps (manual, done once):**
1. Go to itch.io → Create account (or use existing)
2. Dashboard → Upload new project
3. Kind: **Tools**
4. Platform: **Linux** + **Windows**
5. Upload: link to GitHub releases (external download) OR upload the files directly
6. Tags: `rpg-maker`, `wolf-rpg`, `translation`, `japanese`, `ai`, `ollama`, `localai`, `game-tools`

- [ ] **Step 1: Create `docs/marketing/itch-listing.md`**

```bash
cat > docs/marketing/itch-listing.md << 'EOF'
# Itch.io Listing

**Project title:** hoshi-trans
**Tagline:** Free offline AI translator for Japanese RPG games — RPG Maker MV/MZ, Wolf RPG, Bakin
**Kind:** Tools
**Price:** Free
**Tags:** rpg-maker, wolf-rpg, translation, japanese, ai, ollama, localai, game-tools, rpg-maker-mv, rpg-maker-mz

---

## Short description (shown in search results, max 160 chars)

Free desktop app that batch-translates Japanese RPG Maker / Wolf RPG games using local AI via Ollama. No cloud, no subscription. Linux + Windows.

---

## Full description (paste into Itch.io rich text editor)

**hoshi-trans** is a free, open-source desktop app that translates Japanese RPG games using AI running entirely on your own machine.

Point it at a game folder, extract all text, run the batch translator, export — your translated game lands in an `output/` folder with originals untouched.

---

### Supported engines

- ✅ **RPG Maker MV / MZ** — full extract + inject. Game must be **decrypted** first — use [RPG Maker Decrypter](https://github.com/Petschko/RPG-Maker-MV-Decrypter) if the `.rpgmvp` / `.rpgmvo` files are encrypted.
- ✅ **Wolf RPG Editor** — full support via [WolfTL](https://github.com/Sinflower/WolfTL) dump folder. If the game is encrypted, decrypt it first with [UberWolf](https://github.com/Sinflower/UberWolf).
- 🚫 **Other engines** — not yet available, coming in future releases.

---

### Key features

**Batch translation**
Translates hundreds of lines in parallel with live progress. Cancel at any time. Resume where you left off.

**Placeholder-safe**
RPG Maker and Wolf RPG use engine codes in dialogue (actor names, colors, font sizes, waits). hoshi-trans encodes these before sending to the AI and decodes them after — they're never lost or corrupted.

**Glossary**
Builds a term list automatically during translation. Character names, item names, and short proper nouns stay consistent across thousands of lines.

**Refine pass**
Optional second-pass quality review using a thinking model. Catches awkward phrasing, checks placeholder counts, flags inconsistencies.

**Click-to-edit**
Fix any translation directly in the table. Manual edits feed back into the glossary automatically.

---

### Requirements

- [Ollama](https://ollama.com) installed and running
- ~4 GB VRAM minimum (4B q8_0 model), ~8 GB (4B fp16), or min 24 GB (30B MoE)
- **RPG Maker MV/MZ:** decrypted game files — use [RPG Maker Decrypter](https://github.com/Petschko/RPG-Maker-MV-Decrypter) if needed
- **Wolf RPG:** `dump/` folder from [WolfTL](https://github.com/Sinflower/WolfTL) — decrypt first with [UberWolf](https://github.com/Sinflower/UberWolf) if encrypted

---

### Free and open source

Source code: [github.com/KATBlackCoder/hoshi-trans](https://github.com/KATBlackCoder/hoshi-trans)

If hoshi-trans saves you time on your translation project, consider supporting development on [Ko-fi](https://ko-fi.com/katblackcoder) or [GitHub Sponsors](https://github.com/sponsors/KATBlackCoder).

---

## Screenshots to upload (in order)

1. `docs/screenshots/translation-view.png` — main view with entries + progress bar
2. `docs/screenshots/glossary.png` — glossary page with terms
3. `docs/screenshots/ollama-page.png` — Ollama connection page
4. (Optional) `docs/screenshots/demo.gif` — animated demo

## Download links to add

| Platform | URL |
|----------|-----|
| Linux AppImage | https://github.com/KATBlackCoder/hoshi-trans/releases/latest/download/hoshitrans_0.1.0_amd64.AppImage |
| Windows installer | https://github.com/KATBlackCoder/hoshi-trans/releases/latest/download/hoshitrans_0.1.0_x64-setup.exe |

EOF
```

- [ ] **Step 2: Commit**

```bash
git add docs/marketing/itch-listing.md
git commit -m "docs: add Itch.io listing content and setup instructions"
```

---

## Task 5: Ko-fi page copy

**Files:**
- Create: `docs/marketing/kofi-page.md`

The Ko-fi page is currently the default empty profile. Filling it in means visitors who click through from the app or README land on a page that explains what they're supporting.

**Setup (manual, done once):**
1. Log in to ko-fi.com/katblackcoder
2. Edit page → About section → paste the description below
3. Set a goal (optional but recommended — see below)
4. Add a profile picture (use the 星 icon from `src-tauri/icons/icon.png`)

- [ ] **Step 1: Create `docs/marketing/kofi-page.md`**

```bash
cat > docs/marketing/kofi-page.md << 'EOF'
# Ko-fi Page Copy

## Page title
KATBlackCoder — hoshi-trans

## About section (paste into Ko-fi "About" field)

I build **hoshi-trans** — a free, open-source desktop app that translates Japanese RPG games using local AI via Ollama.

No subscription. No cloud. Your game files never leave your machine.

**What your support funds:**
- Development time (new game engines, features, bug fixes)
- Testing on real games
- Keeping hoshi-trans free forever

**Current version:** v0.1.0 — RPG Maker MV/MZ + Wolf RPG fully supported

→ [GitHub](https://github.com/KATBlackCoder/hoshi-trans) · [Download](https://github.com/KATBlackCoder/hoshi-trans/releases/latest)

---

## Goal (optional — set in Ko-fi goal section)

**Goal title:** Cover development costs for v0.2.0
**Goal description:** Funds development time for Bakin engine full support + Wolf RPG injection improvements.
**Goal amount:** $150

---

## First post (pin this to your Ko-fi feed)

**Title:** hoshi-trans v0.1.0 is out — free JP RPG game translator

**Body:**
hoshi-trans v0.1.0 is released — a free desktop app for translating Japanese RPG Maker and Wolf RPG games using local AI (Ollama).

Features: batch translation, glossary auto-population, placeholder-safe encoding, refine pass, inconsistency detection.

Download: https://github.com/KATBlackCoder/hoshi-trans/releases/latest

It's completely free. If it saves you time on a project, a coffee helps keep development going. Thank you!

EOF
```

- [ ] **Step 2: Commit**

```bash
git add docs/marketing/kofi-page.md
git commit -m "docs: add Ko-fi page copy and goal text"
```

---

## Summary of commits

| # | Message |
|---|---------|
| 1 | `docs: overhaul README — badges, features, install guide, screenshots` |
| 2 | `feat(ui): more compelling support section copy + GitHub star nudge` |
| 3 | `docs: add Reddit launch post templates for r/RPGMaker and r/LocalLLaMA` |
| 4 | `docs: add Itch.io listing content and setup instructions` |
| 5 | `docs: add Ko-fi page copy and goal text` |

## Launch checklist (after all tasks complete)

- [ ] Take the 3 screenshots and add `demo.gif` to `docs/screenshots/`
- [ ] Push README changes — verify badges render on GitHub
- [ ] Set up Itch.io listing using `docs/marketing/itch-listing.md`
- [ ] Update Ko-fi page using `docs/marketing/kofi-page.md`
- [ ] Post to r/RPGMaker (wait 24h, then post to r/LocalLLaMA)
- [ ] Post to r/JRPG if the r/RPGMaker post gets traction (use the r/RPGMaker template, remove the technical details)

## What does NOT change

- App source code (except About page copy — Task 2)
- CI/CD pipeline
- Release process
- Any Rust or translation logic

## Notes

- **Screenshots are the bottleneck** — the README and Itch.io listing are written but won't be fully effective without real screenshots. Take them while testing the app on a real game — the translation view with actual Japanese text looks far more compelling than a blank project.
- **demo.gif > everything** — a 20-second GIF showing extract → translate → export is worth more than any written description. Once you have it, add it as the first item in the README above the static screenshots.
- **r/RPGMaker post timing** — post Tuesday or Wednesday morning UTC. Avoid Fridays. Games-related posts perform best mid-week.
- **Itch.io pricing** — set "No payments" with a "Name your own price" option starting at $0. This allows Ko-fi-style one-off support directly through Itch.io without requiring a price.
