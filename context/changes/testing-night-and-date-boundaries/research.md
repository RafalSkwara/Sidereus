---
date: 2026-10-08T14:35:29+02:00
researcher: Claude (Opus 5.5) with three Sonnet read-only workers
git_commit: 8a11634
branch: feat/testing-night-and-date-boundaries
repository: Sidereus
topic: "Ground rollout Phase 2 of context/foundation/test-plan.md: night and date boundaries (Risk #2)"
tags: [research, testing, engine, night, dst, tonight, log, sky-checks]
status: complete
last_updated: 2026-10-08
last_updated_by: Claude (Opus 5.5)
---

# Research: Night and date boundaries (test rollout Phase 2, Risk #2)

**Date**: 2026-10-08T14:35:29+02:00
**Researcher**: Claude (Opus 5.5), with three read-only Sonnet workers (night selection, consumers, existing coverage)
**Git Commit**: 8a11634 (no product code changed since `main` 27c76ad; the commit only adds this change's `change.md`)
**Branch**: feat/testing-night-and-date-boundaries
**Repository**: Sidereus

## Research Question

Ground Risk #2 of `context/foundation/test-plan.md` §2: the verdict, Session plan or log prefill lands on the wrong night or shows the wrong time. The edges are the "tonight" rollover, the 25-hour DST night of 24/25 Oct 2026, ordering across midnight, a month boundary, and the site's time zone against the server's.

The response guidance to verify: for a fixed instant and site, the same "tonight", dark window and plan order come out whatever zone the runner is in, across the 25-hour night, the minutes either side of the rollover and a 31 Oct / 1 Nov night. Challenge "pinned UTC dates in existing tests cover the edges". Avoid tests that pass only in the runner's zone, and expected nights derived with the helper under test.

## Summary

1. **No production path that we inspected reads the runner's (server's) time zone.** There are three pieces of evidence:
   - A grep of `src/`, `tests/` and `scripts/` for local-zone `Date` getters and setters, `toLocale*String`, `getTimezoneOffset` and local `new Date(y, m, d)` found no hits outside dev-only `design.astro` literals (worker sweep, about 260 `new Date`/`Date.now`/`timeZone` hits triaged).
   - A probe of `observingNight`, `darkWindow` at −18° and −6°, a per-minute `tonightDateFor` scan and `sevenNightOutlook` for Warsaw and London over 23–25 Oct 2026 gave byte-identical output under 4 runner zones (UTC, America/Los_Angeles, Pacific/Kiritimati, Asia/Kolkata).
   - The full unit suite (78 files, 882 passed, 1 skipped, 6 todo) passes under 6 runner zones (UTC, Europe/Warsaw, America/Los_Angeles, Pacific/Auckland, Asia/Kolkata, Pacific/Kiritimati).

   So "whatever zone the runner is in" is a **latent regression risk, not a live bug**. Nothing pins it except `purity.test.ts`, which covers `src/lib/engine/` and `src/lib/moon-disc/` only and has a gap (see 5).
2. **"Pinned UTC dates in existing tests cover the edges" is partly true.** It holds for Europe/Warsaw's autumn change in `observingNight`, `observingNightDateFor`, the outlook strip and the formatters. It does **not** hold for:
   - the production −6° civil-dawn rollover at its boundary: `sun.test.ts:159-186` tests `tonightDateFor` at **−18°** only, against the engine's own `darkEnd`;
   - the spring 23-hour night (duration only, `night.test.ts:24`);
   - any non-Warsaw site through `darkWindow` or `tonightDateFor`;
   - a month-end or year-end *night* (only `addDays` and `nightsBefore` are tested across month ends);
   - the log form's manual default night;
   - Session plan row order and labels on the DST night (only the ticks are pinned).
