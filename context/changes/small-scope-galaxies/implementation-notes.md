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
