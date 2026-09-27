# Seven-Night Planner and Site Switching Implementation Plan

## Overview

Roadmap S-05 (US-03, FR-011, FR-012, Business Logic invariant 5, NFR daylight-saving, Success Criteria Secondary). Tonight gains a "Next 7 nights" strip for the selected site: nights 1-3 carry the go / marginal / no-go verdict, nights 4-7 carry the dark window, moon data and a cloud outlook with no verdict. A user with two or more sites gets a site selector on Tonight that switches the verdict, the ranking and the strip together, remembered on the device like the telescope pick. All times stay in the selected site's time zone, including across the 2026-10-25 DST change.

Planning note: the user delegated every decision in this session ("stick to your own recommendations, don't ask"); the choices below are the agent's recommendations and are listed in the brief's Key Decisions table for `/10x-plan-review`.

## Current State Analysis

- Tonight always uses the oldest site: `const site = sites.at(0)` with the comment "S-05 adds switching" (`src/components/tonight/TonightContent.astro:81-84`). `siteStore.list` is already ordered by `created_at` (`src/lib/gear/store.ts:145-151`).
- The telescope pick (S-08) is the pattern to copy: the page shell reads `?telescope=<uuid>`, stores it in the `sidereus-telescope` cookie and passes it to the server island as a prop, because inside the island `Astro.url` carries no page query (`src/pages/tonight.astro:11-38`). `chooseTelescope` is already generic over `{ id }` (`src/lib/tonight/telescope-choice.ts:25-30`); `TelescopeSelector.astro` renders pills (≤3) or a GET-form dropdown with a submit-on-change script, hard-wired to `?telescope=` and `form[data-telescope-select]`.
- The engine already knows the verdict horizon: `VERDICT_NIGHTS = 3` (`src/lib/engine/parameters.ts:189`), used by `nextNightNotNoGo`, which walks nights 2-3 with the same forecast (`src/lib/engine/outlook.ts:36-51`). Night dates are `addDays(date, n)` on `YYYY-MM-DD` strings and each night is `observingNight(date, timeZone)` (local noon to local noon), which already survives the 25-hour DST night.
- The verdict slices the dark window into overlapping whole UTC hours and treats a series that does not span them as no weather data (`src/lib/engine/verdict.ts:25-44`, `:79-87`). The cloud outlook should use the same slicing so "no data" means the same thing on every night.
- Moon: `moonState(site, time)` gives altitude and illuminated fraction (`src/lib/engine/moon.ts:33-45`). Nothing yet computes when the Moon is up during a dark window.
- The forecast request covers only the three verdict nights: `forecast_days=4`, `past_days=1` (`src/lib/forecast/open-meteo.ts:41-55`); tests pin the query (`src/lib/forecast/open-meteo.test.ts:53-54`), and the e2e fixture serves hours up to +120 h (`tests/e2e/forecast-fixture.mjs:13-22`). Night 7's dark window ends on the morning of date+7, so nights 4-7 need `forecast_days=8`.
- `buildTonight` computes night 1's date (`tonightDateFor`), dark window and verdict (`src/lib/tonight/build.ts:176-179`); all wording comes from `createFormatter(locale)` (`src/lib/tonight/format.ts`), verdict tones from `src/components/tonight/verdict-tones.ts`.
- Worker CPU: Free plan, 10 ms nominal cap; `/tonight` already uses 15-50 ms (`context/archive/2026-09-26-server-latency/plan-brief.md:7`). Seven nights of dense moon sampling would add noticeably; rise/set searches keep the added cost small.
- Lessons: `src/lib/tonight/**`, `src/components/tonight/**` and `src/pages/tonight.astro` are already under `no-console` (`eslint.config.js:84-101`), so no lint edit is needed unless a file lands elsewhere. The only list query touched (`siteStore.list`) is already ordered and per-user.

## Desired End State

