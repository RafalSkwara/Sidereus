---
date: 2026-10-13T16:28:07+0200
researcher: Claude (sky-events agent)
git_commit: 998b30f
branch: feat/sky-events
repository: RafalSkwara/Sidereus
topic: "Sky events (M-3 S-07): what the engine can compute, what counts as a close pairing, where meteor-shower data can come from, and how events reach Tonight and its offline copies"
tags: [research, engine, astronomy-engine, sky-events, meteor-showers, licensing, tonight, offline]
status: complete
last_updated: 2026-10-13
last_updated_by: Claude (sky-events agent)
last_updated_note: "Rebased onto main 998b30f (finder-chart #155, EPIPE #156); §7 rewritten. Owner answers of 2026-10-13 recorded under Open Questions (OQ 19 option A, OQ 20 = 5°, 10° altitude, notable default, tile after Targets)."
---

# Research: Sky events (M-3 S-07)

## Research Question

FR-042 asks for the sky events of the next 30 days for the selected site, each with its time in the site's timezone and whether it is visible from there:
- meteor shower peaks;
- planet oppositions;
- Mercury and Venus greatest elongations;
- close Moon-planet and planet-planet pairings;
- solar and lunar eclipses.

FR-043 adds the next notable event as a dashboard tile, and tonight's event named next to the sky verdict (`context/foundation/prd.md:454-455`). US-07 adds the acceptance criteria: no external feed, and "an event below the site's horizon is shown as not visible from the site, never as something to go out for" (`prd.md:205-217`, also an invariant at `prd.md:581`).

The roadmap's unknowns (`context/foundation/roadmap.md:175-188`):
- **Open Question 19:** meteor-shower data whose terms allow reuse, including commercial reuse (`prd.md:726-727`).
- **Open Question 20:** what counts as a close pairing (`prd.md:728-730`).
- **Risk:** several kinds of event maths at once.
- **Requirement:** a pure, deterministic engine computation, so that events work in stored offline copies.

## Summary

- **The library already has almost everything.** astronomy-engine 2.1.19 (`package.json:42`) exports a search function for every event kind except close pairings and meteor showers:
  - eclipses, local and global;
  - greatest elongation;
  - opposition, via relative longitude;
  - the Sun reaching a solar longitude.

  The engine uses none of them today. Pairings need a sample-and-refine search over topocentric separation. Showers need a small fixed data table.
- **Cost is small.** A measured 30-day pass of all kinds takes under about 200 ms on a laptop (warm JIT; not measured on Workers).
- **Close pairings are rare.** Almanacs report the appulse (the minimum apparent separation) with no shared threshold; 1°, 2°, 3° and 5° all appear. In a simulation for a Warsaw-like site over 5 years, the PRD's candidate rule (within 3°, both up in darkness or twilight) found about 0.46 visible Moon-planet and 0.12 planet-planet pairings per 30 days. A 30-day list will often have no pairing, and sometimes no event at all, so the empty state is a first-class case.
- **No meteor-data source both licenses commercial reuse and has every field.**
  - The IMO and AMS reserve all rights.
  - The IAU MDC states no licence and only asks for citation; it has no ZHR.
  - Wikipedia is CC BY-SA 4.0 (share-alike).
  - Wikidata (CC0) lacks the fields.

  A hand-written list of about 10 major showers, built from facts (peak solar longitude, radiant position, speed, rate) cross-checked against at least two sources and citing them, is a defensible option. It is **pending owner confirmation and not legal advice**.
- **One ingredient is missing for "visible".** Visibility is a per-event, per-site altitude test during the right part of the night. The engine already has dark-window and twilight helpers, but no fixed "high enough" altitude for events; that is a new tunable (candidate 10°).
- **Integration follows existing precedents.**
  - A `withSkyEvents` option on `buildTonight`, built like `sessionPlan`.
  - A new focused page, `/tonight/events`, modelled on `/tonight/nights`.
  - A sixth dashboard tile.
  - One line in `VerdictCard`.
