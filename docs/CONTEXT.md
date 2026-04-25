# hoshi-trans — CONTEXT.md

> Ce fichier est lu au début de chaque session de développement.
> Version : 1.1 — Unified modelfiles (4b/30b) + hoshi-prompts.json

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
│  • Logique placeholders/skip    │  • Opener output/ + Ko-fi  │
│  • Lecture/écriture .hoshi.json │  • Notifications, window   │
│                                 │  • QR codes donations      │
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
│   │   ├── translation/              # Vue liste strings + édition — TranslationView, BatchControls, TranslationRow (click-to-edit), FileStatsPanel (stats par fichier)
│   │   ├── file-import/              # Sélection dossier + détection moteur
│   │   ├── file-export/              # Export + ouverture output/
│   │   ├── ollama/                   # OllamaPage : connexion, 2 sélecteurs modèle (trans + refine), température, modèles disponibles
│   │   ├── settings/                 # SettingsPage : préférences app (thème dark/light, couleur accent)
│   │   ├── about/                    # AboutPage : infos app + Setup Guides (Local + RunPod) + liens donations
│   │   ├── glossary/                 # Glossaire global + par projet
│   │   └── project-library/          # Grille de tous les projets
│   ├── hooks/
│   │   ├── useOllamaStatus.ts        # invoke check_ollama
│   │   ├── useProject.ts             # invoke get_project, get_entries...
│   │   ├── useTranslationBatch.ts    # invoke translate_batch + progress events
│   │   └── useRefineBatch.ts         # invoke refine_batch + refine:progress/complete events
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
│   │   │   ├── entries.rs            # get_entries, get_file_stats, update_translation, update_status, update_refined_manual
│   │   │   ├── extract.rs            # extract_strings → parse + insert batch DB + write .hoshi.json
│   │   │   ├── inject.rs             # inject_translations → output/
│   │   │   └── ollama.rs             # check_ollama, list_models, translate_batch, refine_batch
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
│   ├── migrations/
│   │   ├── 001_init.sql
│   │   ├── 002_glossary.sql
│   │   ├── 003_unique_entries.sql
│   │   ├── 004_glossary_global.sql
│   │   ├── 005_refine_columns.sql    # 7 colonnes refine-pass nullable sur entries
│   │   ├── 006_translated_at.sql
│   │   ├── 007_token_counts.sql
│   │   ├── 008_glossary_timestamps.sql   # created_at + updated_at sur glossary
│   │   └── 009_glossary_global_usage.sql # table jonction global term ↔ projets
│   ├── Cargo.toml
│   └── tauri.conf.json           # bundle.windows: webviewInstallMode downloadBootstrapper, nsis perUser → currentUser
│
├── .github/
│   └── workflows/
│       └── release.yml           # CI/CD : AppImage (ubuntu-22.04) + NSIS (windows-latest) → GitHub Release sur tag v*.*.*
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

