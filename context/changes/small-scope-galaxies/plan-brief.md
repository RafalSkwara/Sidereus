# Galaxies in a Small Telescope (M-4 S-04) — Plan Brief

> Full plan: `context/changes/small-scope-galaxies/plan.md`
> Research: `context/changes/small-scope-galaxies/research.md`
> Plan review: `context/changes/small-scope-galaxies/reviews/plan-review.md` (owner decisions 2026-10-15)

## What & Why

M-4's north star (#172): galaxy advice in a small telescope has to agree with itself and with published references.

- **#159:** today a 60 mm under a suburban sky shows M31 as "A very faint grey smudge; use averted vision" beside "Bright for your 60 mm".
- **#21 item 3:** M101, a low-surface-brightness galaxy, ranks #5-#6 in an 80 mm, even where its own line says it is at the edge of visibility.

## Starting Point

- **The line:** compares a "core" surface brightness (V spread over the catalogue ellipse, minus a flat 1.5 mag) with the sky. That vastly underrates M31's bulge.
- **The ranking:** credits brightness from total magnitude against the telescope's limit, and applies one flat sky penalty to every galaxy.
- **The two never meet:** the two lines use different measures and share no code. A probe reproduces both bugs: M31 is #1-#2 with `galaxyFaint` at Bortle 6, M101 is #6 with `galaxyLimit` at 60 mm / Bortle 6, and M101 is #5 at Bieszczady with 80 mm.

## Desired End State

