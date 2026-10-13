# Finder chart (M-3 S-03) Implementation Plan

## Overview

A full-plan user opens a finder chart for any ranked deep-sky object or planet from `/tonight/targets` or `/tonight/planets`: the nearest star they can recognise with the naked eye from their site, above the site's minimum altitude at the object's best time, the hop to the object through stars the finder shows, and the finder's and finding eyepiece's fields drawn to scale, oriented as they face that part of the sky (FR-037, US-05). A free account sees what the chart does and that it needs the full plan, never an error or an empty page, and the server enforces the plan (FR-045). It is the first full-plan feature, so it also brings the first "needs the full plan" state and the first HTTP refusal check (test-plan §6.4).

This plan was written in an unattended run (owner away, 2026-10-11). Nobody could answer questions, so every choice below is either **delegated** (team-owned, decided and recorded) or a **default pending owner confirmation** (product or UI, owner-owned, planned on the recommended default). See "Decisions taken in this run". Revised the same day after `/10x-plan-review` (`reviews/plan-review.md`, F1-F10). Revised 2026-10-13 after the owner's answers: O-1, O-2, O-3, O-5 and O-7 confirmed as planned; O-4 changed (finder charts are stored offline, new Phase 5); O-6 changed (switch the star source now), but research §9 found no source whose licence clearly allows commercial use; after a follow-up on the licence terms the owner chose (A): stay on HYG v4.1, ask ESA for a commercial licence, and fall back to SAO only if ESA refuses, before any payment.

## Current State Analysis

From `context/changes/finder-chart/research.md` (verified anchors there):

