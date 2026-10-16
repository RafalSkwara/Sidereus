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
