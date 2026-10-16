# Evening Showpieces, Window Edges and the PRD Re-check (M-4 S-05) Implementation Plan

## Overview

M-4 S-05 (roadmap, GitHub #173; #21 items 1, 4 and 5; PRD Primary criterion 2). Four things, in this order:

- **Item 4, window edges on time.** A deep-sky object's window opens and closes at the true crossing of the site's minimum altitude, not at the 10-minute sample inside it. Independent Skyfield reference first.
- **Item 1, evening showpieces.** The `duration` score stops punishing an object whose pass is shorter than the night but long enough to be useful: it saturates at a fixed useful span.
- **Item 5, a reason that distinguishes nothing.** A moon or sky reason appears only when the listed entries actually differ on it.
- **PRD criterion 2 re-run.** Tonight's top 5 on three fixed nights against an independent planetarium (Skyfield + DE421) and an independent planner (in-the-sky.org, captured in research), which also gives S-03's calibration sign-off its fresh top-10 snapshot.

Every cause and number below is in `context/changes/evening-showpieces/research.md`. Implementation fetches nothing from the web. The planner cross-check is a manual comparison the lead agent makes from a capture kept outside the repository (Phase 4); no in-the-sky.org text or number is committed.

## Current State Analysis

- **Duration.** `duration = placed / track.length` (`score.ts:175`): the best window's altitude-weighted samples over every sample of the dark window. Measured on Warsaw 2026-10-15 (Bortle 5, 150/750): M13 #53 (duration 0.249, window 240 min of 614), M15 #32, M57 #60. In April and July, with short dark windows, M13 is #2 and M3 #1.
- **The ceiling is brightness, not only duration.** With duration set to 1 for every object, M13's best rank on the calibration nights is #10 and M57's #42 (open clusters of V < 4 and the Moon-proof components dominate). The fix removes a structural penalty; it cannot put M57 in the October top 5, and this plan does not pretend it can.
- **Window edges.** `bestWindow` (`objects.ts:76-105`) returns the first and last sample at or above the minimum, so the edge is up to one 10-minute step inside the truth. Across the 121 scored objects on 2026-10-15 the error is -9 to +9 min, 34 of 242 edges over the 5-minute tolerance, always inward. No test compares an object window's edges with an independent reference.
- **Reasons.** `reasonComponents` (`ranking.ts:172-197`) can pick the moon component, "Holds up better in moonlight than the rest", when every entry has moon = 1 (a moonless night), as the second reason or, through the weighted-value fallback, as the lead. The sky component ("Holds up under your Bortle N sky") behaves the same when no listed entry carries a sky penalty. The literal "100% clear of moonlight" in #21 no longer exists (a stale demo string remains in `src/pages/design.astro:856`).
- **Constraints that stay:** `calibration.test.ts` overlap is exactly 3 on every night (zero slack); `ranking.test.ts:238-252` requires the 2026-10-10 top 5 (Warsaw, Bortle 6, Messier only) to lie in `AF_FALL_LIST` and contain M31; ranking invariants (a)-(g); S-04's small-scope guard and galaxy cap; the `KNOWN_DIVERGENCES` cap (3 of 3). The M-1 cross-check never used a planner (Telescopius is JavaScript-only), and the deep-sky Stellarium fixtures are still `pending`.

## Desired End State

- Every deep-sky window edge the app shows (Targets, Session plan, plan editor, reason line "Up for X of the dark window") is within 5 minutes of the true crossing computed by Skyfield + DE421 at Warsaw on 2026-04-15, 2026-07-15 and 2026-10-15, for the showpieces and each night's top ten; the inward bias is gone (the refined edge sits within 0.05° of the minimum altitude).
- `duration = min(1, windowMinutes / DURATION_USEFUL_SPAN_MINUTES) × mean placement over the window`, with `DURATION_USEFUL_SPAN_MINUTES` = 120 (named candidate, PRD Open Question 1). On Warsaw 2026-10-15 (Bortle 5, 150/750) M13, M15 and M57 rank about #31, #19 and #46 (probe), and the top 5 gains M45 for M33; the oracle overlap is 3 to 4 on every calibration night and the 2026-10-10 AF check still passes (probe).
- A reason names the moon or the sky only when the listed entries differ on it by at least `REASON_MIN_SPREAD` (0.05). On a new-Moon night no reason line says anything about moonlight.
- Criterion 2 is re-run and recorded: ephemeris leg within the PRD tolerance (1 deg altitude, 5 min time) on the final top 5 of three nights; planner leg per the rules fixed in `evidence/prd-criterion-2.md` before the engine is compared. S-03's calibration snapshot is regenerated after S-04 and S-05 for the owner's sign-off.

### Key Discoveries:

- The score reads the window only through sample indices (`indexOfTime`, `score.ts:86-94`, throws on a non-sample instant). Refined edges must therefore be carried beside the sample indices, so scoring never moves with the edges.
- Linear interpolation between the two samples around a crossing is accurate to about 0.012° of altitude for a 10-minute step (curvature of a diurnal track), which is under the 0.05° invariant; on the rising, concave side the chord is inside the truth, so it stays conservative.
- The Moon path hand-builds its window (`moon-target.ts:117`) and `solarSystemWindow` spreads `best` (`plan-window.ts:101`, compared with `toEqual` at `plan-window.test.ts:182`), so any extra field on the unrefined `BestWindow` would break both; the indices therefore belong to a separate refined type (review F1).
- `maskedTrack` (planets and the Moon, `solar-system-window.ts:28-37`) puts `-Infinity` outside visible intervals: interpolating there is wrong. Refinement is therefore opt-in and used only for deep-sky windows.
- `WELL_PLACED_ALTITUDE_DEG` is shared with planets and the Moon, so duration saturation gets its own named parameter.
- The probe (research addendum): duration variants VB60, VB120 and VB180 keep the oracle at 3 or more on every night; the variant `placed / min(track.length, span)` fails April at spans of 120 and 180 minutes; `duration = 1` for all fails the oracle and the AF check.

## Owner Decisions

Decided here (non-UI, recorded; not asked):

- **D-1 Span.** `DURATION_USEFUL_SPAN_MINUTES` = 120. A window that fills a whole short night counts as fully useful (Warsaw's July dark window is 131 min), and 60, 120 and 180 give the same October result (every October window there is at least 240 min).
- **D-2 Which windows refine.** Deep-sky only. Planet and Moon windows keep the grid edges (their masks rely on sample-aligned intervals); not changed by this slice.
- **D-3 Scoring stays on the grid.** Duration reads the window's sample times, never the refined edges, so item 4 cannot move a rank.
- **D-4 Short windows.** Out of scope. The accepted rule (an object up for one sample still clears) stays; with refined edges its window now shows its true, short length, and duration saturation already gives it about 0. A minimum useful span is a follow-up if the owner wants it.
- **D-5 Sky reasons, and a reason only when it is true of the entry.** The same "differs across the list" rule covers the sky component as well as the moon, or removing the moon phrase would only promote the sky phrase on the same nights. A component is also named only when the entry is at least average on it (value at or above the list mean): "Bright for your N mm" or "Up for X" is a positive claim, so it never labels the entry that is the list's weakest there. An entry with fewer than two such components gets a one-phrase reason line (no new wording); this also keeps S-04's reason/line guard (G5) safe, because a faint galaxy whose brightness is capped below the mean is never given the brightness phrase (plan review F5).
- **D-6 Nights for criterion 2.** Warsaw 2026-04-15, 2026-07-15, 2026-10-15 (three of the calibration nights; April is the counter-case, July and October are the evening nights), Bortle 5, 150/750, minimum altitude 15.

Decided by the owner on 2026-10-16, after plan review:

- **OD-1 (A) Duration saturation only.** The October evening showpieces rise by the removal of the structural penalty and no more (M13 about #31, M15 #19, M57 #46 in October; M13 #2 in April and July). The gap to the top 5 is recorded as a known divergence in `evidence/calibration-after-s05.md` (Phase 2) and in the criterion-2 record. A rank-only bonus for globular clusters and planetary nebulae is not part of this change.
- **OD-2 (A) in-the-sky.org is the independent planner.** It gives per-object altitude, times and visibility, and no ranking, so the ranking is checked against the published beginner list; this is not a deviation from the PRD, which names no tool, and the record only notes that the planner gives no ranking. The legal route is F6.
- **F6 Nothing from in-the-sky.org enters the repository.** No verbatim text and no copied number (the repo is public and the product is paid; the site's terms forbid profit from reproduction without written permission). The committed oracle for deep-sky window edges is our own Skyfield fixture (Phase 1). in-the-sky.org stays a manual cross-check: the evidence records only the URL pattern, the date checked, the method, the rules and an agreement summary (for example "agreed within N min for objects X, Y"), with credit to Dominic Ford. The raw values live only outside the repo, in the lead agent's scratchpad capture. The earlier local commits that held the capture were rewritten before the first push.

## What We're NOT Doing

- No change to `SCORE_WEIGHTS`, `MIN_OBJECT_SCORE`, `WELL_PLACED_ALTITUDE_DEG`, `MESSIER_RANK_BONUS`, the Moon term, the sky penalty or the brightness ramp. `LOW_INTEREST_PENALTY` and S-04's galaxy cap stay.
- No change to the grid step (`DEFAULT_TRACK_STEP_MINUTES` stays 10), to planet or Moon windows, to `events.ts` or the finder.
- No regeneration of `calibration.test.ts` expectations or edit of `beginner-reference.ts`; no edit of `AF_FALL_LIST` or of the AF check. A night that falls below overlap 3 stops the phase.
- No minimum-useful-span filter and no new product wording. The reason phrases and the 22 expectation keys are unchanged; only which phrase is chosen changes.
- No Telescopius work, no web lookups during implementation, no new third-party dependency. Skyfield runs from a throwaway virtualenv, as for the existing references.
- No write to `context/archive/`: S-03's sign-off (item 2.5 of its archived plan) is recorded in this change's evidence.

## Implementation Approach

1. Window edges first (Phase 1) because the reference test and the interpolation share one phase, and scoring is independent of them.
2. Duration saturation (Phase 2) against the oracle, the AF check and ranking invariants, none edited.
3. Reasons (Phase 3), after the order is final, so the snapshot of reasons is the final one.
4. The criterion-2 re-run and docs last (Phase 4), because the top 5 it checks only exists after Phase 2, and the Skyfield fixture is extended to those objects.

Every tuned number is a named candidate in `parameters.ts` with its calibration noted (lessons). Tests pin relations and source-cited references, never values copied from engine output.

## Critical Implementation Details

- **Never commit a red suite:** the end-of-turn hook runs the whole unit suite. In Phase 1 the failing reference test is run and logged (red) before the interpolation lands, and both land in one commit.
- **Edge refinement is opt-in, index-preserving and a separate type:** a new `refinedWindow(track, min)` in `objects.ts` returns `RefinedWindow extends BestWindow { firstIndex; lastIndex }` whose `start` and `end` are the crossing instants and whose indices are those of the unrefined sample run. A run that touches the first or last sample keeps that sample's instant on that side (the dark-window edge is already exact). `bestWindow` stays byte-identical, so planets, the Moon and `moonTarget`'s hand-built window are untouched (review F1).
- **Duration reads sample times:** the span is `track[lastIndex].time - track[firstIndex].time` in minutes, so a refined edge never changes a score and a one-sample run has span 0. The text keeps using the refined edges: a one-sample window reads "Up for 14 min" with duration about 0, which is true of the window and is noted in CLAUDE.md.
- **Reason eligibility and naming:** `duration` and `brightness` are always eligible; `moon` and `sky` only when the listed entries' values differ by at least `REASON_MIN_SPREAD`. An eligible component is *named* for an entry only when the entry's value is at least the list mean. The lead is the named component with the largest positive weighted deviation, else the largest weighted value among named ones, else (nothing named) the largest weighted value among eligible ones; the second uses the same key over the remaining named components, or is null. With one listed entry the mean equals the value, so duration and brightness are named.
- **Skyfield tooling:** pip and the `de421.bsp` download are tooling like the existing generators; the script reads the catalogue's J2000 coordinates from the repo's JSON, never typed by hand.

## Phase 1: Window edges: independent reference, then true crossings

**Subagent:** Sonnet, high effort (engine and fixtures).

### Overview

Add a deep-sky window reference computed with Skyfield for the whole catalogue, show it failing against today's grid edges, then give deep-sky windows true crossings through a new refined window function.

### Changes Required:

#### 1. Skyfield window generator

**File**: `scripts/deep-sky-reference.py`

**Intent**: Following `scripts/events-reference.py`, record, for Warsaw (52.23 N 21.01 E, 110 m) on 2026-04-15, 2026-07-15 and 2026-10-15, each night's dark window (the Sun at or below -15°, geometric, which is Bortle 5's threshold) and, for each listed object, the refracted-altitude window within it: the first and last instants at or above 15° (interpolated from a one-minute grid) and the maximum altitude with its time.

**Contract**: Reads `messier.json` and `caldwell.json` for J2000 RA and Dec (`Star`) and records every object of `DEEP_SKY` (171) on each night, so Phase 4 only adds an assertion and the fixture is generated once (review F8). The atmosphere is pinned in the provenance (10 °C, 1010 mbar, as `planet-reference.py`). Output `src/lib/engine/fixtures/skyfield/deep-sky-warsaw-2026.json` with `provenance` (Skyfield version, ephemeris, the 15° minimum, the -15° threshold, the one-minute grid), one `nights[date].dark` and `nights[date].objects[id] = { windowStart, windowEnd, maxAltitudeDeg, maxTime }`, null window when the object never reaches 15° in the dark window. Header documents the throwaway-venv recipe.

#### 2. The fixture and README row

**File**: `src/lib/engine/fixtures/skyfield/deep-sky-warsaw-2026.json`, `src/lib/engine/fixtures/README.md`

**Intent**: Commit the generated file and add its row to the Skyfield table (generator, site, nights, why) plus one sentence on the window-edge use.

#### 3. The reference test (red first)

**File**: `src/lib/engine/window-reference.test.ts`

**Intent**: For every fixture entry, compare the engine's window (through `rankObjects`' `reachable` entries and through `refinedWindow(objectTrack(...), 15)`) with the fixture: each edge within `TIME_TOLERANCE_MINUTES` of Skyfield, peak altitude within `ALTITUDE_TOLERANCE_DEG` (both imported from `@/lib/engine/parameters`: 5 min and 1°, not the 0.05° constant of `fixtures/independent-altitude.ts`), the dark window's edges within the tolerance too. Also assert the structural invariant behind "scores do not move": for every reachable object on the four calibration nights, `refinedWindow`'s `firstIndex` and `lastIndex` equal the sample indices of the unrefined `bestWindow` (review F4). Run the reference part against the unchanged engine first and record the failing objects (expected: M13, M57, M15 and M42 edges, 6 to 9 minutes) in `implementation-notes.md`.

**Contract**: Uses the same site, kit, Bortle and `warsawDarkWindow(date, 5)` as `calibration.test.ts`. Never reads the engine's own output as the expectation.

#### 4. Window refinement

**File**: `src/lib/engine/objects.ts`

**Intent**: Add the refinement beside `bestWindow`, never inside it.

**Contract**: `refinedWindow(track, minAltitudeDeg): RefinedWindow | null`, `RefinedWindow extends BestWindow { firstIndex: number; lastIndex: number }`. An edge between two samples is the linear interpolation of the minimum-altitude crossing between them; a run touching the first or last sample keeps that sample's instant on that side; a sample exactly at the threshold with neighbours below gives a zero-length window at that instant; `peak` is the unrefined run's peak. `bestWindow` and `BestWindow` are unchanged. Exported through the barrel.

#### 5. Scoring and plan windows use it

**File**: `src/lib/engine/score.ts`, `src/lib/tonight/plan-window.ts`

**Intent**: `scoreObject` calls `refinedWindow` and takes its sample range from `firstIndex` and `lastIndex` (delete `indexOfTime`), so `ObjectScore.window` carries true edges while every score stays on the grid; `deepSkyWindow` refines the same way so `plan-window.test.ts` parity holds. `solarSystemWindow` and the planet and Moon callers are untouched.

**Contract**: No component of `ObjectScore.components` changes in this phase: the sample range is the same by construction, which the index-equality test in item 3 proves without stored values.

#### 6. Tests that assumed sample-aligned deep-sky edges

**File**: `src/lib/engine/objects.test.ts`, `src/lib/engine/visibility-invariants.test.ts`, `src/lib/tonight/build.test.ts`, plus whatever else the suite reports

**Intent**: Add unit cases for `refinedWindow` (rising and setting edge, both boundaries unrefined, threshold-exact sample, a one-sample run now has positive length, refinement within 0.05° of the minimum on a real track, and one case at a 0° minimum altitude where refraction curves the track most, review F8). Rewrite the short-window pin in `visibility-invariants.test.ts` (`:259-271`), which also counts planet and Moon entries: planets and the Moon keep `start === end` for a one-sample run, while a deep-sky one-sample run (`firstIndex === lastIndex`) now has a positive-length refined window that contains its sample and still clears the bar. Re-derive from the Skyfield fixture or a one-minute brute force, never from the new output: `build.test.ts:1850` (`m13.windowText`, "19:25–23:35") and the candidate window pins `build.test.ts:1948` and `:1978` (M3, "Window 19:25–19:45" and "Okno 19:25–19:45"). Run the suite once after the change and list any other pin that moves. The requirement behind these assertions changed (edges are true crossings); every edit is listed in `implementation-notes.md` with its old and new value and its reason.

### Success Criteria:

#### Automated Verification:

- The reference test fails on the unchanged engine for the expected objects, and passes after the change: `npx vitest run src/lib/engine/window-reference.test.ts`
- Window and invariant suites pass: `npx vitest run src/lib/engine/objects.test.ts src/lib/engine/visibility-invariants.test.ts src/lib/tonight/plan-window.test.ts src/lib/tonight/visibility-invariants.test.ts`
- Scores unchanged by construction (the index-equality test in `window-reference.test.ts`) and the oracle green without regeneration: `npx vitest run src/lib/engine/window-reference.test.ts src/lib/engine/calibration.test.ts src/lib/engine/ranking-invariants.test.ts`
- Whole unit suite passes: `npm test`
- Type check and lint pass: `npx astro check && npm run lint`

#### Manual Verification:

- On `/tonight/targets` and `/tonight/plan` for a Warsaw site on a clear evening, M13's window end is later than before and matches an outside planetarium within a few minutes (deferred to the owner's first nights).

**Implementation Note**: Pause for manual confirmation before Phase 2 only if the owner has asked for it; the multi-phase run defers manual checks.

---

## Phase 2: Duration saturates at a useful span

**Subagent:** Sonnet, high effort (ranking engine).

### Overview

Replace the whole-night denominator with a useful-span saturation, check it against every oracle, and record the fresh top-10 snapshot for the owner.

### Changes Required:

#### 1. Parameter and rule

**File**: `src/lib/engine/parameters.ts`, `src/lib/engine/score.ts`

**Intent**: Add `DURATION_USEFUL_SPAN_MINUTES` = 120 (named candidate, PRD Open Question 1, with the calibration noted: oracle 3 to 4 on all four nights and the AF check green in the 2026-10-16 probe) and compute `duration` from the window's own samples: the window span in minutes over the span, capped at 1, times the mean placement over the window's samples. Update the JSDoc of `scoreObject`.

**Contract**: `duration = min(1, spanMinutes / DURATION_USEFUL_SPAN_MINUTES) × placed / windowSamples`, `spanMinutes = (track[lastIndex].time − track[firstIndex].time) / 60 000`. It does not depend on aperture, so invariant (g) holds by construction. A one-sample window has span 0, duration 0.

#### 2. Relation tests (the synthetic one first)

**File**: `src/lib/engine/score.test.ts`, `src/lib/engine/evening-showpieces.test.ts`

**Intent**: Write first, in `score.test.ts`, the synthetic relation that proves the cause: two identical objects whose windows fill 4 h of a 6 h night and of a 12 h night get the same duration. It fails on the old formula by construction (0.67 against 0.33 of the share), so the red-to-green proof needs no local revert. Then pin the rest of the rule on synthetic tracks: duration rises with window length up to the span and not beyond; a one-sample window scores 0; moving the window's start inside a sample step changes nothing. In the new `evening-showpieces.test.ts`, the guard is source-cited, not fitted to the engine (review F3): the October evening picks that `BEGINNER_REFERENCE["2026-10-15"]` names (M13, M57, M27, M15 and M2, asserted to be in that reference first, each with at least two sources) each rank in the top half of the cleared list on Warsaw 2026-10-15 (Bortle 5, 150/750, full catalogue; M57 #60 of 115 is outside it today, so the guard is red before the change), and M13, which the reference also names for April and July, ranks in the top 5 on 2026-04-15 and 2026-07-15.

**Contract**: The median is a natural cut, not an engine number; the nights and ids are named constants and the reference supplies the ids. After the change the probe puts M13, M15, M57, M27 and M2 at #31, #19, #46, #30 and #35 of 118, all inside the top half. If any of `calibration.test.ts`, the AF check (`ranking.test.ts:238-252`), `ranking-invariants.test.ts` or `small-scope.test.ts` turns red, stop and report; never edit them or the beginner reference.

#### 3. Existing pins that the new rule moves

**File**: `src/lib/engine/score.test.ts`

**Intent**: The new rule changes values pinned on short synthetic tracks of 30 to 90 minutes: `:106` ("is 1 when the object is up for the whole dark window", a default track under 120 min), `:113-119` (altitude credit over `/10` samples), `:395` (0.4 from `/track.length`) and `:228-236` (the washed-out "brief" case: one sample at 200 mm, duration 0.1 becoming 0, so `washedOut` may flip). Re-derive each expected value by hand from the new rule, because the requirement changed (review F2); for the "brief" case keep its purpose (the Moon, not the short pass, is what keeps it off the list) and re-derive the premise instead of the number. Run the suite once after the rule change to enumerate any other `score.test.ts` track under 120 minutes. Every edit goes into `implementation-notes.md` with its old and new value and its reason.

**Contract**: No assertion is edited to make a ranking pass: only pins of the duration formula itself, and only where the formula's requirement changed.

#### 4. Calibration snapshot for the owner

**File**: `context/changes/evening-showpieces/evidence/calibration-after-s05.md`

**Intent**: Record the top ten per calibration night after S-04 and S-05 (`CALIBRATION_SNAPSHOT=1 npx vitest run src/lib/engine/calibration.test.ts --reporter=verbose`), the overlap per night and the matched ids, with the note that this is a recording aid, not an oracle, and that it is the input for the owner's S-03 item 2.5 sign-off (the archived plan stays untouched).

### Success Criteria:

#### Automated Verification:

- The synthetic relation fails on the old formula by construction and passes on the new one; the new relations and the source-cited guard pass: `npx vitest run src/lib/engine/score.test.ts src/lib/engine/evening-showpieces.test.ts`
- Oracle, AF check and invariants green and unedited: `npx vitest run src/lib/engine/calibration.test.ts src/lib/engine/ranking.test.ts src/lib/engine/ranking-invariants.test.ts src/lib/engine/small-scope.test.ts`
- Determinism and purity: `npx vitest run src/lib/engine/determinism.test.ts src/lib/engine/purity.test.ts`
- Whole unit suite, type check and lint: `npm test && npx astro check && npm run lint`

#### Manual Verification:

- The owner reads `evidence/calibration-after-s05.md` and signs off the four top-10 snapshots and the Messier bonus (S-03 item 2.5). The October gap (M13, M15, M57 outside the top 5 even at their best) is recorded there as a known miss.

---

## Phase 3: Reasons that distinguish something

**Subagent:** Sonnet, high effort (ranking engine and a copy string).

### Overview

Make `reasonComponents` name a component only when it is eligible (the moon and the sky only when the listed entries differ on it) and true of the entry (at least the list mean), and let a reason line carry one phrase when only one qualifies.

### Changes Required:

#### 1. Eligibility and naming in the reason choice

**File**: `src/lib/engine/ranking.ts`, `src/lib/engine/parameters.ts`, `src/lib/tonight/format.ts`

**Intent**: Add `REASON_MIN_SPREAD` = 0.05 (named candidate, FR-015). `reasonComponents` first drops `moon` and `sky` unless the listed entries' values for that component have a spread (largest minus smallest) of at least that (`duration` and `brightness` are always eligible), then names an eligible component for an entry only when its value is at least the list mean. The lead and second follow the rule in Critical Implementation Details; an entry with fewer than two named components has no second. `topTwo` is rewritten to work over a candidate set (it assumes all four components today), `ReasonComponents.second` and `RankedEntry.secondComponent` become `ScoreComponent | null`, and `reasonLine` prints the lead phrase alone when there is no second (no new wording, no new key; review F5).

**Contract**: `reasonComponents(listed)` keeps its signature and tie order (duration, moon, brightness, sky). Documented in its JSDoc and in the `reason` comment of `en.ts`. S-04's G5 (`small-scope.test.ts:123-148`) must stay green unedited: a faint galaxy whose capped brightness is below the list mean is never given the brightness phrase.

#### 2. Tests

**File**: `src/lib/engine/ranking.test.ts`, `src/lib/tonight/build.test.ts`

**Intent**: Three of the four `reasonComponents` cases (`ranking.test.ts:278, 300, 311`) have equal moon or sky values or a below-mean runner-up, so their expected results change because the requirement changed (item 5); the case at `:291` has differing moon and sky values and stays unless the new naming rule moves it. Keep each case's purpose, derive every expected result by hand from the new rule (a second may now be `null`), and list old and new in `implementation-notes.md`. Add: five entries with moon 1 and sky 1 never get a moon or sky reason; one entry with moon 0.4 among entries at 1 can get the moon reason; an entry below the list mean on brightness is never given the brightness phrase; and a one-entry list names duration and brightness. In `build.test.ts` (review F7): on the moonless night 2026-10-10 (Warsaw, Bortle 6, 150 mm, the AF night, a new Moon in the M-1 checkpoint) the test first asserts the listed entries' moon spread is under `REASON_MIN_SPREAD`, derived from their components, so a wrong date fails loudly, and then that no listed entry's `reason` contains the moonlight phrase; on the full-Moon night 2026-10-26 it asserts only that the listed entries' moon spread is at least `REASON_MIN_SPREAD` (the moon component is eligible), not which reason appears.

#### 3. Stale demo string

**File**: `src/pages/design.astro`

**Intent**: Replace the demo line at `:856` ("… 92% clear of moonlight …") with wording the reason lines can actually produce (the duration and brightness phrases), no new key.

### Success Criteria:

#### Automated Verification:

- Reason tests pass, including the new ones, with G5 unedited: `npx vitest run src/lib/engine/ranking.test.ts src/lib/engine/small-scope.test.ts src/lib/tonight/build.test.ts`
- Whole unit suite, i18n parity, type check and lint: `npm test && npx astro check && npm run lint`

#### Manual Verification:

- A new-Moon Tonight in the app reads reason lines about the object's time up and its brightness, with no moonlight phrase (deferred to the owner's first nights).

