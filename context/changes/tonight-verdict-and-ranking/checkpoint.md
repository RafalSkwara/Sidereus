# Checkpoint: tonight-verdict-and-ranking (S-02, Phase 4)

Recorded 2026-09-25 on branch `feat/s-02-p4`. This file holds the CPU observation (Phase 4 §2) and the independent three-night sanity checkpoint (Phase 4 §3).

## Method

- **Sidereus side.** A throwaway vitest file outside the repo (in the session scratchpad, with a plain-object config aliasing `@` to `src/`) ran the real engine: `observingNight` → `darkWindow(site, night, darknessThresholdDegForBortle(bortle))` → `verdict(window, null)` → `rankObjects(...)` over the full `MESSIER` catalogue. The inputs match what `src/lib/tonight/build.ts` passes: site elevation 0 m, and eyepieces in the order listed. No forecast was supplied, so every verdict is `marginal / no-weather-data`, which still ranks. This checkpoint is about the ranking, not the weather. The harness also scored every object with `scoreObject` on the same tracks, so the report can explain why well-known targets are missing.
- **Independent side.** A throwaway Python 3.14 virtualenv in the scratchpad, with Skyfield and the JPL DE421 ephemeris, recomputed the following. Nothing was installed in the repo or globally.
  - **Dark window.** Sun apparent topocentric altitude, **no refraction**, crossing the Bortle threshold, found with `almanac.find_discrete`.
  - **Each listed object.** Positions come from the J2000 RA/Dec in `src/lib/catalogue/messier.json` (read only) as an ICRS `Star`, observed as apparent positions with `altaz('standard')` refraction. Skyfield computed:
    - altitude and azimuth at Sidereus' peak instant;
    - altitude at the window start and end;
    - the minimum altitude over the window, scanned every minute;
    - the continuous 15° crossing times inside the dark window;
    - the true maximum inside the window.
  - **The Moon at the peak instant.** Illuminated fraction (`almanac.fraction_illuminated`), refracted altitude, and separation from the object.
- **Tolerance.** `ALTITUDE_TOLERANCE_DEG` = 1° and `TIME_TOLERANCE_MINUTES` = 5 min (parameters.ts).
- **Invariants checked for each listed object.**
  - It stays at or above the site minimum over its whole window (1-minute Skyfield scan).
  - Its window lies inside the dark window.
  - Every recommended eyepiece satisfies `majorAxisArcmin/60 ≤ 0.8 × AFOV / (telescope FL / eyepiece FL)`.
- **Ranking sanity.** Each night's top 5 was compared with published seasonal Messier lists for beginners and small telescopes, cited under each night.
- **Deviation from the PRD.** PRD Success Criterion #2 asked for a comparison against an "independent observation planner" (Telescopius). That was **replaced by the independent Skyfield recompute plus published seasonal lists**. Telescopius draws its target lists client-side with JavaScript, so the agent cannot read them.

Glossary for the tables below:
- S = Sidereus, K = Skyfield.
- Times are local (Europe/Warsaw) unless marked UTC.
- Azimuth is measured from north, clockwise.

## CPU

Deployed 2026-09-25 from `main` at the PR #20 merge commit `0795692` (Worker version `499fddc8-1627-4d7c-96eb-8b2ea9abe7fc`). Readings come from Workers Logs (`$workers.cpuTimeMs`, queried through the Cloudflare API) for the user's own signed-in `/tonight` requests. No test user was created on the hosted project (CLAUDE.md).

| Time (UTC) | Path | Status | CPU | Wall | Outcome |
|---|---|---|---|---|---|
| 16:29:15 | `/tonight` | 200 | 22 ms | 598 ms | ok |

For comparison, the other requests in the same window: `/` 6–13 ms, `/auth/signin` 25 ms, `POST /api/auth/signin` 6 ms, all `ok`.

