# Wolf RPG — Notes de traduction

> Ce fichier est lu par Claude au début de chaque session touchant ce moteur.
> **Mets à jour ce fichier après chaque session de test.**

---

## 📁 Fichiers de ce module

| Fichier | Rôle |
|---|---|
| `mod.rs` | `detect()` + `get_game_title()` — détection du dossier jeu ou dump |
| `extractor.rs` | Lit le dump WolfTL JSON, extrait `Message`/`Choice`, retourne `Vec<TranslationEntry>` |
| `injector.rs` | Relit le dump, patch les `stringArgs` en place, écrit dans `output/` |
| `placeholders.rs` | `encode(text)` et `decode(text)` — codes Wolf ↔ `{{WOLF_...}}` |
| `skip.rs` | `should_skip(text)` — règles spécifiques + délègue à `common::skip` |

---

## 🔧 Pipeline dump (sans sidecar)

L'utilisateur prépare manuellement le dump WolfTL :

```
[jeu chiffré]  →  UberWolf.exe (décryptage)  →  WolfTL.exe dump  →  dump/
```

hoshi-trans lit/écrit directement `dump/` — pas de Wine, pas de sidecars.

### Structure attendue du dump

```
dump/
  mps/          ← maps (.json, un event par fichier)
  common/       ← common events (.json)
  db/           ← base de données (.json)
  Game.json     ← titre du jeu ("Title", "TitlePlus")
```

### Auto-résolution du dossier

`resolve_dump_dir()` accepte deux cas :
- L'utilisateur ouvre le dossier `dump/` directement → utilisé tel quel
- L'utilisateur ouvre la racine du jeu → `dump/` détecté automatiquement

---

## 📄 Format JSON WolfTL

### mps/ et common/

```json
{
  "events": [
    {
      "pages": [
        {
          "list": [
            { "codeStr": "Message", "stringArgs": ["texte..."], "index": 4 },
            { "codeStr": "Choice",  "stringArgs": ["oui", "non"], "index": 9 }
          ]
        }
      ]
    }
  ]
}
```

- `codeStr == "Message"` → `stringArgs[0]` = texte à traduire
- `codeStr == "Choice"` → chaque `stringArgs[i]` = option à traduire
- `index` = `order_index` — **critique pour l'injection**

### db/

```json
{
  "types": [
    {
      "data": [
        {
          "fields": [
            { "name": "nomChamp", "stringArgs": ["valeur"] }
          ]
        }
      ]
    }
  ]
}
```

> ✅ `fields[].stringArgs` **ne doit pas être extrait** — ce sont des valeurs de
> configuration interne de l'éditeur (options de listes déroulantes, labels d'IA,
> résistances d'états). Invisible pour le joueur. Confirmé sur ドラゴンブラッド
> (jeu traduit) : 425/476 entrées encore en JP dans un jeu 100% traduit → intentionnel.

---

## 🔑 Context encoding (clé d'injection)

| Source | Format | Exemple |
|---|---|---|
| mps/ event | `event:E:page:P:idx:N` | `event:0:page:1:idx:4` |
| common/ | `cmd:idx:N` | `cmd:idx:12` |
| db/ | `db:type:T:data:D:field:F` | `db:type:2:data:5:field:0` |
| Choice | `...:choice:I` ajouté | `cmd:idx:9:choice:1` |

L'injecteur indexe par `(file_path, order_index, context)` — résistant aux entrées skippées.

---

## 🔄 Système de placeholders (`placeholders.rs`)

### Composés (encodés en premier — ordre critique)

| Code original | Placeholder | Description |
|---|---|---|
| `\f[\cself[n]]` | `{{WOLF_FONT_CS[n]}}` | Police via cself |
| `\ax[\cself[n]]` | `{{WOLF_AX_CS[n]}}` | Position X via cself |
| `\ay[\cself[n]]` | `{{WOLF_AY_CS[n]}}` | Position Y via cself |
| `\m[\cself[n]]` | `{{WOLF_M_CS[n]}}` | Message position via cself |
| `\udb[n:\d[m]]` | `{{WOLF_UDB_D[n:m]}}` | DB user avec index variable |

### Codes longs (avant les courts pour éviter match partiel)

