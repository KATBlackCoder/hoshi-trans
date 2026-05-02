# Reddit post — r/RPGMaker

**Subreddit:** r/RPGMaker
**Best flair:** Tool / Resources
**Post type:** Link (to GitHub) or Text with screenshots
**Best time:** Tuesday or Wednesday, 10am–2pm UTC

---

## Title

I built a free offline desktop app to translate RPG Maker MV/MZ games using local AI — no subscription needed

---

## Body

Hey r/RPGMaker,

I've been working on **hoshi-trans** — a free, open-source desktop app that translates RPG Maker MV/MZ games (and Wolf RPG) using Ollama running locally on your machine. No API key, no cloud service, no monthly fee.

**How it works:**
1. Point it at your game folder (must be decrypted first — use RPG Maker Decrypter if needed)
2. It extracts all dialogue, item names, system text into a table (~1 min)
3. Run the batch translator — it processes everything in parallel, ~50 lines/min on a mid-range GPU
4. Export — translated files go into an `output/` folder, originals untouched

**What makes it different from just prompting ChatGPT:**
- **Placeholder-safe**: game codes like `\N[1]` (actor names), `\C[2]` (colors) are preserved — never corrupted
- **Glossary**: builds a term list during translation, keeps character names consistent across 1000+ lines
- **Refine pass**: optional second pass with a thinking model to catch awkward phrasing
- **Inconsistency detection**: flags lines where the same Japanese text got different translations

**Supported engines:**
- RPG Maker MV/MZ (full) — decrypt with RPG Maker Decrypter if needed
- Wolf RPG (full) — decrypt with UberWolf if needed, then extract with WolfTL

**Download:** https://github.com/KATBlackCoder/hoshi-trans/releases/latest
(Linux AppImage + Windows .exe, free)

It's v0.1.0 and actively developed. Happy to answer questions about the translation pipeline or how the placeholder system works.

---

*[Attach screenshot of translate_pages showing JP → EN entries]*
