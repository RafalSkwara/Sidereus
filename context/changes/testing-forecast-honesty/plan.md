# Test rollout Phase 1: Forecast honesty — Implementation Plan

## Overview

Prove that Risk #1 of `context/foundation/test-plan.md` is protected. With a partial, stale, partly missing or absent forecast:

- Tonight never reaches level `go`, so the headline is never the bare "Clear".
- The Moon, the dark window and the targets stay on screen.
- Nothing turns into an error page.

The engine's own verdict rules are already unit-tested. This plan covers the layers above them:

- provider body → mapper → verdict;
- forecast service + KV cache → Tonight view → loader.

It also fixes the two honesty gaps found by research and the plan review:

- a degenerate 200 overwrites the last good saved forecast;
- a missing dark-window hour can hide a humid hour and turn a capped night into a confident go.

## Current State Analysis

From `context/changes/testing-forecast-honesty/research.md` and `reviews/plan-review.md`:

- **Honesty is enforced in one pure place, `src/lib/engine/verdict.ts`:**
  - A null forecast, or a series that does not span the dark window's whole UTC hours, is marginal / `no-weather-data` (`:77-84`).
  - A missing hour inside the series breaks a clear run (`:52`).
  - A saved copy served after a failed refresh caps a go at marginal (`:100-102`).
  - These rules have unit tests over crafted series (`verdict.test.ts:106-177`, `outlook.test.ts:70-263`, `build.test.ts:301-650`).
- **The humidity cap only sees the hours that are present** (`verdict.ts:92`, `:96`). Example: a 3 h run at 10 % cloud plus one hour at 80 % cloud and 95 % humidity is marginal / `humidity-cap`. With that hour missing it becomes **go**. The plan review probe confirmed this (F1). `verdict.test.ts:113-119` currently asserts `go` for a spanning series with missing hours inside the window.
- **The mapper and the service validate shape, not usefulness:**
  - Open-Meteo nulls are dropped (`src/lib/forecast/open-meteo.ts:69-74`).
  - A 200 with `time: []`, all-null cloud, any length or out-of-range values passes (`:27-38`).
  - `getForecast` writes any parsed 200 over the stored copy (`src/lib/forecast/service.ts:138-151`).
  - When the fetch throws, it serves a stored copy of any age as `fallback` (`:152-154`).
  - "Usable" means only that the coordinates match (`:129`).
- **Untested today:**
  - raw provider bodies taken through the service into the view;
  - the overwrite;
  - fallback after a network error, a timeout or an invalid 200 with a copy present (only a 503 is tested, `service.test.ts:82`);
  - an aged copy losing nights 2-3;
  - `loadTonight`'s no-error-page behaviour. No test calls `loadTonight`; `build.test.ts:36` imports only `logHref` from `load.ts`.
- **`loadTonight` hard-wires `globalThis.fetch`** (`src/lib/tonight/load.ts:140`). It requires `defer` and reads gear through `siteStore`, `telescopeStore` and `eyepieceStore` (`@/lib/gear/store`), plus `observationStore.listForRanking` (`@/lib/observations/store`). The module imports Supabase only as a type, so it loads in Vitest.

## Desired End State

- **Phase 1 unit suite.** Provider bodies with interior nulls, edge nulls, empty or all-null series, unequal lengths or out-of-range values never yield level `go` once mapped and judged. This is proven against the PRD thresholds and metamorphic relations, never against values copied from `verdict.ts`. A go-shaped night with any dark-window hour missing reads marginal / "No forecast".
- **Phase 2 integration suite.** It drives `getForecast` (in-memory cache, fake fetch, fixed clock) into `buildTonight` and proves the user-visible states:
  - an outage with and without a copy;
  - a fallback after every failure kind;
  - an aged copy dropping night 3 to "No forecast";
  - a degenerate 200 that no longer destroys a usable copy;
  - a night in progress that keeps its copy;
  - the Moon, dark window and ranking still present in every degraded state.
- **`getForecast` keeps a usable saved copy when a 200 is incomplete**, serving it as `fallback` (rule under Critical Implementation Details).
- **The mapper rejects cloud or humidity outside the inclusive range 0-100** as an invalid response.
- **A loader test** proves that an outage still builds a view through `loadTonight`. It also proves that a build failure degrades to `tonight.failed` with the gear lists intact, never a throw.
- **`test-plan.md`** gets the corrected §2 Risk #1 wording (labelled as the research backport), a §6.1 cookbook entry and a §6.6 Phase 1 note.

