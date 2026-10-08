---
date: 2026-10-07T21:58:53+0200
researcher: Claude (Opus 5.5) with three Sonnet read-only workers
git_commit: f1bb8bbdd170040f922e38d77e3e33bb15ac4c95
branch: test/forecast-honesty
repository: RafalSkwara/Sidereus
topic: "Ground rollout Phase 1 (Forecast honesty, Risk #1) of context/foundation/test-plan.md"
tags: [research, test-plan, forecast, verdict, tonight, open-meteo, kv-cache]
status: complete
last_updated: 2026-10-07
last_updated_by: Claude (Opus 5.5)
---

# Research: Ground rollout Phase 1 "Forecast honesty" (Risk #1)

**Date**: 2026-10-07T21:58:53+0200
**Researcher**: Claude (Opus 5.5), with three Sonnet read-only workers (forecast loader and cache; per-night consumers and UI states; PRD and archive decisions)
**Git Commit**: f1bb8bb (main after PR #133)
**Branch**: test/forecast-honesty
**Repository**: RafalSkwara/Sidereus

## Research Question

Ground Risk #1 of `context/foundation/test-plan.md`: "Tonight shows a confident 'Clear' sky when the forecast is partial, stale or missing." Verify, not accept, the response guidance:

- Prove: with a truncated, stale, partly missing or absent forecast the sky reads marginal, "no weather data" or "last forecast, N hours old", never "Clear"; moon, twilight and altitude results stay usable; no error page.
- Challenge "no cloud data for an hour means no cloud" and "a 200 from the provider means a usable series".
- Avoid complete-series-only tests, expected verdicts copied from the verdict code, and mocking the verdict to test the loader.
- Ground the forecast fetch, the KV cache and its age, how the series is cut to the dark window per night, and which of nights 1-3 can lack hours.

Nothing was run (no vitest, no build). Coverage arithmetic in "Which nights can lack hours" is derived by hand from the request parameters and is flagged as such.

## Summary

The shipped code already defends the core of Risk #1, and most of it has engine-level unit tests. The phase's value is in the **layers between** those tests and in a few **unprotected inputs**, not in re-testing `verdict()`.

1. **No path found that turns a partial, stale or missing forecast into level `go`.** On the inspected path (`getForecast` → `buildTonight` → `sevenNightOutlook` → `verdict`):
   - a null forecast is marginal / `no-weather-data` (`src/lib/engine/verdict.ts:77-79`);
   - a series that does not reach from the first to the last whole UTC hour overlapping the dark window is marginal / `no-weather-data` (`verdict.ts:35-45`, `:81-84`);
   - a missing hour inside a spanning series breaks a clear run (`verdict.ts:52`);
   - a saved copy served after a failed refresh (`fallback: true`) caps a go at marginal (`verdict.ts:100-102`).
2. **"No cloud data for an hour means no cloud" is false in this code.** Open-Meteo nulls are dropped, never turned into 0 (`src/lib/forecast/open-meteo.ts:69-74`). The dropped hour then reads differently by position and consumer:
   - inside the series, `verdict` and `clearIntervals` count it as not clear (`verdict.ts:52`, `:139`), while `cloudOutlook` skips it (`verdict.ts:177-180`);
   - at the series' own edge, it shrinks the span, so a night reaching that edge becomes `no-weather-data` (`verdict.ts:43-44`).
3. **"A 200 from the provider means a usable series" is false, but the verdict stays honest, and the cost lands on the cache.** A 200 passes the schema with:
   - an empty `hourly` (`time: []`);
   - all-null cloud;
   - a series of any length;
   - cloud values outside 0-100. There is no range check (`open-meteo.ts:27-38`).
   
   `getForecast` stores any parsed 200 as the new fresh copy (`src/lib/forecast/service.ts:138-151`). So an empty or truncated 200 **overwrites the last good copy**. For the next hour Tonight reads "No forecast" instead of the good one, and a later outage falls back to the useless copy. That is honest (never `go`), but it loses the PRD's "last successful forecast shown with its age" (`context/foundation/prd.md:98-101`). Nothing tests it.
4. **The guidance's wording "never 'Clear'" is stricter than the PRD and must be corrected.** The PRD's own headline for a capped saved copy is "Clear (old forecast)" (`prd.md:319-321`; `src/i18n/messages/en.ts:79`), and it sits on level marginal. The protectable property is **level never `go` and headline never the bare "Clear"** (`verdict.sky.go`) on a partial, stale or missing forecast. It is not "the word Clear never appears". Likewise, "last forecast, N hours old" is test-plan wording only. The shipped string is "Weather service unreachable — showing the forecast from {age} ago" (`en.ts:801`).
5. **"Moon, twilight and altitude stay usable" holds by construction.** The dark window and Moon are computed before the verdict for every night (`src/lib/engine/outlook.ts:170-178`), and the Moon card needs no weather (`src/lib/tonight/build.ts:840-842`). A null forecast still ranks targets, because marginal passes the card (`build.ts:692`, `:702`). This is tested once, at `src/lib/tonight/build.test.ts:301`.
6. **"No error page" holds for the forecast itself, but the loader's catch is untested and blanks the view.**
   - `getForecast` cannot throw from a fetch or cache failure (`service.ts:97-108`, `:110-116`, `:152-154`).
   - A throw inside `buildTonight` is caught by `loadTonight` and becomes `tonight.failed` with `view = null`, so there is no verdict, Moon or ranking (`src/lib/tonight/load.ts:154-156`). The island still answers 200 with a `ServerError` line, which is not an Astro error page.
   - No test imports `loadTonight`. The catch drops the error cause and logs nothing.
7. **Which nights 1-3 lack hours:** with a fresh forecast, none for the tonight view (`past_days=1`, `forecast_days=8`, `open-meteo.ts:52-53`). Nights 2-3 lose hours only through:
   - an **aged fallback copy** (the series end is fixed at its fetch date, and the KV TTL is 7 days, `service.ts:26`);
   - a **short or edge-null 200** (point 3).
   
   Only night 2's truncation is tested through `buildTonight` (`build.test.ts:569`). Night 3 is tested only in the engine (`src/lib/engine/outlook.test.ts:76`).

**Cheapest useful layers**:
- **Unit, against the PRD oracle:** the mapper plus verdict, for the null-position cases.
- **Integration seam, no verdict mocking:** `getForecast` with `memoryCache` and a fake `fetchFn`, then `buildTonight` with its result, for:
  - the cache overwrite;
  - fallback age against horizon;
  - the view-level states.
- **Thin loader test:** `loadTonight`'s no-error-page promise, which needs `fetch` stubbed and the gear store faked (details under "Test seams").

## Detailed Findings

### Forecast fetch and parse (`src/lib/forecast/open-meteo.ts`)

**The request** (`forecastUrl`, `open-meteo.ts:45-55`):
- `hourly=cloud_cover,relative_humidity_2m`: total cloud only, no layered cloud.
- `timezone=GMT` and `timeformat=unixtime`, so hours are UTC epoch seconds and there is no local-zone parsing.
- `past_days=1` and `forecast_days=8`.
- A 3000 ms timeout (`FORECAST_TIMEOUT_MS`, `:17`, applied at `:87`).
- The base URL is overridable via `FORECAST_BASE_URL` (`load.ts:36`).

**The schema** (`open-meteo.ts:27-38`) requires `hourly.time: int[]`, and `cloud_cover` and `relative_humidity_2m` as `(number|null)[]`, with a refine that all three arrays have equal length (`:34-37`).

**The mapper** (`mapForecastResponse`, `open-meteo.ts:62-77`) keeps an hour only if both cloud and humidity are non-null (`:72`). The doc comment states the intent: "Hours where either value is null are left out (the verdict counts them as not clear)" (`:57-60`).

**Accepted by a 200, untested and unchecked:**
- `time: []` → `{ hours: [] }`;
- all-null cloud → `{ hours: [] }`;
- any series length, since nothing compares it with what was requested;
- out-of-range values (e.g. cloud −5 or 150);
- `hourly_units` is never read.

**Thrown errors.** `fetchForecast` throws only the fixed `FORECAST_REQUEST_FAILED` or `FORECAST_RESPONSE_INVALID` errors (`:79-104`). The cause is deliberately dropped for coordinate privacy (`:9-11`, eslint-disable `preserve-caught-error` at `:89`, `:100`).

**Existing tests** (`src/lib/forecast/open-meteo.test.ts`):
- unixtime mapping (`:16`);
- the null hour dropped (`:26`, a 3-element case);
- request parameters (`:33`);
- non-2xx, rejection and timeout (`:52`, `:57`);
- malformed JSON and schema mismatch (`:64`, `:69`);
- no coordinates or cause in error messages (`:74`).

**Not tested:**
- the length-mismatch refine. The test at `:69` fails on type and a missing key, not on length;
- empty `hourly`;
- all-null cloud;
- edge versus interior nulls;
- a truncated series.

### Forecast service and KV cache (`src/lib/forecast/service.ts`, `cache.ts`, `kv-cache.ts`)

- **Key:** `forecast:v1:site:${siteId}` (`service.ts:28-30`). The entry is usable only if the stored `lat`/`lon` exactly equal the site's (`:129`).
- **Fresh window and TTL:**
  - a usable entry with `0 <= age < FORECAST_FRESH_MS` (60 min) is served without a fetch (`:131-135`);
  - otherwise the service refetches;
  - KV keeps entries for `FORECAST_CACHE_TTL_SECONDS` (7 days, `:26`, `:112`).
- **Success path** (`:138-151`): any parsed 200 becomes `{ forecast, fetchedAt: now, fallback: false }` and **is written over the stored copy**. No check on hour count, span or emptiness happens before the write. This is the code fact behind Summary point 3.
- **Failure path** (`:152-154`): a usable stored copy is served with `fallback: true`, **whatever its age** (no age cap). Otherwise the service returns `null`. The catch drops the error and logs nothing ("nothing here logs", `:19`).
- **Cache errors:**
  - a read error or unreadable value is a miss (`readCache`, `:97-108`);
  - a write error is ignored (`:110-116`);
  - a hung KV read times out after 1000 ms (`withReadTimeout`, `cache.ts:15-31`).
- **Throw from `defer`:** the `defer(write)` call sits inside the `try` (`service.ts:145-148`). If `defer` itself threw, a successful fetch would be discarded and replaced by fallback or null. This is an inferred edge case, not observed and not tested.
- **Return type** `ForecastResult | null` with `{ forecast, fetchedAt, fallback }` (`service.ts:47-52`). The states it can express:
  - fresh from cache;
  - fresh from fetch;
  - fallback of any age;
  - `null`.
  
  "Partial" is **not** a state. It is a normal result with fewer hours.
- **Age reaches the UI** through `forecastStatusOf` (`build.ts:535-541`): `{ kind: "none" }`, or `{ kind: "fresh" | "fallback", ageMs: now - fetchedAt }`. `formatAge` (`src/lib/tonight/format.ts:366-379`) renders it.
- **Existing tests** (`src/lib/forecast/service.test.ts`):
  - fresh at 59 min (`:28`);
  - stale at 60 min refetched (`:40`);
  - a miss then a hit (`:64`);
  - changed coordinates (`:74`);
  - 503 falls back to a 3-day-old copy (`:82`);
  - 503 with an empty cache gives null (`:93`);
  - other coordinates give null (`:105`);
  - an HTML 200 with an empty cache gives null (`:112`);
  - an unreadable entry is a miss (`:124`);
  - a throwing cache (`:132`);
  - `defer` (`:154`).
  
  **Not tested:**
  - a 200 that overwrites a good copy with an empty or short series;
  - a fallback copy that no longer spans tonight;
  - fallback after a network error, a timeout or an invalid 200 while a copy exists (`:82` covers only a 503);
  - negative age (clock skew).

### How the series is cut per night, and what reaches the verdict

**No pre-slicing.** `buildTonight` passes the whole series once (`build.ts:624-625`, `:640`). `sevenNightOutlook` (`outlook.ts:165-187`) computes each night's dark window, then:
- nights 1-3 (`VERDICT_NIGHTS = 3`, `src/lib/engine/parameters.ts:196`) go through `verdict(window, forecast, {fallback})`;
- nights 4-7 go through `cloudOutlook`.

The card is night 1 of the same outlook, so the card and the strip cannot disagree (`build.ts:638-646`).

**The cut** (`overlappingSlotStarts`, `verdict.ts:27-33`) takes every whole UTC hour overlapping `[start, end)` and looks each one up by exact epoch ms (`:87-88`).

**The coverage rule** (`seriesSpans`, `verdict.ts:36-45`) compares the first and last slots against the **min and max hour present**, not against the hours requested. Consequences:
- **An interior hole** (an hour missing between present hours inside the window):
  - `verdict` and `clearIntervals` treat it as not clear, so it can only lower the result;
  - `cloudOutlook` skips it, so a strip's clear share averages only present hours (`verdict.ts:177-180`).
- **A hole at the series' own end** (trailing nulls, or a short series) moves `max(hour.start)` earlier. Any night whose window reaches past it becomes marginal / `no-weather-data`, not a weather no-go. This holds only when the null hours are the series' last ones. A null at the dark window's edge with present hours beyond it is an interior hole. The PRD and archive leave this asymmetry undocumented, so it is a good independent-oracle target.
- **Every slot in the window missing, while the series spans it.** The verdict is no-go / `cloudy` with `minCloudPct: null` (`verdict.ts:114-115`). The UI maps that to the "No forecast" headline (`format.ts:139`) and the reason "no forecast covers the dark window" (`format.ts:328`, `en.ts:755`). So the level is no-go but the words say no data, and the result is never `go`.

**Short-night scaling** (`required()`, `verdict.ts:91`) is a planning decision (archive `2026-09-25-tonight-verdict-and-ranking/plan.md:211`), not PRD text.

**Planet and Moon gate.** A second `verdict()` runs over the civil-twilight window (`build.ts:766-776`). `clearIntervals` masks planets to the clear hours only on a no-go night. It is `null` on a null or non-spanning forecast, so planets are ranked unmasked there (`verdict.ts:125-132`).

### Which nights can lack hours (hand-derived, not run)

The series covers `(D−1)T00Z` to `(D+7)T23Z`, where D is the UTC date of `fetchedAt` (`open-meteo.ts:52-53`).

- **Fresh forecast, tonight view:** night 3 ends on the morning of tonight+3. That leaves several days of margin, so nights 1-3 never lack hours at any latitude. A night past local midnight is covered by `past_days=1`, which is tested (`src/lib/forecast/night-in-progress.test.ts:45`).
- **Fresh forecast, `night: "next"` view** (`build.ts:631`): nights 1-3 are fine. Night 7 likely lacks hours for European sites and reads "No cloud outlook yet". This is derived, not tested, and outside Risk #1's verdict nights.
- **Fallback copy aged `a` days:** the series end is fixed at the copy's fetch date. Verdict night k stays covered roughly while `a + k <= 7`. At about 5 days night 3 drops out, at about 6 days night 2, and at the 7-day TTL tonight too. This is the realistic way nights 2-3 become "No forecast".
- **Short or edge-null 200:** any night past the last present hour. This depends on the provider's response, so its frequency is unknown.

### What the user sees per state

| Forecast state | Level / reason | Headline (EN) | Status line (dashboard `VerdictCard.astro:98` only) |
|---|---|---|---|
| `null` (outage, nothing stored) | marginal / `no-weather-data` | "No forecast" (`en.ts:80`) | "No weather data — the weather service could not be reached and no earlier forecast is saved" (`en.ts:802`) |
| fallback, go-shaped | marginal / `fallback-cap` | "Clear (old forecast)" (`en.ts:79`) | "Weather service unreachable — showing the forecast from {age} ago" (`en.ts:801`) |
| fallback, go-shaped and damp | marginal / `humidity-cap` (humidity wins, `verdict.ts:96-102`, tested at `verdict.test.ts:161`) | "Clear, but damp" | fallback line with age |
| fallback, marginal or no-go-shaped | unchanged (`verdict.test.ts:168`) | "Partly clear" / "Cloudy" | fallback line with age (the only staleness hint) |
| series not spanning the window | marginal / `no-weather-data` | "No forecast" | fresh or fallback line |
| fresh, complete | from the run rules | any | "Forecast updated {age} ago" (`en.ts:800`) |

The age or outage line renders only on the dashboard card. The Targets, Plan, Planets, Moon and Nights pages show the headline and reason text but never `forecastStatus` (`TargetsPageContent.astro:125-126`, `PlanPageContent.astro:77-78`, per the consumer worker). This is not a Risk #1 violation, because the level is still capped. It does mean a fallback "Partly clear" on `/tonight/nights` carries no staleness hint at all. That case was accepted earlier as a low observation for nights 4-7 (archive `2026-09-27-seven-night-site-planner/reviews/impl-review.md:66-74`).

### "No error page"

- **Page shell:** `tonight.astro` has no `try`, and the content is a `server:defer` island (`src/pages/tonight.astro:45`).
- **`loadTonight`** (`load.ts:136-157`) wraps `getForecast` and `buildTonight` in a bare `catch { tonightError = TONIGHT_FAILED }`. The view becomes null and the island renders the `tonight.failed` `ServerError` line, "Could not work out tonight's sky. Please try again." (`en.ts:472`, `TonightContent.astro:256`).
  - The response is a 200 with no verdict, Moon or ranking, which is a degraded view rather than an Astro error page.
  - The catch drops the cause and logs nothing.
  - A throw inside it can come only from `buildTonight` outside its own inner catches, e.g. the guard at `build.ts:642-644`.
- **Inner catches in `buildTonight`:** they null individual parts (planet gate `:777`, solar system `:826`, Moon target `:876`, Moon card `:923`, sky view `:1006`, session plan `:1135`) without logging, by stated design (`:761`, `:782`, `:842`).
- **Outside the loader's `try`:** `island.ts:48` constructs `kvForecastCache()`, which imports `cloudflare:workers` `env`. A throw there would escape as an island error. It is not reachable from forecast content, and `island.ts` cannot be imported in Vitest.
- **No test imports `loadTonight`.** `build.test.ts:36` imports only `logHref`.

Observability note, out of scope for this phase: every catch on this path discards the error cause by design, for coordinate privacy (`open-meteo.ts:9-11`, `service.ts:19`). That conflicts with the workspace rule "no dropped error causes" (`/Users/rafalskwara/projects/CLAUDE.md`, Hard rules). It belongs to `/10x-observability-audit`, not to these tests.

### Existing coverage that Phase 1 must not duplicate

**Engine** (`src/lib/engine/verdict.test.ts`):
- a missing hour breaks a run (`:106`, `:113`);
- a series that ends mid-window, starts after the window, is empty, or lies entirely after it gives no weather data (`:121-139`);
- the last hour equal to the series' last hour counts as covered (`:146`);
- the fallback cap, with humidity precedence and marginal/no-go unchanged (`:151-175`);
- a null forecast (`:177`);
- outlook and `clearIntervals` hole and null rules (`:207-264`).

**Engine** (`src/lib/engine/outlook.test.ts`):
- night 2 and night 3 uncovered for the next-night search (`:70`, `:76`);
- a series ending after night 3 (`:240`);
- fallback through nights 1-3 (`:253`);
- a null forecast (`:263`).

**View** (`src/lib/tonight/build.test.ts`):
- null gives "No forecast" plus a ranking (`:301`);
- status text for fresh, fallback at 3 h, and none (`:384`);
- fallback cap with a ranking (`:400`);
- a night-1 series ending mid-window (`:418`);
- night 2 uncovered (`:569`);
- nights 4-7 with no outlook (`:580`);
- `clearPct` null (`:650`);
- a null-forecast Moon build (`:1220`).

**Oracle caveat.** Many of these use crafted series. Their expected values come from the PRD thresholds (`prd.md:668-672`: go = ≥ 2 h run < 30 %, marginal = ≥ 1 h < 65 %, humidity > 90 % caps). Those thresholds are "candidate (uncalibrated)", so they are an independent oracle for the rules, not for calibration. Not re-audited here: whether each existing expectation was hand-derived or copied from code.

**Missing across all layers:**
- a raw provider body (nulls, edge nulls, empty, short, out of range) taken through `getForecast` and `buildTonight` to the view;
- the cache overwrite by a degenerate 200;
- fallback age against horizon (nights 2-3 dropping out);
- night 3 truncated at view level;
- `loadTonight`'s no-error-page behaviour;
- e2e forecast states. `tests/e2e/forecast-fixture.mjs` serves only an all-clear series from −48 h to +216 h and ignores the query.

### Test seams

- **Integration without mocking the verdict.** Run `getForecast({ fetchFn, cache, siteId, coords, now, baseUrl })` with helpers from `src/lib/forecast/test-helpers.ts` (`memoryCache` `:54-67`, `fakeFetch`, `jsonResponse`, `openMeteoBody`), already used by `service.test.ts` and `night-in-progress.test.ts`. Then call `buildTonight({ site, telescope, eyepieces, forecast: result, now }, "en")` with the `WARSAW` and `TELESCOPE` fixtures from `build.test.ts`.
  - Seed staleness by pre-putting a stored entry at `forecastCacheKey(siteId)` with an old `fetchedAt`, plus a failing fetch.
  - `now` is injected everywhere, so age and horizon cases are deterministic.
- **`loadTonight`.** It is importable and takes `cache`, `defer`, `now` and `forecastBaseUrl`. Its fetch is hard-wired to `globalThis.fetch` (`load.ts:140`), so a test needs `vi.stubGlobal("fetch", …)`. Sites and telescopes come from the gear stores over `supabase`, so a test needs a fake client or `vi.mock("@/lib/gear/store")`.
  - An optional `fetchFn` on `LoadTonightInput` would remove the global stub. That is a small production change for the plan to decide.
  - `tonightError` is reachable only by making `buildTonight` throw, as `build.test.ts:47-70` does with `vi.mock("@/lib/engine")`.
- **`island.ts`:** not importable in Vitest (`astro:env/server`, `cloudflare:workers`).
- **e2e fixture:** it has no outage, partial or null modes. Phase 1 is planned as unit plus integration (test plan §3), so e2e is not the cheapest layer here.

## Code References

- `src/lib/forecast/open-meteo.ts:27-38` - response schema (nulls allowed, equal lengths, no range check)
- `src/lib/forecast/open-meteo.ts:45-55` - request parameters (`past_days=1`, `forecast_days=8`, `timezone=GMT`)
- `src/lib/forecast/open-meteo.ts:62-77` - null hours dropped
- `src/lib/forecast/service.ts:23-26` - fresh 60 min, TTL 7 days
- `src/lib/forecast/service.ts:126-155` - fresh-hit, fetch-and-overwrite, fallback-of-any-age, null
- `src/lib/engine/verdict.ts:27-45` - whole-UTC-hour slots; span by min/max present hour
- `src/lib/engine/verdict.ts:69-116` - verdict, fallback cap, `cloudy` with `minCloudPct: null`
- `src/lib/engine/verdict.ts:168-186` - `cloudOutlook` skips holes
- `src/lib/engine/outlook.ts:165-187` - nights 1-3 verdict, 4-7 outlook
- `src/lib/tonight/build.ts:535-541` - `forecastStatusOf` (age)
- `src/lib/tonight/build.ts:624-660` - forecast into the outlook, card = night 1
- `src/lib/tonight/build.ts:766-776` - planet gate over the civil window
- `src/lib/tonight/format.ts:132-142`, `:322-332` - headline and reason mapping (`cloudy` + null → "No forecast")
- `src/lib/tonight/load.ts:136-157` - loader `try`/`catch` → `tonight.failed`
- `src/i18n/messages/en.ts:79-80`, `:755`, `:800-802` - headlines, reason, status lines
- `src/lib/forecast/test-helpers.ts:11-67` - `openMeteoBody`, `fakeFetch`, `memoryCache`
- `tests/e2e/forecast-fixture.mjs` - all-clear only

## Architecture Insights

- Honesty is enforced in one pure place, `verdict.ts`. The service and the mapper are deliberately permissive: they validate shape, not usefulness. Tests of "a 200 is not a usable series" therefore belong at the service + view seam, where the overwrite and the resulting state can be seen. They do not belong in the engine.
- "Partial" has no explicit representation. It is inferred from which hours are present, so the position of a gap matters: an interior gap reads not clear (or is skipped in the outlook), while a gap at the series' edge reads no data.
- The card and the strip share one outlook computation (`build.ts:638-640`), so a view-level test of night 1 also pins the strip's night 1.
- The cause-free, log-free error handling on the forecast path is a recorded privacy decision, not an accident (`open-meteo.ts:9-11`, `service.ts:19`).

## Historical Context (from prior changes)

Each claim is verified against the current code:
- `context/archive/2026-09-25-no-go-and-no-darkness-explanations/plan.md:17`, `:25`: a series ending at 23:00 UTC two days out lost night 3's post-midnight hours, and missing hours past the end counted as not clear, giving a false weather no-go.
  - **Supported and fixed:** the coverage rule (`plan.md:93`) is in `verdict.ts:35-45`, and the horizon has since grown to 8 days (`open-meteo.ts:53`).
  - Unit tests listed at `plan.md:140-145` exist (`verdict.test.ts:121-146`).
- The same plan, `plan.md:54` and `plan-brief.md:45`: the fallback cap applies "whatever its age". No age threshold was added, by decision.
  - **Supported** (`service.ts:152-153`, `verdict.ts:100-102`). The PRD sets no maximum staleness either (`prd.md:98-101`, `:506-509`).
- `context/archive/2026-09-30-planets-on-tonight/reviews/impl-review-phase-3.md:37-48`: planets were ranked under cloud on a twilight-only clear night.
  - **Supported as fixed** by `clearIntervals` masking (`build.ts:766-776`). The residual is that null or non-spanning forecasts leave planets unmasked, which matches "marginal, ranking still shown".
- `context/archive/2026-09-25-tonight-verdict-and-ranking/plan.md:232`: `past_days=1` is needed for a night in progress after UTC midnight.
  - **Supported and tested** (`night-in-progress.test.ts:45`).
- `context/archive/2026-09-27-seven-night-site-planner/reviews/impl-review.md` F5, and `context/archive/2026-09-30-planets-on-tonight/reviews/impl-review-phase-3.md:85`: any throw blanks Tonight to `tonight.failed`. This was accepted, not fixed.
  - **Supported** (`load.ts:154-156`). Still untested.
- `context/archive/2026-10-02-moonlight-and-the-verdict/plan.md:62-76` and `prd.md:315-322`: the headline is chosen from level plus reason, and "Clear (old forecast)" is the sanctioned fallback-cap headline.
  - **Supported** (`format.ts:132-142`, `en.ts:79`).

## Related Research

- `context/archive/2026-09-25-no-go-and-no-darkness-explanations/` (coverage rule, fallback cap)
- `context/archive/2026-09-25-tonight-verdict-and-ranking/` (original forecast, cache and outage design)
- `context/archive/2026-10-03-verdict-check/research.md:43-65` (reason kinds; "old forecast is not an age threshold")

## Corrections to the test-plan guidance (for the post-research backport)

1. **"never 'Clear'"** should read **"level never `go`, and the headline never the bare 'Clear'"**. "Clear (old forecast)" is PRD-sanctioned at marginal (`prd.md:319-321`).
2. **"last forecast, N hours old"** should read **"the last saved forecast with its age"**. The shipped string is `tonight.forecast.fallback` (`en.ts:801`), and tests should assert the status kind and age, not test-plan prose.
3. **Add a protected behaviour:** a degenerate 200 (empty, all-null, truncated) must not leave Tonight worse off than the previous good copy. Today it does: it overwrites the copy (`service.ts:138-151`). Whether that is a test to write (it would be red) or a fix belongs to the plan. It is a product choice, see Open Questions.
4. **Hot-spot directories were accurate but incomplete.** The decisive code is also in `src/lib/forecast/` (the service and mapper), which §2 does not list as a hot spot.

## Open Questions

1. **Degenerate-200 overwrite** (Summary 3): should Phase 1 only pin current behaviour, or should it write a red test plus a fix? One candidate fix: refuse to store, or keep the old copy, when a 200 yields fewer hours than tonight's dark window needs. Reading the PRD's "last successful forecast" as "last *usable* forecast" argues for a fix. That decision needs the user, or the plan's delegated-decision rule.
2. **Out-of-range values:** add a 0-100 range check in the mapper (a negative cloud would read clear), or accept the provider's contract? Low likelihood. There is no evidence of the provider ever sending one.
3. **`loadTonight` testability:** add an optional `fetchFn` to `LoadTonightInput`, or stub the global `fetch` in the test? This is a small production change versus test-only plumbing.
4. **Unverified provider behaviour:** that Open-Meteo returns nulls (rather than shorter arrays) for unavailable hours is assumed by the code (`open-meteo.ts:57-60`) and has not been checked against the live API. Tests should cover both shapes either way.
