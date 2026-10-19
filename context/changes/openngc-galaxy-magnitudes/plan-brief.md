# Correct implausible OpenNGC V magnitudes of 12 galaxies — Plan Brief

> Full plan: `context/changes/openngc-galaxy-magnitudes/plan.md`
> Research: `context/changes/openngc-galaxy-magnitudes/research.md`

## What & Why

Twelve catalogue galaxies (M58, M61, M88, M91, M98, M106, IC 342, NGC 4449, NGC 5005, NGC 4565, NGC 6822, NGC 4039) carry a V magnitude that is impossible against their own B (V fainter than B − 0.2). The what-to-expect band and, since S-04, the ranking read that V one for one, so their advice is wrong. The rule and the caps are right; the input is wrong (GitHub #178).

## Starting Point

OpenNGC's V for ten of them is HyperLEDA's `vt` (uncertainty 1 to 1.6 mag); for IC 342 and NGC 4039 OpenNGC has no V and the generator copies B into V. A newer OpenNGC commit changes none of the 12. Nothing in the repo tests a galaxy's colour for plausibility.

## Desired End State

Every galaxy in the catalogue has B−V of at least 0.2; the 12 carry a corrected V, each listed in the metas with what it was, what it is and why; the six Messier ones sit within 0.3 mag of independently published V values. Calibration, small-scope and expectation tests stay green untouched. M106 reads "smudge" instead of "faint" at 150 mm / Bortle 5.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Where the fix lives | The generator, then regenerate | The JSON is generator-only (CLAUDE.md tripwire). | Research |
| Source of corrected V (Q1, owner 2026-10-19) | V = B − median B−V of the catalogue's own credible galaxies of the same Hubble group (rule C) | No new source or licence; agrees with published V within 0.17 mag on all six that have one. | Plan |
| Published values | Test-only oracle, never shipped | Keeps the licence question out of the data files. | Plan |
| IC 342, NGC 4039 (Q3, owner) | Same rule instead of B | B−V of exactly 0 is impossible for a galaxy. | Plan |
| NGC 4449, NGC 4565 (Q4, owner) | Apply the rule, record the doubt about their B (0.4 mag) in the meta | Their B is 0.4 to 0.5 mag brighter than NED's unfiltered value. | Research |
| New 150 mm references (Q5, owner) | A diverging reference goes to `KNOWN_DIVERGENCES` and the cap (3) is raised to the new count, reason logged in the plan | The owner allowed it; the expected key is never edited and the rule is not changed here. | Plan |
| First test | Catalogue guard (B−V ≥ 0.2, named ids) plus six published V | Red on today's data, names the 12. | Plan |

## Scope

**In scope:** a colour helper and its test; the generator change; regenerated catalogue and metas; the licence note; two new tests and a test-only table; galaxy references at 150 mm / Bortle 5-6; before and after evidence; CLAUDE.md two paragraphs.

**Out of scope:** the rule and caps, sizes, an OpenNGC pin bump, a new data source, non-galaxy B fallbacks, a rule change to make a diverging reference pass, any UI or i18n change.

## Architecture / Approach

Red first (Phase 1), then a pure helper applied in `scripts/build-catalogue.mjs` to Messier and Caldwell galaxies with a build-time count check of 12 (Phase 2), then proof that the engine and its oracles agree with the corrected data plus the new references (Phase 3), then CI-style gates and one PR (Phase 4).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Failing tests | Guard and published oracle, red on the 12 | The tree is red until Phase 2 (hook feedback) |
| 2. Generator rule | Helper, regenerated data, metas, licence note | The corrected V of NGC 4449 and NGC 4565 may be 0.4 mag too bright |
| 3. Engine and references | Oracles green unedited, evidence, new references | A new reference may diverge, which raises the cap (logged) |
| 4. Gates and PR | Lint, check, tests, e2e, smoke, PR | CI-way e2e run is long |

**Prerequisites:** the owner's answers to Q1 to Q5 (settled 2026-10-19); local Supabase running for e2e and smoke.
**Estimated effort:** about 2 sessions across 4 phases.

## Open Risks & Assumptions

- M106 at 150 mm / Bortle 6 stays `faint` under the rule (deficit 1.61 against the 1.5 edge) while published V 8.4 would make it `smudge`: the issue's own example may not move at Bortle 6.
- The review's M106 figures (0.490 → 0.438) were not reproduced; the plan records its own before and after.
- NGC 4449 and NGC 4565 are corrected from a B that may itself be 0.4 to 0.5 mag too bright; the meta says so.
- The calibration top five and ten were not run against any corrected catalogue yet.

## Success Criteria (Summary)

- No galaxy ships a colour below 0.2; the 12 corrections are listed per object in the metas.
- The existing oracles stay green without edits; the cap changes only if a new reference diverges, and then it is logged.
- CI-way e2e and smoke pass; one PR against main, merged by the owner.