3. **The 31 Oct / 1 Nov 2026 night is itself a 25-hour night in US zones.** US clocks fall back at 02:00 on Sunday 1 Nov 2026. `observingNight("2026-10-31", z)` measures 25 h for America/Los_Angeles and America/New_York and 24 h for Europe/Warsaw (probe below). One US site therefore covers a month boundary and a DST night at once, a week after the European one.
4. **Every consumer we traced keys on the engine's site-zone date** (`tonightDateFor` / `observingNightDateFor`) and orders by epoch ms. Two real, small boundary hazards exist. Neither depends on the runner zone:
   - **Log manual-entry default.** `src/pages/log/new.astro:70` defaults to `observingNightDateFor(now, site.timeZone)`, the plain noon rule, while Tonight and the server bound use the civil-dawn rollover. Between civil dawn and local noon the default is the night just ended. That is intended (comment at `new.astro:65-67`) and has no test.
   - **`maxNight` with several sites.** `maxNight` is the maximum over all of the user's sites (`new.astro:68`), but the server checks the chosen site (`src/lib/observations/store.ts:116`). A user with sites in far-apart zones can pick a night the server rejects with `NIGHT_IN_FUTURE`. The server stays correct; the user gets an error redirect. Untested.
5. **Purity-guard gap.** `purity.test.ts:31-33` flags `Intl.DateTimeFormat()` and `Intl.DateTimeFormat("xx")` but not `new Intl.DateTimeFormat("en-US", { hour: … })` with options and no `timeZone`. Local getters (`getHours`, `getDate`, …) are not on the list, and the guard does not scan `src/lib/tonight/`, `src/lib/forecast/`, `src/lib/observations/`, `src/lib/sky-checks/` or `src/pages/log/`, where Risk #2's consumers live.
6. **Cheapest useful layer: unit, as the plan says.** Node 24.21 honours a runtime `process.env.TZ` change: `Date` getters and the default `Intl` zone switch immediately (probe below). A table-driven Vitest test can therefore run the same assertions under several runner zones in one process, with no CI matrix. Expected nights must be hand-written calendar literals. Rollover instants must be bracketed by independent references (the Stellarium fixture's sunrise and the −18° end), not by the engine's own `darkWindow(...).end`.

## Detailed Findings

### Which night is "tonight"

- `tonightDateFor` (`src/lib/engine/sun.ts:101-105`) works in three steps:
  - It takes the noon-rule date `observingNightDateFor(instant, site.timeZone)`.
  - It computes that night's `darkWindow` at the threshold it is given.
  - It returns the next date when `window.kind === "window" && instant.getTime() >= window.end.getTime()`, else the noon-rule date.
- Production passes `TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG = -6` (`parameters.ts:229`). Callers on this path are `src/lib/tonight/tonight-date.ts:13` (`tonightDateForSite`) and `build.ts` (`tonightDateFor` at about 628-631).
- `observingNightDateFor` (`src/lib/engine/night.ts:112-120`) reads the site wall clock with `wallClockAsUtcMs` (`Intl.DateTimeFormat` with an explicit `timeZone`, `night.ts:58-78`) and takes the previous date when the wall hour is below 12.
- `observingNight` (`night.ts:100-104`) spans `localNoon(date)` to `localNoon(addDays(date, 1))`. `addDays` is UTC calendar arithmetic (`night.ts:43-51`). On the 25-hour night it runs Warsaw 2026-10-24T10:00Z to 2026-10-25T11:00Z, pinned by `night.test.ts:17`.
- **The flip at civil dawn.** The comparison is `>=` on epoch ms against `window.end`, which `SearchAltitude` finds with a 1 s bisection fallback (`sun.ts:86`, `:107-132`).
  - Probe at −6°: Warsaw civil dawn on 25 Oct is 2026-10-25T04:43:30Z and the per-minute scan flips at 04:44Z. London is 06:07:07Z and flips at 06:08Z.
  - There is no second flip at local noon: after dawn the date is already the evening ahead.
- **Degenerate nights.** With `window.kind === "none"` (Tromsø at midsummer), or `end` clamped to `night.end` (`sun.ts:82-84`), the noon rule decides instead. The noon-rule fallback is pinned at −18° by `sun.test.ts:184-187`.

### Dark window, outlook and forecast on the 25-hour night

- `darkWindow` (`sun.ts:52-91`) works only in absolute instants:
  - `SearchHourAngle` from `night.start` finds the lower culmination;
  - `SearchAltitude` uses 1-day search limits;
  - nothing assumes a 24-hour span.
- Probe values on the 24 Oct night:

  | Site | Threshold | Window |
  | --- | --- | --- |
  | Warsaw | −18° | 17:16:22Z to 03:24:35Z |
  | London | −18° | 18:40:29Z to 04:49:28Z |
  | Warsaw | −6° | 15:57:40Z to 04:43:30Z |

  The Stellarium fixture (`fixtures/stellarium/warsaw-2026-10-24.json`) gives the Warsaw −18° window as 19:16 CEST to 04:24 CET, which matches.
- `sevenNightOutlook` (`outlook.ts:170-192`) builds nights with `addDays(date, index - 1)` and gives each its own `observingNight`. `nextNightNotNoGo` and `darkWindowReturn` use the same pattern (`outlook.ts:51`, `:108`). From 2026-10-22 the probe gives 7 consecutive dates; `outlook.test.ts:193`, `:233` pins 21–27 Oct for Warsaw.
- Forecast hours are UTC instants end to end:
  - Open-Meteo is called with `timezone=GMT&timeformat=unixtime` (`src/lib/forecast/open-meteo.ts:53-54`).
  - `verdict.ts:30-36` slots dark windows by whole UTC hours (`Math.floor(ms / HOUR_MS) * HOUR_MS`), so a 25-hour night just has more slots.
- The two `DAY_MS` constants (`moon.ts:92`, `format.ts:31`) are only a search limit and "N days ago" age text. Neither is a night length.

### Consumers

| Consumer | Decisive path | Site-zone safe? | Boundary hazard | Pinned by |
| --- | --- | --- | --- | --- |
| Verdict / Tonight date | `build.ts` about 628-631: `tonightDateFor(..., TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG)`; `next` = `addDays(tonightDate, 1)` | yes | none found | `build.test.ts:897-945` (Warsaw 03:45Z → 10 Oct, 05:00Z → 11 Oct; "the old threshold turned it red") |
| Session plan order | `session-plan.ts` sorts `a.bestAt - b.bestAt` (epoch ms, stable); positions are fractions of the sunset-to-sunrise axis in ms; labels come from `formatTime(date, timeZone)` (`format.ts:197-203`, `hourCycle: "h23"`); ticks are quarter-hours whose label ends in `:00` (`build.ts:1082`) | yes | On 24/25 Oct two ticks and possibly two best times read "02:xx" (the clock's own repeat). `build.test.ts:1549-1566` pins the two "02:00" ticks as intended. `SessionTimeline.astro` thins labels by index, so which duplicate is hidden is arbitrary (cosmetic). | `session-plan.test.ts:14-28` (order across midnight on a hand-made axis), `build.test.ts:1536-1566` (Kolkata ticks, Madrid DST ticks). Row order and labels on the DST night are unpinned. |
| "Mark observed" prefill | `logHref` (`src/lib/tonight/load.ts:186-196`) sets `night: tonight.date`, a date string, never a time | yes | none found | `build.test.ts:897-945` (Jupiter's link carries `night=2026-10-10` at 03:45Z) |
| Log manual default | `src/pages/log/new.astro:70`: `observingNightDateFor(now, site.timeZone)` (noon rule) | yes | Between civil dawn and local noon the default is the night just ended, one day before Tonight's date. Intended (`new.astro:65-67`). | none |
| Log upper bound | server: `input.night > tonightDateForSite(site, now)` (`observations/store.ts:116`, same at `:204`); deleted site: `latestNightBound` (`store.ts:75-93`, `Etc/GMT-14` fallback); page hint: `maxNight` = max over all sites (`new.astro:68`) | yes | The `maxNight` hint can be looser than the chosen site's server bound with sites in far-apart zones, which shows an error redirect. The bound itself is never zero-width. | `store.test.ts:11-18` (Warsaw vs Honolulu, `latestNightBound`); `tests/db/observations.test.ts:261-288` (local Supabase) |
| Sky check night key | `recordableVerdict` (`src/lib/sky-checks/record.ts:17-27`) stores `night: view.date` from the app; the RPC (`supabase/migrations/20261003120000_sky_checks.sql:79-114`) compares only `now() < dark_start` (timestamptz) and has no `current_date`, `::date` or `AT TIME ZONE` | yes | none found | `pending.test.ts:18-62` (month and year stepping, 30 Sep → 1 Oct), `record.test.ts`, `tests/db/sky-checks.test.ts` |
| "Newest open night of the last two" | `pending.ts`: `nightsBefore(tonightDate, 2) <= night < tonightDate`; DB read window `openSkyChecksSince(now)` = UTC date − 4 days (`pending.ts:21, 26`) | yes | The 4-day read covers UTC−12 to UTC+14 by arithmetic (a worker's inference, not tested) | `pending.test.ts` |
| Seven-night strip labels | `formatShortNightDate` on `Date.UTC` midnight with `timeZone: "UTC"` (`format.ts:162-178`, `:229-235`); times via `darkSpanText(..., timeZone)` | yes | none found | `build.test.ts:563-588` (21–27 Oct labels, 24 Oct CEST start and CET end) |
| `?night=next` offline copy | `build.ts`: `date = addDays(tonightDate, 1)`; `validUntil` = −6° window end (`build.ts:1146`), the same instant as the rollover since both constants are −6 (`parameters.ts:221`, `:229`) | yes | `needsNextCopy` (`copies.ts:321-324`, 1 h `NEXT_REFRESH_MS`) can keep a next copy stored minutes before dawn whose date equals tonight's just after. Read from code, unverified; degrades to a stale notice. | `copies.test.ts:325-352` (`validUntil` ± 1 ms), `build.test.ts:1573` |

### Existing coverage against the guidance

| Edge | Covered? | Where | Expectation independent of the code under test? |
| --- | --- | --- | --- |
| 25-hour night, Warsaw, `observingNight` and `observingNightDateFor` | yes | `night.test.ts:17`, `:63` (6 instants incl. both 02:30 passes), `:77` (30-min sweep, 23–27 Oct) | yes, hand-written literals; the sweep is an invariant |
| 25-hour night, Warsaw, sun events | yes | `sun.test.ts:105-157` vs the Stellarium fixture (±5 min) | yes, the only external oracle (sun section only; moon and objects `pending`) |
| 25-hour night, outlook and formatting | yes | `outlook.test.ts:193`, `:233`; `format.test.ts:15-23`; `build.test.ts:563-588` | partly: window values come from the engine; the dates in `outlook.test.ts:233` are compared to `windowOf(...)` (circular), while the +2/+1 offsets in `build.test.ts` are hand-written |
| 25-hour night, London | no | — | — |
| 23-hour spring night (29 Mar 2026) | duration only | `night.test.ts:24` | yes; no dark window, `tonightDateFor` or date sweep |
| −6° civil-dawn rollover at the boundary | no | `sun.test.ts:159-186` uses −18 and the engine's own `darkEnd` (circular); `build.test.ts:897-945` brackets loosely with 03:45Z / 05:00Z / 07:00 CEST literals | the boundary instant is engine-derived |
| Month or year boundary *night* | no | `night.test.ts:36` (`addDays`), `pending.test.ts:20-22` (`nightsBefore`), `format.test.ts:36`; `build.test.ts:1127` builds 31 Oct but asserts the Moon card | helpers only |
| US 31 Oct / 1 Nov 25-hour night | no | — | — |
| Far zones (Auckland, LA, Kolkata, date line) through `darkWindow` / `tonightDateFor` | no | `night.test.ts:29-35`, `:86` (`localNoon`, `observingNightDateFor` only); `build.test.ts:1536` (Kolkata tick labels) | — |
| Polar summer and polar night | yes | `sun.test.ts:41`, `:68`, `:184`; `build.test.ts:1423`, `:1569`, `:1632` | Tromsø has a Stellarium fixture; the rest are hand-written |
| Runner-zone independence | by accident of CI only | none sets `TZ`, `setSystemTime` or fake timers; CI `ubuntu-latest` has no `TZ` set (UTC by GitHub's default, not verified in a run); the dev machine is Europe/Warsaw | — |

Most site fixtures are Warsaw. On a Warsaw dev machine a local-getter bug would match the site zone and pass locally; only CI's UTC runner would catch it, and only when the expected value differs between UTC and Warsaw. A test with a site in UTC (or any zone equal to CI's) would mask such a bug in CI too. A runner-zone table in the test removes that dependence.

### Probes run (read-only on the repo)

- **Runner zone switch:** under Node v24.21.0, setting `process.env.TZ` at runtime to UTC, then Pacific/Kiritimati, then America/Los_Angeles changed `new Date("2026-10-24T23:30:00Z").getHours()` to 23, 13 and 16, and `Intl.DateTimeFormat().resolvedOptions().timeZone` to match. So one test file can loop runner zones in-process. Restore the original value afterwards. Vitest workers are separate processes, so other files are unaffected.
- **Night lengths for 2026-10-31:**

  | Zone | Night | Length |
  | --- | --- | --- |
  | America/Los_Angeles | 19:00Z to 20:00Z next day | 25 h |
  | America/New_York | 16:00Z to 17:00Z next day | 25 h |
  | Europe/Warsaw | | 24 h |
  | Pacific/Auckland | | 24 h (NZ moved its clocks forward on 27 Sep 2026) |

- **Full suite under 6 runner zones** and **engine output under 4 runner zones**: see Summary 1. The worker's engine probe lived in this session's scratchpad, not the repo.

## Code References

- `src/lib/engine/sun.ts:101-105`: `tonightDateFor`, the rollover rule.
- `src/lib/engine/sun.ts:52-91`, `:107-132`: `darkWindow`, clamps, bisection.
- `src/lib/engine/night.ts:43-51`, `:58-78`, `:85-94`, `:100-104`, `:112-120`: `addDays`, `wallClockAsUtcMs`, `localNoon`, `observingNight`, `observingNightDateFor`.
- `src/lib/engine/parameters.ts:221`, `:229`: `PLANET_WINDOW_SUN_ALTITUDE_DEG` and `TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG`, both −6.
- `src/lib/tonight/tonight-date.ts:9-14`: `tonightDateForSite`.
- `src/lib/engine/outlook.ts:51`, `:108`, `:170-192`: outlook night generation.
- `src/lib/tonight/session-plan.ts` (sort by `bestAt`, ms axis), `src/lib/tonight/build.ts:1082` (`:00` ticks), `:1146` (`validUntil`).
- `src/lib/tonight/format.ts:162-178`, `:197-203`, `:229-235`: calendar-date (UTC) and site-zone time formatters.
- `src/lib/tonight/load.ts:186-196`: `logHref`.
- `src/pages/log/new.astro:64-70`: `maxNight` and the manual default night.
- `src/lib/observations/store.ts:75-93`, `:116`, `:204`: `latestNightBound`, the server's night bound.
- `src/lib/sky-checks/record.ts:17-27`, `src/lib/sky-checks/pending.ts:21`, `:26`; `supabase/migrations/20261003120000_sky_checks.sql:79-114`.
- `src/lib/offline/copies.ts:296-324`: `chooseCopy`, `needsNextCopy`.
- `src/lib/forecast/open-meteo.ts:53-56`, `src/lib/engine/verdict.ts:30-36`: UTC hour series and slots.
- `src/lib/engine/purity.test.ts:25-36`: the forbidden-API list and its gap.
- Tests: `src/lib/engine/night.test.ts:17-92`, `sun.test.ts:41-187`, `outlook.test.ts:193-240`, `src/lib/tonight/build.test.ts:563-588`, `:897-945`, `:1127`, `:1536-1566`, `session-plan.test.ts:14-100`, `format.test.ts:15-40`, `src/lib/observations/store.test.ts:11-18`, `src/lib/sky-checks/pending.test.ts:18-62`, `src/lib/offline/copies.test.ts:325-352`.
- Fixture: `src/lib/engine/fixtures/stellarium/warsaw-2026-10-24.json` (sunset 17:22 CEST, sunrise 06:19 CET, −18° 19:16 CEST to 04:24 CET; no −6° value).

## Architecture Insights

- One rule decides the date for every consumer: the site zone through `Intl`, with UTC calendar arithmetic. Every "which night" decision goes through `observingNightDateFor` or `tonightDateFor`, and everything else orders and positions by epoch ms. Only labels are formatted in the site zone, and calendar dates are formatted in UTC from a `Date.UTC` midnight. A test aimed at the decision functions therefore covers every consumer's date.
- The rollover and the offline copy's hand-over share one instant by construction: both constants are −6°. A test that asserts they agree would catch a future retune of only one of them.
- **Independent oracles available today:**
  - hand-written calendar dates;
  - the Stellarium Warsaw 24 Oct fixture (sunset, sunrise, −18° window);
  - the Tromsø fixture.
  
  No fixture has a −6° instant. A rollover test can bracket civil dawn independently: after the fixture's −18° end (04:24 CET = 03:24Z) and before its sunrise (06:19 CET = 05:19Z) the sun is between −18° and 0°. So 03:30Z must still be "2026-10-24", because the sun is near −17° and below −6°; a worker's probe puts civil dawn at 04:43Z. The fixture's sunrise, 05:19Z, must already be "2026-10-25". An exact ±1-minute check needs either a newly captured −6° value or acceptance that the boundary itself is engine-derived.

## Historical Context (from prior changes)

- `context/archive/2026-09-30-planets-on-tonight/reviews/impl-review-phase-3.md:50-67` (F2): at that time the rollover came at the end of the −18° dark window, so morning planets and their log link landed on the next night. It was fixed with the −6° `TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG`, pinned by `build.test.ts:897-945`. That history is supported by the current code.
- `context/archive/2026-09-27-seven-night-site-planner/` (plan, plan review F7, impl review): night 1 is the `tonightDateFor` night, and all times are in the site zone across 24/25 Oct. Plan review F7 corrected a wrong DST window-length assertion. Supported: pinned by `build.test.ts:563-588`.
- `context/archive/2026-10-03-verdict-check/` (`plan.md:286`, `:431`): "last night" moves only after civil dawn, overwrites stop at `dark_start`, and the date helper is tested across a month boundary. Supported (`pending.test.ts:57-61`), though only the helper, not a whole night.
- `context/archive/2026-10-05-session-plan-timeline/reviews/impl-review.md:75-90` (F5) added the Kolkata, Madrid-DST and 87° N build tests. Supported.
- `context/archive/2026-09-26-log-observation-from-ranking/reviews/plan-review.md:60` warned that the form's `maxNight` follows one site's zone. The current code takes the max over all sites (`new.astro:68`), so the hint is now looser rather than tighter than the server. That history is partly superseded, and the multi-site mismatch remains.
- No archived change records a 31 Oct / 1 Nov bug. The test plan cites it as a boundary to prove, not as a past failure.

## Related Research

- `context/archive/2026-10-07-testing-forecast-honesty/research.md`: test rollout Phase 1, the same test-plan workflow.
- `context/archive/2026-10-03-verdict-check/research.md`: sky-check night key and the overwrite rule.

## Corrections to the test-plan guidance (for the post-research backport check)

1. **Runner zone.** The guidance makes runner-zone independence the main proof. Research found no runner-zone read in production (Summary 1), so that proof is a cheap regression guard: run a table of runner zones in-process via `process.env.TZ`, optionally with a widened purity guard. The **site-zone edges are the real coverage gap**: the −6° rollover boundary, the spring night, non-Warsaw sites, a month-end night, the US 25-hour 31 Oct night, and the log's manual default and multi-site `maxNight`.
2. **"Challenge pinned UTC dates cover the edges."** This is confirmed as only partly true (Summary 2). The challenge stands.
3. **Hot-spot evidence.** `src/lib/tonight` holds consumers. The decisions live in `src/lib/engine/night.ts` and `sun.ts`, and two of the hazards live in `src/pages/log/new.astro` and `src/lib/observations/store.ts`, which the hot-spot list did not name.
4. **The 31 Oct / 1 Nov night.** For a European site it is an ordinary 24-hour night that only crosses a month. For a US site it is both a month boundary and a 25-hour night. The guidance should name a US zone for it.

## Open Questions

- Should Phase 2 capture a −6° civil-dawn value for Warsaw on 24/25 Oct (Stellarium or USNO) to make the rollover boundary independently exact? Or is bracketing between the fixture's −18° end and sunrise enough? This is a plan decision.
- Should the purity guard be widened (options-object `Intl.DateTimeFormat` without `timeZone`, local getters) and extended to `src/lib/tonight/`, `src/lib/observations/`, `src/lib/sky-checks/` and `src/pages/log/`? Or is the in-process runner-zone table enough? This is a plan decision.
- Should the `maxNight` multi-site mismatch and the `needsNextCopy` dawn window be fixed, or only documented by tests? Both are small and server-safe, and fixing them is product scope beyond a test rollout.
- CI's UTC zone was inferred from GitHub's `ubuntu-latest` default; no run was checked.
