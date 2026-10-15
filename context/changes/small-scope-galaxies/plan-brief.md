# Galaxies in a Small Telescope (M-4 S-04) — Plan Brief

> Full plan: `context/changes/small-scope-galaxies/plan.md`
> Research: `context/changes/small-scope-galaxies/research.md`

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
- **Checked against** an extended source-cited fixture and a new small-aperture ranking guard. The existing calibration oracle stays unchanged and green.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| What separates M31 from M33 | OpenNGC `Hubble` type (bulge-type S0-Sb vs disc-type), extracted by the generator at the existing pin | Total magnitude can't (both are bright); morphology is the published reason M31 has a bright core and M33 doesn't | Research |
| Core fix shape | Bulge-type spirals' core brighter by `EXPECT_BULGE_CORE_EXTRA_MAG` = 0.8 (window 0.76-0.86 from the M31 references) | Keeps disc-type references (M33, M101) untouched and D-3 monotonicity by construction | Research / Plan |
| Ranking fix shape | Cap a galaxy's brightness credit by its contrast band: full at bright/smudge, `GALAXY_FAINT_BRIGHTNESS_CAP` at faint, 0 at limit | Ranking, reason line and line then read one measure; monotone in aperture, so invariant (g) holds | Plan |
| Shared code | New `src/lib/engine/contrast.ts` | Avoids an `expectation.ts` ↔ `score.ts` import cycle | Plan |
| Washed-out rule, nebulae | Unchanged | Keeps the moonlight calibration and the slice's scope (galaxies) | Plan |
| OD-1 M101 at a dark site, 80 mm | ★ line decides (stays ~#5 there, sources say `galaxySmudge`) / stricter small-aperture penalty | Sources say an 80 mm shows its core under dark skies | Owner (pending) |
| OD-2 M31, 60 mm, Bortle 5 | ★ `galaxySmudge` / `galaxyBright` | Telescope Advisor's "Detectable but faint" at Bortle 5-6 vs Astronomy's "pierces all but the worst sky glow" | Owner (pending) |
| OD-3 Generality | ★ every bulge-type spiral (28) / M31-only exception | Physics-based rule vs narrowest change | Owner (pending) |
| OD-4 `galaxyLimit` galaxies | ★ stay listed, no brightness credit / never clear the bar | Still a fair try with an honest line, vs not a recommendation at all | Owner (pending) |

## Scope

**In scope:**
- the `hubble` catalogue field;
- the shared contrast module and the bulge core term;
- 7 new small-scope references plus 1 named divergence (M33 at 80 mm / Bortle 6, 0.03 mag short of `limit`);
- the galaxy brightness cap;
- the small-aperture guard and the reason/line consistency invariant;
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
| 2. References and the bulge core term (Sonnet high) | 7 small-scope references red then green, the shared `contrast.ts`, `EXPECT_BULGE_CORE_EXTRA_MAG` | Narrow 0.76-0.86 window under OD-2 (a) |
| 3. Ranking follows the line (Sonnet high) | Brightness cap, `small-scope.test.ts` G1-G5, calibration unchanged | Calibration overlap has zero slack (exactly 3 on every night) |
| 4. Docs and owner checklist (Sonnet medium) | CLAUDE.md, PRD Open Questions 5 and 17, `manual-checks.md`, whole e2e and smoke before the PR | — |

**Prerequisites:** `npm ci` in the worktree (done); network to raw.githubusercontent.com for `catalogue:build`; the owner's answers to OD-1 to OD-4 (they change constants and guard lines, not the phase structure).
**Estimated effort:** about 1-2 sessions across 4 phases.

## Open Risks & Assumptions

- **Thin sources:** no verified page states a 60-80 mm aperture together with a Bortle class. Each small-scope entry combines a sky-class source with an aperture source, and Telescope Advisor carries three entries.
- **Ripple:** the bulge term moves other bulge-type galaxies one band brighter at bright skies (14 at 150 mm / Bortle 7 at e = 1.25; fewer at 0.8). This is accepted as physics, and Phase 2 records the list.
- **Zero slack:** the calibration oracle is at exactly 3 of 5 overlap. The cap is expected to touch only M33 and M101 there, and both are outside the matched objects.

## Success Criteria (Summary)

- A 60 mm user at a suburban site sees M31 described as a smudge, never "very faint", beside "Bright for your 60 mm".
- From a suburb, M101 and M33 are no longer recommended near the top for a 60-80 mm, and no listed galaxy says "bright for your N mm" with a faint or edge-of-visibility line.
- All published references pass (one named divergence), and the existing invariants and the calibration oracle stay green, unchanged.
