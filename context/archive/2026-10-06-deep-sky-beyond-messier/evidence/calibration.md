# Phase 2 evidence: calibration of the mixed ranking

Snapshot taken 2026-10-06 from a temporary test (deleted afterwards; `calibration.test.ts` writes no files).

Setup: `DEEP_SKY` (171 objects), `limit: Infinity`, Warsaw, Bortle 5 (dark window at Sun −15°), minimum altitude 15°, telescope 150/750, eyepieces 25 mm + 10 mm (50°), empty log. `RankInput` has no cloud input and the Moon is computed inside. The four nights are all near new Moon, with no washed-out objects.

## Final bonus: `MESSIER_RANK_BONUS = 0.03`

Tuning log:

| Bonus | Result |
|---|---|
| 0.03 (the candidate) | All four loose expectations pass on the first run. Nothing tuned. |
| 0 (break check, run through the real test) | `calibration.test.ts` fails for 15 Oct: only 2 Messier objects in the top 5 (NGC869, M31, M34, NGC752, NGC457). So the guard bites. |
| 0.05 (what-if, re-sorted by hand, not run through the test) | Also satisfies (a)-(d), but NGC869 (Double Cluster) drops to #6 in January and #10 in July, which is more Messier-first than needed. |

Effect of the bonus on Messier share (a hand re-sort of the cleared list by `total + bonus`):

| Night | 0 | 0.03 | 0.05 |
|---|---|---|---|
| 15 Jan, Messier in top 5 / top 10 | 4 / 8 | 4 / 8 | 5 / 9 |
| 15 Apr | 5 / 8 | 5 / 9 | 5 / 10 |
| 15 Jul | 3 / 6 | 4 / 8 | 5 / 8 |
| 15 Oct | 2 / 6 | 4 / 7 | 4 / 7 |

The expectations were not touched. The bonus order-only property is pinned in `ranking.test.ts`: the bar reads `total` only.

## Seasonal top 10 (rank, id, label, type, vMag, total, rankScore)

Messier objects carry `rankScore = total + 0.03`.

### 15 Jan 2026: cleared 133, Caldwell cleared 55

