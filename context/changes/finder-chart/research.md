---
date: 2026-10-11T18:55:00+02:00
researcher: Claude (finder-chart agent, herdr run)
git_commit: 3365b97e88e274c54df53f4235cfcbc44065fc38
branch: feat/finder-chart
repository: RafalSkwara/Sidereus
topic: "M-3 S-03 finder chart: data, geometry, plan gating and the roadmap's unknowns (PRD OQ13-16)"
tags: [research, finder-chart, stars, hyg, licence, account-plan, tonight, engine, offline]
status: complete
last_updated: 2026-10-13
last_updated_note: "2026-10-13: owner answers O-4 (store finder charts offline) and O-6 (switch star source now) researched: §9 star sources for commercial use (no clearly commercial-clean source found; owner question), §10 offline finder copies. 2026-10-11: §7 corrected per plan review F2"
last_updated_by: Claude (finder-chart agent)
---

# Research: Finder chart (M-3 S-03)

**Date**: 2026-10-11T18:55:00+02:00
**Researcher**: Claude (finder-chart agent, herdr run; owner away)
**Git Commit**: 3365b97 (main at branch cut)
**Branch**: feat/finder-chart
**Repository**: RafalSkwara/Sidereus

## Research Question

What does the codebase, the record and the outside world give us to build FR-037 (a finder chart for any ranked deep-sky object or planet: the nearest naked-eye star above the site's minimum altitude at the object's best time, the hop to the object, the finder's and finding eyepiece's fields to scale, oriented as the user faces that part of the sky) as the first full-plan feature (FR-045), and how should the roadmap's unknowns be settled: the finder's field (PRD OQ13), star depth with licence and page weight (OQ14), the naked-eye limit by sky class and the hop length (OQ15, OQ16), and the F-01 note on `requireFullPlan` with test-plan §6.4's HTTP refusal recipe?

Method: four parallel workers (plan gating and Tonight pages; star pipeline, sky-view and engine; prior decisions in `context/archive/`; web research on catalogues, finders and hopping), plus two measurements I ran myself on the pinned HYG v4.1 CSV (downloaded by GET to the session scratchpad, not committed): star counts and encodings per magnitude cut, and the distance from each of the 171 catalogue objects to its nearest candidate starting star.

## Summary