- **The line:** in a 60 mm from a suburb, M31 reads "A faint grey smudge with a slightly brighter middle" (`galaxyBright` stays at 150 mm / Bortle 4).
- **The ranking:** from a suburb with 60-80 mm, M101 and M33 drop out of the top 10, and M31 stays near the top.
- **The reason line:** never says "Bright for your N mm" for a galaxy whose line says faint or at the limit.
- **City skies (owner, F6):** with 60-80 mm under Bortle 7-8, M31 reads "A very faint grey smudge; use averted vision" and leaves the top 5. The line and the rank agree, as Telescope Advisor's "Very difficult" at Bortle 7-8 says.
- **Checked against** an extended source-cited fixture and a new small-aperture ranking guard. The existing calibration oracle stays unchanged and green.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| What separates M31 from M33 | OpenNGC `Hubble` type (bulge-type S0-Sb vs disc-type), extracted by the generator at the existing pin | Total magnitude can't (both are bright); morphology is the published reason M31 has a bright core and M33 doesn't | Research |
| Core fix shape | Bulge-type spirals' core brighter by `EXPECT_BULGE_CORE_EXTRA_MAG` = 0.8 (window 0.762-0.862 from the M31 references; margins 0.062 / 0.038) | Keeps disc-type references (M33, M101) untouched and D-3 monotonicity by construction | Research / Plan |
| Ranking fix shape | Cap a galaxy's brightness credit by its contrast band: full at bright/smudge, `GALAXY_FAINT_BRIGHTNESS_CAP` = 0.1 at faint (owner, F1; working window about 0.06-0.2), 0 at limit | Ranking, reason line and line then read one measure; monotone in aperture, so invariant (g) holds | Plan |
| Shared code | New `src/lib/engine/contrast.ts`, holding `telescopeLimitingMag` (re-exported by `score.ts`) | Avoids an `expectation.ts` ↔ `score.ts` import cycle | Plan / review F4 |
| Washed-out rule, nebulae | Unchanged | Keeps the moonlight calibration and the slice's scope (galaxies) | Plan |
| OD-1 M101 at a dark site, 80 mm | Line decides (stays ~#5 there, sources say `galaxySmudge`) | Sources say an 80 mm shows its core under dark skies | Owner |
| OD-2 M31, 60 mm, Bortle 5 | `galaxySmudge` | Telescope Advisor's "Detectable but faint" at Bortle 5-6 | Owner |
| OD-3 Generality | Every bulge-type spiral (28) | Physics-based rule, shared by the line and the ranking | Owner |
| OD-4 `galaxyLimit` galaxies | Stay listed, no brightness credit | Still a fair try with an honest line | Owner |
| F6 M31 in a city sky (60-80 mm, Bortle 7-8) | "Very faint" line, out of the top 5 | Follows the sources and keeps the line and rank in step | Owner |

## Scope

**In scope:**
- the `hubble` catalogue field;
- the shared contrast module and the bulge core term;
- 7 new small-scope references plus 1 named divergence (M33 at 80 mm / Bortle 6, 0.03 mag short of `limit`): 27 references + 3 divergences;
- the galaxy brightness cap;
- the small-aperture guard (G1-G6) and the reason/line consistency invariant over every listed galaxy and both reasons;
- CLAUDE.md, PRD Open Questions 5 and 17, the owner checklist.

**Out of scope:**
- the wording or the 22 keys, and any UI;
- the washed-out rule;
- non-galaxies;
- score weights, the bar and the flat Bortle penalty;
- the duration and Moon terms (S-05 / #21 items 1, 2, 4 and 5);
- new data sources (HyperLEDA rejected);
- regenerating the calibration oracle.

## Architecture / Approach

The generator adds OpenNGC's `Hubble` string to each catalogue object. `contrast.ts` computes a galaxy's core (bulge-type gets the extra term), the deficit against the sky in the user's aperture, and the band after the near-limit floor. `expectation.ts` reads the band to pick the key. `score.ts` reads the same band to cap a galaxy's brightness credit. So the reason line ("Bright for your N mm"), the rank and the what-to-expect line all derive from one measure, and the engine stays pure.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Hubble type in the catalogue (Sonnet high) | `hubble` on every object, from the pinned OpenNGC via `catalogue:build` | Generator diff touches more than the new field |
| 2. References and the bulge core term (Sonnet high) | 7 small-scope references (M31 60/B6 and 60/B8 red, then green), the shared `contrast.ts`, `EXPECT_BULGE_CORE_EXTRA_MAG` | Narrow 0.762-0.862 window |
| 3. Ranking follows the line (Sonnet high) | Brightness cap 0.1, `small-scope.test.ts` G1-G6, calibration unchanged | Calibration overlap has zero slack (exactly 3 on every night); the reviewer's simulation keeps every top 5 |
| 4. Docs and owner checklist (Sonnet medium; e2e and smoke by the lead agent) | CLAUDE.md, PRD Open Questions 5 and 17, `manual-checks.md`, whole e2e and smoke before the PR | Port clashes with other agents (use 4333 / 4400) |

**Prerequisites:** `npm ci` in the worktree (done); network to raw.githubusercontent.com for `catalogue:build`. The owner's decisions are in (2026-10-15).
**Estimated effort:** about 1-2 sessions across 4 phases.

## Open Risks & Assumptions

- **Thin sources:** no verified page states a 60-80 mm aperture together with a Bortle class. Each small-scope entry combines a sky-class source with an aperture source, and Telescope Advisor carries three entries.
- **Ripple:** the bulge term moves other bulge-type galaxies one band brighter at bright skies. This is accepted as physics, and Phase 2 records the list at e = 0.8.
- **Thin margins:** e = 0.8 sits 0.062 and 0.038 from its window's edges, so any change to the Bortle table or to M31's data flips a reference, loudly.
- **Zero slack:** the calibration oracle is at exactly 3 of 5 overlap. The cap is expected to touch only M33 and M101 there, and both are outside the matched objects.

## Success Criteria (Summary)

- A 60 mm user at a suburban site sees M31 described as a smudge, never "very faint", beside "Bright for your 60 mm".
- From a suburb, M101 and M33 are no longer recommended near the top for a 60-80 mm, and no listed galaxy says "bright for your N mm" with a faint or edge-of-visibility line.
- All published references pass (one named divergence), and the existing invariants and the calibration oracle stay green, unchanged.
