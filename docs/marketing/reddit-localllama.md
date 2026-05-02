# Reddit post — r/LocalLLaMA

**Subreddit:** r/LocalLLaMA
**Best flair:** Project
**Post type:** Text with screenshots + GIF if available
**Best time:** Tuesday or Wednesday, 10am–2pm UTC

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

*[Attach screenshot of translation view + GIF of batch running if available]*