- **No chart code.** The live sky's projection is a 180° equirectangular panorama (`src/lib/sky-view/projection.ts:20-27`); nothing projects a 7-30° field around a target.
- **Stars stop at 4.5.** `bright-stars.json` (925 stars, HYG v4.1 pin `c7f7f883…`, `scripts/build-stars.mjs:21-35`) is island-safe and validated for mag ≤ 4.5 (`src/lib/catalogue/stars.ts:26-27,52`). `readStars` drops `mag > 4.5` while streaming, keeps only `id, proper, ra, dec, mag`, and throws on out-of-range RA/Dec (`scripts/build-stars.mjs:135-141`). A finder shows ~7.5-8.
- **Plan guard exists, unused.** `requireFullPlan(locals)` → `{ok:true}` or `{ok:false, reason: "not-configured"|"signed-out"|"needs-full", errorKey}`, checked in that order (`src/lib/account-plan/index.ts:43-61`), memoised per request (l.19). `/tonight/*` is gated by the middleware (`src/lib/protected-routes.ts:5-18`); `/_server-islands/*` is not (`src/lib/tonight/island.ts:37-41`).
- **`TonightView` lacks chart inputs.** Entries carry `bestAt` (epoch ms) and a `bestDirection` string with the ranking's refracted altitude, but no RA/Dec, no numeric alt/az and no true field (`src/lib/tonight/build.ts:110-143,178-215,486-507`). Planets have no finding eyepiece.
- **Reusable:** `pairEyepieces`/`eyepieceOptics` (`src/lib/engine/eyepieces.ts:50-123`; returns `EyepiecePair | NoEyepieceFits | null`; `majorAxisArcmin = null` fits every eyepiece), `skyFrames`' unrefracted rotation (`src/lib/engine/sky-frames.ts:31-41`), `nakedEyeLimitingMagForBortle` (`src/lib/engine/parameters.ts:82-90`), the server-SVG pattern (`src/lib/tonight/altitude-curve.ts:40-79` + `SessionTimeline.astro`), the focused-page pattern (`src/pages/tonight/planets.astro`, `PlanetsPageContent.astro`), the action area (`src/components/tonight/TargetDetails.astro:53-59`), the logging pattern for a caught failure (`src/lib/tonight/build.ts:1227-1231`: fixed line plus `error.name`, allowlisted disable).
- **`TonightPageSky`** takes only `{ title, view }` and hard-codes its back link to `/tonight` (`src/components/tonight/TonightPageSky.astro:17-26`).
- **HTTP checks:** `scripts/smoke.mjs`'s `request()` (l.59-76) reads no bodies, and its steps are a static array whose failures don't stop the run; CI's smoke and e2e steps get no secret key (`.github/workflows/ci.yml:64-75`). Astro 7.3.2 server islands with small props load by GET from `<link rel="preload" as="fetch" href="/_server-islands/<LocalName>?e=…&p=…&s=…">` (HTML-escaped `&amp;`), decrypted with the per-build key with no session binding (`node_modules/astro/dist/runtime/server/render/server-islands.js:26-30,141-154`); the service worker already replays such URLs (`src/lib/offline/copies.ts:161-171`).
- **Colours:** `--star` is decorative and semi-transparent (light `rgb(22 27 43 / 0.16)`, `src/styles/global.css:115`), unfit for chart stars that carry meaning.
- **Licence:** HYG is CC BY-SA 4.0 (declared in `src/lib/catalogue/LICENSE-DATA.md`); its upstream Hipparcos is CC BY-NC 3.0 IGO with "Credit: ESA" (verified at https://www.cosmos.esa.int/web/hipparcos/catalogues). No money is taken in M-3.

## Desired End State

- `/tonight/finder?object=<target key>&from=targets|planets` (plus the page's usual `?site=`/`?telescope=`/`?night=`) renders, for a full-plan user with the object in tonight's ranking: a context line ("Facing SE, 41° up at 22:40", or "Nearly overhead at 23:40"), an **overview panel** from the starting star to the target with the numbered hop, a **finder panel** of the finder's field around the target with stars to the finder's depth, the finder circle, the reflex rings and the finding eyepiece's circle, a short how-to list ("1. Find Mirach … 2. … 3. …"), a note on inverted finders, and the data credits. It is legible at 360 px in red mode.
- A free account gets the same URL as a 200 page explaining what the chart does, a precomputed example chart labelled as an example, and that it needs the full plan. No user data and no star file read is involved.
- The island itself refuses a free or signed-out request (the chart is never built for either), proven over HTTP by replaying the island URL after a downgrade and after sign-out.
- Every `ObjectDetails` (ranked cards and rows) and `PlanetCard` has a "Finder chart" action link beside "Mark observed", for every account.
- A chart a full-plan user opened online is stored on the device with the Tonight copies and opens offline from the same link, marked as a stored copy; it expires 36 h after its site's last refresh, and disappears at the first online refresh after the account loses the full plan. Sign-out, sign-in and another user's commit purge it as they purge the Tonight copies.
- Identical inputs give the identical chart (determinism NFR); the chart never starts from a star below the site's minimum altitude at the best time or fainter than the naked-eye starting limit for the site's Bortle class (PRD invariant), pinned by unit tests; a target near the zenith gets a valid chart.

Verify: `npm test`, `npm run lint`, `npx astro check`, the extended smoke and the new e2e spec in CI; manual look at 360 px in red mode against two published hops.

### Key Discoveries:

- HYG is evenly complete to ~7.5 (half-magnitude counts grow ×1.53 to 7.5, then ×1.30, ×1.07): 25,791 stars ≤ 7.5, 354 KB raw / 122 KB gzip as columnar integers (research §3).
- Nearest starting star from the 171 catalogue objects: median 3.6° / max 9.1° at ≤ 4.5, median 6.1° / max 15.0° at ≤ 3.5, median 9.9° / max 25.7° at ≤ 2.5 (research §5). Bortle 7-9 hops need several steps.
- Stars ≤ 6.5 average 8.3 per 7° field, ~21 in a 5.6° disc (research §5; review F5).
- Near-zenith targets are common: in Madrid on 2026-10-11, 24 of 131 objects clearing 15° peak above 80°; at 52° N 5-7 a season (review F1, computed with astronomy-engine). A zenith-up chart is meaningless there.
- At 52° N over four nights, 80.1 % of object-nights have the nearest ≤ 4.5 start within one 5.6° step; the rest need the 4.5-6.5 stars of the new file (review F5).
- A per-object page cannot join the offline copies without new keying in `copies.ts` and `sw.ts`: pairs are keyed by `(siteId, page, kind)` over the six `TONIGHT_PAGES`, and nothing in the store knows the account plan (`src/lib/offline/copies.ts:10-17,120-125,252-267,382`; research §10).
- No star catalogue complete to 7.5 has a licence that clearly allows commercial use: the modern ones trace back to ESA's Hipparcos/Tycho/Gaia (CC BY-NC 3.0 IGO, commercial use only with ESA's authorisation), the old BSC5/SAO files carry no grant and BSC5's terms forbid altered copies without the authors' permission (research §9).

## What We're NOT Doing

- No finder choice per telescope (roadmap Parked "Choosing your own finder"); one standard finder for every telescope.
- No interactive chart (no pan, zoom, time slider) and no sky atlas (PRD Non-Goals); a static snapshot at the object's best time.
- No chart for the Moon (FR-037 names deep-sky objects and planets) and no chart for washed-out rows (they have no actions today).
- No prefetching of charts the user never opened, no next-night copy of a chart, and no stored copy of a non-chart state (locked, not ranked, no gear, failed); only a chart opened online is stored (D-13).
- No what-to-expect line (FR-038, US-05's third clause): that is S-04 `what-to-expect`, which will add it to this page.
- No change to the live sky, its star file or its import guard; `bright-stars.json` stays byte-identical.
- No upgrade of the HYG pin to v4.2 (minor name changes only; one pin for both star files).
- No payment, plan badge or upsell flow (PRD Non-Goals); no plan shown on Tonight rows.
- No star-source switch in this slice (O-6 (A)): both star files stay on HYG v4.1. The SAO-only fallback, if ESA refuses, is a separate change before any payment.

## Decisions taken in this run

Delegated (team-owned; decided here, change by editing the parameter or the plan):

- **D-1 Server-rendered chart.** The chart is a static SVG built in a `server:defer` island; no star data reaches the browser, no precache or island-guard change. Why: page weight zero, Session plan precedent, engine stays the single source.
- **D-2 Star depth 7.5, same HYG v4.1 pin**, a second output of `npm run stars:build`: `finder-stars.json` (columnar integers: RA and Dec in 0.01°, mag in 0.1; HYG ids; plus a sparse designation table) and `finder-stars.meta.json`, server-only, loaded by a dynamic `import()` from the finder loader only. Why: HYG's even completeness ends near 7.5; 122 KB gzip in the Worker, parsed only on the finder route.
- **D-3 Starting-star limit** (OQ15) as the PRD candidate: 4.5 at Bortle 1-4, 3.5 at 5-6, 2.5 at 7-9 (`startStarMaxMagForBortle`), kept separate from `nakedEyeLimitingMagForBortle`; a test pins that it never exceeds the naked-eye limit for any class. Stars only: a deep-sky object never serves as its own start; a planet at or brighter than the limit does (O-7).
- **D-4 Hop rule** (OQ16, cost per review F4):
  - Hop stars: stars ≤ 6.5 at or above the minimum altitude, within the candidate bound: angular distance to the target ≤ (start's distance to the target + one step). A step is at most 0.8 × the finder field (5.6°, mirroring `FOV_FIT_FRACTION`); at most 8 steps.
  - Cost, compared lexicographically, all additive integers: (number of steps, Σ over intermediate stars of round(mag × 10), Σ over steps of round(step length in 0.01°), then the sequence of star indices along the path compared element by element). Solved exactly one step count at a time (layered search: for k = 1…8, the cheapest path of exactly k steps; the first k with a path wins), so no prefix that could still win is discarded.
  - Start: the nearest qualifying star (angular distance to the target, ties by magnitude then index) that has a path; only the 5 nearest qualifying stars are tried (O-7). If none has a path, the chart shows the nearest one with a direct line, its distance and its direction (`direct`, O-7).
- **D-5 Finder depth on the chart**: `min(7.5, nakedEyeLimitingMagForBortle(bortle) + 5·log10(30 / EYE_PUPIL_REFERENCE_MM))`, i.e. 7.2-7.5.
- **D-6 Projection** (revised per review F1): gnomonic in horizontal coordinates at the best time; stars unrefracted from the `skyFrames` rotation (unrefracted altitude is the lower one, so the minimum-altitude test errs on the safe side). Orientation: "up" is the vertical through each panel's own centre (the user faces that part of the sky). Overhead rule (pending owner, O-2): when either panel's centre is at or above `FINDER_OVERHEAD_ALT_DEG` (80°) or the zenith falls inside either panel, the whole chart switches to north up (toward the visible celestial pole) in both panels, draws a zenith marker, and the context line reads "Nearly overhead" instead of a compass point; one orientation for both panels so they can be compared.
- **D-7 Finding eyepiece**: deep-sky objects use `pairEyepieces(…, majorAxisArcmin)` (narrowed: `pair` → `finding`, `none-fit` → `widest`, `null` → none); planets use `pairEyepieces(…, null)` narrowed to `pair` → `finding`. No eyepieces: no eyepiece circle and a one-line note.
- **D-8 Target key in the query** (`?object=M31`, `?object=jupiter`), validated with `parseTargetParam` and resolved against tonight's ranking (`limit: Infinity`) or solar system for the selected site, telescope and night; an object not in it renders a "not on tonight's list" state with the way back. `?night=next` is carried through the link and the page like the other focused pages.
- **D-9 HTTP refusal check in `scripts/smoke.mjs`**, granting the plan through the operator command (`node scripts/account-plan.mjs <email> full|free` as a child process, local Supabase only), which keeps smoke dependency-free. CI passes the local stack's `SUPABASE_URL` and `SUPABASE_SECRET_KEY` **inline on the `npm run smoke` and `npx playwright test` commands only, never exported**, so `npm run preview` never inherits the key (review F7). Without the key, the finder steps fail under `CI` and locally print `SKIPPED (no SUPABASE_SECRET_KEY): finder plan steps` and make the run exit non-zero only under `CI`. This relaxes the CLAUDE.md rule that the key exists only for `account:plan` and `test:db`, for the local stack only; **the PR description must call it out** for the owner.
- **D-10 Credit ESA** for Hipparcos beside HYG in `Attribution.astro` ("Hipparcos, Credit: ESA (CC BY-NC 3.0 IGO)", linking https://www.cosmos.esa.int/web/hipparcos/catalogues) and in `LICENSE-DATA.md` (an "Upstream: Hipparcos (ESA)" paragraph: CC BY-NC 3.0 IGO with its link and "Credit: ESA"; commercial use needs ESA's authorisation, the owner's request is pending; the CC BY-SA 4.0 grant cannot lift the upstream non-commercial condition; review F13); every view that draws stars (the chart, the free example, `/design`) renders `Attribution`.
- **D-11 Calibration without an observer** (roadmap OQ1, revised per review F5): a committed reference of classic published hops with their sources, each with a fixed Bortle band chosen so its limit admits the published start star and makes it the nearest qualifying start (M31 from Mirach via μ/ν And; M13 between η and ζ Her; M57 between β and γ Lyr; M81/M82 from Dubhe; M27 from γ Sge; M92 from π/η Her). The band is picked once in Phase 2 from the computed nearest starts per band and written into the fixture with the reason; review F5 shows the naive choice fails (M81 at ≤ 4.5 starts from 23 UMa, M92 from ι Her, M13 at ≤ 2.5 from Alphecca). A reference that no band reconciles is listed in the fixture as a known divergence with its computed route, never forced. The test asserts the chosen start lies in each route's star set and the path reaches the target with every step ≤ 5.6°. A reference failure is an engine finding, never a fixture edit. Coverage over all 171 objects is measured on the first Phase 2 run and its gate set 3 percentage points below the measured value (noted on Progress row 2.4).
- **D-12 Failures are logged** (review F3): `loadFinderFor` catches a failed star load or engine error, logs a fixed line plus `error.name` only (never the message, which could carry coordinates), and renders the `failed` state. Two allowlisted disables.
- **D-13 What is stored offline** (from O-4, 2026-10-13): a finder copy is the chart page the user opened online, stored as a pair like the Tonight pages, keyed by `(siteId, page, target, kind)`; `kind` follows the page's `?night=` as on the Tonight pages. Only the chart state stores (its island renders `[data-offline-copy]`); locked, not-ranked, no-gear and failed never do. No next-night copy of a chart (each would cost a second chart build for a night the user did not ask about) and no prefetching of charts never opened. No count cap: the 36 h per-site expiry bounds the store, and a chart's HTML is ~25 KB. Why: the existing rules, with the target added to the key; the least new behaviour.
- **D-14 How a lost plan clears the charts** (from O-4): every Tonight island's `[data-offline-copy]` gains `data-plan="full|free|unknown"` from `accountPlanForCopy(locals)` (the memoised plan read, three-valued: `unknown` when the `account_plans` read fails, which is logged; access stays fail-closed because `requireFullPlan` still treats a failed read as free; review F11); the locked finder shell and the locked island state carry the same `data-plan` on their `data-finder-state="locked"` root. The worker drops every finder pair (`dropFinderCopies`) only on an explicit `free`: when (a) it commits any pair whose island says `free`, (b) a finder navigation's network answer is the locked page with `data-plan="free"`, or (c) a finder island answers locked with `data-plan="free"`; `unknown` neither drops nor commits a chart. The index records `freeSince` (the `preparedAt` of the newest `free` island it saw), and a finder pair whose island was prepared at or before it is refused, so a `full` render that lands after a demotion's drop cannot restore a chart (review F12). Each Tonight page opened online commits a pair, so "the first online refresh" is the first Tonight or finder page the user opens online after the change. Why: deterministic, worker-side, no new page script, no plan read on non-Tonight pages.
- **D-15 Offline links** (from O-4): the Finder chart link carries no `data-needs-network`; offline, a stored chart opens from the device and one never stored lands on `/offline`, which lists the stored charts ("Finder chart · M31", site) below the Tonight pages.

Owner decisions (planned as defaults on 2026-10-11, answered by the owner on 2026-10-13):

- **O-1 Finder** (OQ13), **confirmed**: a 6×30 finder, 7° field, for every telescope, plus a 1× reflex finder's 0.5°, 2° and 4° rings, both drawn on the finder panel around the target.
- **O-2 Orientation**, **confirmed**: the naked-eye view as the user faces that part of the sky ("up" = the vertical through the panel's centre), with one note line that a straight-through finder shows it upside down and a right-angle finder mirror-reversed; no flip control. When the target is nearly overhead (a panel centre ≥ 80° or the zenith inside a panel), north up with a zenith marker and "Nearly overhead" (D-6).
- **O-3 Two panels**, **confirmed**: an overview (start → target) and a finder panel (10° field around the target), stacked on a phone.
- **O-4 Offline**, **changed by the owner**: finder charts are stored offline alongside the Tonight copies. This settles PRD OQ23 for this slice: a stored chart disappears at the first online refresh after the account loses the full plan, charts expire after 36 h like the other copies, and the owner and sign-out purges stay. Planned as Phase 5 (D-13 to D-15).
- **O-5 Free account**, **confirmed**: the same "Finder chart" link on every row; the page explains the chart with a fixed example (M13 from a fixed public site and date, precomputed, labelled "Example") and says it needs the full plan, without a way to get it (no payments).
- **O-6 Star source**, **resolved by the owner (2026-10-13): option (A)**. Both star files (`bright-stars.json` and `finder-stars.json`) stay on the pinned HYG v4.1; Phase 1 is unchanged and there is no source-switch phase. The owner emails ESA (data.licences@esa.int) for a commercial licence; the request is drafted in `esa-licence-request.md`. If ESA refuses, the fallback is **SAO only** for both files, switched in its own change before any payment; SAO's status must be confirmed before switching (NASA NTRS marks the 1966 reports and the ADC documentation "public use permitted", but there is no formal licence for the I/131A file). Licence findings behind the choice (research §9, §9.1):
  - Hipparcos, Tycho-2 and Gaia DR3 are ESA CC BY-NC 3.0 IGO; ESA's terms ask for "a detailed request for authorisation/licence" by email before any use that "directly or indirectly generates a financial gain"; no form, fee or response time is documented. Every compilation (HYG, AT-HYG, SKY2000, UCAC4, d3-celestial, Stellarium) inherits these terms.
  - Yale BSC5 carries no licence at CDS; Debian treats it as copyrighted (Hoffleit & Warren 1991) and, from a 2001 exchange with NASA's ADC, holds that "the data files must NOT be altered in any way (without permission of the original authors)". Ruled out.
  - The SAO catalogue's four 1966 volumes (NASA grant NSG-87-60) and the ADC's machine-readable documentation (1984, 1989) are marked "Work of the US Gov. Public Use Permitted" in NASA NTRS; no restriction on altered copies was found. SAO covers 100 % of HYG's stars to 4.5 and 99.6 % to 7.5 (median |ΔV| 0.12-0.13), but has no Bayer or Flamsteed designations, so the fallback must name stars another way.
  - Effect on this plan: D-10's "Credit: ESA" stays and matters now (the ESA terms require the credit line); Phase 6 adds the ESA request and the SAO fallback to the PRD OQ21 note.
- **O-7 Departures from FR-037's wording** (review F8), **confirmed**: (a) when the nearest qualifying star has no hop, the start is one of the 5 nearest that has one; (b) when none of them has one, a direct line from the nearest with distance and direction instead of hops; (c) a planet at least as bright as the starting limit is its own starting point (no hop); (d) when no star qualifies (none bright enough above the minimum altitude), a message instead of a chart. All keep the PRD invariant.

## Implementation Approach

Data first, then the pure engine, then rendering (including the free explainer and its precomputed example), then the route and its gate, then offline storage of the chart, then the HTTP proof. The engine function takes the star list as input (not an import), so tests use synthetic skies and the purity rules hold. The island loads Tonight as the other focused pages do, finds the entry, then builds the chart; the shell and the island each call `requireFullPlan`. Rendering is a pure geometry module plus Astro components with token classes only.

## Critical Implementation Details

- **Island guard order.** The island must call `requireFullPlan` before it loads the star file or calls the engine: the shell's check does not protect `/_server-islands/*`, and the free and signed-out branches must not even build the chart. The free page's example is a committed fixture, never computed per view and never from the user's site or gear.
- **Marker placement.** `data-finder-chart` sits only on the chart-state root in `FinderContent`, never inside `FinderChart` (the free example renders `FinderChart` too). `data-finder-state` is on every state root.
- **Coordinates.** The chart's projected positions encode the site's latitude and the time roughly, like the live sky's rotation matrices (interactive-sky decision, `context/archive/2026-10-05-interactive-sky/plan.md:110`); they stay in the HTML, never in a URL, a `data-*` attribute meant for scripts, or a log. Round SVG coordinates to 0.1 unit.
- **Shared local Supabase.** Another branch (observing-milestones) adds an `observing_milestones` table to the shared local stack. Never run `npm run db:types` before that branch merges, never reset or reseed the stack. If `tests/db/structure.test.ts` fails locally only because `observing_milestones` is unclassified, that is the other branch's table: ignore it and note it in that phase's gate result.
- **Stored charts follow the plan.** A finder pair commits only from a chart-state island (`data-plan="full"` and a target matching its shell). An explicit `free` (any island, or a locked finder answer) drops every finder pair in the same serialised index step (`serial` in `src/sw.ts:68-72`) and sets the index's `freeSince` to that island's `preparedAt`. A finder island prepared at or before `freeSince` is refused, and a newer `full` island clears `freeSince`, so a `full` render that reaches the worker after a demotion's drop (two tabs, or the worker's late path, `src/sw.ts:491`) does not restore a chart. Both times are server times, so their order is the render order. What is guaranteed: no chart rendered before the device last saw `free` survives; a chart is gone at the latest when the device's first online Tonight or finder answer after the demotion arrives. **Accepted (review F12):** on a network slower than `NETWORK_TIMEOUT_MS` (4 s, `src/sw.ts:47`), a demoted user who opens a stored chart's URL is first served the stored chart; the late locked answer drops it a moment later. That is inherent to network-first with a timeout. A failed plan read (`unknown`) neither drops nor stores charts (review F11). The index holds target keys and display names, never coordinates; the stored HTML holds the chart's projected positions, as the Tonight copies hold the live sky's.
- **Smoke ordering and shared state.** The captured island URL lives in a shared variable; it is read from the full account's shell (`<link rel="preload" as="fetch" href="/_server-islands/FinderContent…">`) with `&amp;` decoded (mirror `islandUrlFromShell` in `src/lib/offline/copies.ts`). A missing capture fails every step that needs it, loudly. Replays run after the demotion and again after sign-out. If Astro ever switches to POST for these props, the capture fails, never skips.

## Phase 1: Finder star data

### Overview

A second, deeper star file from the same pinned HYG source, server-only, with its loader, tests, licence entry and credit.

### Changes Required:

#### 1. Star build

**File**: `scripts/build-stars.mjs`

**Intent**: Refactor `readStars` to keep every star to 7.5 with `bayer`, `flam`, `con` and `proper`, then filter per output: the unchanged bright-star output (≤ 4.5, same fields, same guards, byte-identical result) and the new finder output, both from one streamed CSV in one run.

**Contract**: Finder filter: not Sol, `mag ≤ 7.5`; out-of-range RA/Dec still throws (as today, l.140-141). Sort by mag then HYG id. Output `{ ra: number[], dec: number[], mag: number[], id: number[], designations: Record<index, { bayer?: string, flamsteed?: number, con: string, proper?: string }> }` with RA/Dec as integers in 0.01°, mag as integers in 0.1. Own `EXPECTED_COUNT` 25,791 ± 50 hard guard. Meta like `bright-stars.meta.json` (source, url, commit, licence, attribution incl. "Credit: ESA", filter, count, designatedCount). Deterministic, no clock.

#### 2. Loader

**File**: `src/lib/catalogue/finder-stars.ts` (new)

**Intent**: Server-only lazy loader that returns the stars as J2000 unit vectors with magnitudes and display designations, validated once per isolate.

**Contract**: `loadFinderStars(): Promise<readonly FinderStar[]>` with `FinderStar = { index: number; id: number; mag: number; vector: readonly [number, number, number]; designation: StarDesignation | null }`; memoised promise reset on failure (as `src/lib/gear/catalogue/load.ts`); validates count range, mag ≤ 7.5, unique ids; `import("./finder-stars.json")`. Never imported by `stars.ts`, `./index` or any island. `formatDesignation(designation, locale)` → "β And" / "Mirach (β And)" using Greek letters for HYG's Bayer abbreviations and `starName` for the 41 localised names.

#### 3. Tests

**File**: `src/lib/catalogue/finder-stars.test.ts` (new)

**Intent**: Pin shape and provenance like `stars.test.ts`, and that the file stays out of browser code.

**Contract**: count within range; mag ≤ 7.5; sorted; meta commit equals the bright-star pin; licence "CC BY-SA 4.0"; every star in `BRIGHT_STARS` appears with the same HYG id; designation formatting cases (Bayer with superscript index, Flamsteed, proper, Polish name); a source scan that no file under `src/components/**/*.tsx` or `src/lib/sky-view/**` imports `finder-stars`.

#### 4. Licence, credit, tripwire

**Files**: `src/lib/catalogue/LICENSE-DATA.md`, `src/components/tonight/Attribution.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`, `.prettierignore`, `CLAUDE.md`

**Intent**: Declare the new Adapted Material, credit ESA (Hipparcos) beside HYG, keep Prettier off the generated files, and add the tripwire.

**Contract**: LICENSE-DATA HYG section lists `finder-stars*.json` and its filter and gains the D-10 "Upstream: Hipparcos (ESA)" paragraph (CC BY-NC 3.0 IGO, https://creativecommons.org/licenses/by-nc/3.0/igo/, "Credit: ESA", ESA authorisation pending, the BY-SA grant cannot lift the NC condition); Attribution adds "Hipparcos, Credit: ESA (CC BY-NC 3.0 IGO)" linking https://www.cosmos.esa.int/web/hipparcos/catalogues, via new keys in both languages; `.prettierignore` gains both files; CLAUDE.md tripwire "Never edit `finder-stars.json` / `finder-stars.meta.json` by hand" and a Catalogue sentence.

### Success Criteria:

#### Automated Verification:

- `npm run stars:build` (needs the network: it downloads the pinned CSV) writes both star files and leaves `bright-stars*.json` byte-identical (`git diff --exit-code src/lib/catalogue/bright-stars.json src/lib/catalogue/bright-stars.meta.json`)
- `npx vitest run src/lib/catalogue` passes, including `finder-stars.test.ts`
- `npm run lint` and `npx astro check` pass
- `gzip -c src/lib/catalogue/finder-stars.json | wc -c` is under 160,000 bytes

Every npm/npx line runs behind `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null &&`.

#### Manual Verification:

- Spot-check five stars (Mirach, μ And, η Her, Sulafat, a mag-7 star) against the HYG CSV row

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Engine: starting star, hop and projection

### Overview

Pure, deterministic finder maths in the engine, test-first: parameters, the planet's J2000 direction, the finding eyepiece, the start choice, the hop search, the gnomonic horizon projection with the overhead rule.

### Changes Required:

#### 1. Parameters

**File**: `src/lib/engine/parameters.ts`

**Intent**: Every new number as a documented candidate (S-03 planning, 2026-10-11).

**Contract**: `FINDER_FIELD_DEG = 7`, `FINDER_APERTURE_MM = 30`, `REFLEX_RING_DEG = [0.5, 2, 4]`, `FINDER_CHART_MAX_MAG = 7.5`, `startStarMaxMagForBortle(bortle)` (4.5 / 3.5 / 2.5), `finderLimitingMagForBortle(bortle)` (D-5), `HOP_STAR_MAX_MAG = 6.5`, `HOP_MAX_STEP_FRACTION = 0.8`, `HOP_MAX_STEPS = 8`, `START_STAR_CANDIDATES = 5`, `FINDER_PANEL_FIELD_DEG = 10` (finder panel width), `FINDER_OVERHEAD_ALT_DEG = 80` (D-6).

#### 2. Finder chart builder

**File**: `src/lib/engine/finder.ts` (new), exported through `src/lib/engine/index.ts`

**Intent**: From the site, time, target direction, limits and a star list, choose the start, find the hop (D-4 cost, layered exact search, candidate bound) and project both panels with the D-6 orientation; return plain data.

**Contract**:
```ts
type UnitVector = readonly [number, number, number]; // as src/lib/catalogue/stars.ts:20
finderChart(input: {
  site: Site; time: Date; bortle: number; minAltitudeDeg: number;
  target: { vector: UnitVector; magnitude: number | null; isPlanet: boolean; majorAxisArcmin: number | null };
  stars: readonly FinderStarInput[]; // { index, mag, vector }
  eyepieceFieldDeg: number | null;
}): FinderChartData
// kind: "hop" | "direct" | "naked-eye" | "no-start"
// start: { index, mag, altDeg, azDeg, distanceDeg } | null; hops: { index, stepDeg }[]
// orientation: "facing" | "overhead"; facing: { azDeg, altDeg } of the target (unrefracted; the page shows the
//   ranking's refracted bestDirection); overview/finder panels: { fieldDeg, stars: { index, x, y, mag }[],
//   path: {x,y}[], target: {x,y}, zenith: {x,y} | null, circles: { kind: "finder"|"reflex"|"eyepiece", r }[] }
//   in degrees on the tangent plane
```
`no-start` when no star at or above the minimum altitude meets the starting limit. Vectors go through one `Rotation_EQJ_HOR` at `time` (the `skyFrames` rotation); a pure `projectGnomonic(centre, point, up)` lives here too, `up` being the local vertical (facing) or the direction to the visible celestial pole (overhead).

#### 3. Planet direction and finding eyepiece

**Files**: `src/lib/engine/planets.ts`, `src/lib/engine/eyepieces.ts`

**Intent**: A J2000 unit vector for a planet at a time (astronomy-engine `Equator(body, time, observer, false, true)`), and a `findingEyepiece(telescope, eyepieces, majorAxisArcmin)` helper returning the eyepiece and its true field per D-7.

**Contract**: `planetJ2000Vector(key, site, time): readonly [number, number, number]`; `findingEyepiece(...) : { eyepiece: E; trueFovDeg: number } | null`, narrowing `pairEyepieces`' three results.

#### 4. Tests and reference

**Files**: `src/lib/engine/finder.test.ts`, `src/lib/engine/fixtures/finder-reference.ts` (new)

**Intent**: Pin the invariants, determinism, the hop cost, orientation and the published hops.

**Contract**:
- Synthetic skies: zero intermediate hops; multi-step; each cost tie-break level (steps, then Σ mag, then Σ length, then index sequence), including the review's counterexample where a faint-but-short prefix must survive; the candidate bound; `direct` and `no-start`; a start below the minimum altitude is never chosen; a start fainter than the limit is never chosen; a bright planet gives `naked-eye`.
- `startStarMaxMagForBortle(b) ≤ nakedEyeLimitingMagForBortle(b)` for b = 1…9; identical inputs → deep-equal output.
- Orientation: the target projects to its panel's centre; for a `facing` panel whose centre is at least 10° from the zenith, of two stars on the panel's vertical (`x = 0`) the higher in altitude has the smaller `y`. A synthetic target exactly at the zenith gives finite, deterministic output with `orientation: "overhead"` and a zenith marker; centres at 79.9° and 80.0° fall either side of the rule.
- D-11 reference hops on fixed nights at 52° N, each at its fixed Bortle band (start ∈ route stars, path ends at the target, every step ≤ 5.6°).
- Coverage over the 171 objects at Bortle 3, 5, 8 on four fixed nights: every object above the minimum altitude at its computed best time gets one of the four kinds without throwing; at Bortle 3, the share of `hop` is at least the gate set from the first measured run (D-11, Progress 2.4).
- The real star file is read in the reference and coverage tests through the JSON import (test-only; `purity.test.ts` skips tests and fixtures).

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/engine` passes, including `finder.test.ts` and `purity.test.ts`
- `npm run lint` and `npx astro check` pass
- The coverage gate is set from the first measured run, 3 points below it, and the measured value is written on this Progress row

#### Manual Verification:

- Read the reference test output for M31, M13 and M57: start star and steps look like the published routes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Chart rendering and the free explainer

### Overview

Turn `FinderChartData` into two legible SVG panels and a how-to list, with chart tokens; build the free explainer with its precomputed example; specimens on `/design`.

### Changes Required:

#### 1. Geometry

**File**: `src/lib/finder/chart-svg.ts` (new)

**Intent**: Pure mapping from tangent-plane degrees to a square viewBox, star radius by magnitude (brightest ~3.2 units down to 0.5 at the panel's depth), label placement for the start and hop stars (reuse `placeLabels` ideas from `src/lib/sky-view/labels.ts` only if it fits without importing browser code), rounding to 0.1.

**Contract**: `panelSvg(panel, { size }) → { viewBox, stars: {cx, cy, r}[], path: string, circles: {cx, cy, r, kind}[], zenith: {cx, cy} | null, labels: {x, y, text, anchor}[] }`.

#### 2. Tokens

**File**: `src/styles/global.css` (+ `src/styles/contrast.test.ts`, red theme test)

**Intent**: Chart stars and lines carry meaning, so they get their own opaque tokens instead of the decorative `--star`.

**Contract**: `--chart-star` (and `--chart-line` if `--heading` does not reach 3:1 on the chart ground) in every theme block, red with zero G and B, each with a contrast row on the content ground (3:1 for graphics).

#### 3. Components

**Files**: `src/components/finder/FinderChart.astro`, `FinderPanel.astro`, `FinderSteps.astro`, `FinderLocked.astro` (new)

**Intent**: `FinderChart`: the context line (facing: "Facing SE, 41° up at 22:40" from the entry's refracted `bestDirection` and `bestTime`; overhead: "Nearly overhead at 23:40"), the overview and finder panels (each an `<svg role="img">` with an `aria-label` that states the hop in words; zenith marker in the overhead variant), the numbered steps ("Find Mirach (β And) … then move 4° toward …"), the inverted-finder note, the eyepiece line ("Eyepiece circle: 25 mm Plössl, 1.7°"), the `direct` / `naked-eye` / `no-start` variants, and `Attribution`. `FinderLocked`: three lines on what the chart does, the example chart labelled "Example", the "needs the full plan" line, `Attribution`.

**Contract**: `FinderChart` props `{ chart: FinderChartData, labels: …, locale }`, no `data-finder-chart` inside it. Stars `fill-chart-star`, path and finder circle `stroke-heading` (or `stroke-chart-line`), reflex rings dashed, eyepiece circle `stroke-primary-strong`, target marker `stroke-primary-strong`; in red mode the circles differ by stroke style and width, not colour; no hex, no arbitrary values; panels `w-full max-w-md`, stacked below `md`.

#### 4. Precomputed example

**Files**: `src/lib/finder/example-chart.ts` (+ `example-chart.test.ts`) (new)

**Intent**: The free explainer's example as committed `FinderChartData` (M13 from a fixed public site and date, fixed Bortle, a fixed 25 mm Plössl on a 150/750 telescope), so a free view reads no star file and runs no engine.

**Contract**: the test asserts the fixture deep-equals `finderChart(fixed inputs, real stars)`; the inputs are constants in the test; regenerating the fixture is the documented fix when the engine changes.

#### 5. Copy

**Files**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Every string under `tonight.finder.*` (title, context lines, steps, notes, variants, locked state, example label, link text) in both languages; designations (Greek letter + IAU abbreviation) stay untranslated like compass points.

**Contract**: parity test passes; parameterised messages take pre-formatted numbers.

#### 6. Specimens

**File**: `src/pages/design.astro`

**Intent**: A "FinderChart" section with real components on fixed sample data: hop (facing), overhead, direct, naked-eye planet, no-start, no eyepieces, locked (`FinderLocked` with the example), loading (skeleton); hover/focus/disabled marked N/A where they do not apply; `Attribution` under the section.

**Contract**: one `<section aria-labelledby="c-finder-chart">` in the existing 7-state layout.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/finder src/i18n src/styles` passes (geometry tests, example fixture deep-equality, i18n parity, no-hardcoded-colours, red theme, contrast)
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- `/design` FinderChart specimens read at 360 px in dark, light and red; the finder circle, reflex rings and eyepiece circle are distinguishable in red by stroke style alone
- The M31 specimen matches a published M31 chart's star pattern, mirrored correctly (zenith up: the specimen uses a 52° N site at a time M31 is below 80°, so the facing orientation applies)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: The finder page behind the full plan

### Overview

The route, its shell and island, the two-layer plan check, the logged failure path, and the links from Tonight's rows.

### Changes Required:

#### 1. Loader

**File**: `src/lib/finder/load.ts` (new)

**Intent**: For an island request: guard the plan, load Tonight for the site, telescope and night, find the target in the ranking (deep-sky) or the solar system (planet), compute the finding eyepiece, load the stars, call `finderChart`, format labels. Server-only. A failed star load or engine error is logged (D-12) and becomes `failed`.

**Contract**: `loadFinderFor(locals, { target, siteId, telescopeId, night }): Promise<FinderLoad>` with `FinderLoad = { kind: "locked" } | { kind: "not-configured" } | { kind: "no-gear" | "not-ranked" | "failed", view: TonightView | null } | { kind: "chart", view, chart, labels }`; calls `requireFullPlan(locals)` first and returns `locked` (needs-full or signed-out) or `not-configured` before any other read; uses `loadTonightFor(locals, { siteId, telescopeId, night, limit: Infinity })`. Logs `"loadFinderFor: the star load failed"` / `"loadFinderFor: the chart failed"` with `error.name` only, each behind `// eslint-disable-next-line no-console -- <reason>`.

#### 2. Page and island

**Files**: `src/pages/tonight/finder.astro`, `src/components/finder/FinderContent.astro` (new), `src/components/tonight/TonightPageSky.astro`

**Intent**: The shell parses `?object=` (`parseTargetParam`; unknown → a 200 "not on tonight's list" state, never a crash), `?from=` (`targets` | `planets`, else Tonight), `requestedGear` and `requestedNight`; never redirects (the worker treats a redirect on a stored page as the sign-in bounce, `src/sw.ts:535`); calls `requireFullPlan(Astro.locals)`: `needs-full` → `FinderLocked` (no island), `not-configured` → `DatabaseMissing`, `ok` → the `FinderContent` island with `TonightPageSkeleton`. The island renders `TonightPageSky` (title "Finder chart · M31", back link to the `from` page), then by `FinderLoad.kind`: chart, locked (`FinderLocked`), not-ranked, no-gear, failed. Attribution below.

**Contract**: every state root carries `data-finder-state="chart|locked|not-ranked|no-gear|failed"`; only `FinderContent`'s chart-state root carries `data-finder-chart`. `TonightPageSky` gains optional `backHref` and `backLabel` (default `/tonight` and the Tonight label). Offline storage of the page arrives in Phase 5.

#### 3. Links

**Files**: `src/components/tonight/TargetDetails.astro`, `ObjectDetails.astro`, `PlanetCard.astro`, `SolarSystemSection.astro`, `TargetsPageContent.astro`, `PlanetsPageContent.astro`, `src/lib/tonight/load.ts`

**Intent**: An optional `finderHref` on `TargetDetails` renders a second action link ("Finder chart", lucide `Crosshair`, `buttonVariants({variant:"action", size:"sm"})`, no `data-needs-network` (D-15), accessible name with the target) beside "Mark observed"; ObjectDetails and PlanetCard pass it; a `finderHref(view, target, from, night)` helper next to `logHref` builds `/tonight/finder?object=…&site=…&telescope=…&from=…` plus `&night=next` when the page shows the next night (ids only).

**Contract**: The Moon card passes none. The two links wrap at 320 px without sideways scroll.

#### 4. Lint and bundle guards

**Files**: `src/lib/no-console-guard.test.ts`, `scripts/build-sw.mjs`

**Intent**: Allowlist the two D-12 logs, and fail the build if the star file ever reaches the browser.

**Contract**: `ALLOWED_DISABLES` gains `src/lib/finder/load.ts` with count 2; `build-sw.mjs` fails when any `dist/client` file contains `finder-stars` or the meta's unique source string, like its map/leaflet leak check.

#### 5. Loader tests

**File**: `src/lib/finder/load.test.ts` (new)

**Intent**: Prove the island-side refusal and the failure path without the Worker runtime.

**Contract**: `vi.mock("@/lib/tonight/island", …)` (it imports `astro:env/server` and `cloudflare:workers`) and a stubbed star loader; a free account (stubbed `account_plans` read) and a signed-out request return `locked` without calling the Tonight load or the star loader; `not-configured` never builds a chart; a deep-sky object vs a planet gets the right finding eyepiece; an object missing from the ranking gives `not-ranked`; a throwing star loader gives `failed`.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including `src/lib/finder/load.test.ts` (free and signed-out return `locked` without the Tonight load or star loader; failures logged and rendered as `failed`)
- `npm run lint`, `npx astro check` and `npm run build` pass
- `tonight-phone` and `tonight-targets` stay green: with local Supabase running, the forecast fixture (`node tests/e2e/forecast-fixture.mjs &`), `.dev.vars` pointing at both, `npm run build` and `npm run preview -- --port 4331 &`, run `SUPABASE_URL=<local API_URL> SUPABASE_KEY=<local ANON_KEY> BASE_URL=http://localhost:4331 npx playwright test tonight-phone tonight-targets`
- Bundle budget: `! grep -rl finder-stars dist/client` succeeds and the `dist/server` JS total (`find dist/server -name '*.mjs' -exec cat {} + | wc -c`) is at most 4,290,555 bytes (baseline 3,790,555 + 500 KB)

#### Manual Verification:

- As a full account on `npm run preview` (port 4331) with local Supabase: open the chart from a ranked object and from a planet; back link returns to the right page
- As a free account: the same link shows the explainer with the example, no error styling
- The two action links wrap at 320 px without sideways scroll in dark, light and red

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Offline finder charts

### Overview

Store a chart opened online as a pair with the Tonight copies, serve it offline from the same link, list it on `/offline`, and drop every stored chart at the first online refresh after the plan is lost (O-4, D-13 to D-15). Every rule is a pure function in `copies.ts`, unit-tested; `sw.ts` only wires them, as today.

### Changes Required:

#### 1. Copy rules

**Files**: `src/lib/offline/copies.ts`, `src/lib/offline/copies.test.ts`

**Intent**: Add the finder page with its target to the keying, the serving choice, the listing and the index check; add the plan to the island metadata and the drop rule.

**Contract**:
- `FINDER_PAGE = "/tonight/finder"`, `StoredPage = TonightPage | typeof FINDER_PAGE`. `storedPageOf(url) → { page: StoredPage; siteId: string | undefined; target: string | null } | undefined`: the six pages with `target: null`, the finder page only with an `?object=` that `parseTargetParam` accepts, returning its canonical key (`?object=31` → `M31`, so a link with a bare Messier number finds the copy stored under the island's `M31`; review F14b); anything else → `undefined`, so it is neither served from nor stored. `tonightPageOf` keeps its six-page meaning; `mayStoreShell` and the worker use `storedPageOf`.
- `IslandCopy` gains `target: string | null`, `targetName: string | null` and `plan: "full" | "free" | "unknown"`, read from `data-target`, `data-target-name`, `data-plan`; a missing or unrecognised `data-plan` reads as `"unknown"` (never as `free`, so it never drops charts; review F11).
- `copyMetaFor(shellPage, shellUrl, islandHtml) → IslandCopy | undefined` (review F14a): the pairing check in one pure function. It refuses a finder shell whose island has no target or a plan other than `full`, a Tonight shell whose island has a target, and a target that differs from the shell URL's canonical `?object=`. The worker calls it instead of `copyMetaFromIsland` when committing.
- `CopyIndex` gains `freeSince: string | null` (review F12; parsed as `null` from an older index). `commitPair` refuses a finder pair whose `preparedAt` ≤ `freeSince`; a `full` island prepared after `freeSince` clears it; a `free` island sets it (and the drop below runs).
- `CopyMeta.page: StoredPage`; `commitPair` replaces the pair with the same `(siteId, page, target, kind)`; `chooseCopy(index, page, siteId, now, target = null)`; `needsNextCopy` is `false` for `FINDER_PAGE`; `listCopies` adds one entry per site and target after the six pages, ordered by `targetName`, with `target` and `targetName` on `ListedCopy`; `isCopyMeta` accepts `FINDER_PAGE` only with a string `target`, and a stored copy without `target` (an index written before this change) parses as `target: null`.
- `dropFinderCopies(index) → IndexChange`: removes every `FINDER_PAGE` pair and returns its shell and island keys and the assets no remaining pair references (`changeRemoving`); unchanged index when there is none.
- `lockedFinderPlan(html) → "free" | "unknown" | undefined` (replaces a boolean check): the `data-plan` of an element carrying `data-finder-state="locked"`, `undefined` when there is none; only `"free"` drops (review F11).
- Tests: `storedPageOf` for each page, the finder with a valid, missing and malformed `?object=`; `copyMetaFromIsland` with and without plan and target; `commitPair` keeps M31 and M13 side by side and replaces M31's older pair; `chooseCopy` by target (prepared, stale); `needsNextCopy` false for a chart; `listCopies` order; `dropFinderCopies` removes only finder pairs and keeps an asset a Tonight pair still references; `parseIndex` on an old index (no `target`, no `freeSince`); `lockedFinderPlan`; `unknown` neither drops nor commits a chart (F11); a stale `full` finder commit after `freeSince` is refused and a newer `full` re-upgrade clears it (F12); `copyMetaFor` refuses the three mismatches (F14a); `storedPageOf("?object=31")` gives `M31` (F14b).

#### 2. Island metadata

**Files**: `src/lib/account-plan/index.ts` (+ `account-plan.test.ts`), `src/lib/no-console-guard.test.ts`, `src/components/tonight/OfflineCopy.astro`, the six Tonight island contents (`TonightContent`, `TargetsPageContent`, `PlanPageContent`, `MoonPageContent`, `PlanetsPageContent`, `NightsPageContent`), `src/components/finder/FinderContent.astro`, `src/components/finder/FinderLocked.astro`, `src/pages/tonight/finder.astro`

**Intent**: Every stored island says which plan it was rendered for; a chart says which target it is.

**Contract**: `src/lib/account-plan/index.ts` gains `accountPlanForCopy(locals): Promise<"full" | "free" | "unknown">` on the same memoised read (one query per request): the memo holds the three-valued state, `getAccountPlan` maps `unknown` to `free` (access unchanged, fail-closed), and a failed read is logged once with a fixed line plus the error code only (`"getAccountPlan: the plan read failed"`, the `build.ts:1227-1231` pattern, one allowlisted disable: `ALLOWED_DISABLES` gains `src/lib/account-plan/index.ts` with count 1); `account-plan.test.ts` adds: a read error gives `unknown`, logs, and `requireFullPlan` still answers `needs-full` (review F11). The six Tonight islands start `getAccountPlan(Astro.locals)` at the beginning of their load so the read overlaps the Tonight load (review F14c). `OfflineCopy` renders `data-plan` from `accountPlanForCopy(Astro.locals)` and takes an optional `target: { key: string; name: string }` rendered as `data-target` / `data-target-name` (ids and names only, never coordinates). `FinderContent` renders `OfflineCopy` only in the chart state, with the page's `night` and the target; its notices sit above the chart like on the Tonight pages. The locked root in the shell (`FinderLocked` from `finder.astro`) and in the island carries `data-plan` from `accountPlanForCopy` (review F11).

#### 3. Worker

**File**: `src/sw.ts`

**Intent**: Serve and store finder pairs like Tonight pairs, and drop them when the plan is gone.

**Contract**:
- The navigation route matches `storedPageOf(url)`; the stored answer is `chooseCopy(index, page, siteId, now, target)`; client tracking uses `storedPageOf` too.
- `afterNavigation`: a 200 HTML answer for `FINDER_PAGE` whose `lockedFinderPlan` is `"free"` drops the finder pairs (setting `freeSince` to the page's time) and records no shell; `"unknown"` records no shell and drops nothing.
- `commitIsland` / `commit`: meta comes from `copyMetaFor(shell.page, shellUrl, body)`; inside the same `serial` step, a pair whose island says `plan: "free"` is committed (a Tonight page), `freeSince` is set and `dropFinderCopies` runs; a finder island body that is locked with `data-plan="free"` drops the finder pairs and commits nothing; `unknown` commits a Tonight pair and drops nothing. `storeNextCopy` never runs for a chart (`needsNextCopy`).
- The auth-POST purge, the signed-out purge message, `needsReset` and `expire` are unchanged and cover finder pairs because they live in the same index.

#### 4. The `/offline` list

**Files**: `src/pages/offline.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: List stored charts as "Finder chart · M31" with the site, linking to `/tonight/finder?object=M31&site=<id>`.

**Contract**: the page's `isCopy` accepts the optional `target`/`targetName` strings; the finder title comes from the existing `titles` map plus the target name; new strings in both languages.

#### 5. E2E

**Files**: `tests/e2e/finder-offline.spec.ts` (new), `tests/e2e/offline-proxy.ts` (new: the `Proxy` class moved out of `offline.spec.ts`, which imports it)

**Intent**: Prove the owner's three rules in a browser: stored, served from the device, and gone after the plan is lost.

**Contract**: through the proxy, a full account (operator command, D-9) opens M13's chart from `/tonight/targets`; the test waits until the worker's index (`/__offline/index.json` in `sidereus-tonight-v1`, read as `offline.spec.ts` does) lists a finder copy for M13; closing the proxy, the chart URL shows `html[data-from-device]` and `[data-finder-chart]` and the prepared notice, and `/offline` lists "Finder chart · M13". Reopening the proxy, the account is demoted to free and `/tonight` is opened online; the index then lists no finder copy; closing the proxy again, the chart URL shows the stored `/offline` page (`html[data-from-device]`, no `[data-finder-chart]`). In the no-darkness window (8 June to 2 July) the test is skipped with that reason, as smoke does. Without `SUPABASE_SECRET_KEY` (no way to grant the plan) the spec fails under `CI` and skips locally with the reason "no SUPABASE_SECRET_KEY", mirroring D-9; each test signs up a fresh user, since the spec demotes it (review F14e). No retries.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/offline` passes, including the new `copies.test.ts` cases
- `npm run lint`, `npx astro check` and `npm run build` pass
- With local Supabase, the forecast fixture and the preview on port 4331 running (as in 4.3): `SUPABASE_URL=<local API_URL> SUPABASE_KEY=<local ANON_KEY> SUPABASE_SECRET_KEY=<local SECRET_KEY> BASE_URL=http://localhost:4331 npx playwright test finder-offline offline` passes (the existing offline spec stays green after the proxy move)

#### Manual Verification:

- On a phone: open a chart online, switch to airplane mode, open the same chart from the stored Targets page; it shows the stored-copy notice
- Demote the account, open Tonight online, go offline: the chart is gone and `/offline` no longer lists it

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: HTTP refusal, e2e and docs

### Overview

Prove the plan boundary over HTTP (test-plan §6.4), add one browser spec for the chart at phone width, and record the slice in the docs.

### Changes Required:

#### 1. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Read bodies when a step asks, grant and remove the plan through the operator command, hold the captured island URL in shared state, and add the finder steps.

**Contract**: `request()` also returns `body` (text) for steps with `bodyIncludes` / `bodyExcludes`; a helper runs `node scripts/account-plan.mjs <email> full|free` with the inherited `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (D-9 behaviour without the key). A shared `islandUrl` is set by step 2 (from the preload link, `&amp;` decoded) and every step that needs it fails loudly when it is empty. New steps after the gear steps, signed in as the smoke user (free by default):
1. `GET /tonight/finder?object=M13&from=targets` → 200, body includes `data-finder-state="locked"`, excludes `/_server-islands/FinderContent`.
2. Grant full → `GET` the same page → 200, body includes `/_server-islands/FinderContent` and excludes `data-finder-state="locked"`; capture `islandUrl`.
3. `GET islandUrl` as full → 200, body includes `data-finder-chart`. With the CI forecast fixture M13 is ranked at the smoke site (52.23° N, Bortle 6) except from about 8 June to 2 July (no astronomical darkness); only in that window is the step printed as `SKIPPED (no astronomical darkness)` and the body must include `data-finder-state="not-ranked"` instead.
4. Demote to free → `GET islandUrl` → 200, body includes `data-finder-state="locked"` and excludes `data-finder-chart`.
5. Signed out: `GET /tonight/finder?object=M13` → 302 to `/auth/signin?next=%2Ftonight%2Ffinder%3Fobject%3DM13` (exact).
6. Signed out: `GET islandUrl` (a leaked URL, the route is not gated) → 200, body includes `data-finder-state="locked"` and excludes `data-finder-chart`.

#### 2. CI

**File**: `.github/workflows/ci.yml`

**Intent**: Give the smoke and e2e commands the local stack's `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (from `supabase.env`), inline on those commands only.

**Contract**: `SUPABASE_URL="$API_URL" SUPABASE_SECRET_KEY="$SECRET_KEY" BASE_URL=… npm run smoke` and the same prefix on the e2e command; never `export`, so `npm run preview &` in the same step does not inherit the key; never in `.env` or `.dev.vars`.

#### 3. E2E

**File**: `tests/e2e/finder-chart.spec.ts` (new)

**Intent**: A full account (granted through the operator command) opens the "Finder chart" link of the M13 row on `/tonight/targets` (a pinned target, not the first link) and sees the chart state with both panels, the steps and the context line; the context line matches `data-finder-orientation` (`facing` or `overhead`, either is valid since M13 can culminate above 80° at southern sites); at 360 px nothing scrolls sideways; in red mode the page renders with the red theme. In the no-darkness window it asserts `not-ranked` the way smoke does.

**Contract**: uses `tests/e2e/helpers.ts` sign-up with a fresh user per test; without `SUPABASE_SECRET_KEY` it fails under `CI` and skips locally with the reason, mirroring D-9 (review F14e); no retries (`failOnFlakyTests`).

#### 4. Docs

**Files**: `CLAUDE.md`, `scripts/account-plan.mjs` (header comment), `context/foundation/test-plan.md`, `context/foundation/prd.md`, `context/foundation/roadmap.md`

**Intent**: CLAUDE.md: a Finder paragraph (route, loader, two-layer plan check, star file, offline storage and the plan-loss drop, overhead rule); the account-plan sentence "nothing else queries the table" becomes: full-plan pages call `requireFullPlan`, and every Tonight island also reads the plan (`accountPlanForCopy`, the same memoised read) for its offline metadata (review F14d) and the designation exception beside compass points; the Env and Commands lines say the local stack's secret key is also passed inline to `npm run smoke` and the e2e command in CI and locally, never exported and never to the preview. `account-plan.mjs` header: smoke calls it with the local key. Test-plan §6.4: the page variant (shell state + island replay as full, demoted and signed out) as the recipe the next full-plan page follows. PRD OQ21: the star-licence finding (every source complete to 7.5 is ESA CC BY-NC or unlicensed) and the owner's O-6 answer: HYG v4.1 stays, a commercial-licence request to ESA (data.licences@esa.int, draft in `context/changes/finder-chart/esa-licence-request.md`) is pending, and if ESA refuses, SAO only replaces HYG in its own change before any payment (SAO: NASA NTRS marks the 1966 reports and the ADC documentation "public use permitted"; no formal licence for the I/131A file; confirm before switching; research §9.1). Also note for OQ21 (pre-existing, outside this slice): the signed-out landing image `public/landing/tonight.png` shows the live sky's Hipparcos-derived stars without `Attribution`; OQ23: settled for finder charts (stored, dropped at the first online refresh after the plan is lost, 36 h expiry); OQ13-16: "settled as candidates in S-03 plan". Roadmap S-03 unknowns: mark resolved with pointers to this plan.

**Contract**: prose only. The PR description lists the D-9 key rule change for the owner.

### Success Criteria:

#### Automated Verification:

- `npm run smoke` passes against local Supabase and the preview, including the finder steps: with local Supabase, the forecast fixture and the preview on port 4331 running (as in 4.3), run `BASE_URL=http://localhost:4331 SUPABASE_URL=<local API_URL> SUPABASE_SECRET_KEY=<local SECRET_KEY> npm run smoke`
- `npx playwright test finder-chart` passes against the preview: same prerequisites, `SUPABASE_URL=<local API_URL> SUPABASE_KEY=<local ANON_KEY> SUPABASE_SECRET_KEY=<local SECRET_KEY> BASE_URL=http://localhost:4331 npx playwright test finder-chart`
- CI's `smoke` job passes on the PR (after the push of the feature branch at the end of implementation)

#### Manual Verification:

- At arm's length on a phone in red mode, the chart for one planet and one deep-sky object is legible
- PRD OQ21 records the ESA request and the SAO fallback with its caveat; `LICENSE-DATA.md` names the upstream NC licence; `Attribution.astro` carries the HYG and "Credit: ESA (CC BY-NC 3.0 IGO)" credits
- The PR description calls out the `SUPABASE_SECRET_KEY` rule change (local stack only, inline on smoke and e2e, never exported) and the owner accepts it

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Star file shape, provenance, overlap with bright stars, browser-import scan (Phase 1)
- Engine: invariants (start altitude, start limit ≤ naked-eye limit), determinism, cost tie-breaks incl. the non-additive counterexample, candidate bound, kinds, orientation along `x = 0`, overhead switch and zenith target, reference hops at fixed bands, measured 171-object coverage (Phase 2)
- Geometry, chart tokens' contrast, example fixture deep-equality (Phase 3)
- Loader: `locked` before any read for free and signed-out, not-configured, not-ranked, planet vs deep-sky eyepiece, logged `failed` (Phase 4)
- Offline copy rules: finder keying by target, serving choice, listing, `dropFinderCopies`, plan and target on the island metadata, old indexes (Phase 5)

### Integration Tests:

- Smoke: free shell refused, full shell and island allowed with a real chart, island replay refused after demotion and signed out, signed-out page redirect (Phase 6)
- E2E: full account opens M13's chart from Targets at 360 px, either orientation (Phase 6); the chart opens from the device offline and is gone offline after a demotion and one online Tonight load (Phase 5)
- Build: the star file never reaches `dist/client` (Phase 4)

### Manual Testing Steps:

1. Grant a local account full (`SUPABASE_URL=<local> SUPABASE_SECRET_KEY=<local> npm run account:plan -- <email> full`), open `/tonight/targets`, open a chart, compare with a published chart for the same object.
2. Switch to a Bortle 8 site: the start is a bright star (≤ 2.5) and the hop is longer.
3. Open a planet's chart: Jupiter is its own start (`naked-eye`); Uranus or Neptune, when ranked, get a hop.
4. Open a target that culminates above 80° (e.g. M31 from a 40° N site in October): the overhead variant with north up and the zenith mark.
5. Demote the account; reload: explainer with the example, no chart.
6. Red mode at 360 px: readable, no green or blue.
7. Open a chart online, go offline, reopen it from the stored Targets page; demote, open Tonight online, go offline: the chart is gone.

## Performance Considerations

- The star file (≈354 KB raw) is parsed once per isolate and only on the finder route (dynamic import); the free explainer never loads it. The hop search works on stars within the D-4 candidate bound: a few hundred nodes, a layered search of at most 8 layers, well under the 30 s CPU of Workers Paid.
- The chart HTML holds at most a few hundred circles per panel (≈25 KB raw); no client JS beyond Astro's island loader. A stored chart is one more ~25 KB pair in the Tonight cache; the 36 h per-site expiry bounds how many stay.
- `data-plan` adds one memoised `account_plans` read per Tonight island render (`requireFullPlan`, `src/lib/account-plan/index.ts:19`).
- Budgets enforced: `finder-stars.json` under 160 KB gzip (Phase 1); no `finder-stars` in `dist/client` (build fails) and `dist/server` JS at most 4,290,555 bytes (Phase 4).

## Migration Notes

No schema change. The plan check reads the existing `account_plans` table. The worker's stored index gains optional fields: an index written before this change parses with `target: null` on every copy and no finder pairs, so no cache version bump is needed.

## References

- Research: `context/changes/finder-chart/research.md`
- Plan review: `context/changes/finder-chart/reviews/plan-review.md`
- PRD: FR-037, FR-045, US-05, Invariants, OQ13-16, OQ21, OQ23 (`context/foundation/prd.md:174-188,445,461,576,707-742`)
- Offline copies: `src/lib/offline/copies.ts`, `src/sw.ts`, `tests/e2e/offline.spec.ts`; star-source comparison: research §9
- Roadmap S-03 and the F-01 note (`context/foundation/roadmap.md:121-136`)
- Test-plan §6.4 (`context/foundation/test-plan.md:157-167`)
- Similar implementation: focused page `src/pages/tonight/planets.astro`, island `src/components/tonight/PlanetsPageContent.astro`, server SVG `src/lib/tonight/altitude-curve.ts:40-79`, star pipeline `scripts/build-stars.mjs`, logged catch `src/lib/tonight/build.ts:1227-1231`, island URL parsing `src/lib/offline/copies.ts:161-171`
- Prior decisions: `context/archive/2026-10-05-interactive-sky/plan.md:98-154`, `context/archive/2026-10-09-account-plans/reviews/impl-review.md:108-116`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Finder star data

#### Automated

- [x] 1.1 `npm run stars:build` writes both star files and leaves `bright-stars*.json` byte-identical — 83ba064
- [x] 1.2 `npx vitest run src/lib/catalogue` passes, including `finder-stars.test.ts` — 83ba064
- [x] 1.3 `npm run lint` and `npx astro check` pass — 83ba064
- [x] 1.4 `finder-stars.json` gzips under 160,000 bytes — 83ba064

#### Manual

- [x] 1.5 Spot-check five stars against the HYG CSV row — 83ba064

### Phase 2: Engine: starting star, hop and projection

#### Automated

- [x] 2.1 `npx vitest run src/lib/engine` passes, including `finder.test.ts` and `purity.test.ts` — a7685fd
- [x] 2.2 `npm run lint` and `npx astro check` pass — a7685fd
- [x] 2.4 Coverage gate set 3 points below the first measured run (measured value noted here): measured 100 % hop at Bortle 3 (373 of 373, Warsaw, four fixed nights), gate 97 % — a7685fd

#### Manual

- [x] 2.3 Reference hops for M31, M13 and M57 look like the published routes — a7685fd

### Phase 3: Chart rendering

#### Automated

- [x] 3.1 `npx vitest run src/lib/finder src/i18n src/styles` passes
- [x] 3.2 `npm run lint` and `npx astro check` pass

#### Manual

- [ ] 3.3 `/design` FinderChart specimens read at 360 px in dark, light and red; circles distinguishable in red
- [ ] 3.4 The M31 specimen matches a published M31 chart's star pattern, facing orientation

### Phase 4: The finder page behind the full plan

#### Automated

- [ ] 4.1 `npm test` passes, including the `loadFinderFor` plan-guard tests
- [ ] 4.2 `npm run lint`, `npx astro check` and `npm run build` pass
- [ ] 4.3 `tonight-phone` and `tonight-targets` e2e specs stay green
- [ ] 4.7 Bundle budget: no `finder-stars` in `dist/client`, `dist/server` JS at most 4,290,555 bytes

#### Manual

- [ ] 4.4 Full account opens charts from an object and a planet; back link returns to the right page
- [ ] 4.5 Free account sees the explainer with the example, no error styling
- [ ] 4.6 The two action links wrap at 320 px without sideways scroll

### Phase 5: Offline finder charts

#### Automated

- [ ] 5.1 `npx vitest run src/lib/offline` passes, including the finder copy rules
- [ ] 5.2 `npm run lint`, `npx astro check` and `npm run build` pass
- [ ] 5.3 `npx playwright test finder-offline offline` passes against the preview

#### Manual

- [ ] 5.4 On a phone, a chart opened online opens offline from the stored Targets page with the stored-copy notice
- [ ] 5.5 After a demotion and one online Tonight load, the chart is gone offline and from `/offline`

### Phase 6: HTTP refusal, e2e and docs

#### Automated

- [ ] 6.1 `npm run smoke` passes against local Supabase and the preview, including the six finder steps
- [ ] 6.2 `npx playwright test finder-chart` passes against the preview
- [ ] 6.3 CI's `smoke` job passes on the PR

#### Manual

- [ ] 6.4 Chart legible at arm's length on a phone in red mode for a planet and a deep-sky object
- [ ] 6.5 PRD OQ21 records the ESA request and the SAO fallback; LICENSE-DATA names the upstream NC licence; credits carry HYG and "Credit: ESA"
- [ ] 6.6 PR description calls out the `SUPABASE_SECRET_KEY` rule change and the owner accepts it
