# Test rollout Phase 3: ranking invariants and calibration oracle — Implementation Plan

## Overview

This plan proves Risks #3 and #4 of `context/foundation/test-plan.md` protected.

- **Risk #3.** No ranked object, planet, Moon entry or Session plan row is ever outside its window or under the site's minimum altitude. This is proven over seeded, generated sites, nights, skies and telescopes against altitude recomputed independently in the test.
- **Risk #4.** A retune that breaks a PRD invariant, or that pushes published beginner showpieces out of the top 5, fails the suite.

The work is unit tests in four phases:

1. Engine visibility property suite.
2. Ranking invariants as relations.
3. An independent top-5 oracle, which replaces the order literal copied from engine output.
4. A Tonight and Session plan property suite, plus docs.

There is no product behaviour change.

## Current State Analysis

From `research.md` (this folder), verified 2026-10-08 at fd2617e:

- **Visibility.**
  - One predicate, `bestWindow` (`src/lib/engine/objects.ts:76-105`), decides the window for deep sky, planets and the Moon. It takes the longest run of 10-min samples with refracted altitude at or above the site minimum; samples cover only the dark window (deep sky) or the −6° window (planets, Moon). The peak is a sample of that run.
  - Deep-sky entries carry `score.window` (`score.ts`, `ObjectScore.window`) and `peak`. Planet and Moon entries carry `window` and `peak`.
  - Session plan rows reuse the raw window and `peak.time` (`src/lib/tonight/build.ts:1019-1054`). `layoutSessionPlan` clamps only display fractions.
  - A worker probe found 0 violations over about 19,000 rows across 7 sites, 6 dates and 3 configurations, with altitude computed directly from astronomy-engine.
  - Every existing invariant test is fixed-case, almost all at Warsaw with a 150 mm scope.
- **Short windows.** About 0.7% of entries are up for a single 10-min sample (`start == end`) and still clear the bar. You chose to pin this rule and document it, with no product change.
- **Calibration.**
  - `src/lib/engine/calibration.test.ts` stores no snapshot; its opt-in "snapshot" is a `console.log` (`:44-61`).
  - It asserts four loose rules on four new-Moon Warsaw nights (Bortle 5, 150/750): ≥1 Caldwell clears, ≥3 Messier in the top 5, the Double Cluster in the October top 10, and no Caldwell galaxy with V > 10 in the top 5 (`:71-94`).
  - It guards only `MESSIER_RANK_BONUS`.
  - `src/lib/engine/ranking.test.ts:195` pins the exact top 5 `["M31","M34","M39","M45","M52"]`, which was copied from engine output.
- **PRD invariants** (`context/foundation/prd.md:565-575`, FR-018 `:391`) are covered only by small synthetic cases. Each is either a relation over the cleared set or an equality between two rankings, so each is testable at catalogue scale without engine-derived expected values:
  - 1–2 ratings inert (`ranking.test.ts:312`, a 3-object catalogue);
  - the bar reads only `score.total` (`ranking.ts:229-236`);
  - washed-out objects are never listed.
- **Tooling.**
  - No property library is installed. A seeded mulberry32 generator with a non-vacuity count exists in `src/lib/forecast/degraded-forecast.test.ts:143-157`.
  - Costs: `rankObjects` over 171 objects takes about 3–4 ms; with planets and the Moon about 9 ms; `buildTonight` with `withSessionPlan` about 13 ms.
  - `buildTonight` works with `forecast: null`, giving a marginal verdict, so the ranking is still built.

## Desired End State

- `npm test` contains:
  - a seeded engine property suite (about 200 generated cases) proving that every listed object, planet and Moon entry is at or above the site minimum and inside its sun-altitude window at its window start, end and best time, with altitude and sun altitude recomputed from astronomy-engine in the test;
  - catalogue-scale relation tests for the PRD ranking invariants;
  - a calibration oracle: each calibration night's top 5 contains at least **k = 3** objects from a committed, source-cited beginner reference;
  - a seeded Tonight suite (about 40 builds) proving every Session plan row is visible, and that no ranking appears when there is no dark window or the verdict is no-go.
- `ranking.test.ts` no longer pins an engine-copied order. The print-only snapshot is documented as a recording aid, not an oracle.
- Test plan §6.3 and §6.6 are written.

Verify: `npm test` is green. Each phase's break checks turn its suite red and are reverted.

### Key Discoveries:

