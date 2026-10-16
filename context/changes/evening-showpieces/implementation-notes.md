# Implementation notes: evening-showpieces

## Phase 1: window edges, independent reference, then true crossings

### The reference (Skyfield 1.55, DE421)

`scripts/deep-sky-reference.py` wrote `src/lib/engine/fixtures/skyfield/deep-sky-warsaw-2026.json`: Warsaw (52.23 N 21.01 E,
110 m), 2026-04-15, 2026-07-15 and 2026-10-15, all 171 objects of `messier.json` and `caldwell.json` on each night.

- Dark window: the Sun's geometric altitude below -15° (Bortle 5), the engine's own definition (`darkWindow`: astronomy-engine's
  apparent Sun, no refraction). The generator's windows are 2026-04-15 19:19:54Z to 01:51:06Z, 2026-07-15 21:36:48Z to
  23:47:35Z (131 min) and 2026-10-15 17:14:50Z to 2026-10-16 03:29:16Z (614 min). The test compares the engine's `warsawDarkWindow`
  with them within `TIME_TOLERANCE_MINUTES`, and passes.
- Object window: the longest run at or above 15° refracted (10 °C, 1010 mbar) on a one-minute grid inside the dark window, edges
  interpolated across the crossing minute, clipped to the dark window; `maxAltitudeDeg` and `maxTime` are the run's
  (parabola through the grid maximum).

### Red run on the unchanged engine (before `score.ts` used `refinedWindow`)

`npx vitest run src/lib/engine/window-reference.test.ts`: 11 passed, 3 failed. The failing tests are the reachable-window
comparison (`rankObjects` -> `reachable`) on all three nights; every edge error is inward (the grid edge is inside the
crossing), 5.0 to 9.9 minutes:

| Night      | Reachable objects with an edge over 5 min | Selected errors                                                                                         |
| ---------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 2026-04-15 | 28 edges                                  | M27 start 9.3, M24 start 7.7, M31 start 7.6, M96 end -9.9, M37 end -9.6                                 |
| 2026-07-15 | 11 edges                                  | M9 end -9.7, M107 end -9.6, M17 end -8.9, M3 end -7.0, M5 end -5.4                                      |
| 2026-10-15 | 46 edges                                  | M13 end -7.7, M57 end -6.7, M15 end -9.9, M42 start +8.3, M3 end -7.2, M16 end -9.8, NGC7293 both edges |

The expected objects (M13, M57, M15, M42) fail, with the expected 6 to 10 minute errors. The refinedWindow-over-track path and
the Skyfield-side checks passed already at that point because `refinedWindow` was added first; the red state that matters is
the engine's own ranking path, which Targets, the Session plan and the reason line read.

### Green after the change

After `scoreObject` and `deepSkyWindow` use `refinedWindow`: all 14 tests of `window-reference.test.ts` pass. Measured over the
objects that have a window (not part of any assertion): worst edge error against Skyfield 0.28 min (M76, April), 0.25 min (M21,
July), 0.17 min (NGC247, October), against 9.9 min for the grid edges; worst peak altitude difference 0.15° (a grid sample
against the parabola maximum); no object has a window in one and none in the other. Index equality (the brute-force run of
samples equals `firstIndex`..`lastIndex`, and the refined edges lie between the run's edge samples and their outside
neighbours) holds for every reachable object on the four calibration nights. `calibration.test.ts` and
`ranking-invariants.test.ts` pass unedited. At a 0° minimum altitude (where refraction curves the track most) the worst
refined edge is 0.030° from the minimum, at 15° 0.008° and at 40° 0.009° (limit in the tests: 0.05°).

### Test pins edited (the requirement changed: window edges are true crossings, not grid samples)

Values for `build.test.ts` come from an independent Skyfield + DE421 one-minute computation for Warsaw 2026-10-10 (Bortle 6, so
the same -15° dark window, minimum altitude 15; run once with the generator's functions from a scratch script, not from
the engine): dark window 19:25:43 to 05:20:46 local, M13 19:25:43 to 23:42:10, M3 19:25:43 to 19:51:44. The app prints local
times truncated to the minute (`Intl`, no seconds).