- **Offline storage needs one list entry.** A page renders into a stored copy once it is added to `TONIGHT_PAGES`. The service worker is generic over that list.

## Detailed Findings

### 1. What astronomy-engine provides (installed 2.1.19)

Signatures are from `node_modules/astronomy-engine/astronomy.d.ts`; line numbers refer to that file.

| Event kind | Function(s) | Returns | Notes |
| --- | --- | --- | --- |
| Lunar eclipse | `SearchLunarEclipse(date)` (:2781), `NextLunarEclipse(prev)` (:2863) | `{kind, obscuration, peak, sd_penum, sd_partial, sd_total}` (:2757) | Global event. Semi-durations are in minutes. Visibility needs the Moon's altitude at the peak and phases. |
| Solar eclipse | `SearchLocalSolarEclipse(start, observer)` (:3007), `NextLocalSolarEclipse` (:3028) | `{kind, obscuration, partial_begin, total_begin?, peak, total_end?, partial_end}`, each `{time, altitude}` (:2916, :2974) | Already per observer. The altitude is the Sun's. The docs warn an eclipse "might be partly or completely invisible due to time of day". |
| Greatest elongation | `SearchMaxElongation(body, start)` (:1974) | `{time, visibility: "morning"\|"evening", elongation, ecliptic_separation}` (:1925) | Mercury and Venus only; any other body throws. |
| Opposition | `SearchRelativeLongitude(body, 0, start)` (:1469) | `AstroTime` | Heliocentric relative longitude. 0 is the opposition of a superior planet. |
| Meteor peak | `SearchSunLongitude(lon, start, limitDays)` | `AstroTime \| null` | Works in the apparent ecliptic **of date**. |
| Pairing | none; build from `Equator(body, t, observer, true, true)` (:718) and `AngleBetween` (:123) | — | `PairLongitude` (:1321) exists if longitude conjunction is ever wanted. |
| Visibility | `Horizon` (:634), `SearchAltitude` (:1735), `SearchRiseSet` (:1667) | — | Already used by `src/lib/engine/sun.ts:1`. |

The engine imports none of the search functions above (searched `src/`). The ones in use are `Equator`, `Horizon`, `SearchAltitude`, `SearchRiseSet`, `SearchHourAngle`, `Illumination`, `MoonPhase`, `GeoVector` and `AngleBetween` (`moon.ts:1-13`, `planets.ts:1`, `sun.ts:1`).

The research worker measured on a laptop, Node 22, warm (probe scripts in the session scratchpad):

| Task | Time |
| --- | --- |
| Moon × 5 planets, hourly, 30 days (7,200 `Equator` calls) | about 46 ms |
| Sun altitude each hour for 30 days | about 4 ms |
| Five `SearchRelativeLongitude` calls | under 1 ms |
| Two `SearchMaxElongation` calls | about 1 ms |
| One `SearchLunarEclipse` | about 1 ms |
| One `SearchLocalSolarEclipse` | about 2 ms |

The total estimate for all kinds is under about 200 ms. It is UNVERIFIED on Workers, where the account has been on the Paid plan since 2026-09-30, with no 10 ms cap (`context/foundation/infrastructure.md:19`).

### 2. Event kinds: moment and visibility

From the event-maths research. The minimum altitude is discussed in §3.

- **Opposition** (Mars, Jupiter, Saturn).
  - The moment is from `SearchRelativeLongitude(body, 0, windowStart)`, kept only if it falls before the window's end.
  - The planet is up most of the night, but a southern planet can still be low. Mars near −25° declination culminates at about 13° from 52° N, so the altitude test still applies.
  - Measured from 2026-10-13: none of Mars, Jupiter or Saturn reaches opposition in the next 30 days. Uranus does on 2026-11-25. Uranus and Neptune are mag 5.7 and 7.8, not beginner naked-eye objects (magnitudes UNVERIFIED in-session).