---

## Phase 4: PRD criterion 2 re-run, docs, whole-suite checks

**Subagent:** Sonnet, medium effort for the docs; the lead agent runs the e2e suite and smoke.

### Overview

Run the cross-check on the final top 5 of the three nights, write the result, update the documents that state the rules, and run the checks CI runs.

### Changes Required:

#### 1. Ephemeris leg on the final top 5

**File**: `src/lib/engine/window-reference.test.ts`

**Intent**: The Phase 1 fixture already covers all of `DEEP_SKY` on the three nights, so this adds only the criterion-2 assertion: for each night's engine top 5 after Phase 2, window edges within 5 minutes and peak altitude within 1° of the fixture. No second Skyfield run is needed (review F8).

**Contract**: The assertion reads the engine's top 5 and the fixture, never copies the engine's list into the test; if a top-5 object is missing from the fixture the test fails with the missing id.

#### 2. Planner leg and the criterion-2 record

**File**: `context/changes/evening-showpieces/evidence/prd-criterion-2.md`

**Intent**: Before comparing, write the rules (so the engine cannot shape them): (P1) every top-5 object is shown by the planner as visible that night; (P2) the planner's highest altitude for each is at least 30° where the page states one; (P3) the engine's peak altitude is within 3° of the planner's highest altitude where the page states one and its time lies inside the engine's window. A page that states no highest altitude is reported as "not stated", counted per night, and neither passes nor fails P2 or P3. The lead agent then compares the final top 5 of the three nights by hand with the raw capture it holds outside the repository (`planner-in-the-sky-org.json` in its scratchpad, 22, 18 and 16 objects for 2026-10-15, 2026-07-15 and 2026-04-15, which already include the top 5s the probes expect) and writes into the record only the method, the rules and an agreement summary (counts, and statements such as "agreed within N min and N° for the objects listed"), with credit to Dominic Ford and the URL pattern (`https://in-the-sky.org/data/object.php?id=<id>&town=756135&year=&month=&day=`), the date checked and no copied value or text (F6). If the capture is gone or a top-5 object is missing from it, stop and ask the orchestrator; never fetch inside Phase 4. Also state the ephemeris-leg result, the beginner-reference overlap per night as the ranking-sanity leg, and one note: the planner gives no ranking, so the ranking is checked against the published beginner list (each entry with at least two sources). Record the known divergence from OD-1 (October showpieces outside the top 5) and the S-03 sign-off pointer.

