# hoshi-trans — CONTEXT.md

> Ce fichier est lu au début de chaque session de développement.
> Version : 0.7 — Wolf RPG order_index fix + font override at injection

---

## 🎯 Qu'est-ce que hoshi-trans ?

Application desktop Tauri pour traduire les textes de jeux japonais (RPG Maker MV/MZ, Wolf RPG, Bakin) via Ollama en local. Pipeline : extraction → traduction batch (offline) → réinjection.

**Langues :** JP → EN, JP → FR.

---

## ⚡ Séparation des responsabilités — Règle fondamentale

```
┌──────────────────────────────────────────────────────────────┐
│  RUST (src-tauri)               │  REACT (src/)              │
│                                 │                            │
│  • Accès fichiers système       │  • Toute l'UI              │
│  • Parsing / injection jeu      │  • Appels Tauri commands   │
│  • Appels Ollama (ollama-rs)    │  • State local (Zustand)   │
│  • TOUT le SQL (sqlx)           │  • File picker (plugin)    │
│  • Sidecars WolfTL/UberWolf     │  • Opener output/ + Ko-fi  │
│  • Logique placeholders/skip    │  • Notifications, window   │
│  • Lecture/écriture .hoshi.json │  • QR codes donations      │
└──────────────────────────────────────────────────────────────┘
```

### Règle SQL : tout passe par Rust
**React ne touche jamais SQLite directement.**
Toutes les opérations DB passent par des Tauri commands Rust (`sqlx`).
React appelle `invoke('get_entries', {...})` — jamais `@tauri-apps/plugin-sql`.

**Pourquoi SQLx et pas `tauri-plugin-sql` ?**
- `sqlx` : async natif Rust, requêtes vérifiées à la compile, performances maximales
- `tauri-plugin-sql` : chaque requête passe par IPC → trop lent pour les inserts batch post-extraction

---

## 🏗️ Stack complète

### Frontend (React)
| Lib | Rôle |
|---|---|
| React 19 + TypeScript | UI |
| Tailwind CSS + shadcn/ui | Styling + composants |
| Zustand | State (projet actif, statut batch, config Ollama) |
| TanStack Query | Cache + loading/error states sur les Tauri commands |
| `@tauri-apps/plugin-dialog` | File picker natif (sélection dossier jeu) |
| `@tauri-apps/plugin-opener` | Ouvrir `output/` + Ko-fi URL dans le browser |
| `@tauri-apps/plugin-notification` | Notif "Batch terminé" en arrière-plan |
| `@tauri-apps/plugin-window-state` | Mémoriser taille/position fenêtre |
| `@tauri-apps/plugin-single-instance` | Focus fenêtre existante si double-lancement |
| `qrcode.react` | QR codes adresses crypto (page donations) |

### Backend (Rust)
| Crate | Rôle |
|---|---|
| `tauri` v2 | Core |
| `sqlx` features sqlite,runtime-tokio | SQLite async — toute la DB |
| `tauri-plugin-shell` | Sidecars WolfTL/UberWolf |
| `tauri-plugin-fs` | Accès fichiers **exposé au frontend** via Tauri commands — pour la lecture interne Rust, utiliser `std::fs` ou `tokio::fs` directement |
| `tauri-plugin-log` | Logs structurés |
| `ollama-rs` 0.3.3 | Health check, list models, generate |
| `serde` + `serde_json` | Parsing JSON RPG Maker + `.hoshi.json` |
| `walkdir` | Scan récursif `data/` |
| `encoding_rs` | Shift-JIS → UTF-8 (Wolf RPG) |
| `anyhow` + `thiserror` | Gestion d'erreurs |
| `uuid` | IDs projet + entrées |
| `tokio` | Async runtime |

---

## 📁 Structure du projet

