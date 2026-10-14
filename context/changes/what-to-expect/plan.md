# What to expect (M-3 S-04) Implementation Plan

## Overview

Each ranked deep-sky target gets one plain-language line on what it will look like in the user's own telescope from their site, for example "A very faint grey smudge; use averted vision." The line appears on `/tonight/targets` (every ranked row) and on the target's finder chart.

- It is chosen from a fixed phrase set by a pure engine rule over five inputs: the object's type, size and brightness, the telescope's aperture and the site's sky quality (Bortle).
- It is a full-plan feature (FR-038, FR-045). A free account sees what it does and that it needs the full plan, never an error or an empty state. The server decides which one renders.
- Planets keep their existing free note. The finder chart shows that note for a planet, so US-05's "a line on what the object will look like" holds for every chart.

## Current State Analysis

Full evidence is in `research.md`. Its open questions are settled below as D-1 to D-12 and O-1 to O-2.

- **Data exists, the rule does not.**
  - The catalogue gives every object `type` (12 values), `vMag` and `majorAxisArcmin` (null only for M40 and M73) (`src/lib/catalogue/index.ts:16-58`).
  - The engine already turns these into a core surface brightness (`effectiveSurfaceBrightness`, `src/lib/engine/moonlight.ts:103-112`). It also gives a moonless sky brightness per Bortle class (`darkSkyZenithMagForBortle`, `parameters.ts:316-328`) and a telescope limiting magnitude (`telescopeLimitingMag`, `score.ts:92-94`).
  - Nothing classifies how an object looks.
- **Planets and the Moon already have fixed, free notes.**
  - `tonight.planets.note[key]`, `en.ts:623-632`, built at `build.ts:855`.
  - `tonight.moon.note[band]`, `en.ts:715-730`.
  - Both shipped before v3, so FR-045 keeps them free.
- **One component renders every ranked deep-sky row's details.**
  - That component is `ObjectDetails.astro:21-49`. `ObjectCard` uses it for the best five and `ObjectRow` for the rest, both rendered by `TargetsPageContent.astro:163-169, 221-223`.
  - The island has `load.site.bortle` and `load.telescope.apertureMm` in scope (`src/lib/tonight/load.ts:65-85`).
  - `TonightEntry` carries neither the object's type nor its size (`build.ts:110-143`).
- **Plan reads.**
  - `getAccountPlan(locals)` is memoised per request and returns `free` on a failed read (`src/lib/account-plan/index.ts:54-67`).
  - The Targets island already starts that read for `OfflineCopy` (`TargetsPageContent.astro:56`).
  - The finder loader already proves the full plan before it builds anything (`src/lib/finder/load.ts:102`), and it has the catalogue object, the site and the telescope in scope (`:79`, `:125-162`).
- **S-07 sky-events runs in parallel** in its own worktree (plan reviewed, no code yet). It changes these files:
  - `build.ts`, `load.ts` and `island.ts`;
  - `TONIGHT_PAGES` and `copies.test.ts`;
  - the dashboard: `TonightContent`, `TonightTiles`, `TonightSkeleton`, `VerdictCard` and `sky-band.ts`;
  - `no-console-guard.test.ts`;
  - `tonight-dashboard.spec.ts` and `tonight-phone.spec.ts`.

  It also adds blocks to `parameters.ts`, `en.ts`, `pl.ts`, `design.astro` and `CLAUDE.md` (sky-events `plan.md:153-472`). It touches none of `ObjectDetails`, `ObjectCard`, `ObjectRow`, `TargetsPageContent`, `PlanetCard`, `src/components/finder/**` or `src/lib/finder/**`.

## Desired End State