- **Independent oracle for Risk #3 (research "Property-test mechanics"):**
  - Deep sky: the J2000 catalogue vector through `Rotation_EQJ_EQD(time)` and then `Horizon(time, observer, ra, dec, "normal")`. This path differs from the engine's `Rotation_EQJ_HOR`.
  - Planets and the Moon: `Equator(body, time, observer, true, true)` then `Horizon(…, "normal")`.
  - Sun, geometric like `darkWindow` (`sun.ts:19-23`): `Equator(Body.Sun, …)` then `Horizon` with no refraction.
  - The model differences are small (the probe's smallest margin was 0.0002°). A tolerance of ε = 0.05° in altitude covers them and is far under the 1° accuracy NFR (`prd.md:488`).
- **Deep-sky window inputs.** `darkWindow(site, observingNight(date, tz), darknessThresholdDegForBortle(bortle))` (−18/−15/−12°). Generated cases must skip `kind: "none"` and count how many they skip.
- **Generator ranges** (`src/lib/gear/schemas.ts`):
  - site: Bortle 1–9, min altitude 0–60;
  - telescope: aperture 20–1000 mm, focal length 100–5000 mm; use 50–400 mm at f/3–f/16 for realism (`gear/catalogue/README.md:29`);
  - eyepieces: 2–60 mm, AFOV 30–120°; a kit of 0–3, empty allowed.
  - Time zones come from a fixed site list with known zones, so no tz lookup is needed.
- **Beginner reference** (compiled 2026-10-08 by a worker that never saw the engine's output; WebFetch summaries, access date 2026-10-08). The rule, fixed before any comparison: an object counts for a night when at least 2 sources name it as a beginner target for that season. Sources, by key:
  - AW: Astronomy.com "See winter's best Messier objects", https://www.astronomy.com/observing/see-winters-best-messier-objects/ (lists spring galaxies, so it counts for April).
  - AS: Astronomy.com "Observe spring's best Messier objects", https://www.astronomy.com/observing/observe-springs-best-messier-objects/
  - ASU: Astronomy.com "Run a mini Messier marathon this summer", https://astronomy.com/observing/run-a-mini-messier-marathon-this-summer
  - AF: Astronomy.com "See fall's best Messier objects", https://www.astronomy.com/observing/see-falls-best-messier-objects/
  - TS: Telescope School "Beginner Deep Sky Objects by Season", https://telescopeschool.com/beginner-deep-sky-objects-by-season-your-guide-to-easy-stargazing-targets/
  - LNS: Love the Night Sky "Deep Space Objects for Beginners" pt 1 and 2, https://lovethenightsky.com/best-deep-space-objects-pt-1/ and https://lovethenightsky.com/best-deep-space-objects-pt-2/
  - TA: Telescope Advisor "Best Messier Objects for Beginners", https://www.telescopeadvisor.com/best-messier-objects-for-beginners/
  - SZ: Starizona "Best beginners objects", https://starizona.com/blogs/tutorials/best-beginners-objects
  - TW: Telescopic Watch "Top deep-sky objects for beginners", https://telescopicwatch.com/top-deep-sky-objects-for-beginners/

  Sets with at least 2 sources:

  | Night | Objects |
  | --- | --- |
  | 2026-01-15 | M42, M45, M35, NGC869, M31, M36, M37, M41 |
  | 2026-04-15 | M44, M51, M81, M82, M3, M65, M66, M13, M104, M97, M67, M96, M105, M87, M84, M86, M49, M35, M42, M45 |
  | 2026-07-15 | M8, M27, M57, M13, M11, M17, M20, M16, M7, M6, M22, M4, NGC7000, M2, M15, M21, M24, M29, M39, M73 |
  | 2026-10-15 | M31, NGC869, M45, M32, M13, M57, M27, M15, M2, M29, M39, M73, M72, M24, M18, M28, M69, M14, M21 |

  The per-object source keys are in the worker report summarised in this plan's References. They are carried into the fixture.
  - Against the archived top 5s (`context/archive/2026-10-06-deep-sky-beyond-messier/evidence/calibration.md`), the overlap is exactly 3 on every night (Jan: NGC869, M35, M37; Apr: M3, M13, M81; Jul: M39, M13, NGC7000; Oct: M31, NGC869, M39).
  - You chose k = 3. The list was fixed before the comparison, and k was chosen after it. If a night falls below 3, the plan stops and asks; it never edits the list to fit.
- **Order literal replacement.** The AF fall list (M14, M21, M24, M18, M28, M69, M29, M72, M73, M39, M52, M31, M32, M103, M33, M74, M76, M34, M77, M45) contains all five of the 2026-10-10 Messier-only top five (archived checkpoint). A set assertion against AF is an independent check that tolerates reordering.

## What We're NOT Doing

- **No product or ranking change:** no minimum visible duration for short windows (your decision), no retune, and no fix to issue #21's items.
- **No property-testing library** (no fast-check). The seeded mulberry32 pattern is reused.
- **No new Stellarium or Skyfield captures, and no Python in the repo.** The Risk #3 oracle is astronomy-engine called directly from the test. The Risk #4 oracle is the committed reference list.
- **No exact-order assertions,** except where the PRD fixes a rule (the tie-break is total; that is asserted as a relation, permutation invariance).
- **No change to `calibration.test.ts`'s four existing rules.** They stay; the oracle is added next to them. The print-only snapshot stays as a recording aid.
- **No weather-mask fuzzing.** Generated Tonight builds use `forecast: null`, plus one cloudy forecast for the no-go case. `clearIntervals` stays covered by its existing unit tests.
- **No posting to GitHub #21 without your OK.** Phase 4 drafts the comment text; you post it or approve posting.

## Implementation Approach

The phases follow cost × signal:

1. **Phase 1** is the cheapest broad check. It is pure engine, about 9 ms per case, and its oracle is independent by construction.
2. **Phase 2** turns the PRD invariants into relations at catalogue scale. Relations need no expected values, so the oracle problem can't arise.
3. **Phase 3** adds the only external judgment of quality (the reference list) and removes the one engine-copied order.
4. **Phase 4** extends the visibility proof to what the user actually sees (Session plan rows, the no-ranking gates), then writes the docs.

## Critical Implementation Details

- **Build generated cases up front.**
  - Build the case array at module scope, from the seed only. Run every engine call inside `it` or `beforeAll`.
  - Print the case index and inputs in each assertion message so a failure can be replayed.
  - Assert non-vacuity counts first, computed from the generated inputs or totals:
    - Phase 1: at least 150 cases with a dark window, at least 3,000 object entries checked, at least 20 southern-hemisphere cases, at least 10 cases above 60°, and at least 50 planet entries;
    - Phase 4: at least 30 Session plans with rows.
- **Tolerance.** Altitude is checked as `independentAltitude >= minAltitudeDeg − 0.05`. Sun altitude is checked as `independentSunAltitude <= threshold + 0.05`, where threshold is the Bortle dark threshold for deep sky and −6 for planets and the Moon. Don't tighten ε to zero: the engine and test paths differ by arcseconds.
- **Keep shared helpers out of scanned source.** Put the shared seeded generator and site list in `src/lib/engine/fixtures/` (test-only, skipped by `purity.test.ts`). The runner-zone guard also skips that directory.
- **Calibration nights.** Use the existing `warsawDarkWindow(date, 5)`, `WARSAW`, `TELESCOPE` and `EYEPIECES` from `src/lib/engine/fixtures/index.ts`, exactly as `calibration.test.ts` does, so the oracle judges the same rankings the archived evidence recorded.

## Phase 1: Engine visibility property suite (unit, Risk #3)

### Overview

Seeded, generated sites, nights, skies and telescopes. Every listed deep-sky entry, planet entry and Moon target is visible at its window start, end and best time, according to astronomy-engine called directly.

### Changes Required:

#### 1. Seeded generator and site list

**File**: `src/lib/engine/fixtures/generated.ts` (new); `src/lib/engine/fixtures/README.md`

**Intent**: Give every property suite one replayable generator and a realistic, varied site list.

**Contract**:
- `seeded(seed): () => number`, mulberry32 as in `degraded-forecast.test.ts:143-157`. That file keeps its local copy, untouched.
- `GENERATED_SITES`, about 16 entries `{ label, latitudeDeg, longitudeDeg, elevationM, timeZone }` covering:
  - the equator (Quito or Singapore);
  - 20–35° N (Kolkata, Los Angeles);
  - 45–55° N (Warsaw, Madrid);
  - 60–70° N (Helsinki, Tromsø 69.65);
  - 78° N (Longyearbyen);
  - 20–40° S (Sydney, Santiago, Cape Town);
  - 64.8° S (Antarctic Peninsula, a fixed zone);
  - +13/+14 zones (Auckland, Kiritimati).
- `generateCase(random)` returns `{ site, date (any day of 2026), bortle 1–9, minAltitudeDeg 0–60, telescope {id, apertureMm 50–400, focalLengthMm = round(aperture × f/3–f/16)}, eyepieces 0–3 drawn from src/lib/gear/eyepiece-presets.ts }`.
- The README gets a short "Generated cases" note: the seed, the sites, that the module is test-only, and that it must never use engine output.

#### 2. Visibility property suite

**File**: `src/lib/engine/visibility-invariants.test.ts` (new)

**Intent**: Prove the never-impossible guardrail (`prd.md:88-94`, `:568-570`) across the generated space, with an oracle independent of `bestWindow`, `objectTracks`, `planetTracks` and `moonState`.

**Contract**:
- About 200 cases from a fixed seed. For each case with a dark window (`darkWindow` at the Bortle threshold, `kind: "window"`), call `rankObjects({…, catalogue: DEEP_SKY, limit: Infinity})`. With a −6° window, also call `rankPlanets` and `moonTarget`.
- For **every** entry's `score.window` (deep sky) or `window` (planet, Moon), at `start`, `end` and `peak.time`, assert:
  - (a) the independent altitude is at least `minAltitudeDeg − 0.05`;
  - (b) the independent geometric sun altitude is at most the threshold + 0.05;
  - (c) `start ≤ peak.time ≤ end`, and all three lie within the dark window (deep sky) or the planet window.
- The independent helpers live in the test file:
  - deep sky: J2000 `raDeg`/`decDeg` vector → `Rotation_EQJ_EQD` → `Horizon(…, "normal")`;
  - planets and the Moon: `Equator(body, t, observer, true, true)` → `Horizon(…, "normal")`;
  - sun: `Equator(Body.Sun, …)` → `Horizon` with no refraction.
- **Short-window rule (pinned).** Collect the entries with `window.start === window.end`. Assert each still meets (a)–(c) at that single instant, which documents the accepted rule. Log nothing.
- **Non-vacuity:** the counts from "Critical Implementation Details" are asserted first.
- **Behaviour asserted:** a listed target is up at or above the minimum, in darkness, for its whole shown window.
- **Regression caught:**
  - a sampling or window change that reports a window edge where the target is below the minimum;
  - a threshold mix-up (deep sky judged against −6°);
  - a refraction or J2000 handling slip;
  - a peak picked outside the window.
- **Edge cases:** polar summer (skipped and counted), polar night with clamped windows, the southern hemisphere, the equator, min altitude 0 and 60, empty eyepiece kits, single-sample windows.
- **Anti-pattern avoided:** an oracle built from the engine's own tracks, and fixed-night-only assertions.

### Success Criteria:

#### Automated Verification:

- The suite passes: `npx vitest run src/lib/engine/visibility-invariants.test.ts`
- Break checks, then reverted and logged below:
  - in `bestWindow`, temporarily widening the window by one sample on each side turns (a) or (c) red;
  - temporarily ranking deep sky over the −6° window instead of the Bortle threshold in the suite's call turns (b) red. This is a suite-input edit, because the threshold is passed in by the caller. The production-side equivalent is Phase 4's `cardPasses` check.
- Full unit suite, lint and type check pass: `npm test`, `npx eslint . --ignore-pattern '.claude/**'`, `npx astro check`

**Break-check log**: (filled in by `/10x-implement`.)

**Implementation Note**: Commit and push the phase, then continue.

---

## Phase 2: Ranking invariants as relations (unit, Risk #4)

### Overview

The PRD's ranking invariants become relations over the full catalogue, on the four calibration nights, two full-Moon nights and about 20 generated cases. Expected values are never computed from the code under test.

### Changes Required:

#### 1. Invariant relations suite

**File**: `src/lib/engine/ranking-invariants.test.ts` (new)

**Intent**: Make a retune that breaks a "decided, not tuned" PRD rule (`prd.md:565-575`) fail at catalogue scale.

**Contract**:
- **Inputs:**
  - the calibration nights 2026-01-15, 04-15, 07-15 and 10-15 (Warsaw, Bortle 5, 150/750, `warsawDarkWindow(date, 5)`);
  - the full-Moon nights 2026-10-26 and 2026-03-03 (Warsaw, Bortle 6);
  - about 20 generated cases from Phase 1's generator with a dark window.
- All rankings use `DEEP_SKY` and `limit: Infinity`.
- **Relations asserted:**
  - **(a) 1–2 ratings inert (FR-018, invariant at `prd.md:574`).** Adding log entries rated 1 or 2 for 30 seeded-random catalogue objects gives a `Ranking` deep-equal to the empty-log ranking.
  - **(b) Seen never decides the bar.** With every catalogue object logged at rating 4 (`seen` for all), `clearedCount` and the set of cleared ids equal the unseen ranking's.
  - **(c) The Messier bonus never decides the bar.** Ranking a copy of `DEEP_SKY` with `messier` set to `null` on every object gives the same `clearedCount` and cleared id set as the original. The bonus applies only when `messier !== null` (`ranking.ts:229-230`), so no constant injection is needed.
  - **(d) The bar is the PRD bar.** Every entry has `score.total >= MIN_OBJECT_SCORE`, and `rankScore − score.total` is one of {0, MESSIER_RANK_BONUS, −LOG_PENALTY, MESSIER_RANK_BONUS − LOG_PENALTY} (within 1e-9).
  - **(e) Washed out is never listed.** No `washedOut` id appears among `entries`. On both full-Moon nights `washedOutCount ≥ 1` (precondition).
  - **(f) Permutation invariance.** Ranking a seeded shuffle of `DEEP_SKY` gives the same entry id order.
  - **(g) Aperture never shrinks the cleared set.** For each calibration night and 5 generated cases, the cleared id set at 150 mm is a subset of the set at 300 mm (same focal ratio).
- **Behaviour asserted:** the bar reads only an object's own score; logs and the Messier bonus only reorder; low ratings are inert; a bigger telescope never hides an object.
- **Regression caught:**
  - `LOG_PENALTY_MIN_RATING` lowered to 2;
  - the log penalty or bonus moved into `score.total`;
  - a washed-out filter dropped;
  - a non-total tie-break;
  - a brightness term that penalises aperture.
- **Edge cases:** full-Moon nights, every object seen, a catalogue with no Messier objects, generated far-zone sites.
- **Anti-pattern avoided:** expected rankings copied from engine output. Every assertion compares two engine runs or checks a PRD constant relation.
- **If (g) fails on today's code,** it is a real finding. Stop and ask; never weaken it.

### Success Criteria:

#### Automated Verification:

- The suite passes: `npx vitest run src/lib/engine/ranking-invariants.test.ts`
- Break checks, then reverted and logged below:
  - `LOG_PENALTY_MIN_RATING` = 2 in `parameters.ts` turns (a) red;
  - in `ranking.ts`, filtering the bar on `rankScore` instead of `score.total` turns (b) or (c) red;
  - removing the `washedOut` exclusion from the cleared filter turns (e) red.
- Full unit suite, lint and type check pass: `npm test`, `npx eslint . --ignore-pattern '.claude/**'`, `npx astro check`

**Break-check log**: (filled in by `/10x-implement`.)

**Implementation Note**: Commit and push the phase, then continue.

---

## Phase 3: Independent top-5 oracle and calibration cleanup (unit, Risk #4)

### Overview

A committed, source-cited beginner reference judges each calibration night's top 5 (overlap at least 3). The engine-copied order literal is replaced by a set check against a published list. The print-only snapshot is documented as not an oracle.

### Changes Required:

#### 1. Beginner reference fixture

**File**: `src/lib/engine/fixtures/beginner-reference.ts` (new); `src/lib/engine/fixtures/README.md`

**Intent**: Store the independent judgment of a good top 5 with its provenance, so a retune is measured against published picks rather than against its own output.

**Contract**:
- `BEGINNER_SOURCES`: a record of source key → `{ title, publisher, url, accessed: "2026-10-08" }` for AW, AS, ASU, AF, TS, LNS, TA, SZ and TW (the URLs in Key Discoveries).
- `BEGINNER_REFERENCE`: a record of night (`"2026-01-15"` | `"2026-04-15"` | `"2026-07-15"` | `"2026-10-15"`) → entries `{ id, sources: SourceKey[] }`.
  - Include exactly the objects in the at-least-2-sources sets from Key Discoveries, with the source keys from the worker report (References).
  - Ids use catalogue form (`M31`, `NGC869`, `NGC7000`).
- `AF_FALL_LIST`: the 20 Messier ids from source AF.
- The README gets a "Beginner reference" section covering:
  - the counting rule (≥2 sources, fixed before comparison);
  - that the lists came from WebFetch summaries;
  - the accessed date;
  - that the list is never edited to make a ranking pass. Changing it needs a dated note with new sources.

#### 2. Calibration oracle

**File**: `src/lib/engine/calibration.test.ts`

**Intent**: Fail a retune that pushes published beginner showpieces out of the top 5 on any calibration night.

**Contract**:
- New `it.each(NIGHTS)` block: the night's top 5 ids intersect `BEGINNER_REFERENCE[night]` in **at least 3** objects. The failure message lists the top 5 and the intersection.
- A unit check that every reference id exists in `DEEP_SKY` (`findDeepSky`).
- The header comment is updated:
  - the expectations come from the committed reference;
  - the opt-in snapshot is a recording aid, not an oracle, and regenerating it changes no assertion.
- The four existing rules stay unchanged.

#### 3. Replace the engine-copied order literal

**File**: `src/lib/engine/ranking.test.ts`

**Intent**: Stop pinning an order copied from engine output (`:195`) while keeping the moonlight case's purpose (nothing changes on a new-Moon night).

**Contract**:
- The 2026-10-10 Messier-only case asserts:
  - `washedOutCount === 0` (kept);
  - exactly 5 entries;
  - every top-5 id in `AF_FALL_LIST`;
  - M31 present (named by every fall source).
- The exact array is removed. The test title and comment cite AF.

### Success Criteria:

#### Automated Verification:

- The changed suites pass: `npx vitest run src/lib/engine/calibration.test.ts src/lib/engine/ranking.test.ts`
- Break checks, then reverted and logged below:
  - a weight retune `SCORE_WEIGHTS` = duration 0.10, moon 0.30, brightness 0.10, sky 0.50 in `parameters.ts` turns the overlap red on at least one night. If it doesn't, try duration 0.6 / brightness 0.05 and log both;
  - `MESSIER_RANK_BONUS` = −0.2 turns the overlap or the existing "≥3 Messier" rule red.
- Full unit suite, lint and type check pass: `npm test`, `npx eslint . --ignore-pattern '.claude/**'`, `npx astro check`

#### Manual Verification:

- Spot-check 3 reference entries per night against their source pages (the URLs in `BEGINNER_SOURCES`). Record any mismatch; fix the fixture only toward what the source says, never toward the ranking.

**Break-check log**: (filled in by `/10x-implement`.)

**Implementation Note**: Commit and push. The manual spot-check may be done by the implementer through WebFetch and logged with evidence. Your review of the reference stays optional.

---

## Phase 4: Tonight and Session plan property suite, plus docs (unit + docs)

### Overview

Extend the visibility proof to what the user sees: every Session plan row of generated Tonight builds is visible at its window start, end and best time. A night without darkness, or a no-go night, shows no ranking. Then the cookbook and phase note.

### Changes Required:

#### 1. Tonight visibility suite

**File**: `src/lib/tonight/visibility-invariants.test.ts` (new)

**Intent**: Prove the guardrail holds through `buildTonight` and `layoutSessionPlan`, and pin the no-ranking gates (`prd.md:571`, `build.ts:692`).

**Contract**:
- About 40 seeded cases from `generated.ts`. `SiteRecord`s are built with `bortle` and `minAltitudeDeg`, and the record `timeZone` comes from the site list.
- Each case calls `buildTonight({…, forecast: null, now: <case evening 18:00 local>}, "en", { withSessionPlan: true, limit: Infinity })`.
- For every `sessionPlan.rows` row (object, planet, Moon), check the row's `window.start`, `window.end` and `bestAt` with the Phase 1 independent helpers (shared through a small test-only export in `fixtures/generated.ts`, or duplicated minimally):
  - altitude ≥ the site minimum − 0.05;
  - sun ≤ the row kind's threshold + 0.05.
- **Gates:**
  - (i) For generated cases whose deep-sky `darkWindow` is `none`, the view has no ranking.
  - (ii) A cloudy forecast (`hourlyForecast` at 100% cloud over the night, built with the existing fixtures) on a Warsaw October night gives a no-go verdict and no ranking.
- **Non-vacuity:** at least 30 plans with rows, and at least 3 no-darkness cases.
- **Behaviour asserted:** what the Session plan shows is visible; no target list appears on a night that cannot be observed.
- **Regression caught:**
  - a row built from a stale or clamped window;
  - `cardPasses` loosened;
  - ranking built in polar summer.
- **Anti-pattern avoided:** checking only the layout fractions; expected rows copied from build output.

#### 2. Docs and the issue #21 note

**File**: `context/foundation/test-plan.md`; `CLAUDE.md`; this plan's PR body

**Intent**: Record how to add these tests, and correct the docs that call the print-only output a snapshot oracle.

**Contract**:
- §6.3 "Adding a ranking invariant or reference cross-check" replaces its TBD with:
  - which file per layer (`visibility-invariants.test.ts` engine and Tonight, `ranking-invariants.test.ts`, `calibration.test.ts`);
  - the generator and the independent-altitude helpers;
  - the relation-not-value rule;
  - the beginner-reference rule (≥2 sources, k = 3, never edit the list to fit, how to add a dated source);
  - tolerances and non-vacuity counts.
- §6.6 gains a note starting `- **Phase 3 —`.
- The CLAUDE.md engine paragraph's calibration sentence gains a clause: the top 5 is checked against the committed beginner reference (overlap ≥ 3), and the opt-in snapshot is a recording aid. Keep it to one sentence.
- The PR body carries a drafted comment for GitHub #21 on short windows (about 0.7% of entries up for a single 10-min sample; current rule pinned by `visibility-invariants.test.ts`). It is posted only after you OK it.

### Success Criteria:

#### Automated Verification:

- The suite passes: `npx vitest run src/lib/tonight/visibility-invariants.test.ts`
- Break checks, then reverted and logged below:
  - in `build.ts`, `cardPasses` without the `window.kind === "window"` condition turns gate (i) red;
  - Session plan rows built with the peak shifted one hour later turn the row checks red.
- Full unit suite, lint and type check pass: `npm test`, `npx eslint . --ignore-pattern '.claude/**'`, `npx astro check`
- `test-plan.md` §6.3 has no TBD and §6.6 has the Phase 3 entry: `! sed -n '/^### 6.3/,/^### 6.4/p' context/foundation/test-plan.md | grep -q TBD && grep -q '\*\*Phase 3 —' context/foundation/test-plan.md`

#### Manual Verification:

- You approve or post the drafted GitHub #21 comment on short windows.

**Break-check log**: (filled in by `/10x-implement`.)

**Implementation Note**: Commit and push. Then run `/10x-impl-review testing-ranking-invariants-and-calibration-oracle` and open the PR.

---

## Testing Strategy

### Unit Tests:

- Engine: about 200 seeded cases × every listed object, planet and Moon entry, checked at window start, end and peak against astronomy-engine.
- Relations: 1–2 ratings inert; seen and the Messier bonus never decide the bar; the bar is the PRD bar; washed out never listed; permutation invariance; aperture never shrinks the cleared set.
- Oracle: the top 5 overlaps the beginner reference by at least 3 on 4 nights; the 2026-10-10 top 5 is a subset of AF.
- Tonight: about 40 seeded builds × every Session plan row; the no-darkness and no-go gates.

### Integration Tests:

- None new.

### Manual Testing Steps:

1. Spot-check the reference fixture against its source pages (Phase 3).
2. Approve or post the #21 comment (Phase 4).

## Performance Considerations

- Phase 1: about 200 cases × about 9 ms ≈ 1.8 s.
- Phase 2: about 30 rankings × several variants ≈ 0.5 s.
- Phase 4: about 40 builds × about 13 ms ≈ 0.5 s.
- No wall-clock assertions (CI runners vary).

## Migration Notes

- None. Tests and test-only fixtures only, plus one test literal replaced.

## References

- Research: `context/changes/testing-ranking-invariants-and-calibration-oracle/research.md` (decisions dated 2026-10-08).
- Test plan: `context/foundation/test-plan.md` §2 (Risks #3 and #4 with the 2026-10-08 backport), §3 Phase 3, §6.
- Beginner reference worker report (2026-10-08, this planning session). Per-object source keys:
  - **Jan:** M42 TA/TS/LNS/SZ/TW/AS; M45 TA/TS/LNS/SZ/TW; M35 TA/TS/SZ/AS; NGC869 TS/TW/LNS/SZ; M31 TA/TW; M36 SZ/AS; M37 SZ/AS; M41 SZ/AS.
  - **Apr:** M44 TA/TW/TS/SZ/AS; M51 TA/TS/LNS/AS; M81 TW/TS/AS; M82 TW/TS/AS; M3 SZ/TW/AS; M65 TS/LNS/AW; M66 TS/LNS/AW; M13 TS/AS; M104 TS/AS; M97 TS/AS; M67 TS/AS; M96 LNS/AW; M105 LNS/AW; M87 TS/AW; M84 TS/AW; M86 TS/AW; M49 TS/AW; M35 TA/AS; M42 TA/TW/AS; M45 TA/TW.
  - **Jul:** M8 TA/TW/SZ/TS/ASU/LNS; M27 TA/TW/TS/ASU/LNS; M57 TA/TW/SZ/ASU/LNS; M13 TA/TW/SZ/ASU; M11 SZ/TW/ASU; M17 SZ/ASU/TW/LNS; M20 LNS/ASU/TW; M16 TS/ASU; M7 SZ/ASU; M6 SZ/ASU; M22 ASU/TW; M4 LNS/TW; NGC7000 TS/LNS; M2 SZ/ASU; M15 SZ/ASU; M21 LNS/AF; M24 ASU/AF; M29 ASU/AF; M39 ASU/AF; M73 ASU/AF.
  - **Oct:** M31 TA/TW/TS/LNS/SZ/AF; NGC869 TS/TW/SZ/LNS; M45 TA/TW/AF; M32 TS/AF; M13 TA/TW/TS; M57 TA/TW; M27 TA/TW; M15 SZ/ASU; M2 SZ/ASU; M29 AF/ASU; M39 AF/ASU; M73 AF/ASU; M72 AF/ASU; M24 AF/ASU; M18 AF/ASU; M28 AF/ASU; M69 AF/ASU; M14 AF/ASU; M21 AF/LNS.
- Code: `src/lib/engine/objects.ts:76-105`, `ranking.ts:181-236`, `score.ts:131-138`, `planet-ranking.ts:102-140`, `moon-target.ts:86-126`, `sun.ts:19-23`, `:52-105`, `parameters.ts:49`, `:57-65`, `:181-191`, `:221`; `src/lib/tonight/build.ts:692`, `:1019-1054`; `src/lib/engine/calibration.test.ts`; `ranking.test.ts:186-210`; `src/lib/forecast/degraded-forecast.test.ts:143-157`.
- Archive: `context/archive/2026-10-06-deep-sky-beyond-messier/evidence/calibration.md` (archived top-10s), `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md` (AF list, the 2026-10-10 check), `context/archive/2026-10-02-moonlight-and-the-verdict/reviews/plan-review-rev1.md` (an engine-copied order would have encoded a bad retune).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Engine visibility property suite (unit, Risk #3)

#### Automated

- [ ] 1.1 The suite passes: `npx vitest run src/lib/engine/visibility-invariants.test.ts`
- [ ] 1.2 Break checks (window widened in `bestWindow`; deep sky over the −6° window), reverted and logged
- [ ] 1.3 Full unit suite, lint and type check pass

### Phase 2: Ranking invariants as relations (unit, Risk #4)

#### Automated

- [ ] 2.1 The suite passes: `npx vitest run src/lib/engine/ranking-invariants.test.ts`
- [ ] 2.2 Break checks (`LOG_PENALTY_MIN_RATING` = 2; bar on `rankScore`; washed-out exclusion removed), reverted and logged
- [ ] 2.3 Full unit suite, lint and type check pass

### Phase 3: Independent top-5 oracle and calibration cleanup (unit, Risk #4)

#### Automated

- [ ] 3.1 The changed suites pass: `npx vitest run src/lib/engine/calibration.test.ts src/lib/engine/ranking.test.ts`
- [ ] 3.2 Break checks (weight retune; `MESSIER_RANK_BONUS` = −0.2), reverted and logged
- [ ] 3.3 Full unit suite, lint and type check pass

#### Manual

- [ ] 3.4 Reference fixture spot-checked against its source pages (3 entries per night), mismatches logged

### Phase 4: Tonight and Session plan property suite, plus docs (unit + docs)

#### Automated

- [ ] 4.1 The suite passes: `npx vitest run src/lib/tonight/visibility-invariants.test.ts`
- [ ] 4.2 Break checks (`cardPasses` without the window condition; peak shifted one hour), reverted and logged
- [ ] 4.3 Full unit suite, lint and type check pass
- [ ] 4.4 `test-plan.md` §6.3 has no TBD and §6.6 has the Phase 3 entry (`sed`/`grep` check)

#### Manual

- [ ] 4.5 You approve or post the drafted GitHub #21 comment on short windows
