# Test rollout Phase 3: ranking invariants and calibration oracle — Plan Brief

> Full plan: `context/changes/testing-ranking-invariants-and-calibration-oracle/plan.md`
> Research: `context/changes/testing-ranking-invariants-and-calibration-oracle/research.md`

## What & Why

Test plan Risks #3 and #4:

- **#3:** Sidereus recommends something you can't see — below your minimum altitude, outside its dark window, or below the horizon.
- **#4:** A scoring retune quietly makes the top 5 worse, or breaks a PRD rule, and nothing fails.

This phase proves both are guarded, with expectations that never come from the engine itself.

## Starting Point

- **Risk #3:** the visibility rule is sound today. A probe of about 19,000 rows across hemispheres and seasons found no violation. But every existing test is a fixed Warsaw night with a 150 mm scope.
- **Risk #4:** there's no stored calibration snapshot (the "snapshot" is a print-only log). The calibration test checks four loose rules that guard only the Messier bonus. One ranking test pins an exact top-5 order copied from engine output.

## Desired End State

- **Property suites:** seeded, generated sites, nights, skies and telescopes prove that every listed object, planet, Moon entry and Session plan row is up and in darkness at its window start, end and best time. The test recomputes altitude with astronomy-engine itself.
- **Invariant relations:** the PRD ranking rules hold at catalogue scale.
- **Beginner reference:** a committed, source-cited list judges each calibration night's top 5, which must contain at least 3 published beginner picks.
- **Engine-copied order:** removed.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Risk #4 oracle | PRD invariants as relations + committed beginner reference | Only an external list can judge "a good top 5"; relations need no expected values | User (research Q) |
| Reference rule | An object counts when ≥2 published sources name it for the season; list fixed before comparison | Keeps the list independent of the ranking | Plan (delegated) |
| Overlap threshold | k = 3 of the top 5, on all four calibration nights | Today passes with exactly 3, so losing one showpiece fails, forcing a deliberate look | User |
| Short windows (one 10-min sample) | Pin the current rule, no product change; draft a #21 comment | Keeps this phase test-only | User (research Q) |
| Risk #3 oracle | astronomy-engine called directly in the test (`EQJ→EQD` + `Horizon`, `Equator` + `Horizon`), ε = 0.05° | Independent of `bestWindow` and the engine's tracks; far under the 1° NFR | Plan (delegated), research |
| Generator | Seeded mulberry32, ~16 fixed sites (equator to 78° N, 65° S, +13/+14 zones), any 2026 date, Bortle 1–9, min altitude 0–60, 50–400 mm f/3–f/16 | Replayable, realistic, no library or tz lookup | Plan (delegated) |
| Order literal (`ranking.test.ts:195`) | Replaced by "top 5 ⊆ Astronomy.com fall list, M31 present" | A published set instead of an engine-copied order | Plan (delegated) |
| Backport | Research corrections to §2 Risks #3/#4 applied | §2 had a wrong premise for #4 | User |

## Scope

**In scope:**
- Engine visibility property suite (Risk #3).
- Ranking invariant relations (Risk #4).
- Beginner reference fixture and calibration oracle.
- Tonight/Session plan property suite with the no-ranking gates.
- §6.3 and §6.6 docs, a CLAUDE.md note, and the drafted #21 comment.

**Out of scope:**
- A minimum visible duration, or any retune.
- A property-testing library.
- New Stellarium or Skyfield captures.
- Weather-mask fuzzing.
- Posting to #21 without your OK.

## Architecture / Approach

One shared, test-only generator in `src/lib/engine/fixtures/generated.ts` feeds the engine suite (`rankObjects`, `rankPlanets`, `moonTarget`), a few relation cases, and the Tonight suite (`buildTonight` with `forecast: null`). Visibility is judged by independent astronomy-engine calls. Ranking quality is judged by relations between two engine runs, plus the committed reference in `src/lib/engine/fixtures/beginner-reference.ts`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Engine visibility property suite | ~200 seeded cases; every entry checked at start, end and peak against astronomy-engine | A vacuous generator: non-vacuity counts are asserted first |
| 2. Ranking invariants as relations | 1–2 ratings inert; seen and Messier bonus never decide the bar; the PRD bar; washed out never listed; permutation and aperture relations | A relation that's false today (aperture): stop and ask, never weaken |
| 3. Independent top-5 oracle | Source-cited reference, overlap ≥3 on 4 nights; engine-copied literal replaced | The list edited to fit: the README forbids it; dated sources only |
| 4. Tonight suite + docs | ~40 builds; every plan row visible; no ranking without darkness or on no-go; cookbook | Slow builds: ~0.5 s total |

**Prerequisites:** branch `feat/testing-ranking-invariants-and-calibration-oracle` (pushed); `nvm use`.
**Estimated effort:** about one session across 4 small phases. Tests only.

## Open Risks & Assumptions

- The reference lists come from WebFetch summaries, so Phase 3 spot-checks 3 entries per night against the source pages.
- Several sources are Messier-only marathon lists, which are weak evidence of a "showpiece". Requiring ≥2 sources and k = 3 counters that.
- k = 3 leaves no slack today. A harmless retune that swaps one listed object needs a dated reference update or a k decision. That is intended.

## Success Criteria (Summary)

- A retune that drops beginner showpieces, lowers the log-rating floor, or moves the log or Messier bonus into the bar turns the suite red. The break checks demonstrate each case.
- No generated night, anywhere, shows a target that astronomy-engine says is below the minimum or in twilight.
