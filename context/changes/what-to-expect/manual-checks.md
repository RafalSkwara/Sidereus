# What to expect: manual checks (agent run, 2026-10-14)

The orchestrator asked the agent to run every manual check except 2.8, which is the owner's read of the phrases. The checks ran against a local production preview on port 4331, built from commit 54cee2b. The preview used local Supabase and the all-clear forecast fixture on 4401, with the full plan granted and removed through `account:plan` and the local key passed inline. Each user was a fresh account onboarded in Madrid with the default kit (150 mm reflector, 25 mm and 10 mm Plössl).

Evidence came from a throwaway Playwright spec under `tests/e2e/`, deleted after use, and from the screenshots (kept in the agent's scratchpad, not committed). The `/design` shots for 2.8 were taken on `astro dev` on the same port, because `/design` is dev-only.

| Check | Result | Evidence |
|---|---|---|
| 1.5 Reference fixture | PASS | 20 references plus 2 known divergences (22 entries). Every entry has at least 2 sources, all https. The divergences, each with its reason: NGC 7000 (computed `nebulaGlow`, sources `nebulaFaint`) and NGC 4889 (`galaxySmudge` vs `galaxyFaint`). |
| 2.9 Full-plan rows; aperture changes a line | PASS | Each of the best five carries one `data-expect` line (desktop, EN, dark). With a 60 mm refractor and a 300 mm Dobsonian, 4 objects appear in both best fives and 2 of their lines change: M31 `galaxyFaint` → `galaxySmudge` and NGC 752 `openClusterHazy` → `openClusterScattered`. |
| 2.10 Free account | PASS | EN and PL: exactly one `data-expect-locked` line, matching the catalogue's `locked` copy, and 0 `data-expect` lines. |
| 2.11 360 px, three themes | PASS | EN and PL × dark, light and red: 0 px sideways overflow; 132 lines render (full plan, 300 mm). |
| 3.5 Finder chart line | PASS | M13 (EN and PL): `data-expect="globularResolved"` above the chart. M31 (picked from Targets): `data-expect="galaxySmudge"`. Jupiter: `data-expect="jupiter"`, whose text is the planet's own note. |
| 3.6 Free finder page | PASS | EN and PL: the fourth bullet (`lockedFinderLine`) is present, the "needs the full plan" notice shows its text, and no `data-expect` appears. An earlier shot showed the notice empty: that was `Notice`'s screen-reader once-over (it removes the text and puts it back after load), caught mid-flight. Retaken after the text returned. |
| 4.6 Phone (390 px) | PASS | Full plan: Targets (EN dark) and the M13 chart (PL light and red) show the line. Free: the locked line under the count (EN light and red). |

## Observation for the owner (not a failure)

With the 60 mm refractor at the default Madrid site, M31's line reads "A very faint grey smudge; use averted vision." while its reason line reads "bright for your 60 mm".

- The two use different measures: the reason line uses total brightness against the telescope's limit, while the expectation uses core surface brightness against the sky.
- The core-offset model rates M31's core low. At 150 mm / Bortle 4 the reference fixture expects `galaxyBright`, and the rule matches it.
- Changing this would need a sourced rule change (for example, a large-galaxy core term). It is left as is, a candidate for the owner when reading 2.8.

## Screenshots for 2.8 (owner)

`/design`, section "What to expect (Targets rows)", EN and PL, dark and light:

- `2.8-design-what-to-expect-en-dark.png`
- `2.8-design-what-to-expect-en-light.png`
- `2.8-design-what-to-expect-pl-dark.png`
- `2.8-design-what-to-expect-pl-light.png`
