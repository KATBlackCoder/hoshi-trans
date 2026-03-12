# PROMPT CLAUDE CODE — hoshi-trans

> Colle ce prompt au début de chaque nouvelle session Claude Code.
> Il remplace la lecture manuelle de CONTEXT.md.

---

## Instruction principale

Tu travailles sur **hoshi-trans**, une app desktop Tauri + React + TypeScript pour traduire
des textes de jeux japonais (RPG Maker MV/MZ, Wolf RPG, Bakin) via Ollama (local, offline).

**Lis ces fichiers AVANT toute action :**
1. `CONTEXT.md` — architecture complète, décisions techniques, état du projet
2. `TODO.md` — tâche(s) de cette session
3. `src-tauri/src/engines/<moteur>/ENGINE_NOTES.md` — si tu touches un moteur spécifique

---

## Règles absolues (ne jamais déroger)

### Séparation Rust / React

```
RUST  → accès fichiers, parsing/injection jeu, Ollama, DB (sqlx), hoshi-trans.json
REACT → UI, state (Zustand), file picker, opener, notifications, QR codes
```

**React ne touche JAMAIS SQLite directement.**
Toutes les opérations DB passent par des Tauri commands Rust.
React appelle `invoke('get_entries', {...})` — jamais une lib SQL côté JS.

**`hoshi-trans.json` est géré par Rust uniquement.**
React le reçoit via Tauri command sérialisée, ne l'écrit jamais.

### Code
- TypeScript strict — zéro `any`, zéro `@ts-ignore` sans commentaire justifié
- Rust — toutes les erreurs via `anyhow::Result` dans les commands Tauri
- Ne jamais modifier du code hors scope de la tâche en cours
- Commits atomiques : `feat:`, `fix:`, `chore:`, `docs:`

### Architecture moteurs (Rust)
- Chaque moteur dans son propre module : `src-tauri/src/engines/<nom>/`
- Tout nouveau moteur DOIT implémenter le trait `GameEngine` avec `#[async_trait]`
- `extract` et `inject` sont **async** — ne jamais les implémenter en sync (bloquerait tokio)
- L'injection ne touche JAMAIS les fichiers originaux du jeu — toujours dans `output/`

### Ollama
- Batch uniquement — aucun appel pendant qu'un jeu tourne
- Si Ollama absent → écran onboarding, pas d'erreur silencieuse
- Lib : `ollama-rs = "0.3.3"` — pas de reqwest direct

### Placeholders
- Avant traduction : encoder les codes moteur → `{{NOM_EXPLICITE}}`
- Après traduction : décoder les placeholders → codes originaux
- Si placeholder manquant dans la réponse Ollama : warning, pas de blocage
- Table complète dans `ENGINE_NOTES.md` de chaque moteur

### Skip logic
- Ne jamais envoyer à Ollama : strings vides, sans caractère JP, chemins de fichiers,
  formules de script, nombres purs
- Heuristique JP : détecter Hiragana `\u{3040}-\u{309F}`, Katakana `\u{30A0}-\u{30FF}`,
  CJK `\u{4E00}-\u{9FFF}`
- Texte mixte (JP + EN) → toujours traduire

---

## Stack de référence rapide

```
Frontend : React 19 + TypeScript + Tailwind + shadcn/ui + Zustand + TanStack Query
Backend  : Tauri v2 (Rust) + sqlx (SQLite) + ollama-rs + serde_json + anyhow + walkdir
           async-trait (trait GameEngine async) + regex (vérification placeholders)
Storage  : SQLite via sqlx (Rust) — projets + entrées de traduction
           tauri-plugin-store — settings légers (modèle, langue, prompt)
CI/CD    : GitHub Actions — ubuntu-22.04 / windows-latest / macos-latest
```

> ⚠️ `tauri-plugin-fs` est déclaré mais sert uniquement si une Tauri command expose
> un accès fichier au frontend. Pour la lecture interne Rust (extraction/injection),
> utiliser `tokio::fs` directement — pas `tauri-plugin-fs`.

### Plugins Tauri actifs (tous déclarés dans Cargo.toml)
- `single-instance` — une seule instance à la fois (batch Ollama en cours)
- `dialog` — file picker natif
- `fs` — accès fichiers
- `opener` — ouvrir dossier output/ + Ko-fi URL
- `store` — settings clé-valeur
- `log` — logs structurés
- `shell` — sidecars WolfTL/UberWolf (P2)
- `process` — gestion exit codes (P2)

> ⚠️ `tauri-plugin-sql` n'est PAS utilisé. La DB est gérée par `sqlx` côté Rust pur.

---

## Fichier projet `hoshi-trans.json`

Créé automatiquement dans le **dossier du jeu** à la première extraction.

