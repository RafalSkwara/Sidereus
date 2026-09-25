# No-go and No-darkness Explanations Implementation Plan

## Overview

Roadmap slice S-04 (US-02, FR-020, FR-023, NFR forecast outage). Tonight already hides the ranking on a no-go night, but it doesn't say what to do next. This slice covers the three nights where Tonight has nothing to rank:

- **Weather no-go:** the verdict with its reason, plus the next night that isn't a no-go.
- **No darkness:** the latitude-and-season cause, plus the date the dark window returns.
- **Forecast outage:** the last saved forecast with its age, or an explicit "no weather data" state. Moon, twilight and altitude results stay usable, and the page never errors.

## Current State Analysis

- `buildTonight` (`src/lib/tonight/build.ts:110-163`) computes one night: its dark window, `verdict`, and a ranking only on go or marginal nights that have a window. On a no-go night, or a night without a window, `ranking` is null and the page shows only `VerdictCard` (`src/pages/tonight.astro:123-151`).
- `verdict` (`src/lib/engine/verdict.ts:49-83`) returns:
  - `no-darkness` for a `none` window;
  - `no-weather-data` (marginal) for a null forecast;
  - otherwise a verdict from runs over the whole UTC hours that overlap the window. Every hour missing from the forecast counts as not clear (`verdict.ts:37`), whether it is a gap in the middle or lies past the end of the series. A series that stops partway through the window therefore gives a weather no-go ("no forecast covers the dark window" when nothing overlaps; `verdict.test.ts:112-117`).
- `darkWindow` (`src/lib/engine/sun.ts:52-100`) returns `{kind:"none", thresholdDeg, minSunAltitudeDeg, at}` when the sun never reaches the threshold. It checks the sun's lowest point first, so a night with no darkness costs one `SearchHourAngle` and one altitude.
- `getForecast` (`src/lib/forecast/service.ts:110-136`):
  - serves a stored copy under 1 h old;
  - otherwise it refetches;
  - if the fetch fails, it serves any stored copy with matching coordinates (KV keeps copies for 7 days);
  - if no copy exists, it returns null.
  `ForecastResult` is `{forecast, fetchedAt}` and doesn't say whether the copy is a fallback. The page drops `fetchedAt` (`tonight.astro:84`).
- The Open-Meteo request uses `past_days=1&forecast_days=3` (`src/lib/forecast/open-meteo.ts:48-49`). The series ends at 23:00 UTC two days after today, so night 3's hours after midnight UTC are missing.
- `VerdictCard.astro` shows the level, the reason phrase and the dark window. For a night with no window it prints "No dark window tonight" with no cause.
- Wording lives in `src/lib/tonight/format.ts`, one template per phrase. `formatNightDate` and `formatTime` already exist.
- There is no `context/foundation/lessons.md`.

## Desired End State

On `/tonight`:

- **Weather no-go:** the verdict and reason appear with no ranking, plus one line naming the next night that isn't a no-go (nights 2–3 only), or saying where the forecast runs out.
- **No darkness:** a cause line naming the latitude, the season and how far the sun sinks against the site's Bortle threshold, plus the date the dark window returns with that night's window times.
- **Forecast line (always):** either "Forecast updated N ago", or the outage wording with the age of the saved copy, or "No weather data".
- **Saved copy in use:** the verdict can reach at most marginal.
- **Series that doesn't span the dark window:** the night gets "no weather data" instead of a weather no-go.

Verification: `npm test`, `npx astro check`, `npm run lint` and `npm run build` pass. The manual checks in Phase 2 show each state in the browser.

### Key Discoveries:

- `DarkWindow`'s `none` variant already carries `minSunAltitudeDeg` and `thresholdDeg` (`src/lib/engine/types.ts:53-59`), which is all the cause line needs.
- `addDays` (`src/lib/engine/night.ts:43`) is engine-internal and not exported by the barrel. The new engine module can import it directly.
- Measured in planning (scratchpad bench, local, warm): a night-by-night search for the return date takes **16.1 ms** in the worst case (Tromsø 69.65° N, −18°, from 2026-04-20; returns 2026-09-16 after 149 nights), 12.4 ms for Tromsø at −12°, and 6.4 ms for Warsaw at −18° from 2026-05-25 (returns 2026-07-24). The Workers Free cap is 10 ms CPU per request (`context/foundation/infrastructure.md:64`), and S-02's cold `/tonight` already measured 22 ms (`context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md`).
- Pattern to follow: pure logic in `src/lib/engine/`, composition in `buildTonight`, wording in `format.ts`, a page with no logic. `purity.test.ts` guards any new engine module automatically.

## What We're NOT Doing

- No verdicts or outlook for nights 4–7, and no 7-night strip (S-05). The next-night search stops at night 3 (invariant 5).
- No moon phase or illumination display. Moon, twilight and altitude stay "usable" through the dark window and the ranking, which still shows on a no-weather-data night (marginal).
- No change to the S-02 rule that a null forecast gives "marginal, no weather data" with a ranking.
- No new tunable threshold for how old a saved copy can be. The cap applies to every fallback copy, whatever its age.
- No requirement that the returning dark window reach a minimum length. The first night with any window counts.
- No dev-only date override on the page. Manual no-darkness checks use a real site at a latitude with no darkness now.
- No telescope selector or empty-state changes (S-08), and no change to the forecast cache TTL or key.

## Implementation Approach

Phase 1 puts every rule where it can be unit-tested without a page:

- `verdict` gains the coverage rule and a fallback cap;
- a new pure `engine/outlook.ts` answers "which night next?" and "when does darkness return?";
- the forecast service reports whether it served a fallback copy, and requests one more day.

Phase 2 builds the explanations and the forecast line into the view model, gives each one a single template in `format.ts`, and renders them in `VerdictCard`. It then checks every state by hand, including a deploy and a CPU reading.

## Critical Implementation Details

- **Performance constraint:** `darkWindowReturn` must not scan night by night. It checks every `DARK_RETURN_STRIDE_NIGHTS` (7) nights, and when a checked night has a window it scans back through the previous stride one night at a time for the first one. This is correct because the no-darkness season is a single contiguous run around local summer: the sun's minimum altitude is monotonic on each side of the solstice, so a window can't appear and vanish within one stride. A test pins the stride result to a night-by-night scan across many start dates.
- **Manual-check gotcha:** a stored forecast under 1 h old is served without any fetch (`service.ts:122-126`). Changing `FORECAST_BASE_URL` therefore has no effect until that entry is older than 1 h, deleted from local KV, or made unusable by a change to the site's coordinates.

## Phase 1: Engine rules and forecast provenance

### Overview

Coverage rule and fallback cap in `verdict`, the two forward searches in a new pure engine module, and a forecast service that reports fallback copies over a 4-day series.

### Changes Required:

#### 1. Verdict: coverage rule and fallback cap

**File**: `src/lib/engine/verdict.ts`, `src/lib/engine/types.ts`

**Intent**: A data gap must never read as a weather no-go, and a copy that couldn't be refreshed must never produce a confident go (PRD guardrail).

**Contract**:
- Signature becomes `verdict(darkWindow: DarkWindow, forecast: HourlyForecast | null, options?: { fallback: boolean }): Verdict`, with `fallback` defaulting to `false`.
- Rule order:
  1. A `none` window gives no-go / `no-darkness` (unchanged).
  2. A null forecast gives marginal / `no-weather-data` (unchanged).
  3. **New coverage rule:** if the forecast has no hours, or the first overlapping whole-UTC-hour slot is earlier than the earliest `hour.start`, or the last overlapping slot is later than the latest `hour.start`, the result is marginal / `no-weather-data`. Hours missing *inside* the series still count as not clear (unchanged).
  4. Go run, then the humidity cap (unchanged; it takes precedence).
  5. **New:** a passing go run with `fallback: true` gives marginal with reason `{ kind: "fallback-cap"; runHours: number; cloudPct: number }`, carrying the go run.
  6. Marginal and no-go are unchanged, fallback or not.
