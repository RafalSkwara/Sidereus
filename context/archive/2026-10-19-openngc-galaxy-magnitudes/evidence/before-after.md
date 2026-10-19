# Before and after: the 12 corrected galaxies (rule C)

Produced 2026-10-19 by a scratch probe test (copied into `src/lib/` for one run, then deleted; it is not committed). "Before" is the catalogue as it was before this change, rebuilt in memory from the meta: each galaxy's `fromVMag` from its `vMagColour` entry, or its B for IC 342 and NGC 4039, which copied B. "After" is the committed catalogue. Nothing else differs.

## 1. Band and phrase, 80 and 150 mm, Bortle 4-7

Each cell: `band(deficit) before -> band(deficit) after; phrase key before (-> after when it changed)`. The deficit is `contrastDeficit` in magnitudes; the band edges are 0.5 / 1.5 / 2.5 (`EXPECT_BRIGHT_BELOW`, `EXPECT_SMUDGE_BELOW`, `EXPECT_FAINT_BELOW`), with the near-limit floor of `contrastBand`. Phrase keys drop the `galaxy` prefix.

| Galaxy | V before -> after | 80/B5 | 80/B6 | 150/B4 | 150/B5 | 150/B6 | 150/B7 |
|---|---|---|---|---|---|---|---|
| M58 | 10.3 -> 9.63 | faint(0.19) -> bright(-0.48); Faint -> Smudge | faint(0.99) -> faint(0.32); Faint | bright(-0.96) -> bright(-1.63); Smudge | bright(-0.26) -> bright(-0.93); Smudge | smudge(0.54) -> bright(-0.13); Smudge | faint(1.14) -> bright(0.47); Faint -> Smudge |
| M61 | 10.25 -> 9.6 | faint(1.87) -> smudge(1.22); Faint -> Smudge | limit(2.67) -> faint(2.02); Limit -> Faint | smudge(0.72) -> bright(0.07); Smudge | smudge(1.42) -> smudge(0.77); Smudge | faint(2.22) -> faint(1.57); Faint | limit(2.82) -> faint(2.17); Limit -> Faint |
| M88 | 10.33 -> 9.43 | faint(0.96) -> bright(0.06); Faint -> Smudge | faint(1.76) -> faint(0.86); Faint | bright(-0.20) -> bright(-1.10); Smudge | smudge(0.50) -> bright(-0.40); Smudge | smudge(1.30) -> bright(0.40); Smudge | faint(1.90) -> smudge(1.00); Faint -> Smudge |
| M91 | 10.96 -> 10.13 | faint(1.14) -> faint(0.31); Faint | faint(1.94) -> faint(1.11); Faint | bright(-0.01) -> bright(-0.84); Smudge | smudge(0.69) -> bright(-0.14); Smudge | faint(1.49) -> smudge(0.66); Faint -> Smudge | faint(2.09) -> smudge(1.26); Faint -> Smudge |
| M98 | 10.84 -> 10.01 | faint(1.19) -> faint(0.36); Faint | faint(1.99) -> faint(1.16); Faint | bright(0.04) -> bright(-0.79); Smudge | smudge(0.74) -> bright(-0.09); Smudge | faint(1.54) -> smudge(0.71); Faint -> Smudge | faint(2.14) -> smudge(1.31); Faint -> Smudge |
| M106 | 9.29 -> 8.56 | faint(2.00) -> smudge(1.27); Faint -> Smudge | limit(2.80) -> faint(2.07); Limit -> Faint | smudge(0.84) -> bright(0.11); Smudge | faint(1.54) -> smudge(0.81); Faint -> Smudge | faint(2.34) -> faint(1.61); Faint | limit(2.94) -> faint(2.21); Limit -> Faint |
| IC342 | 9.68 -> 9.12 | limit(3.59) -> limit(3.03); Limit | limit(4.39) -> limit(3.83); Limit | faint(2.43) -> faint(1.87); Faint | limit(3.13) -> limit(2.57); Limit | limit(3.93) -> limit(3.37); Limit | limit(4.53) -> limit(3.97); Limit |
| NGC4449 | 9.64 -> 9.03 | bright(-0.12) -> bright(-0.73); Smudge | faint(0.68) -> bright(0.07); Faint -> Smudge | bright(-1.28) -> bright(-1.89); Smudge | bright(-0.58) -> bright(-1.19); Smudge | bright(0.22) -> bright(-0.39); Smudge | smudge(0.82) -> bright(0.21); Smudge |
| NGC5005 | 10.71 -> 9.73 | faint(-0.45) -> bright(-1.43); Faint -> Smudge | faint(0.35) -> faint(-0.63); Faint | bright(-1.60) -> bright(-2.58); Smudge | bright(-0.90) -> bright(-1.88); Smudge | bright(-0.10) -> bright(-1.08); Smudge | faint(0.50) -> bright(-0.48); Faint -> Smudge |
| NGC4565 | 10.86 -> 9.24 | faint(1.75) -> bright(0.13); Faint -> Smudge | limit(2.55) -> smudge(0.93); Limit -> Smudge | smudge(0.60) -> bright(-1.02); Smudge | smudge(1.30) -> bright(-0.32); Smudge | faint(2.10) -> bright(0.48); Faint -> Smudge | limit(2.70) -> smudge(1.08); Limit -> Smudge |
| NGC6822 | 10.05 -> 8.89 | limit(3.69) -> limit(2.53); Limit | limit(4.49) -> limit(3.33); Limit | limit(2.54) -> smudge(1.38); Limit -> Smudge | limit(3.24) -> faint(2.08); Limit -> Faint | limit(4.04) -> limit(2.88); Limit | limit(4.64) -> limit(3.48); Limit |
| NGC4039 | 11.04 -> 10.57 | faint(1.44) -> faint(0.97); Faint | faint(2.24) -> faint(1.77); Faint | bright(0.28) -> bright(-0.19); Smudge | smudge(0.98) -> smudge(0.51); Smudge | faint(1.78) -> smudge(1.31); Faint -> Smudge | faint(2.38) -> faint(1.91); Faint |