- `/tonight` for a single-site user looks as today plus a "Next 7 nights at <site>" section: seven rows/cells, one per night from tonight (the same night the verdict card shows) through tonight+6. Each shows the short date, the dark window (`19:05–04:40`, or "No darkness"), and the moon ("Moon 62% · 3 h 10 min moon-free"). Nights 1-3 show a verdict chip (dot + level) that equals what the verdict card and `nextNightNotNoGo` would say for that night. Nights 1-3 also show the verdict's short reason, so "marginal — no weather data" is told apart from a forecast marginal. Nights 4-7 show "Cloud ~50%, down to 0%" (mean and clearest hour over the dark window; "No cloud outlook yet" without data, nothing on a night without darkness), in neutral styling, under a visible "Outlook — no verdict" divider; they never carry a verdict level or tone. When a ranking sits between the verdict card and the strip, the card carries a "Next 7 nights ↓" link to it.
- A user with two or more sites sees a site selector (pills for 2-3, dropdown for 4+) above the telescope selector. Picking a site (`/tonight?site=<uuid>`) re-renders the verdict, ranking and strip for that site, in its time zone, and remembers it in a `sidereus-site` cookie; plain `/tonight` (including the post-log redirect) keeps it. A missing, deleted or foreign id falls back to the oldest site with no error. The log form prefill uses the selected site.
- Verify: engine and view-model unit tests (seven consecutive nights, invariant 5, DST night of 24-25 Oct 2026 in Warsaw, moon-free minutes against a dense-sampling oracle, determinism), a Playwright spec for the strip and site switching, and the manual checks below.

### Key Discoveries:

- Server-island props are serialised into the island URL, so only the site id travels, never coordinates (`CLAUDE.md` tripwire "Coordinates never go into URLs or logs"); site ids are uuids, shape-checked like telescope ids.
- Night 1 of the strip and the verdict card must come from one computation, otherwise a future change to one path can make them disagree on the same screen.
- Cached forecasts written before the deploy only reach night 3; they are served for at most `FORECAST_FRESH_MS` (1 h), or longer as an outage fallback, and nights 4-7 then honestly read "No cloud outlook yet". No cache-key bump is needed.

## What We're NOT Doing

- No side-by-side view of two sites on one screen; comparison is by switching (FR-012 is a switch).
- No ranking for nights 2-7 and no night picker for the ranking; the ranking stays tonight's (S-02).
- No verdict, tone or "best night" highlight on nights 4-7 (invariant 5), and no hourly cloud chart.
- No moonrise/moonset times in the UI; the moon line is illumination plus moon-free dark time.
- No stored "default site" in the database; the pick is a per-device cookie, like telescope, theme and language.
- No site switching outside Tonight (the log and gear pages are unchanged).
- No second forecast request per page and no change to the forecast provider or cache key.

## Implementation Approach

Three phases along the data flow: pure engine first (seven-night outlook, moon-free time, cloud outlook, forecast horizon), then the view model and the strip on Tonight for the current (oldest) site, then site selection generalising the S-08 telescope pattern. Each phase is shippable on its own; phase 2 already satisfies FR-011 for single-site users and phase 3 adds FR-012.

## Critical Implementation Details

- **Performance constraints**: compute moon-up time with `SearchAltitude` crossings of the `moonState` horizon (see Phase 1 §2) plus the Moon's altitude at the window start, not by sampling the window every few minutes; seven dense tracks would multiply the island's CPU use on the Free plan. Reuse the dark windows the strip computes for night 1 in `buildTonight` rather than computing them twice.
- **State sequencing**: `buildTonight` derives the verdict card's `window` and `verdict` from the strip's night 1, so both are one value.

## Phase 1: Seven-night outlook in the engine

### Overview

A pure engine function returns the seven nights with dark window, moon data, and either a verdict (nights 1-3) or a cloud outlook (nights 4-7); the forecast request is widened to cover night 7.

### Changes Required:

#### 1. Parameters

**File**: `src/lib/engine/parameters.ts`

**Intent**: Name the strip length next to `VERDICT_NIGHTS`, so neither number is hard-coded elsewhere.

**Contract**: `export const OUTLOOK_NIGHTS = 7;` with a doc comment citing FR-011 (nights 1..VERDICT_NIGHTS carry a verdict, the rest an outlook).

#### 2. Moon-free dark time

**File**: `src/lib/engine/moon.ts`

**Intent**: How long the Moon is below the horizon during a dark window, the moon number a deep-sky observer plans around.