| File and test                                                                               | Old                  | New                  | Reason                                                                                        |
| ------------------------------------------------------------------------------------------- | -------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| `src/lib/tonight/build.test.ts` "adds an object beyond the top five ..." (`m13.windowText`) | `19:25–23:35`        | `19:25–23:42`        | M13 sets through 15° at 23:42:10 (Skyfield); 23:35 was the last 10-minute sample at or above. |
| `src/lib/tonight/build.test.ts` "lists what may be added ..." (M3 `detail`)                 | `Window 19:25–19:45` | `Window 19:25–19:51` | M3 sets through 15° at 19:51:44 (Skyfield); 19:45 was the last sample.                        |
| `src/lib/tonight/build.test.ts` "words the candidates' windows in Polish too" (M3 `detail`) | `Okno 19:25–19:45`   | `Okno 19:25–19:51`   | Same value, Polish wording.                                                                   |

`src/lib/engine/visibility-invariants.test.ts`, "keeps a target listed for a single sample (start === end) ...":
the one test is now two. The planet and Moon test keeps `start === end` for a one-sample window (19 entries for seed 20261008,
`> 0` asserted, held to invariants (a) to (c)); the new deep-sky test takes the entries whose best run is one track sample
(`firstIndex === lastIndex`, 111 for the seed, `> 0` asserted), and asserts a window of positive length that holds its sample,
inside the dark window, and held to (a) to (c) at start, end and best time (the entry is in `ranking.entries`, so it still
clears the bar). `record` returns its violations so the deep-sky branch reuses them. Nothing else in that suite changed.

No other pin in the whole suite moved: `npm test` after the change is 132 files, 2568 passed, 4 skipped, 6 todo. (The first run
after the engine change had exactly the three `build.test.ts` failures above; `plan-window.test.ts` parity held because both
sides refine.)

### New tests

- `src/lib/engine/window-reference.test.ts` (new): Skyfield fixture, reachable path, refinedWindow path, dark-window edges,
  index equality on the four calibration nights, all within the PRD tolerances imported from `parameters.ts`.
- `src/lib/engine/objects.test.ts`: `refinedWindow` cases (null, rising and setting edge, both boundaries, one boundary, threshold-exact
  sample, one-sample run with positive length, same run and peak as `bestWindow`, and every catalogue edge within 0.05° of a 0°, 15°
  and 40° minimum on 2026-10-10).

### Adaptations and decisions

- `refinedWindow` calls `bestWindow` and finds its indices by instant, so `bestWindow` stays byte-identical and nothing is duplicated.
- `scoreObject` and `deepSkyWindow` return a plain `{ start, end, peak }` (the indices stay internal), so `ObjectScore.window`,
  `ReachableEntry.window` and the plan's windows keep their shape (`BestWindow`) and `plan-window.test.ts`'s `toEqual` parity holds.
- The generator takes three arguments (`de421.bsp`, the catalogue directory, the output directory); the plan's "adapt the argument
  form to `events-reference.py`" is that script's `<ephemeris> <output directory>` plus the catalogue directory.
- `refinedWindow` and `RefinedWindow` are exported through `src/lib/engine/index.ts`, which `plan-window.ts` imports.

## Phase 2: duration saturates at a useful span

### The rule

