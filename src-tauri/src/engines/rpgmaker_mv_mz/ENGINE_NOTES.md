# RPG Maker MV/MZ Engine Notes

## Detection
- MZ: `data/System.json` must exist
- MV: `www/data/System.json` must exist
- Game title read from `gameTitle` field

## Files parsed
- `data/Map*.json` — events.pages.list codes 401, 405 (dialogue), 102 (choices), 101 (speaker)
- `data/CommonEvents.json` — same codes
- `data/Actors/Items/Weapons/Armors/Skills/Enemies/States.json` — name, description, message1-4

## Known placeholder codes
| RPG Maker | Encoded |
|-----------|---------|
| `\N[n]` | `{{ACTOR_NAME[n]}}` |
| `\C[n]` | `{{COLOR[n]}}` |
| `\I[n]` | `{{ICON[n]}}` |
| `\V[n]` | `{{VAR[n]}}` |
| `\P[n]` | `{{PARTY[n]}}` |

## Tested on
- [x] RPG Maker MV game — `Ah,Ghost-1.10` → 37 Japanese entries extracted
- [x] RPG Maker MZ game — `Adventurer_Corruption` → English game, 0 JP entries (skip filter correct, MZ structure readable)

## Known issues
- `Adventurer_Corruption` uses `\pop[n]` custom control codes (not standard RPG Maker) — not encoded as placeholders since they're in English text that gets skipped anyway.