## 2. M106 in the ranking, the review's call

The call: `rankObjects` over the Messier-only catalogue (110 objects), Warsaw (`WARSAW` fixture), `minAltitudeDeg` 15, the dark window for the Bortle class (`darkWindow` with `darknessThresholdDegForBortle`), a 150 mm f/5 telescope, the small-scope test's `EYEPIECES`, `limit: Infinity`. The review's own figures (0.490 -> 0.438, "under the bar") were not reproduced by this call (before: total 0.519, listed); the setup behind them is not recorded in the archive.

| M106, Messier-only ranking, Warsaw | before | after |
|---|---|---|
| 2026-10-10, 150 mm, Bortle 6 | rank 58 of 67, total 0.519, brightness 0.100 | rank 58 of 67, total 0.519, brightness 0.100 |
| 2026-10-10, 150 mm, Bortle 5 | rank 60 of 67, total 0.526, brightness 0.100 | rank 42 of 67, total 0.616, brightness 0.462 |
| 2026-04-15, 150 mm, Bortle 5 | rank 44 of 76, total 0.755, brightness 0.100 | rank 10 of 76, total 0.845, brightness 0.462 |
| 2026-04-15, 150 mm, Bortle 6 | rank 33 of 76, total 0.748, brightness 0.100 | rank 36 of 76, total 0.748, brightness 0.100 |

Reading: at 150 mm / Bortle 6 on 2026-10-10 (the issue's own case) M106 stays `faint` (deficit 1.61 against the 1.5 edge), its brightness credit stays at the 0.1 cap, and its rank and total do not change. At Bortle 5 it becomes `smudge` and gains about 0.09 total (rank 60 -> 42 on 2026-10-10, 44 -> 10 on 2026-04-15). On 2026-04-15 at Bortle 6 its rank slips from 33 to 36 because other corrected galaxies rise past it.
