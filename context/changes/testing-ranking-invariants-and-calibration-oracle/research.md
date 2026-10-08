---
date: 2026-10-08T16:38:49+02:00
researcher: Claude (Opus 5.5) with three read-only Sonnet workers
git_commit: fd2617e
branch: feat/testing-ranking-invariants-and-calibration-oracle
repository: Sidereus
topic: "Ground rollout Phase 3 of context/foundation/test-plan.md: ranking invariants and calibration oracle (Risks #3, #4)"
tags: [research, testing, engine, ranking, calibration, property-tests, session-plan]
status: complete
last_updated: 2026-10-08
last_updated_by: Claude (Opus 5.5)
---

# Research: ranking invariants and calibration oracle (test rollout Phase 3, Risks #3 and #4)

**Date**: 2026-10-08T16:38:49+02:00
**Researcher**: Claude (Opus 5.5) with three read-only Sonnet workers: visibility rules, calibration oracle, property-test feasibility
**Git Commit**: fd2617e (product code identical to `main` ce2e7d3; the commit only adds this change's `change.md` and the §3 status)
**Branch**: feat/testing-ranking-invariants-and-calibration-oracle
**Repository**: Sidereus

## Research Question

Ground Risks #3 and #4 of `context/foundation/test-plan.md` §2.

- **#3:** a target that cannot be seen is recommended on Tonight or in the Session plan: below the site's minimum altitude, outside its window (the dark window for deep sky; the sun below −6° for the Moon and planets) or below the horizon. The guidance is to prove the rule over many generated sites, nights, latitudes and telescopes. It asks to challenge "the fixture nights are representative" and to avoid both top-5-of-a-few-nights tests and generators that reuse engine output.
- **#4:** a calibration retune degrades the ranking or breaks a PRD invariant, and passes because the snapshot was regenerated. The guidance is to prove that such a retune fails and that regeneration cannot turn it green. It asks to challenge "the calibration snapshot is an oracle" and to avoid self-regenerated snapshots and brittle exact order.

## Summary

1. **Risk #3: no violation found, so this is a regression guard.**
   - The engine's predicate is sound by construction. `bestWindow` (`src/lib/engine/objects.ts:76-105`) takes the longest run of samples with refracted altitude `>= minAltitudeDeg`, and those samples cover only the window. The peak is a sample of that run, so `bestAt` can't fall outside the window or below the minimum.
   - The same predicate serves planets and the Moon over the −6° window (`planet-ranking.ts:102-140`, `moon-target.ts:86-126`).
   - The Session plan uses the raw engine `bestAt` and window, and only clamps display fractions (`src/lib/tonight/session-plan.ts:62-106`).
   - A worker probe found **0 violations** in 9,366 object entries, 398 planet entries, 71 Moon targets and 9,532 plan rows. It checked with altitude computed **directly from astronomy-engine**, not the engine helpers, over 7 sites (equator, 35° N, 52° N, 64.8° N, 69.65° N, 33.9° S, 64.8° S) × 6 dates across 2026 × 3 configurations (min altitude 0/15/30, Bortle 2/6/8, apertures 60/150/300 mm).
   - "The fixture nights are representative" is still false as coverage. Every existing invariant test is fixed-case, almost all Warsaw at 52° N with a 150 mm scope. No test loops over generated inputs.
2. **Risk #3: one soft spot is about marginal targets, not unseeable ones.**
   - A target up for a single 10-min sample is listed with a zero-length window (`start == end`), because duration is only 0.35 of the weight (`parameters.ts:57-62`).
   - The probe found 66 zero-length windows and 171 more of at most 20 min, out of 9,366 entries. Examples on the equator: 2026-05-15 M42 (total 0.643) and 2026-06-21 M45 (0.650).
   - These objects are above the minimum at that instant, so the rule holds. Whether that is acceptable is a product question, not a test.
3. **Risk #4: the premise "a regenerated snapshot launders a retune" is wrong as written.**
   - `calibration.test.ts` stores no snapshot. The "snapshot" is an opt-in `console.log` with no `expect` (`calibration.test.ts:44-61`), so regeneration can't change a test result.
   - The real exposure is the opposite: the guard is too weak. It is four rules on four new-Moon Warsaw nights, Bortle 5, 150 mm and an empty log (`calibration.test.ts:19-20`, `:71-94`):
     - at least 1 Caldwell clears;
     - at least 3 Messier in the top 5;
     - the Double Cluster is in the October top 10;
     - no Caldwell galaxy fainter than magnitude 10 is in the top 5.
   - Nothing guards the weights, the moon or sky components, `LOW_INTEREST_*` or `MIN_OBJECT_SCORE`. A retune that swaps M31 for M101 in the top 5 passes.
   - The one place regeneration could launder a change is the exact-order literal `["M31","M34","M39","M45","M52"]` (`src/lib/engine/ranking.test.ts:195`). It was copied from engine output and checked by eye against published lists in the 2026-09-25 checkpoint, so editing it after a retune turns it green.
4. **Independent oracles in the repo constrain positions and times, not ranking order.**
   - These cover positions and times only: the Stellarium sun sections, the Skyfield planets and Moon, and USNO civil dawn.
   - The PRD success criterion "top 5 cross-checked against an independent reference on 2–3 nights" (`context/foundation/prd.md:66-68`) was met once, manually, in `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md`. That check used published beginner lists (Astronomy.com "Big 5": M42, M31, M45, M13, M57; seasonal lists) and a Skyfield recompute that was never committed.
   - No machine-readable reference list exists.
5. **The cheapest useful layer is pure-engine unit tests. No new library is needed.**
   - Engine entry points are pure and need no forecast: `rankObjects`, `rankPlanets`, `moonTarget`, `darkWindow`.
   - Measured cost: about 3–4 ms warm per `rankObjects` over 171 objects, about 9 ms with planets and the Moon, and about 13 ms per `buildTonight` with the Session plan.
   - So 200–300 generated engine cases cost about 1–2 s, plus about 50 `buildTonight` cases for about 0.7 s.
   - A seeded mulberry32 generator with a non-vacuity count already exists in `src/lib/forecast/degraded-forecast.test.ts:143-157`. fast-check is not installed.

## Detailed Findings

### Risk #3: the visibility predicate per target kind

| Target | Window | Altitude rule | Best time | Anchors |
| --- | --- | --- | --- | --- |
| Deep sky | `darkWindow(site, night, darknessThresholdDegForBortle(bortle))`, at −18/−15/−12° for Bortle 1–4/5–6/7–9; geometric sun | `bestWindow(track, site.minAltitudeDeg)`: longest run of 10-min samples (`DEFAULT_TRACK_STEP_MINUTES`, `parameters.ts:41`; start, every step, exact end, `sampling.ts:12-27`) with refracted altitude `>=` min (`objects.ts:26-30`, J2000 via `Rotation_EQJ_HOR`) | highest sample of the run | `ranking.ts:199-200`, `score.ts:131-138`, `objects.ts:76-105` |
| Deep sky (bar) | same | listed only if `vMag <= telescopeLimitingMag(bortle, aperture)` (`score.ts:92-94`, `:131-134`) and `score.total >= MIN_OBJECT_SCORE` 0.45 (`ranking.ts:236`, `parameters.ts:65`); log penalty and Messier bonus affect order only (`ranking.ts:229-233`) | — | — |
| Planets | `darkWindow(..., PLANET_WINDOW_SUN_ALTITUDE_DEG = -6)` (`parameters.ts:221`, `build.ts:767`); optional clear-hour mask (`solar-system-window.ts:28-37`, `-Infinity` outside) | `bestWindow`, the same predicate; Uranus and Neptune only at aperture ≥ 130 mm (`planet-ranking.ts:104`); no magnitude or twilight check | peak | `planet-ranking.ts:102-140`, `planets.ts` |
| Moon | the −6° window, masked | `bestWindow`; `null` if illumination < 0.03 at the peak (`moon-target.ts:101-104`) | peak | `moon-target.ts:86-126` |
| Session plan rows | rows use the raw engine window and `bestAt` (`build.ts:1019-1054`) | none added; `layoutSessionPlan` clamps only display fractions and drops rows outside the axis (`session-plan.ts:62-106`) | raw `peak.time` | axis = sunset→sunrise, or the whole observing night when either is missing (`build.ts:559-566`) |

- **Tonight gate.** Deep sky is ranked only when the verdict is go or marginal and a dark window exists (`cardPasses`, `src/lib/tonight/build.ts:692`, `:702`). With no dark window nothing is ranked. Planets and the Moon use the −6° window or show `noWindow` (`build.ts:834-836`).
- **Minimum altitude source.** It is per site: `site.minAltitudeDeg`, form range 0–60 (`src/lib/gear/schemas.ts:50`), default 15 (`DEFAULT_MIN_ALTITUDE_DEG`, `parameters.ts:49`).
- **Edge cases (worker review plus probe):**
  - circumpolar objects: fine;
  - polar summer: nothing ranked;
  - polar night and clamped windows: samples still inside the window;
  - a span shorter than one step: missed, which errs on the safe side;
  - windows shrink inward by up to 10 min per side, never overstated;
  - `minAltitudeDeg = 0` compares refracted altitude, so a geometric −0.57° can pass (cosmetic);
  - Jupiter and Mars `bestAt` equals civil dawn (a rising planet whose last sample is highest): inside the window, not a defect.
- **Existing invariant tests (fixed-case only):**
  - `ranking.test.ts:59` synthetic below-min objects;
  - `:149-161` peak ≥ 15° on Warsaw 2026-10-10;
  - `:163-166` a declination bound derived from geometry;
  - `:209` full-Moon peaks;
  - `planet-ranking.test.ts:102-107`, `:227`;
  - `moon-target.test.ts:63-67`, `:95-99`;
  - `build.test.ts:759-761` (min 70 leaves no planets).
  
  No test asserts that window start and end meet the minimum, that the sun is below the threshold at every row's best time, or anything at high or southern latitudes across seasons.

### Risk #4: what guards a retune today

- **Tunables.** Every value in `parameters.ts` is labelled "Candidate" (`:4-8`), including:
  - `SCORE_WEIGHTS` (`:57-62`), `MIN_OBJECT_SCORE` (`:65`), `LOW_INTEREST_PENALTY` (`:118`);
  - `bortlePenaltyForBortle` (`:130-139`);
  - `LOG_PENALTY` 0.15 (`:181`), `MESSIER_RANK_BONUS` 0.03 (`:191`);
  - `MOONLIGHT_SENSITIVITY` (`:347-360`);
  - `WASHED_OUT_CONTRAST_MAG` (`:370`).
  
  The PRD fixes some values instead (`prd.md:565` "Decided now … not tuned"): `LOG_PENALTY_MIN_RATING = 3` (`parameters.ts:184`, "PRD invariant 4"), the never-impossible rule, the FOV fit, and the order-only role of the Messier bonus.

**PRD requirement → pinned by → independent?**

| Requirement (prd.md) | Pinned by | Independent of the engine? |
| --- | --- | --- |
| SC: top 5 cross-checked against an independent reference on 2–3 nights (:66-68) | manual archive checkpoint only | yes, but not in the suite |
| Guardrail: never physically impossible (:88-94); invariant: below-min never ranks (:568-570) | `ranking.test.ts:59`, `:149`, `:163`; planet and Moon tests | partly; a single site and night (Risk #3) |
| Invariant: a no-go night shows no ranking (:571) | the Tonight gate `build.ts:692` (tests not traced by this research) | not established |
| Invariant: an object that doesn't fit the eyepiece field is not recommended (:572) | `eyepieces.test.ts:80`, `:93`, `:100` | yes (hand arithmetic) |
| Invariant: a log rating of 1–2 never deprioritises (:574, FR-018 :391) | `ranking.test.ts:312` (1–2 log ranks like an empty log); `log.test.ts:9` | yes (metamorphic), but on a 3-object synthetic catalogue |
| FR-018: logged objects mildly deprioritised and still rank | `ranking.test.ts:272-294` | mostly; `:281` restates the formula |
| Messier bonus order-only (`parameters.ts:187-189`) | `ranking.test.ts:74-109` | rule-based; `:109` is coupled to the weights |
| Moon effects | `score.test.ts:121-231`, `moonlight.test.ts:48-62`, `ranking.test.ts:197-210` (full Moon: clusters only, galaxies washed out) | mostly monotone and ordinal relations |
| Determinism NFR (:486) | `determinism.test.ts` (deep-equal reruns) | yes |
| Position NFR within 1° and 5 min (:488) | Stellarium, Skyfield and USNO fixtures | yes; positions only |

**Not pinned anywhere found:**

- any rule that a top 5 contains nothing a beginner can't enjoy;
- a telescope-size effect on the top 5 (GitHub #21 item 3: M101 at #5 for an 80 mm);
- a Bortle effect on the top 5;
- moonlit nights in the calibration set (all four are new-Moon).

### Candidate relations that need no engine-derived expected values

These come from the workers' reading of `ranking.ts`, `score.ts` and `log.ts`; this is not a design.

- **Rating 1–2 inert at catalogue scale.** Adding any number of 1–2 ratings for any objects leaves the `Ranking` deep-equal. This generalises `ranking.test.ts:312` to `DEEP_SKY` and generated nights.
- **Seen never removes.** For any `seen`, `clearedCount` and the cleared set are unchanged, because the bar reads `score.total` (`ranking.ts:233-236`).
- **Messier bonus never decides the bar.** Every entry has `score.total >= MIN_OBJECT_SCORE`, and `rankScore − total ∈ {0, +bonus, −penalty, bonus−penalty}`.
- **Washed out is never listed.** No `washedOut` id appears in `entries` or counts toward `clearedCount`, on several full-Moon nights.
- **Monotone in sky conditions.** A dimmer Moon on the same night never lowers a galaxy's moon component and never raises `washedOutCount`. A larger aperture never lowers `clearedCount`. A higher Bortle never raises the sky component.
- **Permutation invariance.** Shuffling catalogue order leaves the entry order unchanged, because the tie-break is total (`ranking.ts:181-192`).
- **External opinion as oracle.** On each calibration night the top 5 intersects a source-cited, hand-curated beginner list by at least k. The list, k and the curation are owner decisions; the published lists are Messier-centred.
- **Beginner floor (rule, not order).** No top-5 object fainter than an agreed magnitude, or of `LOW_INTEREST_TYPES`. NGC188 (V 8.1) at #10 in January and April is the known borderline case (`archive/2026-10-06-deep-sky-beyond-messier/evidence/calibration.md:118`). The limit is an owner decision.

### Property-test mechanics

- **Inputs.**
  - `rankObjects(RankInput)` takes `site`, `bortle`, `minAltitudeDeg`, `darkWindow` (kind `window`), `telescope {id, apertureMm, focalLengthMm}`, `eyepieces`, `catalogue`, plus optional `seen` and `limit`. The workers read this from `ranking.ts`.
  - `rankPlanets` and `moonTarget` take the −6° window.
  - `buildTonight(input, "en", {withSessionPlan: true, limit: Infinity})` works with `forecast: null`; the verdict is then marginal, so the ranking is still built.
- **Realistic ranges:**
  - aperture 20–1000 mm and focal length 100–5000 mm (`gear/schemas.ts`); the catalogue keeps f/3–f/16 (`gear/catalogue/README.md:29`);
  - eyepiece 2–60 mm and AFOV 30–120°;
  - Bortle 1–9, min altitude 0–60;
  - time zone from `resolveTimeZone({mode: "auto", …})` (`src/lib/gear/timezone.ts`, usable in Node tests via `@photostructure/tz-lookup`), or a fixed list of zones.
- **Determinism.** The engine is clock-free (`purity.test.ts`), and `buildTonight` takes `now`. Generated cases must skip or branch on `darkWindow` `kind: "none"`.
- **CI timing.** The local timing budgets in `determinism.test.ts` aren't asserted on CI; a property suite should assert no wall-clock bounds.
- **Oracle for Risk #3.** Recompute altitude with astronomy-engine directly in the test:
  - deep sky: `Rotation_EQJ_EQD` → `Horizon`, or `Rotation_EQJ_HOR`;
  - planets and Moon: `Equator` → `Horizon`;
  - sun altitude for the window check.
  
  Purity rules apply to engine source only, not to tests.

## Code References

- `src/lib/engine/objects.ts:26-30`, `:76-105`: refracted altitude; `bestWindow` (run of samples ≥ min, peak in the run).
- `src/lib/engine/sampling.ts:12-27`, `parameters.ts:41`: 10-min samples including the exact end.
- `src/lib/engine/score.ts:92-94`, `:131-138`: limiting magnitude and window gates.
- `src/lib/engine/ranking.ts:181-192`, `:199-200`, `:229-236`: tie-break, tracks over the dark window, `rankScore` and the bar.
- `src/lib/engine/planet-ranking.ts:102-140`, `moon-target.ts:86-126`, `solar-system-window.ts:28-37`.
- `src/lib/tonight/build.ts:559-566` (axis), `:692` (`cardPasses`), `:767`, `:834-836`, `:1019-1054` (plan rows); `session-plan.ts:62-106`.
- `src/lib/engine/parameters.ts:4-8`, `:49`, `:57-65`, `:181-191`, `:221`, `:347-360`.
- `src/lib/engine/calibration.test.ts:19-20`, `:44-61` (print-only "snapshot"), `:71-94` (the four rules).
- `src/lib/engine/ranking.test.ts:59`, `:149-166`, `:186-210` (exact-order literal at `:195`), `:272-312`.
- `src/lib/forecast/degraded-forecast.test.ts:143-157`: seeded mulberry32 property pattern.
- `src/lib/gear/schemas.ts:50`, `src/lib/gear/timezone.ts`.
- `context/foundation/prd.md:66-68`, `:88-94`, `:565-575`.

## Architecture Insights

- One predicate (`bestWindow`) and one sampling grid serve deep sky, planets and the Moon. A property test of "every listed target is up inside its window at its start, end and best time, by an independent altitude" covers every target kind and the Session plan at once.
- The ranking separates **clearing** (`score.total >= MIN_OBJECT_SCORE`) from **ordering** (`rankScore` with the log penalty and Messier bonus). Most PRD invariants are statements about one side only. That makes them testable as relations, such as an unchanged cleared set or entries unchanged by a 1–2 rating, with no engine-derived values.
- Calibration quality has no automated independent oracle. The PRD success criterion relies on a manual cross-check. Turning it into a test needs a committed, source-cited reference. That is a decision about the reference, not about code.

## Historical Context (from prior changes)

- `context/archive/2026-10-02-moonlight-and-the-verdict/reviews/plan-review-rev1.md` (F1, F2): revision 1's scoring reversed the full-Moon order. The 2026-10-24 top 5 went from M31, M34, M45, M52, M39 to M31, M81, M32, M76, M82. The planned tests pinned objects by name and would have encoded the wrong order. An independent run of the real engine caught it, not the tests. Supported; this is the concrete precedent for Risk #4.
- `context/archive/2026-10-06-deep-sky-beyond-messier/evidence/calibration.md`:
  - The top 10 per night was recorded by hand.
  - Bonus 0.03 passed on the first run; bonus 0 failed only on 15 Oct.
  - The four rules were written to the candidate values and then confirmed (`:100-105`).
  - NGC188 was left as is (`:118`).
  - `plan.md:538` row 2.5, the user's calibration sign-off, is still unchecked.
- `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md`: the one independent top-5 cross-check (published beginner lists plus a Skyfield recompute). Its oracle was web articles compared by eye on three nights; independent, but not reproducible in the suite.
- GitHub #21 (open): items 1 (evening showpieces M13/M15/M57 rank low in October), 3 (M101 #5 for 80 mm) and 4 (the 10-min grid quantises window edges) remain open.

## Related Research

- `context/archive/2026-10-08-testing-night-and-date-boundaries/research.md`: test rollout Phase 2 (fixtures, runner zones, USNO oracle).
- `context/archive/2026-10-07-testing-forecast-honesty/research.md`: Phase 1 (seeded property pattern origin).

## Corrections to the test-plan guidance (for the post-research backport check)

1. **Risk #4 premise.** No calibration snapshot is stored, so "regenerating the snapshot cannot turn it green" tests nothing. The guidance should instead prove three things:
   - a retune that breaks a PRD invariant fails;
   - a retune that degrades the top 5 against a committed, independent reference fails;
   - exact-order literals copied from engine output are replaced by rules or relations.

   Challenge "the calibration test guards the ranking" (it guards only the Messier bonus, on new-Moon nights) rather than "the calibration snapshot is an oracle".
2. **Risk #3 likelihood.** No violation exists today (0 in about 19,000 probed rows), so the property suite is a regression guard. The "fixture nights are representative" challenge stands as a coverage claim. The anti-pattern note should add that the oracle is altitude recomputed from astronomy-engine in the test, never `bestWindow` or `objectTracks` output.

## Decisions (user, 2026-10-08)

- **Backport:** the corrections above go into `test-plan.md` §2 (risks #3 and #4, dated research backport).
- **Risk #4 oracle:** PRD invariants as relations **plus** a committed, source-cited beginner reference list; each calibration night's top 5 must overlap it by at least k (the list and k are proposed in the plan for the user to confirm).
- **Short windows:** document and pin the current rule (the target is up at or above the minimum at the shown time); no product change in this phase; the soft spot goes to GitHub #21 as a ranking follow-up.

## Open Questions

- ~~Owner decision: reference list as the Risk #4 oracle~~ — decided: yes (see Decisions).
- ~~Owner decision: short windows~~ — decided: document, no change (see Decisions).
- **Plan decision:** keep the exact-order literal at `ranking.test.ts:195` as a dated reference fixture with a citation, or replace it with rule-based assertions.
- The weather-mask path (`clearIntervals`) was reviewed in code but not fuzzed. The probe used `forecast: null`.