Verify with the commands under each phase, plus the named break checks: reverting each production change turns its named tests red.

### Key Discoveries:

- **The service needs no new test infrastructure.** `getForecast` already takes `fetchFn`, `cache` and `now` (`service.ts:54-67`). `src/lib/forecast/test-helpers.ts` already has `memoryCache`, `fakeFetch`, `jsonResponse` and `openMeteoBody`:
  - `openMeteoBody` accepts `null` in both the cloud and humidity arrays;
  - `fakeFetch` passes a rejection from `respond` through, so a network error or a `DOMException("…", "TimeoutError")` is simulated by rejecting, since it ignores `init.signal`.
- **`buildTonight(input, locale, options)`** (`build.ts:588-592`) takes `TonightInput = { site, telescope, eyepieces, forecast, now, log?, catalogue? }` (`:73-88`).
  - Fixtures `WARSAW` (bortle 6 → −15° threshold), `TELESCOPE`, `EYEPIECES` and `NOW = 2026-10-10T18:00Z` are at `build.test.ts:78-126` and are not exported.
  - The Warsaw dark windows the review probe measured: night 1 is 10-10 17:25Z → 10-11 03:20Z, night 2 is 10-11 17:23Z → 10-12 03:22Z, and night 3 is 10-12 17:21Z → 10-13 03:24Z.
- **View fields to assert on** (`build.ts:386-470`):
  - `view.verdict.level` and `.reason.kind`;
  - `view.headline.id` / `.text` (`"go" | "fallbackCap" | "noForecast" | …`);
  - `view.forecastStatus.kind` (`fresh | fallback | none`) and `.text`; the age sits inside the text, e.g. "… from 3 h ago";
  - `view.moonCard`;
  - `view.darkWindow`;
  - `view.ranking.entries`;
  - `view.nights[i].level` / `.headline`.
- **The card is night 1 of the same `sevenNightOutlook` call as the strip** (`build.ts:638-646`).
- **The verdict's headline mapping is `createFormatter(locale).skyHeadline(verdict)`** (`format.ts:294`, `:689`), not a standalone export. `format.ts` imports nothing server-only.
- **Tonight's dark window ends at most about 23.6 h after `now`.** The review probe found this over six sites and three thresholds through 2026. The bound comes from the civil-dawn rollover of `tonightDateFor` (`sun.ts:101-105`). A night in progress started up to about 15 h **before** `now`.
- **PRD headline table** (`prd.md:315-322`): go → "Clear"; fallback cap → "Clear (old forecast)" (marginal); no weather data → "No forecast". The protected property is level ≠ `go` and headline ≠ `go`, not "the word Clear never appears".
- **A new headline id would need a migration.** `sky_checks.headline` has a check constraint (`supabase/migrations/20261003120000_sky_checks.sql:28`). The gap rule therefore reuses the existing `no-weather-data` reason and "No forecast" headline.

## What We're NOT Doing

- Re-testing the `verdict()` rules already covered in `verdict.test.ts` / `outlook.test.ts`: truncated window, empty series, fallback cap, humidity precedence.
- Changing verdict thresholds, headlines, copy or the `sky_checks` headline set. The only verdict change is one coverage rule: a missing dark-window hour blocks go. It reuses the existing `no-weather-data` reason.
- An age cap on fallback copies. Archive decision `2026-09-25-no-go-and-no-darkness-explanations/plan.md:54` says "whatever its age", and the PRD sets none.
- Logging or reporting the dropped error causes on the forecast path, including the new silent "degenerate 200 → fallback" path. Dropping causes is a recorded privacy decision (`open-meteo.ts:9-11`, `service.ts:19`); this belongs to `/10x-observability-audit`.
- A negative cache for a persistently degenerate provider (see Performance Considerations); possible follow-up work.
- The inferred `defer`-throws edge case (`service.ts:145-148`), and the `island.ts` `kvForecastCache()` throw path, which can't be imported in Vitest.
- E2E forecast states, or new modes for `tests/e2e/forecast-fixture.mjs`. The test plan has Phase 1 as unit + integration. The fixture's −48 h…+216 h all-clear body passes both new rules.
- Showing the forecast age on the focused Tonight pages, and the `night: "next"` night-7 outlook coverage.
- Updating `test-plan.md` §3 status. The `/10x-test-plan` orchestrator reconciles it.

