# Calibration snapshot after S-04 and S-05 (evening-showpieces, Phase 2)

Recorded 2026-10-16 on the branch `feat/evening-showpieces` after Phase 2 (the saturating duration rule, `DURATION_USEFUL_SPAN_MINUTES` = 120), with `CALIBRATION_SNAPSHOT=1 npx vitest run src/lib/engine/calibration.test.ts --reporter=verbose`. Setup is the calibration test's: Warsaw, Bortle 5 (dark window at the Sun's altitude of -15 degrees), a 150/750 telescope, the whole catalogue (Messier and Caldwell), four seasonal nights.

This is a recording aid, not an oracle: no assertion reads it. The oracle is `calibration.test.ts`, which compares each night's top five with the committed, source-cited beginner reference (`fixtures/beginner-reference.ts`) and requires at least 3 matches. This file is the input for the owner's sign-off of S-03 item 2.5 (the four top-10 tables and the Messier bonus); S-03's archived plan stays untouched, and its older snapshot (`context/archive/2026-10-06-deep-sky-beyond-messier/evidence/calibration.md`) predates S-04 and S-05.

Columns: `total` is the object's own score (what decides whether it clears the bar), `rank score` is `total` plus `MESSIER_RANK_BONUS` (0.03) for a Messier object, which orders the list and never decides the bar. A reference match is an object that at least two sources name as a beginner target for that season.

## Overlap with the beginner reference

| Night      | Matches in the top five | Matched ids           | Needed |
| ---------- | ----------------------- | --------------------- | ------ |
| 2026-01-15 | 3                       | M45, M35, M37         | 3      |
| 2026-04-15 | 4                       | M3, M13, M81, M44     | 3      |
| 2026-07-15 | 3                       | M39, M13, NGC7000     | 3      |
| 2026-10-15 | 4                       | M31, NGC869, M45, M39 | 3      |