```
hoshi-trans/
├── src/                              # Frontend React
│   ├── components/
│   │   ├── ui/                       # shadcn/ui (ne pas modifier)
│   │   └── app/                      # Composants métier
│   ├── features/
│   │   ├── onboarding/               # Écran si Ollama absent
│   │   ├── translation/              # Vue liste strings + édition
│   │   ├── file-import/              # Sélection dossier + détection moteur
│   │   ├── file-export/              # Export + ouverture output/
│   │   ├── ollama/                   # OllamaPage : connexion, modèle, température, prompt, RunPod
│   │   ├── settings/                 # SettingsPage : préférences app (thème dark/light, couleur accent)
│   │   ├── about/                    # AboutPage : infos app + liens donations (Ko-fi, GitHub Sponsors)
│   │   ├── glossary/                 # Glossaire global + par projet
│   │   └── project-library/          # Grille de tous les projets
│   ├── hooks/
│   │   ├── useOllamaStatus.ts        # invoke check_ollama
│   │   ├── useProject.ts             # invoke get_project, get_entries...
│   │   └── useTranslationBatch.ts    # invoke translate_batch + progress events
│   ├── lib/
│   │   └── constants.ts              # Ko-fi URL + adresses crypto
│   ├── stores/
│   │   └── appStore.ts               # Zustand
│   ├── types/
│   │   └── index.ts                  # Types TS miroir des structs Rust
│   └── App.tsx
│
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── project.rs            # create_project, get_projects, open_project, delete_project, update_wolf_rpg_font
│   │   │   ├── entries.rs            # get_entries, update_translation, update_status
│   │   │   ├── extract.rs            # extract_strings → parse + insert batch DB + write .hoshi.json
│   │   │   ├── inject.rs             # inject_translations → output/
│   │   │   └── ollama.rs             # check_ollama, list_models, translate_batch
│   │   ├── db/
│   │   │   ├── mod.rs                # init_pool()
│   │   │   └── queries.rs            # Toutes les requêtes sqlx
│   │   ├── engines/
│   │   │   ├── mod.rs                # Trait GameEngine
│   │   │   ├── common/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── placeholders.rs   # Helpers partagés (regex JP, encode/decode générique)
│   │   │   │   └── skip.rs           # Skip commun : vide, pas JP, chemin, script, nombre pur
│   │   │   ├── rpgmaker_mv_mz/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── extractor.rs
│   │   │   │   ├── injector.rs
│   │   │   │   ├── placeholders.rs   # \N[1]→{{ACTOR_NAME[1]}}, \C[2]→{{COLOR[2]}}...
│   │   │   │   ├── skip.rs           # Skip RPG Maker + appelle common::skip
│   │   │   │   └── ENGINE_NOTES.md
│   │   │   ├── wolf_rpg/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── sidecar.rs
│   │   │   │   ├── placeholders.rs   # Codes Wolf spécifiques
│   │   │   │   ├── skip.rs           # Skip Wolf + appelle common::skip
│   │   │   │   └── ENGINE_NOTES.md
│   │   │   └── bakin/
│   │   │       ├── mod.rs
│   │   │       ├── placeholders.rs   # Codes Bakin spécifiques
│   │   │       ├── skip.rs           # Skip Bakin + appelle common::skip
│   │   │       └── ENGINE_NOTES.md
│   │   ├── models/
│   │   │   ├── translation.rs        # TranslationEntry, TranslationStatus
│   │   │   └── project.rs            # ProjectFile, ProjectStats, EngineType
│   │   └── main.rs
│   ├── bin/
│   │   ├── WolfTL-x86_64-pc-windows-msvc.exe
│   │   └── UberWolf-x86_64-pc-windows-msvc.exe
│   ├── migrations/
│   │   └── 001_init.sql
│   └── Cargo.toml
│
├── .github/workflows/release.yml
├── CONTEXT.md
├── PRD.md
├── CHANGELOG.md
├── CLAUDE_CODE_PROMPT.md
└── TODO.md
```

---

## 📄 Fichier projet `hoshi-trans.json`

### Concept
Créé automatiquement dans le **dossier du jeu** lors de la première extraction.
C'est la mémoire légère du projet — métadonnées + stats + lien vers la DB.

```
/home/user/games/MyGame/
├── data/               ← fichiers du jeu (ne pas toucher)
├── hoshi-trans.json    ← créé par hoshi-trans
└── hoshi-trans-output/ ← dossier de sortie (créé à l'export)
```

### Structure JSON

```json
{
  "version": "1",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
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
  "output_dir": "/home/user/games/MyGame/hoshi-trans-output",
  "wolf_rpg_font_size": 20
}
```

### Comportement au démarrage

