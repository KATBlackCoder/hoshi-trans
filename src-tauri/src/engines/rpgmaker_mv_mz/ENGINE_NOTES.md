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
- [x] RPG Maker MV — `Ah,Ghost-1.10` → 37 JP entries
- [x] RPG Maker MV — `Cursed_Blessing_v2` → 9 163 JP entries
- [x] RPG Maker MZ — `osana_isekai_v1.06` → 20 795 JP entries
- [x] RPG Maker MZ — `Adventurer_Corruption` → 0 entries (English game, skip filter correct)

## Known issues
- `Adventurer_Corruption` uses `\pop[n]` custom control codes — not a standard RPG Maker code, not handled as placeholder (English game anyway).
- Large games (10k+ entries) take ~2 min to extract in debug build; release build will be significantly faster.