```json
{
  "version": "1",
  "project_id": "<uuid-v4>",
  "created_at": 1741564800,
  "updated_at": 1741564900,
  "game_dir": "/home/user/games/MyGame",
  "engine": "rpgmaker_mv_mz",
  "game_title": "魔法少女の冒険",
  "target_lang": "en",
  "stats": {
    "total": 1240,
    "translated": 856,
    "reviewed": 120,
    "skipped": 45,
    "error": 3,
    "pending": 216
  },
  "last_model": "qwen2.5:7b",
  "output_dir": "/home/user/games/MyGame/hoshi-trans-output"
}
```

**Flow d'ouverture :**
```
Dossier sélectionné
  ├── hoshi-trans.json existe → lire project_id → project_id en DB ?
  │       ├── OUI → ouvrir projet
  │       └── NON (DB corrompue/supprimée) → nouveau projet, réécrire JSON
  └── NON → détecter moteur → créer projet DB → écrire JSON → lancer extraction
```

**Dossier read-only :** si `hoshi-trans.json` ne peut pas être écrit dans le dossier du jeu,
stocker le JSON dans `app_data_dir/projects/<uuid>.json` et enregistrer le chemin dans la DB.

**app_data_dir en Tauri v2 :**
```rust
let dir = app.path().app_data_dir()?.to_string_lossy().to_string();
```

---

## Structure des dossiers clés

```
src/features/<feature>/         ← logique frontend par feature
src-tauri/src/commands/         ← Tauri commands exposées au frontend
src-tauri/src/db/               ← init_pool(), queries.rs (sqlx)
src-tauri/src/engines/
├── mod.rs                      ← trait GameEngine
├── common/
│   ├── skip.rs                 ← skip universel (vide, pas JP, chemin, script, nombre)
│   └── placeholders.rs         ← helpers partagés (détection JP, encode/decode générique)
├── <moteur>/
│   ├── placeholders.rs         ← codes moteur ↔ {{NOM_EXPLICITE}}
│   ├── skip.rs                 ← skip spécifique + délègue à common::skip
│   └── ...
src-tauri/src/models/           ← types partagés (TranslationEntry, ProjectFile...)
src-tauri/migrations/           ← 001_init.sql (sqlx migrate!)
src-tauri/bin/                  ← binaires externes (WolfTL.exe, UberWolf.exe)
```

**Pattern skip obligatoire dans chaque moteur :**
```rust
use crate::engines::common::skip as common_skip;
pub fn should_skip(text: &str) -> bool {
    if common_skip::should_skip(text) { return true; }
    // règles spécifiques au moteur...
}
```

**`order_index` obligatoire dans `TranslationEntry` :**
Position de l'entrée dans le fichier source. CRITIQUE pour l'injection — sans lui,
l'ordre des dialogues ne peut pas être reconstruit fidèlement.

**Types TS dans `src/types/index.ts` :**
Doivent rester en sync avec les structs Rust. Types clés à toujours vérifier :
`TranslationEntry`, `TranslationStatus`, `TranslationProgress`, `ProjectFile`, `ProjectStats`.
Le payload de l'event `"translation:progress"` est `TranslationProgress { done, total, entry_id }`.

---

## Tâche de cette session

> **Remplace cette section par la tâche du jour avant de lancer Claude Code.**
> Exemple :

```
## Tâche : Init DB + Ollama commands

Implémenter dans l'ordre :
1. `src-tauri/migrations/001_init.sql` — schema projets + entries + index
2. `src-tauri/src/db/mod.rs` — init_pool() via sqlx, partagé via tauri::State<SqlitePool>
3. `src-tauri/src/db/queries.rs` — insert_entries_batch() en transaction unique
4. `src-tauri/src/commands/ollama.rs` — check_ollama(), list_models(), translate_batch()
   avec progress events window.emit("translation:progress", { done, total, entry_id })
5. `src/hooks/useOllamaStatus.ts` — poll check_ollama toutes les 5s, redirect onboarding si absent

Ne pas implémenter l'extracteur RPG Maker dans cette session.
```

---

## Notes additionnelles

### Wolf RPG — sidecars UberWolf + WolfTL
Binaires dans `src-tauri/bin/` avec suffix target triple obligatoire :
`WolfTL-x86_64-pc-windows-msvc.exe`, `UberWolf-x86_64-pc-windows-msvc.exe`

Appel via `tauri-plugin-shell` :
```rust
use tauri_plugin_shell::ShellExt;
let output = app.shell()
    .sidecar("WolfTL")
    .args([data_dir, output_dir, "create"])
    .output().await?;
```
Sur Linux : détecter Wine avec `which wine` et préfixer si présent.

### Donations UI
- Page "Support" dans les Settings
- Adresses crypto : constantes hardcodées dans `src/lib/constants.ts`
- QR codes : `qrcode.react`
- Ko-fi : `tauri-plugin-opener` → `opener.open(KO_FI_URL)`

### ENGINE_NOTES.md
Si tu découvres un nouveau cas particulier (code spécial non listé, string à skipper,
comportement inattendu), **mets à jour ENGINE_NOTES.md** du moteur concerné
dans la section "Observations de tests" avec la date et le jeu testé.
