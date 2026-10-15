# Implementation notes: small-scope-galaxies

Evidence the plan asks to record ("recorded in the phase notes"). Each phase was written by a Sonnet subagent. The lead agent ran the gates and the deliberate-break checks.

## Phase 1: Hubble type in the catalogue

- The generator diff adds only `hubble`. The meta files came out unchanged.
- 68 objects carry `hubble`, all of them galaxies: E 14, Sb 9, Sc 7, Sbc / SABc / SABb / Sab 5 each, S0-a 3, SBm / SABa / Sa / IB 2 each, and one each of SBd, SBcd, SBbc, S0, S?, I, E-S0. The other 103 objects have `null`.
- 1.1: after the commit, `npm run catalogue:build && git diff --exit-code src/lib/catalogue/` shows no change.
- Deliberate break: `validateMeasurements` returned `hubble: null` → 3 catalogue tests went red. The file was restored.

## Phase 2: Small-scope references and the bulge core term

- **2.1, before the bulge term.** All 8 new entries were run one by one in a scratch test, since deleted.

  | Entry | Expected | Computed | Result |
  |---|---|---|---|
  | M31 60 mm / B5 | `galaxySmudge` | `galaxySmudge` | pass |
  | M31 60 mm / B6 | `galaxySmudge` | `galaxyFaint` | **FAIL** |
  | M31 60 mm / B8 | `galaxyFaint` | `galaxyLimit` | **FAIL** |
  | M33 80 mm / B4 | `galaxySmudge` | `galaxySmudge` | pass |
  | M81 80 mm / B5 | `galaxySmudge` | `galaxySmudge` | pass |
  | M101 80 mm / B3 | `galaxySmudge` | `galaxySmudge` | pass |
  | M101 80 mm / B6 | `galaxyLimit` | `galaxyLimit` | pass |
  | M33 80 mm / B6 (divergence) | `galaxyLimit` | `galaxyFaint` | divergence, as recorded |

- **2.3, which galaxies change key at `EXPECT_BULGE_CORE_EXTRA_MAG` = 0.8** (scratch snapshot before and after, since deleted):

  | Setting | Changed | Changes |
  |---|---|---|
  | 60 mm / B6 | 4 | M31 `galaxyFaint` → `galaxySmudge`; M88, M91, M98 `galaxyLimit` → `galaxyFaint` |
  | 150 mm / B4 | 0 | — |
  | 150 mm / B7 | 12 | `galaxyFaint` → `galaxySmudge`: M31, M51, M66, M77, M90, M95, M96, M100, NGC2775. `galaxyLimit` → `galaxyFaint`: M88, M91, M98 |
  | 200 mm / B5 | 1 | NGC4565 `galaxyFaint` → `galaxySmudge` |

- **The window for `e`**, checked by arithmetic from M31's deficits at e = 0:
  - Bortle 8: 3.262 − e < 2.5 gives e > 0.762.
  - Bortle 5: 1.362 − e ≥ 0.5 gives e ≤ 0.862.
  - Bortle 6: 2.162 − e < 1.5 gives e > 0.662.
- **Fixture:** 27 references and 3 divergences (NGC 7000, NGC 4889, and M33 at 80 mm / B6).
- **Adaptations:**
  - Fixture notes write issue numbers as "issue 159", because `no-hardcoded-colors.test.ts` reads "#159" as a hex colour.
  - The new sources share `ACCESSED_SMALL_SCOPE = "2026-10-15"`, passed as the optional 4th argument of `source()`.
  - `ContrastBand` and `contrastBand` moved to `contrast.ts`. The barrel exports them once, from there.
- **Deliberate break:** flipping the sign of the bulge term in `contrast.ts` turned 4 tests red: three in `contrast.test.ts` and the reference test in `expectation.test.ts`. The file was restored.

## Phase 3: Ranking follows the line

- **3.1, before the cap.** `small-scope.test.ts` ran on the Phase 2 code:
  - G1 failed in all 4 cases (M101 was #6 at Bortle 5/6 × 60/80 mm).
  - G3 failed (M33 was #8).
  - G5 failed in 40 combinations (M33 `galaxyFaint` or `galaxyLimit` with brightness as a reason, and others).
  - G6 failed.
  - G2 (both nights) and G4 passed; both are pins.
- **After the cap:** 66 passed and 3 skipped. The skips are the G5 combinations with no dark window (Warsaw 2026-07-15 at Bortle 3), skipped explicitly through `it.skipIf(dark.kind !== "window")`.
- **3.2, calibration top ten, before and after** (snapshot command; the file and `beginner-reference.ts` are unchanged; 20/20 pass):
  - 2026-01-15, 2026-07-15, 2026-10-15: unchanged.
  - 2026-04-15: M101 (#6, .8961) leaves the top ten. M94, M82, M51 and NGC188 move up one place, and M63 enters at #10 (.8739). The top five is unchanged.
- **G1 margins**, M101 on Warsaw 2026-04-15 (gap = #10's rank score minus M101's):

  | Setting | Before the cap | After the cap | Gap to #10 |
  |---|---|---|---|
  | B5 / 60 mm | #6 | #17 | 0.0284 |
  | B5 / 80 mm | #6 | #21 | 0.0479 |
  | B6 / 60 mm | #6 | #17 | 0.0352 |
  | B6 / 80 mm | #6 | #26 | 0.0634 |

- **F8, washed-out lists** (Messier, Warsaw, Bortle 6, 150 mm, as in `ranking.test.ts`):
  - 2026-10-10: empty before and after.
  - 2026-10-26: M101, M33, M43, M74 before and after.
- **Side effect, checked by the lead agent.** On 2026-10-10 (Bortle 6, 150 mm, Messier), the cleared count goes from 66 to 65. M106 is `galaxyFaint` there, and its total falls from 0.490 to 0.438, under `MIN_OBJECT_SCORE`. This is the cap working as designed: a faint-band galaxy can fall under the bar when its other components were only just clearing it. A `galaxyLimit` galaxy stays listed only when its other components clear the bar without brightness credit (OD-4 a).
- **Lower edge of the faint cap.** A deliberate-break run turned `score.test.ts` red at 0.05 and 0.06 ("only counts an object a moonless night would list") and left it green at 0.07. The working window is about 0.065-0.2, recorded in the `GALAXY_FAINT_BRIGHTNESS_CAP` comment.
- **Adaptations:**
  - The guard's telescopes are f/5 (focal length = 5 × aperture), the calibration scope's ratio. Eyepieces do not affect the rank score.
  - `score.ts` gains the helpers `brightnessOf` and `galaxyBrightnessCap`.
- **Deliberate break (lead agent):** disabling the cap in `brightnessOf` turned 48 tests red in `small-scope.test.ts` and `score.test.ts`. The file was restored.