```
Utilisateur sélectionne un dossier
        │
        ▼
hoshi-trans.json existe ?
    ├── OUI → lire project_id → project_id existe en DB ?
    │             ├── OUI → ouvrir projet
    │             └── NON → DB corrompue/supprimée → traiter comme nouveau projet
    │                        (réécrire hoshi-trans.json avec un nouvel id)
    └── NON → détecter moteur → créer projet DB → écrire hoshi-trans.json → extraction
```

### Dossier read-only (ex: jeu installé via Steam sous Windows)

Si `hoshi-trans.json` ne peut pas être écrit dans le dossier du jeu :
- Logger un warning
- Stocker le JSON dans `app_data_dir/projects/<uuid>.json` à la place
- Le chemin alternatif est enregistré dans la DB (`projects.json_path`)

### Struct Rust

```rust
// src-tauri/src/models/project.rs
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProjectFile {
    pub version: String,
    pub project_id: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub game_dir: String,
    pub engine: EngineType,
    pub game_title: String,
    pub target_lang: String,
    pub stats: ProjectStats,
    pub last_model: Option<String>,
    pub output_dir: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wolf_rpg_font_size: Option<u32>,  // Wolf RPG only — font size prepended at injection
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProjectStats {
    pub total: u32,
    pub translated: u32,
    pub reviewed: u32,
    pub skipped: u32,
    pub error: u32,
    pub pending: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EngineType {
    RpgmakerMvMz,
    WolfRpg,
    Bakin,
}
```

### Règles
- Créé et mis à jour par Rust uniquement
- React le reçoit via Tauri command (sérialisé), ne l'écrit jamais
- Mis à jour après chaque batch (stats) et chaque modification de config

---

## 🗄️ SQLite avec SQLx

### Schema (`migrations/001_init.sql`)

```sql
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    game_dir    TEXT NOT NULL UNIQUE,
    engine      TEXT NOT NULL,
    game_title  TEXT NOT NULL,
    target_lang TEXT NOT NULL DEFAULT 'en',
    json_path   TEXT,          -- NULL = hoshi-trans.json dans game_dir, sinon chemin alternatif (dossier read-only)
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);
-- Note : un projet = un jeu + une langue cible.
-- Pour traduire le même jeu en EN et FR, créer deux projets distincts dans deux dossiers différents.
```