| # | id | label | type | V | total | rankScore |
|---|---|---|---|---|---|---|
| 1 | M44 | M44 (Beehive) | open-cluster | 3.1 | 0.909 | 0.939 |
| 2 | M81 | M81 (Bode's Galaxy) | galaxy | 6.92 | 0.896 | 0.926 |
| 3 | NGC869 | NGC 869 / 884 (Double Cluster) | open-cluster | 3.7 | 0.920 | 0.920 |
| 4 | M35 | M35 | open-cluster | 5.1 | 0.889 | 0.919 |
| 5 | M37 | M37 | open-cluster | 5.6 | 0.889 | 0.919 |
| 6 | M36 | M36 | open-cluster | 6.0 | 0.873 | 0.903 |
| 7 | M38 | M38 | open-cluster | 6.4 | 0.861 | 0.891 |
| 8 | M45 | M45 (Pleiades) | open-cluster | 1.2 | 0.854 | 0.884 |
| 9 | M82 | M82 (Cigar Galaxy) | galaxy | 8.3 | 0.853 | 0.883 |
| 10 | NGC188 | NGC 188 | open-cluster | 8.1 | 0.880 | 0.880 |

First Caldwell objects after the top 10: NGC2403 (#13), NGC663 (#15), NGC457 (#16), NGC7023 (#17).

### 15 Apr 2026: cleared 123, Caldwell cleared 47

| # | id | label | type | V | total | rankScore |
|---|---|---|---|---|---|---|
| 1 | M3 | M3 | globular-cluster | 6.39 | 0.933 | 0.963 |
| 2 | M13 | M13 (Hercules Globular) | globular-cluster | 5.8 | 0.922 | 0.952 |
| 3 | M92 | M92 | globular-cluster | 6.52 | 0.898 | 0.928 |
| 4 | M81 | M81 (Bode's Galaxy) | galaxy | 6.92 | 0.897 | 0.927 |
| 5 | M53 | M53 | globular-cluster | 7.79 | 0.885 | 0.915 |
| 6 | M101 | M101 | galaxy | 7.9 | 0.866 | 0.896 |
| 7 | M94 | M94 | galaxy | 8.24 | 0.855 | 0.885 |
| 8 | M82 | M82 (Cigar Galaxy) | galaxy | 8.3 | 0.854 | 0.884 |
| 9 | M51 | M51 (Whirlpool) | galaxy | 8.36 | 0.852 | 0.882 |
| 10 | NGC188 | NGC 188 | open-cluster | 8.1 | 0.880 | 0.880 |

Next Caldwell objects: NGC7023 (#14), NGC6543 (Cat's Eye, #17), NGC2403 (#26).

### 15 Jul 2026: cleared 92, Caldwell cleared 40

| # | id | label | type | V | total | rankScore |
|---|---|---|---|---|---|---|
| 1 | M39 | M39 | open-cluster | 4.6 | 0.989 | 1.019 |
| 2 | M13 | M13 (Hercules Globular) | globular-cluster | 5.8 | 0.952 | 0.982 |
| 3 | NGC7000 | NGC 7000 (North America Nebula) | emission-nebula | 4.0 | 0.980 | 0.980 |
| 4 | M31 | M31 (Andromeda) | galaxy | 3.44 | 0.944 | 0.974 |
| 5 | M71 | M71 | globular-cluster | 6.1 | 0.942 | 0.972 |
| 6 | M15 | M15 | globular-cluster | 6.3 | 0.931 | 0.961 |
| 7 | M92 | M92 | globular-cluster | 6.52 | 0.929 | 0.959 |
| 8 | M29 | M29 | open-cluster | 6.6 | 0.927 | 0.957 |
| 9 | NGC869 | NGC 869 / 884 (Double Cluster) | open-cluster | 3.7 | 0.957 | 0.957 |
| 10 | M52 | M52 | open-cluster | 6.9 | 0.917 | 0.947 |

Next Caldwell objects: NGC7243 (#11), NGC457 (#13), IC5146 (Cocoon, #15), NGC663 (#16), NGC6960 / NGC6992 (Veil, #18 / #19).

### 15 Oct 2026: cleared 117, Caldwell cleared 50

| # | id | label | type | V | total | rankScore |
|---|---|---|---|---|---|---|
| 1 | M31 | M31 (Andromeda) | galaxy | 3.44 | 0.975 | 1.005 |
| 2 | NGC869 | NGC 869 / 884 (Double Cluster) | open-cluster | 3.7 | 1.000 | 1.000 |
| 3 | M34 | M34 | open-cluster | 5.2 | 0.959 | 0.989 |
| 4 | M39 | M39 | open-cluster | 4.6 | 0.929 | 0.959 |
| 5 | M33 | M33 (Triangulum) | galaxy | 5.79 | 0.918 | 0.948 |
| 6 | NGC752 | NGC 752 | open-cluster | 5.7 | 0.948 | 0.948 |
| 7 | M52 | M52 | open-cluster | 6.9 | 0.916 | 0.946 |
| 8 | M45 | M45 (Pleiades) | open-cluster | 1.2 | 0.914 | 0.944 |
| 9 | NGC457 | NGC 457 (Owl Cluster) | open-cluster | 6.4 | 0.933 | 0.933 |
| 10 | M103 | M103 | open-cluster | 7.4 | 0.902 | 0.932 |

Next Caldwell objects: NGC663 (#11), NGC7243 (#12), NGC7000 (#13), NGC188 (#16), NGC7023 (#17).

## Expectations (all four hold at 0.03)

- (a) Caldwell cleared: 55 / 47 / 40 / 50.
- (b) Messier in the top 5: 4 / 5 / 4 / 4.
- (c) NGC869 in the October top 10: it is #2.
- (d) No Caldwell galaxy fainter than V 10 in any top 5: none of the top fives holds a Caldwell galaxy at all (the first Caldwell galaxy anywhere is NGC2403 at #13 in January).

## Watchlist objects from phase-1.md

| Object | stored vMag | Jan | Apr | Jul | Oct |
|---|---|---|---|---|---|
| IC405 (Flaming Star) | 10 | #47 (total 0.719) | #116 (0.502) | not up | #58 (0.694) |
| NGC2238 (Rosette) | 6.0 | #36 (0.757) | #101 (0.586) | not up | #59 (0.690) |
| NGC7635 (Bubble) | 11 | #77 (0.660) | #97 (0.616) | #50 (0.769) | #39 (0.768) |

Findings:

- None of the three ranks high in any season, so no override is needed to keep the beginner list sane. NGC2238 at V 6.0 does not rank very high: its large low-surface-brightness disc takes the sky penalty (and its duration is short in the sampled nights), so the brightness advantage of the optimistic magnitude does not reach the top 10. It is the better candidate for an override of the three if the phase-3 listing shows it too prominent, but the evidence does not call for one.
- The one thing that looks odd for a beginner list is NGC188 (open cluster, V 8.1, near the pole): #10 in January and in April with total 0.880 (above several Messier galaxies). It is a faint, old, sparse cluster, hard for a first-time observer. This comes from the score (it has long duration, no sky penalty because its surface brightness is above the threshold, and no per-type interest weighting), not from a bad catalogue value, so a catalogue override would not change it. Left as is; see UNCERTAINTIES in the report.
- Nothing else in the top 10 of any night looks implausible: the Caldwell entries that reach the top 10 are the Double Cluster, NGC 7000, NGC 188, NGC 752 and the Owl Cluster, all established binocular/small-scope targets.

## Determinism and budget (`determinism.test.ts` on `DEEP_SKY`, 171 objects, `LOCAL_BUDGET_MS` 1000 unchanged)

- Engine sampling run (dark window + moon + 171 tracks): 17.6 ms cold, 4.5 ms warm.
- Ranking run (dark window + `rankObjects` over 171 objects): 8.0 ms cold, 5.5 ms warm.
- Both far inside the budget; the 55% larger catalogue made no practical difference.

## Gates

- `npx vitest run`: 74 files, 792 passed, 6 todo (was 775 passed before this phase).
- `npx astro check`: 0 errors.
- `npx eslint src/lib/engine src/lib/catalogue`: 0 errors, the 2 old `no-console` warnings in `determinism.test.ts`.

> **Note (impl review F2, 2026-10-06):** C 49 and C 50 were relabelled after this snapshot: C 49 is now `NGC2237` (data from OpenNGC's NGC 2238 row) and C 50 is `NGC2244` (data from NGC 2239). Only the id and designation changed, so the scores and ranks above still hold; read `NGC2238` above as `NGC2237`.