## Implementation Approach

Test-first, cheapest layer first:

- **Phase 1** adds pure unit tests over the mapper and verdict, with two red→green production fixes: range validation, and the dark-window gap rule.
- **Phase 2** adds the integration seam (service + cache + `buildTonight`), drives the keep-copy fix red→green, then adds the loader test (with an optional `fetchFn` seam) and the docs.

Commit once per phase, only when that phase's automated checks are green. Red tests and their fix land in the same commit.

**Oracle rule for every new test.** Expected levels and headlines come from one of these independent sources:

- the PRD thresholds (`prd.md:668-672`): go is a contiguous run of at least 2 h below 30 % cloud; marginal is at least 1 h below 65 %; humidity above 90 % caps at marginal;
- the PRD headline table;
- the agreed coverage rules recorded in this plan;
- a metamorphic relation.

They never come from reading `verdict.ts`. The one formatter decision a test relies on is that a no-go with no present window hour reads "No forecast" (`format.ts:139`). It is cited as a code decision, and that case asserts only "not go, headline `noForecast`". Series are hand-built with at least 12 h of margin, so an expected result never depends on the exact dark-window minutes.

## Critical Implementation Details

- **Gap rule order in `verdict`.** The order of checks is:
  1. the existing span check (`no-weather-data`);
  2. the go run;
  3. the humidity cap (known damp wins);
  4. **then** any undefined slot in the window → marginal / `no-weather-data`;
  5. then the fallback cap.
  
  Marginal and no-go outcomes keep today's semantics, in which a missing hour is "not clear", so the rule only ever lowers a would-be go. `clearIntervals` and `cloudOutlook` are unchanged.
- **Complete-response rule in `getForecast`.** A 200 is *complete* when its present hours span from `floor_hour(now) − 24 h` to `floor_hour(now) + 96 h`: the first present hour ≤ the lower bound, and the last present hour ≥ the upper bound. Interior holes don't count against it.
  - Every real response (`past_days=1`, `forecast_days=8`) is complete.
  - The window covers a night in progress (started ≤ about 15 h earlier) and verdict nights 1-3 of both the tonight and the next-night builds (night 3 of the next-night build ends ≤ 96 h out).
  - On an **incomplete** 200, the stored copy is served as `fallback` (no write) only if the copy has matching coordinates **and** spans `floor_hour(now) − 24 h` to `floor_hour(now) + 24 h`.
  - Otherwise behave as today: return the new series with `fallback: false` and store it.
  - The constants live in `service.ts` next to `FORECAST_FRESH_MS`. They are not PRD tunables, so they don't belong in `parameters.ts`.
- **Mocking in the loader test.** `vi.mock` is hoisted per file.
  - Mock `@/lib/gear/store` with `importOriginal` and spread it: `build.ts:50` and `tonight-date.ts:2` import `toEngineSite` from it. Replace only `siteStore`, `telescopeStore` and `eyepieceStore` with list stubs.
  - Replace `@/lib/observations/store`'s `observationStore` the same way.
  - Wrap `buildTonight` via `vi.mock("@/lib/tonight/build", async (importOriginal) => …)` with a `vi.fn` that defaults to the real implementation. The failure case then uses `mockImplementationOnce` to throw.
  - Pass a no-op `defer` and any non-null object as `supabase`.
  - Don't reference store methods unbound (`vi.mocked(siteStore.list)`), because `@typescript-eslint/unbound-method` fails lint. Keep the `vi.fn` handles in local variables instead.
  - Never mock the verdict or the engine.

## Phase 1: Provider body to verdict (unit)

### Overview

Prove at the cheapest layer that nothing Open-Meteo can send in a 200 yields a confident go once it is mapped. Close the out-of-range and the hidden-humid-hour holes.

### Changes Required:

#### 1. Degraded-body unit suite

**File**: `src/lib/forecast/degraded-forecast.test.ts` (new)

**Intent**: Run real provider-shaped bodies (`openMeteoBody`) through `mapForecastResponse` and then `verdict`, over a fixed synthetic dark window built like `verdict.test.ts:16-24`. Assert level, reason and headline from the PRD rules and the agreed gap rule. This shows that both "no cloud data for an hour means no cloud" and "a 200 is a usable series" are false.

