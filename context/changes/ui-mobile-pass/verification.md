# Verification — ui-mobile-pass

Production preview on local Supabase + `tests/e2e/forecast-fixture.mjs` (all-clear), user onboarded in Madrid with the default kit; temporary Playwright capture spec (not committed). Baseline: `research.md` › Measured layout and `evidence/*.png`.

## Phase 1 — phone rhythm (2026-10-07)

| Check | Before | After | Evidence |
| --- | --- | --- | --- |
| h1 top, focused Tonight pages, 390 px | 156 | 132 | `evidence/after/en-dark-390x844_tonight_targets.png` |
| h1 top, `/gear` and `/log`, 390 px | 104 | 88 | `evidence/after/en-dark-390x844_gear.png` |
| `/gear` page height, 390 px | 988 | 897 | — |
| 1280 px: h1 tops and page heights (targets, moon, gear, log) | 188/188/128/128; 1878/1022/948/900 | identical | — |
| Sideways overflow, 320/390/1280 px, EN + PL (landing, sign-in, targets, moon, gear, log) | — | 0 everywhere | — |
| PL titles at 320 px wrap on whole words (landing, log) | — | yes | `evidence/after/pl-dark-320x568_log.png` |

`--text-display` resolves to 32/36 px at ≤ 360 px, 32.9/36.9 px at 390 px and 40/44 px from 640 px (unchanged desktop).