**Contract**: `moonFreeMinutes(site: Site, window: Interval): number` — whole minutes of `[start, end)` during which the Moon's apparent centre altitude is below 0° (the `moonState` definition). Crossings are found with astronomy-engine `SearchAltitude(Body.Moon, observerFor(site), ±1, start, limitDays, InverseRefraction("normal", 0))`, not `SearchRiseSet`: SearchRiseSet times the upper limb against a fixed 34′ refraction, which differs from `moonState` by about 0.25° (up to ~6 min per window at 52°N, 26 min at Tromsø; plan review F1). The initial state comes from `moonState` at the window start; a `null` search result means no crossing before the window ends. Use `AstroTime.date`, never an argument-less `new Date()` (purity test). Pure; result is within `TIME_TOLERANCE_MINUTES` of a 1-minute sampling of `moonState`.

#### 3. Cloud outlook for one dark window

**File**: `src/lib/engine/verdict.ts`

**Intent**: The mean cloud cover over the same forecast hours the verdict would judge, plus the clearest hour so a clear spell is not averaged away (PRD Open Question 2's reason for scoring the verdict on runs; plan review F3), with the same "series must span the window" rule, so nights 4-7 get numbers and never a verdict.

**Contract**: `cloudOutlook(darkWindow: DarkWindow, forecast: HourlyForecast | null): { meanCloudPct: number; minCloudPct: number } | null` — `null` when there is no dark window, no forecast, or the series does not span the window's overlapping hours; hours missing inside the series are skipped (not counted as clear or cloudy); a window with no present hours returns `null`. Reuses `overlappingSlotStarts` / `seriesSpans`. Callers tell "no darkness" from "no data" by the night's `darkWindow.kind`, not by this `null`.

#### 4. Seven-night outlook

**File**: `src/lib/engine/outlook.ts`

**Intent**: One call that yields the whole strip, with invariant 5 enforced by the type rather than by the UI.

**Contract**:

```ts
export type OutlookNight = {
  /** 1-based position; night 1 is `date`. */
  index: number;
  date: string; // YYYY-MM-DD, evening date
  darkWindow: DarkWindow;
  moon: {
    /** At the dark window's midpoint, or the observing night's midpoint without one. */
    illuminatedFraction: number;
    /** `null` without a dark window. */
    moonFreeMinutes: number | null;
  };
} & (
  | { kind: "verdict"; verdict: Verdict } // index <= VERDICT_NIGHTS
  | { kind: "outlook"; cloud: { meanCloudPct: number; minCloudPct: number } | null } // index > VERDICT_NIGHTS
);

export function sevenNightOutlook(input: NextNightInput): OutlookNight[]; // same input shape as nextNightNotNoGo
```

Nights 1-3 use `verdict(window, forecast, { fallback })` exactly as Tonight does today.

#### 5. Barrel

**File**: `src/lib/engine/index.ts`

**Intent**: Export `sevenNightOutlook`, `OutlookNight`, `moonFreeMinutes`, `cloudOutlook`, `OUTLOOK_NIGHTS`.

**Contract**: barrel only; the purity test keeps passing.

#### 6. Forecast horizon

**Files**: `src/lib/forecast/open-meteo.ts`, `src/lib/forecast/open-meteo.test.ts`, `src/lib/forecast/night-in-progress.test.ts`, `tests/e2e/forecast-fixture.mjs`

**Intent**: Reach past the morning of night 7 so nights 4-7 have a cloud outlook; the fixture must serve the longer series so e2e sees one.

**Contract**: `forecast_days=8` (doc comment updated: "reaches past the morning of the seventh night"); the query test expects `"8"`; the night-in-progress test comment updated; the fixture serves hours from −48 h to +216 h. Still one request per site per hour (fair-use NFR unchanged).

#### 7. Tests

**Files**: `src/lib/engine/outlook.test.ts`, `src/lib/engine/moon.test.ts`, `src/lib/engine/verdict.test.ts`, `src/lib/engine/determinism.test.ts`

**Intent**: Pin the behaviour the UI relies on.

**Contract**:
- `sevenNightOutlook` returns 7 consecutive dates starting at `date`; nights 1-3 are `kind: "verdict"` and equal `verdict(...)` for that night; nights 4-7 are `kind: "outlook"` even when their forecast is all clear (invariant 5).
- Warsaw, `date = 2026-10-21`: dates 21…27 Oct with no gap or repeat; the night of 24 Oct has a dark window spanning the 03:00 CEST → 02:00 CET switch. (The window's real length is set by the Sun and does not grow by an hour; the DST effect is on the labels, asserted in Phase 2's build test.)
- A forecast ending after night 3 gives `cloud: null` on nights 4-7; a fallback forecast is passed through to nights 1-3 (go capped at marginal).
- `moonFreeMinutes` agrees within 5 min with a 1-minute `moonState` sampling oracle on at least three Warsaw nights (near new moon, near full moon, a night with moonrise inside the window); it is 0 ≤ result ≤ window length.
- `cloudOutlook`: mean and minimum of present hours (four 0% hours and four 100% hours → mean 50, min 0); `null` for no window, `null` forecast, non-spanning series.
- Determinism: identical input → deep-equal output.

### Success Criteria:

#### Automated Verification:

- Engine and forecast unit tests pass: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`

#### Manual Verification:

- For one Warsaw night, `moonFreeMinutes` and the dark window match Stellarium's moonrise/moonset and twilight times within 5 minutes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Seven-night strip on Tonight

### Overview

`buildTonight` returns a formatted `nights` list and Tonight renders it as a "Next 7 nights" section for the current site.

### Changes Required:

#### 1. View model

**File**: `src/lib/tonight/build.ts`

**Intent**: Compute the outlook once per request; the verdict card's night is the strip's night 1.

**Contract**: `TonightView.nights: TonightNight[]` where

```ts
type TonightNight = {
  date: string;
  /** "Sat 24 Oct" / "sob. 24 paź" */
  label: string;
  /** "19:05–04:40" in the site's time zone, or the no-darkness wording. */
  darkText: string;
  /** "Moon 62% · 3 h 10 min moon-free" */
  moonText: string;
} & (
  /** `reasonText` is `verdictReasonText(verdict)`, so a no-weather-data marginal is told apart from a forecast one (plan review F4). */
  | { kind: "verdict"; level: VerdictLevel; reasonText: string }
  /** `cloudText` is `null` on a night without a dark window: there is nothing to judge the cloud against (plan review F6). */
  | { kind: "outlook"; cloudText: string | null }
);
```

`view.verdict` and `view.darkWindow` are taken from `nights[0]`'s engine result (no second `darkWindow`/`verdict` call).

#### 2. Wording

**Files**: `src/lib/tonight/format.ts`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Every string of the strip is a catalogue key; numbers and dates are formatted by the existing formatter in the site's time zone.

**Contract**: formatter gains `formatShortNightDate(date)` (weekday short, day, month short, UTC like `formatNightDate`), `darkSpanText(window, timeZone)`, `moonLine({ illuminatedFraction, moonFreeMinutes })` (percent rounded to whole, duration via `formatDuration`; "Moon below the horizon all night"/"up all dark window" when 100% / 0% moon-free), `cloudOutlookText(cloud)` (mean and clearest hour, each rounded to the nearest 10%: "Cloud ~50%, down to 0%"; when both round to the same value, only "Cloud ~40%"; `null` → "No cloud outlook yet"; only called for nights with a dark window). New keys under `tonight.nights`: `heading({ site })`, `jumpLink` ("Next 7 nights ↓"), `verdictLabel`, `outlookLabel` ("Outlook — no verdict"), `noDarkness`, `moon`, `moonFree`, `moonAllNight`, `moonNone`, `cloud`, `cloudRange`, `noCloud`; Polish counterparts (parity test).

#### 3. Strip component

**File**: `src/components/tonight/NightStrip.astro` (new)

**Intent**: Render the seven nights as a list that reads well on a phone (one row per night) and as a grid on wider screens, with nights 1-3 and 4-7 visibly separated.

**Contract**: props `{ siteName: string; timeZone: string; nights: TonightNight[] }`; `<section id="nights" aria-labelledby="nights-heading">` with an `<ol>` (outside the ranking section; never reuses `verdict-heading`, which e2e specs select on); nights 1-3 use `VERDICT_TONES[level].dot` and `m.verdict.level[level]`, followed by `reasonText` in muted text; nights 4-7 show `cloudText` only when non-null and use neutral tokens only (`text-muted-foreground`, `border-border`), never a verdict tone; the "times in <zone>" note once under the heading. Theme tokens only (no-hardcoded-colors test).

#### 4. Page wiring and skeleton

**Files**: `src/components/tonight/TonightContent.astro`, `src/components/tonight/VerdictCard.astro`, `src/components/tonight/TonightSkeleton.astro`

**Intent**: Place the strip after the ranking section (directly after the verdict card when there is no ranking), so tonight's answer stays first, and give the verdict card a "Next 7 nights ↓" link to it so the week is one tap away on a phone after a site switch (plan review F2). The skeleton reserves the strip's space.

**Contract**: `<NightStrip siteName={view.siteName} timeZone={view.timeZone} nights={view.nights} />` inside the `view &&` block, after the ranking; `VerdictCard` renders a plain `<a href="#nights">` with `tonight.nights.jumpLink` (shown only when a ranking sits between the card and the strip); skeleton gains a matching placeholder block.

#### 5. Tests

**Files**: `src/lib/tonight/build.test.ts`, `src/lib/tonight/format.test.ts`, `src/i18n/i18n.test.ts` (parity is automatic)

**Intent**: Pin the view contract and the wording.

**Contract**:
- `nights` has 7 entries; `nights[0].level === view.verdict.level` and `nights[0].reasonText === view.verdictText`; nights 4-7 have `kind: "outlook"` and no `level`.
- A forecast that stops after night 1: night 2 is `kind: "verdict"`, level marginal, `reasonText` the no-weather-data wording.
- Warsaw `now = 2026-10-21T18:00Z`: labels run 21…27 Oct; on the night of 24 Oct `darkText`'s start equals the window start's UTC wall time + 2 h and its end the window end's UTC wall time + 1 h, so the wall-clock span exceeds the real duration by exactly one hour.
- Tromsø at the solstice: every night reads the no-darkness wording, `moonText` has no moon-free part, and nights 4-7 have `cloudText: null`.
- A forecast covering only nights 1-3: nights 4-7 (with dark windows) read "No cloud outlook yet".
- `pl` locale produces Polish labels.
- Formatter: cloud rounding (34 → "~30%", 35 → "~40%"), range wording (mean 50 / min 0 → "Cloud ~50%, down to 0%"; mean 42 / min 38 → "Cloud ~40%"), moon line edge cases.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including i18n parity and no-hardcoded-colors: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- On `npm run dev`, Tonight shows the strip after the ranking with seven nights, nights 1-3 with verdict chips matching the verdict card for night 1, nights 4-7 under "Outlook — no verdict" with cloud percentages and no verdict colour
- The strip reads well at 375 px width (no horizontal page scroll) and in light and dark themes, in English and Polish
- With `FORECAST_BASE_URL` pointing at an unreachable host (and no cache), nights 1-3 read marginal/no weather data and nights 4-7 read "No cloud outlook yet", with moon and darkness still shown

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Site switching

### Overview

A site selector on Tonight for users with two or more sites, remembered per device, driving the verdict, ranking and strip.

### Changes Required:

#### 1. Shared choice helpers

**Files**: `src/lib/tonight/telescope-choice.ts` → `src/lib/tonight/gear-choice.ts` (git mv), its test file, importers (`src/pages/tonight.astro:11,25,35,37`, `TonightContent.astro:24,87`, `TelescopeSelector.astro:6`); `CLAUDE.md:9`. Not `src/components/onboarding/OnboardingWizard.tsx:288,674`, whose local `chooseTelescope` is unrelated.

**Intent**: One set of rules for "which of the user's items is picked" for both sites and telescopes.

**Contract**: `SITE_COOKIE = "sidereus-site"` next to `TELESCOPE_COOKIE`; `isGearId` (uuid shape check, replaces `isTelescopeId`); `chooseOwned(items, requestedId)` (replaces `chooseTelescope`, same fallback to the oldest); `selectorKind` unchanged. Tests cover a stale, foreign and malformed site id.

#### 2. Page shell

**File**: `src/pages/tonight.astro`

**Intent**: Read `?site=`, remember it in the cookie with the same attributes as the telescope cookie, and pass the requested id to the island.

**Contract**: `<TonightContent server:defer siteId={requestedSite} telescopeId={requestedTelescope}>`; cookie set only when the param passes `isGearId`.

#### 3. Island

**File**: `src/components/tonight/TonightContent.astro`

**Intent**: Resolve the site against the user's own sites; show selectors only where they matter; name the selected site on the strip.

**Contract**: `Props.siteId?: string`; `const site = chooseOwned(sites, siteId)`; the site selector renders when `selectorKind(sites.length) !== "none"`, above the telescope selector; the line under the title lists only names not already shown by a selector (site name when one site, telescope name when one telescope; omitted when both have selectors). Forecast, `buildTonight` and `logHref` use the chosen site.

#### 4. Selector component

**Files**: `src/components/tonight/GearSelector.astro` (new, from `TelescopeSelector.astro`), `src/components/tonight/TelescopeSelector.astro` (removed), `tests/e2e/telescope-selector.spec.ts`

**Intent**: One selector for both lists; pills and dropdown both work without JavaScript. The S-08 spec's form selectors must follow the rename, or its `toHaveCount(0)` (`:82`) and `toBeHidden()` (`:109`) checks pass with no matching element and test nothing (plan review F5).

**Contract**: props `{ items: { id; name }[]; activeId: string; param: "site" | "telescope"; label: string; show: string }`; pills link to `/tonight?<param>=<id>` inside a `<nav aria-label={label}>`; the dropdown form uses `name={param}` and `data-gear-select={param}`; unique `id`s per param (`site-select`, `telescope-select`); the enhancement script targets `form[data-gear-select]`. The spec's two `form[data-telescope-select]` locators become `form[data-gear-select="telescope"]`. The site and telescope labels differ ("Site" / "Telescope"), so the spec's `getByRole("navigation", { name })` and `getByLabel` stay unambiguous under Playwright strict mode.

#### 5. Wording

**Files**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Labels for the site selector.

**Contract**: `tonight.siteSelector: { label: "Site", show: "Show" }` (and Polish).

#### 6. End-to-end spec

**File**: `tests/e2e/seven-night-planner.spec.ts` (new)

**Intent**: Walk US-03 in a browser against the all-clear fixture.

**Contract**: onboard in Madrid (shared helper); the strip lists 7 nights, nights 1-3 carry a verdict label and nights 4-7 the outlook label with a cloud percentage and no verdict label; add a second site via `/gear/sites/new` in a different time zone (e.g. Tenerife, `Atlantic/Canary`); pick it by pill → the strip heading and the "times in" note name the second site and zone; plain `/tonight` keeps it (cookie); delete the second site → Tonight falls back to the first with no error and no selector.

#### 7. Docs

**File**: `CLAUDE.md`

**Intent**: Keep the project summary true.

**Contract**: the Project paragraph mentions S-05: `?site=<id>` / `sidereus-site` cookie with the shared `gear-choice.ts`, and the seven-night strip from `sevenNightOutlook`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- E2E specs pass against the preview with the forecast fixture: `BASE_URL=http://localhost:4321 npm run test:e2e`
- Smoke test passes against local Supabase: `npm run smoke`

#### Manual Verification:

- With two sites in different time zones, switching by pill changes the verdict, ranking, strip and "times in" zone together, and "Mark observed" prefills the selected site
- With four sites the dropdown switches on change (JS) and via "Show" (JS disabled)
- Deleting the selected site and reopening Tonight falls back to the oldest site silently
- On the preview build, `buildTonight` for one Warsaw site takes at most ~10 ms more than before the change (timed locally before/after; production CPU is a post-merge check, see Performance Considerations)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Engine: `sevenNightOutlook` (dates, invariant 5, DST, missing forecast, fallback), `moonFreeMinutes` (oracle), `cloudOutlook`, determinism.
- View model and formatter: seven formatted nights, night 1 = card, DST labels, Tromsø no-darkness, Polish, rounding.
- Choice helpers: site id fallback cases.

### Integration Tests:

- Playwright `seven-night-planner.spec.ts` (strip, site switching, cookie memory, deletion fallback); existing `telescope-selector.spec.ts` still passes after the selector refactor.

### Manual Testing Steps:

1. Sign in with one site: the strip appears after the ranking; compare night 1's chip with the verdict card.
2. Add a second site in another time zone; switch by pill; confirm the zone note and times change.
3. Log an observation from the ranking; confirm the redirect keeps the selected site.
4. Delete the selected site; reopen Tonight; confirm the fallback.
5. Check 375 px width, both themes, both languages.

## Performance Considerations

Per request the strip adds five dark-window computations (night 1 is shared; nights 2-3 overlap `nextNightNotNoGo`, which may be recomputed on a weather no-go) and seven moon altitude-crossing searches (`SearchAltitude`). No extra network call: the one forecast per site already fetched now spans 8 days instead of 4. The PRD's 2-second Tonight budget and the Free-plan CPU cap are the constraints; the local timing check in phase 3 (3.9) guards them before merge. Post-merge (deploys run only on a merge to `main`), look at the `/tonight` island's CPU time in Workers observability and compare it with the 15-50 ms range from the server-latency change.

## Migration Notes

No database change. Forecast entries cached before the deploy only reach night 3; they age out within an hour (or serve as outage fallback), during which nights 4-7 show "No cloud outlook yet".

## References

- Roadmap item: `context/foundation/roadmap.md` (S-05)
- PRD: `context/foundation/prd.md` (US-03, FR-011, FR-012, invariant 5, NFR daylight-saving)
- Pattern: S-08 telescope selector, `context/archive/2026-09-27-telescope-selector-and-empty-states/plan.md`
- Code: `src/components/tonight/TonightContent.astro:81-84`, `src/pages/tonight.astro:11-38`, `src/lib/engine/outlook.ts:36-51`, `src/lib/engine/verdict.ts:25-44`, `src/lib/forecast/open-meteo.ts:41-55`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Seven-night outlook in the engine

#### Automated

- [x] 1.1 Engine and forecast unit tests pass: `npm test` — 938c2fb
- [x] 1.2 Type check passes: `npx astro check` — 938c2fb
- [x] 1.3 Lint passes: `npm run lint` — 938c2fb

#### Manual

- [x] 1.4 For one Warsaw night, `moonFreeMinutes` and the dark window match Stellarium's moonrise/moonset and twilight times within 5 minutes — 938c2fb

### Phase 2: Seven-night strip on Tonight

#### Automated

- [x] 2.1 Unit tests pass, including i18n parity and no-hardcoded-colors: `npm test`
- [x] 2.2 Type check passes: `npx astro check`
- [x] 2.3 Lint passes: `npm run lint`
- [x] 2.4 Production build succeeds: `npm run build`

#### Manual

- [x] 2.5 On `npm run dev`, Tonight shows the strip after the ranking with seven nights, nights 1-3 with verdict chips matching the verdict card for night 1, nights 4-7 under "Outlook — no verdict" with cloud percentages and no verdict colour
- [x] 2.6 The strip reads well at 375 px width (no horizontal page scroll) and in light and dark themes, in English and Polish
- [x] 2.7 With `FORECAST_BASE_URL` pointing at an unreachable host (and no cache), nights 1-3 read marginal/no weather data and nights 4-7 read "No cloud outlook yet", with moon and darkness still shown

### Phase 3: Site switching

#### Automated

- [ ] 3.1 Unit tests pass: `npm test`
- [ ] 3.2 Type check passes: `npx astro check`
- [ ] 3.3 Lint passes: `npm run lint`
- [ ] 3.4 E2E specs pass against the preview with the forecast fixture: `BASE_URL=http://localhost:4321 npm run test:e2e`
- [ ] 3.5 Smoke test passes against local Supabase: `npm run smoke`

#### Manual

- [ ] 3.6 With two sites in different time zones, switching by pill changes the verdict, ranking, strip and "times in" zone together, and "Mark observed" prefills the selected site
- [ ] 3.7 With four sites the dropdown switches on change (JS) and via "Show" (JS disabled)
- [ ] 3.8 Deleting the selected site and reopening Tonight falls back to the oldest site silently
- [ ] 3.9 On the preview build, `buildTonight` for one Warsaw site takes at most ~10 ms more than before the change (timed locally before/after; production CPU is a post-merge check, see Performance Considerations)