**Contract**: each case has a hand-stated expectation:

- **One null cloud hour in the middle of the only 2 h clear run** (a go-shaped night, cloud 10 %): not go.
- **Same, but only humidity null at that hour**: the same outcome. An hour needs both values.
- **The hidden humid hour (F1).** A 3 h run at 10 % cloud plus one hour at 80 % cloud and 95 % humidity is marginal (`humidity-cap`) with the hour present. With that hour's humidity or cloud null it is marginal / `no-weather-data`, **not go**. This is red until change 3.
- **A go-shaped night with a missing dark-window hour outside the run**: marginal, headline `noForecast`. Red until change 3.
- **Nulls on the series' trailing hours, covering the end of the dark window**: marginal / `no-weather-data`, never `cloudy`.
- **Leading nulls covering the window's start**: marginal / `no-weather-data`.
- **Every window hour null, with present hours on both sides**: not go. `createFormatter("en").skyHeadline(v).id === "noForecast"`; this mapping is a code decision, `format.ts:139`.
- **`time: []` and an all-null cloud array**: `{ hours: [] }` → marginal / `no-weather-data`.
- **Unequal array lengths**: throws `FORECAST_RESPONSE_INVALID`. This is the refine at `open-meteo.ts:34-37`, untested today.
- **Cloud −5 or 150, or humidity 101**: throws `FORECAST_RESPONSE_INVALID`. Red until change 2.
- **Cloud and humidity at exactly 0 and exactly 100**: accepted. This is the inclusive boundary.
- **Metamorphic property** over a seeded generator: a small inline PRNG, a fixed seed, about 200 random series and windows. For each, null a random subset of hours, then check:
  - **(a)** if the nulled series' verdict is `go`, the original's was `go`;
  - **(b)** when the nulled series still spans the window and the original was not go, the nulled verdict is not go;
  - **(c)** `fallback: true` never yields `go`.
  
  The property compares two verdicts and never hard-codes an expectation. A no-go becoming marginal / `no-weather-data` through edge nulls is allowed by design.

#### 2. Range validation in the mapper

**File**: `src/lib/forecast/open-meteo.ts`

**Intent**: Treat cloud cover or relative humidity outside the inclusive range 0-100 as a broken provider contract. The response is then invalid, and the service falls back like any other failed refresh; a negative cloud value would otherwise count as clear. Rejecting the whole response rather than dropping the hour was chosen to match the fallback path. The cost is that, with nothing stored, the whole 8-day series is lost. There is no evidence the provider ever sends such values.

**Contract**: the `responseSchema` element types become `z.number().min(0).max(100).nullable()` (zod 4.6.5). An out-of-range value raises the existing fixed `FORECAST_RESPONSE_INVALID`. Update the module doc comment.

#### 3. A missing dark-window hour blocks go

**File**: `src/lib/engine/verdict.ts` and `src/lib/engine/verdict.test.ts`

**Intent**: A go-shaped night with any whole UTC hour of the dark window missing reads marginal / `no-weather-data`, i.e. "No forecast". A missing hour could hide a humid or cloudy spell the cap would have caught (PRD `prd.md:95-97`: "Where the forecast is uncertain, 'marginal' must be reachable rather than rounding up to 'go'").

**Contract**:

- `verdict()` follows the order under Critical Implementation Details. The return type and reason kinds are unchanged.
- Update the module doc comment (`verdict.ts:4-16`).
- `verdict.test.ts:113-119` ("still breaks a run at a missing hour when the series spans the window") currently expects `go` for `[20, 20, null, 20, null, 20]`. It changes to marginal / `no-weather-data`. This is a requirement change decided in plan review F1, not an assertion bent to fit, and the commit message says so.
- The review probe showed this is the only existing test the rule turns red.

### Success Criteria:

#### Automated Verification:

- New suite passes: `npx vitest run src/lib/forecast/degraded-forecast.test.ts`
- Break check, range: stash the `open-meteo.ts` change, run the new suite, see the cloud −5 / 150 and humidity 101 cases fail, restore
- Break check, gap rule: stash the `verdict.ts` change, run the new suite, see the hidden-humid-hour, missing-hour-outside-the-run and property (a) cases fail, restore
- Full unit suite passes: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npx eslint . --ignore-pattern '.claude/**'`

**Implementation Note**: every command needs the `nvm use` prefix (CLAUDE.md tripwire). Plain `npm run lint` runs out of memory while `.claude/worktrees/` exists, so use the eslint line above.

---

## Phase 2: Service, Tonight view and loader (integration) + docs

### Overview

Prove the user-visible states end to end through the real forecast service and view builder. Fix the degenerate-200 overwrite test-first. Prove the loader never turns a forecast problem into an error, and record the pattern in the test plan.

### Changes Required:

#### 1. Service suite: degenerate-200 red tests and the stale-entry update

**File**: `src/lib/forecast/service.test.ts`

**Intent**: Pin the missing service behaviours. Write the overwrite cases first, so they fail against today's code. Update the existing stale-entry test, whose 2-hour `liveResponse` becomes incomplete under the new rule.

**Contract**:

- `liveResponse` (`:24`) becomes a body spanning `now − 24 h`…`now + 96 h` (or an `openMeteoBody` over the real request range), and the stored-JSON assertion at `:53-61` follows it. This is a requirement change: a short 200 is no longer a successful refresh.
- New cases:
  - **A usable stored copy, then an empty 200.** The copy is 2 h old, has matching coordinates and spans −24 h…+24 h; the 200 has `time: []`. The result is the stored copy with `fallback: true` and `fetchedAt` equal to the stored time, and no `put` happened. Red today.
  - **The same, with an all-null 200 and with a 200 ending 6 h after `now`.** The same outcome. Red today.
  - **A night in progress.** At `now` = 2026-10-11T00:30Z, a 200 starting at 2026-10-11T00:00Z with a usable copy present gives the stored copy as `fallback`. Red today.
  - **A degenerate stored copy (an earlier empty 200), then another degenerate 200.** The new series comes back with `fallback: false` and is stored. The useless copy does not win.
  - **A degenerate 200 with no stored copy.** It returns the degenerate result with `fallback: false` and stores it, as today.
  - **A complete 200 with a stored copy.** It replaces the copy. This is the happy-path regression guard.
  - **Fallback with a copy present after a network rejection, a timeout rejection and an invalid-JSON 200.** Only a 503 is tested today.

#### 2. Keep a usable copy on an incomplete 200

**File**: `src/lib/forecast/service.ts`

**Intent**: Treat an incomplete 200 as a failed refresh when a usable stored copy exists: serve the copy flagged `fallback` and leave it in KV. Otherwise keep today's behaviour.

**Contract**:

- New exported constants for the −24 h / +96 h complete window and the +24 h stored-copy window, plus the predicates defined under Critical Implementation Details. `getForecast`'s return type and states are unchanged.
- Update the module header bullet list, the `ForecastResult.fallback` JSDoc (today "True only when the fetch failed…" → "the refresh failed or returned an incomplete series…") and the `load.ts:137-138` comment.

#### 3. Forecast-to-view integration suite

**File**: `src/lib/tonight/forecast-honesty.test.ts` (new)

**Intent**: Drive `getForecast` → `buildTonight` with no mocks below the fetch, and assert what the user sees. Site, telescope and eyepiece fixtures are copied locally, using the Warsaw and `build.test.ts` shapes, with `now` = 2026-10-10T18:00Z. Provider bodies span the real request range (from 00:00Z the day before the fetch date, 216 hours). They are all clear (cloud 0, humidity 40) unless a case says otherwise.

**Contract**: the cases, with expectations from the PRD headline table, the agreed rules and calendar arithmetic with at least 12 h of margin:

- **A fresh full body.** `view.verdict.level === "go"`, headline id `go`, `forecastStatus.kind === "fresh"`. This baseline proves the fixture is go-shaped.
- **An outage (503) with nothing stored:**
  - night 1 is marginal with headline `noForecast`, and `forecastStatus.kind === "none"`;
  - `moonCard`, `darkWindow` and a non-empty `ranking.entries` are present;
  - nights 2-3 have headline `noForecast`.
- **A copy stored 3 h earlier through a first successful call, then an outage.** There is one case each for a 503, a network rejection and an invalid 200:
  - night 1 is marginal with headline `fallbackCap` ("Clear (old forecast)");
  - `forecastStatus.kind === "fallback"`, and the text contains "3 h" (`en.ts` `age.hours`);
  - it is never `go`.
- **A copy fetched 2026-10-05T06:00Z, then an outage.** The series ends 2026-10-12T23:00Z. Nights 1-2 are marginal `fallbackCap`. Night 3 is `noForecast`: its window runs from 10-12 17:21Z to 10-13 03:24Z, which is beyond the series.
- **A usable copy stored 2 h earlier, then an empty 200.** The view still shows `fallbackCap` from the copy, with status `fallback`, not `noForecast`. This is the user-visible face of change 2.
- **A body whose trailing hours are null from 2026-10-10T20:00Z** (no stored copy). Night 1 has headline `noForecast`, never `go` or `no-go`. The Moon card and ranking are present.
- **Every degraded case above**: `buildTonight` does not throw, and no night 1-3 has level `go`.

#### 4. Optional fetch seam on the loader

**File**: `src/lib/tonight/load.ts`

**Intent**: Let tests pass a fake fetch instead of stubbing the global. This mirrors `getForecast`'s own `fetchFn`.

**Contract**: `LoadTonightInput.fetchFn?: typeof fetch`, defaulting to `globalThis.fetch.bind(globalThis)`. `island.ts` is unchanged; it builds the input without `fetchFn` (`island.ts:42-57`).

#### 5. Loader no-error-page tests

**File**: `src/lib/tonight/load.test.ts` (new)

**Intent**: Prove the PRD's "neither case produces an error page" at the loader:

- a forecast outage still yields a built view;
- a failure inside the build degrades to the `tonight.failed` key, with the gear lists intact, instead of throwing.

**Contract**: mocks as described under Critical Implementation Details, a dummy non-null `supabase`, `memoryCache()`, a no-op `defer` and a failing `fetchFn`. Two cases:

- **Outage, nothing stored:** `view` is non-null, `tonightError` is null and `view.headline.id === "noForecast"`.
- **`buildTonight` throws once:** `loadTonight` resolves with no rejection, `view` is null, `tonightError === "tonight.failed"`, and `sites` and `telescopes` are still populated.

#### 6. Test-plan updates

**File**: `context/foundation/test-plan.md`

**Intent**: Backport the research and review corrections, and record the pattern for the next degraded-forecast test.

**Contract**:

- **§2 Risk Response Guidance, row #1**, labelled as the research-sanctioned backport (§1-§5 are otherwise frozen):
  - "never 'Clear'" becomes "level never go and headline never the bare 'Clear'";
  - "last forecast, N hours old" becomes "the last saved forecast with its age";
  - add "a degenerate 200 must not replace a usable saved copy" and "a missing dark-window hour must not allow go".
- **§6.1** replaces its TBD with:
  - which file to use per layer;
  - the helpers to use;
  - the oracle rule (PRD thresholds, metamorphic relations, never values copied from `verdict.ts`);
  - the wide-margin series tip;
  - the loader-mock gotcha (spread `importOriginal`).
- **§6.6:** add a 2-3 line Phase 1 note.
- Bump `Last updated`.

### Success Criteria:

#### Automated Verification:

- Service suite passes: `npx vitest run src/lib/forecast/service.test.ts`
- Break check, keep-copy: stash the `service.ts` change, run the service suite, see the empty, all-null, short and night-in-progress keep-copy cases fail, restore
- Integration suite passes: `npx vitest run src/lib/tonight/forecast-honesty.test.ts`
- Loader suite passes: `npx vitest run src/lib/tonight/load.test.ts`
- Full unit suite passes: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npx eslint . --ignore-pattern '.claude/**'`