1. **Nothing in the code draws a chart centred on a target.** The live sky's projection is a 180° equirectangular panorama (`src/lib/sky-view/projection.ts:20-27`), wrong for a 7-20° field. What can be reused: the engine's J2000-to-horizon rotation (`objectPosition`, `skyFrames`), the server-side SVG pattern of the Session plan (`src/lib/tonight/altitude-curve.ts` + `SessionTimeline.astro`), the eyepiece maths (`eyepieceOptics`, `pairEyepieces`), the star pipeline (`scripts/build-stars.mjs`) and the token-coloured SVG idiom. A gnomonic tangent-plane projection in alt/az (zenith up) and a hop search are new pure code.
2. **Render the chart on the server.** A static SVG built in a Tonight-style `server:defer` island keeps the deeper star set out of the browser (no page weight, no precache change, no island import-guard change) and keeps the bulk star file from being served to clients; the only cost is Worker bundle size (measured below) and an interaction-free snapshot at the best time.
3. **Star depth: HYG v4.1, same pin, to magnitude 7.5.** Measured on the pinned CSV: 25,791 stars ≤ 7.5, and the per-half-magnitude counts stop growing geometrically above ~7.5-8 (Hipparcos completeness). As columnar integers (RA and Dec in 0.01°, mag in 0.1) that is 354 KB raw / 122 KB gzip, loaded lazily on the server only by the finder route. Magnitude 8 (41,487 stars, 569 KB / 194 KB) is past HYG's even completeness.
4. **Licence finding** (2026-10-13: the owner asked to switch the star source now; §9 compares every candidate and finds none whose licence clearly allows commercial use)**.** ESA distributes the Hipparcos and Tycho catalogues under **CC BY-NC 3.0 IGO** with "Credit: ESA" (verified verbatim, https://www.cosmos.esa.int/web/hipparcos/catalogues); Tycho-2 and Gaia DR3 are NC too. HYG (CC BY-SA 4.0) is built from Hipparcos, so whether its derived stars can be used in a paid product is unsettled. This applies equally to the 925 bright stars already shipped. M-3 takes no money (PRD Non-Goals; roadmap Parked "Payments"), so it does not block S-03; it belongs with PRD OQ21 ("commercial licences before charging") and is an owner question. Adding "Credit: ESA" for Hipparcos is cheap and right now.
5. **Finder field (OQ13):** a 6×30 finder's true field is published as 7-8° (vendors list 7-7.5°, Takahashi 8°); Telrad rings are 0.5°, 2°, 4°. The candidate (7°, plus 0.5/2/4° reflex rings) holds.
6. **Naked-eye limit (OQ15):** the code already has `nakedEyeLimitingMagForBortle` (7.6 → 4.0, `src/lib/engine/parameters.ts:82-90`, matching Bortle's 2001 table). The PRD candidate for the *starting* star (4.5 / 3.5 / 2.5 by Bortle band) is a different, stricter quantity (a star a beginner can recognise, 1.5-2.5 mag above the limit); both can coexist, with a test that the starting limit never exceeds the naked-eye limit for any class (the PRD invariant). Measured: at 2.5 (Bortle 7-9) the nearest starting star is a median 9.9° and at most 25.7° from a catalogue object, so hops must allow several steps.
7. **Hop length (OQ16):** no published numeric rule; practice (RASC Calgary) measures hops in finder fields through patterns obvious in the finder; a forum rule of thumb is 3-5° in a 4.5-8° finder. Measured: stars ≤ 6.5 average 8.3 per 7° field, ≤ 7.5 average 24.1.
8. **Plan gating:** `requireFullPlan(locals)` exists and is unused (`src/lib/account-plan/index.ts:50`); `/tonight/*` is already gated by the middleware, so a signed-out visitor never reaches a `/tonight/finder` page and the page can branch on `reason`. The server island route is not gated, so the island must call the guard itself before building any chart. `scripts/smoke.mjs` cannot assert a body today and CI's smoke step has no secret key to grant a full plan; both need small changes for §6.4's HTTP check.
9. **Data the chart needs is not in `TonightView`.** Entries carry `bestAt` (epoch ms) but no RA/Dec, no numeric alt/az and no true field (`EyepieceLine` is `{name, magnification}`); planets have no finding eyepiece. The finder loader must recompute from the catalogue, the engine and the loaded gear.
10. **Offline** (superseded 2026-10-13: the owner decided finder charts are stored offline; see §10)**:** copies are keyed by exact page path plus `?site=` (`src/lib/offline/copies.ts:10-17,120-125`); a per-object finder page would not be stored without new keying in `copies.ts` and `sw.ts`. Keeping the finder online-only in this slice avoids PRD OQ23 (paid features in stored copies) entirely.

## Detailed Findings

### 1. Account plan and gating (F-01)

- `getAccountPlan(locals)` (`src/lib/account-plan/index.ts:34`) memoises one promise per request in a `WeakMap` (l.19); no Supabase or no user → `"free"` without a query; a failed read → `"free"` (fail closed). `planFrom` accepts exactly `"full"` (l.14).
- `requireFullPlan(locals)` (l.50) → `{ok:true}` or `{ok:false, reason: "not-configured"|"signed-out"|"needs-full", errorKey}` (l.43-44), checked in that order; `signed-out` and `needs-full` both carry `ACCOUNT_PLAN_NEEDS_FULL` = `"errors.accountPlan.needsFull"` (`src/lib/api-errors.ts:13`). No page or route calls it yet; `getAccountPlan`'s one caller is `Topbar.astro:10` (feeds `data-account-plan` in `TopbarControls.tsx:222-223`).
- i18n has only `errors.accountPlan.needsFull` (`src/i18n/messages/en.ts:1221-1223`); the "what this does + needs the full plan" state is new copy.
- Gate: `PROTECTED_ROUTES` contains `/tonight`; `isProtectedPath` matches the path and `route + "/"` prefixes (`src/lib/protected-routes.ts:5-18`), so `/tonight/finder` is gated; a signed-out GET goes to `/auth/signin?next=<path+query>` (`src/middleware.ts:37-44`; smoke pins the shape at `scripts/smoke.mjs:81-85`).
- `/_server-islands/*` is outside the gate; `loadTonightFor` guards itself (`src/lib/tonight/island.ts:37-41`). A finder island therefore needs its own `requireFullPlan` call; the shell's check alone does not protect the chart data.
- Record: impl-review F8 of account-plans (`context/archive/2026-10-09-account-plans/reviews/impl-review.md:108-116`) accepted the signed-out refusal and moved the behaviour to this slice (roadmap S-03 note). The "needs the full plan" UI state was deliberately left to S-03 (`context/archive/2026-10-09-account-plans/plan.md:13,57-58`).

### 2. Tonight focused pages and the data a chart needs

- Pattern (`src/pages/tonight/targets.astro:1-95`): `GearShell title skyFlow`; `requestedGear(Astro.url, Astro.cookies)` and `requestedNight(url)` in the shell; a `server:defer` island (`TargetsPageContent.astro`) with `TonightPageSkeleton` as fallback, `loadTonightFor(Astro.locals, {siteId, telescopeId, night, limit: Infinity})` (l.55), then `TonightPageSky`, `OfflineCopy`, notices, content. Shell passes ids, never coordinates (`src/lib/tonight/requested-gear.ts:34-39`).
- `TonightEntry` (`src/lib/tonight/build.ts:110-143`): `id`, `label`, `bestTime`, `bestAt` (epoch ms), `bestDirection` (string), `windowStart/End`, `pair: {finding:{name, magnification}, detail} | {kind:"none-fit"}`; no RA/Dec, no numeric alt/az, no true field. `TonightPlanetEntry` (`build.ts:178-215`): `key`, `bestAt`, `bestDirection`, `eyepiece` (detail only), no finding eyepiece.
- Engine pieces: `objectPosition(site, time, {raHours, decDeg})` (refracted) and `skyFrames` (unrefracted rotation per instant) (`src/lib/engine/objects.ts:33-58`, `sky-frames.ts:31-41`, barrel `index.ts:26,50`); `planetTracks` uses of-date `Equator` + `Horizon` (`planets.ts:52-67`), no J2000 planet position exported. `Site` carries no Bortle or minimum altitude; those are separate inputs from the DB site record (`ranking.ts:57-58`, `build.ts:745`).
- Eyepieces: `eyepieceOptics` gives `trueFovDeg = afovDeg / magnification` (`src/lib/engine/eyepieces.ts:50-57`); `pairEyepieces(telescope, eyepieces, majorAxisArcmin)` picks the finding eyepiece as the widest eligible true field with exit pupil ≤ `EXIT_PUPIL_CEILING_MM` (`eyepieces.ts:92-123`); `majorAxisArcmin = null` fits every eyepiece, which yields a planet's finding eyepiece with no new rule. `build.ts:486-507` (`eyepieceLine`, `toPair`) drops the true field.
- Row anatomy: best-three `ObjectCard.astro:28-49` (`id="object-<id>"`), others `ObjectRow.astro:24-64` (`<details>`); both render `ObjectDetails.astro:18-44` → `TargetDetails.astro:53-59`, the action area that holds "Mark observed" (`buttonVariants({variant:"action", size:"sm"})`, `data-needs-network`). Planets: `PlanetCard.astro:27-59` uses `TargetDetails` too. Washed-out rows have no actions (`TargetsPageContent.astro:228-251`).
- "Mark observed" return: `from` is `z.enum(["log","targets","moon","planets"])` (`src/lib/observations/schemas.ts:96`), mapped by `tonightReturnPath` (`redirect.ts:19-32`) and `PAGE_TITLES` (`src/pages/log/new.astro:34-43`); a chart page with an object query is not a return target today.

### 3. Star data, pipeline and weight

- Pipeline: `scripts/build-stars.mjs` pins HYG v4.1 at `c7f7f883…` (l.21-25), streams the CSV (l.97-107), skips Sol and `mag > 4.5` (l.26,135), guards the count (925 ± 10, l.29-30,154), writes `{id, mag, x, y, z[, name]}` J2000 unit vectors at 5 dp (l.35,87-95), sorted by mag then id (l.152). `bright-stars.json` is 60,056 B / 16,914 B gzip for 925 stars.
- `stars.ts` validates count 915-935 and mag ≤ 4.5 at load (`src/lib/catalogue/stars.ts:26-27,52`) and is island-safe (l.10-11); a deep set needs its own file, loader and validator, not `BRIGHT_STARS`.
- Measured on the pinned CSV (119,625 rows without Sol): stars per half magnitude 6.0-6.5: 3,815; 6.5-7.0: 6,624; 7.0-7.5: 10,112; 7.5-8.0: 15,578; 8.0-8.5: 20,260; 8.5-9.0: 21,715 → growth ratio ~1.53 up to 7.5, falling to 1.30 at 8.0-8.5 and ~1.07 at 8.5-9: HYG is evenly complete to about 7.5. For comparison the S&T Jumbo Pocket Sky Atlas plots 30,796 stars to 7.6 (web report), and hnsky's Tycho-2/Gaia count is 16,064 to V 7 vs HYG's 15,598.

| cut | stars | with Bayer/Flamsteed | columnar int JSON | gzip |
| --- | --- | --- | --- | --- |
| ≤ 6.5 | 8,920 | 3,071 | 122 KB | 43 KB |
| ≤ 7.0 | 15,598 | 3,244 | 214 KB | 74 KB |
| ≤ 7.5 | 25,791 | 3,307 | 354 KB | 122 KB |
| ≤ 8.0 | 41,487 | 3,318 | 569 KB | 194 KB |

  (HYG ids without a Hipparcos number at ≤ 7.5: 78, so ids stay HYG ids as in `bright-stars.json`.)
- Worker bundle today: `dist/server` 3,790,555 B of JS (~876 KB gzip; largest chunks entrypoints 796 KB, supabase 775 KB); `wrangler.jsonc` sets no size limit; `context/foundation/infrastructure.md` records Workers Paid (since 2026-09-30) but no bundle limit. Cloudflare's compressed limit is 3 MiB on Free and 10 MiB on Paid (worker's general knowledge, unverified here); +122 KB gzip fits either. A dynamic `import()` in the finder loader keeps the parse off every other route.
- Client side, for contrast: a lazy-imported JSON becomes an `_astro/*.js` chunk that `scripts/build-sw.mjs:51-53` precaches (only map/leaflet are ignored), and a browser loader would need the `TonightSkyView.test.ts` import-guard allowlist extended (l.14-75). Server rendering avoids both.
- Licence record: HYG's derived files are declared CC BY-SA 4.0 Adapted Material in `src/lib/catalogue/LICENSE-DATA.md` (HYG section from l.21) following the verified-ephemeris-core plan-review F7 precedent; `Attribution.astro:2,16-18` credits HYG with `t.starData`. A new generated file needs a LICENSE-DATA entry, a `.prettierignore` line, a CLAUDE.md tripwire and its own shape/provenance test, as `bright-stars*.json` has.

### 4. Licences of the candidate sources (web)

- Hipparcos and Tycho: "distributed under the CC BY-NC 3.0 IGO licence", credit "Credit: ESA", citation "ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200" (verified, https://www.cosmos.esa.int/web/hipparcos/catalogues); ESA's terms require prior authorisation for use that "directly or indirectly generates a financial gain" (https://cosmos.esa.int/web/esdc/terms-and-conditions). VizieR I/239 and I/259 carry the same NC licence.
- Gaia DR3: CC BY-NC 3.0 IGO (https://www.cosmos.esa.int/web/gaia-users/license).
- Yale BSC (V/50): no licence statement; Debian ships it in non-free (copyright Hoffleit/Warren 1991) — unclear, not public domain.
- HYG v4.x: CC BY-SA 4.0 (https://www.astronexus.com/hyg); current release is v4.2 on Codeberg (GitHub frozen; v4.1 → v4.2 changes some proper names). HYG's pages do not address the upstream NC term. AT-HYG (Tycho-2 + Gaia) and d3-celestial's star files (XHIP-derived) carry the same upstream question.
- Conclusion: no clearly commercial-clean all-sky catalogue to magnitude 8 was found. For M-3 (no money), HYG remains the source; the commercial question joins OQ21 for the owner. Serving rendered charts rather than the bulk file reduces redistribution but does not settle NC.

### 5. Finders, orientation, naked-eye limits, hopping (web)

- 6×30 true field: 7-7.5° (iOptron, telescoop.nl), 8° (Takahashi). 8×50: 5-6°. Telrad rings 0.5°, 2°, 4°; Rigel QuikFinder 0.5°, 2°. A reflex sight shows nothing fainter than the naked eye.
- Orientation: a straight-through finder shows the sky rotated 180° (Wikipedia; RASC Calgary words it differently — sources disagree on the mirror sense); a plain right-angle finder is mirrored; RACI is correct; a Telrad is 1× non-inverting. Published Telrad charts draw the naked-eye view; no print source confirms a single convention.
- Bortle 2001 NELM: 1: 7.6-8.0, 2: 7.1-7.5, 3: 6.6-7.0, 4: 6.1-6.5, 5: 5.6-6.0, 6: ~5.5, 7: 5.0, 8: 4.5, 9: ≤ 4.0 (S&T) — matches `nakedEyeLimitingMagForBortle`'s lower bounds.
- Starting-star reach, measured over the 171 catalogue objects (ignoring altitude) with the stars ≤ 7.5 of the pinned CSV:

| starting-star limit | candidate stars | nearest start: median | 90th pct | max |
| --- | --- | --- | --- | --- |
| ≤ 4.5 (Bortle 1-4) | 925 | 3.6° | 6.5° | 9.1° |
| ≤ 3.5 (Bortle 5-6) | 291 | 6.1° | 10.1° | 15.0° |
| ≤ 2.5 (Bortle 7-9) | 94 | 9.9° | 17.3° | 25.7° |

- Hop density, stars per 7° field (mean, all-sky): ≤ 6.0: 4.7; ≤ 6.5: 8.3; ≤ 7.0: 14.6; ≤ 7.5: 24.1.
- Hopping practice: RASC Calgary starts from the nearest naked-eye star and hops in finder fields via "triangles or rectangles" obvious in the finder (https://calgary.rasc.ca/starhop.htm); a 3-5° step is a forum rule of thumb (stargazerslounge). No algorithmic hop literature was found; Star-Hop Maker and BAA Hopper are viewers, not path finders. Manual cross-check references: Sherwood Observatory's Telrad charts for all 110 Messier objects (stars to 6.5-7, no licence stated — compare, never copy), the S&T Pocket Sky Atlas.

### 6. Offline

- `TONIGHT_PAGES` is a closed list of six paths (`src/lib/offline/copies.ts:10-17`); `tonightPageOf` matches the exact pathname and keeps only `?site=` (l.120-125; `copies.test.ts:72` pins that other `/tonight/*` paths are not pages). A finder page with `?object=` would neither match nor be keyed per object. No offline code knows the plan (`IslandCopy`/`CopyMeta`, l.43-65). PRD OQ23 (paid content in stored copies) is routed to S-08 in the roadmap.

### 7. HTTP refusal check (test-plan §6.4)

- §6.4 (`context/foundation/test-plan.md:157-167`) is written for a POST route; for a page it says "a page renders its own state instead". The check is HTTP, never the UI: free and full accounts, the same request, the free one refused, the full one as positive control.
- `scripts/smoke.mjs`: `request(path,{method, form})` uses `redirect:"manual"` and returns `{status, location, setCookies}` only (l.32-57, 181-199) — no body. Steps assert `status`, `location` (prefix, or `exact: true`), `absent`. It signs up `smoke-<ts>@example.com` and onboards a 150/750 mm scope with 25 mm and 10 mm Plössls (l.16-29, 86-90).
- Granting full: `npm run account:plan` / admin `upsert` with `SUPABASE_SECRET_KEY` (`tests/db/account-plans.test.ts:60-98`); CI passes that key only to `test:db` (`.github/workflows/ci.yml:48`), not to the smoke step (l.64-68). `tests/db/` never calls the app over HTTP.
- ~~The island's own guard cannot be hit by plain HTTP easily (server-island URLs carry encrypted props), so the island-side refusal is a unit test of the loader, and the page-level refusal is the HTTP check.~~ **Superseded (plan review F2, 2026-10-11):** the island can be hit over HTTP. Astro 7.3.2 emits `<link rel="preload" as="fetch" href="/_server-islands/<LocalName>?e=…&p=…&s=…">` in the shell when the URL is under 2048 characters (`node_modules/astro/dist/runtime/server/render/server-islands.js:26-30,141-154`); the props are encrypted with the per-build key with no session binding, nonce or expiry, so the same URL can be replayed with any cookie (the service worker already does, `src/lib/offline/copies.ts:161-171`). The href is HTML-escaped (`&amp;`). So the island-side refusal is proven both by a loader unit test and by an HTTP replay as a demoted and a signed-out user.

### 8. Colour, red mode, `/design`

- Colours only from tokens (`src/styles/no-hardcoded-colors.test.ts`); star tokens `--star`, `--star-accent` exist in every theme incl. red (`global.css:69-70,115-116,163,212-213`); SVGs use token classes (`fill-heading`, `stroke-ring`, …, `TonightSkyView.tsx:495-579`). A new chart token needs a value in every theme block, zero G/B in red, and a contrast row if it carries meaning.
- `/design` (`src/pages/design.astro`, "Components × states" from l.706) shows each shared component in the 7-state contract (l.156-165) with sample data built through `buildTonight`; nothing enforces registration beyond CLAUDE.md.

### 9. Star sources for commercial use (owner O-6, 2026-10-13)

The owner asked to switch both star files (the live sky's `bright-stars.json` and the new finder file) now to one source whose licence allows commercial use, complete to about 7.5. Three parallel web workers plus my own checks of the primary pages. The two non-ESA catalogues were measured against the pinned HYG CSV in the scratchpad (scripts `compare.mjs`, `merged.mjs`, `merge.mjs`, `names.mjs`; downloads from CDS FTP, SHA-256 below). Not legal advice.

| Candidate | Licence (primary source) | Commercial use | Completeness, size | IDs and names | Build effort |
| --- | --- | --- | --- | --- | --- |
| HYG v4.1 (today) | CC BY-SA 4.0, but built from Hipparcos | No without ESA's authorisation (upstream NC) | Even to ~7.5; 25,791 ≤ 7.5 | HYG id, HIP, Bayer/Flamsteed, proper | None (pinned generator exists) |
| Hipparcos / Tycho / Tycho-2 (ESA) | "distributed under the CC BY-NC 3.0 IGO licence", "Credit: ESA" (https://www.cosmos.esa.int/web/hipparcos/catalogues) | Only with ESA's authorisation: "Prior to any commercial use … a detailed request for authorisation/licence shall be made … data.licences@esa.int" (https://www.cosmos.esa.int/web/esdc/terms-and-conditions) | Tycho-2 to V ≈ 11 | HIP/TYC | Low |
| Gaia DR3 (ESA) | "Gaia data are distributed under the CC BY-NC 3.0 IGO license" (https://www.cosmos.esa.int/web/gaia-users/license); same ESDC terms; credit "ESA, Gaia DPAC" | Only with ESA's authorisation | Incomplete at the bright end (brightest source G ≈ 1.7; saturation corrections below G 8); 36,663 sources G < 7.5, 62,723 G < 8 (TAP COUNT by GET) | source_id only; HIP/TYC via cross-match tables | High: G→V polynomial (σ ≈ 0.03), bright-star supplement still needed |
| AT-HYG v4.0 | CC BY-SA 4.0 (https://codeberg.org/astronexus/athyg); upstreams Tycho-2, Gaia DR3, Hipparcos, Yale BSC | No (ESA upstreams) | To ~11 | as HYG | Low |
| d3-celestial stars, Stellarium, SKY2000 v5, UCAC4 | Code BSD/GPL; star data from XHIP/Hipparcos/Tycho (d3-celestial README; SKY2000 ReadMe V/145; UCAC4 ReadMe I/322A: "All bright stars not observed with the astrograph have been added to UCAC4 from a set of Hipparcos and Tycho-2 stars") | No (ESA upstreams for every star brighter than ~8) | To 8 or deeper | various | Medium |
| Yale BSC5 preliminary (Hoffleit & Warren 1991, NSSDC/ADC; VizieR V/50) | No licence in the ReadMe. Debian ships it in **non-free**: copyright Hoffleit & Warren 1991; the ADC files may be redistributed unmodified, but "the data files must NOT be altered in any way (without permission of the original authors)" (https://metadata.ftp-master.debian.org/changelogs/non-free/y/yale/stable_copyright) | Not granted; derived files are "altered" | 9,096 stars with positions, to V ≈ 6.5; 911 ≤ 4.5 after merging components closer than 30″ | HR, HD, SAO, Bayer/Flamsteed in `Name` (3,143 rows) | Medium (fixed-width parse) |
| SAO Star Catalog J2000 (SAO Staff 1966; USNO, ADC 1990; VizieR I/131A) | No licence or copyright line in the ReadMe; same NASA ADC distribution as BSC5 | Not granted | 258,944 rows (not deleted), 26,559 with V ≤ 7.5 | SAO, HD, DM; no Bayer | Medium |
| IAU WGSN names | No terms found (iau.org page 404) | Unknown; names are short facts, our 41 Polish forms are our own (`star-names.ts`) | n/a | n/a | n/a |

CDS's own rule for VizieR data: "free of usage in a scientific context"; "The commercial usage of the data is subject to rules depending of the origin"; check the catalogue's ReadMe for a copyright (https://cds.unistra.fr/vizier-org/licences_vizier.html, via a search worker; the page did not load for me).

Measured quality of the only non-ESA option (BSC5 for V ≤ 6.5 where it lists the star, else SAO; matched to HYG within 1′):

- HYG ≤ 4.5 (925 stars): 100 % matched, |ΔV| median 0.01, p90 0.04.
- HYG ≤ 6.5 (8,920): 99.91 % matched, |ΔV| median 0.01, p90 0.08.
- HYG ≤ 7.5 (25,791): 99.49 % matched, |ΔV| median 0.06, p90 0.38, p99 0.98.
- Merged entries ≤ 7.5: 26,584; 1,205 (4.5 %) have no HYG star brighter than 8.5 within 1′, i.e. SAO's old visual magnitudes run too bright for some faint stars. Merged ≤ 6.5 (the hop stars): 43 (0.49 %).
- BSC5 lists close doubles as components (Acrux 1.33 instead of 0.77, Castor 1.98 instead of 1.58); merging components within 30″ gives 911 stars ≤ 4.5 (HYG: 925) and restores Acrux 0.76, Castor 1.59. α Cen A/B (Rigil Kentaurus, Toliman) merge into one naked-eye star.
- Pins: `V/50/catalog.gz` SHA-256 `3dc44b1e…7bed`, `I/131A/sao.dat.gz` SHA-256 `5d54b348…4b7e` (full hashes in the plan's O-6 entry).

**Finding:** no candidate both allows commercial use and is complete to 7.5. Every catalogue complete to 7.5 traces back to ESA's Hipparcos/Tycho (CC BY-NC 3.0 IGO, commercial use only with ESA's authorisation) or to the ADC-era BSC5/SAO files, whose terms forbid altered redistribution without the authors' permission (BSC5, per Debian) or say nothing (SAO). ESA's terms name a route (a request to data.licences@esa.int); no other source names one. Per the owner's instruction this goes back as a question, not a pick.

### 10. Offline finder copies (owner O-4, 2026-10-13)

The owner decided finder charts are stored offline alongside the Tonight copies, removed at the first online refresh after the account loses the full plan, expiring after 36 h like the others, with the existing owner and sign-out purges kept.

- Keying: a copy is one pair keyed by `(siteId, page, kind)` (`commitPair`, `src/lib/offline/copies.ts:252-267`); `chooseCopy`/`needsNextCopy`/`listCopies` take a `TonightPage` (l.301-356); `isCopyMeta` rejects any page outside `TONIGHT_PAGES` (l.382). A finder copy needs the target in the key and in the index.
- Pages: `tonightPageOf` matches the six exact paths (l.120-125) and drives the worker's navigation route (`src/sw.ts:536-569`), its client tracking (l.227-238) and the replacement rule. Its comment says a redirect on these paths can only be the sign-in bounce (l.535); the finder page must keep that true (an unknown object renders a 200 state, never a redirect).
- Metadata: the island's `[data-offline-copy]` (`src/components/tonight/OfflineCopy.astro`) carries owner fingerprint, site id and name, kind, night, prepared and valid-until times, nothing about the plan; `copyMetaFromIsland` reads it (`copies.ts:183-206`). Five Tonight islands render it (`TonightContent`, `TargetsPageContent`, `PlanPageContent`, `PlanetsPageContent`, `NightsPageContent`).
- Purges: auth POSTs purge everything (`src/sw.ts:583-594`); a signed-out page asks for a purge by message (`src/lib/offline/page-state.ts:126-138`, `src/sw.ts:631`); a commit by another owner resets the store (`needsReset`, `copies.ts:100-103`); expiry is per site, 36 h after its last refresh (`expire`, l.287-295). Nothing knows the plan today.
- Next-night copies: every `tonight` commit may fetch `?night=next` for the same page (`src/sw.ts:392-395,405-450`); for a finder page that doubles every chart's server cost for a night the user did not ask about.
- Offline e2e: `tests/e2e/offline.spec.ts` goes offline through a closable reverse proxy (Playwright's `setOffline` does not stop the worker's own fetches, l.16-20) and asserts `html[data-from-device]` first.

## Code References

- `src/lib/account-plan/index.ts:14,19,34,43-50` — plan read, memo, guard and its reasons
- `src/lib/protected-routes.ts:5-18`, `src/middleware.ts:37-44` — `/tonight/*` gate and `?next=`
- `src/lib/tonight/island.ts:9-41`, `src/lib/tonight/load.ts:64-87,190-201` — `loadTonightFor`, `TonightLoad`, `logHref`
- `src/lib/tonight/build.ts:110-143,178-215,486-507` — `TonightEntry`, `TonightPlanetEntry`, eyepiece lines
- `src/lib/engine/eyepieces.ts:50-57,92-123` — true field and finding eyepiece
- `src/lib/engine/objects.ts:33-58`, `src/lib/engine/sky-frames.ts:31-41`, `src/lib/engine/planets.ts:52-67` — positions
- `src/lib/engine/parameters.ts:82-90` — `nakedEyeLimitingMagForBortle`
- `src/components/tonight/TargetDetails.astro:53-59`, `ObjectDetails.astro:18-44`, `PlanetCard.astro:27-59` — where a chart link sits
- `scripts/build-stars.mjs:21-35,87-107,135-166,202-203` — star pipeline
- `src/lib/catalogue/stars.ts:10-27,52`, `LICENSE-DATA.md:21+`, `src/components/tonight/Attribution.astro:2,16-18` — star loader, licence, credit
- `src/lib/sky-view/projection.ts:20-33`, `src/lib/sky-view/rotate.ts:20-34` — panorama projection (not reusable), rotation
- `src/lib/tonight/altitude-curve.ts:40-79`, `SessionTimeline.astro` — server SVG precedent
- `src/lib/offline/copies.ts:10-17,43-65,120-125` — offline page list and keys
- `scripts/smoke.mjs:16-29,32-57,78-199`, `.github/workflows/ci.yml:48,64-68` — HTTP checks and CI secrets
- `context/foundation/test-plan.md:157-167` — §6.4

## Architecture Insights

- The engine is pure and takes data as input (`purity.test.ts:23-38`); a hop search and a tangent-plane projection fit there if the star list is passed in rather than imported, so tests can use small synthetic skies.
- Tonight's "server builds, static SVG renders" path (Session plan) is the precedent for a chart without client JS; the live sky's "ship vectors, rotate in the browser" path exists for interactivity the chart does not need.
- The plan check is lazy and per request; only routes that need it query `account_plans`. The middleware never reads the plan (CLAUDE.md).
- Generated catalogue files follow one discipline: a pinned source, a build script, a shape/provenance test, a LICENSE-DATA entry, `.prettierignore` and a CLAUDE.md tripwire.

## Historical Context (from prior changes)

- `context/archive/2026-10-05-interactive-sky/plan.md:113-154` — bright stars added (HYG v4.1, mag ≤ 4.5, 925); fainter stars explicitly out of scope (l.75); budgets: skyView < 30 KB, island chunk < 60 KB gzip (l.231, 323); rotation matrices in the browser leak the site to ~600 m, a recorded decision (l.110). `plan-brief.md:26-31` — "the sky doubles as a finder chart", named stars as hopping anchors.
- `context/archive/2026-09-22-verified-ephemeris-core/reviews/plan-review.md:82-88` — ShareAlike precedent: derived files declared CC BY-SA 4.0 Adapted Material.
- `context/archive/2026-09-25-tonight-verdict-and-ranking/plan.md:87` — origin of `nakedEyeLimitingMagForBortle`; `plan-brief.md:34,79` — an agent-run checkpoint replaced an external planner check ("judged without an observer" precedent).
- `context/archive/2026-10-01-moon-as-target/plan.md:146,209-226` — independent Skyfield reference committed as a fixture with provenance.
- `context/archive/2026-10-09-account-plans/plan.md:13,57-58,182-199`; `reviews/impl-review.md:78-84,108-116` — guard design, memo caveat (F5), signed-out note (F8).
- Contradictions recorded: roadmap baseline says 927 bright stars (`roadmap.md:73`), the meta and code say 925 (the file has 927 lines); PRD OQ17 points at "roadmap Open Question 2" where the M-3 roadmap's question is 1 (`roadmap.md:218-219`); shape-notes still lists star-hopping as a non-goal (`shape-notes.md:427-432`), superseded by PRD v3.

## Related Research

- `context/archive/2026-10-05-interactive-sky/research.md` — sky-view and star sourcing
- `context/archive/2026-10-09-account-plans/research.md` — plan gating
- `context/archive/2026-10-07-ui-mobile-pass/research.md:135` — S-03/S-04 rework the object cards

## Open Questions

For the plan to settle (team, delegated) or to list for the owner:

1. **Commercial use of Hipparcos-derived stars** (owner, joins PRD OQ21): ESA's NC licence vs. a future paid plan; applies to the shipped bright stars too. Not blocking M-3. **2026-10-13:** the owner asked to switch now; §9 finds no commercial-clean source to 7.5, so the choice between asking ESA, asking for permission for BSC5/SAO, or staying on HYG until then is back with the owner.
2. **Finder field and rings** (owner, OQ13): 7° 6×30 plus 0.5/2/4° reflex rings — research supports the candidate.
3. **Orientation** (owner, UI): naked-eye view (zenith up) with a note about inverted finders, or a flip control.
4. **What a free account sees** (owner, UI): the explainer's content (text only, or an example chart) and whether row links differ for free accounts.
5. **Offline** (owner, product): finder pages online-only in this slice, or stored per object (new keying in `copies.ts`/`sw.ts`, triggers OQ23). **Answered 2026-10-13:** stored per object; §10.
6. **Calibration without an observer** (owner, roadmap OQ1): manual comparison with published Telrad charts (Sherwood) for a handful of Messier objects, recorded in the plan.
