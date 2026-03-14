# Model Optimization for Translation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Find the best Ollama model + Modelfile configuration for JP→EN visual novel translation by systematically testing candidates and scoring results with an automated quality script.

**Architecture:** A Python scoring script reads `debug-translations.json` and produces a quality report (meta-text leaks, placeholder errors, empty translations). Three candidate Modelfiles are created, each model is tested via hoshi-trans on a fixed 50-entry benchmark, results are scored and compared to pick a winner.

**Tech Stack:** Python 3 (scoring script), Ollama Modelfile format, hoshi-trans debug JSON export

---

## Context: Current Problems

Observed on `llama3.1:8b-instruct-q4_K_M` with 100 translated entries:

| Problem | Count | Example |
|---------|-------|---------|
| Meta-text leakage | ~10 | `"Here it is:\n\nTranslation..."` |
| Placeholder broken | ~10 | `{{PH:n[1]}}` → `N[1]` (missing `\`) or wrong number |
| Sense inversion | ~5 | `もっと力抜いて` (relax) → "try harder!" |
| Placeholder → name substitution | ~8 | `{{PH:n[1]}}` → "Rikka-chan" (glossary interference) |

**Hardware constraint:** GTX 1660 SUPER 6GB VRAM → max ~5.5 GB model size (q4_K_M)

---

## Candidate Models

| Model | VRAM (q4_K_M) | JP quality | Instructions |
|-------|--------------|-----------|--------------|
| `qwen2.5:7b-instruct-q4_K_M` | ~4.1 GB | ⭐⭐⭐ | ⭐⭐⭐ |
| `gemma2:9b-instruct-q4_K_M` | ~5.4 GB | ⭐⭐ | ⭐⭐⭐ |
| `huihui_ai/qwen3.5-abliterated:4B` | ~2.5 GB | ⭐⭐⭐ | ⭐⭐ |

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src-tauri/modelfiles/hoshi-translator-qwen25.Modelfile` | Create | Modelfile for qwen2.5:7b |
| `src-tauri/modelfiles/hoshi-translator-gemma2.Modelfile` | Create | Modelfile for gemma2:9b |
| `src-tauri/modelfiles/hoshi-translator-qwen35.Modelfile` | Create | Modelfile for qwen3.5-abliterated:4B |
| `src-tauri/modelfiles/hoshi-translator.Modelfile` | Modify | Update with winning model |
| `tools/score_translations.py` | Create | Automated quality scoring script |
| `docs/model-benchmark.md` | Create | Results table comparing all candidates |

---

## Chunk 1: Scoring Script + Modelfiles

### Task 1: Automated scoring script

**Files:**
- Create: `tools/score_translations.py`

The script reads a `debug-translations.json` file and counts quality issues. This lets you objectively compare models without reading every line manually.

**Scoring rules:**
- **Meta-text leak**: translation contains leaked reasoning phrases (`"Here is"`, `"Here it is"`, `"Translation:"`, `"becomes:"`, `"^Note:"`) or a double-newline followed by a new sentence
- **Placeholder broken**: source contains `{{PH:xxx}}` but translation does NOT contain the correctly decoded form (e.g. `{{PH:n[1]}}` must decode to `\N[1]` — the uppercase form only; `\n[1]` is a RPG Maker line-break code and counts as broken)
- **Placeholder hallucinated**: translation contains `{{PH:` (model copied the encoded form instead of decoding)
- **Empty translation**: translation is null or empty string
- **Score**: `100 * (ok_count / total)` where ok = entries with no issues of any kind

- [ ] **Step 1: Write the self-tests for the scoring functions**

```python
# tools/test_score.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from tools.score_translations import decode_ph_code, has_meta_text, check_placeholders

# decode_ph_code
assert decode_ph_code("n[1]") == "\\N[1]",  f"got {decode_ph_code('n[1]')}"
assert decode_ph_code("v[2]") == "\\V[2]",  f"got {decode_ph_code('v[2]')}"
assert decode_ph_code("item[3]") == "\\item[3]", f"got {decode_ph_code('item[3]')}"
assert decode_ph_code("c[2]") == "\\c[2]",  f"got {decode_ph_code('c[2]')}"
assert decode_ph_code("fs[12]") == "\\fs[12]", f"got {decode_ph_code('fs[12]')}"

# has_meta_text
assert has_meta_text("Here is the translation: hello") == True
assert has_meta_text("Hello world") == False
assert has_meta_text("Hehe...\n\nNote: adjusted tone") == True

# check_placeholders — broken: lowercase \n[1] is NOT accepted (it's a line-break code)
broken, hallucinated = check_placeholders("{{PH:n[1]}}ちゃん", "\\n[1]-chan")
assert broken == 1, f"expected broken=1 got {broken}"  # \n[1] is wrong
broken, hallucinated = check_placeholders("{{PH:n[1]}}ちゃん", "\\N[1]-chan")
assert broken == 0, f"expected broken=0 got {broken}"  # \N[1] is correct
broken, hallucinated = check_placeholders("{{PH:n[1]}}ちゃん", "Rikka-chan")
assert broken == 1, f"expected broken=1 (name substituted) got {broken}"
broken, hallucinated = check_placeholders("{{PH:n[1]}}ちゃん", "{{PH:n[1]}}-chan")
assert hallucinated == 1, f"expected hallucinated=1 got {hallucinated}"
broken, hallucinated = check_placeholders("no placeholders", "clean translation")
assert broken == 0 and hallucinated == 0

print("All tests passed.")
```

- [ ] **Step 2: Run to verify tests pass before writing the script**

```bash
cd /home/blackat/project/hoshi-trans
python3 tools/test_score.py
```

Expected: `All tests passed.`

> Note: this will fail until Step 3 creates the module. Run it again after Step 3.

- [ ] **Step 3: Create `tools/score_translations.py`**

```python
#!/usr/bin/env python3
"""Score a debug-translations.json file for translation quality."""

import json
import re
import sys
from pathlib import Path

META_TEXT_PATTERNS = [
    r"^Here is",
    r"^Here it is",
    r"^Translation:",
    r"^The translation",
    r"becomes:",
    r"^Note:",
    r"\n\n[A-Z]",  # double newline followed by new sentence = leaked reasoning
]

def has_meta_text(translation: str) -> bool:
    for pattern in META_TEXT_PATTERNS:
        if re.search(pattern, translation, re.IGNORECASE):
            return True
    return False

def extract_ph_codes(text: str) -> list[str]:
    """Extract all {{PH:xxx}} codes from source text."""
    return re.findall(r"\{\{PH:([^}]+)\}\}", text)

def decode_ph_code(code: str) -> str:
    """Decode {{PH:xxx}} to the expected \Xxx form in the translation.

    Rules (from CLAUDE.md):
    - {{PH:n[1]}} → \\N[1]  (name variable — uppercase N)
    - {{PH:v[2]}} → \\V[2]  (variable — uppercase V)
    - {{PH:item[3]}} → \\item[3]  (item — lowercase, multi-char prefix)
    - {{PH:c[2]}} → \\c[2]   (color — lowercase, single-char non-name)

    Only 'n' and 'v' are uppercased; all other codes keep their original casing.
    \\n[1] is a RPG Maker line-break code, NOT a name variable — reject it.
    """
    prefix = code.split("[")[0] if "[" in code else code
    rest = code[len(prefix):]
    decoded_prefix = prefix.upper() if prefix.lower() in ("n", "v") else prefix
    return f"\\{decoded_prefix}{rest}"

def check_placeholders(source: str, translation: str) -> tuple[int, int]:
    """Returns (broken_count, hallucinated_count).

    broken: placeholder present in source but its correctly-decoded form
            is absent from translation (includes name-substitution errors).
    hallucinated: model copied {{PH:...}} verbatim instead of decoding.
    """
    ph_codes = extract_ph_codes(source)
    broken = 0
    for code in ph_codes:
        decoded = decode_ph_code(code)  # only accept correctly decoded form
        if decoded not in translation:
            broken += 1
    hallucinated = len(re.findall(r"\{\{PH:", translation))
    return broken, hallucinated

def score_file(path: str) -> None:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    translated = [e for e in data if e["status"] == "translated"]

    if not translated:
        print("No translated entries found.")
        return

    meta_leak_keys = set()
    ph_broken_keys = set()
    ph_hallucinated_keys = set()
    empty_keys = set()

    meta_leaks = []
    placeholder_broken = []
    placeholder_hallucinated = []

    for e in translated:
        key = (e["file"], e["order"])  # unique per entry across all files
        t = e.get("translation") or ""
        s = e.get("source") or ""

        if not t.strip():
            empty_keys.add(key)
            continue

        if has_meta_text(t):
            meta_leak_keys.add(key)
            meta_leaks.append(e)

        broken, hallucinated = check_placeholders(s, t)
        if broken > 0:
            ph_broken_keys.add(key)
            placeholder_broken.append(e)
        if hallucinated > 0:
            ph_hallucinated_keys.add(key)
            placeholder_hallucinated.append(e)

    total = len(translated)
    all_issue_keys = meta_leak_keys | ph_broken_keys | ph_hallucinated_keys | empty_keys
    ok = total - len(all_issue_keys)
    score = round(100 * ok / total, 1) if total else 0

    print(f"\n{'='*50}")
    print(f"  Translation Quality Report")
    print(f"  File: {path}")
    print(f"{'='*50}")
    print(f"  Translated entries    : {total}")
    print(f"  ✅ Clean              : {ok} ({round(100*ok/total)}%)")
    print(f"  🗑️  Meta-text leaks    : {len(meta_leak_keys)}")
    print(f"  ⚠️  Placeholder broken : {len(ph_broken_keys)}")
    print(f"  ⚠️  PH hallucinated    : {len(ph_hallucinated_keys)}")
    print(f"  ❌ Empty              : {len(empty_keys)}")
    print(f"  📊 Score              : {score}/100")
    print(f"{'='*50}\n")

    if meta_leaks:
        print("--- Meta-text leaks (first 3) ---")
        for e in meta_leaks[:3]:
            print(f"  [{e['file']} #{e['order']}]")
            print(f"    SRC: {e['source'][:80]}")
            print(f"    TRL: {e['translation'][:120]}")
            print()

    if placeholder_broken:
        print("--- Placeholder broken (first 3) ---")
        for e in placeholder_broken[:3]:
            print(f"  [{e['file']} #{e['order']}]")
            print(f"    SRC: {e['source'][:80]}")
            print(f"    TRL: {e['translation'][:120]}")
            print()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 tools/score_translations.py <path/to/debug-translations.json>")
        sys.exit(1)
    score_file(sys.argv[1])
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
cd /home/blackat/project/hoshi-trans
python3 tools/test_score.py
```

Expected: `All tests passed.`

- [ ] **Step 5: Run on existing results to establish baseline**

```bash
cd /home/blackat/project/hoshi-trans
python3 tools/score_translations.py \
  engine_test/StandGirl-立ちんぼ六花の深い夜-/hoshi-trans-output/debug-translations.json
```

Expected output (approximate, based on llama3.1:8b):
```
  Translated entries : 100
  ✅ Clean           : ~70 (70%)
  🗑️  Meta-text leaks : ~10
  ⚠️  Placeholder broken: ~10
  📊 Score           : ~70/100
```

Save this baseline score — it's your reference for `llama3.1:8b-instruct-q4_K_M`.

- [ ] **Step 6: Commit**

```bash
git add tools/score_translations.py tools/test_score.py
git commit -m "feat: add translation quality scoring script with tests"
```

---

### Task 2: Create Modelfiles for each candidate

**Files:**
- Create: `src-tauri/modelfiles/hoshi-translator-qwen25.Modelfile`
- Create: `src-tauri/modelfiles/hoshi-translator-gemma2.Modelfile`
- Create: `src-tauri/modelfiles/hoshi-translator-qwen35.Modelfile`

The system prompt is identical for all three — only `FROM` and parameters differ. This ensures fair comparison: the only variable is the base model.

- [ ] **Step 1: Write `hoshi-translator-qwen25.Modelfile`**

```dockerfile
FROM qwen2.5:7b-instruct-q4_K_M

SYSTEM """
You are a professional Japanese-to-English translator for visual novel games.

Rules (MANDATORY — violating any rule is an error):
1. Output ONLY the English translation. No explanations, no notes, no meta-commentary, no quotes around the translation.
2. Tokens like {{PH:n[1]}}, {{PH:item[3]}}, {{PH:c[2]}} are RPG engine codes. Decode them: remove {{PH: and }}, then prepend \, uppercasing only 'n'→'N' and 'v'→'V'. Examples: {{PH:n[1]}} → \N[1], {{PH:v[2]}} → \V[2], {{PH:item[3]}} → \item[3], {{PH:c[2]}} → \c[2]. Copy the decoded token in the exact position it appears in the source.
3. Japanese names must be romanized using Hepburn romanization. Do NOT translate names literally. e.g. 六花 → Rikka, 羽鳥 → Hatori.
4. Preserve tone and register exactly: dramatic stays dramatic, casual stays casual, cute stays cute.
5. Never add, remove, or rearrange content beyond what the source says.
"""

PARAMETER temperature 0.1
PARAMETER top_p 0.95
PARAMETER repeat_penalty 1.05
PARAMETER num_ctx 2048
```

- [ ] **Step 2: Write `hoshi-translator-gemma2.Modelfile`**

```dockerfile
FROM gemma2:9b-instruct-q4_K_M

SYSTEM """
You are a professional Japanese-to-English translator for visual novel games.

Rules (MANDATORY — violating any rule is an error):
1. Output ONLY the English translation. No explanations, no notes, no meta-commentary, no quotes around the translation.
2. Tokens like {{PH:n[1]}}, {{PH:item[3]}}, {{PH:c[2]}} are RPG engine codes. Decode them: remove {{PH: and }}, then prepend \, uppercasing only 'n'→'N' and 'v'→'V'. Examples: {{PH:n[1]}} → \N[1], {{PH:v[2]}} → \V[2], {{PH:item[3]}} → \item[3], {{PH:c[2]}} → \c[2]. Copy the decoded token in the exact position it appears in the source.
3. Japanese names must be romanized using Hepburn romanization. Do NOT translate names literally. e.g. 六花 → Rikka, 羽鳥 → Hatori.
4. Preserve tone and register exactly: dramatic stays dramatic, casual stays casual, cute stays cute.
5. Never add, remove, or rearrange content beyond what the source says.
"""

PARAMETER temperature 0.1
PARAMETER top_p 0.95
PARAMETER repeat_penalty 1.05
PARAMETER num_ctx 2048
```

- [ ] **Step 3: Write `hoshi-translator-qwen35.Modelfile`**

```dockerfile
FROM huihui_ai/qwen3.5-abliterated:4B

SYSTEM """
You are a professional Japanese-to-English translator for visual novel games.

Rules (MANDATORY — violating any rule is an error):
1. Output ONLY the English translation. No explanations, no notes, no meta-commentary, no quotes around the translation.
2. Tokens like {{PH:n[1]}}, {{PH:item[3]}}, {{PH:c[2]}} are RPG engine codes. Decode them: remove {{PH: and }}, then prepend \, uppercasing only 'n'→'N' and 'v'→'V'. Examples: {{PH:n[1]}} → \N[1], {{PH:v[2]}} → \V[2], {{PH:item[3]}} → \item[3], {{PH:c[2]}} → \c[2]. Copy the decoded token in the exact position it appears in the source.
3. Japanese names must be romanized using Hepburn romanization. Do NOT translate names literally. e.g. 六花 → Rikka, 羽鳥 → Hatori.
4. Preserve tone and register exactly: dramatic stays dramatic, casual stays casual, cute stays cute.
5. Never add, remove, or rearrange content beyond what the source says.
"""

PARAMETER temperature 0.1
PARAMETER top_p 0.95
PARAMETER repeat_penalty 1.05
PARAMETER num_ctx 2048
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/modelfiles/
git commit -m "feat: add Modelfiles for qwen2.5:7b, gemma2:9b, qwen3.5-abliterated:4B candidates"
```

---

## Chunk 2: Benchmark Testing

### Task 3: Pull models and create Ollama models

- [ ] **Step 1: Pull qwen2.5:7b**

```bash
ollama pull qwen2.5:7b-instruct-q4_K_M
```

Expected: model downloaded (~4.1 GB). If already present, this is instant.

- [ ] **Step 2: Create hoshi-translator-qwen25**

```bash
cd /home/blackat/project/hoshi-trans
ollama create hoshi-translator-qwen25 \
  -f src-tauri/modelfiles/hoshi-translator-qwen25.Modelfile
```

Expected: `success`

- [ ] **Step 3: Pull gemma2:9b**

```bash
ollama pull gemma2:9b-instruct-q4_K_M
```

Expected: model downloaded (~5.4 GB). Check VRAM with `nvidia-smi` — should stay under 6 GB during inference.

- [ ] **Step 4: Create hoshi-translator-gemma2**

```bash
cd /home/blackat/project/hoshi-trans
ollama create hoshi-translator-gemma2 \
  -f src-tauri/modelfiles/hoshi-translator-gemma2.Modelfile
```

Expected: `success`

- [ ] **Step 5: Pull huihui_ai/qwen3.5-abliterated:4B**

```bash
ollama pull huihui_ai/qwen3.5-abliterated:4B
```

Expected: model downloaded (~2.5 GB).

- [ ] **Step 6: Create hoshi-translator-qwen35**

```bash
cd /home/blackat/project/hoshi-trans
ollama create hoshi-translator-qwen35 \
  -f src-tauri/modelfiles/hoshi-translator-qwen35.Modelfile
```

Expected: `success`

- [ ] **Step 7: Verify all models present**

```bash
ollama list | grep hoshi-translator
```

Expected:
```
hoshi-translator-qwen25   ...
hoshi-translator-gemma2   ...
hoshi-translator-qwen35   ...
```

---

### Task 4: Run benchmark for each model

For each model, you will:
1. Reset the StandGirl project entries to `pending` (via hoshi-trans UI or DB)
2. Run translation with **limit = 50** to keep test time reasonable
3. Export debug JSON
4. Copy the result to a named file
5. Score it

**Reset entries between runs** — this is critical, otherwise you're translating different entries each time. Also reset before the very first benchmark run even if the project already has translated entries.

**Reset command** (run before each benchmark):
```bash
sqlite3 ~/.local/share/hoshi-trans/hoshi-trans.db \
  "UPDATE entries SET status='pending', translation=NULL \
   WHERE project_id = (SELECT id FROM projects WHERE game_title LIKE '%StandGirl%')"
```

**Verify reset** (run immediately after to confirm):
```bash
sqlite3 ~/.local/share/hoshi-trans/hoshi-trans.db \
  "SELECT COUNT(*) FROM entries \
   WHERE project_id = (SELECT id FROM projects WHERE game_title LIKE '%StandGirl%') \
   AND status = 'pending'"
```
Expected: total entry count (897). If lower, the reset didn't apply correctly — do not proceed.

**Temperature note:** The Modelfile bakes in `temperature 0.1`. In hoshi-trans Settings, also set temperature to `0.1` to ensure they agree. The Settings value is passed to the Ollama request and may override the Modelfile PARAMETER — keep both at `0.1` to be safe.

**System prompt note:** Leave the hoshi-trans Settings system prompt **empty** — the prompt is baked into the Modelfile. Sending a second system prompt may conflict.

- [ ] **Step 1: Unload any running model, reset entries, benchmark qwen25**

  1. Stop any loaded model:
  ```bash
  ollama ps   # check what's loaded
  # if something is loaded: ollama stop <model-name>
  ```
  2. Reset entries (SQL commands above), verify count = 897
  3. In hoshi-trans settings: model = `hoshi-translator-qwen25`, system prompt = empty, temperature = `0.1`
  4. Start translation with limit 50, wait for completion
  5. Export debug JSON via the Export button in the sidebar
  6. Copy result:
  ```bash
  cd /home/blackat/project/hoshi-trans
  cp "engine_test/StandGirl-立ちんぼ六花の深い夜-/hoshi-trans-output/debug-translations.json" \
     tools/benchmark-qwen25.json
  ```
  7. Score:
  ```bash
  python3 tools/score_translations.py tools/benchmark-qwen25.json
  ```
  8. Note score in `docs/model-benchmark.md`

- [ ] **Step 2: Unload model, reset entries, benchmark gemma2**

  1. Stop the previous model: `ollama stop hoshi-translator-qwen25`
  2. Reset entries (SQL commands above), verify count = 897
  3. In settings: model = `hoshi-translator-gemma2`
  4. Start translation with limit 50, wait for completion
  5. Export debug JSON
  6. Copy result:
  ```bash
  cd /home/blackat/project/hoshi-trans
  cp "engine_test/StandGirl-立ちんぼ六花の深い夜-/hoshi-trans-output/debug-translations.json" \
     tools/benchmark-gemma2.json
  ```
  7. Score:
  ```bash
  python3 tools/score_translations.py tools/benchmark-gemma2.json
  ```
  8. Note score

- [ ] **Step 3: Unload model, reset entries, benchmark qwen35**

  1. Stop the previous model: `ollama stop hoshi-translator-gemma2`
  2. Reset entries (SQL commands above), verify count = 897
  3. In settings: model = `hoshi-translator-qwen35`
  4. Start translation with limit 50, wait for completion
  5. Export debug JSON
  6. Copy result:
  ```bash
  cd /home/blackat/project/hoshi-trans
  cp "engine_test/StandGirl-立ちんぼ六花の深い夜-/hoshi-trans-output/debug-translations.json" \
     tools/benchmark-qwen35.json
  ```
  7. Score:
  ```bash
  python3 tools/score_translations.py tools/benchmark-qwen35.json
  ```
  8. Note score

---

### Task 5: Document results and choose winner

**Files:**
- Create: `docs/model-benchmark.md`

- [ ] **Step 1: Write results table**

Create `docs/model-benchmark.md` with the following template and fill in real scores.

> The baseline score for `llama3.1:8b-instruct-q4_K_M` comes from Chunk 1 Task 1 Step 5 output — copy it here.

```markdown
# Model Benchmark Results

Date: 2026-03-14
Game: StandGirl-立ちんぼ六花の深い夜-
Entries tested: 50 (first 50 pending entries, same set for all models)
Hardware: GTX 1660 SUPER 6GB VRAM
Scoring: tools/score_translations.py

## Scores

| Model | Score | Meta leaks | PH broken | PH hallucinated | Empty | Adult OK | Speed (s/50) | VRAM |
|-------|-------|-----------|-----------|-----------------|-------|----------|-------------|------|
| llama3.1:8b-instruct-q4_K_M (baseline) | ?/100 | ? | ? | ? | ? | ? | ? | 4.7 GB |
| hoshi-translator-qwen25 | ?/100 | ? | ? | ? | ? | ? | ? | 4.1 GB |
| hoshi-translator-gemma2 | ?/100 | ? | ? | ? | ? | ? | ? | 5.4 GB |
| hoshi-translator-qwen35 | ?/100 | ? | ? | ? | ? | ? | ? | 2.5 GB |

> **Adult OK**: did the model refuse or censor any adult-content entries? Yes = no refusals (good), No = model refused/censored entries (disqualifying for this use case).
> **Speed**: wall-clock seconds from "Start" to completion of 50 entries.

## Winner

**[model name]** — [1 sentence reason]

## Notes

- Any observed issues not captured by scoring script (sense inversions, hallucinated content, etc.)
```

- [ ] **Step 2: Update `hoshi-translator.Modelfile` with winning model**

Edit `src-tauri/modelfiles/hoshi-translator.Modelfile` — change `FROM` to the winner, copy the improved system prompt.

- [ ] **Step 3: Recreate the main hoshi-translator Ollama model**

```bash
cd /home/blackat/project/hoshi-trans
ollama create hoshi-translator \
  -f src-tauri/modelfiles/hoshi-translator.Modelfile
```

- [ ] **Step 4: Final validation — run 50 entries with hoshi-translator**

Reset entries (SQL + verify above), translate 50 with `hoshi-translator`, score:

```bash
cd /home/blackat/project/hoshi-trans
python3 tools/score_translations.py \
  "engine_test/StandGirl-立ちんぼ六花の深い夜-/hoshi-trans-output/debug-translations.json"
```

Expected: score ≥ winner's benchmark score (should be identical since same model).

- [ ] **Step 5: Commit all**

```bash
git add docs/model-benchmark.md src-tauri/modelfiles/hoshi-translator.Modelfile \
        tools/benchmark-*.json
git commit -m "docs: model benchmark results — chose [winner] as hoshi-translator base"
```

---

## Done

All tasks complete:
- Automated scoring script available at `tools/score_translations.py`
- Three candidate Modelfiles created and tested
- Winner documented in `docs/model-benchmark.md`
- `hoshi-translator` Ollama model updated to use best base model