#### Manual Verification:

- Read `test-plan.md` §2 row #1, §6.1 and §6.6: the wording matches the PRD headline table, and the cookbook names real files and helpers

**Implementation Note**: every command needs the `nvm use` prefix (CLAUDE.md tripwire).

---

## Testing Strategy

### Unit Tests:

- Mapper + verdict over provider-shaped bodies: interior versus edge nulls, humidity-only nulls, the hidden humid hour, a missing hour outside the run, empty, all-null, unequal lengths, out-of-range values and the 0 / 100 boundary.
- A seeded metamorphic property: nulling hours never creates a go, and `fallback` never yields go.
- The updated `verdict.test.ts:113-119` expectation.

### Integration Tests:

- `getForecast` + `memoryCache` + `fakeFetch` + a fixed `now` → `buildTonight`, covering:
  - an outage with and without a copy;
  - every failure kind;
  - an aged copy against the horizon;
  - an incomplete 200 against a usable copy, a degenerate copy, a night in progress, and trailing nulls.
- `loadTonight` with mocked stores and a fake fetch: an outage still builds a view, and a build failure degrades to `tonight.failed`.

### Manual Testing Steps:

1. Review the three test-plan sections against the PRD headline table (`prd.md:315-322`).

## Performance Considerations

With a usable stored copy and a provider that keeps answering incomplete 200s, nothing is written, so every Tonight request refetches until the copy expires (7-day TTL). This matches an outage today, though these are fast 200s rather than 3 s timeouts. Today such a 200 is stored and refetched about hourly. A short negative cache is possible follow-up work and is out of scope. With no usable copy, the incomplete 200 is stored as today, so the call rate is unchanged.