- **A full-plan user on `/tonight/targets`** sees an "eye" line at the top of each ranked row's details. The line is phrased from the 22-phrase set, in EN or PL. It changes when they switch to a telescope of a different aperture, or to a site of a different Bortle class, wherever the rule's bands differ.
- **A full-plan user on a finder chart** sees the same line above the chart for a deep-sky object, and the planet's existing note for a planet.
- **A free account** sees one muted line under the Targets count instead (O-1), and the locked finder explainer gains a fourth bullet. No free island's HTML contains an expectation phrase, and `scripts/smoke.mjs` proves it over HTTP.
- **Unchanged:** the dashboard, `TONIGHT_PAGES`, `loadTonightFor`, `TonightView`, the planet and Moon cards, and the ranking itself.
- **How to verify:** `npm test` (the rule's unit tests and the reference fixture), `npm run lint`, `npx astro check`, `npm run smoke` and the new `what-to-expect.spec.ts`, plus the whole e2e suite before the PR.

### Key Discoveries:

- Core surface brightness minus the moonless sky ("contrast deficit") over the 169 objects with a size: 143 / 19 / 4 / 0 / 3 objects in bands < 0 / 0-1.5 / 1.5-2.5 / 2.5-3.5 / ≥ 3.5 at Bortle 3, against 39 / 60 / 38 / 19 / 13 at Bortle 7 (research §1). A contrast band therefore separates objects and moves with the sky class.
- The engine's washed-out rule uses the same deficit against the moonlit sky, with a 3.5 mag threshold (`score.ts:164-168`, `parameters.ts:370`). A published rule of thumb puts visibility at about 3.25 mag/arcsec² fainter than the sky (research §7). So the faintest band ("limit") sits just inside what the ranking still keeps.
- Published guides agree that a 4-inch scope starts to resolve M13's edge and that 4.5-6 inches resolves it clearly (research §7). That gives the globular thresholds.
- `telescopeLimitingMag` is exported from `score.ts` but not from the barrel (`src/lib/engine/index.ts`). The new engine file imports it from `./score` directly.
- A ranked object is by construction not washed out (`ranking.ts:99-117`), so no phrase says "washed out".

## What We're NOT Doing

- **No new line for planets or the Moon.** Their fixed notes stay as they are and stay free (FR-045: shipped before v3). The finder chart reuses the planet note (D-9).
- **No Moon input to the line** (D-4). The line describes the object from the site in the user's telescope on a moonless night. Tonight's Moon is already in each row's reason line and in the washed-out rule.
- **No line on the dashboard tile, the Session plan, the washed-out rows or the live sky's markers.**
- **No edit to `build.ts`, `load.ts`, `island.ts`, `TonightView`, `TONIGHT_PAGES`, `copies.ts`, `sw.ts` or the dashboard components** (S-07's files; D-7, O-2).
- **No new data source, migration, table or log line.** No telescope type or obstruction.
- **No observer calibration.** The rule is judged against a committed, source-cited reference (D-6, roadmap Open Roadmap Question 1).
- **No upsell, pricing or plan badge** (PRD Non-Goals).

## Implementation Approach

The work splits into a pure rule and a gated render.

- **The rule.** The engine gets one pure function: `expectationFor(object, bortle, apertureMm) → ExpectationKey`. It works over the existing sky and brightness helpers, with its candidate numbers in a new `EXPECT_*` block of `parameters.ts`. It is pinned by property tests (monotonic in sky and aperture, total over the catalogue) and by a source-cited reference fixture.
- **The wording.** It lives in one `tonight.expect` sub-object of the i18n catalogue, keyed by `ExpectationKey`.
- **The render.**
  - The Targets island and the finder loader, which already hold the site, the telescope and the plan read, compute the key server-side. They do so only for a full plan, and pass the translated text down as a prop.
  - The plan-blind `TonightView` never carries it, so a free account's HTML cannot leak it.
  - Every file S-07 changes is avoided, apart from appended blocks in the shared catalogue, parameters, `/design` and docs.

## Decisions taken in this run

These are delegated (team-owned): decided here, and changed by editing the parameter or the plan.

- **D-1 Scope.** The gated line covers ranked Messier and Caldwell objects. Planets and the Moon keep their free notes. FR-038's inputs (type, size, brightness against sky quality) are deep-sky terms, and the planet notes already say what a 100-200 mm telescope shows (`en.ts:623`).
- **D-2 The rule** (OQ17). All numbers are candidates in `parameters.ts` under `EXPECT_*`. Inputs are `Pick<DeepSkyObject, "type" | "vMag" | "majorAxisArcmin" | "minorAxisArcmin">`, `bortle` (1-9) and `apertureMm`.
  - **Contrast deficit:**

    `d = effectiveSurfaceBrightness(object) − darkSkyZenithMagForBortle(bortle) − EXPECT_APERTURE_GAIN_MAG × log2(apertureMm / EXPECT_REFERENCE_APERTURE_MM)`

    The candidates are 0.5 mag per doubling and 150 mm. A larger aperture takes more magnification at the same exit pupil, and a larger image of the same surface brightness is easier to see. A smaller aperture shifts the other way.

    If `d` is null (no major axis), the band is `smudge`: a middle band that makes no claim. Only M40 and M73 have no major axis, and their types have fixed phrases anyway.
  - **Band**, from `d`:

    | Band | Condition |
    |---|---|
    | `bright` | d < `EXPECT_BRIGHT_BELOW` (0.5) |
    | `smudge` | d < `EXPECT_SMUDGE_BELOW` (1.5) |
    | `faint` | d < `EXPECT_FAINT_BELOW` (2.5) |
    | `limit` | otherwise |

  - **Near the telescope's limit:** when `vMag > telescopeLimitingMag(bortle, apertureMm) − EXPECT_NEAR_LIMIT_MAG` (1.0), the band is at least `faint`.
  - **Key by type.** Each type maps to keys as follows:
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
  - **Why this shape:** OQ17's three inputs, through the engine's own sky model and brightness formula, so the line can never contradict the ranking's washed-out rule. A size enters through the surface brightness and the three size thresholds.
- **D-3 Invariants pinned by tests.**
  - The rule is total over the catalogue: every object, Bortle 1-9 and apertures 20-1000 mm give a key.
  - It is deterministic.
  - A worse sky never gives a brighter band, and a bigger aperture never a fainter one, for every catalogue object.
  - Globular resolution never regresses as aperture grows.
  - Every key has an EN and a PL phrase (type-level `Record<ExpectationKey, string>` plus the parity test).
- **D-4 No Moon.** The line is a property of object, site and telescope, stable from night to night like the gear itself. The Moon already speaks through the reason line and the washed-out rule. Mixing it in would make the same object read differently on two nights for a reason the row already states.
- **D-5 Where the line renders.**
  - On Targets, it is the first line of `ObjectDetails`' slot (above the eyepiece pair): `<p data-expect>` in `text-label text-foreground`, with a lucide `Eye` icon (`aria-hidden`). The sentence stands alone, with no "What to expect:" prefix. In `ObjectRow` it shows when the row is expanded, like the rest of the details.
  - On the finder chart, it is one `<p data-expect>` between the page sky and the chart (`FinderContent.astro`, chart state).
- **D-6 Calibration without an observer** (roadmap Open Roadmap Question 1, finder-chart D-11 template).
  - `src/lib/engine/fixtures/expect-reference.ts` holds about 12 objects. Each has the key a published small-telescope description supports, at a fixed setting: 150 mm at Bortle 4, plus a Bortle 7 row for M33 and M101. Each needs at least 2 sources (title, publisher, URL, access date), read in Phase 1 before the comparison.
  - Candidate objects: M13, M3, M57, M27, NGC 7662, M31, M33, M51, M81, M101, M42, M45 and M11.
  - The test asserts each match. A reference the rule misses is either fixed by a rule change justified by a source (recorded in this plan) or listed in `KNOWN_DIVERGENCES` with its computed key and reason. The fixture is never edited to pass.
  - More than 3 divergences stop Phase 1 and go to the owner.
- **D-7 Server-side, plan-first, outside `TonightView`.**
  - `TargetsPageContent` turns its `void getAccountPlan(...)` into a promise awaited after the Tonight load. The read is the same single memoised query and still overlaps the load.
  - On `full` it computes the text per entry through a new server helper and passes `expectation: string | null` to `ObjectCard` / `ObjectRow` → `ObjectDetails`.
  - On anything else it passes nothing and renders the locked line (O-1).
  - `loadFinderFor`'s `chart` result gains `expectation: string | null` (the plan is already proven there).
  - The shell passes no plan prop. Islands replay at `/_server-islands/*` without the shell, so each island decides for itself.
- **D-8 Server helper.** New `src/lib/tonight/expectation.ts`, a server module (it imports `@/lib/catalogue`). It has two functions:
  - `expectationKeyFor(id, bortle, apertureMm) → ExpectationKey | null` (null for an id the catalogue does not list);
  - `expectationText(key, messages)`.
- **D-9 Planets on the finder chart.** The chart state shows `messages.tonight.planets.note[key]`. That text is already free on `/tonight/planets`, so showing it behind the plan gate leaks nothing.
- **D-10 Copy namespace and parameters.**
  - All new strings go under `tonight.expect` in `en.ts` / `pl.ts`:
    - `phrase: Record<ExpectationKey, string>`;
    - `locked`, the free line (O-1);
    - `lockedFinderLine`, the fourth bullet of `FinderLocked`.
  - Parameters go in one `EXPECT_*` block appended to `parameters.ts`.
  - Nothing is renamed or moved, so S-07's blocks (`tonight.events.*`, `EVENT_*`) merge textually.
- **D-11 Proof of the gate.** `scripts/smoke.mjs` gains three steps:
  - the free account's **Targets island** HTML contains `data-expect-locked` and no `data-expect=`;
  - after the grant it contains `data-expect`;
  - the leaked island URL after sign-out contains neither (it renders nothing).

  The island URL is captured from the Targets shell like the finder's. The first two steps take the finder steps' `inNoDarknessWindow` skip note, because an empty ranking has no rows.
- **D-12 No new log, no coordinates.** The helper and the rule cannot fail on catalogue input (D-3 makes the rule total). No `try`/`catch` and no allowlisted disable: `ALLOWED_DISABLES`, which S-07 edits, stays as it is.

## Owner decisions

The plan follows these defaults until the owner answers, after the plan review.

- **O-1 What a free account sees on Targets** (UI, FR-045). Default (A): one muted line with a lucide `Lock` icon under the Targets count line (`data-expect-locked`), shown once per page when the ranking has rows. The copy: "Full plan: each target also says what it will look like in your telescope from your site, such as "A faint grey smudge with a slightly brighter middle."" The alternative (B) is a short locked line in every row's details. (A) is quieter on a 30-row page. (B) is closer to where the feature would be.
- **O-2 A lost plan and stored Targets pages** (entitlement). Default (A): accept. A stored `/tonight/targets` copy rendered on the full plan keeps its lines until one of these happens:
  - the next online visit to that page replaces it (a free island commits the same key);
  - its next-night copy refreshes;
  - it expires 36 h after its site's last refresh (`copies.ts:39`).

  The text is derived from public catalogue data and the user's own gear. The alternative (B) widens the finder-only plan-loss drop to the Targets pages in `copies.ts` and `copies.test.ts`, which S-07 also edits.

## Phase 1: The rule (engine, parameters, reference)

### Overview

A pure, tested `expectationFor`, its candidate numbers and the source-cited reference. This phase is test-first (D-3, D-6).

### Changes Required:

#### 1. Parameters

**File**: `src/lib/engine/parameters.ts`

**Intent**: Append one documented `EXPECT_*` block of candidates, each with a one-line why and the date: `EXPECT_REFERENCE_APERTURE_MM`, `EXPECT_APERTURE_GAIN_MAG`, `EXPECT_BRIGHT_BELOW`, `EXPECT_SMUDGE_BELOW`, `EXPECT_FAINT_BELOW`, `EXPECT_NEAR_LIMIT_MAG`, `EXPECT_STARLIKE_ARCMIN`, `EXPECT_RESOLVE_APERTURE_MM`, `EXPECT_RESOLVE_MAX_VMAG`, `EXPECT_GRAINY_APERTURE_MM`, `EXPECT_GRAINY_MAX_VMAG`, `EXPECT_WIDE_ARCMIN`, `EXPECT_COMPACT_ARCMIN`.

**Contract**: The values are those in D-2. The block is appended at the end of the file and nothing else is touched (S-07 appends its own block).

#### 2. The rule

**File**: `src/lib/engine/expectation.ts` (new), exported from `src/lib/engine/index.ts`

**Intent**: Classify how a deep-sky object looks into one of the 22 keys by D-2's contrast band, near-limit floor and type table.

**Contract**:
- `export type ExpectationKey` is the 22-member string union of D-2 (camelCase).
- `export const EXPECTATION_KEYS: readonly ExpectationKey[]`.
- `export type ContrastBand = "bright" | "smudge" | "faint" | "limit"`.
- `export function contrastBand(object, bortle, apertureMm): ContrastBand`.
- `export function expectationFor(object, bortle, apertureMm): ExpectationKey`.

`object` is `Pick<DeepSkyObject, "type" | "vMag" | "majorAxisArcmin" | "minorAxisArcmin">`. The module imports `telescopeLimitingMag` from `./score` and `effectiveSurfaceBrightness` from `./moonlight`. It never reads the clock, the environment, the network or the filesystem (`purity.test.ts` covers it).

#### 3. Tests

**File**: `src/lib/engine/expectation.test.ts` (new)

**Intent**: Pin D-3 and the type table.
- Every `DEEP_SKY` object × Bortle 1-9 × apertures {20, 60, 80, 100, 130, 150, 200, 300, 1000} gives a member of `EXPECTATION_KEYS`.
- The band order never brightens as Bortle grows and never fades as aperture grows, for every object.
- `globularResolved` → `globularGrainy` → `globularGlow` never regresses with aperture.
- The table boundaries:
  - a planetary nebula under 0.5′ is star-like;
  - an open cluster of 60′ is wide;
  - the near-limit floor applies;
  - the null-axis objects M40 and M73 take their fixed keys;
  - `EXPECTATION_KEYS` has 22 entries.
- Every key is reachable by some catalogue object at some setting. This is a coverage check, not a requirement on the catalogue: an unreachable key fails the test and is either removed or justified.

#### 4. Reference fixture

**File**: `src/lib/engine/fixtures/expect-reference.ts` (new) and its test in `expectation.test.ts`

**Intent**: Calibrate without an observer (D-6).
- The header follows `finder-reference.ts`: TEST-ONLY, the setting, how the sources were read, and "a failing reference is an engine finding, never a fixture edit".
- Sources are gathered first, through WebSearch/WebFetch summaries, with the access date. Outbound requests carry no personal data: they use the repo URL as the contact.
- The rule is then compared. Any divergence is resolved per D-6, and the outcome is recorded in this plan's D-6.

**Contract**: `EXPECT_REFERENCES: { id; apertureMm; bortle; expected: ExpectationKey; sources: { title; publisher; url; accessed }[]; note }[]` and `KNOWN_DIVERGENCES` (same shape plus `computed` and `reason`).

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/engine/expectation.test.ts` passes, including the reference fixture.
- `npm test` passes (purity test included).
- `npm run lint` and `npx astro check` pass.
- A deliberate break (flip one comparison in `contrastBand`) turns the monotonicity test red. Revert it afterwards.

#### Manual Verification:

- The reference fixture has at least 12 entries with at least 2 sources each, and at most 3 known divergences, each with a reason.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Copy and the Targets rows behind the plan

### Overview

The 22 phrases in EN and PL, the server helper, the gated line on every ranked row, the free line, and `/design` specimens.

### Changes Required:

#### 1. Copy

**Files**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Add `tonight.expect` with these entries:
- `phrase` (one sentence per key, below);
- `locked` (O-1 copy);
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

**Contract**: `phrase` is typed `Record<ExpectationKey, string>` in `en.ts`, so a missing key fails `astro check`. `pl.ts` mirrors it (`satisfies Messages` plus the parity test). Polish is written to the same register as `tonight.planets.note`.

#### 2. Server helper

**File**: `src/lib/tonight/expectation.ts` (new) plus `expectation.test.ts`

**Intent**: D-8. Look the object up with `findDeepSky(id)` and call `expectationFor`. Return null for an id the catalogue does not list.

**Contract**:
- `expectationKeyFor(id: string, bortle: number, apertureMm: number): ExpectationKey | null`
- `expectationText(key: ExpectationKey, messages: Messages): string`

The tests cover: a known id, an unknown id (`NGC1`), and that the text is the catalogue's phrase in both locales.

#### 3. Targets island and rows

**Files**: `src/components/tonight/TargetsPageContent.astro`, `ObjectCard.astro`, `ObjectRow.astro`, `ObjectDetails.astro`

**Intent**: D-7 and D-5.
- The island keeps the plan read's promise, awaits it after the Tonight load, and on `full` maps each entry's id to its text with the site's Bortle and the telescope's aperture.
- `ObjectCard` / `ObjectRow` pass the optional `expectation` through to `ObjectDetails`, which renders it first in its slot.
- On a non-full plan with at least one ranked row, the island renders the O-1 locked line under the count line.

**Contract**:
- `ObjectDetails`, `ObjectCard` and `ObjectRow` gain `expectation?: string | null`. Absent means no line.
- Markers: `[data-expect]` on the row line and `[data-expect-locked]` on the free line.
- Tokens only; the line wraps at 320 px.
- No change to `TonightEntry`, `loadTonightFor` or the shell `targets.astro`.

#### 4. Kitchen sink

**File**: `src/pages/design.astro`

**Intent**: A new "What to expect (Targets rows)" section after the FinderChart block:
- every phrase in the current locale (a list rendered from `EXPECTATION_KEYS`);
- one `ObjectDetails` specimen with the line;
- the locked line.

**Contract**: A separate section, so S-07's specimens merge textually. Unique ids.

### Success Criteria:

#### Automated Verification:

- `npm test` passes (i18n parity and the helper tests included).
- `npm run lint` and `npx astro check` pass.
- `npm run build` succeeds.

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

**Intent**: The `chart` result carries `expectation: string | null`:
- for a deep-sky object, the key from `expectationKeyFor(target, site.bortle, telescope.apertureMm)` translated in the loader's locale;
- for a planet, `messages.tonight.planets.note[key]`.

It is computed after the existing plan guard and only in the chart branch.

**Contract**: `FinderLoad`'s `chart` variant gains `expectation: string | null`. No other variant changes. The loader already reads the locale (`load.ts:135`).

#### 2. Finder page and locked explainer

**Files**: `src/components/finder/FinderContent.astro`, `src/components/finder/FinderLocked.astro`

**Intent**:
- The chart state renders `<p data-expect>` with the `Eye` icon above the chart when `expectation` is non-null.
- `FinderLocked` gains the fourth bullet, `tonight.expect.lockedFinderLine`.
- The free example (`EXAMPLE_FINDER_CHART`) shows no phrase.

**Contract**: The `data-finder-chart` root and `data-finder-state` stay as they are. The `/design` FinderChart block is unchanged apart from FinderLocked's new bullet.

#### 3. Tests

**File**: `src/lib/finder/load.test.ts` (extend; it already builds chart states, `:141-170`)

**Intent**: A chart for a deep-sky object carries its phrase, and a chart for a planet carries the planet note.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint` and `npx astro check` pass.
- `npm run build` succeeds.

#### Manual Verification:

- A full-plan finder chart for M13 and for a ranked galaxy shows the line above the chart. A planet's chart shows its note.
- A free account's finder page lists the fourth bullet.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Proof and docs

### Overview

The plan boundary over HTTP (D-11), the browser spec, the docs, and the whole suites run the way CI runs them.

### Changes Required:

#### 1. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: The three D-11 steps, placed in the existing order:
- the free step before `finder 2` (the grant);
- the full step after `finder 3`, before the demotion;
- the leaked-URL step after sign-out, beside `finder 6`.

The Targets island URL is captured from the `/tonight/targets` shell, generalising `islandUrlFromShell` if needed. `needsPlanGrant` applies to the steps that need the grant.

**Contract**: In the no-darkness window, the two ranked steps record a `skippedNote` like `finder 3`.

#### 2. Browser spec

**File**: `tests/e2e/what-to-expect.spec.ts` (new)

**Intent**: Uses `onboardInMadrid`, `requirePlanGrant` and `setPlan`, and has three tests:
- **Free:** Targets shows `[data-expect-locked]` once and no `[data-expect]`.
- **Full:** the first `ObjectCard`'s `[data-expect]` text is one of `en.tonight.expect.phrase`'s values. M13's finder chart shows a `[data-expect]` that is one of the three globular phrases.
- **At 320 px with a full plan:** Targets has no sideways scroll.

The two ranked tests skip in the no-darkness window, as the finder spec does.

**Contract**: The assertions go through the markers and the catalogue values, never literal English.

#### 3. Docs

**Files**: `CLAUDE.md` (a short "What to expect (M-3 S-04)" paragraph after the finder chart one), `context/foundation/roadmap.md` (S-04 status, already `planning` from this plan)

**Intent**: Record the following:
- the rule's home (`expectation.ts`) and its `EXPECT_*` candidates;
- the reference fixture;
- the server-side, plan-first render outside `TonightView`;
- the markers;
- O-2's outcome.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint` and `npx astro check` pass.
- `npm run build` succeeds.
- `npm run smoke` against a local production preview with the local stack's key inline passes, including the three new steps.
- `npx playwright test what-to-expect` passes.
- A deliberate break (drop the plan check in `TargetsPageContent`) turns the smoke free step red. Revert it afterwards.
- The whole e2e suite (`npm run test:e2e`) passes locally the way CI runs it (lessons: run the whole suite before a PR).

#### Manual Verification:

- The owner checks the Targets page and a finder chart on a phone (full plan), and the free line on a free account.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- **Rule:** total over the catalogue, deterministic, monotonic in sky and aperture, type-table boundaries, null axes, every key reachable (`expectation.test.ts`).
- **Reference:** the source-cited fixture with its known divergences (D-6).
- **Helper:** known and unknown ids, both locales.
- **i18n:** parity, and the `Record<ExpectationKey, string>` type.

### Integration Tests:

- **Smoke over HTTP:** free, full and leaked island (D-11).
- **e2e:** the free line, the full lines, the finder line and 320 px.

### Manual Testing Steps:

1. In `/design`, read all phrases in EN and PL.
2. With a full-plan account, open Targets and expand a row of the rest. Switch telescope and compare the lines.
3. Open the finder chart for M13, a galaxy and a planet.
4. With a free account, open Targets and the locked finder page.

## Performance Considerations

There is one catalogue lookup and a few arithmetic operations per ranked row (up to the 171 objects) on the server, and no extra query (the plan read is memoised). The page weight grows by one sentence per row.

## Migration Notes

None. There is no schema, data or worker change.

## References

- Research: `context/changes/what-to-expect/research.md`
- PRD: `context/foundation/prd.md:174-189` (US-05), `:446` (FR-038), `:461` (FR-045), `:734-737` (OQ17)
- Template for gating: `src/lib/finder/load.ts:102`, `src/components/finder/FinderLocked.astro`, `scripts/smoke.mjs:238-313`
- Template for calibration: `src/lib/engine/fixtures/finder-reference.ts`, finder-chart plan D-11
- Parallel change: `.claude/worktrees/sky-events/context/changes/sky-events/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The rule (engine, parameters, reference)

#### Automated

- [ ] 1.1 `npx vitest run src/lib/engine/expectation.test.ts` passes, including the reference fixture
- [ ] 1.2 `npm test` passes (purity test included)
- [ ] 1.3 `npm run lint` and `npx astro check` pass
- [ ] 1.4 Deliberate break in `contrastBand` turns the monotonicity test red, then reverted

#### Manual

- [ ] 1.5 Reference fixture has ≥ 12 entries with ≥ 2 sources each and ≤ 3 known divergences with reasons

### Phase 2: Copy and the Targets rows behind the plan

#### Automated

- [ ] 2.1 `npm test` passes (i18n parity and helper tests included)
- [ ] 2.2 `npm run lint` and `npx astro check` pass
- [ ] 2.3 `npm run build` succeeds

#### Manual

- [ ] 2.4 Owner reads all phrases and the locked line on `/design` in EN and PL and approves or edits them
- [ ] 2.5 Full-plan Targets rows show the eye line and a different-aperture telescope changes at least one line
- [ ] 2.6 Free account sees the locked line once and no phrase
- [ ] 2.7 360 px: no sideways scroll in all three themes

### Phase 3: The finder chart line

#### Automated

- [ ] 3.1 `npm test`, `npm run lint` and `npx astro check` pass
- [ ] 3.2 `npm run build` succeeds

#### Manual

- [ ] 3.3 Full-plan finder chart shows the line for M13 and a galaxy, and a planet's chart shows its note
- [ ] 3.4 Free account's finder page lists the fourth bullet

### Phase 4: Proof and docs

#### Automated

- [ ] 4.1 `npm test`, `npm run lint` and `npx astro check` pass
- [ ] 4.2 `npm run build` succeeds
- [ ] 4.3 `npm run smoke` passes against a local preview, including the three new steps
- [ ] 4.4 `npx playwright test what-to-expect` passes
- [ ] 4.5 Deliberate break (no plan check in `TargetsPageContent`) turns the smoke free step red, then reverted
- [ ] 4.6 The whole e2e suite passes locally the way CI runs it

#### Manual

- [ ] 4.7 Owner checks Targets and a finder chart on a phone (full plan) and the free line on a free account