CREATE TABLE IF NOT EXISTS entries (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL,
    source_text  TEXT NOT NULL,
    translation  TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',
    context      TEXT,
    file_path    TEXT NOT NULL,
    order_index  INTEGER NOT NULL DEFAULT 0,  -- position dans le fichier source, CRITIQUE pour l'injection
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entries_project_status ON entries(project_id, status);
CREATE INDEX IF NOT EXISTS idx_entries_order ON entries(project_id, file_path, order_index);
```

### Init pool (partagé via `tauri::State`)

```rust
// src-tauri/src/db/mod.rs
pub async fn init_pool(app_data_dir: &str) -> anyhow::Result<SqlitePool> {
    let db_path = format!("{}/hoshi-trans.db", app_data_dir);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&format!("sqlite://{}?mode=rwc", db_path))
        .await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

// src-tauri/src/main.rs — comment obtenir app_data_dir en Tauri v2 :
// let app_data_dir = app.path().app_data_dir()?.to_string_lossy().to_string();
// let pool = init_pool(&app_data_dir).await?;
// app.manage(pool);
```

### Insert batch post-extraction (transaction unique)

```rust
pub async fn insert_entries_batch(
    pool: &SqlitePool,
    entries: &[TranslationEntry],
) -> anyhow::Result<()> {
    let mut tx = pool.begin().await?;
    for entry in entries {
        sqlx::query!(
            "INSERT OR IGNORE INTO entries
             (id, project_id, source_text, status, context, file_path, order_index)
             VALUES (?, ?, ?, 'pending', ?, ?, ?)",
            entry.id, entry.project_id, entry.source_text,
            entry.context, entry.file_path, entry.order_index
        )
        .execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}
```

---

## 🦀 Trait `GameEngine` + modèles

```rust
// Trait async obligatoire — le contexte Tauri v2 est entièrement async (tokio)
// Des méthodes sync bloqueraient le runtime ou forceraient un block_in_place hacky
#[async_trait::async_trait]
pub trait GameEngine {
    fn detect(game_dir: &std::path::Path) -> bool;
    async fn extract(game_dir: &std::path::Path) -> anyhow::Result<Vec<TranslationEntry>>;
    async fn inject(
        game_dir: &std::path::Path,
        entries: &[TranslationEntry],
        output_dir: &std::path::Path,
    ) -> anyhow::Result<()>;
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TranslationEntry {
    pub id: String,
    pub project_id: String,
    pub source_text: String,
    pub translation: Option<String>,
    pub status: TranslationStatus,
    pub context: Option<String>,
    pub file_path: String,
    pub order_index: i64,  // position dans le fichier source — CRITIQUE pour injection dans le bon ordre
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranslationStatus {
    Pending, Translated, Reviewed, Skipped,
    Error(String), Warning(String),
}
```

> ⚠️ `async_trait` requiert la crate `async-trait = "0.1"` dans `Cargo.toml`.

---

## 🎮 Moteurs

### RPG Maker MV / MZ (P1)
Détection : `data/System.json` + champ `"gameTitle"`.

| Fichier | Champs / Codes |
|---|---|
| `Map*.json`, `CommonEvents.json` | code `401` params[0], `102` params[0], `101` params[4] |
| `Actors/Items/Weapons/Armors/Skills/Enemies/States.json` | `name`, `description`, `message*` |
| `MapInfos.json`, `System.json` | `name`, `gameTitle`, `terms` |

### Wolf RPG (P2) — Dump-based (sans sidecar)

Pipeline : l'utilisateur fournit le dossier `dump/` produit par WolfTL. hoshi-trans lit directement les JSON.

| Dossier/Fichier | Champs extraits |
|---|---|
| `mps/*.json` | `events[].pages[].list[]` — codeStr `Message` (101), `Choices` (102), `SetString` (122) |
| `common/*.json` | `commands[]` — mêmes codeStr |
| `db/DataBase.json` | `types[].data[].data[].value` (strings uniquement) — `item["name"]`/`["description"]` ignorés (labels éditeur, doublons) |
| `db/CDataBase.json` | **Skippé entièrement** — store de variables runtime, lookup par nom à l'exécution. Traduire les noms casse le moteur. |
| `db/SysDatabase.json` | **Skippé** — configuration moteur interne uniquement |
| `Game.json` | `Title`, `TitlePlus`, `StartUpMsg`, `TitleMsg` |

**order_index (mps) :**
- Formule : `event_id * 1_000_000 + page_id * 100_000 + cmd_index` — encode l'event, la page et le cmd dans un seul entier globalement unique par fichier.
- Raison : `cmd["index"]` est **local** à chaque liste event/page. Plusieurs events dans le même fichier peuvent partager les mêmes valeurs d'index → collision sur la contrainte `UNIQUE(project_id, file_path, order_index)` → `INSERT OR IGNORE` silencieux supprimait les doublons (187 dialogues perdus détectés sur ホノカ Map009.json).
- `Choices` : `mps_order_index * 100 + position_option` — car toutes les options partagent le même `cmd.index`.
- **Common files** : `order_index = cmd_index` directement (pas de context event/page).

**Font override à l'injection (Wolf RPG) :**
- `ProjectFile.wolf_rpg_font_size: Option<u32>` — taille de police injectée en préfixe sur chaque texte traduit (Message, Choices, SetString).
- Format : `\f[n]texte` — skippé si le texte commence déjà par `\f[`.
- Commande `update_wolf_rpg_font(game_dir, font_size)` — lit/écrit `hoshi-trans.json`.
- UI sidebar : panel compact sous la carte projet, uniquement pour les projets Wolf RPG. Indicateur `~X chars/line` calculé selon la taille.

**Injection :** écrit dans `output/` (non-destructif), applique la signature `| TL: hoshi-trans` au champ `Title` de `Game.json`.

**Résolution du dump :** si l'utilisateur ouvre la racine du jeu, `resolve_dump_dir()` cherche `dump/mps/` automatiquement.

### Bakin (P3)
`data.rbpack` → unpack → `dic.txt` (clé`\t`valeur) → inject.

---

## 🔄 Placeholders + Skip

### Architecture

Deux niveaux distincts pour chaque moteur :

```
engines/common/skip.rs          ← skip universel (tous moteurs)
engines/common/placeholders.rs  ← helpers partagés (détection JP, encode/decode générique)
engines/<moteur>/skip.rs        ← skip spécifique + délègue à common::skip
engines/<moteur>/placeholders.rs ← table complète codes ↔ {{NOM}} du moteur
```

### `common/placeholders.rs` — contenu exact

Ce fichier contient uniquement les utilitaires partagés entre tous les moteurs :

```rust
// Détection de caractères japonais — utilisée par common/skip.rs et les moteurs
pub fn contains_japanese(text: &str) -> bool {
    text.chars().any(|c| matches!(c,
        '\u{3040}'..='\u{309F}'  // Hiragana
        | '\u{30A0}'..='\u{30FF}' // Katakana
        | '\u{4E00}'..='\u{9FFF}' // CJK (Kanji)
    ))
}

// Vérifie que tous les placeholders {{...}} présents dans `original`
// sont toujours présents dans `translated`
pub fn check_placeholders_intact(original: &str, translated: &str) -> bool {
    let re = regex::Regex::new(r"\{\{[^}]+\}\}").unwrap();
    re.find_iter(original).all(|m| translated.contains(m.as_str()))
}
```

> Les tables de mapping codes ↔ `{{NOM}}` sont dans le `placeholders.rs` **de chaque moteur**, pas ici.

```rust
pub fn should_skip(text: &str) -> bool {
    is_empty_or_whitespace(text)
    || !contains_japanese(text)   // Hiragana \u{3040}-\u{309F}, Katakana \u{30A0}-\u{30FF}, CJK \u{4E00}-\u{9FFF}
    || is_file_path(text)         // commence par / ou contient ://
    || is_script_formula(text)    // contient $game, .value(, eval(
    || is_pure_number(text)       // regex ^\d+$
}
// Texte mixte JP+EN → contains_japanese() retourne true → on traduit
```

### `<moteur>/skip.rs` — Pattern d'appel

```rust
use crate::engines::common::skip as common_skip;

pub fn should_skip(text: &str) -> bool {
    if common_skip::should_skip(text) { return true; }
    // Règles spécifiques au moteur ici
    is_system_term(text) || is_internal_variable(text)
}
```

### `<moteur>/placeholders.rs` — Pattern encode/decode

```rust
pub fn encode(text: &str) -> String {
    // Remplace codes moteur → {{NOM_EXPLICITE}} avant envoi à Ollama
    text.replace(r"\N[", "{{ACTOR_NAME[")  // exemple RPG Maker
}

pub fn decode(text: &str) -> (String, bool) {
    // Restaure {{NOM}} → codes originaux après traduction Ollama
    // Retourne (texte_restauré, placeholders_intacts: bool)
    // Si bool = false → TranslationStatus::Warning(...)
}
```

Tables complètes des codes par moteur → dans les `ENGINE_NOTES.md` respectifs.

---

## 🤖 Ollama (Rust uniquement)

```rust
// Deux states AtomicBool gérés via tauri::State :
// - Arc<AtomicBool>   : cancel flag (reset à false au début de chaque batch)
// - BatchRunning(Arc<AtomicBool>) : batch en cours (true pendant, false après)
// Déclarés dans lib.rs setup() :
//   app.manage(Arc::new(AtomicBool::new(false)));
//   app.manage(BatchRunning(Arc::new(AtomicBool::new(false))));

#[tauri::command]
pub async fn translate_batch(
    window: tauri::Window,
    app: tauri::AppHandle,
    pool: tauri::State<'_, SqlitePool>,
    cancel_flag: tauri::State<'_, Arc<AtomicBool>>,
    batch_running: tauri::State<'_, BatchRunning>,
    project_id: String,
    model: String,
    target_lang: String,
    system_prompt: String,
    ollama_host: String,
    concurrency: u32,
    limit: u32,
    temperature: f32,
    entry_ids: Option<Vec<String>>,  // si Some → traduit ces entrées spécifiques
) -> Result<(), String>
// Émet window.emit("translation:progress", TranslationProgress { done, total, entry_id })
// Émet window.emit("translation:complete", ()) à la fin
// Vérifie cancel_flag avant chaque entrée
// Post-processing : remplace \" par " dans la réponse Ollama (artefact LLM)

// is_batch_running : permet au frontend de se re-subscribe après rechargement
#[tauri::command]
pub async fn is_batch_running(batch_running: tauri::State<'_, BatchRunning>) -> Result<bool, String>

// get_entries_by_ids : pour traduire une sélection d'entrées
pub async fn get_entries_by_ids(pool: &SqlitePool, ids: &[String]) -> anyhow::Result<Vec<TranslationEntry>>
```

**Re-connexion après rechargement webview :** `useTranslationBatch` appelle `is_batch_running` au montage. Si `true`, re-subscribe à `translation:progress` + `translation:complete` → l'indicateur reprend sans intervention.

### Types TypeScript miroir (`src/types/index.ts`)

Ces types doivent correspondre exactement aux structs Rust sérialisées :

```ts
// Miroir de TranslationEntry (Rust)
export interface TranslationEntry {
  id: string
  project_id: string
  source_text: string
  translation: string | null
  status: TranslationStatus
  context: string | null
  file_path: string
  order_index: number
}

// Miroir de TranslationStatus (Rust enum sérialisé en snake_case)
export type TranslationStatus =
  | 'pending'
  | 'translated'
  | 'reviewed'
  | 'skipped'
  | { error: string }
  | { warning: string }

// Payload de l'event "translation:progress"
export interface TranslationProgress {
  done: number
  total: number
  entry_id: string
}

// Miroir de ProjectFile (Rust)
export interface ProjectFile {
  version: string
  project_id: string
  created_at: number
  updated_at: number
  game_dir: string
  engine: 'rpgmaker_mv_mz' | 'wolf_rpg' | 'bakin'
  game_title: string
  target_lang: string
  stats: ProjectStats
  last_model: string | null
  output_dir: string
}

export interface ProjectStats {
  total: number
  translated: number
  reviewed: number
  skipped: number
  error: number
  pending: number
}
```

---

## 💰 Donations

Liens dans `AboutPage` (`src/features/about/AboutPage.tsx`) :
- Ko-fi : `https://ko-fi.com/katblackcoder`
- GitHub Sponsors : `https://github.com/sponsors/KATBlackCoder`

---

## ⚙️ Règles de développement

1. **React ne touche jamais SQLite ni les fichiers** — tout via Tauri commands
2. **`hoshi-trans.json` géré par Rust uniquement**
3. **Inject non-destructif** — toujours `output/`, jamais in-place
4. **Ollama batch only** — aucun appel pendant qu'un jeu tourne
5. **Trait GameEngine obligatoire** pour chaque moteur — méthodes `async` via `async-trait`
6. **`skip.rs` moteur appelle toujours `common::skip` en premier** — pas de duplication
7. **`placeholders.rs` moteur** — encode avant Ollama, decode après, Warning si placeholder manquant
8. **ENGINE_NOTES.md** — màj après chaque test sur un vrai jeu
9. **Commits atomiques** — `feat:`, `fix:`, `chore:`, `docs:`

---

## 📊 État actuel

- [x] Scaffold + ESLint + Prettier + TS strict
- [x] Architecture Rust (trait GameEngine, modèles, séparation stricte)
- [x] SQLx Rust (schema, migrations, init pool, insert batch)
- [x] Fichier projet `hoshi-trans.json` défini
- [x] Plugins Tauri (npm frontend uniquement)
- [x] Cargo.toml + CI/CD
- [x] Placeholders + skip logic (common + par moteur)
- [x] RPG Maker MV/MZ extractor + injector
- [x] Wolf RPG extractor + injector (dump-based, sans sidecar)
  - [x] Fix : CDataBase skippé entièrement (évite crash type 18 runtime)
  - [x] Fix : item["name"]/["description"] ignorés (évite doublons)
- [x] Interface de traduction + batch + annulation + sélection multi-lignes
- [x] Glossaire (global + par projet + import/export)
- [x] Batch translation re-connexion après rechargement webview
- [x] Signature `| TL: hoshi-trans` dans les titres de jeux exportés
- [x] Page Ollama (connexion, modèle, température, prompt, RunPod — layout 2 colonnes)
- [x] Page Settings (thème dark/light + couleur accent, persisté dans settings.json)
- [x] Page About (description app + Ko-fi + GitHub Sponsors + liens)