## Migration Notes

None. The KV value schema is unchanged and existing stored copies stay valid. No database change: the gap rule reuses the existing `noForecast` headline id allowed by `sky_checks.headline`.

## Open Risks & Assumptions

- **A degenerate but reachable provider reads as unreachable.** With a usable copy, the fallback status line says "Weather service unreachable — showing the forecast from {age} ago" (`en.ts:801`) even though the provider answered. This is accepted: the copy is unchanged, and the wording is no worse than an outage.
- **The gap rule is pessimistic.** A night with one missing hour and a real clear run reads "No forecast". Real responses probably null trailing hours rather than single interior ones, so this is expected to be rare (research Open Question 4, unverified against the live API).
- **The keep-copy rule can prefer an older saved copy** over a short fresh series that does cover tonight's window. The result stays honest, capped at marginal.

## References

- Research: `context/changes/testing-forecast-honesty/research.md`
- Plan review: `context/changes/testing-forecast-honesty/reviews/plan-review.md`
- Test plan: `context/foundation/test-plan.md` §2 Risk #1, §6.1, §6.6
- PRD: `context/foundation/prd.md:95-101` (guardrails), `:315-322` (headlines), `:668-672` (thresholds)
- Verdict tests to mirror (window helper): `src/lib/engine/verdict.test.ts:16-35`
- Service tests to extend: `src/lib/forecast/service.test.ts:24-130`
- View fixtures to copy: `src/lib/tonight/build.test.ts:78-126`
- Loader mock precedent: `src/lib/tonight/build.test.ts:46-70`
- Prior decision (fallback cap, no age cap): `context/archive/2026-09-25-no-go-and-no-darkness-explanations/plan.md:54`, `:93`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Provider body to verdict (unit)

#### Automated

- [x] 1.1 New suite passes: `npx vitest run src/lib/forecast/degraded-forecast.test.ts`
- [x] 1.2 Break check, range: stash the `open-meteo.ts` change, run the new suite, see the cloud −5 / 150 and humidity 101 cases fail, restore
- [x] 1.3 Break check, gap rule: stash the `verdict.ts` change, run the new suite, see the hidden-humid-hour, missing-hour-outside-the-run and property (a) cases fail, restore
- [x] 1.4 Full unit suite passes: `npm test`
- [x] 1.5 Type check passes: `npx astro check`
- [x] 1.6 Lint passes: `npx eslint . --ignore-pattern '.claude/**'`

### Phase 2: Service, Tonight view and loader (integration) + docs

#### Automated

- [ ] 2.1 Service suite passes: `npx vitest run src/lib/forecast/service.test.ts`
- [ ] 2.2 Break check, keep-copy: stash the `service.ts` change, run the service suite, see the empty, all-null, short and night-in-progress keep-copy cases fail, restore
- [ ] 2.3 Integration suite passes: `npx vitest run src/lib/tonight/forecast-honesty.test.ts`
- [ ] 2.4 Loader suite passes: `npx vitest run src/lib/tonight/load.test.ts`
- [ ] 2.5 Full unit suite passes: `npm test`
- [ ] 2.6 Type check passes: `npx astro check`
- [ ] 2.7 Lint passes: `npx eslint . --ignore-pattern '.claude/**'`

#### Manual

- [ ] 2.8 Read `test-plan.md` §2 row #1, §6.1 and §6.6: the wording matches the PRD headline table, and the cookbook names real files and helpers
