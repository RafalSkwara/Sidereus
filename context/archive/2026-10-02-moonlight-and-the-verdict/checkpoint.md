# Checkpoint: honest moonlight in the ranking (Phase 1)

2026-10-02. The real implementation (`rankObjects` on `feat/moonlight-and-the-verdict`) is compared with `origin/main` (5f2f06b). Both run the same spec over the six calibration cases from `calibration-harness.md`, plus M-1 Night 3.

- **Common inputs:** minimum altitude 15°, elevation 0 m, focal ratio f/5. Eyepieces don't affect the order.
- **Bortle 6 / Bortle 3:** the Bortle class of the run.
- **Washed out:** listed in order of best time.

| Case | Before: cleared / top 5 | After: cleared / washed out / top 5 |
| --- | --- | --- |
| Warsaw 2026-10-10 (new), B6, 150 mm | 66 / M31 M34 M39 M45 M52 | 66 / none / M31 M34 M39 M45 M52 |
| Warsaw 2026-10-20 (69%), B6, 150 mm | 53 / M31 M34 M45 M39 M52 | 65 / none / M34 M31 M45 M39 M52 |
| Warsaw 2026-10-24 (97%), B6, 150 mm | 18 / M31 M34 M45 M52 M39 | 42 / M101 M33 M74 M43 / M34 M45 M52 M39 M103 |
| Warsaw 2026-10-26 (full), B6, 150 mm | 18 / M31 M34 M45 M52 M103 | 36 / M33 M74 M43 M101 / M34 M52 M39 M45 M103 |
| Warsaw 2026-10-26 (full), B3, 150 mm | 21 / M34 M31 M33 M52 M45 | 27 / M33 M74 M43 M88 M89 M91 M98 / M34 M52 M39 M103 M45 |
| Warsaw 2026-10-10 (new), B3, 150 mm | 63 / M31 M34 M33 M39 M52 | 63 / none / M31 M34 M33 M39 M52 |
| Bieszczady 2027-04-06 (new; M-1 Night 3), B3, 80 mm | 82 / M3 M81 M53 M13 M101 | 82 / none / M3 M81 M53 M13 M101 |

## Reading it

- **New-Moon nights are unchanged.** This includes the spring galaxy night in Bieszczady: the same cleared counts and the same top 5.
- **Under a full Moon the top 5 is clusters only.** Clusters survive moonlight, so more objects clear than before (18 → 36 at Bortle 6).
- **The washed-out count is the Moon's fault only.** It counts objects a moonless night would list (review rev 2, F2): 4 at Bortle 6 and 7 at Bortle 3, where the darker sky would show the faint Virgo galaxies.
- **M31, M42 and M57 are never washed out.** M16 is exempt.
- **On 10-20 (69% lit), nothing is washed out.** The Moon card line (Phase 4) must not say "Dark night" there; see the four-case table in the plan.
- **The numbers match the plan's calibration table exactly** (plan › Current State Analysis), so no candidate was tuned. T stays 3.5, core offset 1.5, reference 1.5.

## Implementation notes that touch the model

- **Scattering function below 10° (minor adaptation).** The harness swapped the whole K&S `f(ρ)` for `6.2e7/ρ²` below 10°. The implementation keeps the Rayleigh term and replaces only the Mie term, as in Thorstensen's skycalc (`lunskybright`), and clamps ρ at 0.25° so the term stays finite at the Moon's centre. This changes only objects within 10° of the Moon, and every row above is identical to the harness.
- **The model is monotonic only piecewise.** The brightening falls with separation within 10° and from 10° to 90°. It is not monotonic across the 10° seam (about a 15% jump) or past 90° (Rayleigh backscatter). The property test covers those two stretches.
- **`ScoreInput` gains `moonSeparationsDeg`.** It holds one separation per track sample, computed by `moonSeparationsDeg(times, targets)`: one Moon vector per sample, dotted with each object's. The dark zenith sky comes from `darkSkyZenithMagForBortle(bortle)` inside `scoreObject`, rather than as a separate `darkZenithMag` input, so the two cannot disagree. `MoonState` is unchanged.

## Screenshots

Local preview on the real clock (2026-10-02, Moon about 58% lit and waning): see Progress 1.4. Bright-Moon states are covered by the fixed-date tests (2026-10-26 in `build.test.ts`, `ranking.test.ts` and `determinism.test.ts`). A bright-Moon screenshot check follows merge, after 2026-10-22 (review rev 2, F4).