The earlier snapshot (before S-04 and S-05) matched exactly 3 on every night. The new rule keeps every night at 3 or more and gives April and October a fourth (M44 in April's top five; in October M45 replaces M33, as the probe of 2026-10-16 predicted).

## Top ten per night

### 2026-01-15

| #   | Id            | Type         | V mag | Total | Rank score |
| --- | ------------- | ------------ | ----- | ----- | ---------- |
| 1   | M45           | open-cluster | 1.2   | 0.944 | 0.974      |
| 2   | M44           | open-cluster | 3.1   | 0.931 | 0.961      |
| 3   | M35           | open-cluster | 5.1   | 0.926 | 0.956      |
| 4   | M37           | open-cluster | 5.6   | 0.914 | 0.944      |
| 5   | M34           | open-cluster | 5.2   | 0.904 | 0.934      |
| 6   | M36           | open-cluster | 6     | 0.897 | 0.927      |
| 7   | M31           | galaxy       | 3.44  | 0.896 | 0.926      |
| 8   | M81           | galaxy       | 6.92  | 0.896 | 0.926      |
| 9   | NGC 869 / 884 | open-cluster | 3.7   | 0.920 | 0.920      |
| 10  | M38           | open-cluster | 6.4   | 0.886 | 0.916      |

### 2026-04-15

| #   | Id      | Type             | V mag | Total | Rank score |
| --- | ------- | ---------------- | ----- | ----- | ---------- |
| 1   | M3      | globular-cluster | 6.39  | 0.933 | 0.963      |
| 2   | M13     | globular-cluster | 5.8   | 0.922 | 0.952      |
| 3   | M92     | globular-cluster | 6.52  | 0.898 | 0.928      |
| 4   | M81     | galaxy           | 6.92  | 0.897 | 0.927      |
| 5   | M44     | open-cluster     | 3.1   | 0.892 | 0.922      |
| 6   | M53     | globular-cluster | 7.79  | 0.885 | 0.915      |
| 7   | M94     | galaxy           | 8.24  | 0.855 | 0.885      |
| 8   | M82     | galaxy           | 8.3   | 0.854 | 0.884      |
| 9   | M51     | galaxy           | 8.36  | 0.852 | 0.882      |
| 10  | NGC 188 | open-cluster     | 8.1   | 0.880 | 0.880      |

### 2026-07-15

| #   | Id            | Type             | V mag | Total | Rank score |
| --- | ------------- | ---------------- | ----- | ----- | ---------- |
| 1   | M39           | open-cluster     | 4.6   | 0.989 | 1.019      |
| 2   | M13           | globular-cluster | 5.8   | 0.952 | 0.982      |
| 3   | NGC 7000      | emission-nebula  | 4     | 0.980 | 0.980      |
| 4   | M31           | galaxy           | 3.44  | 0.944 | 0.974      |
| 5   | M71           | globular-cluster | 6.1   | 0.942 | 0.972      |
| 6   | M15           | globular-cluster | 6.3   | 0.931 | 0.961      |
| 7   | M92           | globular-cluster | 6.52  | 0.929 | 0.959      |
| 8   | M29           | open-cluster     | 6.6   | 0.927 | 0.957      |
| 9   | NGC 869 / 884 | open-cluster     | 3.7   | 0.957 | 0.957      |
| 10  | M52           | open-cluster     | 6.9   | 0.917 | 0.947      |

### 2026-10-15

| #   | Id            | Type         | V mag | Total | Rank score |
| --- | ------------- | ------------ | ----- | ----- | ---------- |
| 1   | M31           | galaxy       | 3.44  | 0.975 | 1.005      |
| 2   | NGC 869 / 884 | open-cluster | 3.7   | 1.000 | 1.000      |
| 3   | M34           | open-cluster | 5.2   | 0.959 | 0.989      |
| 4   | M45           | open-cluster | 1.2   | 0.947 | 0.977      |
| 5   | M39           | open-cluster | 4.6   | 0.929 | 0.959      |
| 6   | M33           | galaxy       | 5.79  | 0.918 | 0.948      |
| 7   | NGC 752       | open-cluster | 5.7   | 0.948 | 0.948      |
| 8   | M52           | open-cluster | 6.9   | 0.916 | 0.946      |
| 9   | NGC 457       | open-cluster | 6.4   | 0.933 | 0.933      |
| 10  | M35           | open-cluster | 5.1   | 0.903 | 0.933      |

## Known divergence (owner decision OD-1, 2026-10-16)

The October evening showpieces that the beginner reference names for the 2026-10-15 night (M13, M57, M27, M15, M2, each with at least two sources) rank well outside the top five after the change. On Warsaw 2026-10-15 (Bortle 5, 150/750, 118 objects cleared) the engine puts them at:

| Object | Rank | Duration component after the change |
| ------ | ---- | ----------------------------------- |
| M13    | #31  | 0.628                               |
| M15    | #19  | 0.802                               |
| M27    | #30  | 0.772                               |
| M2     | #35  | 0.633                               |
| M57    | #46  | 0.753                               |

Before the change (probe of 2026-10-16, on 115 cleared objects) they were #53 (M13), #32 (M15), #60 (M57), #47 (M27) and #49 (M2): the structural penalty of dividing a pass of 4 to 6 hours by a 10 hour night is gone, and all five now lie in the top half of the list (guarded by `evening-showpieces.test.ts`). M13 is #2 on the April and July nights, where the dark window is short (and #18 of 134 in January).

They stay outside the top five, and this is accepted, not fixed. Brightness and type bound them, not duration: the probe of 2026-10-16 (recomputed outside the engine with every other term as it is, not repeated in this phase) shows that even with duration set to 1 for every object, the best rank on the calibration nights would be about #10 to #17 for M13 and about #42 to #57 for M57, because bright open clusters and the Moon-proof components of the score outweigh a globular cluster or a planetary nebula in this setup. The owner chose (OD-1, option A) not to add a rank-only bonus for globular clusters and planetary nebulae in this change; the same decision is recorded in the criterion-2 record of Phase 4.

The oracle's overlap per night (table above) is unaffected: the beginner reference for October is met by M31, NGC 869 / 884, M45 and M39.
