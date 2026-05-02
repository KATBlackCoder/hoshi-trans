# Itch.io Listing

**Project title:** hoshi-trans
**Tagline:** Free offline AI translator for Japanese RPG games — RPG Maker MV/MZ, Wolf RPG
**Kind:** Tools
**Price:** Free (Name your own price starting at $0)
**Tags:** rpg-maker, wolf-rpg, translation, japanese, ai, ollama, localai, game-tools, rpg-maker-mv, rpg-maker-mz

**Setup steps (done once):**
1. itch.io → Dashboard → Upload new project
2. Kind: Tools — Platform: Linux + Windows
3. Upload: external links to GitHub releases (see below)
4. Add screenshots in order listed below

---

## Short description (max 160 chars)

Free desktop app that batch-translates Japanese RPG Maker / Wolf RPG games using local AI via Ollama. No cloud, no subscription. Linux + Windows.

---

## Full description (paste into Itch.io rich text editor)

**hoshi-trans** is a free, open-source desktop app that translates Japanese RPG games using AI running entirely on your own machine.

Point it at a game folder, extract all text, run the batch translator, export — your translated game lands in an `output/` folder with originals untouched.

---

### Supported engines

- ✅ **RPG Maker MV / MZ** — full extract + inject (dialogue, items, system text, map names). Game must be **decrypted** first — use [RPG Maker Decrypter](https://github.com/Petschko/RPG-Maker-MV-Decrypter) if the `.rpgmvp` / `.rpgmvo` files are encrypted.
- ✅ **Wolf RPG Editor** — full support via [WolfTL](https://github.com/Sinflower/WolfTL) dump folder. Decrypt first with [UberWolf](https://github.com/Sinflower/UberWolf) if the game is encrypted.
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

If hoshi-trans saves you time on your translation project, consider a crypto donation — addresses are listed on the [GitHub page](https://github.com/KATBlackCoder/hoshi-trans).

---

## Screenshots to upload (in order)

1. `docs/screenshots/translation-view.png` — translation table with JP + EN entries
2. `docs/screenshots/glossary.png` — glossary with auto-populated terms
3. `docs/screenshots/ollama-page.png` — Ollama page with model installed
4. (Optional) `docs/screenshots/demo.gif` — animated demo of batch translate

## Download links to add

| Platform | URL |
|----------|-----|
| Linux AppImage | https://github.com/KATBlackCoder/hoshi-trans/releases/latest/download/hoshitrans_0.1.1_amd64.AppImage |
| Windows installer | https://github.com/KATBlackCoder/hoshi-trans/releases/latest/download/hoshitrans_0.1.1_x64-setup.exe |
