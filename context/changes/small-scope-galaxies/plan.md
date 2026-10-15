# Galaxies in a Small Telescope (M-4 S-04) Implementation Plan

## Overview

Galaxy advice in a small telescope must agree with itself and with published references (M-4 MS-02, roadmap S-04, GitHub #172):

- a big, bright galaxy such as M31 is not called "very faint" beside "bright for your 60 mm" (#159);
- a faint, low-surface-brightness galaxy such as M101 is not ranked high in a small telescope from a suburban sky (#21 item 3).

Both rules move in one direction, from one shared measure:

- the what-to-expect line's core term (`expectation.ts`);
- the ranking's brightness credit (`score.ts`).

The cases they must get right go into the source-cited reference fixture before either rule changes (lessons.md, "Judge advice that no observer can check against source-cited references").

## Current State Analysis

Research: `context/changes/small-scope-galaxies/research.md`. Every source lookup for this slice was done there; implementation copies URLs and quotes from it and fetches nothing.

- **Two measures.**
  - The reason line "Bright for your N mm" comes from the `brightness` component, total V against the telescope's limiting magnitude (`score.ts:176`, `format.ts:303-323`).
  - The line comes from a core surface brightness: V spread over the catalogue ellipse, minus a flat `BRIGHT_CORE_OFFSET_MAG` 1.5 (`moonlight.ts:103-112`), compared with the moonless sky (`expectation.ts:80-87`).
  - For M31 (178′ × 70′) the core is 20.8 mag/arcsec², so the line reads `galaxyFaint` at 60 mm / Bortle 6 while the brightness component is 0.79.
- **The ranking cannot tell galaxies apart.**
  - The sky penalty is flat per Bortle class for every object above 21 mag/arcsec² (`score.ts:96-102`), and all 68 catalogue galaxies are above it.
  - Aperture reaches the score only through `telescopeLimitingMag`.
- **Probe on today's code** (research §2):
  - M31 is #1-#2 at Bortle 6 for 60, 80 and 150 mm with `galaxyFaint`.
  - M101 is #6 on 2026-04-15 at Warsaw for every aperture and Bortle class probed, including `galaxyLimit` at 60 mm / Bortle 6.
  - M101 is #5 at Bieszczady (Bortle 3, 80 mm, `galaxySmudge`).
  - M33 is #8 at 60 mm / Bortle 6 with `galaxyLimit`.
- **References (research §4)** support:
  - M31 in a 60 mm: `galaxySmudge` at Bortle 5-6, `galaxyFaint` at Bortle 8;
  - M33: `galaxyLimit` at 80 mm / Bortle 6, `galaxySmudge` at 80 mm / Bortle 4;
  - M81: `galaxySmudge` at 80 mm / Bortle 5;
  - M101: `galaxySmudge` at 80 mm / Bortle 3, `galaxyLimit` at 80 mm / Bortle 6.
  - Today's rule already matches every one of these except M31 (all three) and M33 at 80 mm / Bortle 6 (deficit 2.47, 0.03 short of `limit`).
- **Separating M31 from M33.**
  - The pinned OpenNGC commit has a `Hubble` type for every catalogue galaxy (research §5): M31 `Sb`, M81 `Sab` and M51 `SABb` are bulge-type, while M33 `Sc`, M101 `SABc` and NGC 2403 `SABc` are disc-type.
  - The generator does not extract it today (`scripts/build-catalogue.mjs:208-235`).

## Desired End State

- `DeepSkyObject` carries `hubble` (OpenNGC's raw string, or `null`). It is written by `npm run catalogue:build` from the same pin, never by hand.
- One pure engine module computes a galaxy's core surface brightness (bulge-type spirals get `EXPECT_BULGE_CORE_EXTRA_MAG` on top of the flat offset) and the contrast deficit in a telescope from a sky. `expectation.ts` and `score.ts` both use it.
- In a 60 mm under Bortle 5-6, M31 reads `galaxySmudge` ("A faint grey smudge with a slightly brighter middle"); under Bortle 8 it reads `galaxyFaint`. At 150 mm / Bortle 4 it still reads `galaxyBright`.
- A galaxy gets brightness credit in the ranking only as far as its line says it is easy:
  - full credit at `galaxyBright` and `galaxySmudge`;
  - a capped credit at `galaxyFaint`;
  - none at `galaxyLimit`.
- From a suburban sky with 60-80 mm, M101 and M33 leave the top 10. M31 stays in the top 5 with a line that agrees with "Bright for your 60 mm".
- Verified by:
  - the extended `expect-reference.ts` (new small-scope entries pass; one named divergence);
  - a new small-aperture ranking guard (`small-scope.test.ts`);
  - a reason/line consistency invariant;
  - the unchanged D-3 invariants and ranking invariant (g);
  - `calibration.test.ts` green without regeneration.

### Key Discoveries:

- `effectiveSurfaceBrightness` has two consumers, the washed-out rule (`score.ts:146`) and the expectation (`expectation.ts:81`). Changing it in place would reopen the moonlight calibration (`context/archive/2026-10-02-moonlight-and-the-verdict/checkpoint.md:23-26`), so the new core function sits beside it.
- `expectation.ts` imports `telescopeLimitingMag` from `score.ts` (`expectation.ts:25`). If `score.ts` imported the deficit from `expectation.ts`, the two modules would import each other, so the shared function lives in a new module.
- `galaxyKey`'s 5-mag margin (`expectation.ts:116`, `parameters.ts:518`) caps every galaxy except M31 and M81 at `galaxySmudge` at 150 mm / Bortle 4. A brighter bulge core therefore cannot turn mid-size spirals into `galaxyBright`.
- `calibration.test.ts` overlaps the beginner reference in exactly 3 of 5 on all four nights. It runs only at 150 mm / Bortle 5, so it cannot see small-aperture behaviour (research §3).
- The `expectation.test.ts` reference test counts its lists exactly (15 showcase + 7 hard, `:182-196`), and allows at most 3 `KNOWN_DIVERGENCES` (`:220-228`; 2 today).
- The onboarding presets start at 102 mm (`src/lib/onboarding/presets.ts:22-26`), but the gear catalogue lists 21 telescopes at 60 mm, 21 at 70 mm and 33 at 80 mm. Small apertures are real picks.

## Owner Decisions

These are product and astronomy calls. The plan is written on the recommendation (★). The reviewer asks the owner after `/10x-plan-review`, and each item names what changes if the owner picks differently.

- **OD-1: M101 at a dark site in an 80 mm.**
  - ★ (a) The line decides. The sources call M101 a "large nebulous haze with a brighter centre" in an 80 mm under dark skies (`galaxySmudge`), so it keeps full credit there and may stay around #5 at Bieszczady. From a suburb (`galaxyFaint` / `galaxyLimit`) it loses its credit and drops out of the top 10.
  - (b) Stricter: the guard also requires M101 out of the top 5 at Bortle 3 / 80 mm. Phase 3 then adds an aperture-aware low-surface-brightness term for disc-type galaxies below 100 mm. That contradicts the sources and our own `galaxySmudge` line at that setting.
- **OD-2: M31 in a 60 mm under Bortle 5.**
  - ★ (a) `galaxySmudge` at Bortle 5 and 6. This follows Telescope Advisor's table, already cited in the fixture: bright galaxies are "Detectable but faint" at Bortle 5-6. It needs `EXPECT_BULGE_CORE_EXTRA_MAG` in (0.76, 0.86]; the candidate is 0.8.
  - (b) `galaxyBright` at Bortle 5 ("M31's bright central core will pierce all but the worst sky glow", Astronomy; "easy targets for small telescopes", Astronomy Now). This needs (0.86, 1.66]; the candidate is 1.25. More bulge-type galaxies then move one band brighter at bright skies (research §5).
- **OD-3: How general the core fix is.**
  - ★ (a) Every bulge-type spiral (S0 to Sb, 28 catalogue galaxies). This follows the published physics, a concentrated bulge against a flat disc, and the ranking uses the same term.
  - (b) An M31-only exception, like the fixed keys of M24, M40 and M73. It is the narrowest, but ad hoc, and leaves M81-class galaxies on the old core.
- **OD-4: A galaxy whose line is `galaxyLimit`.**
  - ★ (a) Stays listed but takes no brightness credit, so it sinks. "At the edge of what your sky allows" is still a fair try for a keen user, and nothing new appears in the UI.
  - (b) Never clears the bar (`total` forced below `MIN_OBJECT_SCORE`). It is not a recommendation at all, and is counted out like any object under the bar. This changes `clearedCount` on bright-sky nights.

## What We're NOT Doing

- No change to the 22 expectation keys, their wording (EN/PL), or any UI component. The Targets island, the finder chart and `/design` only show different keys or orders.
- No change to the washed-out (moonlight) rule or `effectiveSurfaceBrightness`. They stay on today's flat offset (the moonlight calibration holds), and M31 is never washed out today.
- No change for non-galaxies: nebulae, planetaries and clusters keep today's core and the flat sky penalty. NGC 7000's known divergence stays.
- No change to `SCORE_WEIGHTS`, `MIN_OBJECT_SCORE`, the flat `bortlePenaltyForBortle`, `BRIGHTNESS_RAMP_MAG`, the duration term or the Moon term. Those are #21 items 1, 2, 4 and 5 (S-05 / later).
- No new data source: HyperLEDA's half-light surface brightness was considered and rejected for this slice (research §5).
- No regeneration of `calibration.test.ts` expectations or `beginner-reference.ts`. Elliptical galaxies are not in the bulge class.
- No web lookups during implementation: every URL and quote below comes from research §4.

## Implementation Approach

1. Data first. Phase 1 adds `hubble` through the generator.
2. Then the references, with the expectation rule that must satisfy them, in one red-to-green phase (Phase 2).
3. Then the ranking, which reads the expectation's band, so the reason line and the line cannot disagree, with its own guard (Phase 3).
4. Docs close (Phase 4).

Every new number is a named candidate in `parameters.ts` with its calibration noted. Engine purity holds throughout: the new code is plain functions over catalogue data.

## Critical Implementation Details

- **Import cycle:** the shared core/deficit function must not live in `expectation.ts` (which imports `score.ts`) or in `score.ts`. Put it in a new `src/lib/engine/contrast.ts` that imports only `moonlight.ts` and `parameters.ts`. `telescopeLimitingMag` stays in `score.ts`.
- **Monotonicity:** the bulge term is a per-object constant inside the deficit, so the D-3 invariants (`expectation.test.ts:56,69`) hold by construction. The brightness cap reads the band after the near-limit floor (`contrastBand`), which never brightens at a worse sky and never fades at a bigger aperture, so ranking invariant (g) (`ranking-invariants.test.ts:386-392`) still holds. Do not cap with the margin-capped *key*: that would cap M81 at 80 mm.
- **Hook timing:** the end-of-turn hook runs the whole unit suite. Phase 2 lands its red fixture entries and the rule change in the same commit; never commit a red suite.

## Phase 1: Hubble type in the catalogue

**Subagent:** Sonnet, high effort (catalogue generator and engine data).

### Overview

Extract OpenNGC's `Hubble` column into the generated Messier and Caldwell catalogues at the existing pin, and type it.

### Changes Required:

#### 1. Generator

**File**: `scripts/build-catalogue.mjs`

**Intent**: Write each row's `Hubble` value as `hubble` (trimmed string, `null` when empty). The merged Double Cluster entry gets `null`. No other field changes.

**Contract**: Every object in `messier.json` and `caldwell.json` gains `hubble: string | null`, after `surfaceBrightness`. Same pinned commit `da90466031b0372c896588b85be6016c617e205b`. The meta files are unchanged apart from anything the generator already derives.

#### 2. Regenerated data

**File**: `src/lib/catalogue/messier.json`, `messier.meta.json`, `caldwell.json`, `caldwell.meta.json`

**Intent**: Re-run `npm run catalogue:build` (needs network to the pinned raw GitHub files) and review the diff. Only `hubble` should be added. Never hand-edit.

**Contract**: All 68 galaxies have a non-null `hubble`, with the values listed in research §5.

#### 3. Type and tests

**File**: `src/lib/catalogue/index.ts`, `src/lib/catalogue/messier.test.ts`, `src/lib/catalogue/caldwell.test.ts`

**Intent**: Add `hubble` to `DeepSkyObject` with a doc comment (OpenNGC morphology, e.g. "Sb"; null outside galaxies or where OpenNGC has none). Extend the shape tests. Assert that every galaxy has a non-null `hubble`, and pin M31 `Sb`, M33 `Sc` and M101 `SABc`.

**Contract**: `DeepSkyObject.hubble: string | null`. Hand-built test objects elsewhere in the suite that type as `DeepSkyObject` gain `hubble: null` where the compiler asks.

### Success Criteria:

#### Automated Verification:

- `npm run catalogue:build` reproduces the committed JSON byte for byte on a second run
- `npx vitest run src/lib/catalogue` passes, including the new `hubble` assertions
- `npx astro check` and `npm run lint` pass
- `npm test` passes (no ranking or expectation change yet)

**Implementation Note**: After this phase passes, commit and continue. There is no manual check here.

---

## Phase 2: Small-scope references and the bulge core term

**Subagent:** Sonnet, high effort (engine rule and fixture).

### Overview

Add the published small-scope cases to the reference fixture first, so they run red against today's rule. Then add the bulge-type core term in a shared module so they pass. Both land in one commit.

### Changes Required:

#### 1. Reference fixture

**File**: `src/lib/engine/fixtures/expect-reference.ts`

**Intent**: Add the small-scope hard cases below. All quotes and URLs come from research §4, so nothing is fetched now. Sources read on 2026-10-15 carry that `accessed` date (the existing `source()` helper takes a date argument or a second helper is added). Reuse existing `SRC` keys where research names them.

**Contract**: New `SRC` entries:
- `ASTRONOMY_DEEP_SKY_DELIGHTS` (https://www.astronomy.com/observing/explore-deep-sky-delights/)
- `TELESCOPE_ADVISOR_FIND_ANDROMEDA` (https://www.telescopeadvisor.com/how-to-find-andromeda-galaxy-telescope/)
- `TELESCOPE_ADVISOR_ANDROMEDA_CITY` (https://www.telescopeadvisor.com/can-you-see-andromeda-galaxy-from-city/)
- `SKYHOUND_M31` (https://observing.skyhound.com/archives/oct/M_31.html)
- `FREE_STAR_CHARTS_M33` (https://freestarcharts.com/messier-33)
- `STARLUST_M81` (https://starlust.org/m81-and-m82-galaxies)
- `NATIONAL_GEOGRAPHIC_M81` (https://www.nationalgeographic.com/science/article/160425-weeks-night-sky-jupiter-galaxies-space-astronomy)
- `FREE_STAR_CHARTS_M101` (https://freestarcharts.com/messier-101)
- `TELESCOPE_ADVISOR_M101` (https://www.telescopeadvisor.com/pinwheel-galaxy-m101-telescope-guide/)

New `EXPECT_REFERENCES` entries (all `kind: "hard"`):

| id | mm | Bortle | expected | sources | note (from research §4) |
|---|---|---|---|---|---|
| M31 | 60 | 5 | `galaxySmudge` (OD-2 b: `galaxyBright`) | TELESCOPE_ADVISOR_LIGHT_POLLUTION, ASTRONOMY_DEEP_SKY_DELIGHTS, TELESCOPE_ADVISOR_FIND_ANDROMEDA | "Detectable but faint" at Bortle 5-6; the core "will pierce all but the worst sky glow"; core visible from Bortle 5-6 in a small telescope, a 50-70 mm shows "a large, elongated grey patch" with a brighter core |
| M31 | 60 | 6 | `galaxySmudge` | same three | as above |
| M31 | 60 | 8 | `galaxyFaint` | TELESCOPE_ADVISOR_LIGHT_POLLUTION, SKYHOUND_M31, TELESCOPE_ADVISOR_ANDROMEDA_CITY | "Very difficult" at Bortle 7-8; "the feeble glow of the nucleus" from a light-polluted site; Bortle 8 "Compact oval core, limited halo" |
| M33 | 80 | 4 | `galaxySmudge` | ASTRONOMY_NOW_M33, FREE_STAR_CHARTS_M33 | from a dark site "a fine sight through … a small, wide-field refractor"; an 80 mm shows "a very large diffuse patch of light" |
| M81 | 80 | 5 | `galaxySmudge` | STARLUST_M81, TELESCOPE_ADVISOR_LIGHT_POLLUTION, NATIONAL_GEOGRAPHIC_M81 | visible in 7×50 binoculars "in suburban skies"; "Detectable but faint" at Bortle 5-6; located easily "even from light-polluted suburbia" |
| M101 | 80 | 3 | `galaxySmudge` | FREE_STAR_CHARTS_M101, TELESCOPE_ADVISOR_M101, ASTRONOMY_M101 | an 80 mm shows "a large nebulous haze with a brighter centre", dark skies a must; "80mm sees the core"; "The core is relatively easy to observe in small scopes" |
| M101 | 80 | 6 | `galaxyLimit` | TELESCOPE_ADVISOR_LIGHT_POLLUTION, TELESCOPE_ADVISOR_M101, FREE_STAR_CHARTS_M101 | faint galaxies "need Bortle 4 or better", "Difficult" at 5-6; "strongly affected by light pollution"; in light-polluted areas sometimes difficult "even with 200mm" |

New `KNOWN_DIVERGENCES` entry (the third, which is the cap):
- M33, 80 mm, Bortle 6, expected `galaxyLimit`, computed `galaxyFaint`.
- Sources: ASTRONOMY_DEEP_SKY_DELIGHTS ("spotting it using binoculars through light-polluted suburban skies is challenging enough"), ASTRONOMY_NOW_M33 (hard under "an urban or even a suburban sky"), FREE_STAR_CHARTS_M33 ("even a small amount of light pollution can render it invisible").
- Reason: the deficit is 2.47 against the `limit` threshold of 2.5. The disc-type core is calibrated on the 150 mm entries, and moving it 0.03 mag to fit one entry would be fitting noise.
- If the phase's change computes `galaxyLimit` here after all, the entry moves into `EXPECT_REFERENCES` (the divergence test enforces that).

#### 2. Reference test counts

**File**: `src/lib/engine/expectation.test.ts`

**Intent**: Extend the exact HARD list (`:182-196`) with the seven new entries. The total becomes 29 references, plus 3 divergences. Leave every invariant test as it is.

**Contract**: The test still asserts the exact set of showcase and hard entries, ≥ 2 sources each, the published key for each, and at most 3 divergences.

#### 3. Shared contrast module

**File**: `src/lib/engine/contrast.ts` (new), `src/lib/engine/index.ts`

**Intent**:
- Move the deficit computation out of `expectation.ts`.
- Add the galaxy core: a galaxy whose `hubble` is in `BULGE_HUBBLE_TYPES` is brighter by `EXPECT_BULGE_CORE_EXTRA_MAG`; any other object uses `effectiveSurfaceBrightness` unchanged.
- Move `contrastBand` here too (it is the band both rules read), with the near-limit floor. Export it through the barrel. `expectation.ts` re-exports or imports it, so its public API is unchanged.

**Contract**:
- `coreSurfaceBrightness(object: Pick<DeepSkyObject, "type" | "vMag" | "majorAxisArcmin" | "minorAxisArcmin" | "hubble">): number | null`
- `contrastDeficit(object, bortle, apertureMm): number | null`
- `contrastBand(object, bortle, apertureMm): ContrastBand`, the same semantics as today plus the core term.
- `ExpectationObject` gains `"hubble"`.
- `contrast.ts` imports only `./moonlight` and `./parameters`. `telescopeLimitingMag` moves to `contrast.ts` too, re-exported from `score.ts` so callers keep their import, or `contrastBand` takes the limit as an argument. The implementer picks whichever keeps the import graph acyclic, and records it.

#### 4. Parameters

**File**: `src/lib/engine/parameters.ts`

**Intent**: Add the two candidates after the `EXPECT_*` block, with comments naming the calibration.
- `BULGE_HUBBLE_TYPES`: exact OpenNGC strings for S0 to Sb, plain, SAB and SB.
- `EXPECT_BULGE_CORE_EXTRA_MAG`: 0.8, the window (0.76, 0.86] from the M31 60 mm references (OD-2 a). Under OD-2 b it is 1.25, in (0.86, 1.66].

**Contract**:
- `BULGE_HUBBLE_TYPES: readonly string[]` = `S0`, `S0-a`, `E-S0`, `Sa`, `SABa`, `SBa`, `Sab`, `SABab`, `SBab`, `Sb`, `SABb`, `SBb`.
- `EXPECT_BULGE_CORE_EXTRA_MAG = 0.8`.
- A test in `contrast.test.ts` asserts every catalogue galaxy's `hubble` is either in `BULGE_HUBBLE_TYPES` or in an explicit `DISC_OR_OTHER_HUBBLE_TYPES` list kept in the test, so an unknown OpenNGC value after a future pin bump fails loudly.

#### 5. Expectation rule

**File**: `src/lib/engine/expectation.ts`

**Intent**: Use the shared `contrastDeficit` / `contrastBand`. Everything else (per-type tables, margin, fixed keys) is unchanged.

**Contract**: `expectationFor(object, bortle, apertureMm)` keeps its signature; `object` now includes `hubble`.

#### 6. Contrast tests

**File**: `src/lib/engine/contrast.test.ts` (new)

**Intent**:
- The bulge core is exactly `EXPECT_BULGE_CORE_EXTRA_MAG` brighter than `effectiveSurfaceBrightness` for a bulge-type galaxy, and equal to it for a disc-type galaxy, an elliptical and every non-galaxy.
- The Hubble coverage test (item 4).
- A deliberate-break check, in the style of D-3: flipping the term's sign turns the M31 60 mm references red. Run it once by hand and record it in Progress, not as a permanent test.

**Contract**: Pure tests over `DEEP_SKY`.

### Success Criteria:

#### Automated Verification:

- Before the rule change, the new M31 references fail and the other six new entries pass (recorded once in the phase notes, not committed red)
- `npx vitest run src/lib/engine/expectation.test.ts src/lib/engine/contrast.test.ts` passes: 29 references, 3 divergences, D-3 invariants (total, deterministic, monotone in Bortle and aperture, globular regression, every key reachable)
- The re-run research §5 table at the chosen `EXPECT_BULGE_CORE_EXTRA_MAG` is recorded in the phase notes: which galaxies change key at 60 mm / B6, 150 mm / B4 and 150 mm / B7
- `npm test` passes with `calibration.test.ts` untouched
- `npx astro check` and `npm run lint` pass; `purity.test.ts` passes

**Implementation Note**: After this phase passes, commit and continue. Manual checks are deferred to Phase 4's owner checklist.

---

## Phase 3: Ranking follows the line

**Subagent:** Sonnet, high effort (engine scoring and ranking tests).

### Overview

A galaxy's brightness credit is capped by its contrast band, so the ranking, the reason line and the expectation line agree. A small-aperture ranking guard pins the outcome.

### Changes Required:

#### 1. Brightness cap for galaxies

**File**: `src/lib/engine/score.ts`, `src/lib/engine/parameters.ts`

**Intent**: For an object of type `galaxy`, `components.brightness = min(today's headroom ramp, cap(contrastBand(object, bortle, apertureMm)))`:
- cap 1 for `bright` and `smudge`;
- `GALAXY_FAINT_BRIGHTNESS_CAP` for `faint`;
- `GALAXY_LIMIT_BRIGHTNESS_CAP` for `limit`.

Non-galaxies are unchanged. The sky component, the bar and the washed-out rule keep their formulas. The washed-out rule's "would it clear without the Moon" total reads the capped components, which is consistent.

**Contract**:
- `ScoredObject` gains `"hubble"`.
- New candidates: `GALAXY_FAINT_BRIGHTNESS_CAP` (start 0.25) and `GALAXY_LIMIT_BRIGHTNESS_CAP` (0, OD-4 a).
- Phase 3 settles each at the smallest change that turns the guard green with `calibration.test.ts` unchanged, and records the chosen values and the guard's before/after ranks in the parameter comments.
- Under OD-4 b, a `limit` galaxy also returns a total below `MIN_OBJECT_SCORE`, through an explicit branch, not a negative weight.

#### 2. Small-aperture ranking guard

**File**: `src/lib/engine/small-scope.test.ts` (new)

**Intent**: Pin the slice's outcome on fixed nights at the calibration test's Warsaw site (`fixtures/index.ts:473`), plus the S-02 checkpoint's Bieszczady night (49.10 N, 22.65 E, 600 m, Europe/Warsaw). Minimum altitude 15°, eyepieces as in calibration, unlimited list. The expectations come from research §2 and §4, never from the engine's own output.

**Contract**:
- G1: Warsaw 2026-04-15, Bortle 5 and 6, 60 and 80 mm: M101 is not in the top 10, and no galaxy in the top 5 has key `galaxyFaint` or `galaxyLimit`.
- G2: Warsaw 2026-07-15 and 2026-10-15, Bortle 6, 60 mm: M31 is in the top 5 with key `galaxySmudge` or `galaxyBright`.
- G3: Warsaw 2026-10-15, Bortle 6, 60 mm: M33 is not in the top 10.
- G4: Bieszczady 2027-04-06, Bortle 3, 80 mm: M101's key is `galaxySmudge`. Under OD-1 b it is also not in the top 5.
- G5 (consistency invariant): over the four calibration nights plus the Bieszczady night, × {60, 80, 150 mm} × Bortle {3, 5, 6, 8}, every listed galaxy (top 5) whose `leadComponent` or `secondComponent` is `brightness` has key `galaxyBright` or `galaxySmudge`.

#### 3. Existing score and ranking tests

**File**: `src/lib/engine/score.test.ts`, `src/lib/engine/ranking.test.ts`

**Intent**: Add score tests for the cap. A `faint`-band galaxy's brightness equals the cap when the headroom ramp is higher, and a `bright` or `smudge` one is uncapped. A larger aperture never lowers a galaxy's brightness component. Existing assertions stay as they are: the borderline objects in `ranking.test.ts` are double stars, and the totals test (`score.test.ts:288-304`) scores a 10′ galaxy of V 3.1 at 7 mm under Bortle 6, whose deficit is about −1.9 (band `bright`), so it is uncapped. Its `CLUSTER` base object gains `hubble: null`. If any existing assertion turns red, the cause is investigated, and the assertion is not edited to match.

**Contract**: No change to the existing assertions' expected values.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/engine/small-scope.test.ts` passes G1-G5, and G1-G3 fail against Phase 2's code (checked once before the cap lands, recorded in the phase notes)
- `npx vitest run src/lib/engine/calibration.test.ts` passes with its file and `beginner-reference.ts` unchanged; the per-night top ten before and after is recorded with the snapshot command
- `npx vitest run src/lib/engine/ranking-invariants.test.ts` passes, including (g) "aperture never shrinks the cleared set"
- `npm test`, `npx astro check` and `npm run lint` pass

**Implementation Note**: After this phase passes, commit and continue. Manual checks are deferred to Phase 4's owner checklist.

---

## Phase 4: Docs and owner checklist

**Subagent:** Sonnet, medium effort (docs only).

### Overview

Record the new rule wherever the old one is described, and leave the owner's manual checks.

### Changes Required:

#### 1. Project docs

**File**: `CLAUDE.md`

**Intent**:
- In the "What to expect" paragraph, describe the core term (bulge-type spirals by OpenNGC `hubble`, `EXPECT_BULGE_CORE_EXTRA_MAG`, shared `contrast.ts`), the new references and the third divergence.
- In the Catalogue paragraph, add the `hubble` field.
- In the Engine paragraph, add that a galaxy's brightness credit follows its contrast band, and the new guard `small-scope.test.ts`.

**Contract**: Edit only those three paragraphs.

#### 2. PRD open questions

**File**: `context/foundation/prd.md`

**Intent**:
- Open Question 5: the Bortle penalty is unchanged, but a galaxy's brightness credit is now capped by its contrast band in the user's aperture.
- Open Question 17: the galaxy core term is calibrated on small-scope references.

Both stay candidates, judged without an observer.

**Contract**: Edit only Open Questions 5 and 17 (wording only, no new requirement).

#### 3. Owner checklist

**File**: `context/changes/small-scope-galaxies/manual-checks.md` (new)

**Intent**: List the owner's checks. On a local production preview (port 4333, forecast fixture on 4400, local Supabase; full plan granted through `account:plan` with the local key inline, never exported), with a 60 mm telescope at a Bortle 6 site:
- On a night with M31 in the targets, its line reads "A faint grey smudge with a slightly brighter middle", not "very faint".
- On an April night, M101 is not among the top targets.
- At 150 mm / Bortle 4, M31 still reads "An oval glow with a bright centre".

**Contract**: A checklist only; no screenshots are required.

#### 4. Roadmap status

**File**: `context/foundation/roadmap.md`

**Intent**: The roadmap with S-04 `small-scope-galaxies` is in PR #176, which is not merged yet. After it merges, the implement phase flips the item's status as `/10x-implement` does. Nothing is edited on this branch before then.

**Contract**: No edit while PR #176 is open.

### Success Criteria:

#### Automated Verification:

- `npm test` and `npm run lint` pass (docs only)
- Before the PR, the whole e2e suite and `npm run smoke` run against a fresh local production build, the way CI does (lessons.md), and the counts are reported in the PR

#### Manual Verification:

- The owner runs the three checks in `manual-checks.md`

---

## Testing Strategy

### Unit Tests:

- The reference fixture (29 entries, 3 divergences) is the oracle for the line. The D-3 invariants hold for every catalogue object, Bortle 1-9 and 9 apertures.
- `contrast.test.ts`: the bulge term's size and scope, and Hubble coverage.
- `score.test.ts`: the cap's behaviour, and that it never decreases with aperture.
- `small-scope.test.ts`: G1-G5, the slice's outcome, and the reason/line consistency invariant.
- `calibration.test.ts` and `ranking-invariants.test.ts` stay unchanged and green.

### Integration Tests:

- The whole e2e suite and smoke before the PR. `what-to-expect.spec.ts` asserts the gate and phrase presence, not a specific galaxy key, so it is not expected to change.

### Manual Testing Steps:

1. Preview with a 60 mm telescope at a Bortle 6 site; open `/tonight/targets` on a night with M31 in the list.
2. Check the M31 line and reason agree (a "smudge" line beside "Bright for your 60 mm").
3. Switch to an April night and confirm M101 is not in the top five.

## Performance Considerations

`contrastBand` is a few arithmetic operations per galaxy per ranking (68 galaxies), and is already computed in the Targets island. No measurable cost. The `hubble` strings add a few hundred bytes to server-only JSON.

## Migration Notes

None. No database, no stored data, no offline-copy format change. Stored Targets copies show the new lines at their next online refresh (S-04 O-2 behaviour).

## References

- Research: `context/changes/small-scope-galaxies/research.md`
- Roadmap: PR #176, branch `docs/roadmap-m4`, S-04
- Issues: #172, #159, #21 (item 3)
- Prior rule: `context/archive/2026-10-14-what-to-expect/plan.md` (D-2, D-3, D-6) and `manual-checks.md` (check 2.9)
- S-02 checkpoint: `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md:176-283`
- Moonlight calibration: `context/archive/2026-10-02-moonlight-and-the-verdict/checkpoint.md:23-26`
- Invariants: `context/archive/2026-10-08-testing-ranking-invariants-and-calibration-oracle/plan.md:229-232`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Hubble type in the catalogue

#### Automated

- [ ] 1.1 `npm run catalogue:build` reproduces the committed JSON byte for byte on a second run
- [ ] 1.2 `npx vitest run src/lib/catalogue` passes, including the new `hubble` assertions
- [ ] 1.3 `npx astro check` and `npm run lint` pass
- [ ] 1.4 `npm test` passes (no ranking or expectation change yet)

### Phase 2: Small-scope references and the bulge core term

#### Automated

- [ ] 2.1 Before the rule change, the new M31 references fail and the other six new entries pass (recorded once in the phase notes, not committed red)
- [ ] 2.2 `npx vitest run src/lib/engine/expectation.test.ts src/lib/engine/contrast.test.ts` passes: 29 references, 3 divergences, D-3 invariants
- [ ] 2.3 The re-run research §5 table at the chosen `EXPECT_BULGE_CORE_EXTRA_MAG` is recorded in the phase notes
- [ ] 2.4 `npm test` passes with `calibration.test.ts` untouched
- [ ] 2.5 `npx astro check` and `npm run lint` pass; `purity.test.ts` passes

### Phase 3: Ranking follows the line

#### Automated

- [ ] 3.1 `npx vitest run src/lib/engine/small-scope.test.ts` passes G1-G5, and G1-G3 fail against Phase 2's code
- [ ] 3.2 `npx vitest run src/lib/engine/calibration.test.ts` passes with its file and `beginner-reference.ts` unchanged; top ten before and after recorded
- [ ] 3.3 `npx vitest run src/lib/engine/ranking-invariants.test.ts` passes, including (g)
- [ ] 3.4 `npm test`, `npx astro check` and `npm run lint` pass

### Phase 4: Docs and owner checklist

#### Automated

- [ ] 4.1 `npm test` and `npm run lint` pass (docs only)
- [ ] 4.2 Before the PR, the whole e2e suite and `npm run smoke` run against a fresh local production build; counts reported in the PR

#### Manual

- [ ] 4.3 The owner runs the three checks in `manual-checks.md`
