# hoshi-trans — PRD v2

> Dernière mise à jour : 2026-03-10

---

## 1. Problème

Les fans-traducteurs de jeux JP (eroge, VN, JRPG) doivent jongler entre plusieurs outils vieux de 10+ ans
avec des UX datées, et faire du copier-coller manuel vers ChatGPT/DeepL.

hoshi-trans centralise extraction → traduction IA (Ollama local) → réinjection dans un seul outil desktop.

---

## 2. Personas

| Persona | Besoin |
|---|---|
| Fan translator solo | Traduit un jeu JP pour sa communauté, veut un workflow simple |
| Power-user joueur | Veut jouer en EN/FR, capable d'utiliser un outil technique |
| Développeur de patch | Gère plusieurs projets, veut batch + glossaire |

---

## 3. Roadmap moteurs

| Moteur | Priorité | Statut |
|---|---|---|
| RPG Maker MV / MZ | P1 | 🔴 À faire |
| Wolf RPG Editor | P2 | 🔴 En attente P1 |
| RPG Developer Bakin | P3 | 🔴 En attente P2 |

**Règle :** extraction + traduction + injection doit être 100% fonctionnel pour P1 avant de commencer P2.

---

## 4. Features MVP (v0.1) — RPG Maker MV/MZ uniquement

### F1 — Onboarding Ollama
- Vérifier `localhost:11434` au démarrage
- Si absent : page d'onboarding avec lien + instructions
- Si présent : lister les modèles disponibles

### F2 — Import projet RPG Maker MV/MZ
- Sélection du dossier du jeu (dialog natif Tauri)
- Auto-détection MV vs MZ (présence de `data/System.json` + format)
- Parsing de tous les fichiers traduisibles (Map*.json, CommonEvents.json, Actors.json, etc.)
- Afficher le nombre total de strings extraites

### F3 — Interface de traduction
- Vue liste : Original JP | Traduction | Statut
- Sélection multiple de strings
- Bouton "Traduire sélection" → appel Ollama batch
- Édition manuelle de la traduction
- Statuts : `pending` | `translated` | `reviewed` | `error`
- Filtre par fichier source, statut

### F4 — Batch translation
- "Tout traduire" avec progress bar
- Pause / reprise
- Retry individuel sur erreur
- Estimation temps restant

### F5 — Export
- Génère les fichiers JSON traduits dans un dossier `output/`
- Ne touche jamais aux fichiers originaux
- Compatible avec RPG Maker MV/MZ pour remplacer le dossier `data/`

### F6 — Settings
- Choix modèle Ollama (liste des modèles installés)
- Langue cible (EN / FR)
- Prompt système personnalisable
- Température du modèle (0.1 → 1.0)

---

## 5. Features post-MVP (v0.2+)

- Support Wolf RPG (P2)
- Support Bakin (P3)
- Glossaire personnalisé (noms de perso, termes du jeu → forcer une traduction)
- Mémoire de traduction (réutiliser les strings déjà traduites)
- Export XLSX
- Historique des projets
- Page donations crypto (BTC, USDT TRC-20, XMR)

---

## 6. Contraintes

| Contrainte | Détail |
|---|---|
| Ollama obligatoire | Pas de cloud, jamais |
| Offline-first | Fonctionne sans internet |
| Inject non-destructif | Output dans un dossier séparé, originaux intacts |
| Performance | Batch 500 strings sans freezer l'UI |
| OS cibles | Linux (priorité développement), Windows, macOS |
| Un projet = une langue | Pour EN + FR du même jeu → deux projets distincts |
| Dossier read-only | Si le dossier du jeu est en lecture seule, stocker `hoshi-trans.json` dans `app_data_dir` |

---

## 7. Hors scope MVP

- Traduction en temps réel pendant que le jeu tourne
- Extraction directe des exécutables de jeu chiffrés
- Traduction audio/sous-titres
- Collaboration cloud

---

## 8. Critères de succès v0.1

- [ ] Ouvrir un dossier RPG Maker MV/MZ et voir les strings
- [ ] Traduire 10 strings via Ollama sans erreur
- [ ] Exporter le dossier `output/` et remplacer `data/` dans le jeu
- [ ] Le jeu démarre et affiche les textes traduits
- [ ] L'app ne crash pas si Ollama est absent