- `VerdictReason` in `types.ts` gains the `fallback-cap` variant.

#### 2. Night outlook: next night and dark-window return

**File**: `src/lib/engine/outlook.ts` (new), `src/lib/engine/parameters.ts`, `src/lib/engine/index.ts`

**Intent**: Pure forward searches for FR-020 and FR-023, so the view only has to phrase their results.

**Contract**:
- `parameters.ts` adds:
  - `VERDICT_NIGHTS = 3`: nights 1–3 carry a verdict (FR-011, invariant 5).
  - `DARK_RETURN_MAX_NIGHTS = 366`.
  - `DARK_RETURN_STRIDE_NIGHTS = 7`.
- `nextNightNotNoGo(input: { site: Site; thresholdDeg: number; date: string; forecast: HourlyForecast | null; fallback: boolean }): NextNight`, where `NextNight = { kind: "found"; date: string; verdict: Verdict } | { kind: "none"; lastJudgedDate: string | null }`.
  - Walks nights `date+1` … `date+(VERDICT_NIGHTS-1)`, computing each night's `darkWindow` and `verdict` with the same forecast and fallback flag.
  - A night whose reason is `no-weather-data` ends the walk: `none`, with `lastJudgedDate` set to the last night before it that was judged from data, or null if that is only `date` itself.
  - The first night with level `go` or `marginal` gives `found`.
  - If every night is no-go (weather or no darkness), the result is `none` with `lastJudgedDate = date+(VERDICT_NIGHTS-1)`.
- `darkWindowReturn(site: Site, thresholdDeg: number, date: string): { date: string; window: Extract<DarkWindow, { kind: "window" }> } | null`.
  - Returns the first night after `date` with a dark window, searching up to `DARK_RETURN_MAX_NIGHTS` nights ahead, using the stride-and-scan-back search from Critical Implementation Details.
  - Returns null only if no window exists within that range.
- The barrel exports both functions and the `NextNight` type.

#### 3. Forecast: 4-day series and fallback flag

**File**: `src/lib/forecast/open-meteo.ts`, `src/lib/forecast/service.ts`

**Intent**: Night 3 has to be fully covered, or the coverage rule would always mark it "no weather data". The page needs to know when it is showing a saved copy.

**Contract**:
- `forecastUrl` sets `forecast_days=4`.
- `ForecastResult` becomes `{ forecast: HourlyForecast; fetchedAt: Date; fallback: boolean }`.
- `fallback` is `true` only when the fetch failed and a stored copy with matching coordinates was served. A fresh cache hit and a fresh fetch give `false`.
- The stored KV shape and key are unchanged.

#### 4. Tests

**File**: `src/lib/engine/verdict.test.ts`, `src/lib/engine/outlook.test.ts` (new), `src/lib/forecast/service.test.ts`, `src/lib/forecast/open-meteo.test.ts`, `src/lib/forecast/night-in-progress.test.ts`

**Intent**: Pin every decision in this plan as a named case. Update the existing tests that assert the old behaviour.

**Contract**:
- **Verdict:**
  - a series ending mid-window gives marginal / `no-weather-data`, and so does a series starting after the window starts;
  - an empty series gives `no-weather-data`; this replaces the case "is no-go with no minimum cloud when the forecast covers none of the window" (`verdict.test.ts:112`);
  - a missing hour inside the series still breaks a run;
  - `fallback: true` turns a go into marginal / `fallback-cap` with the run;
  - the humidity cap wins over the fallback cap;
  - fallback marginal and fallback no-go are unchanged.