`DURATION_USEFUL_SPAN_MINUTES` = 120 (named candidate, `parameters.ts`, calibration in its comment; `WELL_PLACED_ALTITUDE_DEG` untouched and
its comment notes why). In `scoreObject`: `duration = min(1, spanMinutes / DURATION_USEFUL_SPAN_MINUTES) × placed / windowSamples`, with
`spanMinutes = (track[lastIndex].time − track[firstIndex].time) / 60 000` (the grid run, never the refined edges). `scoreObject`'s JSDoc
describes it. No other source comment stated the old denominator (the reason phrase "Up for X of the dark window" describes the
window's length and stays true).

### Red runs on the unchanged formula

Before `score.ts` changed (the new constant already in `parameters.ts`, so only the formula was old):

- `npx vitest run src/lib/engine/score.test.ts src/lib/engine/evening-showpieces.test.ts`: 5 failed, 42 passed.
  - Synthetic relation "gives the same pass the same duration in a 6 h and a 12 h night": red, 0.342 (a 25-sample pass in 73 samples)
    against 0.676 (the same pass in 37 samples), as predicted by construction (0.67 against 0.33).
  - The other three new duration relations were red as well (saturation at the span, the scaled short pass, the one-sample window:
    0.333 where 0 is expected).
  - Source-cited guard: only `ranks M57 in the top half of the cleared list on the October night` was red, `M57 is #60 of 115`
    (limit 57.5). M13, M57's four companions M27, M15 and M2, and M13 in the top 5 on 2026-04-15 and 2026-07-15 already passed
    (they were in the top half on the unchanged engine: M13 #53, M15 #32, M27 #47, M2 #49 of 115), as the plan said only M57 was outside.

After the change: all 47 tests of the two files pass.

### Pins edited (the requirement of the duration formula changed: share of the night, now a saturating span)

Every value re-derived by hand from the new rule (`min(1, span ÷ 120) × mean placement`), not read from the engine, in `score.test.ts`:

| Test                                                                                                                            | Old                                                | New                                                                | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "is 1 when the object is up for the whole dark window" (renamed "... well placed for the whole useful span")                    | default 5-sample track at 40°, duration 1          | 13 samples at 40° (120 min), duration 1                            | The default track spans 40 min, so the new rule gives 1/3; 13 samples is exactly the span.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| "credits each best-window sample by its altitude ..."                                                                           | `(0.6 + 1 + 0.8 + 0.04) / 10`                      | `(30 / DURATION_USEFUL_SPAN_MINUTES) × (0.6 + 1 + 0.8 + 0.04) / 4` | Window is 4 samples (30 min) of a 10-sample track; the credit is averaged over the window, scaled by its span.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| "scores a whole-night pass hugging the minimum altitude near 0, and caps samples above the reference at 1" (second expectation) | track `[80, 85, 90, 85]`, duration 1               | the same four altitudes repeated to 13 samples, duration 1         | The 4-sample pass spans 30 min (0.25 now); 13 samples keeps the purpose, the cap of placement at 1. The `[15, 15, 15, 15]` to 0 expectation is unchanged (placement 0).                                                                                                                                                                                                                                                                                                                                                                                                                 |
| "totals the weighted components" (duration)                                                                                     | `0.4` (`(0.2 + 1 + 0.6 + 0.2) / 5`)                | `(30 / DURATION_USEFUL_SPAN_MINUTES) × 0.5` = 0.125                | Window samples 1..4 span 30 min, mean placement `(0.2 + 1 + 0.6 + 0.2) / 4`. The total is still compared with the weighted sum of its own components.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| "only counts an object a moonless night would list" (washed-out, "brief")                                                       | track `[40, 5 × 9]` (one sample, duration 0.1 old) | track `[30, 30, 30, 5 × 7]`, with premise assertions               | One sample is now duration 0, so at 200 mm the moonless total is 0.4 + 0.25 × 0.1 = 0.425, under the bar of 0.45, and `washedOut` would flip to false for a reason that is not the Moon's. The purpose is kept (the Moon, not the short pass, keeps the 200 mm case off the list; at 70 mm the pass and brightness do): a 20 min pass at 30° has duration `(20 / 120) × 0.6` = 0.1 (asserted), giving moonless totals 0.46 at 200 mm (listed, so washed out) and 0.44 at 70 mm (under the bar). Both `washedOut` expectations and the `dim.total < MIN_OBJECT_SCORE` one are unchanged. |

The whole `src/lib/engine` run after the change found no other `score.test.ts` track under 120 minutes that moved.

### Other tests the rule moved (found by running the suite; ADAPTATIONS)

Three tests, none named by the plan, pinned a premise about where the bar falls for an object whose total moved with the duration rule. They are
premises of a test about something else (the Messier bonus never lifts an object below the bar; a reachable below-bar object is
not cleared; a below-bar plan row links to its finder chart), not assertions about the order; each purpose is kept and only the
premise object or magnitude changed. `npm test` after the rule change failed exactly these (2 in `ranking.test.ts`, 1 in
`build.test.ts`) and nothing else.

`ranking.test.ts`: a synthetic low-interest double star at declination 0, picked by a magnitude that "just clears the bar". With the
saturating rule the same object scores higher, so it cleared at the old "below the bar" magnitude (`expected 0.481 to be less than
0.45`; `clearedCount` 4, expected 3). Re-derivation by hand: the brightness ramp is linear (weight 0.25 over `BRIGHTNESS_RAMP_MAG` = 8,
0.03125 per magnitude), the object's total at vMag 10 is now 0.4906 (the failure message gave 0.4813 at 10.3, plus the 0.009375 of
the 0.3 mag), so it crosses the bar near vMag 11.3: 11.2 clears (0.4531) and 11.5 falls short (0.4437) by less than
`MESSIER_RANK_BONUS` (0.03). The limit of the 150 mm telescope under Bortle 6 is above 11.5, so the object still scores.

| Test                                                                                                                                           | Old                                                                             | New                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ranking.test.ts` "never lifts an object whose own score is below the bar into the list"                                                       | `faint(10)` clears, `faint(10.3)` falls short by less than `MESSIER_RANK_BONUS` | `faint(11.2)` clears, `faint(11.5)` falls short by less than the bonus (the comment records the old pair and why) |
| `ranking.test.ts` "lists every scored object in catalogue order ..." (adjustable-session-plan)                                                 | M40 at vMag 10.3                                                                | M40 at vMag 11.5                                                                                                  |
| `build.test.ts` "links an object below the ranking's bar to its finder chart, and the others to the Targets list" (full-Moon night 2026-10-26) | plan edits `["M33", "M1"]`, M1 expected below the bar (finder link)             | `["M33", "M65"]`, M65 below the bar (finder link); M33 stays the washed-out one (Targets link)                    |

For the `build.test.ts` pin: on 2026-10-26 M1 (Crab Nebula) now clears the bar (it linked to the Targets list). To choose the replacement a scratch test (not
kept) built the session plan for each of the 171 catalogue objects on that night and listed those with a finder link (below the bar and not washed out):
54 objects, M65 among them, and M65's best time comes after M33's, so the row order `["M33", "M65"]` is unchanged. Nothing else in the suite moved.
The AF check (`ranking.test.ts`, 2026-10-10) and every other test passed unedited.

### Gates run in this phase

- `calibration.test.ts`, `ranking.test.ts` (AF check included), `ranking-invariants.test.ts`, `small-scope.test.ts`, `determinism.test.ts`, `purity.test.ts`: green, none edited
  (except the two `ranking.test.ts` premise pins above, in files that are not the oracle, the AF check, the invariants or the small-scope guard); `beginner-reference.ts` untouched. Overlap per calibration night after the change: 2026-01-15 3
  (M45, M35, M37), 2026-04-15 4 (M3, M13, M81, M44), 2026-07-15 3 (M39, M13, NGC7000), 2026-10-15 4 (M31, NGC869, M45, M39), as in the 2026-10-16 probe.
- AF check, Warsaw 2026-10-10, Bortle 6, Messier only: passes.
- Evening showpieces on Warsaw 2026-10-15 (118 cleared): M13 #31, M15 #19, M57 #46, M27 #30, M2 #35, all in the top half; M13 #2 on 2026-04-15 and #2 on 2026-07-15.
  The ranks and ids equal the probe's, so nothing in the engine differs from what was planned.
- `evidence/calibration-after-s05.md` written from `CALIBRATION_SNAPSHOT=1` output (four top-10 tables, the overlap and matched ids, and the OD-1 known divergence).

## Phase 3: reasons that distinguish something

### The rule

`reasonComponents` (`src/lib/engine/ranking.ts`) now follows plan D-5: `duration` and `brightness` are always eligible, `moon` and `sky` only
when the listed entries' values differ (largest minus smallest) by at least `REASON_MIN_SPREAD` = 0.05 (new named candidate in
`parameters.ts`, FR-015). An eligible component is named for an entry only when its value is at least the list mean (a `1e-9` slack,
`AT_MEAN_TOLERANCE`, so that the mean of equal values, which need not round back to the value, does not un-name an entry sitting on it).
The lead is the named component with the largest positive weighted deviation, else the largest weighted value among the named, else
(nothing named) the largest weighted value among the eligible; the second is chosen by the same key over the remaining named
components and is `null` when fewer than two are named. `topTwo` is gone (replaced by `bestOf` over a candidate set);
`ReasonComponents.second` and `RankedEntry.secondComponent` are `ScoreComponent | null`; `reasonLine` (`format.ts`) prints the lead
phrase alone for a null second (no new key, no new wording). `en.ts`'s `reason` comment documents it. `design.astro:856` now reads
"Up for 7 h 50 min of the dark window · bright for your 150 mm."

### Red run on the unchanged logic (new and rewritten tests written first; `REASON_MIN_SPREAD` already added to `parameters.ts` so the imports resolve)

`npx vitest run src/lib/engine/ranking.test.ts src/lib/engine/small-scope.test.ts src/lib/tonight/build.test.ts`: 8 failed, 215 passed.

- Red (7 in `ranking.test.ts`): the three rewritten cases and the rewritten single-entry case (all expect a null second or a brightness
  runner-up), "never names the moon or the sky when five entries all have moon 1 and sky 1" (`['moon','sky'] not to include 'moon'`),
  "does not fall back to a below-mean brightness as the runner-up when the moon and the sky are lower still" (old code gave the
  runner-up `brightness`), "gives an entry below the mean on both duration and brightness a lead ... and no second" (old: `moon, sky`).
- Red (1 in `build.test.ts`): "says nothing about moonlight on the moonless night of 2026-10-10", on the final assertion: the old
  line read "Holds up under your Bortle 6 sky · holds up better in moonlight than the rest" for an entry. Its precondition (moon spread
  under `REASON_MIN_SPREAD`) held on the old code too, as it is a property of the inputs.
- Green on the old code by construction, so no red proof exists for them (both are positive-direction checks that the old code also
  satisfies): "makes the moon eligible when one entry is 0.4 among entries at 1, naming it for the entries at the top" and "never gives
  the brightness phrase to an entry below the listed mean on brightness" (the old runner-up fell on a level moon first). The red proof of
  the brightness rule is the separate "does not fall back to a below-mean brightness ..." case above; the full-Moon eligibility test in
  `build.test.ts` (2026-10-26) is likewise green on both.
- `small-scope.test.ts` G5: green before and after, unedited.

After the change: all three files pass (223 passed, 3 skipped).

### Pins edited (the requirement changed: a reason is named only when eligible and true of the entry)

The four `reasonComponents` cases, each derived by hand from the new rule (weights duration 0.35, moon 0.3, brightness 0.25, sky 0.1):

| Case (purpose kept)                                                                                        | Old                                                                              | New                                                                                                                                            | Derivation                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "leads with the weighted component that most sets each entry apart from the listed mean" (3 entries)       | A `{duration, moon}`, B `{brightness, moon}`, C `{moon, duration}`               | A `{duration, null}`, B `{brightness, null}`, C `{duration, brightness}`                                                                       | Moon and sky are level (spread 0), so only duration (mean 0.625) and brightness (mean 0.625) are eligible. A: duration 1 named, brightness 0.25 under the mean. B: the reverse. C: both at the mean, named, no positive deviation, weighted values duration 0.21875 over brightness 0.15625.                                                                                                                          |
| "weights the deviation, so a smaller weighted gap loses to a bigger one" (2 entries)                       | first `{moon, sky}`, second `{duration, moon}`                                   | first `{moon, sky}` (unchanged), second `{duration, brightness}`                                                                               | Moon spread 0.4 and sky spread 1 are eligible; means duration 0.5, moon 0.7, brightness 0.5, sky 0.5. First: all four named, deviations moon 0.06, sky 0.05, so moon then sky. Second: moon 0.5 < 0.7 and sky 0 < 0.5 are not named; duration and brightness are level (named), weighted 0.175 over 0.125. The plan said this case stays; its second entry moves because its old runner-up (moon) was below the mean. |
| "falls back to the largest weighted values for an entry that stands out on nothing" (4 tops plus a weaker) | tops `{brightness, duration}`, weaker `{duration, moon}`                         | tops `{brightness, duration}` (unchanged), weaker `{duration, null}`                                                                           | Moon and sky level, so ineligible. Means duration 1, brightness 0.9. Tops: brightness +0.025 leads, duration (level) follows. Weaker: duration 1 named, brightness 0.5 under the mean, so a lone reason.                                                                                                                                                                                                              |
| "leads with the largest weighted value for a single entry" (renamed "names duration and brightness ...")   | `c(0.5, 0.9, 1, 1)` → `{moon, brightness}`; `c(1, 1, 1, 1)` → `{duration, moon}` | `c(0.5, 0.9, 1, 1)` → `{brightness, duration}`; `c(1, 1, 1, 1)` → `{duration, brightness}`; new `c(0.2, 1, 0.1, 1)` → `{duration, brightness}` | One entry has spread 0 on every component: moon and sky are never eligible, duration and brightness are named (value = mean). Weighted: duration 0.175 vs brightness 0.25; duration 0.35 vs 0.25; duration 0.07 vs 0.025 (moon's 0.3 would win if it were eligible).                                                                                                                                                  |

Other edit forced by the nullable second: `build.test.ts` "ranks a clear night, formats times ... pairs the kit's eyepieces" asserted
`expect(entry.reason).toContain(" · ")` for every listed entry on 2026-10-10. The requirement changed (a one-reason entry now has a
one-phrase line: M39 reads "Holds up under your Bortle 6 sky"), so it now asserts the reason is non-empty and has at most two phrases
(`split(" · ").length <= 2`). Purpose kept (a reason line is present and well-formed); nothing else in the suite moved. No e2e spec
asserts reason text (grepped `tests/e2e`).

### New tests

- `ranking.test.ts`: five entries all at moon 1 and sky 1 never name the moon or the sky; one entry at moon 0.4 among four at 1 makes
  the moon eligible and the four at 1 lead with it (the 0.4 entry itself never gets it: it is under the mean, see UNCERTAINTIES);
  an entry below the list mean on brightness is never given brightness, including as a runner-up when the moon and sky are lower still;
  an entry below the mean on both duration and brightness gets the lead from the eligible ones and no second; one-entry lists name
  duration and brightness.
- `build.test.ts` ("buildTonight's reason lines (evening-showpieces)"): the listed entries' moon components come from `rankObjects` over
  the same inputs as the view (the view exposes only the reason text), and the test first checks the engine's listed ids equal the view's.
  2026-10-10 (Warsaw, Bortle 6, 150 mm, full catalogue, top 5): moon components 1, 1, 1, 1, 1, spread 0 < 0.05, so the precondition holds
  (the Moon is new), and no listed `reason` contains `en.tonight.reason.moon.lead` or `.follow`. 2026-10-26 (full Moon): moon components
  0.710, 0.811, 0.642, 0.787, 0.599, spread 0.212 >= 0.05, the moon is eligible (asserted only that, not which reason appears; the lines
  there happen to read "Holds up better in moonlight than the rest" for M44 and M39).
- `format.test.ts`: `reasonLine` joins two phrases with the separator and prints the lead alone for a null second, in English and Polish.

### Reason lines after the change (probe, Warsaw 2026-10-10, Bortle 6, 150 mm, full catalogue; not kept)

M31 and NGC869 "Up for 9 h 55 min of the dark window · bright for your 150 mm"; M45 "Bright for your 150 mm · holds up under your Bortle 6 sky";
M34 "Up for 9 h 55 min of the dark window · holds up under your Bortle 6 sky"; M39 "Holds up under your Bortle 6 sky". No moonlight phrase.

### Gates run in this phase

`npm test` (133 files, 2591 passed), `npx astro check` (0 errors) and `npm run lint` pass. `small-scope.test.ts` (G5 included),
`calibration.test.ts` and `fixtures/beginner-reference.ts` are untouched (`git diff` empty) and green; the AF check, the ranking
invariants and the oracle are green, unedited.
