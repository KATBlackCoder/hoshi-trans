# RPG Maker MV/MZ — Notes de traduction

> Ce fichier est lu par Claude au début de chaque session touchant ce moteur.
> Il contient les observations accumulées lors des tests de traduction réels.
> **Mets à jour ce fichier après chaque session de test.**

---

## 📁 Fichiers de ce module

| Fichier | Rôle |
|---|---|
| `placeholders.rs` | `encode(text)` et `decode(text)` — codes RPG Maker ↔ `{{NOM}}` |
| `skip.rs` | `should_skip(text)` — règles spécifiques + délègue à `common::skip` |
| `extractor.rs` | Scan `data/`, parse JSON, appelle `placeholders::encode` + `skip::should_skip`, assigne `order_index` |
| `injector.rs` | Réécrit les JSON avec `placeholders::decode` sur les traductions |


> ⚠️ **order_index obligatoire** : chaque `TranslationEntry` doit avoir un `order_index`
> correspondant à sa position dans le fichier source. L'injecteur trie par
> `(file_path, order_index)` pour reconstruire les fichiers dans le bon ordre.

---

## 🔄 Système de placeholders (`placeholders.rs`)

### Table de mapping — RPG Maker MV/MZ

| Code original | Placeholder | Description |
|---|---|---|
| `\n` | `{{LINE_BREAK}}` | Saut de ligne dans la fenêtre message |
| `\N[n]` | `{{ACTOR_NAME[n]}}` | Nom de l'acteur n° n |
| `\V[n]` | `{{VAR[n]}}` | Valeur de la variable n° n |
| `\C[n]` | `{{COLOR[n]}}` | Couleur du texte n° n |
| `\I[n]` | `{{ICON[n]}}` | Icône n° n |
| `\{` | `{{FONT_UP}}` | Augmente la taille de police |
| `\}` | `{{FONT_DOWN}}` | Diminue la taille de police |
| `\G` | `{{GOLD}}` | Affiche la monnaie du jeu |
| `\$` | `{{OPEN_GOLD}}` | Ouvre la fenêtre de monnaie |
| `\.` | `{{WAIT_SHORT}}` | Pause courte (1/4 sec) |
| `\|` | `{{WAIT_LONG}}` | Pause longue (1 sec) |
| `\!` | `{{WAIT_INPUT}}` | Attend input joueur |
| `\>` | `{{FAST_START}}` | Début du texte rapide |
| `\<` | `{{FAST_END}}` | Fin du texte rapide |
| `\^` | `{{NO_WAIT}}` | Ferme message sans attendre |

### Comportement attendu
- Le LLM reçoit : `Bonjour {{ACTOR_NAME[1]}}, tu as {{VAR[5]}} pièces.`
- Le LLM traduit : `Hello {{ACTOR_NAME[1]}}, you have {{VAR[5]}} coins.`
- L'injecteur restaure : `Hello \N[1], you have \V[5] coins.`

**Règle :** si un placeholder est absent de la traduction retournée par Ollama,
logguer un warning mais ne pas bloquer — injecter le texte tel quel et marquer
le statut `TranslationStatus::Warning("Missing placeholder: {{ACTOR_NAME[1]}}")`.

---

## ⛔ Skip logic (`skip.rs`)

### Appel obligatoire à common::skip en premier

```rust
use crate::engines::common::skip as common_skip;

pub fn should_skip(text: &str) -> bool {
    if common_skip::should_skip(text) { return true; }
    // Règles spécifiques RPG Maker ci-dessous
    is_control_only(text) || is_system_term(text)
}
```

### Règles spécifiques RPG Maker (en plus du common)

| Condition | Exemple | Raison |
|---|---|---|
| Contrôle pur (que des codes `\`) | `"\n\n\|"` | Aucun texte lisible |
| Labels de menu système | `"I"`, `"II"`, `"III"` | Indices numériques romains |
| Plugin commands (code 356) | `"ShowPicture 1 img/..."` | Commande non-texte |

### Rappel — règles communes (dans `common::skip`)

| Condition | Exemple |
|---|---|
| String vide ou whitespace | `""`, `"   "` |
| Aucun caractère JP | `"Sword"`, `"OK"` |
| Chemin de fichier | `"audio/bgm/Title"` |
| Formule de script | `"$gameVariables.value(1) > 5"` |
| Nombre pur | `"100"`, `"42"` |

**⚠️ Texte mixte JP+EN** (noms propres en romaji, termes de jeu) → contient JP → toujours traduire.

---

## 🧪 Observations de tests (à remplir au fur et à mesure)

### [Date] — [Jeu testé]
_Aucune observation pour le moment. Ajouter ici les cas particuliers rencontrés._

Exemples de format :
```
### 2026-03-15 — [Nom du jeu]
- PLACEHOLDER: Les strings de type `\SE[n]` (sound effect) dans les dialogues
  causent une traduction partielle. Ajouter à la table de placeholders.
- SKIP: Les strings dans System.json > terms > commands sont parfois en JP
  mais ce sont des étiquettes UI (menus), pas des dialogues. Traiter séparément.
- MODÈLE: qwen2.5:7b donne de meilleurs résultats sur les dialogues eroge
  que mistral pour le JP → EN.
```

---

## 📝 Patterns connus à investiguer

_À remplir lors des tests :_
- [ ] Comportement des `\SE[n]` (commandes son dans le texte)
- [ ] Strings dans `System.json > terms > basic` (HP, MP, TP...)
- [ ] Noms de skills dans `Skills.json` — souvent en Romaji, skip ?
- [ ] Plugin commands (code 356) — parfois du JP en paramètre