**Contract**: A failing rule is reported as an engine finding, never fixed by editing the rule or the evidence; Phase 4 stops and reports. Nothing under `evidence/` or anywhere in the repo contains an in-the-sky.org sentence or value.

#### 3. Documents

**File**: `CLAUDE.md` (and the mirrored `AGENTS.md`), `context/foundation/prd.md`, `context/foundation/roadmap.md`, `context/handoff.md`, `src/lib/engine/fixtures/README.md`

**Intent**: CLAUDE.md Engine paragraph: the duration rule, the refined deep-sky window edges (`refinedWindow`, deep-sky only) and the split that scores stay on the grid while the text uses the refined edges (so a one-sample window reads "Up for 14 min" with duration about 0), the reason eligibility and naming rule with `REASON_MIN_SPREAD`, and the Skyfield window fixture. PRD Open Question 1 gets a note that the duration term is calibrated against the references (the weights stay candidates) and Open Question 9 a note that deep-sky window edges are now within 5 minutes of Skyfield. The roadmap's S-05 Status row and body follow the lifecycle skills (the "M-1 used Telescopius" correction already landed with the plan). `context/handoff.md` gets the S-05 state and the owner's remaining checks. README row for the fixture and the generator's use.

#### 4. Whole-suite checks, the way CI runs them