| Code original | Placeholder | Description |
|---|---|---|
| `\cself[n]` | `{{WOLF_CSELF[n]}}` | Variable self personnage |
| `\self[n]` | `{{WOLF_SELF[n]}}` | Variable locale event |
| `\cdb[t:i:f]` | `{{WOLF_CDB[t:i:f]}}` | Lookup base de données |
| `\sys[n]` | `{{WOLF_SYS[n]}}` | Variable système |
| `\font[n]` | `{{WOLF_FONTFULL[n]}}` | Police (format long) |
| `\space[n]` | `{{WOLF_SPACE[n]}}` | Espacement |
| `\udb[n:m]` | `{{WOLF_UDB[n:m]}}` | DB user (2 args) |
| `\my[n]` | `{{WOLF_MY[n]}}` | Offset Y message (peut être négatif) |
| `\m[n]` | `{{WOLF_M[n]}}` | Position message (peut être négatif) |

### Codes courts

| Code original | Placeholder | Description |
|---|---|---|
| `\C[n]` | `{{WOLF_COLOR_U[n]}}` | Couleur majuscule (encodé avant `\c`) |
| `\c[n]` | `{{WOLF_COLOR_L[n]}}` | Couleur minuscule |
| `\f[n]` | `{{WOLF_FONT[n]}}` | Police (format court) |
| `\ax[n]` | `{{WOLF_AX[n]}}` | Position X absolue |
| `\ay[n]` | `{{WOLF_AY[n]}}` | Position Y absolue |
| `\v[n]` | `{{WOLF_V[n]}}` | Variable |
| `\i[n]` | `{{WOLF_ICON[n]}}` | Icône |
| `\s[n]` | `{{WOLF_SLOT[n]}}` | Slot équipement |
| `\-[n]` | `{{WOLF_INDENT[n]}}` | Indentation négative |
| `@n` | `{{WOLF_AT[n]}}` | Référence paramètre |
| `%n` / `％n` | `{{WOLF_PC[n]}}` | Substitution dynamique |

### Sans paramètre (str::replace)

| Code original | Placeholder | Description |
|---|---|---|
| `\E` | `{{WOLF_END}}` | Fin de code |
| `\A-` | `{{WOLF_AUTO}}` | Auto-alignement |
| `\r` | `{{WOLF_RUBY}}` | Début ruby (escape, pas char) |
| `\r` (char réel) | `{{WOLF_CR}}` | Retour chariot réel |
| `\n` (char réel) | `{{WOLF_NL}}` | Saut de ligne réel |
| `<C>` | `{{WOLF_CENTER}}` | Centrage |
| `\>` | `{{WOLF_RALIGN}}` | Alignement droite |
| `<R>` | `{{WOLF_RTAG}}` | Tag R |
| `<<` | `{{WOLF_LBRACKET}}` | Crochet gauche |
| `>>` | `{{WOLF_RBRACKET}}` | Crochet droit |

---

## ⛔ Skip logic (`skip.rs`)

```rust
pub fn should_skip(text: &str) -> bool {
    if common_skip::should_skip(text) { return true; }
    // Règles spécifiques Wolf RPG ci-dessous
}
```

`common::skip` gère : vide, whitespace, pas de JP, chemin fichier, formule, nombre pur.
Wolf RPG n'a pas de règles spécifiques supplémentaires pour l'instant.

---

## 🧪 Observations de tests

### 2026-03-18 — 月咲流ホノカ ver1.03

- **3585 entrées** extraites depuis `dump/` (mps + common + db)
- Codes confirmés dans le dump réel : `\udb[N:M]`, `\udb[N:\d[M]]`, `\my[N]` (négatif), `\m[\cself[N]]`, `\A-`
- `resolve_dump_dir()` nécessaire : l'utilisateur ouvre la racine du jeu, le dump est dans `game_root/dump/`
- `get_game_title()` lit `Game.json > "Title"` → `"月咲流ホノカ"` (corrige le bug "Unknown")

### 2026-03-18 — ドラゴンブラッド (霧の遺跡)

- Format identique à ホノカ — pleinement compatible
- Jeu déjà en anglais → skip filter fonctionne correctement (aucune fausse extraction)
- `Dungeon.json` dans `mps/` → géré automatiquement (scan récursif)
- Codes supplémentaires observés : `\cdb[N:M:K]` (3 args), `\font[N]`, `\i[N]`, `\s[N]`, `\self[N]`
- `Game.json > "Title"` → `"ドラゴンブラッド"`
- `db/ fields[].stringArgs` : 425/476 encore en JP dans ce jeu traduit → config interne éditeur, **ne pas extraire**

---

## 📝 Patterns à investiguer

- [x] `fields[].stringArgs` dans `db/` — **à ne pas extraire** — config interne éditeur, non visible joueur
- [ ] `Game.json > "TitlePlus"` — numéro de version — à afficher dans l'UI ?
- [ ] Encodage des anciens jeux Wolf RPG (Shift-JIS) — non testé, dump WolfTL semble être UTF-8
