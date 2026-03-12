# Wolf RPG — Notes de traduction

> Ce fichier est lu par Claude au début de chaque session touchant ce moteur.
> **Mets à jour ce fichier après chaque session de test.**

---

## 📁 Fichiers de ce module

| Fichier | Rôle |
|---|---|
| `placeholders.rs` | `encode(text)` et `decode(text)` — codes Wolf ↔ `{{NOM}}` |
| `skip.rs` | `should_skip(text)` — règles spécifiques + délègue à `common::skip` |
| `sidecar.rs` | Appels UberWolf + WolfTL via `tauri-plugin-shell`, préserve `order_index` depuis le dump JSON |


> ⚠️ **order_index obligatoire** : chaque `TranslationEntry` doit avoir un `order_index`
> correspondant à sa position dans le fichier source. L'injecteur trie par
> `(file_path, order_index)` pour reconstruire les fichiers dans le bon ordre.

---

## 🔄 Système de placeholders (`placeholders.rs`)

### Table de mapping — Wolf RPG

| Code original | Placeholder | Description |
|---|---|---|
| `\n` | `{{LINE_BREAK}}` | Saut de ligne |
| `\cdb[n]` | `{{DB_REF[n]}}` | Référence base de données |
| `\self[n]` | `{{SELF_VAR[n]}}` | Variable self n° n |
| `\var[n]` | `{{SYS_VAR[n]}}` | Variable système n° n |
| `\pic[n]` | `{{PICTURE[n]}}` | Affichage image n° n |
| `\f[n]` | `{{FONT[n]}}` | Style de police n° n |

> ⚠️ Table à compléter lors des tests — les codes varient selon la version du Wolf RPG Editor.

---

## ⛔ Skip logic (`skip.rs`)

### Appel obligatoire à common::skip en premier

```rust
use crate::engines::common::skip as common_skip;

pub fn should_skip(text: &str) -> bool {
    if common_skip::should_skip(text) { return true; }
    // Règles spécifiques Wolf RPG ci-dessous
    is_wolf_internal_command(text)
}
```

### Règles spécifiques Wolf RPG (en plus du common)

| Condition | Exemple | Raison |
|---|---|---|
| Commandes internes Wolf | `"MOVE_ROUTE: ..."` | Données système non-texte |
| Strings de map non-textuelles | coordonnées, flags | Données techniques |

### Rappel — règles communes (dans `common::skip`)

| Condition | Exemple |
|---|---|
| String vide ou whitespace | `""`, `"   "` |
| Aucun caractère JP | `"Sword"`, `"OK"` |
| Chemin de fichier | `"audio/bgm/Title"` |
| Formule de script | expressions avec opérateurs |
| Nombre pur | `"100"`, `"42"` |

---

## 🔧 Pipeline sidecar (`sidecar.rs`)

```
[fichiers .wolf/.pak chiffrés]
    → UberWolf.exe → [fichiers déchiffrés]
    → WolfTL.exe dump → [dump JSON]
    → [traduction via Ollama]
    → WolfTL.exe patch → [fichiers patchés]
```

**⚠️ Linux :** détecter Wine avec `which wine`, préfixer la commande si présent.
**Encodage :** les vieux jeux Wolf RPG utilisent Shift-JIS (CP932) — `encoding_rs` obligatoire.

---

## 🧪 Observations de tests

### [Date] — [Jeu testé]
_Aucune observation pour le moment._

---

## 📝 Patterns connus à investiguer

- [ ] Encodage exact des fichiers .wolf (Shift-JIS vs UTF-8 selon version)
- [ ] Comportement de WolfTL sur les fichiers CommonEvent
- [ ] Codes spéciaux non listés dans la table de placeholders