- **Greatest elongation** (Mercury, Venus).
  - The moment is from `SearchMaxElongation`. Its `visibility` field says "evening" (after sunset) or "morning" (before sunrise).
  - Visible means above the minimum altitude during that twilight, Sun between about 0° and −12°.
  - Secondary sources note that the elongation night is not always the best viewing night: the ecliptic's angle to the horizon matters. So the altitude test is required.
  - Measured: Mercury morning 2026-11-20 23:35 UTC, 19.6°. A secondary source agrees, 19°37′.
- **Lunar eclipse.**
  - Use `SearchLunarEclipse(windowStart)`. Phase times are `peak ± sd_*` minutes.
  - Visible means the Moon is above the minimum altitude at the peak, or during the partial or total phase. Use the topocentric `Equator` and `Horizon` at those instants.
  - A penumbral eclipse is barely noticeable (a product choice: label it "subtle" or leave it out).
  - Measured: the next is a penumbral on 2027-02-20, so none in the next 30 days.
- **Solar eclipse.**
  - `SearchLocalSolarEclipse(windowStart, observer)` already accounts for the site's position. Visible means the Sun's `altitude` at the local peak is at or above the minimum. If only part of the eclipse is above the horizon, it is partly visible.
  - Every solar-eclipse entry needs a fixed safety line: never look at the Sun without certified eclipse glasses (ISO 12312-2) or a proper solar filter. Wording is drawn from the AAS guidance (https://cswa.aas.org/press/american-astronomical-society-offers-warnings-reassurances-eclipse-glasses); NASA's own page wasn't fetched, so check the wording before shipping.
  - Measured at 52.2° N: the next is a partial on 2027-08-02.
- **Meteor shower peak.**
  - The moment is when the Sun reaches the shower's peak solar longitude.
  - **Gotcha:** sources give λ☉ for equinox J2000.0, while `SearchSunLongitude` works in the ecliptic of date. The difference is about +0.37° in 2026, about 9 hours of Sun motion.
  - Measured for the Perseids, λ 140.0: uncorrected 2026-08-12 16:47 UTC, corrected 2026-08-13 02:08 UTC. A secondary source gives 2026-08-13 02:00-04:00 GMT, which agrees with the corrected time.
  - A Geminids cross-check matched neither time (UNVERIFIED). The precession correction needs a reference check during implementation.
  - The IMO says maxima are often known only "to the nearest 1° of solar longitude" (about a day). So a peak is best shown as a **night**, not a minute.
  - Visible means the radiant is above the minimum altitude during the dark window of the peak night (Sun at or below −12° or −18°). The peak instant often falls in daytime, so the test uses the night nearest the peak.
  - A bright Moon (illuminated fraction above about 50%, up during the dark window) is worth flagging. That threshold is a product choice, not a published convention.
- **Close pairing.** See §3.

### 3. Close pairing (Open Question 20) and minimum altitude

- **Definition.** Report the appulse, the minimum apparent separation, not a conjunction in RA or longitude.
  - It is what the eye sees.
  - It is well defined when a planet retrogrades.
  - Sources: https://en.wikipedia.org/wiki/Appulse; Sky at Night (https://skyatnightmagazine.com/advice/skills/conjunctions-in-night-sky-how-see).
- **Thresholds in use differ.**
  - In-The-Sky.org entries mirrored by the BAA list close approaches up to about 3°, with no stated rule (UNVERIFIED).
  - sky-tonight.com uses 1.5°, and lists approaches that happen in daylight or below the horizon. That is the exact failure the PRD invariant forbids.
  - Sky & Telescope treats three planets "within a 5° circle" as notable.
  - A beginner's binocular field is about 6-8°, so 5° is a natural ceiling.
  - The PRD candidate is 3°.
- **Topocentric for the Moon.** The measured parallax effect on the Moon-Jupiter separation at 52° N over 30 days is up to 0.94°. Computing all pairs topocentrically (`Equator(..., observer, true, true)`) makes the event per site.
- **Bodies.**
  - Moon with Mercury, Venus, Mars, Jupiter and Saturn.
  - Planet-planet among those five.
  - Uranus and Neptune and bright stars are out: the PRD names only Moon-planet and planet-planet.
- **Event time.** Use the best visible moment, not the global minimum: the smallest separation within the hours when both bodies are at least the minimum altitude and the Sun is at or below −6°. List the pairing only if that separation is within the threshold.
- **Frequency** (simulated, Warsaw-like site, 5 years from 2026-10-13, topocentric, "best visible moment per night"). Events per 30 days:

  | Case | ≤ 2° | ≤ 3° | ≤ 5° |
  | --- | --- | --- | --- |
  | Moon-planet, alt 5°, Sun −6° | 0.20 | 0.46 | 1.05 |
  | Moon-planet, alt 10°, Sun −12° | 0.11 | 0.26 | 0.67 |
  | Planet-planet, alt 5°, Sun −6° | 0.08 | 0.12 | 0.16 |

  Testing only the instant of minimum gave 0.11 Moon-planet events per 30 days at ≤ 3°, far stricter.
- **Minimum altitude.** No primary almanac rule was found (UNVERIFIED).
  - Satellite-pass tools use 10°.
  - timeanddate bands the Moon's altitude in 6° steps and warns that the lowest band is hard to see.
  - A fixed 10° (about one fist at arm's length) is a defensible beginner rule. Showing the altitude and compass direction helps the user judge.
  - It is new: the nearest existing constant is `MOON_LOW_ALTITUDE_DEG = 30` (`parameters.ts:306`), which is about moonlight, not visibility.

### 4. Meteor-shower data (Open Question 19): what the terms say

Not legal advice. It reports what primary pages say; UNVERIFIED marks what could not be read on one. All requests used no personal data.

| Source | Terms (quoted, primary page) | Commercial reuse | Fields |
| --- | --- | --- | --- |
| **IMO** Working List / Calendar | Legal notice (Wayback 2025-12-31, https://web.archive.org/web/20251231201819/https://www.imo.net/legal-notice/): "No part of the Copyright protected structure of this website may be reproduced … without the prior written permission of the Publisher." The live site shows "Website restoration" (2026-10-13). | Needs prior written permission | Every field: activity, peak date, peak λ, RA, Dec, V∞, r, ZHR |
| **IAU MDC** (Slovak Academy of Sciences) | https://ceresiaumdc.ta3.sk/: "Whenever using data of the IAU MDC shower database, please, refer to References." No licence or copyright text on the site or in the data files' headers (both files searched). | Not stated either way (a citation request, not a licence) | λ begin, end and average (J2000), RA/Dec, daily motion, Vg, orbits. **No ZHR, no peak λ as such** (LoS is an activity-averaged longitude). |
| **AMS** | https://www.amsmeteors.org/legal/: "No part of the copyright protected structure of this publication may be reproduced … without the prior written permission of the publisher." Its table: "Information and Table Template Courtesy the International Meteor Organization". | Needs prior written permission (IMO-derived) | Every field, but values differ from the IMO (Perseids ZHR 100 vs 150) |
| **NASA** | https://www.nasa.gov/nasa-brand-center/images-and-media/: "NASA content … generally are not subject to copyright in the United States … may be used without needing explicit permission … must not … convey NASA's endorsement". Third-party material is excluded. | Allowed (no endorsement) | Only "Fast Facts" per shower (peak night, speed, rough rate). No λ, RA/Dec or ZHR table. |
| **Wikipedia** "List of meteor showers" | Footer: "Text is available under the Creative Commons Attribution-ShareAlike 4.0 License". | Allowed with attribution and **share-alike** | Activity, peak date, λ, RA, Dec, V, ZHR, parent. Mixed provenance (sources not verified). Values differ from the IMO (QUA ZHR 80 vs 120). |
| **Wikidata** | https://www.wikidata.org/wiki/Wikidata:Licensing: "released into the public domain under Creative Commons Zero". | Allowed (CC0) | Of 98 meteor-shower items, almost none have RA, Dec and speed; none have peak or ZHR. Unusable. |
| **Global Meteor Network** | https://globalmeteornetwork.org/data/: "released under the CC BY 4.0 license". | Allowed with attribution | Per-meteor trajectories, not a shower table |

**Facts versus database** (EU Directive 96/9/EC; text read through an archived EUR-Lex copy):
- **Art. 3:** database copyright covers the "selection or arrangement" and "shall not extend to their contents".
- **Art. 7(1):** the sui generis right protects a maker's "substantial investment" against "extraction and/or re-utilization of the whole or of a substantial part, evaluated qualitatively and/or quantitatively".
- **Art. 7(5):** also forbids "repeated and systematic extraction … of insubstantial parts".
- **CJEU C-203/02** (read only through a secondary summary): the right covers investment in obtaining and verifying existing material, not in creating data.

For about 10 hand-typed rows taken from collections of over 100 established showers, the research worker's read was:
- quantitatively insubstantial;
- a selection that could still be qualitatively significant;
- low-to-moderate residual risk if the rows are:
  - entered by hand as facts;
  - rounded;
  - cross-checked against two or more sources;
  - not copied in layout or text;
  - not refreshed systematically from one source.

The research worker's read is not legal advice, and the decision is the owner's.

**Options** (for the plan's owner question):

- **A. Hand-written fact list, citing sources (recommended default, pending owner confirmation).**
  - Contents: about 10 major showers: Quadrantids, Lyrids, Eta Aquariids, Southern Delta Aquariids, Perseids, Draconids, Orionids, Leonids, Geminids, Ursids.
  - Fields: name, peak solar longitude (J2000), radiant RA and Dec (J2000), speed, approximate ZHR, each rounded.
  - Entered by hand from facts and cross-checked against the IAU MDC (radiants, speed), the IMO Working List (peak λ, ZHR) and NASA's fact boxes. Sources cited in `LICENSE-DATA.md`, not presented as a copy of any table.
  - An optional courtesy email to the MDC (mdc_showers [at] ta3.sk) asking for confirmation lowers the risk further.
  - Facts carry no CC licence, so the file is not share-alike.
- **B. Adapt the Wikipedia table under CC BY-SA 4.0.**
  - Pro: an explicit licence that permits commercial use; the app already ships CC BY-SA data with `LICENSE-DATA.md` (`src/lib/catalogue/LICENSE-DATA.md`).
  - Con: that data file becomes share-alike, and its values are mixed-source.
- **C. Ask the IMO for written permission and use its Working List.** It has the best data and every field, but it needs a reply, and the site is mid-rebuild.

### 5. Integration with Tonight

- **The view.** `buildTonight(input, locale, options)` (`src/lib/tonight/build.ts:624-628`) returns `TonightView` (:412-489).
  - Optional blocks follow the `sessionPlan` precedent: `if (options.withSessionPlan) { try {...} catch (error) { console.error(fixed line + error.name); sessionPlan = null } }` (:1082-1233), with an allowlisted `no-console` disable.
  - Options are threaded through `LoadTonightInput` (`src/lib/tonight/load.ts:35-62`) and `TonightIslandLoad` (`src/lib/tonight/island.ts:9-23`).
  - A `withSkyEvents` option fits the same path.
- **The dashboard.**
  - `TonightContent.astro` loads with `withSkyChecks`, `withSkyView` and `withSessionPlan` (:71-78).
  - It renders `VerdictCard` inside `TonightSkyView` (:124-138), with a static fallback (:139-159).
  - Tiles come from `TonightTiles.astro`: five `Tile`s, each a heading plus a summary line from `m.tonight.summary.*`. A tile with null data is omitted.
  - `TonightSkeleton.astro` draws five tile rows (:28-29, :71-107).
  - `tests/e2e/tonight-dashboard.spec.ts:19-29` lists the five tiles.
- **"Next to the sky verdict."** `VerdictCard.astro` renders, in order:
  - the date (:74);
  - the dark line (:75);
  - the `<h2>` headline with its reason (:76-85);
  - the explanation (:86-92);
  - the forecast status (:93).

  Its height is pinned by `VERDICT_MIN_HEIGHT_CLASS = "min-h-42 sm:min-h-59"` (`src/components/tonight/sky-band.ts:45`). CLAUDE.md requires re-measuring it on the EN go verdict at 360 and 640 px after any verdict change. The phone first screen is pinned by `tests/e2e/tonight-phone.spec.ts`. An events line adds height; that is the main UI risk.
- **A focused page.** `src/pages/tonight/nights.astro` plus `NightsPageContent.astro` is the model for multi-night content:
  - a `GearShell skyFlow` shell with a `server:defer` island;
  - `TonightPageSkeleton` with `rows`;
  - `TonightPageSky`;
  - `OfflineCopy` (:49);
  - content in `max-w-3xl space-y-6 px-4 pt-8`.

  `/tonight` is already gated (`src/lib/protected-routes.ts:9`).
- **Formatting.** `createFormatter(locale)` (`src/lib/tonight/format.ts:178`) gives `formatTime(date, tz)` (:219) and `formatDayTime(date, tz)` (:231), which covers "times in the site's timezone", plus `zoneLabel` (:157).
  - Catalogue rules: EN source, PL parity, plurals through `plural(locale, n, forms)`.
  - Planet names exist as `messages.targets.planet[key]`. Shower names are new keys.
- **The engine module.** A new module re-exported from `src/lib/engine/index.ts` must pass `purity.test.ts`, which bans the following (:24-36):
  - `Date.now` and argument-less `new Date()`;
  - `fetch(`;
  - `console.`;
  - a locale-only `Intl.DateTimeFormat`.

  Constants go in `parameters.ts`, which documents itself as "CANDIDATE" values (:1-8).
- **Multi-night precedent.** `sevenNightOutlook` (`outlook.ts:170-192`) walks nights with `addDays`, so it is DST-safe. `darkWindowReturn` (:90-134) warns that about 150 dark-window computations per request were judged too many, a comment from before the Paid plan. A 30-day events pass needs the twilight or dark spans of about 30 nights, plus the event searches.

### 6. Offline

- **Stored pages.** `TONIGHT_PAGES` (`src/lib/offline/copies.ts:10-17`) is the exact list of stored Tonight pages. `src/sw.ts` is generic over `tonightPageOf` (:536-560), so a new page needs:
  - the list entry;
  - `OfflineCopy` in its island;
  - a title in `src/pages/offline.astro:17-24`;
  - updates to the page-list tests in `src/lib/offline/copies.test.ts` (:64, :71, :392-400).
- **Event data in a copy.** A copy stores rendered HTML, so events computed in the island at render time travel with it. They are deterministic from site and night, and in a copy they are as of when it was stored (up to `EXPIRY_MS` = 36 h, `copies.ts:30`).
- **The `?night=next` copy.** It renders the evening after. The events list starts from the selected night, so that copy shows the window shifted by a night.

### 7. Overlap with finder-chart (S-03): merged into main on 2026-10-13

finder-chart merged as #155, and the EPIPE fix as #156, before planning. This branch was rebased onto `origin/main` 998b30f (2026-10-13). The overlap is no longer a parallel branch: the plan works against main.

What finder-chart changed in files this research relies on, from `git diff --stat 57a2661..origin/main`:
- `src/lib/offline/copies.ts` (+242/−64 across the offline files):
  - a separate `FINDER_PAGE = "/tonight/finder"` path, alongside `StoredPage` and `storedPageOf`;
  - per-copy `target`, `targetName`, `plan` and `planAt` metadata read from the island's `data-*` attributes.

  `TONIGHT_PAGES` (`copies.ts:11-18`) still lists the six Tonight pages, and `mayStoreShell` now checks `storedPageOf`. A `/tonight/events` page still joins `TONIGHT_PAGES`, as §6 says. It is not a finder-style page with a target.
- `src/sw.ts` (+121) and `src/pages/offline.astro` (+43): the finder chart's title placeholder and links. The `titles` map is still where a new page's title goes.
- `src/lib/engine/index.ts` (+21) and `parameters.ts` (+75): finder exports and constants. New event exports and constants are additive next to them.
- `src/lib/tonight/load.ts` (+24), `TonightContent.astro` (+3), `NightsPageContent.astro` (+3): small additions, to re-read when planning.
- `CLAUDE.md` (17 lines changed): new finder paragraphs. A sky-events paragraph is additive.

Before implementation, re-read the exact line anchors in §5 and §6 on main; the files above shifted.

## Code References

- `node_modules/astronomy-engine/astronomy.d.ts:1469,1974,2757,2781,2916,2974,3007` — the event searches
- `src/lib/engine/index.ts` — engine barrel
- `src/lib/engine/purity.test.ts:24-36` — purity rules
- `src/lib/engine/sun.ts:32,52,101` — `sunEvents`, `darkWindow`, `tonightDateFor`
- `src/lib/engine/parameters.ts:1-8,221,229,306` — candidate conventions; planet window −6°; rollover −6°; Moon low 30°
- `src/lib/engine/outlook.ts:90-134,170-192` — multi-night precedents and cost note
- `src/lib/engine/planets.ts:18` — planet keys
- `src/lib/tonight/build.ts:412-489,624-628,1082-1233` — the view, options, the optional-block pattern
- `src/lib/tonight/load.ts:35-62`, `src/lib/tonight/island.ts:9-23` — option threading
- `src/components/tonight/TonightContent.astro:71-78,124-159` — dashboard island
- `src/components/tonight/TonightTiles.astro`, `src/components/ui/Tile.astro`, `src/components/tonight/TonightSkeleton.astro:28-29,71-107` — tiles
- `src/components/tonight/VerdictCard.astro:74-93`, `src/components/tonight/sky-band.ts:35-45` — verdict and its pinned height
- `src/pages/tonight/nights.astro:21,40-45`, `src/components/tonight/NightsPageContent.astro:35,48-81` — focused-page model
- `src/lib/tonight/format.ts:157,178,219,231` — zone label and site-time formatting
- `src/lib/offline/copies.ts:10-17,30,35,120`, `src/sw.ts:536-560`, `src/pages/offline.astro:17-24` — offline copies
- `tests/e2e/tonight-dashboard.spec.ts:19-29`, `tests/e2e/tonight-phone.spec.ts:36-43`, `tests/e2e/seven-night-planner.spec.ts` — e2e models
- `src/lib/catalogue/LICENSE-DATA.md` — the existing data-licence file

## Architecture Insights

- **Events are a projection of site and window**, like the outlook. A pure `skyEvents(site, fromNight, days)` in the engine returns plain data, and Tonight formats it. That keeps it deterministic, unit-testable against reference dates, and safe for offline copies.
- **The event kinds are independent searches with one shared step: the visibility test**, the altitude during a night-part. That shared helper is the core, and each kind is a small module. It suggests splitting the work by kind:
  - first the shared model and the cheap searches (eclipses, elongations, oppositions);
  - then pairings (the only scan);
  - then meteor showers (data and licence).
- **The invariant is enforced in the model, not the view.** An event carries `visible: boolean` (plus why not), and the tile, the verdict line and the "go out" wording read only visible events.

## Historical Context (from prior changes)

- `context/archive/2026-10-04-tonight-nightfall/plan.md:75` and `plan-brief.md:37`: "No opposition wording for planets", "Not modelled; no invented data". Opposition was deliberately left out then. This change models it.
- `context/archive/2026-10-01-moon-as-target/plan.md:100` and `plan-brief.md:64`: lunar eclipses and occultations were out of scope then.
- `context/archive/2026-10-05-tonight-dashboard/`: the tile-and-focused-page composition this change extends.
- The finder-chart change's research (on its own branch) is the source of today's lesson: verify a licence on the primary page, and derived data carries its source's terms. Hipparcos data turned out to be CC BY-NC.

## Related Research

- `context/archive/2026-10-04-tonight-nightfall/research.md:43,117` — opposition not modelled
- `context/archive/2026-10-09-observing-progress/research.md` — the most recent multi-part Tonight change

## Open Questions

Resolved by the owner on 2026-10-13 (relayed by the orchestrator). Recorded in `plan.md` "Owner decisions":

1. **Meteor data source** (OQ 19): **option A.** A hand-written list of facts, cross-checked in two sources and documented in `LICENSE-DATA.md`, without share-alike. The optional IAU MDC email is drafted for the owner in `iau-mdc-request.md`. Not legal advice.
2. **Close-pairing threshold** (OQ 20): **5°** (the binocular field), changed from the 3° candidate. Still topocentric, at the closest moment while both bodies are visible. Expected frequency: §3's simulated cases bracket the chosen rule (at least 10° up, Sun at or below −6°):
   - "5° up, Sun −6°" gives 1.05 Moon-planet events per 30 days;
   - "10° up, Sun −12°" gives 0.67.

   So about 0.7–1.0 Moon-planet events per 30 nights. Planet-planet stays rare: 0.16 per 30 days in the "5° up, Sun −6°" case. Plan Phase 2 re-measures the exact rule.
3. **Minimum altitude for "visible"**: **10°.**
4. **Notable**: every visible event except penumbral lunar eclipses. Those are listed as "barely noticeable", never put on the tile or verdict line. Uranus and Neptune oppositions are left out.
5. **Penumbral lunar eclipses**: listed as "barely noticeable" (see 4).
6. **Uranus and Neptune**: left out (see 4).
7. **Dashboard**: the events tile goes straight after the Targets tile, plus the muted verdict line on event nights. The tiles sit below the verdict and gear cards that `tonight-phone.spec.ts` pins, so only the verdict line's height needs re-checking.
8. **The shower peak instant** (J2000 versus of-date): not an owner question. The plan searches the Sun's J2000 longitude directly and pins it with a test.

**Plan review follow-ups (2026-10-13)**, superseding parts of §2 and §4:

- **Eclipse altitude (F2, owner):** eclipses use their own 2° minimum, labelled "low, needs an open horizon" below 10°. The tests use future eclipses only, computed with astronomy-engine on 2026-10-13 and checked against the NASA/Espenak catalogue:
  - the 2027-08-02 total solar eclipse: total at Cádiz with the Sun about 37° up, partial at Madrid (about 0.86) and at Warsaw (about 0.30);
  - the 2028-12-31 total lunar eclipse;
  - the 2028-07-06 partial lunar eclipse;
  - the 2027-02-20 penumbral lunar eclipse.

  The 2026-08 eclipses named in drafts were already past.
- **The J2000 longitude (F1):** `Ecliptic()` also returns the longitude of date, about 0.374° (about 9 h) off. The J2000 longitude comes from `SphereFromVector(RotateVector(Rotation_EQJ_ECL(), GeoVector(Body.Sun, t, true))).lon`. §2's "gotcha" applies to both `SearchSunLongitude` and `Ecliptic()`.
- **Meteor sourcing (F4):** option A is carried out with no field depending on the IMO:
  - peak night and approximate rate from NASA (public domain);
  - peak λ computed by our engine from NASA's date (a derived fact, **not taken from the IMO**);
  - radiant and speed from the IAU MDC.

  Other sources are read only to cross-check. Whether NASA lists all ten showers (the Southern Delta Aquariids and the Ursids especially) is checked in Phase 3; a shower NASA lacks is dropped.
- **Short nights (F5):** with no dark window, events use the span with the Sun at or below −6°, flagged "short night".
