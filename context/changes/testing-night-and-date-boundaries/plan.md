# Test rollout Phase 2: night and date boundaries — Implementation Plan

## Overview

Prove Risk #2 of `context/foundation/test-plan.md` protected. For a fixed instant and site, Sidereus must pick the right "tonight", dark window, Session plan order and log night across the site-zone edges, whatever zone the test runner is in. The edges are:

- the minutes either side of the −6° civil-dawn rollover;
- the 25-hour 24/25 Oct 2026 night in Europe;
- the 23-hour 28/29 Mar 2026 night;
- the 31 Oct / 1 Nov 2026 night in Los Angeles, which is both a month end and a 25-hour night;
- sites far east of UTC (Auckland, Kiritimati).

The work is unit tests in three phases:

1. Engine edges in every zone.
2. Consumers, plus a small extraction of the log form's night logic.
3. A static runner-zone guard and the test plan's cookbook.

Hard date: the European 25-hour night is 24/25 Oct 2026.

## Current State Analysis

From `research.md` (this folder), verified 2026-10-08 at commit 8a11634:

- **No production path we inspected reads the runner's zone.** A grep sweep found no runner-zone reads. Engine output was byte-identical under 4 runner zones, and the full suite (882 tests) passes under 6 (research Summary 1). Runner-zone independence is therefore a regression guard, not a bug fix.
- **"Which night" is decided in two places:**
  - `observingNightDateFor` (`src/lib/engine/night.ts:112-120`, the noon rule);
  - `tonightDateFor` (`src/lib/engine/sun.ts:101-105`). It flips to the next evening when `instant >= darkWindow(..., -6).end`.

  Every consumer keys on those and orders by epoch ms (research "Consumers" table).
