# Tonight Verdict and Ranking — Plan Brief

> Full plan: `context/changes/tonight-verdict-and-ranking/plan.md`

## What & Why

Roadmap slice S-02, the north star: a signed-in user opens `/tonight` and learns whether tonight is worth setting up for (go / marginal / no-go, with its reason and dark window) and, if it is, which Messier objects to point at, when, where, and with which two of their own eyepieces. The PRD's week-2 cut checkpoint depends on whether this top 5 is sane, so the slice ends with a recorded sanity check.

## Starting Point

F-01 provides the verified sky geometry (dark window, moon track, object tracks for all 110 objects in about 5 ms warm, `bestWindow`), and S-01 provides sites, telescopes and eyepieces with a store. There is no score, verdict, forecast, eyepiece maths or Tonight page yet, and `parameters.ts` has only the darkness and minimum-altitude tunables.

## Desired End State

`/tonight` is gated and linked from the Topbar. It renders the verdict and dark window in the site's time zone. On go or marginal nights it adds "N objects cleared the bar" and up to 5 cards: window, "best 23:50, S 62°", constellation, finding and detail eyepieces, and a reason line leading with what sets the object apart. The page never blanks: with no forecast it shows "marginal — no weather data" plus the ranking. The app is deployed with a KV forecast cache, its CPU time is measured, and `checkpoint.md` answers the cut checkpoint.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Workers CPU limit | Stay on Free, measure `cpuTime`, apply the recorded Paid trigger | The engine run is 5–18 ms locally, borderline for Free; the trigger already exists | Plan |
| Forecast cache | Workers KV `FORECAST_CACHE`, key per site id, 1 h fresh, 7-day stale copy | Matches tech-stack and infrastructure decisions; no migration; no coordinates in keys | Plan |
| No forecast at all | Verdict "marginal — no weather data", ranking still shown | Never a confident go, never blank; S-04 refines the wording | Plan |
| Several sites or telescopes | Oldest of each, named on the page | Deterministic, FR-019-compatible, no selector until S-05/S-08 | Plan |
| Duration component | Altitude-weighted share of the dark window (0 at the site minimum, 1 at 40°) | Raw sample share saturated for circumpolar objects (calibration at check 1.6) | Plan + Phase 1 calibration |
| Moon component | 1 − illumination × share of the object's window with the Moon up | User's pick: simple; separation ignored | Plan |
| Brightness component | limit = naked-eye limit(Bortle) + 5·log10(D/7); ramp (limit − vMag)/8; fainter than the limit never ranks | Standard rule of thumb; the 4-mag ramp saturated (calibration at check 1.6) | Plan + Phase 1 calibration |
| Low-interest objects | Double stars and asterisms lose 0.15 | M40 ranked 5th on the first run | Phase 1 calibration |
| Eyepiece fit | Major axis ≤ 0.8 × true field; finding = widest field ≤ 5.5 mm pupil; detail = highest power ≥ 0.7 mm pupil; nothing fits → no pair, advice "use your widest and sweep across it" | Framing margin; keeps the PRD fit invariant while still guiding M31/M45 | Plan + plan review F2 |
| Reason line | Lead with the largest weighted lead over the list mean, then the runner-up | FR-015: the five lines differ by construction | Plan |
| "At that time" | Peak inside the best window | `bestWindow` already returns it; the best moment to look | Plan |
| Forecast window | Open-Meteo with `past_days=1` + `forecast_days=3` | Without it, a night in progress after UTC midnight loses its evening hours | Plan review F1 |
| Short dark window | Required clear run = min(2 h or 1 h, overlapping hours) | A short clear summer night can still be "go" | Plan |
| Cut checkpoint | Agent runs it: independent Skyfield recompute + invariant checks + published seasonal lists, recorded in `checkpoint.md` | Telescopius cannot be read by the agent; the user delegated the check | Plan |

## Scope

**In scope:**
- All S-02 tunables in `parameters.ts`
- Pure score, ranking, eyepiece pairing and reason selection
- Pure verdict
- Open-Meteo client with a KV cache
- `/tonight` page with minimal empty states, a Topbar link and attribution
- Smoke steps
- Deploy with the KV namespace, CPU measurement, 3-night checkpoint

**Out of scope:**
- Log penalty (S-06)
- Telescope selector and full empty states (S-08)
- 7 nights and site switching (S-05)
- No-go and no-darkness explanations, forecast age (S-04)
- Red mode (S-10)
- Redirecting sign-in to Tonight
- Calibrating the tunables
- CI deploy (F-02)

## Architecture / Approach

The page loads the gear (Supabase), then `getForecast`: the KV cache, then Open-Meteo with the fetch function passed in, with a fallback to the stale copy or `null`. `buildTonight` in `src/lib/tonight/` calls the pure engine: `observingNightDateFor`, `darkWindow`, `verdict`, then `rankObjects` on go or marginal. `rankObjects` computes `objectTracks` and `moonTrack` once on a shared grid, then `scoreObject` and `pairEyepieces` per object. `format.ts` renders times, compass points and reason lines. The engine stays pure. I/O lives only in `src/lib/forecast/` and the page.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Scoring core | Tunables; score, ranking, eyepiece pair, reason selection; determinism and timing tests | Formulas give a silly top 5 (caught in Phase 4) |
| 2. Verdict & forecast | Pure verdict; Open-Meteo client; KV cache with fallback; real KV namespace, `wrangler types`, privacy lint scope | Needs Cloudflare auth for the namespace |
| 3. Tonight page | Gated `/tonight`, cards, empty states, nav link, attribution, smoke steps | Smoke in CI depends on the Open-Meteo network (degrades to no-weather-data, still 200) |
| 4. Deploy & checkpoint | Deploy, CPU reading, `checkpoint.md`, roadmap question 12 answered | Free-plan 1102 errors |

**Prerequisites:** F-01 and S-01 are done (the F-01 archive PR #20 is awaiting your merge; `feat/s-02` already contains it). Cloudflare auth is needed in Phase 2 (namespace) and Phase 4 (deploy).
**Estimated effort:** about 3–4 sessions across 4 phases.

## Open Risks & Assumptions

- **Big objects get advice rather than a pair.** M31 (190′) and M45 (110′) fit no eyepiece in a typical beginner kit (a 25 mm Plössl on a 150/750 gives about 100′), so their card says "Larger than any field in your kit; use your widest (25 mm) and sweep across it" rather than a finding and detail pair. This keeps the PRD invariant and was accepted in plan review (F2, Fix A).
- **The sky component is weak.** The Bortle penalty (at most 0.40) is read as reducing the 0.10-weight component, so it moves a total score by at most 0.04. If that proves too weak, it is a tuning decision for the checkpoint to surface.
- **Moon ranking will be coarse.** Separation is ignored, so objects near a bright moon are not singled out; the reason line will rarely lead with the moon.
- **Engine accuracy rests partly on spot checks.** Moon and object altitude were spot-checked, not formally measured (follow-up #19). The Phase 4 Skyfield recompute partly covers this.
- **The PRD's success criterion changes.** PRD Success Criterion #2 names an "independent observation planner"; the checkpoint uses an independent recompute plus published lists instead, and records that change.

## Success Criteria (Summary)

- A user with a site and telescope sees tonight's verdict, dark window and a sane, explained top 5 with an eyepiece pair from their own kit, all in the site's time zone.
- The page never errors on forecast outage or missing gear, and the ranking is deterministic and computed under a second.
- `checkpoint.md` gives a recorded sane / not-sane answer for three nights, and the roadmap reflects it.
