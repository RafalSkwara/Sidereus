# What to expect (M-3 S-04) Implementation Plan

## Overview

Each ranked deep-sky target gets one plain-language line on what it will look like in the user's own telescope from their site, for example "A very faint grey smudge; use averted vision." The line appears on `/tonight/targets` (every ranked row) and on the target's finder chart.

- It is chosen from a fixed phrase set by a pure engine rule over five inputs: the object's type, size and brightness, the telescope's aperture and the site's sky quality (Bortle).
- It is a full-plan feature (FR-038, FR-045). A free account sees what it does and that it needs the full plan, never an error or an empty state. The server decides which one renders.
- Planets keep their existing free note. The finder chart shows that note for a planet, so US-05's "a line on what the object will look like" holds for every chart.

Plan review on 2026-10-14 (`reviews/plan-review.md`, NEEDS ATTENTION, 0 critical): F1-F10 are applied below. The owner answered O-1 and O-2 the same day.

## Current State Analysis

Full evidence is in `research.md`. Its open questions are settled below as D-1 to D-13 and O-1 to O-2.

- **Data exists, the rule does not.**
  - The catalogue gives every object `type` (12 values), `vMag` and `majorAxisArcmin` (null only for M40 and M73) (`src/lib/catalogue/index.ts:16-58`).
  - The engine already turns these into a core surface brightness (`effectiveSurfaceBrightness`, `src/lib/engine/moonlight.ts:103-112`). It also gives a moonless zenith sky brightness per Bortle class (`darkSkyZenithMagForBortle`, `parameters.ts:316-319, 325`) and a telescope limiting magnitude (`telescopeLimitingMag`, `score.ts:92-94`).
  - Nothing classifies how an object looks.
- **Planets and the Moon already have fixed, free notes.**
  - `tonight.planets.note[key]`, `en.ts:623-632`. It is built into `TonightPlanetEntry.note` at `build.ts:855`.
  - `tonight.moon.note[band]`, `en.ts:715-730`.
  - Both shipped before v3, so FR-045 keeps them free.
- **One component renders every ranked deep-sky row's details.**
  - That component is `ObjectDetails.astro:21-49`. It wraps `TargetDetails`, whose window and best-time `<dl>` renders before its `<slot/>` (`TargetDetails.astro:44-61`).
  - `ObjectCard` uses it for the best five and `ObjectRow` for the rest, both rendered by `TargetsPageContent.astro:163-169, 221-223`.
  - The island holds `load.site` and `load.telescope`, both typed `| undefined` (`src/lib/tonight/load.ts:65-85`).
  - `TonightEntry` carries neither the object's type nor its size (`build.ts:110-143`).
- **Plan reads.**
  - `getAccountPlan(locals)` is memoised per request and returns `free` on a failed read (`src/lib/account-plan/index.ts:54-69`).
  - `accountPlanForCopy` reads the same memoised result three-valued (`full` / `free` / `unknown`), for display only (`:78-80`).
  - The Targets island already starts that read for `OfflineCopy` (`TargetsPageContent.astro:56`).
  - The finder loader already proves the full plan before it builds anything (`src/lib/finder/load.ts:102`). It has the catalogue object, the site, the telescope and the locale in scope (`:79`, `:125-162`, `:135`).
- **S-07 sky-events is implementing in parallel** in its own worktree. Its commit `e57dadf` already appends an `EVENT_*` block at the end of `parameters.ts` and an `events` export block at the end of `src/lib/engine/index.ts`.
  - Its plan also changes these files:
    - `build.ts`, `load.ts` and `island.ts`;
    - `TONIGHT_PAGES`, `copies.test.ts` and `sw.ts`;
    - the dashboard (`TonightContent`, `TonightTiles`, `TonightSkeleton`, `VerdictCard`, `sky-band.ts`);
    - `no-console-guard.test.ts` and `src/lib/engine/fixtures/index.ts`;
    - `tonight-dashboard.spec.ts` and `tonight-phone.spec.ts`.
  - It adds blocks to `en.ts` / `pl.ts` (`tonight.events`, `tonight.summary.events`, `tonight.pages.events`, `targets.meteorShower`), `design.astro`, `CLAUDE.md` and `roadmap.md` (sky-events `plan.md:153-472`).
  - It touches none of `ObjectDetails`, `ObjectCard`, `ObjectRow`, `TargetDetails`, `TargetsPageContent`, `PlanetCard`, `src/components/finder/**`, `src/lib/finder/**`, `scripts/smoke.mjs`, `tests/e2e/helpers.ts` or `purity.test.ts`.

## Desired End State

- **A full-plan user on `/tonight/targets`** sees an "eye" line in each ranked row's details:
  - it sits below the window and best time and above the eyepiece pair;
  - it is phrased from the 22-phrase set, in EN or PL;
  - it changes when they switch to a telescope of a different aperture, or to a site of a different Bortle class, wherever the rule's bands differ.
