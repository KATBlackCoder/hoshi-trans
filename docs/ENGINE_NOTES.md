# Wolf RPG — Notes de traduction

> Pipeline dump-based : l'utilisateur fournit le dossier `dump/` généré par WolfTL.
> Pas de sidecar, pas de Wine requis.

---

## 📁 Fichiers du module

| Fichier | Rôle |
|---|---|
| `extractor.rs` | Lit mps/, common/, db/, Game.json — produit des `TranslationEntry` |
| `injector.rs` | Réécrit les JSON dans `output/` avec les traductions |
| `placeholders.rs` | Codes Wolf (`\c[n]`, `\cself[n]`, `\E`, etc.) ↔ `{{WOLF_...}}` |
| `skip.rs` | Règles Wolf + délègue à `common::skip` |

---

## 🗂️ Commandes Wolf RPG à extraire

Seuls les codes suivants contiennent du texte joueur-visible :

| Code | codeStr | Traitement |
|---|---|---|
| 101 | `Message` | `stringArgs[0]` — dialogue |
| 102 | `Choices` | `stringArgs[0..n]` — options de choix |
| 122 | `SetString` | `stringArgs[0]` — labels UI, suffixes |

Tous les autres codes (`VariableCondition`, `SetLabel`, `Sound`, `Move`, etc.) portent parfois du texte en `stringArgs` comme **contexte WolfTL**, pas du texte joueur. Ne pas extraire.

---

## 📊 order_index

| Source | Formule |
|---|---|
| `Message` | `cmd.index` |
| `SetString` | `cmd.index` |
| `Choices` option i | `cmd.index * 100 + i` |
| `db/` champs | compteur séquentiel (name, description, puis data[].value) |
| `Game.json` | `0` |

⚠️ **Contrainte DB** : `UNIQUE(project_id, file_path, order_index)`. Les `Choices` partagent le même `cmd.index` → la formule `*100+i` est obligatoire sinon seule la première option est insérée.

---

## 🗄️ Fichiers DB Wolf RPG

| Fichier | Extraire ? | Raison |
|---|---|---|
| `DataBase.json` | ✅ Oui | Skills, items, noms — contenu joueur |
| `CDataBase.json` | ✅ Oui | Peut contenir des noms de personnages |
| `SysDatabase.json` | ❌ Non | Config moteur interne, jamais visible joueur |

Champs extraits de `DataBase.json` / `CDataBase.json` :
- `types[ti].data[di].name` (si JP)
- `types[ti].data[di].description` (si JP)
- `types[ti].data[di].data[fi].value` (strings seulement, si JP)

---

## 🔄 Placeholders Wolf RPG

| Code | Placeholder | Notes |
|---|---|---|
| `\E` | `{{WOLF_END}}` | Fin de message |
| `\c[n]` | `{{WOLF_COLOR_L[n]}}` | Couleur minuscule |
| `\C[n]` | `{{WOLF_COLOR_U[n]}}` | Couleur majuscule |
| `\cself[n]` | `{{WOLF_CSELF[n]}}` | Variable self du personnage |
| `\self[n]` | `{{WOLF_SELF[n]}}` | Variable locale d'événement |
| `\v[n]` | `{{WOLF_V[n]}}` | Variable |
| `\f[n]` / `\font[n]` | `{{WOLF_FONT[n]}}` / `{{WOLF_FONTFULL[n]}}` | Police |
| `\f[\cself[n]]` | `{{WOLF_FONT_CS[n]}}` | Compound — encodé en premier |
| `\udb[n:m]` | `{{WOLF_UDB[n:m]}}` | User database |
| `\m[n]` / `\my[n]` | `{{WOLF_M[n]}}` / `{{WOLF_MY[n]}}` | Position message |
| `\A-` | `{{WOLF_AUTO}}` | Alignement auto |
| `\n` (newline) | `{{WOLF_NL}}` | Saut de ligne réel |
| `@n` | `{{WOLF_AT[n]}}` | Paramètre |
| `%n` / `％n` | `{{WOLF_PC[n]}}` | Substitution dynamique |

---

## ⛔ Skip rules Wolf RPG

En plus de `common::skip` :
- `cdb[` ou débute par `sdb:` → référence DB interne
- `X[` (majuscule) → référence catégorie DB Wolf (ex: `X[戦]技能選択実行`)
- Débute par `Data\` ou `Data/` → chemin système Wolf

---

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

## 🧪 Observations de tests

### 2026-03-20 — 月咲流ホノカ ver1.03 (Wolf RPG)
- **CHOICES order_index** : toutes les options d'un `Choices` (code 102) partagent le même `index` dans le dump. La contrainte DB unique `(project_id, file_path, order_index)` ne garde que la première option. Fix : `order_index = command_index * 100 + position`.
- **codeStr "Choices" pas "Choice"** : Wolf RPG utilise `"Choices"` (pas `"Choice"`) — vérifier si d'autres moteurs ont ce même piège.
- **VariableCondition (111) dans WolfTL** : les `stringArgs` de ce command répètent le texte du `Message`/`Choices` précédent comme contexte — **ne pas extraire**, ce serait des doublons.
- **SysDatabase.json** : 100% configuration moteur (résistances, flags système). Ne jamais extraire. Confirmé sur Dragon Blood (jeu traduit) et ホノカ.
- **CDataBase.json** : peut contenir des noms de personnages visibles (ex: `"いぬこ"` dans Little Witch Inuko). Extraire — `should_skip()` filtre les non-japonais automatiquement.
- **Sound/ChangeColor/Teleport/Move dans WolfTL** : ces commands portent le texte du dernier Message comme référence dans leurs `stringArgs`. Ne pas extraire (doublons).

### 2026-03-20 — Little Witch Inuko (Wolf RPG, dump traduit analysé)
- **mps/ sans dialogue direct** : tous les dialogues passent par `CommonEventByName` → common/. Les fichiers mps/ ne contiennent que de la logique (Wait, EraseEvent, etc.).
- **SetString partiellement traduit** : le traducteur humain a traduit les SetString UI-critiques mais sauté les dialogues — confirme que SetString est bien du texte joueur.
- **Game.json Title** : champ `"Title"` traduit par le traducteur humain. Extraire + injecter avec signature.

---

## 📝 Patterns connus à investiguer

- [ ] Comportement des `\SE[n]` (commandes son dans le texte RPG Maker)
- [ ] Strings dans `System.json > terms > basic` (HP, MP, TP...)
- [ ] Noms de skills dans `Skills.json` — souvent en Romaji, skip ?
- [ ] Plugin commands RPG Maker (code 356) — parfois du JP en paramètre