### Schema (`migrations/001_init.sql` + `005_refine_columns.sql`)

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
    order_index      INTEGER NOT NULL DEFAULT 0,  -- position dans le fichier source, CRITIQUE pour l'injection
    -- Refine-pass columns (migration 005) — all nullable, NULL before refine is run
    refined_text     TEXT,
    refined_status   TEXT,     -- 'reviewed' | 'unchanged' | 'manual'
    ph_count_source  INTEGER,  -- count of {{...}} tokens in encoded source
    ph_count_draft   INTEGER,  -- count of {{...}} tokens in encoded draft translation
    ph_count_refined INTEGER,  -- count of {{...}} tokens in encoded refined text
    text_type        TEXT,     -- 'dialogue' | 'item' | 'ui' | 'general' (inferred from file_path)
    refined_at       INTEGER,  -- unix timestamp of last refine
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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct TranslationEntry {
    pub id: String,
    pub project_id: String,
    pub source_text: String,
    pub translation: Option<String>,
    pub status: String,         // stored as string in DB; use TranslationStatus for app logic
    pub context: Option<String>,
    pub file_path: String,
    pub order_index: i64,       // CRITIQUE pour injection dans le bon ordre
    // Refine-pass fields — None before refine is run
    pub refined_text: Option<String>,
    pub refined_status: Option<String>,   // "reviewed" | "unchanged" | "manual"
    pub ph_count_source: Option<i64>,
    pub ph_count_draft: Option<i64>,
    pub ph_count_refined: Option<i64>,
    pub text_type: Option<String>,
    pub refined_at: Option<i64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranslationStatus {
    Pending, Translated, Reviewed, Skipped,
    Error(String), Warning(String),
}

/// Status of the refine pass — stored as string in DB.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RefinedStatus {
    Reviewed,   // thinking model changed at least one character
    Unchanged,  // thinking model confirmed draft was already correct
    Manual,     // user manually edited refined_text
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
// Trois states AtomicBool gérés via tauri::State :
// - Arc<AtomicBool>    : cancel flag partagé (reset à false au début de chaque batch/refine)
// - BatchRunning(Arc<AtomicBool>)  : batch de traduction en cours
// - RefineRunning(Arc<AtomicBool>) : batch de refine en cours
// Déclarés dans lib.rs setup() :
//   app.manage(Arc::new(AtomicBool::new(false)));
//   app.manage(BatchRunning(Arc::new(AtomicBool::new(false))));
//   app.manage(RefineRunning(Arc::new(AtomicBool::new(false))));

#[tauri::command]
pub async fn translate_batch(
    window: tauri::Window,
    app: tauri::AppHandle,
    pool: tauri::State<'_, SqlitePool>,
    cancel_flag: tauri::State<'_, Arc<AtomicBool>>,
    batch_running: tauri::State<'_, BatchRunning>,
    project_id: String,
    model: String,
    ollama_host: String,
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

**Pipeline de traduction en deux phases (séquentiel — pas de parallélisme) :**

- **Phase 1 — item/ui/general** : fichiers non-dialogue traités en premier. Chaque entrée traduite dont `source_text.chars().count() <= 10` est ajoutée à `auto_terms`.
- **Auto-inject** : après Phase 1, `bulk_insert_auto_glossary` insère les `auto_terms` dans le glossaire projet (`INSERT OR IGNORE`). Le glossaire est re-fetché pour que Phase 2 en bénéficie.
- **Phase 2 — dialogue** : fichiers `mps/`, `common/`, `map` traités séquentiellement. Avant chaque entrée, `get_preceding_translated` remonte jusqu'à **5** entrées traduites du même fichier → formatées comme `[Previous lines]\n- src → tgt`.
- `filter_glossary_for_text` : sélectionne uniquement les termes du glossaire dont `source_term` est contenu littéralement dans le texte de l'entrée courante.
- `format_context_block` + `format_glossary_block` → injectés dans `build_translate_prompt(glossary_block, context_block, text)`.

**DB queries liées :**
- `get_glossary_for_translation(pool, project_id, lang)` — retourne global + project-scoped, project override global
- `get_preceding_translated(pool, project_id, file_path, before_order, limit)` — N entrées `status='translated'` avant `order_index`, ordre chronologique
- `bulk_insert_auto_glossary(pool, project_id, terms)` — INSERT OR IGNORE + appelle `record_global_term_usage` par terme
- `record_global_term_usage(pool, project_id, source_term, lang)` — INSERT OR IGNORE dans `glossary_global_usage` si le terme existe en global

**Re-connexion après rechargement webview :** `useTranslationBatch` appelle `is_batch_running` au montage. Si `true`, re-subscribe à `translation:progress` + `translation:complete` → l'indicateur reprend sans intervention.

### Refine pass (second-pass quality review)

Le refine pass envoie les entrées déjà traduites à un modèle pour relecture et amélioration.

```rust
#[tauri::command]
pub async fn refine_batch(
    window: tauri::Window,
    app: tauri::AppHandle,
    pool: tauri::State<'_, SqlitePool>,
    cancel_flag: tauri::State<'_, Arc<AtomicBool>>,
    refine_running: tauri::State<'_, RefineRunning>,
    project_id: String,
    model: String,          // modèle refine sélectionné indépendamment du modèle trans (ex: hoshi-translator-27b-rev:latest)
    target_lang: String,
    ollama_host: String,
    concurrency: u32,       // cappé à 4 (thinking model lent)
    entry_ids: Option<Vec<String>>,  // None = toutes les entrées traduites
) -> Result<(), String>
// Émet "refine:progress" et "refine:complete"
```

**Pipeline refine par entrée :**
1. Récupère les entrées `status = 'translated' | 'warning:...'` avec `translation IS NOT NULL`
2. Re-encode `source_text` et `translation` avec `wolf_ph::encode` / `rpgmaker_ph::encode` → les `{{...}}` tokens sont restaurés pour le modèle
3. Envoie `(encoded_source, encoded_draft)` avec un prompt de critique
4. Décode la réponse du modèle avec `decode()`
5. Compare `decoded_refined.trim()` vs `draft.trim()` :
   - Différent → `refined_status = "reviewed"`
   - Identique → `refined_status = "unchanged"`
6. Sauvegarde `refined_text`, `refined_status`, counts placeholders, `text_type`, `refined_at`
7. Le statut `status` de l'entrée **n'est pas modifié** — seules les colonnes refine sont mises à jour

**Export COALESCE :** `get_translated_entries_ordered` utilise `COALESCE(refined_text, translation) AS translation` — les textes raffinés sont automatiquement exportés à la place du draft.

**Helpers :**
- `count_placeholders(text)` — compte les `{{...}}` tokens (i64)
- `infer_text_type(file_path)` — défini dans `src-tauri/src/engines/common/text_type.rs` (module partagé). Retourne `'dialogue'` | `'item'` | `'ui'` | `'general'`. **Point d'extension moteur** : ajouter les patterns de chemins du nouveau moteur ici — la logique est automatiquement appliquée partout (auto-glossary, feedback manuel, refine). Re-exporté dans `commands/ollama.rs` via `pub use`.
- `build_review_prompt(encoded_source, encoded_draft, ph_count_source, ph_count_draft, lang_name)` — prompt critique structuré

**Commande manuelle :** `update_refined_manual(entry_id, refined_text)` — déclenché quand l'utilisateur édite manuellement un texte raffiné → `refined_status = "manual"`.

**UI :**
- Contrôles translate + refine dans le composant `BatchControls` (voir ci-dessous)
- Per-row refine button (icône `Wand2`) visible uniquement sur entrées `translated` / `warning:*`
- Filtre status `Reviewed` dans la table
- `TranslationRow` : `✦` pour reviewed (avec draft barré en dessous), `✓` pour unchanged, `✎` pour manual
- Badge `⚠ N/M ph` si `ph_count_draft ≠ ph_count_source`

**Translation list improvements (v0.9) :**

- **Click-to-edit** — cliquer sur le texte de traduction dans `TranslationRow` ouvre le textarea directement (plus besoin du bouton crayon). `draft` est synced via `useEffect` quand `entry` change hors édition (ex. batch complété). `save()` appelle `update_refined_manual` si l'entrée a déjà un `refined_text`, sinon `update_translation`.
- **File filter dropdown** — `TranslationView` expose un `<Select>` dans la toolbar listant tous les fichiers du projet. Dérivé d'une query séparée sans `statusFilter` (évite que les fichiers 100% traduits disparaissent du dropdown). Le filtre actif est affiché en badge dans le header avec un bouton `×` pour effacer. Réinitialisé au changement de `projectId`.
- **FileStatsPanel + view toggle** — toggle LayoutList/BarChart2 dans la toolbar. En mode `files`, affiche `FileStatsPanel` : une ligne par fichier avec nom, compteurs (translated/warning/pending/total), progress bar verte+amber. Cliquer un fichier bascule en mode `list` avec ce fichier comme `fileFilter`.
- **`get_file_stats` command** — nouvelle query Rust dans `db/queries.rs`, struct `FileStats` dans `models/translation.rs`, command dans `commands/entries.rs`, type `FileStats` dans `src/types/index.ts`.

**Translation UI redesign (v1.0) :**

- **`BatchControls` component** (`src/features/translation/BatchControls.tsx`) — extrait du header de `TranslationView`. Regroupe les contrôles TL et RF dans deux boîtes bordées distinctes. Limit dans un `<Popover>` `⚙`. Affiche `Translate N` / `Refine N` quand des entrées sont sélectionnées. Progress + cancel inline dans chaque boîte.
- **Progress counter live** — le header affiche `done` et `pending` depuis `progress.done / progress.total` (event stream) pendant le batch, puis retombe sur les counts DB après (`refetch` sur `running → false`). Garantit que les deux compteurs bougent en sync.
- **Toolbar séparateur** — `<div className="w-px h-4 bg-border/30">` entre le groupe filtres (status chips, file dropdown, view toggle) et le groupe actions (retry warnings, export, search).
- **Row tinting** — fond subtil par statut dans `TranslationRow` via classes CSS dans `App.css` : `status-row-warning` (amber/3%), `status-row-reviewed` (bleu/4%), `status-row-error` (rouge/3%). Pending et translated restent sans tinte.

**Glossary UI :**

- **`GlossaryPage`** (`src/features/glossary/GlossaryPage.tsx`) — barre de filtres client-side entre le formulaire d'ajout et la table :
  - Search (source ou target term, `toLowerCase().includes`)
  - Scope : boutons `All` / `Global` + dropdown projet (affiche `game_title`, pas l'UUID)
  - Lang : boutons `All` / `EN` / `FR`
  - Compteur `N / total` affiché quand un filtre est actif
- **Sélection bulk** — checkbox par ligne + select-all dans le header (sélectionne les termes filtrés visibles). Bouton `Delete N` apparaît dans le header quand ≥ 1 terme sélectionné → appelle `delete_glossary_terms`. Ligne sélectionnée teintée `bg-primary/5`.
- **`delete_glossary_terms(ids: Vec<String>)`** — commande Rust (`commands/glossary.rs`) + query (`db/queries.rs`) : `DELETE FROM glossary WHERE id IN (...)` — une seule requête SQL pour toute la sélection.
- **`glossary_global_usage`** — table jonction `(global_term_id, project_id)` — `used_at` enregistré automatiquement par `bulk_insert_auto_glossary` via `record_global_term_usage`. Permet de savoir quels projets utilisent chaque terme global.
- **Feedback loop automatique** — deux chemins alimentent le glossaire projet automatiquement :
  - `update_refined_manual` et `update_translation` (Tauri commands) appellent `maybe_feed_glossary_from_manual` après save — conditions : `infer_text_type(file_path) != "dialogue"` ET `source_text ≤ 10 chars` → injecté (`INSERT OR IGNORE`). Concerne uniquement les sauvegardes UI (les batchs appellent `queries::update_translation` directement, non affectés). La condition dialogue utilise `engines/common/text_type.rs` — s'adapte automatiquement aux nouveaux moteurs.
  - Fin de `refine_batch` : `get_reviewed_short_for_glossary` + `bulk_insert_auto_glossary` injecte les entrées courtes `refined_status='reviewed'`.
- **Badge inconsistances** — `get_inconsistent_source_texts(project_id)` détecte les `source_text` ayant plusieurs traductions distinctes (`COALESCE(refined_text, translation)`). Badge `⚠ N inconsistent` dans la toolbar de `TranslationView` ; cliquer filtre la table sur ces entrées via `showInconsistent` state + `inconsistentTexts` TanStack Query (désactivée pendant les batchs).

---

## 🗂️ Modelfiles hoshi-translator

Les modèles hoshi-translator sont les **seuls modèles supportés** par l'app. Un modelfile par taille — pas de split trans/rev.

```
src-tauri/modelfiles/
  hoshi-translator-4b.Modelfile   # 4B local    (qwen3:4b-instruct-2507-q8_0)    ~3 GB VRAM
  hoshi-translator-30b.Modelfile  # 30B MoE     (qwen3:30b-a3b-instruct-2507-q8_0) ~20 GB VRAM — RunPod RTX 4090
```

### Paramètres partagés (4b et 30b)

| Paramètre | Valeur | Pourquoi |
|-----------|--------|---------|
| temperature | 0.3 | équilibré pour traduction et review |
| top_k | 40 | nucleus sampling standard |
| top_p | 0.9 | nucleus sampling standard |
| repeat_penalty | 1.1 | décourage les répétitions |
| min_p | 0.05 | filtre les tokens improbables |
| num_predict | 600 | suffisant pour les dialogues longs |
| num_ctx | 4096 (4b) / 8192 (30b) | fenêtre de contexte |

Les modèles `-instruct` utilisent un template ChatML sans bloc `{{- if .Thinking }}` — le thinking est désactivé au niveau du template, aucun stop token nécessaire.

### Prompt engineering — `hoshi-prompts.json`

Tout le texte spécifique aux tâches vit dans `src-tauri/prompts/hoshi-prompts.json`, embarqué au compile time via `include_str!()` et parsé une fois via `LazyLock<serde_json::Value>`.

- `translate.header` + `translate.rules` → assemblés par `build_translate_prompt()`
- `review.header` + `review.criteria` + `review.output_rule` → assemblés par `build_review_prompt()`

Pour modifier une règle de traduction ou un critère de review : éditer `hoshi-prompts.json` uniquement.

### ModelOptions — aucun paramètre custom dans l'app

Seul `temperature` est envoyé à l'appel (depuis les settings utilisateur). Tous les autres paramètres viennent du modelfile.

**Convention de nommage Ollama :** `hoshi-translator-4b:latest` / `hoshi-translator-30b:latest`

**Check bypass system prompt :** `model.includes('hoshi-translator')` → `system_prompt` envoyé vide (le SYSTEM est baked dans le Modelfile).

### Types TypeScript miroir (`src/types/index.ts`)

Ces types doivent correspondre exactement aux structs Rust sérialisées :

```ts
// Miroir de TranslationEntry (Rust)
export type RefinedStatus = 'reviewed' | 'unchanged' | 'manual'

export interface TranslationEntry {
  id: string
  project_id: string
  source_text: string
  translation: string | null
  status: TranslationStatus
  context: string | null
  file_path: string
  order_index: number
  // Refine-pass fields — null before refine is run
  refined_text: string | null
  refined_status: RefinedStatus | null
  ph_count_source: number | null
  ph_count_draft: number | null
  ph_count_refined: number | null
  text_type: string | null
  refined_at: number | null
}

// Miroir de TranslationStatus (Rust enum sérialisé en snake_case)
export type TranslationStatus =
  | 'pending'
  | 'translated'
  | 'reviewed'
  | 'skipped'
  | { error: string }
  | { warning: string }

// Miroir de FileStats (Rust) — retourné par get_file_stats
export interface FileStats {
  file_path: string
  total: number
  translated: number
  warning: number
  pending: number
}

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

## 🚀 CI/CD — GitHub Release

Sur chaque tag `v*.*.*`, le workflow `.github/workflows/release.yml` build et publie automatiquement deux artefacts.

### Architecture du workflow

```
tag push v*.*.*
    ├── build-linux  (ubuntu-22.04)   → hoshitrans_X.X.X_amd64.AppImage
    └── build-windows (windows-latest) → hoshitrans_X.X.X_x64-setup.exe
              ↓ (needs: both)
          release    (ubuntu-latest)  → GitHub Release avec les deux fichiers
```

### Décisions techniques

| Choix | Raison |
|---|---|
| `ubuntu-22.04` fixé (non `ubuntu-latest`) | glibc 24.04 refuse de tourner sur Ubuntu 20.04 / Debian 11 — toujours utiliser 22.04 |
| `--bundles appimage` / `--bundles nsis` | Build uniquement le format cible en CI (pas tous les formats) |
| `libayatana-appindicator3-dev` uniquement | `libappindicator3-dev` (deprecated) conflit avec ayatana sur ubuntu-22.04 — ne pas réajouter |
| `nsis.installMode: "currentUser"` | Valeur valide du schéma Tauri v2 — `"perUser"` n'existe pas |
| `Swatinem/rust-cache@v2` | Cache `~/.cargo` + `src-tauri/target` par job |
| `softprops/action-gh-release@v2` | Crée la release + upload les artefacts + `generate_release_notes: true` |
| `if-no-files-found: error` | Fail explicite si le glob d'artefact ne matche rien |

### Déclencher une nouvelle release

```bash
git push origin main
git tag v0.2.0
git push origin v0.1.0  # remplacer par la nouvelle version
```

Pour re-déclencher un tag existant :
```bash
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0
git tag v0.1.0
git push origin v0.1.0
```

### `tauri.conf.json` — bundle Windows

```json
"bundle": {
  "windows": {
    "webviewInstallMode": { "type": "downloadBootstrapper" },
    "nsis": { "installMode": "currentUser" }
  }
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
- [x] Glossaire (global + par projet + import/export + filtres + bulk delete)
- [x] Batch translation re-connexion après rechargement webview
- [x] Signature `| TL: hoshi-trans` dans les titres de jeux exportés
- [x] Page Ollama (connexion, 2 sélecteurs modèle trans/refine, température, modèles disponibles — layout 2 colonnes)
- [x] Page Settings (thème dark/light + couleur accent, persisté dans settings.json)
- [x] Page About (description app + Setup Guides Local/RunPod + Ko-fi + GitHub Sponsors + liens)
- [x] Refine pass (second-pass quality review)
  - [x] Migration 005 : 7 colonnes refine nullable sur `entries`
  - [x] `refine_batch` command + `RefineRunning` state + `cancel_refine` / `is_refine_running`
  - [x] `update_refined_manual` pour éditions utilisateur
  - [x] Export COALESCE : `refined_text` priorisé sur `translation` à l'injection
  - [x] UI : bouton Refine (amber), filtre Reviewed, `✦`/`✓`/`✎` badges, ⚠ placeholder count diff
  - [x] Per-row refine button (visible sur entrées `translated`/`warning`)
  - [x] Sélecteur modèle refine indépendant du sélecteur trans (pas d'auto-select)
- [x] Unified modelfiles (4b/30b) — un modelfile par taille, pas de split trans/rev
  - [x] `src-tauri/modelfiles/hoshi-translator-4b.Modelfile` — qwen3:4b-instruct-2507-q8_0
  - [x] `src-tauri/modelfiles/hoshi-translator-30b.Modelfile` — qwen3:30b-a3b-instruct-2507-q8_0
  - [x] `src-tauri/prompts/hoshi-prompts.json` — source unique des prompts, chargé via `include_str!()` + `LazyLock`
- [x] CI/CD GitHub Release (`v0.1.0` publié)
  - [x] `.github/workflows/release.yml` — build AppImage (ubuntu-22.04) + NSIS (windows-latest) en parallèle
  - [x] `tauri.conf.json` — `bundle.windows` : `webviewInstallMode downloadBootstrapper`, `nsis.installMode currentUser`
  - [x] Artefacts : `hoshitrans_0.1.0_amd64.AppImage` + `hoshitrans_0.1.0_x64-setup.exe`