- **Outlook, `nextNightNotNoGo`:**
  - night 2 marginal gives `found` on night 2;
  - night 2 no-go and night 3 go gives `found` on night 3;
  - nights 2 and 3 no-go give `none` with `lastJudgedDate` = night 3;
  - night 2 uncovered gives `none` with `lastJudgedDate` null;
  - night 2 no-go with night 3 uncovered gives `none` with `lastJudgedDate` = night 2;
  - a fallback forecast caps a found night's go at marginal.
- **Outlook, `darkWindowReturn`:**
  - Tromsø (`TROMSO` fixture site) at −18° from 2026-06-21 and Warsaw at −18° from 2026-06-21 each equal a night-by-night reference scan written in the test;
  - a sweep of start dates (every 5 days, 2026-04-15 to 2026-09-15, Tromsø at −18/−15/−12) always equals the reference;
  - a site that is dark tomorrow returns `date+1`.
- **Service:**
  - `fallback` is `true` on a failed fetch with a stored copy;
  - it is `false` on a fresh hit and on a successful fetch;
  - a failed fetch with no stored copy still returns null.
- **Open-Meteo:** asserts `forecast_days: "4"`.
- **Night in progress:** its comment and hour count follow the 4-day series.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- The engine purity guard covers `outlook.ts` and passes (part of `npm test`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Tonight explanations and forecast status

### Overview

Compose the explanations and the forecast line into `TonightView`, give each one a single template, render them, and check every state by hand.

### Changes Required:

#### 1. Wording templates

**File**: `src/lib/tonight/format.ts`

**Intent**: One template per new phrase, so identical inputs always read the same way.

**Contract**:
- `formatAge(ms: number): string`:
  - under 1 min (including negative ages): "less than a minute";
  - under 60 min: "N min";
  - under 48 h: "N h", truncated;
  - otherwise "N days", truncated.
- `forecastStatusText(status)`:
  - fresh: "Forecast updated {age} ago";
  - fallback: "Weather service unreachable — showing the forecast from {age} ago";
  - none: "No weather data — the weather service could not be reached and no earlier forecast is saved".
- `verdictReasonText` handles `fallback-cap`: "the last saved forecast showed {runHours} h in a row with at most {cloudPct}% cloud, but it could not be refreshed".
- `nextNightText(next)`:
  - found: "Next night worth a look: {formatNightDate(date)} — {level}, {verdictReasonText}";
  - none with a date: "No clear night in the forecast through {formatNightDate(lastJudgedDate)}";
  - none with null: "The forecast doesn't reach past tonight, so there is no next night to suggest yet".
- `noDarknessCauseText({ latitudeDeg, minSunAltitudeDeg, thresholdDeg, bortle })`. The latitude is `Math.round(|lat|)` with N/S; the sinking depth is `Math.trunc(|minSunAltitudeDeg|)`, so it always reads as less than the threshold.
  - If `minSunAltitudeDeg ≥ 0`: "At {lat}° {N|S} at this time of year the sun stays above the horizon all night".
  - Otherwise: "At {lat}° {N|S} at this time of year the sun only sinks {depth}° below the horizon, short of the {|threshold|}° your Bortle {bortle} sky needs".
- `darkReturnText(result, timeZone)`:
  - found: "The dark window returns on the night of {formatNightDate(date)} ({start}–{end})", with times from `formatTime` in the site's zone;
  - null: "It does not return within the next year".
- Latitude to the whole degree appears only on the user's own page: never in a URL or a log (coordinate-privacy NFR).

#### 2. View model

**File**: `src/lib/tonight/build.ts`

**Intent**: `buildTonight` decides which explanation applies and hands the page finished strings.

**Contract**:
- `TonightInput.forecast` becomes `ForecastResult | null`, the whole service result, so `fetchedAt` and `fallback` reach the view. The verdict gets `{ fallback: forecast?.fallback ?? false }`.
- `TonightView` gains:
  - `forecastStatus: { kind: "fresh" | "fallback" | "none"; text: string }`, with the age taken from `now - fetchedAt`;
  - `explanation: TonightExplanation | null`, where `TonightExplanation = { kind: "weather-no-go"; nextText: string } | { kind: "no-darkness"; causeText: string; returnText: string }`.
- `weather-no-go` applies when the verdict reason is `cloudy`. It comes from `nextNightNotNoGo`, using the same threshold, forecast and fallback flag.
- `no-darkness` applies when the reason is `no-darkness`. It comes from `darkWindowReturn` and the `none` window's fields.
- Every other reason gives `explanation: null`. The ranking rules are unchanged.

#### 3. Rendering

**File**: `src/components/tonight/VerdictCard.astro`, `src/pages/tonight.astro`

**Intent**: The explanation sits where the ranking would have been, and the forecast line is always visible.

**Contract**:
- `VerdictCard` takes `forecastStatus` and `explanation` props:
  - it renders the explanation lines under the verdict heading (weather: `nextText`; no darkness: `causeText`, then `returnText`, replacing the bare "No dark window tonight");
  - it renders the forecast line under the dark-window line, in the existing muted style;
  - the fallback and none kinds use a tone that stands out from the fresh one.
- `tonight.astro` passes `result` (not `result?.forecast`) to `buildTonight`, and passes the two new fields to `VerdictCard`.
- The page has no other logic changes, and the `TONIGHT_FAILED` catch stays.

#### 4. Tests

**File**: `src/lib/tonight/build.test.ts`, `src/lib/tonight/format.test.ts`

**Intent**: Pin the composition and each template.

**Contract**:
- **Build:**
  - a weather no-go gives `ranking` null and a `weather-no-go` explanation whose text names the next night (clouds injected per night);
  - a Tromsø 2026-06-21 night gives a `no-darkness` explanation with cause and return text, and a null ranking;
  - a fresh result, a fallback result and a null result give the three forecast status kinds and texts;
  - a fallback go becomes marginal and still has a ranking;
  - a forecast that ends mid-window gives marginal / no weather data with a ranking.
- **Format:**
  - `formatAge` at −1 s, 59 s, 1 min, 59 min, 60 min, 47 h 59 min and 48 h;
  - every `nextNightText` branch and both `darkReturnText` branches;
  - `noDarknessCauseText` for the midnight-sun case, a normal case and a southern-hemisphere case, plus the truncation case: −17.8° at a −18° threshold reads 17°;
  - the `fallback-cap` reason text.
- The existing case "no forecast covers the dark window" stays (inner hours with no data).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- **No darkness.** On `npm run dev`, a site at McMurdo Station (77.85° S, 166.67° E, Bortle 1, zone resolved automatically) shows:
  - a no-go verdict with no ranking;
  - "At 78° S at this time of year…";
  - a return date that matches the first night with astronomical darkness in an independent twilight table (timeanddate.com, McMurdo) to within one night.

  Delete the site afterwards.
- **Weather no-go.** With `FORECAST_BASE_URL` pointed at a local stub (100% cloud on nights 1–2, 10% on night 3, stale KV entry cleared), Tonight shows a no-go verdict, no ranking, and "Next night worth a look: …" naming night 3. With 100% cloud on all nights it shows "No clear night in the forecast through …".
- **Outage with a saved copy.** After a normal load, and once the stored entry is over 1 h old, setting `FORECAST_BASE_URL` to an unreachable address shows the "Weather service unreachable — showing the forecast from … ago" line, the verdict never shows go, and the ranking still appears on a marginal night.
- **Outage with no saved copy.** With the unreachable URL and the site's coordinates nudged by 0.01° (so the stored copy no longer matches), Tonight shows "No weather data…", a marginal verdict with a ranking, and no error page.
- **Normal night.** Against the real API, Tonight shows "Forecast updated … ago" and no explanation block on a go or marginal night.
- **Deploy.** After `npx wrangler deploy`, `/tonight` renders on the live URL and Workers Logs show no `exceededCpu` / 1102 for it.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Verdict: the coverage boundaries (series ends mid-window, starts late, empty, inner gap) and the fallback cap alongside the humidity cap.
- Outlook: every branch of `nextNightNotNoGo`, and `darkWindowReturn` pinned to a night-by-night reference across a sweep of start dates and three thresholds.
- Forecast service: the `fallback` flag on each path.
- Tonight build and format: each explanation, each forecast status, and each template boundary.

### Integration Tests:

- None added. The page is exercised by the manual checks; the smoke script doesn't cover Tonight.

### Manual Testing Steps:

1. Add the McMurdo site, open Tonight, and compare the return date against timeanddate.com.
2. Serve a stub forecast (a small script in the scratchpad that writes Open-Meteo-shaped JSON with `unixtime` hours around the current dates), point `FORECAST_BASE_URL` at it, clear the site's KV entry, and load Tonight twice: once with a clear night 3, once with all nights cloudy.
3. Point `FORECAST_BASE_URL` at `http://127.0.0.1:9` with an entry over 1 h old, then again after nudging the coordinates.
4. Deploy and check Workers Logs.

## Performance Considerations

- Nights with no darkness skip the ranking (about 4 ms locally) and run the stride search instead: about 28 minimum-altitude checks in the worst case, compared with 149 for a night-by-night scan (16 ms measured).
- A weather no-go skips the ranking and adds two `darkWindow` plus `verdict` evaluations, which is negligible.
- A normal night adds only the forecast line.
- CPU re-measurement on Workers Free stays tracked in #22. The deploy check here only confirms there is no `exceededCpu`.

## Migration Notes

- No database changes.
- KV entries keep their shape and key. An entry cached with the 3-day series is replaced on the next refresh, within 1 h. Until then, night 3 correctly reads as "no weather data", not as a no-go.

## References

- Roadmap: `context/foundation/roadmap.md` S-04 (GitHub #8)
- PRD: `context/foundation/prd.md`: US-02, FR-011, FR-020, FR-023, the NFR forecast outage, the guardrails "never a confident go" and "forecast outage degrades, never blanks", invariants 2 and 5
- Prior slice: `context/archive/2026-09-25-tonight-verdict-and-ranking/plan.md` (verdict rules, forecast cache, the S-04 deferrals at lines 38 and 46)
- CPU baseline: `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md` § CPU; `context/foundation/infrastructure.md:249`
- Similar implementation: `src/lib/tonight/build.ts:110-163`, `src/lib/engine/verdict.ts:49-83`, `src/lib/engine/sun.ts:52-100`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Engine rules and forecast provenance

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — 85069cf
- [x] 1.2 Type check passes: `npx astro check` — 85069cf
- [x] 1.3 Lint passes: `npm run lint` — 85069cf
- [x] 1.4 The engine purity guard covers `outlook.ts` and passes (part of `npm test`) — 85069cf

### Phase 2: Tonight explanations and forecast status

#### Automated

- [x] 2.1 Unit tests pass: `npm test`
- [x] 2.2 Type check passes: `npx astro check`
- [x] 2.3 Lint passes: `npm run lint`
- [x] 2.4 Production build succeeds: `npm run build`

#### Manual

- [x] 2.5 McMurdo site shows the no-darkness cause and a return date matching an independent twilight table within one night
- [x] 2.6 Stub forecast shows a weather no-go with the next night, and the "no clear night through" line when all nights are cloudy
- [x] 2.7 Outage with a saved copy shows its age, never shows go, and keeps the ranking on a marginal night
- [x] 2.8 Outage with no saved copy shows "No weather data", a marginal verdict with a ranking, and no error page
- [x] 2.9 A normal night shows "Forecast updated … ago" and no explanation block
- [ ] 2.10 Deployed `/tonight` renders and Workers Logs show no `exceededCpu` / 1102