- **Existing tests pin Warsaw's autumn change well but leave the other edges open.** `night.test.ts:17`, `:63`, `:77`, `sun.test.ts:105-157` and `build.test.ts:563-588` cover Warsaw 24/25 Oct. They do **not** pin:
  - the −6° rollover at its boundary (`sun.test.ts:159-186` uses −18 and the engine's own `darkEnd`);
  - the spring night beyond its length;
  - any non-Warsaw site through `darkWindow` or `tonightDateFor`;
  - a whole night across a month end;
  - Session plan row order and labels on the DST night;
  - the log form's default night.
- **Log form night logic is inline in the page.** `src/pages/log/new.astro:68` computes `maxNight` as the max of `tonightDateForSite` over all sites, and `:70` defaults the night to `observingNightDateFor(now, site.timeZone)`. That page code is untestable as written. The server bound is per site (`src/lib/observations/store.ts:116`, `:204`). The form documents `maxNight` as a hint (`src/components/observations/ObservationForm.tsx:51-54`).
- **Runner zone is uncontrolled.** Nothing sets `TZ`, `setSystemTime` or fake timers. CI presumably runs in UTC (GitHub default, unverified); the dev machine runs Europe/Warsaw.
- **`purity.test.ts` guards only the engine and Moon-disc code.** It covers `src/lib/engine/` and `src/lib/moon-disc/` with a zone-less `Intl.DateTimeFormat` regex that misses an options object without `timeZone` (`purity.test.ts:31-33`). It has no local-getter rule.

## Desired End State

- `npm test` contains table-driven night-boundary suites. Every case runs under 5 runner zones (UTC, Europe/Warsaw, America/Los_Angeles, Pacific/Kiritimati, Asia/Kolkata), switched in-process. The cases cover 4 sites across 5 edge nights, and all expected values are hand-written calendar literals or published USNO times.
- Tonight's date, its "Mark observed" night, the seven-night strip, the Session plan order and labels, and the offline copy's hand-over are pinned on the DST and month-end nights.
- The log form's night logic lives in a tested pure function with unchanged behaviour.
- A static scan fails the suite if any non-test source under `src/` reads the runner's zone (local `Date` getters or setters, `toLocaleDateString`/`toLocaleTimeString`, local `new Date(y, m, …)`, or `Intl.DateTimeFormat` without `timeZone`).
- `test-plan.md` §6.2 describes how to add a boundary test, and §6.6 carries the Phase 2 note.

Verify: `npm test` is green under the default zone and with `TZ=Pacific/Kiritimati npm test`. Each phase's break check turns its suite red and is reverted.

### Key Discoveries:

- **USNO civil-dawn oracle.** The USNO API (`https://aa.usno.navy.mil/api/rstt/oneday?date=…&coords=…&tz=0`, checked 2026-10-08) gives independent civil-dawn and sunrise times. The engine's `darkWindow(..., -6).end` agrees within 0.5 min on all five edge nights (plan-time probe):

  | Night | USNO civil dawn | USNO sunrise | Engine `end` |
  | --- | --- | --- | --- |
  | Warsaw 24/25 Oct | 2026-10-25 04:44Z | 05:19Z | 04:43:30Z |
  | Warsaw 28/29 Mar | 2026-03-29 03:44Z | 04:18Z | 03:43:42Z |
  | Los Angeles 31 Oct / 1 Nov (34.05, −118.24) | 2026-11-01 13:47Z | 14:13Z | 13:46:52Z |
  | Auckland 24/25 Oct (−36.85, 174.76) | 2026-10-24 16:57Z | 17:24Z | 16:57:17Z |
  | Kiritimati 24/25 Oct (1.87, −157.4) | 2026-10-24 15:51Z | 16:12Z | 15:50:50Z |
- **Night spans** (plan-time probe; also derivable by hand from the zones' DST rules):
  - Warsaw 2026-03-28: 11:00Z to 2026-03-29T10:00Z (23 h).
  - Los Angeles 2026-10-31: 19:00Z to 2026-11-01T20:00Z (25 h).
  - Auckland 2026-10-24: 2026-10-23T23:00Z to 2026-10-24T23:00Z (24 h).
  - Kiritimati 2026-10-24: 2026-10-23T22:00Z to 2026-10-24T22:00Z (24 h).
- **Wall-clock traps** (plan-time probe, matching hand reasoning):
  - Los Angeles:
    - 2026-11-01T07:30Z (00:30 PDT, wall date 1 Nov) gives "2026-10-31";
    - 08:30Z and 09:30Z (both passes of 01:30) give "2026-10-31";
    - 19:59Z (11:59 PST, after dawn) gives "2026-11-01";
    - 2026-10-31T18:59Z (11:59 PDT, after the 30 Oct night's dawn) gives "2026-10-31";
    - 2026-10-25T06:00Z (UTC date 25, wall 23:00 on 24 Oct) gives "2026-10-24".
  - Kiritimati 2026-10-24T18:00Z (UTC date 24, wall 08:00 on 25 Oct) gives "2026-10-25".
  - Warsaw:
    - 2026-03-29T01:30Z (03:30 CEST, just after the skipped hour) gives "2026-03-28";
    - 2026-10-25T00:30Z and 01:30Z (both passes of 02:30) give "2026-10-24";
    - 2026-10-25T10:59Z gives "2026-10-25".
- **Runtime zone switching.** Node v24.21.0 honours a runtime `process.env.TZ` change: `Date` local getters and the default `Intl` zone switch immediately (research probe). Vitest runs a file's tests sequentially in one worker, so a `describe.each` over runner zones with a restore in `afterAll` is safe.
- **Session plan rows** carry `bestAt` (epoch ms) and `bestTime` (`HH:mm`, site zone) (`src/lib/tonight/build.ts:332-344`, `session-plan.ts:10-15`), and sort by `bestAt` (research).
- **Offline hand-over.** `TonightView.validUntil` is the −6° window end (`build.ts:1146`), and `PLANET_WINDOW_SUN_ALTITUDE_DEG` equals `TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG` (both −6, `parameters.ts:221`, `:229`). The copy therefore hands over at the instant "tonight" flips.
- **Test helpers.** `build.test.ts` has local helpers (`uniformForecast`, `result`, `utcWallTime`, `planOf`) and `src/lib/tonight/test-fixtures.ts` exports `WARSAW`, `TELESCOPE`, `EYEPIECES`. The engine fixtures directory is test-only and is skipped by `purity.test.ts` (`purity.test.ts:58-67`).
- **Lint scope.** `src/lib/observations/**`, `src/lib/tonight/**` and `src/pages/log/**` are already in the no-console lint scope (`eslint.config.js:90-99`), so the new log-night module needs no lint edit (lessons.md rule 1 satisfied).

## What We're NOT Doing

- **No change to the multi-site `maxNight` hint** or to the server's per-site bound. The looseness is documented by a test as accepted behaviour (the form lets the user switch site; the server stays correct).
- **No change to `needsNextCopy`**, the 1 h refresh window around dawn (research: read from code, unverified, degrades to a stale notice).
- **No new Stellarium capture.** USNO is the independent oracle for −6°.
- **No CI `TZ` matrix and no `vitest.config.ts` change.** Runner zones switch in-process.
- **No widening of `purity.test.ts`.** The new runner-zone guard is a separate scan with its own scope, because `purity.test.ts` also forbids `new Date()` and `Date.now`, which pages and stores legitimately use.
- **No e2e or db tests** (test plan §3: unit only). `tests/db/observations.test.ts` already pins the server bound against local Supabase.
- **No retune of `TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG`**, and no test that merely restates the constant's value.

## Implementation Approach

Cost × signal order:

1. **Engine first.** The two decision functions feed every consumer, the edge nights are pure inputs, and USNO gives an oracle that doesn't depend on the code under test.
2. **Consumers next.** They prove the decision reaches the view, the plan and the log form intact. The one extraction makes the log page's choice testable.
3. **Static guard last.** It is cheap, covers code the in-process runner-zone table can't reach (pages, islands), and stops the class of bug from coming back.

Oracle rules, applied in every phase:

- expected nights are hand-written calendar literals;
- rollover instants come from USNO, ±5 min for "either side" and ±2 min when comparing the engine's `end`;
- local-time labels come from hand-written UTC offsets (+2 h CEST, +1 h CET, −7 h PDT, −8 h PST), never from `formatTime` or `observingNightDateFor` output.

## Critical Implementation Details

- **Restore `process.env.TZ`.** Save the original value before switching and restore it in `afterAll`, deleting the key when it was unset, so the switch never leaks into another `describe`. Don't use `vi.stubEnv` for `TZ` unless a quick check shows it resets Node's zone cache the same way.
- **Keep the runner-zone helper out of scanned source.** A helper that touches `process.env` must not sit in a scanned engine source file. Put it in `src/lib/engine/fixtures/` (test-only, skipped by `purity.test.ts`).
- **Assert the zone switch itself.** Code in a `describe` body runs at collection under the original zone, and a default-zone `Intl.DateTimeFormat` created before the switch keeps the old zone (plan review F2). So:
  - every call under test runs inside `it` or `beforeAll`, after the switch;
  - each runner-zone block first asserts the switch took effect: `Intl.DateTimeFormat().resolvedOptions().timeZone` equals the zone (accept `Asia/Calcutta` for Asia/Kolkata), and `new Date("2026-10-24T18:00:00Z").getHours()` equals that zone's hand-written hour (UTC 18, Warsaw 20, Los Angeles 11, Kiritimati 8, Kolkata 23).
- **Don't let the Session plan suite pass vacuously.** The order assertion is empty unless the chosen night has rows on both sides of local midnight, and the CET branch of the label oracle is empty without a row after the clock change. Assert both preconditions explicitly: at least one row with `bestAt` before 2026-10-24T22:00Z (midnight CEST), one after it, and one at or after 2026-10-25T01:00Z (plan review F5; today Jupiter and Mars peak at 04:43:30Z).
- **Break checks are logged, not ticked.** Progress rows keep fixed titles. Record each break check's outcome in the phase's "Break-check log" note (below its Success Criteria) and in the phase commit message (plan review F3).

## Phase 1: Engine night edges in every zone (unit)

### Overview

A table-driven engine suite over five edge nights, repeated under five runner zones. It checks the night spans, the −6° window end against USNO, "tonight" either side of civil dawn, and the wall-clock traps.

### Changes Required:

#### 1. Runner-zone helper and USNO reference

**File**: `src/lib/engine/fixtures/runner-zones.ts` (new), `src/lib/engine/fixtures/usno.ts` (new), `src/lib/engine/fixtures/README.md`

**Intent**: Share one way to run a block under several runner zones, and one typed record of the USNO values with their source and check date, so Phase 2 reuses both.

**Contract**:
- `RUNNER_ZONES` lists UTC, Europe/Warsaw, America/Los_Angeles, Pacific/Kiritimati and Asia/Kolkata.
- `useRunnerZone(zone)` registers `beforeAll`/`afterAll` hooks that set and then restore `process.env.TZ` (or an equivalent wrapper used inside `describe.each(RUNNER_ZONES)`).
- `USNO_CIVIL_DAWN` has one entry per edge night: `{ site: engine Site (latitudeDeg, longitudeDeg, elevationM: 0 — USNO's sea-level basis, timeZone), night: "YYYY-MM-DD", civilDawn: ISO Z, sunrise: ISO Z }`, with the five values from Key Discoveries, plus the API URL pattern and `checked: 2026-10-08`. Tests that need a `SiteRecord` (Tonight, log) build one from the entry's site with a `bortle` (plan review F9).
- The README gains a short "USNO references" note (what each value is, how to re-check it, that values are minute-rounded and in UTC) and a line on `runner-zones.ts`: test machinery shared by engine, Tonight and log tests (plan review F10).

#### 2. Night-boundary suite

**File**: `src/lib/engine/night-boundaries.test.ts` (new)

**Intent**: Pin the engine's night decisions on every edge night with expectations the engine cannot have produced, under every runner zone.

**Contract**: `describe.each(RUNNER_ZONES)` wraps four groups, each table-driven. The test file uses `TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG` from `@/lib/engine`.

- **(a) Spans.** `observingNight(date, zone)` start and end equal the hand literals in Key Discoveries for Warsaw 2026-03-28, Los Angeles 2026-10-31, Auckland 2026-10-24 and Kiritimati 2026-10-24.
  - Behaviour asserted: local noon to local noon, 23 h, 25 h or 24 h.
  - Regression caught: a `+24 h` night or a runner-zone noon.
  - Source: research "Probes run", "Existing coverage".
  - Edge: spring forward; US fall back; zones +13 and +14.
  - Anti-pattern avoided: expected spans computed with `localNoon`.
- **(b) Dark window end vs USNO.** For each USNO entry, `darkWindow(site, observingNight(night), TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG)` is a window whose `end` is within ±2 min of `civilDawn`.
  - Behaviour asserted: the rollover instant is civil dawn.
  - Regression caught: a wrong threshold (−18 would land about an hour early), a search started on the wrong night, or a zone slip of an hour.
  - Source: research "Architecture Insights" (oracle).
  - Edge: DST nights, month end, the date line.
  - Anti-pattern avoided: `darkEnd` taken from the engine as the expectation.
- **(c) Either side of the rollover.** For each USNO entry, `tonightDateFor(site, civilDawn − 5 min, …)` is the entry's night and `tonightDateFor(site, civilDawn + 5 min, …)` is the next calendar date, written as a literal.
  - Behaviour asserted: the minutes either side of civil dawn.
  - Regression caught: a flip at the −18° end or at local noon; a flip a day off in far zones.
  - Source: research "Which night is tonight".
  - Edge: the 25 h and 23 h nights; 31 Oct → 1 Nov in Los Angeles.
  - Anti-pattern avoided: the instant derived from the helper under test.
- **(d) Wall-clock traps.** Every instant → night pair listed under "Wall-clock traps" in Key Discoveries, with `tonightDateFor` at the production threshold.
  - Behaviour asserted: noon rule plus rollover, with repeated and skipped hours, a wall date unlike the night, and a UTC date unlike the night.
  - Regression caught: reading the UTC or runner date instead of the site's wall clock; double-counting the repeated hour.
  - Source: research "Detailed Findings".
  - Edge: both passes of 01:30 / 02:30; the 03:30 CEST just after the gap; 11:59 before noon.
  - Anti-pattern avoided: expectations from `observingNightDateFor`.

Each table row carries a one-line comment with the local wall time, so a reader can check the literal by hand.

### Success Criteria:

#### Automated Verification:

- The new suite passes: `npx vitest run src/lib/engine/night-boundaries.test.ts`
- The new suite passes under a far-east runner zone: `TZ=Pacific/Kiritimati npx vitest run src/lib/engine/night-boundaries.test.ts`
- Break check, then reverted:
  - temporarily setting `TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG` to −12 in `parameters.ts` turns groups (b) and (c) red (plan review F6);
  - temporarily replacing `wall.getUTCHours()` with `wall.getHours()` in `observingNightDateFor` and running `TZ=UTC npx vitest run src/lib/engine/night-boundaries.test.ts` turns group (d) red under at least one switched runner zone. With the process in UTC, red can only come from the in-process switch (plan review F2).

**Break-check log** (2026-10-08): `TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG` = −12 → 50 of 130 red, every (b) and (c) case in all 5 runner zones; restored. `wall.getHours()` in `observingNightDateFor` under `TZ=UTC` → 22 red, (c) and (d) in the switched America/Los_Angeles and Pacific/Kiritimati blocks only; restored.
- Full unit suite, lint and type check pass: `npm test`, `npx eslint . --ignore-pattern '.claude/**'`, `npx astro check`

**Implementation Note**: Commit and push the phase, then continue (the user's run preference: no pause between automated-only phases).

---

## Phase 2: Consumers and the log form's night (unit)

### Overview

Prove the engine's decision reaches Tonight's view, its "Mark observed" night, the seven-night strip, the Session plan and the offline hand-over intact on the edge nights. Then move the log form's night logic out of `new.astro` into a pure function and pin it.

### Changes Required:

#### 1. Log-form nights helper

**File**: `src/lib/observations/log-night.ts` (new); `src/pages/log/new.astro`

**Intent**: Make the page's night choice testable without changing it: the default night is the noon rule, and the date picker's maximum is the latest night across the user's sites.

**Contract**:
- `logFormNights(sites, site, now): { night: string; maxNight: string }`, documented as server-only (islands never import it; it reaches `gear/store` through `tonight-date`):
  - `maxNight` delegates to `latestNightBound(sites, now)` (`store.ts:85-93`, the rule the edit page already uses at `src/pages/log/[id].astro:55`), except that it stays `""` when there are no sites, so behaviour is byte-for-byte unchanged (plan review F4);
  - `night` is `observingNightDateFor(now, site.timeZone)` when `site` is set, else `""`.
- `new.astro` calls it and keeps its own `?night=` override (`isCalendarDate(nightParam) ? nightParam : night`) and the explanatory comment (moved to the helper's doc).
- Behaviour is byte-for-byte the same as `new.astro:68-70`.

#### 2. Log-night tests

**File**: `src/lib/observations/log-night.test.ts` (new)

**Intent**: Pin the log form's nights against the server's per-site bound on the edge nights, under every runner zone.

**Contract**: `describe.each(RUNNER_ZONES)`:

- **(a) Default vs Tonight.** Warsaw at USNO civil dawn + 5 min on 2026-10-25 and at 10:59Z gives `night` "2026-10-24" and `maxNight` "2026-10-25". At 11:00Z (noon CET) both are "2026-10-25". At civil dawn − 5 min both are "2026-10-24".
  - Behaviour asserted: between civil dawn and local noon the manual default is the night just ended, while the latest night is the evening ahead (intended, `new.astro:65-67`).
  - Regression caught: a default that skips the night being logged, or a default the server would reject.
  - Source: research "Consumers" (log manual default).
  - Edge: 25 h night, dawn, local noon.
  - Anti-pattern avoided: expectations from the helpers.
- **(b) Never ahead of the server.** For every Phase 1 edge instant and the matching site, `night <= tonightDateForSite(site, now)`, the server's bound at `store.ts:116`.
  - Behaviour asserted: the default is always accepted.
  - Regression caught: a default past the server bound, which would show the user `NIGHT_IN_FUTURE`.
  - Source: research "Consumers" (log upper bound).
  - Edge: all five edge nights.
  - Anti-pattern avoided: a single happy-path instant. (This is a relation, so it may call `tonightDateForSite`; the literals in (a) anchor it.)
- **(c) Two sites.** With Warsaw and Los Angeles at 2026-10-25T05:00Z (after Warsaw's civil dawn, 22:00 PDT on 24 Oct in Los Angeles), the Los Angeles default is "2026-10-24" while `maxNight` is "2026-10-25". With no sites, both values are `""`. The multi-site max itself is already pinned by `store.test.ts:11-18` and is not repeated (plan review F4).
  - Behaviour asserted: a site's default follows its own zone even when the hint is set by another site; the empty-list case stays `""`.
  - Regression caught: a silent change to the hint's rule.
  - Source: research "Consumers", `ObservationForm.tsx:51-54`.
  - Edge: far-apart zones; empty list.
  - Anti-pattern avoided: implying the hint is a guarantee.

#### 3. Tonight consumers suite

**File**: `src/lib/tonight/night-boundaries.test.ts` (new); reuse `src/lib/tonight/test-fixtures.ts`, and lift `hourlyForecast`, `uniformForecast`, `result` and `utcWallTime` from `build.test.ts` into `test-fixtures.ts` if both files need them (no behaviour change to `build.test.ts`).

**Intent**: Pin what the user sees on the edge nights: the date, the log night, the strip, the plan order and labels, and the offline hand-over. Every case runs under every runner zone.

**Contract**: `describe.each(RUNNER_ZONES)` over `buildTonight(..., { withSessionPlan: true })` with a clear forecast built by `hourlyForecast` over about 120 h from the case's evening, with `fetchedAt` set to the case's `now`. `uniformForecast`'s 48 h and `result()`'s default `fetchedAt` (relative to 2026-10-10) don't reach the Los Angeles + 5 min case or the strip (plan review F1):

- **(a) Rollover reaches the view (Los Angeles, month end).**
  - At USNO civil dawn − 5 min on 2026-11-01: `view.date` is "2026-10-31", and `logHref(view, key)` (`src/lib/tonight/load.ts:186-197`, imported as `build.test.ts:36` does) for the first ranking entry carries `night=2026-10-31`. View entries carry no link field, and Session plan rows' `href` is a focused-page link, not a log link (plan review F1).
  - At + 5 min: `view.date` is "2026-11-01" and `logHref` carries `night=2026-11-01`.
  - `view.nights` dates run from the view's date over 7 consecutive hand-listed dates across the month end (from "2026-10-31": 31 Oct, 1–6 Nov).

  Behaviour asserted: the day the user sees, and the night "Mark observed" would save. Regression caught: a strip or link keyed on the UTC date, or a month-roll gap. Source: research "Consumers" (verdict date, prefill, strip). Edge: a 25 h night that is also a month end. Anti-pattern avoided: expected dates from `addDays`/`tonightDateFor`.
- **(b) Session plan on the European DST night (Warsaw 2026-10-24, now 2026-10-24T18:00Z).**
  - Precondition: rows exist with `bestAt` before 2026-10-24T22:00Z (midnight CEST), after it, and at or after 2026-10-25T01:00Z (the clock change).
  - Rows are sorted by `bestAt` ascending.
  - Each row's `bestTime` equals the hand-offset wall time: UTC + 2 h when `bestAt` < 2026-10-25T01:00Z, else UTC + 1 h, formatted `HH:mm` from `toISOString()` of the shifted instant.

  Behaviour asserted: plan order across midnight, and the clock change in the labels. Regression caught: order by label or local hour; labels in the server's zone or with a fixed offset. Source: research "Consumers" (Session plan; unpinned row order and labels). Edge: midnight, the repeated hour. Anti-pattern avoided: expected labels from `formatTime`.
- **(c) Offline hand-over agrees with the rollover.**
  - For Warsaw on 2026-10-24 and Los Angeles on 2026-10-31, `view.validUntil` is within ±2 min of the USNO civil dawn.
  - `buildTonight` at `validUntil − 1 s` still shows the same `date`, and at `validUntil` it shows the next.

  Behaviour asserted: the stored Tonight copy expires at the instant "tonight" moves on. Regression caught: retuning only one of the two −6° constants. Source: research "Consumers" (`?night=next`). Edge: DST night, month end. Anti-pattern avoided: asserting a constant's value.

### Success Criteria:

#### Automated Verification:

- New suites pass: `npx vitest run src/lib/observations/log-night.test.ts src/lib/tonight/night-boundaries.test.ts`
- They pass under a far-east runner zone: `TZ=Pacific/Kiritimati npx vitest run src/lib/observations/log-night.test.ts src/lib/tonight/night-boundaries.test.ts`
- Break check, then reverted:
  - temporarily sorting session-plan rows by `bestTime` (the label) instead of `bestAt` turns (b) red;
  - temporarily setting `PLANET_WINDOW_SUN_ALTITUDE_DEG` to −12 turns (c) red;
  - temporarily making `logFormNights` default to `tonightDateForSite` turns log-night (a) red.
- Full unit suite, lint and type check pass: `npm test`, `npx eslint . --ignore-pattern '.claude/**'`, `npx astro check`

**Break-check log** (2026-10-08): Session plan rows sorted by `bestTime` → 5 of 30 red ((b) in every runner zone); `PLANET_WINDOW_SUN_ALTITUDE_DEG` = −12 → 10 red ((c) Warsaw and Los Angeles × 5 zones); `logFormNights` defaulting to the latest night → 10 of 60 red (log-night (a) at dawn + 5 min and 11:59 CET); all restored. Manual 2.5 checked by diff review of `new.astro`: `maxNight` = `latestNightBound` (identical to the old `reduce` with `""` start for a non-empty list, `""` for none), default = `observingNightDateFor(now, site.timeZone)` as before, `?night=` override unchanged.

#### Manual Verification:

- `/log/new` without a `night` parameter still defaults to the noon-rule night and caps the date picker as before (a local dev check against local Supabase, or a code-diff review of `new.astro` showing only the helper call).

**Implementation Note**: Commit and push the phase. The manual row may be deferred to the end of the run (the user's preference) if run against local Supabase isn't convenient. A code-diff review is an acceptable check, and the row records which one was used.

---

## Phase 3: Static runner-zone guard and cookbook (unit + docs)

### Overview

A source scan that fails the suite if any non-test code under `src/` reads the runner's zone, with a positive control proving the scan can fail. Then the test plan's cookbook and phase note.

### Changes Required:

#### 1. Runner-zone guard

**File**: `src/lib/runner-zone-guard.test.ts` (new)

**Intent**: Keep "no production path reads the runner's zone" true for every module, including pages and islands that the in-process table cannot exercise.

**Contract**:
- **Scope.** Scan every `.ts`, `.tsx` and `.astro` file under `src/`, excluding `*.test.ts` and `src/lib/engine/fixtures/`.
- **Forbidden:**
  - local `Date` getters and setters (`getHours`, `getDate`, `getDay`, `getMonth`, `getFullYear`, `getMinutes`, and their `set*` forms; never the `getUTC*`/`setUTC*` forms);
  - `getTimezoneOffset`;
  - `toLocaleDateString(`, `toLocaleTimeString(`, `toDateString(`, `toTimeString(`;
  - the multi-argument local `new Date(y, m, …)` constructor (first argument not a string or a nested call);
  - any `Intl.DateTimeFormat(` call whose argument list (to the matching `)`) contains no `timeZone`;
  - a date-time string literal passed to `new Date(` or `Date.parse(` without `Z` or a `±hh:mm` offset (it parses in the runner's zone). Date-only strings parse as UTC and stay allowed (plan review F8).
- **Positive control.** A table of offending snippets, each of which the matcher must flag, and allowed snippets that it must not flag: `getUTCHours`, `new Date(Date.UTC(…))`, `new Date(Date.UTC(2026, 9, 10) + n * HOUR_MS)` (the `design.astro:517` form), `new Date(Math.max(a, b))` (`verdict.ts:155`), `new Intl.DateTimeFormat(tag, { timeZone, … })`, `new Date("2026-10-24T20:00:00Z")`, `Date.now()`.
- **Non-test helpers are scanned on purpose.** `test-fixtures.ts`, `test-helpers.ts` and `runner-zones.ts` are not `*.test.ts`. The first two are scanned like any source; `runner-zones.ts` sits in the excluded `fixtures/` directory.
- **Hits on current code.** Research expects zero. A genuine zone read is a bug, fixed in this phase. A false positive is fixed by narrowing the matcher, never by a file allowlist.
- **Known gap.** A plain `Date#toLocaleString` can't be told apart from a number's `toLocaleString`, so it is out of scope. A one-line comment says so.

#### 2. Test plan cookbook and note

**File**: `context/foundation/test-plan.md`

**Intent**: Tell the next author how to add a boundary test, and record what Phase 2 shipped.

**Contract**:
- **§6.2** "Adding a test that crosses a night or date boundary" replaces its TBD with:
  - which file per layer (engine `night-boundaries.test.ts`, Tonight `night-boundaries.test.ts`, `log-night.test.ts`);
  - the helpers (`RUNNER_ZONES`/`useRunnerZone`, `USNO_CIVIL_DAWN`);
  - the oracle rule (hand calendar literals, USNO instants with ±5 min either side and ±2 min for engine ends, hand UTC offsets for labels; never `observingNightDateFor`/`tonightDateFor`/`formatTime` output as an expectation);
  - adding a USNO value (the API URL, the `tz=0` UTC day, the `checked` date);
  - the runner-zone guard and how to narrow it.
- **§6.6** gains a 2–3 line Phase 2 note.
- **§3** row 2 Status moves to `complete` only after the change's impl review (left to `/10x-test-plan` reconciliation, not edited here).

### Success Criteria:

#### Automated Verification:

- The guard passes on current source: `npx vitest run src/lib/runner-zone-guard.test.ts`
- Break check, then reverted: temporarily adding `const h = new Date().getHours();` to a non-test file under `src/lib/tonight/` turns the guard red.
- Full unit suite passes, also under a non-UTC runner zone: `npm test` and `TZ=Pacific/Kiritimati npm test`
- Lint and type check pass: `npx eslint . --ignore-pattern '.claude/**'`, `npx astro check`
- `test-plan.md` §6.2 has no "TBD" and §6.6 has a Phase 2 entry: `! sed -n '/^### 6.2/,/^### 6.3/p' context/foundation/test-plan.md | grep -q TBD && grep -q '\*\*Phase 2 —' context/foundation/test-plan.md` (plan review F7)

**Break-check log** (2026-10-08): `export const __breakCheck = (): number => new Date().getHours();` appended to `src/lib/tonight/tonight-date.ts` → the guard went red (`lib/tonight/tonight-date.ts:16 local Date getter/setter`); restored. Guard on current source: 0 hits in 229 files; positive control 24 flagged / 18 allowed snippets.

**Implementation Note**: Commit and push. Then run `/10x-impl-review testing-night-and-date-boundaries` and open the PR.

---

## Testing Strategy

### Unit Tests:

- Engine: spans, the −6° end against USNO, either side of civil dawn, and wall-clock traps over 5 edge nights × 5 runner zones.
- Consumers: view date, log links, strip across the month end, Session plan order and labels on the DST night, and the offline hand-over against USNO.
- Log form: default vs latest night at dawn and noon, never ahead of the server, the two-site hint, and the empty site list.
- Guard: a source scan with a positive control.

### Integration Tests:

- None new. The server bound is already covered by `tests/db/observations.test.ts:261-288`.

### Manual Testing Steps:

1. Open `/log/new` without parameters and check that the default night and the date picker's max match the previous behaviour, or review the `new.astro` diff instead.

## Performance Considerations

- Each `buildTonight` call costs tens of milliseconds, and 5 runner zones multiply the count. Keep the Tonight suite to the listed cases (about 9 builds per zone, about 15 ms each), so the full suite stays well under its current runtime plus a few seconds. Engine cases are cheap.

## Migration Notes

- None: there is no schema or data change. `log-night.ts` is a behaviour-preserving extraction.

## References

- Research: `context/changes/testing-night-and-date-boundaries/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (Risk #2 and its 2026-10-08 backport), §3 Phase 2, §6
- Prior phase pattern: `context/archive/2026-10-07-testing-forecast-honesty/plan.md`
- Code: `src/lib/engine/night.ts:100-120`, `src/lib/engine/sun.ts:52-105`, `src/lib/tonight/build.ts:332-344`, `:588-640`, `:1146`, `src/pages/log/new.astro:64-70`, `src/lib/observations/store.ts:75-93`, `:116`
- Existing tests to keep: `src/lib/engine/night.test.ts`, `sun.test.ts:105-187`, `src/lib/tonight/build.test.ts:563-588`, `:897-945`, `:1536-1566`
- USNO API: `https://aa.usno.navy.mil/api/rstt/oneday?date=<YYYY-MM-DD>&coords=<lat>,<lon>&tz=0` (checked 2026-10-08)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Engine night edges in every zone (unit)

#### Automated

- [x] 1.1 The new suite passes: `npx vitest run src/lib/engine/night-boundaries.test.ts` — 1bf7096
- [x] 1.2 The new suite passes under a far-east runner zone: `TZ=Pacific/Kiritimati npx vitest run src/lib/engine/night-boundaries.test.ts` — 1bf7096
- [x] 1.3 Break check (rollover constant −12 turns (b)/(c) red; `getHours` in `observingNightDateFor` under `TZ=UTC` turns (d) red), reverted and logged — 1bf7096
- [x] 1.4 Full unit suite, lint and type check pass — 1bf7096

### Phase 2: Consumers and the log form's night (unit)

#### Automated

- [x] 2.1 New suites pass: `npx vitest run src/lib/observations/log-night.test.ts src/lib/tonight/night-boundaries.test.ts` — b340366
- [x] 2.2 They pass under a far-east runner zone: `TZ=Pacific/Kiritimati npx vitest run src/lib/observations/log-night.test.ts src/lib/tonight/night-boundaries.test.ts` — b340366
- [x] 2.3 Break check (label sort, −12 planet window, `tonightDateForSite` default), reverted and logged — b340366
- [x] 2.4 Full unit suite, lint and type check pass — b340366

#### Manual

- [x] 2.5 `/log/new` without a `night` parameter keeps its default night and date-picker max (local check or `new.astro` diff review) — b340366

### Phase 3: Static runner-zone guard and cookbook (unit + docs)

#### Automated

- [x] 3.1 The guard passes on current source: `npx vitest run src/lib/runner-zone-guard.test.ts`
- [x] 3.2 Break check (`new Date().getHours()` in `src/lib/tonight/`), reverted and logged
- [x] 3.3 Full unit suite passes, also under a non-UTC runner zone: `npm test` and `TZ=Pacific/Kiritimati npm test`
- [x] 3.4 Lint and type check pass
- [x] 3.5 `test-plan.md` §6.2 has no "TBD" and §6.6 has a Phase 2 entry (`sed`/`grep` check)