- **A full-plan user on a finder chart** sees the same line above the chart for a deep-sky object, and the planet's existing note for a planet.
- **A free account** sees one muted line with a lock under the Targets count (O-1), and the locked finder explainer gains a fourth bullet. No free island's HTML contains an expectation line, and `scripts/smoke.mjs` proves it over HTTP.
- **A failed plan read** (`unknown`) shows neither the lines nor the free line (D-13).
- **Unchanged:** the dashboard, `TONIGHT_PAGES`, `copies.ts`, `loadTonightFor`, `TonightView`, the planet and Moon cards, and the ranking.
- **How to verify:** `npm test` (the rule's unit tests and the reference fixture), `npm run lint`, `npx astro check`, `npm run smoke` and `tests/e2e/what-to-expect.spec.ts`, plus the whole e2e suite before the PR.

### Key Discoveries:

- **The contrast deficit separates objects and moves with the sky class.** The deficit is core surface brightness minus the moonless zenith sky. Over the 169 objects with a size, the counts in bands < 0 / 0-1.5 / 1.5-2.5 / 2.5-3.5 / ≥ 3.5 are 143 / 19 / 4 / 0 / 3 at Bortle 3 and 39 / 60 / 38 / 19 / 13 at Bortle 7 (research §1; recomputed by the plan review).
- **The washed-out rule is the same family of formulas, but not the same test** (review F8).
  - The ranking's washed-out test (`score.ts:164-168`, threshold 3.5 mag, `parameters.ts:370`) compares the core against the *moonlit* sky at the object's altitude (airmass, extinction), and only for `WASHED_OUT_TYPES`. It drops an object only when it is visible without the Moon and the Moon is what loses it (exclusion at `ranking.ts:220-222`).
  - This rule uses the moonless *zenith* sky. Objects with a moonless deficit d ≥ 3.5 can still be ranked: 12 at Bortle 7 / 150 mm (M20, M43, IC 342 …) and 26 at Bortle 9 (M16, M33 …). They take the `limit` band, which has no upper bound.
  - A published rule of thumb puts visibility at about 3.25 mag/arcsec² fainter than the sky (research §7).
- **Globular resolution vs aperture.** Published guides agree that a 4-inch scope starts to resolve M13's edge and that 4.5-6 inches resolves it clearly (research §7).
- **The rule as first drafted gets known hard cases wrong.** The plan review recomputed D-2 over 171 objects × Bortle 1-9 × 20-1000 mm and found these (review F2):
  - faint globulars (M56, M9, M69, M70, M72, M75, M79, M107) stay `globularGlow` at any aperture;
  - Helix (NGC 7293) and the Owl (M97) get the "small, crisp disc";
  - M42 at Bortle 7 gets `clusterNebulaFaint`;
  - NGC 7000 gets `nebulaBright`;
  - 47 small galaxies near 11 mag (NGC 4889 …) get `galaxyBright` at Bortle 4 / 150 mm.

  D-6 therefore samples these cases, and Phase 1 may change the rule from sources.
- **Module boundaries.**
  - `telescopeLimitingMag` is exported from `score.ts`, not from the barrel. The new engine file imports it from `./score`.
  - `en.ts` is "Island-safe: no imports" (`en.ts:10`), so it cannot import `ExpectationKey` (review F4).
- **Smoke marker form** (review F1). Astro renders a static `<p data-expect>` as the bare attribute `data-expect`, and `data-expect-locked` contains that substring. Smoke's `body.includes` checks therefore need a valued marker, `data-expect="<key>"`, and must match on `data-expect="`.
- **Playwright filters by path** (review F6). In this worktree the path contains `what-to-expect`, so `npx playwright test what-to-expect` selects the whole suite. Name the spec file instead.

## What We're NOT Doing

- **No new line for planets or the Moon.** Their fixed notes stay as they are and stay free (FR-045: shipped before v3). The finder chart reuses the planet note (D-9).
- **No Moon input to the line** (D-4). The line describes the object from the site in the user's telescope on a moonless night. Tonight's Moon is already in each row's reason line and in the washed-out rule.
- **No line on the dashboard tile, the Session plan, the washed-out rows or the live sky's markers.**
- **No edit to S-07's files:** `build.ts`, `load.ts`, `island.ts`, `TonightView`, `TONIGHT_PAGES`, `copies.ts`, `sw.ts`, the dashboard components, `tonight-phone.spec.ts`, `tonight-dashboard.spec.ts`, `no-console-guard.test.ts` or `src/lib/engine/fixtures/index.ts` (D-7, D-10, O-2).
- **No plan-loss drop for stored Targets pages** (O-2 = A).
- **No new data source, migration, table or log line.** No telescope type or obstruction.
- **No observer calibration.** The rule is judged against a committed, source-cited reference (D-6, roadmap Open Roadmap Question 1).
- **No upsell, pricing or plan badge** (PRD Non-Goals).

## Implementation Approach

The work splits into a pure rule and a gated render.

- **The rule.** The engine gets one pure function, `expectationFor(object, bortle, apertureMm) → ExpectationKey`. It works over the existing sky and brightness helpers, with its candidate numbers in a new `EXPECT_*` block of `parameters.ts`. It is pinned by property tests (monotonic in sky and aperture, total over the catalogue) and by a source-cited reference fixture that includes the known hard cases.
- **The wording.** It lives in one `tonight.expect` sub-object of the i18n catalogue, keyed by the same strings as `ExpectationKey`.
- **The render.**
  - The Targets island and the finder loader, which already hold the site, the telescope and the plan read, compute the key server-side only for a confirmed full plan. They pass `{ key, text }` down as a prop.
  - The plan-blind `TonightView` never carries it, so a free account's HTML cannot leak it.
  - Every file S-07 changes is avoided, except the shared catalogue, `parameters.ts`, `engine/index.ts`, `/design` and the docs. In those, this change's blocks sit at named places away from S-07's.
- **Proof follows the gate.** The Targets gate's smoke and e2e land in Phase 2 with the gate itself.

## Decisions taken in this run

These are delegated (team-owned): decided here, and changed by editing the parameter or the plan.

- **D-1 Scope.** The gated line covers ranked Messier and Caldwell objects. Planets and the Moon keep their free notes. FR-038's inputs (type, size, brightness against sky quality) are deep-sky terms, and the planet notes already say what a 100-200 mm telescope shows (`en.ts:623`).
- **D-2 The rule** (OQ17). These are the starting candidates; Phase 1 may change them per D-6, and the outcome is recorded in D-6. All numbers live in `parameters.ts` under `EXPECT_*`. Inputs are `Pick<DeepSkyObject, "type" | "vMag" | "majorAxisArcmin" | "minorAxisArcmin">`, `bortle` (1-9) and `apertureMm`.
  - **Contrast deficit:**

    `d = effectiveSurfaceBrightness(object) − darkSkyZenithMagForBortle(bortle) − EXPECT_APERTURE_GAIN_MAG × log2(apertureMm / EXPECT_REFERENCE_APERTURE_MM)`

    The candidates are 0.5 mag per doubling and 150 mm. A larger aperture takes more magnification at the same exit pupil, and a larger image of the same surface brightness is easier to see. A smaller aperture shifts the other way.

    If `d` is null (no major axis), the raw band is `smudge`: a middle band that makes no claim. Only M40 and M73 have no major axis, and their types have fixed phrases anyway.
  - **Raw band** from `d`:

    | Raw band | Condition |
    |---|---|
    | `bright` | d < `EXPECT_BRIGHT_BELOW` (0.5) |
    | `smudge` | d < `EXPECT_SMUDGE_BELOW` (1.5) |
    | `faint` | d < `EXPECT_FAINT_BELOW` (2.5) |
    | `limit` | otherwise |

  - **Near-limit floor.** When `vMag > telescopeLimitingMag(bortle, apertureMm) − EXPECT_NEAR_LIMIT_MAG` (1.0), the band is at least `faint`.
  - **`contrastBand`** returns the band *after* the floor, and the monotonicity test checks that value (review F6).
  - **Key by type** (starting table):
    - **galaxy:** `galaxyBright` / `galaxySmudge` / `galaxyFaint` / `galaxyLimit`, by band.
    - **nebula, emission-nebula, reflection-nebula, supernova-remnant:** `bright` → `nebulaBright`, `smudge` → `nebulaGlow`, `faint` or `limit` → `nebulaFaint`.
    - **planetary-nebula:** `majorAxisArcmin < EXPECT_STARLIKE_ARCMIN` (0.5) → `planetaryStarLike`. Otherwise `bright` or `smudge` → `planetaryDisc`, and `faint` or `limit` → `planetaryFaint`.
    - **cluster-with-nebula:** `bright` → `clusterNebulaBright`, else `clusterNebulaFaint`.
    - **globular-cluster:**
      - `globularResolved` when `apertureMm ≥ EXPECT_RESOLVE_APERTURE_MM` (150), `vMag ≤ EXPECT_RESOLVE_MAX_VMAG` (7.0) and the band is `bright` or `smudge`;
      - else `globularGrainy` when `apertureMm ≥ EXPECT_GRAINY_APERTURE_MM` (100), `vMag ≤ EXPECT_GRAINY_MAX_VMAG` (8.0) and the band is not `limit`;
      - else `globularGlow`.
    - **open-cluster:**
      - `openClusterWide` when `majorAxisArcmin ≥ EXPECT_WIDE_ARCMIN` (60);
      - else `openClusterHazy` when the band is `faint` or `limit`;
      - else `openClusterCompact` when `majorAxisArcmin ≤ EXPECT_COMPACT_ARCMIN` (10);
      - else `openClusterScattered`.
    - **asterism → `asterism`, double-star → `doubleStar`, other → `other`** (M24, M40 and M73, one each).
  - **Total: 22 keys.**
  - **Permitted rule changes in Phase 1** (review F2). Each needs a source from the fixture, and each is recorded in D-6 with its new parameter:
    - (a) Globular thresholds that grow with aperture, e.g. `vMag ≤ telescopeLimitingMag − EXPECT_RESOLVE_MARGIN_MAG`, replacing the fixed 7.0 / 8.0. This addresses M56 and M9 at 200 mm and up.
    - (b) A large-planetary branch: `majorAxisArcmin ≥ EXPECT_LARGE_PLANETARY_ARCMIN` and `d ≥ EXPECT_LARGE_PLANETARY_DISC_BELOW` → `planetaryFaint`, with its phrase reworded toward low power. This addresses Helix and the Owl, not the Dumbbell.
    - (c) A brightness override for `cluster-with-nebula` and the nebula types: `vMag ≤ EXPECT_BRIGHT_NEBULA_MAX_VMAG` lifts the band one step. This addresses M42 under a city sky.
    - (d) A cap on `galaxyBright`: only when `vMag ≤ telescopeLimitingMag − EXPECT_BRIGHT_GALAXY_MARGIN_MAG`. This addresses small galaxies near 11 mag.
    - (e) A size cap on `nebulaBright` (`majorAxisArcmin ≥ EXPECT_HUGE_NEBULA_ARCMIN` → at most `nebulaGlow`). This addresses NGC 7000.

    A change may reword a phrase. It adds no key unless the owner agrees: a 23rd key needs an owner decision because it is new user-facing copy.
  - **Why this shape:** OQ17's three inputs, through the engine's own sky model and brightness formula, so the line stays in the same family as the ranking's washed-out rule (see Key Discoveries for where they differ). Size enters through the surface brightness and the size thresholds.
- **D-3 Invariants pinned by tests.**
  - The rule is total over the catalogue: every object, Bortle 1-9 and apertures 20-1000 mm give a key.
  - It is deterministic.
  - The band after the floor (`contrastBand`) never brightens at a worse sky and never fades at a bigger aperture, for every catalogue object.
  - Globular resolution never regresses as aperture grows.
  - Every key in `EXPECTATION_KEYS` has a non-empty phrase in EN and PL (a unit test). TypeScript catches a missing EN key where `expectationText` indexes the catalogue with an `ExpectationKey`, and `pl satisfies Messages` keeps PL in step (review F4).
  - All of this still holds after any D-2 change from Phase 1.
- **D-4 No Moon.** The line is a property of object, site and telescope, stable from night to night like the gear itself. The Moon already speaks through the reason line and the washed-out rule. Mixing it in would make the same object read differently on two nights for a reason the row already states.
- **D-5 Where the line renders.**
  - On Targets, it is the first element of `ObjectDetails`' content in `TargetDetails`' slot: below the window and best-time `<dl>`, above the eyepiece pair (`TargetDetails.astro:44-61`).
    - It is `<p data-expect={key}>` in `text-label text-foreground`, with a lucide `Eye` icon (`aria-hidden`).
    - The sentence stands alone, with no "What to expect:" prefix.
    - In `ObjectRow` it shows when the row is expanded, like the rest of the details.
  - On the finder chart, it is one `<p data-expect={key}>` between the page sky and the chart (`FinderContent.astro`, chart state). A planet's key is its planet key, e.g. `data-expect="jupiter"`.
  - The free line is `<p data-expect-locked>`. Its attribute name never contains `data-expect="` (review F1).
- **D-6 Calibration without an observer** (roadmap Open Roadmap Question 1, finder-chart D-11 template; extended per review F2 and F8).
  - The fixture `src/lib/engine/fixtures/expect-reference.ts` holds two kinds of entry. Each needs the key a published small-telescope description supports at the entry's setting, with at least 2 sources (title, publisher, URL, access date), read in Phase 1 before the comparison.
  - **Showcase entries** (150 mm, Bortle 4 unless stated): M13, M3, M57, M27, NGC 7662, M31, M33 (also at Bortle 7), M51, M81, M101 (also at Bortle 7), M42, M45 and M11.
  - **Hard cases** from the review's recomputation:
    - M42 at Bortle 7 / 150 mm;
    - M56 at 200 mm / Bortle 4;
    - NGC 7293 (Helix) and M97 at 150 mm / Bortle 4;
    - NGC 7000 at 150 mm / Bortle 4;
    - NGC 4889 (or another `galaxyBright` galaxy near 11 mag) at 150 mm / Bortle 4;
    - M33 at Bortle 9 / 150 mm, which pins the `limit` band for a ranked object with d ≥ 3.5.
  - **Order of work:**
    1. Gather all sources.
    2. Compare against the starting rule.
    3. For each mismatch, either apply a permitted change from D-2 that a source supports, or list the entry in `KNOWN_DIVERGENCES` with its computed key and reason.
    4. Re-run the D-3 invariants.

    The fixture is never edited to pass.
  - **More than 3 remaining divergences** stop Phase 1 and go to the owner with the list.
  - The outcome (changes applied, divergences left) is written here before Phase 1 closes.
  - **Outcome (Phase 1, 2026-10-14).** The fixture has 22 entries, each with at least 2 sources. 14 matched the starting rule. Five sourced changes were applied:
    - **(a)** `EXPECT_RESOLVE_MARGIN_MAG` 5.75 and `EXPECT_GRAINY_MARGIN_MAG` 4.75 below `telescopeLimitingMag` replace the fixed 7.0 / 8.0. They are equal to the old values at 150 mm / Bortle 4. M56 at 200 mm becomes `globularGrainy`.
    - **(b)** `EXPECT_LARGE_PLANETARY_ARCMIN` 3 and `EXPECT_LARGE_PLANETARY_DISC_BELOW` −1.5: the Helix and the Owl become `planetaryFaint`, and the Dumbbell stays `planetaryDisc`.
    - **(c)** `EXPECT_BRIGHT_NEBULA_MAX_VMAG` 4.5, applied as an override to `cluster-with-nebula` only. A one-step lift could not reach `clusterNebulaBright` from `faint`, and applying it to the nebula types would undo (e). Only M42 qualifies, and M42 at Bortle 7 becomes `clusterNebulaBright`.
    - **(d)** `EXPECT_BRIGHT_GALAXY_MARGIN_MAG` 5: a galaxy in the `bright` band is `galaxyBright` only when at least 5 mag above the limit. M51 becomes `galaxySmudge` (sources: a hazy spot with a slightly brighter centre), and M81 stays `galaxyBright`.
    - **(e)** `EXPECT_HUGE_NEBULA_ARCMIN` 100: a nebula of 100′ or more is at most `nebulaGlow`.

    **Known divergences: 2 (≤ 3, no stop).**
    - NGC 7000 at 150 mm / Bortle 4: expected `nebulaFaint`, computed `nebulaGlow`. Cap (e) stops at `nebulaGlow`.
    - NGC 4889 at 150 mm / Bortle 4: expected `galaxyFaint`, computed `galaxySmudge`. Reaching it needs `EXPECT_NEAR_LIMIT_MAG` ≈ 1.5, a retune not in the permitted list.

    Phase 2 rewords `planetaryFaint` toward low power (Helix, Owl) and widens `planetaryDisc` (the Dumbbell is not small). Several sources were read from search summaries only (403 errors); each entry's note says which.
- **D-7 Server-side, plan-first, outside `TonightView`.**
  - `TargetsPageContent` turns its `void getAccountPlan(...)` into a promise awaited after the Tonight load. The read is the same single memoised query and still overlaps the load.
  - With a confirmed `full` plan, and both `load.site` and `load.telescope` defined (a type guard; the view exists only then), it computes `{ key, text }` per entry through the server helper. It passes `expectation: { key: ExpectationKey; text: string } | null` to `ObjectCard` / `ObjectRow` → `ObjectDetails`.
  - The free line follows D-13.
  - `loadFinderFor`'s `chart` result gains `expectation: { key: string; text: string } | null` (the plan is already proven there).
  - The shell passes no plan prop. Islands replay at `/_server-islands/*` without the shell, so each island decides for itself.
- **D-8 Server helper.** New `src/lib/tonight/expectation.ts`, a server module (it imports `@/lib/catalogue`). It has three functions:
  - `expectationKeyFor(id, bortle, apertureMm) → ExpectationKey | null` (null for an id the catalogue does not list);
  - `expectationText(key, messages)`;
  - `expectationView(access: AccountPlan, read: PlanRead) → "lines" | "locked" | "none"` (D-13).
- **D-9 Planets on the finder chart.** The chart state shows the planet's `entry.note` from `view.solarSystem.entries`. It is already translated at `build.ts:855`, and the loader recognises a planet with `isPlanetKey(target)`. That text is already free on `/tonight/planets`, so showing it behind the plan gate leaks nothing (review F9).
- **D-10 Placement in shared files** (review F3).
  - The `EXPECT_*` block goes right after `WASHED_OUT_TYPES` (`parameters.ts:385-393`), inside the moonlight section, not at the end of the file where S-07's `EVENT_*` block is.
  - The barrel export goes on the line after the `./moonlight` export (`src/lib/engine/index.ts:21`), not at the end where S-07's `events` block is.
  - `tonight.expect` goes right after the `tonight.finder` block (`en.ts:879-956`), mirrored in `pl.ts`, away from S-07's `tonight.events` / `tonight.summary.events` / `tonight.pages.events`.
  - The `/design` section goes after the FinderChart block.
  - The CLAUDE.md paragraph goes after the finder-chart paragraph.

  Any remaining conflict (the roadmap's `updated:` line) is a trivial rebase.
- **D-11 Proof of the gate** (review F1, F6, F7). `scripts/smoke.mjs` gains three Targets-island steps plus one assertion:
  - free (Phase 2): the island HTML includes `data-expect-locked` and excludes `data-expect="`;
  - full (Phase 2): it includes `data-expect="`;
  - leaked island URL after sign-out (Phase 4): it excludes both `data-expect="` and `data-expect-locked` (it renders nothing);
  - `finder 3` additionally includes `data-expect="` (Phase 3).

  Mechanics:
  - `islandUrlFromShell` is generalised to take the island path (`smoke.mjs:127`), and the Targets island URL is captured from the `/tonight/targets` shell.
  - The two ranked steps take `finder 3`'s `inNoDarknessWindow` skip note. The run requires the all-clear forecast fixture, as CI uses (`ci.yml:51-61`): under a weather no-go the ranking is null (`build.ts:445`) and the steps would fail.
- **D-12 No new log, no coordinates.** The helper and the rule cannot fail on catalogue input (D-3 makes the rule total). No `try`/`catch` and no allowlisted disable: `ALLOWED_DISABLES`, which S-07 edits, stays as it is.
- **D-13 A failed plan read shows neither line** (review F5; delegated to this agent by the orchestrator).
  - Access uses `getAccountPlan === "full"`, which fails closed.
  - Display uses `accountPlanForCopy(locals).plan`, the same memoised read:
    - the free line renders only on an explicit `free`;
    - on `unknown`, the island renders neither the lines nor the free line. A paying user is never told they lack the plan because of a transient error.
  - This matches how `data-plan="unknown"` neither stores nor drops finder charts (finder-chart D-14).
  - `expectationView` is pure and unit-tested over the three reads.

## Owner decisions (answered 2026-10-14)

- **O-1 What a free account sees on Targets = A.** One muted line with a lucide `Lock` icon under the Targets count line (`data-expect-locked`), shown once per page when the ranking has rows and the plan read is `free` (D-13). The copy: "Full plan: each target also says what it will look like in your telescope from your site, such as "A faint grey smudge with a slightly brighter middle."" No locked line in the rows.
- **O-2 A lost plan and stored Targets pages = A.** A stored `/tonight/targets` copy rendered on the full plan keeps its lines until one of these happens:
  - the next online visit to that page replaces it (a free island commits the same key);
  - its next-night copy refreshes;
  - it expires 36 h after its site's last refresh (`copies.ts:39`).

  There is no `copies.ts` change. The text is derived from public catalogue data and the user's own gear.

## Phase 1: The rule (engine, parameters, reference)

### Overview

A pure, tested `expectationFor`, its candidate numbers, and the source-cited reference with the hard cases. This phase is test-first (D-3, D-6).

### Changes Required:

#### 1. Parameters

**File**: `src/lib/engine/parameters.ts`

**Intent**: Add one documented `EXPECT_*` block of candidates right after `WASHED_OUT_TYPES` (D-10), each with a one-line why and the date: `EXPECT_REFERENCE_APERTURE_MM`, `EXPECT_APERTURE_GAIN_MAG`, `EXPECT_BRIGHT_BELOW`, `EXPECT_SMUDGE_BELOW`, `EXPECT_FAINT_BELOW`, `EXPECT_NEAR_LIMIT_MAG`, `EXPECT_STARLIKE_ARCMIN`, `EXPECT_RESOLVE_APERTURE_MM`, `EXPECT_RESOLVE_MAX_VMAG`, `EXPECT_GRAINY_APERTURE_MM`, `EXPECT_GRAINY_MAX_VMAG`, `EXPECT_WIDE_ARCMIN`, `EXPECT_COMPACT_ARCMIN`, plus any D-2 change from D-6.

**Contract**: The starting values are those in D-2. Nothing else in the file is touched.

#### 2. The rule

**File**: `src/lib/engine/expectation.ts` (new), exported from `src/lib/engine/index.ts` on the line after the `./moonlight` export (D-10)

**Intent**: Classify how a deep-sky object looks into one of the 22 keys by D-2's band (after the near-limit floor) and type table.

**Contract**:
- `export type ExpectationKey` is the 22-member string union of D-2 (camelCase).
- `export const EXPECTATION_KEYS: readonly ExpectationKey[]`.
- `export type ContrastBand = "bright" | "smudge" | "faint" | "limit"`.
- `export function contrastBand(object, bortle, apertureMm): ContrastBand`, the band after the floor.
- `export function expectationFor(object, bortle, apertureMm): ExpectationKey`.

`object` is `Pick<DeepSkyObject, "type" | "vMag" | "majorAxisArcmin" | "minorAxisArcmin">`. The module imports `telescopeLimitingMag` from `./score` and `effectiveSurfaceBrightness` from `./moonlight`. It never reads the clock, the environment, the network or the filesystem (`purity.test.ts` covers it).

#### 3. Tests

**File**: `src/lib/engine/expectation.test.ts` (new)

**Intent**: Pin D-3 and the type table.
- Every `DEEP_SKY` object × Bortle 1-9 × apertures {20, 60, 80, 100, 130, 150, 200, 300, 1000} gives a member of `EXPECTATION_KEYS`.
- `contrastBand` (after the floor) never brightens as Bortle grows and never fades as aperture grows, for every object.
- `globularResolved` → `globularGrainy` → `globularGlow` never regresses with aperture.
- The table boundaries:
  - a planetary nebula under 0.5′ is star-like;
  - an open cluster of 60′ is wide;
  - the near-limit floor applies;
  - the null-axis objects M40 and M73 take their fixed keys;
  - `EXPECTATION_KEYS` has 22 entries.
- Every key is reachable by some catalogue object at some setting. An unreachable key fails the test and is either removed or justified.

#### 4. Reference fixture

**File**: `src/lib/engine/fixtures/expect-reference.ts` (new; not added to `fixtures/index.ts`, which S-07 edits) and its test in `expectation.test.ts`

**Intent**: Calibrate without an observer, with the hard cases (D-6).
- The header follows `finder-reference.ts`: TEST-ONLY, the settings, how the sources were read, and "a failing reference is an engine finding, never a fixture edit".
- Sources come from WebSearch/WebFetch summaries, with the access date. Outbound requests carry no personal data: they use the repo URL as the contact.

**Contract**: `EXPECT_REFERENCES: { id; apertureMm; bortle; kind: "showcase" | "hard"; expected: ExpectationKey; sources: { title; publisher; url; accessed }[]; note }[]` and `KNOWN_DIVERGENCES` (same shape plus `computed` and `reason`).

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/engine/expectation.test.ts` passes, including the reference fixture.
- `npm test` passes (purity test included).
- `npm run lint` and `npx astro check` pass.
- A deliberate break (flip the sign of the `EXPECT_APERTURE_GAIN_MAG` term in `contrastBand`) turns the aperture monotonicity test red. Revert it afterwards.

#### Manual Verification:

- The reference fixture has all showcase and hard-case entries of D-6, each with at least 2 sources. At most 3 known divergences remain, each with a reason. D-6's outcome is written in this plan.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Copy, the Targets rows behind the plan, and their proof

### Overview

This phase delivers:
- the 22 phrases in EN and PL;
- the server helper;
- the gated line on every ranked row and the free line;
- `/design` specimens;
- the Targets gate's smoke steps and e2e tests, which land with the gate (review F7).

### Changes Required:

#### 1. Copy

**Files**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Add `tonight.expect` right after `tonight.finder` (D-10), with these entries:
- `phrase` (one sentence per key, below; reworded per any D-2 change);
- `locked` (the O-1 copy);
- `lockedFinderLine` ("Says what the object will look like in your telescope from your site.").

The English phrases (candidates; the owner reads them in `/design`, Phase 2 manual check):

| Key | English |
|---|---|
| `globularResolved` | A ball of stars: at high power the edges break into pinpoints while the core stays a bright glow. |
| `globularGrainy` | A round glow, brighter in the middle; at high power its edges look grainy, about to break into stars. |
| `globularGlow` | A small round glow, brighter in the middle, like an out-of-focus star. |
| `openClusterWide` | A wide spray of stars, bigger than most eyepiece fields: use your lowest power. |
| `openClusterCompact` | A small, tight knot of stars; more appear as your eye settles. |
| `openClusterScattered` | A loose group of stars of different brightness, clearly separate against the sky. |
| `openClusterHazy` | A few brighter stars over a faint haze of fainter ones. |
| `planetaryStarLike` | Looks like a star at low power; at high power it shows as a tiny, slightly fuzzy disc. |
| `planetaryDisc` | A small, crisp grey-green disc or ring that takes high power well. |
| `planetaryFaint` | A faint round glow; use averted vision and moderate power. |
| `galaxyBright` | An oval glow with a bright centre, easy to see straight on. |
| `galaxySmudge` | A faint grey smudge with a slightly brighter middle. |
| `galaxyFaint` | A very faint grey smudge; use averted vision. |
| `galaxyLimit` | At the edge of what your sky allows: a ghostly patch you may glimpse only with averted vision. |
| `nebulaBright` | A bright cloud of glowing gas with a clear shape and structure. |
| `nebulaGlow` | A soft, misty glow with an irregular shape. |
| `nebulaFaint` | A very faint mist; use averted vision and your lowest power. |
| `clusterNebulaBright` | Bright stars wrapped in a glowing cloud with clear structure. |
| `clusterNebulaFaint` | A group of stars inside a faint haze; averted vision shows more of the glow. |
| `asterism` | A rich patch of the Milky Way crowded with faint stars; best at your lowest power. |
| `doubleStar` | Two faint stars close together, and nothing more. |
| `other` | A small group of a few faint stars. |

**Contract**: `phrase` is a plain literal: `en.ts` stays import-free (D-3, review F4). `pl.ts` mirrors it (`satisfies Messages` plus the parity test). Polish is written to the same register as `tonight.planets.note`.

#### 2. Server helper

**File**: `src/lib/tonight/expectation.ts` (new) plus `expectation.test.ts`

**Intent**: D-8 and D-13. Look the object up with `findDeepSky(id)` and call `expectationFor`. Return null for an id the catalogue does not list. Decide the view from the two plan reads.

**Contract**:
- `expectationKeyFor(id: string, bortle: number, apertureMm: number): ExpectationKey | null`
- `expectationText(key: ExpectationKey, messages: Messages): string`, which indexes `messages.tonight.expect.phrase[key]`
- `expectationView(access: AccountPlan, read: PlanRead): "lines" | "locked" | "none"`, where `full` → `lines`, `free` read → `locked` and `unknown` → `none`

The tests cover:
- a known id, an unknown id (`NGC1`), and the phrase in both locales;
- every `EXPECTATION_KEYS` entry has a non-empty phrase in EN and PL;
- the three `expectationView` cases.

#### 3. Targets island and rows

**Files**: `src/components/tonight/TargetsPageContent.astro`, `ObjectCard.astro`, `ObjectRow.astro`, `ObjectDetails.astro`

**Intent**: D-7, D-5 and D-13.
- The island keeps the plan read's promise and awaits it after the Tonight load.
- It guards `load.site` and `load.telescope`.
- On `lines` it maps each entry's id to `{ key, text }`. On `locked` with at least one ranked row it renders the O-1 line under the count line. On `none` it renders neither.
- `ObjectCard` / `ObjectRow` pass the optional `expectation` through to `ObjectDetails`, which renders it first in its content.

**Contract**:
- `ObjectDetails`, `ObjectCard` and `ObjectRow` gain `expectation?: { key: ExpectationKey; text: string } | null`. Absent means no line.
- Markers: `data-expect={key}` on the row line and `data-expect-locked` on the free line.
- Tokens only; the line wraps at 320 px.
- No change to `TonightEntry`, `loadTonightFor` or the shell `targets.astro`.

#### 4. Kitchen sink

**File**: `src/pages/design.astro`

**Intent**: A new "What to expect (Targets rows)" section after the FinderChart block (D-10):
- every phrase in the current locale (a list from `EXPECTATION_KEYS`);
- one `ObjectDetails` specimen with the line, built on a hand-made `TonightEntry`, since `/design` has no `ObjectDetails` specimen today (review F9);
- the locked line.

**Contract**: A separate section with unique ids.

#### 5. Smoke steps for the Targets gate

**File**: `scripts/smoke.mjs`

**Intent**: D-11's free and full steps:
- the free step goes before `finder 2` (the grant), the full step after `finder 3` and before the demotion;
- `islandUrlFromShell` is generalised to take the island path;
- the Targets island URL is captured from the `/tonight/targets` shell;
- both steps take the `inNoDarknessWindow` skip note and `needsPlanGrant` where the grant is needed.

**Contract**:
- free: include `data-expect-locked`, exclude `data-expect="`;
- full: include `data-expect="`.

#### 6. Browser spec (Targets)

**File**: `tests/e2e/what-to-expect.spec.ts` (new)

**Intent**: Uses `onboardInMadrid`, `requirePlanGrant` and `setPlan`, and has three tests:
- **Free:** Targets shows `[data-expect-locked]` once and no `[data-expect]`.
- **Full:** the first `ObjectCard`'s `[data-expect]` text is one of `en.tonight.expect.phrase`'s values.
- **At 320 px with a full plan, in both EN and PL** (a locale loop like `tonight-phone.spec.ts`; that spec itself is not touched, review F10): Targets has no sideways scroll with the details of the best five open.

The ranked tests skip in the no-darkness window, as the finder spec does.

**Contract**: The assertions go through the markers and the catalogue values, never literal English.

### Success Criteria:

#### Automated Verification:

- `npm test` passes (i18n parity and the helper tests included).
- `npm run lint` and `npx astro check` pass.
- `npm run build` succeeds.
- `npm run smoke` passes with 0 skipped steps. It runs against a local preview on port 4331, built with `FORECAST_BASE_URL` of the all-clear fixture on 4401 in `dist/server/.dev.vars`, with the local stack's `SUPABASE_URL` and `SUPABASE_SECRET_KEY` inline.
- `npx playwright test tests/e2e/what-to-expect.spec.ts` passes with 0 skipped, under the same fixture and inline key.
- `npx playwright test tests/e2e/tonight-targets.spec.ts tests/e2e/tonight-phone.spec.ts tests/e2e/offline.spec.ts` passes.
- A deliberate break (render the lines when `expectationView` is `locked`) turns the smoke free step red. Revert it afterwards.

#### Manual Verification:

- On `/design`, EN and PL: the owner reads all phrases and the locked line, and approves the wording or edits it.
- On `/tonight/targets` with a full-plan account: each ranked row shows the eye line, and switching to a telescope of very different aperture changes at least one line.
- With a free account: the locked line shows once and no row shows a phrase.
- 360 px: nothing scrolls sideways, in all three themes.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: The finder chart line

### Overview

US-05's third clause: the chart says what the object will look like (D-5, D-9). The locked explainer says that it will.

### Changes Required:

#### 1. Finder loader

**File**: `src/lib/finder/load.ts`

**Intent**: The `chart` result carries `expectation: { key; text } | null`, computed after the existing plan guard and only in the chart branch:
- for a deep-sky object: `expectationKeyFor(target, site.bortle, telescope.apertureMm)`, translated in the loader's locale (`load.ts:135`);
- for a planet (`isPlanetKey(target)`): `{ key: target, text: entry.note }` from the view's planet entry (D-9).

**Contract**: `FinderLoad`'s `chart` variant gains `expectation`. No other variant changes.

#### 2. Finder page and locked explainer

**Files**: `src/components/finder/FinderContent.astro`, `src/components/finder/FinderLocked.astro`

**Intent**:
- The chart state renders `<p data-expect={key}>` with the `Eye` icon above the chart when `expectation` is non-null.
- `FinderLocked` gains the fourth bullet, `tonight.expect.lockedFinderLine`.
- The free example (`EXAMPLE_FINDER_CHART`) shows no line.

**Contract**: The `data-finder-chart` root and `data-finder-state` stay as they are. The `/design` FinderChart block is unchanged apart from FinderLocked's new bullet.

#### 3. Tests and proof

**Files**: `src/lib/finder/load.test.ts` (extend; it already builds chart states, `:141-170`), `scripts/smoke.mjs`, `tests/e2e/what-to-expect.spec.ts`

**Intent**:
- A chart for a deep-sky object carries its key and phrase, and a chart for a planet carries the planet note.
- `finder 3` also includes `data-expect="` (D-11).
- The spec gains a test: M13's finder chart shows a `[data-expect]` whose text is one of the globular phrases.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint` and `npx astro check` pass.
- `npm run build` succeeds.
- `npm run smoke` passes with 0 skipped steps, under the Phase 2 setup.
- `npx playwright test tests/e2e/what-to-expect.spec.ts tests/e2e/finder-chart.spec.ts` passes with 0 skipped.

#### Manual Verification:

- A full-plan finder chart for M13 and for a ranked galaxy shows the line above the chart. A planet's chart shows its note.
- A free account's finder page lists the fourth bullet.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: The leaked island, docs and the whole suite

### Overview

This phase covers the signed-out island step (D-11), the docs, and the whole suites run the way CI runs them.

### Changes Required:

#### 1. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: The leaked-URL step after sign-out, beside `finder 6`: the captured Targets island URL excludes both `data-expect="` and `data-expect-locked`.

**Contract**: The same `needsPlanGrant` as `finder 6`.

#### 2. Docs

**Files**: `CLAUDE.md` (a short "What to expect (M-3 S-04)" paragraph after the finder-chart paragraph), `context/foundation/roadmap.md` (S-04 status)

**Intent**: Record the following:
- the rule's home (`expectation.ts`) and its `EXPECT_*` candidates;
- the reference fixture and its hard cases;
- the server-side, plan-first render outside `TonightView`;
- the `unknown` read showing neither line;
- the markers (`data-expect="<key>"`, `data-expect-locked`);
- O-2 (no plan-loss drop for Targets copies).

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint` and `npx astro check` pass.
- `npm run build` succeeds.
- `npm run smoke` passes with 0 skipped steps, under the Phase 2 setup, including the leaked-URL step.
- A deliberate break (drop the plan check in `TargetsPageContent`) turns the smoke free step red. Revert it afterwards.
- The whole e2e suite (`npm run test:e2e`) passes locally the way CI runs it, with the fixture and the inline key (lessons: run the whole suite before a PR).

#### Manual Verification:

- The owner checks the Targets page and a finder chart on a phone (full plan), and the free line on a free account.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- **Rule:** total over the catalogue, deterministic, monotonic in sky and aperture on the band after the floor, type-table boundaries, null axes, every key reachable (`expectation.test.ts`).
- **Reference:** the source-cited fixture with its showcase and hard cases and known divergences (D-6).
- **Helper:** known and unknown ids, both locales, every key phrased, and the three plan-read views.
- **Finder loader:** a deep-sky chart carries the phrase and a planet chart carries the note.

### Integration Tests:

- **Smoke over HTTP:** the Targets island free and full (Phase 2), `finder 3` (Phase 3), the leaked island (Phase 4).
- **e2e:** the free line, the full lines, 320 px in EN and PL (Phase 2), and the finder line (Phase 3).

### Manual Testing Steps:

1. In `/design`, read all phrases in EN and PL.
2. With a full-plan account, open Targets and expand a row of the rest. Switch telescope and compare the lines.
3. Open the finder chart for M13, a galaxy and a planet.
4. With a free account, open Targets and the locked finder page.

## Performance Considerations

There is one catalogue lookup and a few arithmetic operations per ranked row (up to the 171 objects) on the server, and no extra query (both plan reads are the same memoised query). The page weight grows by one sentence per row.

## Migration Notes

None. There is no schema, data or worker change.

## References

- Research: `context/changes/what-to-expect/research.md`
- Plan review: `context/changes/what-to-expect/reviews/plan-review.md`
- PRD: `context/foundation/prd.md:174-189` (US-05), `:446` (FR-038), `:461` (FR-045), `:734-737` (OQ17)
- Template for gating: `src/lib/finder/load.ts:102`, `src/components/finder/FinderLocked.astro`, `scripts/smoke.mjs:127, 238-313`
- Template for calibration: `src/lib/engine/fixtures/finder-reference.ts`, finder-chart plan D-11
- Parallel change: `.claude/worktrees/sky-events/context/changes/sky-events/plan.md`, commit `e57dadf`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The rule (engine, parameters, reference)

#### Automated

- [x] 1.1 `npx vitest run src/lib/engine/expectation.test.ts` passes, including the reference fixture — 4b83028
- [x] 1.2 `npm test` passes (purity test included) — 4b83028
- [x] 1.3 `npm run lint` and `npx astro check` pass — 4b83028
- [x] 1.4 Deliberate break (sign of the aperture term in `contrastBand`) turns the aperture monotonicity test red, then reverted — 4b83028

#### Manual

- [x] 1.5 Reference fixture has all D-6 showcase and hard-case entries with ≥ 2 sources each, ≤ 3 known divergences with reasons, and D-6's outcome recorded — 54cee2b

### Phase 2: Copy, the Targets rows behind the plan, and their proof

#### Automated

- [x] 2.1 `npm test` passes (i18n parity and helper tests included) — 7119669
- [x] 2.2 `npm run lint` and `npx astro check` pass — 7119669
- [x] 2.3 `npm run build` succeeds — 7119669
- [x] 2.4 `npm run smoke` passes with 0 skipped (all-clear fixture, inline local key) — 7119669
- [x] 2.5 `npx playwright test tests/e2e/what-to-expect.spec.ts` passes with 0 skipped — 7119669
- [x] 2.6 `tonight-targets`, `tonight-phone` and `offline` specs pass — 7119669
- [x] 2.7 Deliberate break (lines rendered on `locked`) turns the smoke free step red, then reverted — 7119669

#### Manual

- [ ] 2.8 Owner reads all phrases and the locked line on `/design` in EN and PL and approves or edits them
- [x] 2.9 Full-plan Targets rows show the eye line and a different-aperture telescope changes at least one line — 54cee2b
- [x] 2.10 Free account sees the locked line once and no phrase — 54cee2b
- [x] 2.11 360 px: no sideways scroll in all three themes — 54cee2b

### Phase 3: The finder chart line

#### Automated

- [x] 3.1 `npm test`, `npm run lint` and `npx astro check` pass — 91679f5
- [x] 3.2 `npm run build` succeeds — 91679f5
- [x] 3.3 `npm run smoke` passes with 0 skipped, including the `finder 3` expectation check — 91679f5
- [x] 3.4 `what-to-expect` and `finder-chart` specs pass with 0 skipped — 91679f5

#### Manual

- [x] 3.5 Full-plan finder chart shows the line for M13 and a galaxy, and a planet's chart shows its note — 54cee2b
- [x] 3.6 Free account's finder page lists the fourth bullet — 54cee2b

### Phase 4: The leaked island, docs and the whole suite

#### Automated

- [x] 4.1 `npm test`, `npm run lint` and `npx astro check` pass — 193811f
- [x] 4.2 `npm run build` succeeds — 193811f
- [x] 4.3 `npm run smoke` passes with 0 skipped, including the leaked-URL step — 193811f
- [x] 4.4 Deliberate break (no plan check in `TargetsPageContent`) turns the smoke free step red, then reverted — 193811f
- [x] 4.5 The whole e2e suite passes locally the way CI runs it — 193811f

#### Manual

- [x] 4.6 Owner checks Targets and a finder chart on a phone (full plan) and the free line on a free account — 54cee2b
