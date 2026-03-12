# Bakin — Notes de traduction

> Ce fichier est lu par Claude au début de chaque session touchant ce moteur.
> **Mets à jour ce fichier après chaque session de test.**

---

## 📁 Fichiers de ce module

| Fichier | Rôle |
|---|---|
| `placeholders.rs` | `encode(text)` et `decode(text)` — codes Bakin ↔ `{{NOM}}` |
| `skip.rs` | `should_skip(text)` — règles spécifiques + délègue à `common::skip` |
| `mod.rs` | Implémentation du trait `GameEngine` (extract + inject) |


> ⚠️ **order_index obligatoire** : chaque `TranslationEntry` doit avoir un `order_index`
> correspondant à sa position dans le fichier source. L'injecteur trie par
> `(file_path, order_index)` pour reconstruire les fichiers dans le bon ordre.

---

## 🔄 Système de placeholders (`placeholders.rs`)

### Table de mapping — Bakin

| Code original | Placeholder | Description |
|---|---|---|
| `{ACTORNAME[n]}` | `{{ACTOR_NAME[n]}}` | Nom de l'acteur n° n |
| `{BR}` | `{{LINE_BREAK}}` | Saut de ligne |
| `{COLOR[n]}` | `{{COLOR[n]}}` | Couleur de texte |

> ⚠️ Table à compléter lors des tests — référence : BakinTranslate (C#) https://github.com/HNIdesu/BakinTranslate

---

## ⛔ Skip logic (`skip.rs`)

### Appel obligatoire à common::skip en premier

```rust
use crate::engines::common::skip as common_skip;

pub fn should_skip(text: &str) -> bool {
    if common_skip::should_skip(text) { return true; }
    // Règles spécifiques Bakin ci-dessous
    is_bakin_key(text)  // clés du dic.txt non-textuelles
}
```

### Règles spécifiques Bakin (en plus du common)

| Condition | Exemple | Raison |
|---|---|---|
| Clés techniques de `dic.txt` | `"MAP_001_EVENT_002"` | Identifiant interne |
| Valeurs vides dans dic.txt | `""` (valeur) | Entrée non renseignée |

### Rappel — règles communes (dans `common::skip`)

| Condition | Exemple |
|---|---|
| String vide ou whitespace | `""`, `"   "` |
| Aucun caractère JP | `"Sword"`, `"OK"` |
| Chemin de fichier | chemins assets |
| Nombre pur | `"100"`, `"42"` |

---

## 🔧 Pipeline d'extraction

```
data.rbpack → unpack → dic.txt (format: clé\tvaleur) → traduction → inject
```

Format `dic.txt` : une entrée par ligne, séparateur tabulation.
```
MAP_001_EVENT_001_LINE_001\t魔法少女が現れた！
MAP_001_EVENT_001_LINE_002\tどうする？
```

---

## 🧪 Observations de tests

### [Date] — [Jeu testé]
_Aucune observation pour le moment._

---

## 📝 Patterns connus à investiguer

- [ ] Format exact du `.rbpack` — compression, structure interne
- [ ] Codes spéciaux Bakin non listés dans la table
- [ ] Encodage (UTF-8 ou autre ?)
- [ ] Comportement à l'injection si une clé est absente du dic.txt traduit