**File**: none (checks)

**Intent**: Run the whole e2e suite and the smoke walk against a fresh production build with the forecast fixture and the local stack inline (the lessons "Run the whole e2e suite before a PR"), on ports 4331 (preview) and 4401 (fixture), stopping only by own port; report counts.

### Success Criteria:

#### Automated Verification:

- Criterion-2 assertions pass for the three nights: `npx vitest run src/lib/engine/window-reference.test.ts`
- Whole unit suite, type check, lint, formatting: `npm test && npx astro check && npm run lint && npx prettier --check CLAUDE.md AGENTS.md context/foundation/prd.md context/foundation/roadmap.md context/handoff.md src/lib/engine/fixtures/README.md`
- Whole e2e suite and smoke against a fresh build: `npm run build`, then `npm run test:e2e` and `npm run smoke` with the local stack inline (counts reported)
- DB suites untouched but run: `npm run test:db`

#### Manual Verification:

- The owner reads `evidence/prd-criterion-2.md` (rules, agreement summary, the OD-1 divergence).
- The owner's first-nights spot check: M13 and M57 look sensible on an evening Tonight, their windows match their planetarium, and no reason line mentions moonlight on a new-Moon night.

---

## Testing Strategy

### Unit Tests:

- `objects.test.ts`: `refinedWindow` cases, boundaries, threshold-exact sample, one-sample run with positive length, a 0° minimum altitude.
- `score.test.ts`: duration relations (saturation, monotone in span, zero for one sample, edge-independent, aperture-independent).
- `ranking.test.ts`: reason eligibility, with the changed pairs derived by hand.
- `window-reference.test.ts`: Skyfield windows, the index-equality invariant (scores do not move) and criterion 2 (the one reference test that reads an independent ephemeris for deep-sky windows).
- `evening-showpieces.test.ts`: a source-cited guard (the October reference's evening picks in the top half; M13 in the top 5 in April and July), modest by design (the owner prefers modest tests; layout and wording are not pinned).

### Integration Tests:

- Existing oracle, AF check, invariants, small-scope guard, determinism and purity suites unedited.
- Whole e2e suite and smoke before the PR.

### Manual Testing Steps:

1. Read `evidence/calibration-after-s05.md` (four top-10 tables) and sign off S-03 item 2.5.
2. Read `evidence/prd-criterion-2.md`.
3. On an evening with a clear forecast, compare M13 and M57's windows on `/tonight/targets` with an outside planetarium.

## Performance Considerations

Interpolation is arithmetic on the track already computed: no new ephemeris call, no change to the grid. The ranking's CPU is unchanged apart from the reason eligibility (four spreads over at most five entries). The account is on Workers Paid; no budget change.

## Migration Notes

No data or schema change; no stored data depends on window edges (the Session plan edits store keys, not times). Stored offline copies may show old edges until their next online refresh, which is the existing behaviour for any Tonight change.

## References

- Research: `context/changes/evening-showpieces/research.md`
- Planner: in-the-sky.org (Dominic Ford), manual cross-check only; nothing from it is committed (F6)
- Issue #21 (items 1, 4, 5), #173; roadmap S-05; PRD Success Criteria and Open Questions 1, 9
- Checkpoint: `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md:108-114, 249, 277-286`
- S-04 plan (what stayed untouched): `context/archive/2026-10-15-small-scope-galaxies/plan.md:97`
- Window code: `src/lib/engine/objects.ts:76-105`, `src/lib/engine/score.ts:86-180`, `src/lib/tonight/plan-window.ts:53-102`
- Reason code: `src/lib/engine/ranking.ts:172-197`, `src/lib/tonight/format.ts:299-332`
- Existing generator pattern: `scripts/events-reference.py`
- Lessons: `context/foundation/lessons.md` ("Judge advice ... against source-cited references", "Pin a sampled scan against a brute-force reference", "Run the whole e2e suite before a PR")

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Window edges: independent reference, then true crossings

#### Automated

- [ ] 1.1 The reference test fails on the unchanged engine for the expected objects, and passes after the change
- [ ] 1.2 Window and invariant suites pass
- [ ] 1.3 Scores unchanged by construction (index-equality test) and the oracle green without regeneration
- [ ] 1.4 Whole unit suite passes
- [ ] 1.5 Type check and lint pass

#### Manual

- [ ] 1.6 M13's window end on Targets and the Session plan matches an outside planetarium within a few minutes

### Phase 2: Duration saturates at a useful span

#### Automated

- [ ] 2.1 The synthetic relation fails on the old formula by construction and passes on the new one; the new relations and the source-cited guard pass
- [ ] 2.2 Oracle, AF check and invariants green and unedited
- [ ] 2.3 Determinism and purity pass
- [ ] 2.4 Whole unit suite, type check and lint pass

#### Manual

- [ ] 2.5 The owner reads the calibration snapshot and signs off S-03 item 2.5

### Phase 3: Reasons that distinguish something

#### Automated

- [ ] 3.1 Reason tests pass, including the new ones, with G5 unedited
- [ ] 3.2 Whole unit suite, i18n parity, type check and lint pass

#### Manual

- [ ] 3.3 A new-Moon Tonight reads reason lines about time up and brightness, with no moonlight phrase

### Phase 4: PRD criterion 2 re-run, docs, whole-suite checks

#### Automated

- [ ] 4.1 Criterion-2 assertions pass for the three nights
- [ ] 4.2 Whole unit suite, type check, lint and formatting pass
- [ ] 4.3 Whole e2e suite and smoke pass against a fresh build, counts reported
- [ ] 4.4 DB suites pass

#### Manual

- [ ] 4.5 The owner reads the criterion-2 record: rules, agreement summary and the OD-1 divergence
- [ ] 4.6 The owner's first-nights spot check of M13, M57 and the reason lines