- **Only one `/tonight` request reached Workers Logs**, although about 10 reloads were requested. It was the first `/tonight` after sign-in and after a fresh deploy, so it is likely a cold isolate. A p95 cannot be computed from one sample.
- **No `exceededCpu` / 1102** in any logged request.
- **Against the recorded trigger** (`infrastructure.md` risk register: any 1102, or warm p95 above 8 ms on Tonight → Workers Paid): 22 ms is above the 8 ms line but not proven warm, and the Free plan's 10 ms cap did not stop the request.
- Locally the engine plus ranking takes 3.5–4.4 ms and the whole page is SSR, so a warm request probably lands around 8–15 ms. That is borderline for Free.

**Decision (user, 2026-09-25):** stay on Workers Free and re-measure once Workers Logs holds 10+ real `/tonight` requests, applying the recorded trigger then (#22). Sanity verdict accepted: sane, no cuts (roadmap Open Question 12). Calibration refinements are tracked in #21.

## Night 1 — Warsaw, 2026-10-10

**Inputs**
- **Site:** 52.23 N, 21.01 E, Europe/Warsaw, elevation 0 m, Bortle 6, minimum altitude 15°.
- **Kit:** 150/750 telescope; 25 mm and 10 mm Plössls, AFOV 50°.
- **Moon:** new moon at 15:51 UTC that day, below the horizon all night (illuminated 0.002).

**Sidereus output**
- **Dark window** (Bortle 6 → −15°): 17:25:43 – 03:20:46 UTC, i.e. 19:25 CEST – 05:20 CEST.
- **Verdict:** `marginal / no-weather-data`, because no forecast was passed.
- **clearedCount:** 66.

### Top 5

| # | Object | Type | Total | Duration | Moon | Brightness | Sky | Peak (local) | Peak alt / az | Window (local) | Eyepieces (finding / detail) | Reason (lead, second) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | M31 (Andromeda Galaxy) | galaxy | 0.972 | 0.996 | 1.000 | 1.000 | 0.733 | 00:05 CEST | 79.17° / 183.63° | 19:25 – 05:20 | none-fit (widest: 25 mm) | brightness, duration |
| 2 | M34 | open-cluster | 0.940 | 0.959 | 1.000 | 0.819 | 1.000 | 02:05 CEST | 80.61° / 184.85° | 19:25 – 05:20 | 25 mm / 10 mm | duration, sky |
| 3 | M39 | open-cluster | 0.926 | 0.863 | 1.000 | 0.894 | 1.000 | 20:55 CEST | 86.26° / 191.63° | 19:25 – 05:20 | 25 mm / 10 mm | brightness, sky |
| 4 | M45 (Pleiades) | open-cluster | 0.906 | 0.733 | 1.000 | 1.000 | 1.000 | 03:05 CEST | 61.97° / 179.64° | 20:45 – 05:20 | none-fit (widest: 25 mm) | brightness, sky |
| 5 | M52 | open-cluster | 0.902 | 1.000 | 1.000 | 0.607 | 1.000 | 22:45 CEST | 80.49° / 358.83° | 19:25 – 05:20 | 25 mm / 10 mm | duration, sky |

### Skyfield comparison

- **Dark window:** Skyfield gives 17:25:43 – 03:20:47 UTC. The start differs by +0.1 s and the end by −0.1 s.

| Object | Alt S / K (Δ) | Az S / K (Δ) | K alt at window start / end | K min alt over window | K true 15° crossing | Window edge Δ | K true max in window (UTC) | Peak-time Δ | Moon alt S / K | Moon illum. S / K | Moon sep. (K) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| M31 | 79.172 / 79.175 (−0.002) | 183.634 / 183.608 (+0.026) | 43.28° / 37.15° | 37.16° | none (up all dark window) | = dark window | 22:01:43, 79.19° | +4.0 min | −49.65° / −49.94° | 0.0020 / 0.0020 | 150.5° |
| M34 | 80.606 / 80.607 (−0.001) | 184.854 / 184.825 (+0.029) | 27.80° / 55.75° | 27.80° | none | = dark window | 00:01:43, 80.63° | +4.0 min | −46.17° / −46.48° | 0.0026 / 0.0026 | 144.5° |
| M39 | 86.257 / 86.262 (−0.005) | 191.635 / 191.608 (+0.027) | 75.92° / 20.19° | 20.20° | none | = dark window | 18:50:43, 86.33° | +5.0 min | −32.00° / −32.42° | 0.0014 / 0.0014 | 123.2° |
| M45 | 61.967 / 61.968 (−0.000) | 179.643 / 179.634 (+0.008) | 15.77° / 52.09° | 15.77° | rises above 15° at 18:40:21 UTC | start **+5.4 min** | 01:06:43, 61.97° | −1.0 min | −40.35° / −40.70° | 0.0029 / 0.0029 | 142.7° |
| M52 | 80.489 / 80.486 (+0.003) | 358.833 / 358.861 (−0.028) | 62.10° / 40.47° | 40.47° | none | = dark window | 20:43:43, 80.49° | +2.0 min | −44.88° / −45.21° | 0.0017 / 0.0017 | 127.1° |

**Reading the comparison**
- **Positions** agree to within 0.005° in altitude and 0.03° in azimuth.
- **Window start for M45.** Sidereus starts M45's window 5.4 min after the true 15° crossing. The reason is that `bestWindow` works on the 10-minute sample grid (`DEFAULT_TRACK_STEP_MINUTES`): the window opens at the first sample above 15°. The error is therefore always under one step and always conservative, since the window never opens before the object is up. Here it is 0.4 min beyond the 5-min tolerance.
- **Peak time.** "Peak" is the highest sample, not the true culmination, so it can be up to 5 min off. The altitude cost is at most 0.07° (M39).
- **Moon altitude** differs by up to 0.5° while the Moon is below the horizon. This comes from the two refraction models handling negative altitudes differently. The score only uses whether the Moon is above 0°, so it has no effect.

### Invariant checks

- **M31:** PASS.
  - Minimum altitude over the window is 37.16°, and the window is inside the dark window.
  - The object is 2.964° across. The 25 mm limit is 0.8 × 1.667° = 1.333° and the 10 mm limit is 0.533°, so neither fits.
  - Sidereus returns `none-fit`, recommending no eyepiece.
- **M34:** PASS. Minimum 27.80°; inside the dark window. At 0.375° it fits both the 25 mm (1.333° limit) and the 10 mm (0.533° limit); recommended 25 / 10 mm.
- **M39:** PASS. Minimum 20.20°; inside the dark window. At 0.325° it fits both eyepieces; recommended 25 / 10 mm.
- **M45:** PASS. Minimum 15.77°; inside the dark window. At 2.500° it fits neither eyepiece; `none-fit`.
- **M52:** PASS. Minimum 40.47°; inside the dark window. At 0.165° it fits both eyepieces; recommended 25 / 10 mm.

### Published lists

**Sources**
- Astronomy.com, M. E. Bakich, "See fall's best Messier objects" (2022/2023): <https://www.astronomy.com/observing/see-falls-best-messier-objects/>. Lists M14, M21, M24, M18, M28, M69, M29, M72, M73, **M39, M52, M31**, M32, **M103**, M33, M74, M76, **M34**, M77 and **M45**.
- Tony Flanders, "Messier Guide: Early Autumn": <https://tony-flanders.com/messier-guide-early-autumn/>. Calls M39 "readily visible even in my 70mm scope under urban skies" and M52 "one of the finest open clusters in the sky: big, bright, and rich". Also covers M15 and M2 as "a fine pair of globular clusters".
- Love the Night Sky, "12 Messier Objects for beginners": <https://lovethenightsky.com/12-best-messier-objects-for-astronomy-beginners/>. Its fall picks are M31, M15 and M2.
- Astronomy.com, "Best deep-sky objects for beginners": <https://www.astronomy.com/astronomy-for-beginners/best-deep-sky-objects-for-beginners/>. Its beginner "Big 5" is M42, M31, M45, M13 and M57.

**Overlap.** All five Sidereus picks are on Astronomy.com's fall list, and M31 and M45 are also in the beginner "Big 5". None of the picks is impossible or odd.

**Well-known targets that are up but absent** (rank out of 110, with the reason from the components):
- **M13 (#26, 0.681).** Up only in the early evening: its window ends at 21:35 UTC (23:35 CEST). Duration is 0.272, because the altitude-weighted share is taken over the whole 10-hour dark window.
- **M15 (#18, 0.760), M2 (#25), M27 (#23) and M57 (#29).** Same cause: these are evening-only autumn objects, with duration between 0.36 and 0.54.
- **M42 (#22, 0.716).** Rises late and peaks at 32°; duration 0.21. This is the known limit carried over from the Phase 1 calibration.
- **M33 (#6, 0.897).** Just misses the top 5 because of the Bortle 6 sky penalty (sky 0.733). That is defensible, since M33 is a notoriously poor target from a suburban sky.

**Pattern.** The duration weight (0.35) favours high northern objects that are up all night (M34, M39, M52) over the classic early-evening showpieces (M13, M15, M57). Every pick is still a real, rewarding target.

## Night 2 — Warsaw, 2026-10-24 (bright moon, night of the DST change)

**Inputs**
- **Site and kit:** same as Night 1.
- **Moon:** full at 04:12 UTC on 26 Oct. On this night it is 97–98 % illuminated and above the horizon for the whole dark window.
- **DST:** clocks go back at 01:00 UTC on 25 Oct, inside the night.

**Sidereus output**
- **Dark window:** 16:56:47 – 03:44:12 UTC, i.e. 18:56 CEST – 04:44 CET. The DST change inside the night is handled: the window end is shown in CET.
- **Verdict:** `marginal / no-weather-data`.
- **clearedCount:** 18.

### Top 5

| # | Object | Type | Total | Duration | Moon | Brightness | Sky | Peak (local) | Peak alt / az | Window (local) | Eyepieces (finding / detail) | Reason (lead, second) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | M31 (Andromeda Galaxy) | galaxy | 0.664 | 0.953 | 0.023 | 1.000 | 0.733 | 23:06 CEST | 79.19° / 179.74° | 18:56 CEST – 04:44 CET | none-fit (widest: 25 mm) | brightness, duration |
| 2 | M34 | open-cluster | 0.654 | 0.980 | 0.020 | 0.819 | 1.000 | 01:06 CEST | 80.63° / 180.47° | 18:56 CEST – 04:44 CET | 25 mm / 10 mm | duration, sky |
| 3 | M45 (Pleiades) | open-cluster | 0.633 | 0.792 | 0.019 | 1.000 | 1.000 | 02:06 CEST | 61.95° / 177.75° | 19:46 CEST – 04:44 CET | none-fit (widest: 25 mm) | brightness, sky |
| 4 | M52 | open-cluster | 0.603 | 0.983 | 0.025 | 0.607 | 1.000 | 21:46 CEST | 80.49° / 1.63° | 18:56 CEST – 04:44 CET | 25 mm / 10 mm | duration, sky |
| 5 | M39 | open-cluster | 0.600 | 0.765 | 0.027 | 0.894 | 1.000 | 19:56 CEST | 86.33° / 181.71° | 18:56 CEST – 04:36 CET | 25 mm / 10 mm | brightness, sky |

### Skyfield comparison

- **Dark window:** Skyfield gives 16:56:47 – 03:44:13 UTC. Both ends agree to within 0.1 s.

| Object | Alt S / K (Δ) | Az S / K (Δ) | K alt at window start / end | K min alt over window | K true 15° crossing | Window edge Δ | K true max in window (UTC) | Peak-time Δ | Moon alt S / K | Moon illum. S / K | Moon sep. (K) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| M31 | 79.190 / 79.193 (−0.003) | 179.740 / 179.715 (+0.025) | 47.18° / 26.57° | 26.62° | none | = dark window | 21:06:47, 79.19° | 0.0 min | 46.18° / 46.18° | 0.9771 / 0.9771 | 33.0° |
| M34 | 80.634 / 80.635 (−0.001) | 180.472 / 180.441 (+0.031) | 31.15° / 43.96° | 31.15° | none | = dark window | 23:06:47, 80.63° | 0.0 min | 40.89° / 40.88° | 0.9797 / 0.9797 | 42.1° |
| M45 | 61.954 / 61.954 (−0.001) | 177.751 / 177.741 (+0.010) | 15.21° / 41.13° | 15.21° | rises above 15° at 17:45:18 UTC | start +1.5 min | 00:11:47, 61.97° | −5.0 min | 34.58° / 34.58° | 0.9810 / 0.9810 | 44.8° |
| M52 | 80.487 / 80.482 (+0.004) | 1.626 / 1.648 (−0.022) | 65.19° / 33.75° | 33.78° | none | = dark window | 19:48:47, 80.49° | −2.0 min | 42.78° / 42.78° | 0.9753 / 0.9753 | 55.7° |
| M39 | 86.326 / 86.332 (−0.005) | 181.708 / 181.687 (+0.022) | 79.86° / 15.03° | 15.03° | sinks below 15° at 03:37:17 UTC | end −0.5 min | 17:55:47, 86.33° | +1.0 min | 31.08° / 31.08° | 0.9726 / 0.9726 | 57.2° |

**Reading the comparison**
- **Positions** again agree to within 0.005° in altitude.
- **Moon state.** With the Moon above the horizon, its altitude agrees to within 0.002° and its illuminated fraction to within 2×10⁻⁵.
- **Window edges and peak times** are within tolerance.

### Invariant checks

- **M31:** PASS. Minimum 26.62°; inside the dark window. At 2.964° it fits neither eyepiece; `none-fit`.
- **M34:** PASS. Minimum 31.15°; inside the dark window. At 0.375° it fits both eyepieces (1.333° and 0.533° limits); recommended 25 / 10 mm.
- **M45:** PASS. Minimum 15.21°; inside the dark window. At 2.500° it fits neither eyepiece; `none-fit`.
- **M52:** PASS. Minimum 33.78°; inside the dark window. At 0.165° it fits both eyepieces; recommended 25 / 10 mm.
- **M39:** PASS. Minimum 15.03°; its window ends at 03:36:47 UTC, inside the dark window. At 0.325° it fits both eyepieces; recommended 25 / 10 mm.

### Published lists

**Sources**
- The seasonal lists from Night 1 still apply.
- Moonlight guidance. AAVSO's "Observing in moonlight" (<https://www.aavso.org/observing-moonlight>) says, in its search summary, "Moonlight is nature's own light pollution, so when moonlight is in the sky, plan on sticking to bright targets". The page itself returned HTTP 403 to the agent, so that quote comes from the search result, not the page. The consensus across the search results is the same: bright clusters survive moonlight, and low-surface-brightness galaxies do not.

**Top 5.** Four of the five are bright open clusters, which suits a moonlit night. M31 at #1 is defensible, because its bright core (vMag 3.4) survives a full moon even from Bortle 6. The disc and the M32/M110 companions will not, and the Moon is only 33° away.

**Cleared list.** The problem is lower down. Several of the 18 cleared objects are essentially invisible from Bortle 6 under a 98 % moon: M33 (#6, 0.595), M81 (#10), M32 and M110 (#12–13), and the Little Dumbbell M76 (#15). If one top-5 object were missing, M33 would take its place, which would be a poor recommendation tonight.

**Absent.** M13, M15, M57 and M27 are missing for the same duration reason as Night 1.

**Cause.** The `moon` component is `1 − illuminatedFraction × share of window with Moon up`. When the Moon is up all night, it is the same factor (≈0.02) for every object. It lowers every total by about 0.29 but **never reorders** the list. That is why the top 5 is the same set as Night 1, and why a galaxy still ranks #1 under a full moon. The formula ignores both the Moon's separation (`moonSeparationDeg` exists in `moon.ts` but is not used in the score) and how moonlight interacts with surface brightness.

## Night 3 — Bieszczady, 2027-04-06 (spring galaxy season, new moon)

**Why this date**
- It is a different season (spring) and a different sky: galaxies dominate, as opposed to autumn's clusters and Andromeda.
- The Moon is new at 23:52 UTC on 6 Apr, so the night isolates what the Bortle 3 sky and the 80 mm aperture do to the ranking, without moonlight.
- At 49°N in early April there is still a full astronomical-darkness window (the Bortle 3 threshold is −18°).

**Inputs**
- **Site:** 49.10 N, 22.65 E, Europe/Warsaw, elevation 0 m, Bortle 3, minimum altitude 15°.
- **Kit:** 80/400 telescope and a single 20 mm Plössl, AFOV 50°: 20×, true field 2.5°, exit pupil 4 mm.

**Sidereus output**
- **Dark window** (Bortle 3 → −18°): 19:01:39 – 02:01:09 UTC, i.e. 21:01 – 04:01 CEST.
- **Verdict:** `marginal / no-weather-data`.
- **clearedCount:** 82.

### Top 5

| # | Object | Type | Total | Duration | Moon | Brightness | Sky | Peak (local) | Peak alt / az | Window (local) | Eyepieces | Reason (lead, second) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | M3 | globular-cluster | 0.921 | 0.998 | 1.000 | 0.687 | 1.000 | 01:11 CEST | 69.14° / 179.29° | 21:01 – 04:01 | 20 mm (both roles) | brightness, duration |
| 2 | M81 (Bode's Galaxy) | galaxy | 0.899 | 1.000 | 1.000 | 0.621 | 0.933 | 21:31 CEST | 70.17° / 358.96° | 21:01 – 04:01 | 20 mm (both roles) | duration, brightness |
| 3 | M53 | globular-cluster | 0.875 | 0.992 | 1.000 | 0.512 | 1.000 | 00:41 CEST | 58.93° / 179.06° | 21:01 – 04:01 | 20 mm (both roles) | duration, sky |
| 4 | M13 (Hercules Globular Cluster) | globular-cluster | 0.875 | 0.814 | 1.000 | 0.761 | 1.000 | 04:01 CEST | 77.17° / 170.55° | 21:01 – 04:01 | 20 mm (both roles) | brightness, sky |
| 5 | M101 | galaxy | 0.868 | 1.000 | 1.000 | 0.499 | 0.933 | 01:31 CEST | 84.88° / 2.99° | 21:01 – 04:01 | 20 mm (both roles) | duration, moon |

### Skyfield comparison

- **Dark window:** Skyfield gives 19:01:39 – 02:01:10 UTC. The start differs by +0.2 s and the end by +0.1 s.

| Object | Alt S / K (Δ) | Az S / K (Δ) | K alt at window start / end | K min alt over window | K true 15° crossing | Window edge Δ | K true max in window (UTC) | Peak-time Δ | Moon alt S / K | Moon illum. S / K | Moon sep. (K) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| M3 | 69.142 / 69.140 (+0.002) | 179.291 / 179.277 (+0.014) | 38.32° / 51.72° | 38.32° | none | = dark window | 23:12:39, 69.14° | −1.0 min | −29.88° / −30.31° | 0.0014 / 0.0014 | 140.3° |
| M81 | 70.165 / 70.162 (+0.003) | 358.965 / 358.975 (−0.010) | 69.91° / 42.09° | 42.06° | none | = dark window | 19:27:39, 70.17° | +4.0 min | −21.40° / −21.90° | 0.0017 / 0.0017 | 97.0° |
| M53 | 58.931 / 58.928 (+0.002) | 179.060 / 179.051 (+0.010) | 35.83° / 39.68° | 35.83° | none | = dark window | 22:43:39, 58.93° | −2.0 min | −30.78° / −31.21° | 0.0014 / 0.0014 | 152.0° |
| M13 | 77.172 / 77.167 (+0.005) | 170.546 / 170.535 (+0.010) | 16.78° / 77.17° | 16.78° | none | = dark window | at window end, 77.17° | 0 min (rising all window; the 1-min scan's last point is 30 s past the end) | −14.27° / −14.82° | 0.0016 / 0.0016 | 110.2° |
| M101 | 84.877 / 84.879 (−0.002) | 2.988 / 3.045 (−0.057) | 49.10° / 66.77° | 49.10° | none | = dark window | 23:33:39, 84.89° | −2.0 min | −28.92° / −29.36° | 0.0014 / 0.0014 | 114.4° |

**Reading the comparison**
- **Positions** agree to within 0.005° in altitude.
- **M101 azimuth.** The largest azimuth difference is 0.057°, for M101 at 85° altitude. Near the zenith, azimuth magnifies tiny positional differences.
- **Windows.** Every window equals the dark window.

### Invariant checks

- **M3:** PASS. Minimum 38.32°; inside the dark window. At 0.270° it fits the 20 mm (limit 0.8 × 2.5° = 2.0°); recommended 20 mm.
- **M81:** PASS. Minimum 42.06°; inside the dark window. At 0.360° it fits the 20 mm; recommended 20 mm.
- **M53:** PASS. Minimum 35.83°; inside the dark window. At 0.150° it fits the 20 mm; recommended 20 mm.
- **M13:** PASS. Minimum 16.78°, at the window start; inside the dark window. At 0.275° it fits the 20 mm; recommended 20 mm.
- **M101:** PASS. Minimum 49.10°; inside the dark window. At 0.400° it fits the 20 mm; recommended 20 mm.

### Published lists

**Sources**
- Astronomy.com, M. E. Bakich, "Observe spring's best Messier objects" (2021/2023): <https://www.astronomy.com/observing/observe-springs-best-messier-objects/>. Its 25 objects include **M81**, M82, M97, M104, M94, **M53**, M63, M51, M83, **M3**, M5 and **M13**, plus the winter clusters M35–M38, M44 and M67.
- Love the Night Sky, "12 Messier Objects for beginners": <https://lovethenightsky.com/12-best-messier-objects-for-astronomy-beginners/>. Its spring picks are M44, M67, M65 and M66.

**Overlap.** Four of the five picks (M3, M81, M53, M13) are on Astronomy.com's spring list, and M3 and M13 are classic beginner globulars.

**M101 at #5 is the weakest pick.** It is a large face-on spiral with a very low surface brightness (23.97 mag/arcsec²). It is not on the spring list, and in an 80 mm at 20× a beginner will usually see at most a faint core glow. It ranks only because:
- it is up all night (duration 1.0);
- the Bortle 3 sky penalty is tiny (0.067);
- brightness uses integrated vMag (7.9), not surface brightness.

That is "hard", not "insane": the object is physically observable from a Bortle 3 site.

**Better objects that are absent:**
- **M44 (#12, 0.842).** The Beehive, the top beginner spring target in both lists and an ideal object for a 2.5° field. It sets, so its window ends at 00:01 UTC and duration is 0.548. Brightness is already 1.0, so its merit cannot lift the total.
- **M82 (#7) and M51 (#8).** Just below the top 5, both at about 0.85. The M81/M82 pair would fit together in the 2.5° field, but the score has no notion of pairs.
- **M65/M66 (#30/#33).** Southern, peaking at 54°; brightness about 0.35.
- **M104 (#62).** Peaks at 29°.

**Reason line.** M101's second reason is `moon` ("100% clear of moonlight"). On a moonless night every entry's moon deviation is 0, which beats the negative deviations. The statement is true, but it does not distinguish M101 from the others. This is cosmetic.

## Verdict

**Night 1 — Warsaw, 2026-10-10: SANE.**
- All five picks (M31, M34, M39, M45, M52) are real, well-placed autumn targets that appear on published fall lists.
- Positions, windows, invariants and eyepiece fits all check out.
- Classic evening-only targets (M13, M15, M57, M27) are missing because `duration` is taken over the whole dark window.

**Night 2 — Warsaw, 2026-10-24: SANE, with a moon caveat.**
- The top 5 contains nothing a beginner cannot see under a 98 % moon: four bright open clusters and M31's core.
- DST inside the night is handled correctly.
- However, the moon component does not discriminate between objects. It rescales every total by the same factor, so the order is the same as on a moonless night and galaxies stay high. Of the 18 cleared objects, M33, M81, M32, M110 and M76 are poor recommendations under a full moon; M33 is next in line after the top 5.

**Night 3 — Bieszczady, 2027-04-06 (80/400, 20 mm): SANE, with one weak pick.**
- M3, M81, M53 and M13 are on the published spring list.
- M101 at #5 is optimistic for an 80 mm.
- M44, M51 and M82, the better beginner choices, rank #7–12.

**Overall: SANE.** No listed object is impossible, below the horizon, outside the dark window, or paired with an eyepiece it does not fit.

**Positional accuracy against Skyfield/DE421 is far inside tolerance:**
- object altitude: at most 0.005°;
- azimuth: at most 0.06°;
- Moon altitude while up: at most 0.002°;
- illuminated fraction: at most 2×10⁻⁵;
- dark window: at most 0.2 s.

**The only tolerance breach is timing, caused by the grid.** M45's window on Night 1 opens 5.4 min after its true 15° crossing, against a 5-min tolerance. This is inherent to `bestWindow` on the 10-minute grid: the error is always under one step, and always on the safe side.

**Causes and suspected tunables** (names as in `parameters.ts`, plus the formulas in `score.ts`):

1. **Evening-only showpieces are undervalued.** Tunables: `SCORE_WEIGHTS.duration` (0.35) and `WELL_PLACED_ALTITUDE_DEG`. The `duration` definition is the underlying cause: it is an altitude-weighted share of the whole dark window, so a 2–4 hour evening pass of M13, M15 or M57 scores below an all-night circumpolar cluster. Candidate fixes are to measure duration against a fixed useful span (e.g. saturating at N hours) rather than the whole window, or to lower `SCORE_WEIGHTS.duration`.
2. **Bright moonlight never reorders the list.** Tunables: `SCORE_WEIGHTS.moon` (0.30) and the moon formula. The formula takes illumination × the share of the window with the Moon up, with no separation and no surface-brightness interaction. Candidates are to weight by `moonSeparationDeg`, or to penalise low-surface-brightness types more under moonlight, by analogy with `bortlePenaltyForBortle`.
3. **Low-surface-brightness galaxies rank high at dark sites and in small apertures** (M101 in an 80 mm). Tunables: `bortlePenaltyForBortle` (0.067 at Bortle 3), `SURFACE_BRIGHTNESS_PENALTY_THRESHOLD` (21) and `BRIGHTNESS_RAMP_MAG`. The sky penalty is flat regardless of how far below the threshold an object's surface brightness is, and it ignores aperture.
4. **Grid quantisation of window edges and peak times** (up to 10 min and 5 min respectively). Tunable: `DEFAULT_TRACK_STEP_MINUTES`. Moving to 5 min would roughly double the ranking's CPU cost. Interpolating the 15° crossing at the window edges would be cheaper. As it stands the error is always conservative, so this is optional.

Items 1–3 are calibration refinements, not sanity failures. None of them puts an unobservable object in the top 5.
