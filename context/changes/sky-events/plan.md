# Sky events (M-3 S-07) Implementation Plan

## Overview

The user sees the sky events of the next 30 days for their selected site, each with its time in the site's timezone and whether it is visible from the site:
- meteor shower peaks;
- planet oppositions;
- Mercury and Venus greatest elongations;
- close Moon-planet and planet-planet pairings;
- solar and lunar eclipses.

The next notable event appears as a dashboard tile that opens a new events page. An event happening tonight is named under the sky verdict. Roadmap M-3 S-07 (GitHub #128), PRD FR-042, FR-043 and US-07.

Events are computed by the pure engine from the site and the date alone, with no feed. They are therefore deterministic and travel inside stored offline copies. The owner answered the five product choices on 2026-10-13 (PRD Open Questions 19 and 20, plus presentation); see "Owner decisions".

## Current State Analysis

Evidence: `context/changes/sky-events/research.md` (rebased onto main 998b30f, after finder-chart #155).

- **astronomy-engine 2.1.19 already ships the searches** for eclipses (local solar, lunar), greatest elongation, opposition (relative longitude) and the Sun reaching a longitude (research §1). The engine uses none of them yet. There is no helper for the minimum separation of two bodies, and no meteor-shower data.
- **The engine is pure and flat.**
  - Modules live in `src/lib/engine/*.ts` and are re-exported from `index.ts`.
  - `purity.test.ts` bans clocks, `fetch` and `console` (`:24-36`).
  - Tunable numbers live in `parameters.ts` as documented candidates.
  - Night helpers already exist: `observingNight`, `observingNightDateFor`, `addDays`, `sunEvents`, `darkWindow` and `observerFor`.
- **Tonight builds one view.**
  - `buildTonight` (`src/lib/tonight/build.ts`) returns a `TonightView`.
  - Optional blocks follow the `sessionPlan` pattern: try/catch, `null` on failure, one allowlisted fixed log line. The options are threaded through `load.ts` and `island.ts`.
  - The dashboard island renders `VerdictCard` and five `TonightTiles`.
  - Focused pages follow `nights.astro` + `NightsPageContent.astro`.
- **Offline copies.** A Tonight page is stored only if it is listed in `TONIGHT_PAGES` (`src/lib/offline/copies.ts`, six pages). The worker is generic over that list.
  - finder-chart (now on main) added a separate `FINDER_PAGE` path and per-copy plan metadata. A new Tonight page still joins `TONIGHT_PAGES`, needs a title in `src/pages/offline.astro`, and must render `OfflineCopy` in its island.
- **Constraints.**
  - The verdict's height is pinned (`VERDICT_MIN_HEIGHT_CLASS`, `src/components/tonight/sky-band.ts`).
  - The phone first screen is pinned by `tests/e2e/tonight-phone.spec.ts`.
  - The verdict over the live sky takes no pointer events, because it has no controls (CLAUDE.md "Tonight's live sky").

## Desired End State

- **`/tonight/events` (new page).** It lists the events of the 30 observing nights from the selected night, in time order.
  - Each event shows what it is, its date and time in the site's zone, and whether it is visible from the site. Visible events carry the useful detail: best time, altitude and direction, or "best the night before or after" for a daytime shower peak.
  - Not-visible events say why ("below your horizon", "during daylight", "too low"). They are never worded as something to go out for.
  - An eclipse between 2° and 10° up reads "low, needs an open horizon". A night without full darkness reads "short night".
  - Every solar eclipse carries the eye-safety line.
  - With no events, the page shows an honest empty state.
  - The page is stored offline like the other Tonight pages.
- **The dashboard** gains a sixth tile, "Sky events". Its line names the next notable visible event and its night, or says there is none in the next 30 days.
- **The verdict.** When the selected night has a notable visible event, one muted line under the verdict's reason names it ("Tonight: Perseids peak"). It is plain text, and the tile carries the link.
- **Verification:**
  - pure engine tests per kind against independent references (published eclipse and elongation dates, a Skyfield/DE421 pairing fixture);
  - build tests;
  - an e2e spec for the page and the tile;
  - the phone-width check covers the page;
  - a screenshot matrix.

### Key Discoveries:

- `SearchLocalSolarEclipse` is per observer and reports the Sun's altitude at each contact. The local solar-eclipse visibility test needs no separate path computation (research §2).
- `SearchSunLongitude` works in the ecliptic of date, while shower peaks are tabulated in J2000. In 2026 the difference is about +0.37°, roughly 9 hours (research §2). `Ecliptic()` also returns the longitude of date (0.374°, about 9 h, plan review F1). The J2000 longitude comes from `SphereFromVector(RotateVector(Rotation_EQJ_ECL(), GeoVector(Body.Sun, t, true))).lon`: EQJ to ECL is the J2000 mean ecliptic. Searching on it with `Search` avoids a precession formula entirely.
- The Moon's parallax moves Moon-planet separations by up to about 0.94° at 52° N, so pairings must be computed from the site (research §3).
- A pairing's notable moment is the closest separation while both bodies are visible, not the geometric minimum. The geometric minimum is in daylight or below the horizon most of the time (research §3).
- Close pairings are uncommon even at the owner's 5°. The simulated cases bracket the rule (at least 10° up, Sun at or below −6°) at about 0.7–1.0 Moon-planet and about 0.16 planet-planet visible events per 30 nights (research §3). Phase 2 re-measures the exact rule. Many windows hold few events, so the empty state is a first-class case.
- Cost: a full 30-day pass was measured at under about 200 ms on a laptop (research §1). That is fine on Workers Paid, but it is guarded by a timing test.

## Owner decisions

Answered by the owner on 2026-10-13, relayed by the orchestrator. **Not legal advice.**

1. **Meteor data source (OQ 19): option A.**
   - A hand-written list of about 10 major showers as facts: names, peak (solar longitude, J2000), radiants, speed, ZHR.
   - Each value is cross-checked in at least two sources and documented in `LICENSE-DATA.md`, with no share-alike.
   - The optional courtesy email to the IAU MDC is the owner's to send. The agent only drafts it, as `context/changes/sky-events/iau-mdc-request.md` (Phase 3).
2. **Close pairing (OQ 20): up to 5°, changed from the 3° default** (the binocular field).
   - Still measured from the site, at the closest moment while both bodies are visible.
   - `PAIRING_MAX_SEPARATION_DEG = 5`. The fixture, tests and frequency estimate follow (Phase 2).
3. **Minimum altitude for "visible": 10°** (the default) for every kind except eclipses.
   - **Plan review F2 (owner):** eclipses use their own 2°, labelled "low, needs an open horizon" below 10°.
   - Eclipse tests use future eclipses only: the 2027-08-02 total solar eclipse and the 2028-12-31 total lunar eclipse. They are computed with astronomy-engine and checked against the NASA/Espenak catalogue.
4. **Notable: the default.**
   - Every visible event is notable, except penumbral lunar eclipses, which are listed as "barely noticeable" but never put on the tile or verdict line.
   - No Uranus or Neptune oppositions.
5. **Dashboard: changed.**
   - The events tile goes straight after the Targets tile ("Point here first"), not last.
   - Plus the muted plain-text verdict line on event nights.
   - The phone first screen is re-checked. `tonight-phone.spec.ts` pins the verdict and the gear cards above the TabBar, and the tiles sit below them anyway, so the tile's position does not move that first screen.
   - **Plan review F3 (owner):** the line appears only on event nights, and the one-line layout shift on those nights is accepted. No space is reserved; the skeleton keeps today's height, and its jump on event nights is accepted. `tonight-phone.spec.ts` must not depend on the run date, so it subtracts the measured line.

## What We're NOT Doing

- No external data feed, API or yearly download. Every event comes from the engine and one hand-entered shower table.
- No occultations, no Moon-star or planet-star pairings, no bright-star or deep-sky pairings. The PRD names only Moon-planet and planet-planet.
- No Uranus or Neptune events (owner decision 4).
- No minor showers, no outbursts, no ZHR prediction beyond the table's approximate value, and no "meteors per hour where you are" calculation.
- No notifications, reminders or calendar export.
- No eclipse maps, paths or contact-time diagrams. The page gives local times and visibility only.
- No "Mark observed" for events, so `src/lib/observations/redirect.ts` is untouched.
- No change to the verdict, ranking or session plan maths, and no change to the forecast.
- No pointer target inside the verdict over the live sky.

## Implementation Approach

The work runs bottom-up and is split by event kind, as the roadmap's risk suggests. Each engine phase ships a tested, pure piece:
1. The event model, the shared visibility test, and the four search-backed kinds (lunar eclipse, local solar eclipse, greatest elongation, opposition).
2. Close pairings, the one scan, with an independent Skyfield fixture.
3. Meteor showers: the data table, the licence note, and the J2000 peak search.
4. Tonight: the `withSkyEvents` view block, the `/tonight/events` page, offline storage and the e2e spec.
5. The dashboard tile, the verdict line, the specimens, the screenshot matrix and CLAUDE.md.

**Decisions delegated to the agent** (non-UI, recorded in the brief):
- **Engine layout.** The engine stays flat:
  - `src/lib/engine/events.ts`: the model, the visibility helper, `skyEvents`, and the eclipse, elongation and opposition searches;
  - `src/lib/engine/pairings.ts`;
  - `src/lib/engine/meteors.ts`.

  The shower table lives in `src/lib/catalogue/meteor-showers.ts`, next to the other hand-entered data and `LICENSE-DATA.md`.
- **The window** is 30 observing nights (local noon to noon) starting at the selected night. An event belongs to the night that contains its relevant moment (`observingNightDateFor`). So a daytime solar eclipse falls in that day's night, and "tonight" includes the afternoon before it.
- **Visibility belongs to the model.** Every event carries `visible`, plus a `reason` when it is not visible. The tile, the verdict line and all "best time" wording read only visible events, which enforces the PRD invariant in one place.
- **Pairings** are computed from the site:
  - Moon-planet sampled hourly, planet-planet every 3 hours.
  - Within each night's visible span (both bodies at or above the minimum altitude, Sun at or below −6°), the best sample is refined to the minute.
  - Consecutive nights of the same pair cluster into one event, dated at its closest visible night.
- **Shower peak times** come from the J2000 longitude search. A peak is presented as a night, never a minute, because maxima are known only to about 1° of solar longitude.
  - The radiant must be at or above the minimum altitude during the site's dark window, on the peak night or the night before or after.
  - A peak that falls in daylight shows "best the night before" or "best the night after", whichever has the higher radiant.
  - A bright Moon is flagged: illuminated fraction ≥ 0.5 and up during that dark window.
- **The dashboard tile is always shown,** like "Point here first". It keeps one fixed tile list, and its empty line is a fact, not a gap.

## Critical Implementation Details

- **Frames.**
  - Pairings use `Equator(body, t, observer, true, true)` for both bodies, so both are topocentric and of date, then `AngleBetween(a.vec, b.vec)`.
  - Altitudes use `Horizon(t, observer, ra, dec, "normal")`.
  - Shower radiants are J2000. Under 0.5° of precession is negligible for an altitude test, so `Horizon` takes them directly.
  - Never mix J2000 and of-date vectors in one separation.
- **Search returns.**
  - Use the window's start as `startTime`.
  - Each search returns the next event regardless of distance, so keep the result only when its moment is before the window's end.
  - Loop `NextLunarEclipse` and `NextLocalSolarEclipse` until past the window. A window can hold two lunar eclipses in theory, but the loop is cheap.
- **Solar eclipse safety.** Every solar eclipse row, visible or not, renders the fixed safety line `tonight.events.solarSafety`. The tile and the verdict line name a visible solar eclipse with "eclipse glasses only" wording, never "go out and look".
- **The verdict height (owner, plan review F3).**
  - The line renders only on a night with a notable visible event. On those nights the layout shifts down by one line. The owner accepts this: no reserved space.
  - `VERDICT_MIN_HEIGHT_CLASS` and the skeleton keep today's height, so the skeleton-to-content jump on event nights is accepted too.
  - `tonight-phone.spec.ts` must not depend on the run date. It measures the event line (`[data-verdict-event]`, 0 when absent) and subtracts its height before asserting that the Site card and the Telescope card's title sit above the TabBar. So it holds on any night, and a fixed-date event night is covered by the Phase 5 manual check on a `/design` specimen.

## Phase 1: Event model and the search-backed events

### Overview

The pure event model and its visibility test, and the four kinds astronomy-engine searches directly: lunar eclipse, local solar eclipse, greatest elongation of Mercury and Venus, and opposition of Mars, Jupiter and Saturn. Test-first.

### Changes Required:

#### 1. Parameters

**File**: `src/lib/engine/parameters.ts`

**Intent**: Every event number is a named candidate, as the file's convention requires.

**Contract**: new documented candidates ("Candidate (S-07 planning, M-3, 2026-10-13)"):
- `EVENT_WINDOW_NIGHTS = 30`;
- `EVENT_MIN_ALTITUDE_DEG = 10` (owner decision 3), for every kind except eclipses;
- `ECLIPSE_MIN_ALTITUDE_DEG = 2` (owner, plan review F2): an eclipse is visible from 2° up. Between 2° and 10° it carries the note "low, needs an open horizon" (`lowHorizon: true`);
- `EVENT_SUN_MAX_ALTITUDE_DEG = -6` (twilight bound for night events; reuse the value of `PLANET_WINDOW_SUN_ALTITUDE_DEG`);
- `PAIRING_MAX_SEPARATION_DEG = 5` (owner decision 2);
- `METEOR_BRIGHT_MOON_FRACTION = 0.5`.

#### 2. The event model and searches

**File**: `src/lib/engine/events.ts` (new; + `events.test.ts`), re-exported from `src/lib/engine/index.ts`

**Intent**: One deterministic function returns every event of the window, with visibility decided by one rule.

**Contract**:
- `type SkyEventKind = "lunar-eclipse" | "solar-eclipse" | "elongation" | "opposition" | "pairing" | "meteor-shower"`.
- `SkyEvent` is a discriminated union on `kind`. Every event has:
  - `moment: Date`;
  - `night: string`: the observing-night date (`YYYY-MM-DD`) of `moment`;
  - `visibility`: either `{ visible: true; best: Date; altitudeDeg: number; azimuthDeg: number; partly?: boolean; lowHorizon?: boolean; shortNight?: boolean }`, or `{ visible: false; reason: "below-horizon" | "daylight" | "too-low"; shortNight?: boolean }`.
    - `lowHorizon` applies to eclipses only (F2).
    - `shortNight` marks a night with no dark window, where the −6° span was used (F5).
  - kind-specific fields:
    - eclipse: `eclipseKind`, `obscuration`, and for a lunar eclipse the partial/total spans;
    - elongation: `body`, `elongationDeg`, `apparition: "morning" | "evening"`;
    - opposition: `body`;
    - pairing: `bodies`, `separationDeg`;
    - meteor shower: `shower`, `brightMoon`, `bestNight`.
- `skyEvents(site: Site, fromNight: string, nights = EVENT_WINDOW_NIGHTS): SkyEvent[]`, in time order. Phases 2 and 3 plug their kinds into it.
- A shared helper `visibleAt(site, sample: (t) => HorizontalPosition, span: Interval)` returns the best moment in the span (the highest altitude, at or above `EVENT_MIN_ALTITUDE_DEG`) or the reason it fails.
  - "Daylight" means the Sun is above `EVENT_SUN_MAX_ALTITUDE_DEG` at every point where the body is high enough.
  - "Below the horizon" means the body is under 0° throughout.
  - "Too low" covers the rest.
- Per kind:
  - **Eclipses (one rule, F2 and F7b)** use `ECLIPSE_MIN_ALTITUDE_DEG`.
    - Visible if the body is at or above it at the peak.
    - Otherwise `partly` if it is at or above it at a contact (the partial phase's begin or end; for a lunar eclipse also the total phase's).
    - `lowHorizon` when the best of those altitudes is under `EVENT_MIN_ALTITUDE_DEG`.
  - **Lunar eclipse:** the body is the Moon, with its topocentric altitude. The phases are `peak ± sd_*`.
  - **Solar eclipse:** `SearchLocalSolarEclipse`. The body is the Sun, using the event's own `altitude`. "Daylight" never applies.
  - **Elongation:** `SearchMaxElongation` for Mercury and Venus. The span starts when the Sun reaches `EVENT_SUN_MAX_ALTITUDE_DEG` (−6°) in the evening and runs to the dark window's start, or from the dark window's end to −6° in the morning, per `visibility` (F7a). On a night with no dark window, the span is the whole −6° span, with `shortNight`.
  - **Opposition:** `SearchRelativeLongitude(body, 0, start)` for Mars, Jupiter and Saturn. The span is the night's dark window, or the −6° span with `shortNight` when there is no dark window (F5).
- No `Date.now` or argument-less `new Date()`; `fromNight` and the site are the only inputs (purity test).

**Tests** (`events.test.ts`). The window-start dates are fixed.
- **Future eclipses.** They are computed with astronomy-engine at planning time (2026-10-13), and their dates and kinds match the NASA/Espenak eclipse catalogue (public-domain facts, cited in the test file). The rule is framed for future eclipses; no test relies on a past one (F2).
- **The total solar eclipse of 2027-08-02.** Window from 2027-07-20:
  - from Cádiz (36.5° N, 6.3° W) it is total, with the Sun about 37° up, and visible;
  - from Madrid it is partial (obscuration about 0.86) and visible;
  - from Warsaw it is partial (about 0.30) and visible;
  - from a site where the Sun is below the horizon at the local peak, it is not visible.
- **The total lunar eclipse of 2028-12-31** (about 16:51 UTC). Window from 2028-12-15. It is listed as total. Its visibility follows the Moon's altitude at two contrasting sites, one with the Moon up and one with it down.
- **A low eclipse** (the Moon between 2° and 10° at the peak, at a site chosen for that) is visible with `lowHorizon`.
- **The penumbral lunar eclipse of 2027-02-20.** It is listed but not notable (owner decision 4).
- Mercury's greatest elongation on 2026-11-20 (morning, about 19.6°): its moment is within 1 hour of the reference and its apparition is "morning".
- A window with no opposition (from 2026-10-13) contains none. A window containing the 2027 Jupiter opposition (about 2027-02-11) contains it within 1 day.
- **The invariant:** every event with the body below its kind's minimum at every relevant moment has `visible: false`, checked over a grid of sites and windows. Mercury at a low elongation in high-latitude summer is "too-low" or "daylight", never visible.
- **Determinism:** two calls return deep-equal results.
- **Budget:** `skyEvents` for 30 nights runs under a local budget (the `determinism.test.ts` pattern, asserted locally, logged in CI).

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/engine/events.test.ts src/lib/engine/purity.test.ts` passes
- `npx astro check`, `npm run lint` and `npm test` pass

**Implementation Note**: Test-first. Commit the phase on green.

---

## Phase 2: Close pairings

### Overview

Moon-planet and planet-planet pairings within `PAIRING_MAX_SEPARATION_DEG`, computed from the site, at their best visible moment, pinned against an independent Skyfield reference.

### Changes Required:

#### 1. Pairing search

**File**: `src/lib/engine/pairings.ts` (new; + `pairings.test.ts`), plugged into `skyEvents`

**Intent**: The only scan in the slice, kept fast and honest about visibility.

**Contract**:
- `pairingEvents(site, window): PairingEvent[]` over two sets of pairs:
  - the Moon with each of Mercury, Venus, Mars, Jupiter and Saturn;
  - the 10 pairs among those five planets.
- **Sampling:** hourly for the Moon, every 3 hours for planets. At each sample, the topocentric separation, both altitudes and the Sun's altitude.
- **Per observing night:** among samples where both bodies are at or above `EVENT_MIN_ALTITUDE_DEG` and the Sun is at or below `EVENT_SUN_MAX_ALTITUDE_DEG`, take the smallest separation. Refine it to the minute within ±1 sample step, staying inside that visible span.
- **Clustering:** keep it if it is at or under the threshold. Consecutive nights of the same pair become one event dated at its closest night.
- **Not visible:** a pair at or under the threshold whose geometric minimum lies outside every visible span is still listed, as not visible, with the reason. This uses the same rule as the other kinds, so the page explains why nothing shows.

#### 2. Independent reference fixture

**Files**: `scripts/events-reference.py` (new), `src/lib/engine/fixtures/skyfield/pairings-*.json` (new), `src/lib/engine/fixtures/README.md`

**Intent**: Pin the pairing maths against a second ephemeris, as `planets.test.ts` and `moon.test.ts` already do with Skyfield/DE421.

**Contract**:
- The script follows `scripts/planet-reference.py`: a throwaway venv, with the recipe recorded in the README.
- For two sites and two fixed 30-night windows, it records each pair's topocentric minimum separation per night, with its time.
- The tests assert that the engine's separation is within 0.05° of the fixture's, and its time within 10 minutes, at the fixture's moments.
- Also tested: the visibility clustering (one event per pair per approach) and that the threshold is inclusive.
- The frequency at the owner's 5° is re-measured with the exact rule (at least 10° up, Sun at or below −6°) over the same 5-year span as research §3, and recorded in `research.md`. It is a record, not a gate.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/engine/pairings.test.ts src/lib/engine/events.test.ts src/lib/engine/purity.test.ts` passes
- `npx astro check`, `npm run lint` and `npm test` pass (incl. the events budget test)

**Implementation Note**: The fixture is generated once and committed. The script is not run in CI. Commit on green.

---

## Phase 3: Meteor showers

### Overview

The hand-entered shower table (owner decision 1, option A), its licence note, the IAU MDC email draft, and the peak-night search with radiant visibility and the bright-Moon flag.

### Changes Required:

#### 1. The table and its licence

**Files**: `src/lib/catalogue/meteor-showers.ts` (new; + `meteor-showers.test.ts`), `src/lib/catalogue/LICENSE-DATA.md`

**Intent**: The facts are entered by hand and attributed, with nothing copied as a table (OQ 19, not legal advice).

**Contract**:
- `METEOR_SHOWERS`: about 10 rows, each `{ key, peakSolarLongitudeJ2000Deg, radiantRaDeg, radiantDecDeg, speedKmS, rate }`, rounded. Candidates are the Quadrantids, Lyrids, Eta Aquariids, Southern Delta Aquariids, Perseids, Draconids, Orionids, Leonids, Geminids and Ursids.
- **Sourcing (plan review F4).** No field depends on the IMO:
  - **Peak night and approximate rate** come from NASA's shower pages: a US government work, reusable without implying endorsement.
  - **Peak λ** is computed by our engine from NASA's peak date, the Sun's J2000 longitude at the middle of that night: a derived fact. The file header records that λ is not taken from the IMO.
  - **Radiant and speed** come from the IAU MDC (citation as requested).
  - The rate is labelled approximate.
- **Cross-checks.** Each value is cross-checked against a second source (IMO, MDC or Wikipedia) by reading only. A shower NASA does not list is dropped, not filled from the IMO.
- **Notices.** The sources and the method are named in the file's header and in a new `LICENSE-DATA.md` section (facts entered by hand; λ derived; no table copied).
- The test pins the shape: every key has an EN and PL name, longitudes in [0, 360), Dec in [−90, 90], and positive rate and speed. Each λ also matches the J2000 longitude computed from the NASA date recorded in the file, within 1°.
- No value is taken from Wikipedia's table or the AMS list, and no table layout is copied from any source.

#### 1b. The IAU MDC email draft

**File**: `context/changes/sky-events/iau-mdc-request.md` (new; drafted at planning time)

**Intent**: The owner may send a short courtesy request to the IAU MDC. The agent drafts it but never sends it.

**Contract**: a plain-text email in English, addressed to the MDC contact listed on its site. It names the app, the ~10 rows and fields, the citation the app will carry, and asks for confirmation. It contains no personal data beyond what the owner adds when sending.

#### 2. Peak search and visibility

**File**: `src/lib/engine/meteors.ts` (new; + `meteors.test.ts`), plugged into `skyEvents`

**Intent**: Each shower's peak becomes a night, judged on its radiant.

**Contract**:
- `meteorEvents(site, window)`:
  1. For each shower, find the time when the Sun's J2000 ecliptic longitude equals the peak λ. Use `Search` over `SphereFromVector(RotateVector(Rotation_EQJ_ECL(), GeoVector(Body.Sun, t, true))).lon` with a wrap-safe difference, never `Ecliptic()` or `SearchSunLongitude`, which are of date (F1).
  2. Keep it if it is in the window.
  3. Its night is the observing night containing the peak.
  4. Test the radiant at or above the minimum during that night's dark window (the site's Bortle threshold, `darkWindow`). Do the same for the nights before and after. If the night has no dark window, use the span with the Sun at or below `EVENT_SUN_MAX_ALTITUDE_DEG` (−6°) instead, and set `shortNight: true` (shown as "short night"; F5).
  5. `bestNight` is the peak night if it passes, else the neighbour with the higher radiant.
  6. `brightMoon` is true when the Moon's illuminated fraction is at least `METEOR_BRIGHT_MOON_FRACTION` and it is up during that span (the dark window, or the −6° span on a short night).
- A shower whose radiant never clears the minimum (a southern shower at a northern site) is listed as not visible, "too-low" or "below-horizon".
- Tests:
  - At the found moment, the Sun's J2000 longitude matches λ within 0.001°, and its of-date longitude differs by about 0.37° in 2026 (research §2).
  - Future peaks: the Geminids 2026 peak falls on the night of 2026-12-13/14, and the Perseids 2027 peak on the night of 2027-08-12/13, matching NASA's dates.
  - A short night: a summer shower at about 60° N has no dark window, so the −6° span is used and `shortNight` is set.
  - The Quadrantids from 50° N are visible, and from −30° are too low.
  - The bright-Moon flag follows a known full-Moon peak.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/engine/meteors.test.ts src/lib/catalogue/meteor-showers.test.ts src/lib/engine/events.test.ts src/lib/engine/purity.test.ts` passes
- `npx astro check`, `npm run lint` and `npm test` (incl. i18n parity) pass

**Implementation Note**: Option A, owner decision 1. Commit on green.

---

## Phase 4: The events page

### Overview

Events reach Tonight as an optional view block and get their own focused page, stored offline like the others.

### Changes Required:

#### 1. The view block

**Files**: `src/lib/tonight/build.ts`, `src/lib/tonight/load.ts`, `src/lib/tonight/island.ts`, `src/lib/no-console-guard.test.ts` (+ `build.test.ts`)

**Intent**: One formatted, failure-isolated events block, built only where asked.

**Contract**:
- `buildTonight` gains `options.withSkyEvents`, threaded through `LoadTonightInput` and `TonightIslandLoad`.
- `TonightView.skyEvents` is `TonightSkyEvents | null`: `{ events: TonightSkyEvent[]; tonight: TonightSkyEvent[]; next: TonightSkyEvent | null; windowNights: number }`.
  - Each formatted event has its kind, a display name (catalogue keys), `when` (`formatDayTime` in the site's zone), a night label, the visibility text (best time, altitude and compass point, or the reason), `notable`, and for solar eclipses `safety: true`.
  - `tonight` holds the notable visible events of the selected night. `next` is the first notable visible event from the selected night on.
- A failure leaves `skyEvents: null` and logs one fixed line plus `error.name`, using the `sessionPlan` pattern. That needs an allowlisted `no-console` disable and its `ALLOWED_DISABLES` count.
- **Notable** (owner decision 4) means visible and not a penumbral lunar eclipse.

#### 2. The page

**Files**: `src/pages/tonight/events.astro` (new), `src/components/tonight/EventsPageContent.astro` (new), `src/components/tonight/SkyEventList.astro` (new), `src/i18n/messages/en.ts`, `pl.ts`

**Intent**: The 30-night list, modelled on `/tonight/nights`.

**Contract**:
- The shell (`GearShell skyFlow`) passes `siteId`, `telescopeId`, `night` and `notice` to the island, which renders:
  - a `server:defer` island with `TonightPageSkeleton` as fallback;
  - `TonightPageSky`;
  - `OfflineCopy`;
  - `SkyEventList` in the standard content container.
- `SkyEventList` groups events by night: a heading per night (`formatNightDate`), then one row per event.
  - Each row has a lucide icon for the kind (`aria-hidden`), the name, `when`, and the visibility text.
  - Visible rows use heading ink with a "Visible" mark. Not-visible rows are muted with the reason. Red mode tells them apart by the mark and weight, not hue.
  - Solar-eclipse rows always show the safety line.
  - The empty state: `tonight.events.empty` ("No sky events in the next 30 nights").
- Rows carry `data-event-kind` and `data-visible` for e2e.
- Copy:
  - `tonight.summary.events`, `tonight.pages.events`;
  - `tonight.events.*`: kind names, eclipse kinds, elongation apparitions, visibility reasons, best-time line, bright-Moon note, safety line, empty state;
  - `targets.meteorShower.<key>` for shower names.

  EN and PL; planet names reuse `targets.planet`.

#### 3. Offline

**Files**: `src/lib/offline/copies.ts`, `src/lib/offline/copies.test.ts`, `src/pages/offline.astro`, `src/sw.ts` (comments), `CLAUDE.md` (Offline section)

**Intent**: The page is stored and listed offline like the other Tonight pages.

**Contract**:
- `"/tonight/events"` joins `TONIGHT_PAGES` **last**, after `/tonight/nights`. `listCopies` orders by that array, so the position is user-visible on `/offline` (F7c). The `copies.test.ts` order cases are updated.
- Every comment that says "six pages" is updated: `src/sw.ts` (about :601), `src/lib/offline/copies.ts` (about :10, :160 and :499), and the Offline section of `CLAUDE.md`.
- Its title joins `titles` in `offline.astro`.
- The page-list tests are updated.
- `src/sw.ts`: comments only. Its logic is generic over the list. This touches the same offline files finder-chart changed, which are already on main.

#### 4. e2e

**Files**: `tests/e2e/sky-events.spec.ts` (new), `tests/e2e/tonight-phone.spec.ts`

**Intent**: Prove the page renders and states visibility, whatever tonight's real sky holds.

**Contract**:
- A fresh Madrid user on the all-clear fixture (real clock, so the spec never asserts which events occur). It checks:
  - the page's h1 and back link;
  - either `[data-event-kind]` rows, each with a time and either a "Visible" mark or a reason, or the empty state;
  - no not-visible row carries the visible mark;
  - solar-eclipse rows carry the safety line.
- `/tonight/events` joins the phone spec's `TONIGHT_PAGES` for the sideways-scroll check.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/tonight/build.test.ts src/lib/offline/copies.test.ts src/lib/no-console-guard.test.ts` passes
- `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test tests/e2e/sky-events.spec.ts tests/e2e/tonight-phone.spec.ts tests/e2e/offline.spec.ts` passes (preview on 4333 and fixture on 4400 already running; see "Running the checks")
- `npx astro check`, `npm run lint` and `npm test` (incl. i18n parity) pass

#### Manual Verification:

- `/tonight/events` in EN/PL × dark/light/red at 390 px and desktop: rows readable, visible vs not distinguishable in red mode, PL at 320 px, the empty state, and a solar-eclipse row with the safety line (via a pinned-date specimen if none falls in the window)

**Implementation Note**: Measure the island's `skyEvents` time once on the 4333 preview and note it beside Progress 4.2 (F6). Commit on green. The manual check is deferred to the end with screenshot evidence.

---

## Phase 5: The dashboard tile and the verdict line

### Overview

FR-043 on the dashboard: the next notable event as a tile, and tonight's named under the verdict.

### Changes Required:

#### 1. Tile and verdict line

**Files**:
- `src/components/tonight/TonightContent.astro`, `TonightTiles.astro`, `TonightSkeleton.astro`;
- `src/components/tonight/VerdictCard.astro`, `sky-band.ts`;
- `src/pages/design.astro`;
- `src/i18n/messages/en.ts`, `pl.ts`;
- `tests/e2e/tonight-dashboard.spec.ts`, `tests/e2e/tonight-phone.spec.ts`.

**Intent**: The next notable event is one glance away, and tonight's is named where the user reads the verdict (owner decision 5).

**Contract**:
- `TonightContent` loads with `withSkyEvents`.
- `TonightTiles` adds a sixth `Tile`, "Sky events", straight after the Targets tile ("Point here first"), linking to `/tonight/events` (owner decision 5). Its line is `next` ("Perseids · night of 12/13 Aug", or "Moon and Jupiter, 1.8° apart · tonight"), or `tonight.summary.eventsNone`. It is always shown.
- `TonightSkeleton` gains a sixth row, in the same position.
- `VerdictCard` gains an optional `event` prop: one muted, plain-text line under the reason, "Tonight: <name>". It names up to one event plus "+1 more" when there are several.
  - A solar eclipse reads "eclipse glasses only".
  - The line carries `data-verdict-event`. `VERDICT_MIN_HEIGHT_CLASS` is unchanged (F3).
- `/design` gets specimens for the verdict with and without the event line, and for the events tile with an event and with none.
- `tonight-dashboard.spec.ts` `TILES` gains the events tile as its second entry.
- `tonight-phone.spec.ts` subtracts the measured event line's height (F3), so it passes on event and no-event nights alike. The tiles sit below the pinned cards, so the tile does not move that screen.

#### 2. Docs

**File**: `CLAUDE.md`

**Contract**: a short paragraph after "Observing milestones", covering:
- `events.ts`, `pairings.ts`, `meteors.ts` and `skyEvents`;
- the visibility rule and the invariant;
- the shower table and its licence note;
- `withSkyEvents`, `/tonight/events` (in `TONIGHT_PAGES`), the tile and the verdict line.

### Success Criteria:

#### Automated Verification:

- `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npm run test:e2e` passes: the WHOLE suite, as CI runs it, with `dismissCelebrationIfOpen` after any save rated 3 or above
- `npx astro check`, `npm run lint`, `npm test` and `npm run build` pass

#### Manual Verification:

- The dashboard in EN/PL × dark/light/red at 390 px and desktop: the second tile (events) reads well, and on an event night (a pinned `/design` specimen) the verdict line reads well. The one-line shift is accepted (F3).
- `/design` specimens for the verdict line and the events tile render in all themes

**Implementation Note**: After this phase, `/10x-impl-review`. Then the whole e2e suite, a push and one PR.

---

## Running the checks

S-06's recipe for this worktree:
1. `npm ci` (done).
2. Build the env from `npx supabase status -o env` in the scratchpad, without printing values. Pass it to the preview through the process environment with `CLOUDFLARE_INCLUDE_PROCESS_ENV=true`; writing `.env` or `.dev.vars` is not used.
3. Start the forecast fixture: `node tests/e2e/forecast-fixture.mjs` on 4400 (this agent's port).
4. `npm run build`, then `npm run preview -- --port 4333`. Restart it after every rebuild. Stop it with `npx astro preview stop`.
5. Run e2e with `BASE_URL=http://localhost:4333` and the Supabase values in the environment.
6. Never reset or reseed local Supabase. This slice has no migration.

## Testing Strategy

### Unit Tests:

- `events.test.ts`:
  - eclipses and elongation against published dates and kinds;
  - opposition presence and absence;
  - the visibility invariant over a site grid;
  - determinism;
  - the budget.
- `pairings.test.ts`: separations and times against the Skyfield fixture, clustering, and the threshold.
- `meteors.test.ts`: the J2000 peak search, peak nights, radiant visibility by latitude, the bright-Moon flag.
- `meteor-showers.test.ts`: the table's shape and names.
- `build.test.ts`: the `skyEvents` block, `tonight`, `next`, `notable`, and the failure path giving null.
- `copies.test.ts`: `/tonight/events` is storable and listed.

### Integration Tests:

- `sky-events.spec.ts`: the page structure, the visibility marks and the empty state.
- `tonight-dashboard.spec.ts`: the sixth tile opens the page.
- `tonight-phone.spec.ts`: no sideways scroll on the page; the first screen still holds.
- The whole suite before the PR.

### Manual Testing Steps:

1. Open `/tonight/events` for the Madrid site: events grouped by night, times in CEST/CET, visible and not-visible rows distinct.
2. On a `/design` specimen with an event tonight: the verdict line reads well and the dashboard's first screen still shows the Site card at 390×844.
3. Offline: open the events page online, go offline, and reopen it from the stored copy.

## Performance Considerations

- A 30-night pass is measured at under about 200 ms on a laptop. Pairings dominate: about 7,200 `Equator` calls for the Moon, plus about 2,400 pair samples for planets.
- It runs only for the dashboard and the events page (`withSkyEvents`), inside the deferred island, so the shell paints first.
- A local budget test guards it. Its budget is set from a first measured run, not a guess (plan review F6; the reviewer measured about 29 ms warm on a laptop).
- **One timing measurement on the preview (F6).** During Phase 4, the island's `skyEvents` time is measured once on the 4333 preview and recorded in the plan's Progress note. It is a single run, not a test.
- **Repeat cost.** The pass runs on every dashboard and events-page render, and again for each page's `?night=next` background copy. Memoising per isolate, by rounded site, zone and night outside the engine, stays optional and is not planned.

## Migration Notes

None: no schema or stored-data change. The offline worker picks up the new page from `TONIGHT_PAGES` on the next deploy.

## References

- Research: `context/changes/sky-events/research.md`
- PRD: `context/foundation/prd.md:205-217,454-455,581,726-730`
- Roadmap: `context/foundation/roadmap.md` "S-07: Sky events"
- Focused-page model: `src/pages/tonight/nights.astro`, `src/components/tonight/NightsPageContent.astro`
- Optional view block: `src/lib/tonight/build.ts` (`sessionPlan`)
- Independent references: `scripts/planet-reference.py`, `src/lib/engine/fixtures/README.md`
- Data licences: `src/lib/catalogue/LICENSE-DATA.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Event model and the search-backed events

#### Automated

- [x] 1.1 `npx vitest run src/lib/engine/events.test.ts src/lib/engine/purity.test.ts` passes
- [x] 1.2 `npx astro check`, `npm run lint` and `npm test` pass

### Phase 2: Close pairings

#### Automated

- [ ] 2.1 `npx vitest run src/lib/engine/pairings.test.ts src/lib/engine/events.test.ts src/lib/engine/purity.test.ts` passes
- [ ] 2.2 `npx astro check`, `npm run lint` and `npm test` pass (incl. the events budget test)

### Phase 3: Meteor showers

#### Automated

- [ ] 3.1 `npx vitest run src/lib/engine/meteors.test.ts src/lib/catalogue/meteor-showers.test.ts src/lib/engine/events.test.ts src/lib/engine/purity.test.ts` passes
- [ ] 3.2 `npx astro check`, `npm run lint` and `npm test` (incl. i18n parity) pass

### Phase 4: The events page

#### Automated

- [ ] 4.1 `npx vitest run src/lib/tonight/build.test.ts src/lib/offline/copies.test.ts src/lib/no-console-guard.test.ts` passes
- [ ] 4.2 `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test tests/e2e/sky-events.spec.ts tests/e2e/tonight-phone.spec.ts tests/e2e/offline.spec.ts` passes
- [ ] 4.3 `npx astro check`, `npm run lint` and `npm test` (incl. i18n parity) pass

#### Manual

- [ ] 4.4 `/tonight/events` in EN/PL × dark/light/red at 390 px and desktop: rows readable, visible vs not distinguishable in red mode, PL at 320 px, the empty state, and a solar-eclipse row with the safety line

### Phase 5: The dashboard tile and the verdict line

#### Automated

- [ ] 5.1 `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npm run test:e2e` passes: the whole suite, as CI runs it
- [ ] 5.2 `npx astro check`, `npm run lint`, `npm test` and `npm run build` pass

#### Manual

- [ ] 5.3 The dashboard in EN/PL × dark/light/red at 390 px and desktop: the second tile (events) reads well, and on an event night (a pinned `/design` specimen) the verdict line reads well; the one-line shift is accepted (F3)
- [ ] 5.4 `/design` specimens for the verdict line and the events tile render in all themes
