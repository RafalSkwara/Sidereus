# Tolerance report — verified-ephemeris-core (F-01)

Measured 2026-09-24 against Stellarium readings taken by the user (protocol:
`src/lib/engine/fixtures/README.md`; values: `src/lib/engine/fixtures/stellarium/*.json`).
Candidate tolerances under test are PRD Open Question 9: **1° of altitude, 5 minutes of time**
(`src/lib/engine/parameters.ts`). Numbers below come from `npm test -- --reporter=verbose`
(`[tolerance]` lines printed by `src/lib/engine/fixtures/report.test.ts`); regenerate them the same way.

## Sun events and −18° twilight crossings

Stellarium values were read to the minute; the engine computes to the second, so a deviation of
up to 0.5 min is reading resolution, not disagreement.

| Fixture            | Quantity   | Engine (UTC) | Stellarium (local)  | Max deviation | Tolerance | Verdict |
| ------------------ | ---------- | ------------ | ------------------- | ------------- | --------- | ------- |
| warsaw-2026-10-10  | sunset     | 15:52:53     | 17:53 +02:00        | 0.10 min      | 5 min     | ok      |
| warsaw-2026-10-10  | dark start | 17:45:36     | 19:45 +02:00        | 0.61 min      | 5 min     | ok      |
| warsaw-2026-10-10  | dark end   | 03:00:51     | 05:00 +02:00        | 0.85 min      | 5 min     | ok      |
| warsaw-2026-10-10  | sunrise    | 04:53:52     | 06:54 +02:00        | 0.13 min      | 5 min     | ok      |
| warsaw-2026-10-24  | sunset     | 15:22:42     | 17:22 +02:00        | 0.71 min      | 5 min     | ok      |
| warsaw-2026-10-24  | dark start | 17:16:22     | 19:16 +02:00        | 0.37 min      | 5 min     | ok      |
| warsaw-2026-10-24  | dark end   | 03:24:35     | 04:24 +01:00 (CET)  | 0.59 min      | 5 min     | ok      |
| warsaw-2026-10-24  | sunrise    | 05:18:36     | 06:19 +01:00 (CET)  | 0.39 min      | 5 min     | ok      |
| tromso-2026-06-21  | all four   | none         | none (midnight sun) | agree         | —         | ok      |

The 2026-10-24 night spans the end of daylight-saving time; the engine's local-noon-to-local-noon
model and the +02:00 → +01:00 offset change on the morning side both check out. Tromsø's sun bottoms
out at +3.1° (lower culmination 22:46 UTC), so the engine reports `none` at every threshold, matching
Stellarium's absence of sunset/sunrise.

## Moon and object positions

| Fixture            | Quantity                              | Status                                  |
| ------------------ | ------------------------------------- | --------------------------------------- |
| warsaw-2026-10-10  | moon                                  | not applicable (new moon)               |
| warsaw-2026-10-10  | objects (M31, M13, M45)               | **spot-checked, not recorded** (pending) |
| warsaw-2026-10-24  | moon (2 instants), objects (M31, M42, M45) | **spot-checked, not recorded** (pending) |
| tromso-2026-06-21  | moon (1 instant), objects (M13, M57, M81) | **spot-checked, not recorded** (pending) |

The user compared several engine-predicted moon and object altitudes/azimuths (listed in the Phase 3
hand-off) with Stellarium and reported them "roughly correct, in fact surprisingly correct", but the
readings were not written into the fixtures. The six moon/object fixture sections therefore remain
`pending` and appear as todos in `npm test`. The **1° altitude candidate is not formally measured**
by this report; the synthetic tests (M31 culmination geometry within 1°, transit azimuth within 2°,
never-rising object at δ = −60°) and the spot checks are the evidence available today.

## Verdict

- **5-minute time candidate: holds**, with a worst case of 0.85 min across 8 measured events on two
  nights, including the DST transition. No reason to widen it; it could be tightened to 2 min if a
  stricter guarantee is ever wanted.
- **1° altitude candidate: not yet measured.** Keep it as the candidate. To close it, capture the
  moon/object sections per the fixtures README (about ten numbers per fixture); the report test will
  then print `moon altitude` / `object altitude` rows automatically.

## Known systematic effects (not deviations)

- Sun altitudes for twilight are geometric (no refraction), per the twilight convention; Stellarium
  agrees at −18° because refraction is negligible that far below the horizon.
- Moon separation ignores topocentric parallax (≤ ~1°); moon altitude/azimuth do include it
  (`Equator(…, ofdate = true)` is topocentric).
- Object and moon altitudes use astronomy-engine's `"normal"` refraction, matching Stellarium's
  apparent altitude with the atmosphere on.
