# Deep sky beyond Messier (S-03) Implementation Plan

## Overview

Add the Caldwell objects a Polish beginner can actually see to Sidereus's deep-sky catalogue. They are ranked on Tonight together with Messier by the same scoring, reasons and eyepiece pair, labelled "NGC 7000 · name", and loggable from Tonight and from the manual log form, where the picker finds them by Messier, NGC, IC or Caldwell number. The slice also takes the contract step S-01 and S-02 deferred to it: dropping `observations.messier` and its sync trigger.

## Current State Analysis

From `research.md` (same folder):

- **Catalogue:** `scripts/build-catalogue.mjs` selects only rows with an `M` value from the pinned OpenNGC commit `da90466…` (`:18-23`, `:170-173`). It throws on an empty `V-Mag` (`:139-141`) or an unknown type (`:133-136`). `src/lib/catalogue/index.ts` hard-validates 110 Messier objects with `id: \`M${number}\`` and `messier: number` (`:30-61`, `:115-163`).
- **OpenNGC data:** the pinned commit carries Caldwell IDs (`C nnn` in `Identifiers`) for 105 of the 109 Caldwell numbers.
  - 60 of them lie at dec ≥ −23°.
  - The Double Cluster (C 14) has no token; it is noted on NGC 869 and NGC 884.
  - 10 reachable objects have no V-Mag. 3 of them have a B-Mag (NGC 7000, IC 342, NGC 4039).
- **Engine:** `rankObjects` ranks any catalogue passed in (`src/lib/engine/ranking.ts:172-178`). Its `RankableObject` requires `messier`, and both tie-breaks subtract it (`:32-43`, `:211`, `:226`). Scoring, eyepieces and positions are catalogue-agnostic.
- **Tonight:** `buildTonight` defaults to `MESSIER` (`src/lib/tonight/build.ts:589`).
  - `TonightEntry` / `TonightWashedOutEntry` carry `messier: number` as the key for localised names (`build.ts:100-107`, `:251-255`).
  - Four components and `build.ts:955,1059` call `localCommonName(messier, …)`, keyed by Messier number (`src/lib/catalogue/common-names.ts:11-52`).
  - Rows render the raw `id`.
- **Log:**
  - The closed key grammar is mirrored in four places:
    - `src/lib/targets/index.ts:33-80`; `targetKind` defaults any unknown key to `"messier"`.
    - the DB check `observations_target_key` (`supabase/migrations/20261001120000_observation_target_moon.sql:11-16`).
    - labels (`src/lib/targets/labels.ts:22-35`).
    - picker options (`src/lib/observations/target-options.ts:13-39`).
  - Search's number path is Messier-only (`target-search.ts:27,42-53`).
  - The legacy `messier` column and the `observations_sync_target` trigger (`20260930120000_observation_target.sql:32-66`) are read by no app code. Only `tests/db/observations.test.ts` (28 references) and a comment in `tests/db/isolation.test.ts:92` touch them.

## Desired End State

On a clear autumn night at a site at 52° N, Tonight's Targets list mixes Messier and Caldwell objects, e.g. "NGC 869 / 884 · Gromada podwójna w Perseuszu" with "Caldwell 14 · Per". The top 5 still lean to Messier through a small order-only bonus. Every row has a best time, direction, eyepiece pair, reason and "seen" tag. A Caldwell object can be marked observed, appears in `/log` with its label, and is found in the manual picker by "ngc 7000", "c 20", "ic 405" or its name. The landing kicker reads "Messier & Caldwell · your sky, your kit". The `observations` table has only `target`.

Verify with the automated suite (unit, `test:db`, e2e), the seasonal calibration snapshot in `evidence/calibration.md`, and Playwright screenshots in EN/PL × dark/light/red × phone/desktop.

### Key Discoveries:

- Caldwell membership can be derived from OpenNGC `Identifiers` at the pinned commit, so the selection is a generator rule, not a hand list (research §5).
- The catalogue `id` doubles as the log key, the `seen` key (`ranking.ts:201`, `engine/log.ts:32-49`), the DOM anchor (`ObjectCard.astro:24`) and `?object=`. It must stay space-free: `NGC7000`, `IC405`.
- `targets/index.ts` and `common-names.ts` are island-safe and must not import catalogue JSON (`stars.ts:10-11`, `TonightSkyView.test.ts:11,72`).
- The naive CSV splitter mis-splits rows with `;` in quoted notes (e.g. NGC 7331, which is C 30). The split falls after column 29, the last one read, so the values are still correct. Phase 1 adds a test that would catch a regression.
- `common-names.ts` says a `common-names.test.ts` checks every named object; that test does not exist.

## What We're NOT Doing

- Caldwell objects below dec −23° (45 objects, e.g. Omega Centauri, 47 Tucanae), and the 4 Caldwell numbers absent from OpenNGC's identifiers apart from C 14 (C 9 Sh2-155, C 41 Hyades, C 99 Coalsack).
- Non-Caldwell showpieces (NGC 7789, Kemble's Cascade, IC 1396) and any other catalogue (Mel, Cr, Sh2).
- Retuning the scoring weights, `MIN_OBJECT_SCORE`, `MAX_RANKED_OBJECTS` or the Bortle and moonlight tables for the new objects. Calibration only checks and records; the one new number is `MESSIER_RANK_BONUS`.
- New `MOONLIGHT_EXEMPT_IDS` entries, unless the calibration snapshot shows an obvious bright-core case. In that case it is noted in the evidence and left as a follow-up.
- Polish names for objects without an established one (they fall back to English, as Messier does).
- Recapturing `public/landing/tonight.png` (Tonight's design does not change).
- Rewriting the PRD's M-1 non-goal text. The roadmap's MS-03 supersedes it for M-2; CLAUDE.md is updated.
- Any no-JS behaviour inside the Tonight island (lessons.md).

## Implementation Approach

The work goes bottom-up: data → engine → Tonight → log → contract cleanup. Each phase leaves the app shippable.

1. **Data.** Phase 1 adds the data behind the old interface: `MESSIER` keeps working while `DEEP_SKY` appears.
2. **Engine.** Phase 2 makes the engine Messier-independent and introduces the bonus with a calibration test that guards it.
3. **Tonight.** Phase 3 switches Tonight to `DEEP_SKY`. Caldwell objects become visible here. Their "Mark observed" links point at `/log/new?object=NGC7000`, which only Phase 4 accepts, so Phases 3 and 4 ship in the same PR.
4. **Log.** Phase 4 widens the grammar, DB check, labels, picker and copy.
5. **Cleanup.** Phase 5 drops the legacy column once no deploy can roll back to an app that writes it.

All Phase 1-5 work lands on `feat/deep-sky-beyond-messier` as one PR.

Delegated technical decisions (the user approved a product-question budget; these were decided by the agent):

- **Key shape:** `NGC<n>` / `IC<n>`, no leading zeros, no space.
  - TypeScript and the DB validate the format `^(NGC|IC)[1-9][0-9]{0,3}$`.
  - The log's POST routes additionally reject keys not in the catalogue (server-side `findDeepSky`), because island-safe code cannot hold the catalogue.
  - The Double Cluster's key is `NGC869`.
- **Kind:** a new `TargetKind` `"deep-sky"` for NGC/IC keys. Messier keeps `"messier"`.
- **Data model:**
  - One shared `DeepSkyObject` type: `id`, `messier: number | null`, `caldwell: number | null`, `designation`, the existing measurement fields, and `label` (display: "M31", "NGC 7000", "NGC 869 / 884").
  - `MessierObject` stays as the narrowed type (`messier: number`, `caldwell: null`).
  - The Caldwell data is a second generated file from the same generator run.
- **Bonus:** `MESSIER_RANK_BONUS`, candidate `0.03`, added to `rankScore` only (never the bar). Tuned within Phase 2 against the calibration test and recorded in the evidence.
- **Contract migration** included (Phase 5), since S-01/S-02 deferred it to "once S-03 settles the grammar".

## Critical Implementation Details

- **Timing & lifecycle:** Phase 3 makes Caldwell rows link to `/log/new?object=NGC…`, and Phase 4 is what accepts such keys. Never deploy Phase 3 without Phase 4 (one PR). The Phase 4 migration only widens a check, so it is safe under CI's migrate-then-deploy order. The Phase 5 migration drops the trigger and column; the currently deployed app writes only `target` (`src/lib/observations/store.ts:38`), so migrate-before-deploy is safe there too.
- **Performance constraints:** `determinism.test.ts` asserts the full-catalogue engine run under `LOCAL_BUDGET_MS = 1000` (`:31`, `:82-85`). The catalogue grows from 110 to 171 objects (+55%). If the local run exceeds the budget, stop and report rather than raising the budget silently.

## Phase 1: Caldwell catalogue

### Overview

Generate `caldwell.json` + `caldwell.meta.json` from the same pinned OpenNGC fetch, and expose a combined, validated deep-sky catalogue with display labels and id-keyed localised names. Nothing user-visible changes yet.

### Changes Required:

#### 1. Generator

**File**: `scripts/build-catalogue.mjs`

**Intent**: After building Messier, also build the Caldwell set from the same parsed rows and write it as a second deterministic file pair. The Messier output stays byte-identical.

**Contract**:
- **Selection:** a row of `NGC.csv` / `addendum.csv` whose `Identifiers` contains a `C <n>` token, whose `M` is empty, and with `decDeg >= MIN_DEC_DEG` (`-23`). Comment: 52° N with the 15° default minimum altitude, `38 + dec ≥ 15`, PRD param 8.
- **C 14 override:** one entry with `id: "NGC869"`, `caldwell: 14`, `label`/`designation` "NGC 869 / 884", common name "Double Cluster". RA/Dec are the midpoint of the two rows; major axis is the angular extent covering both; V-mag is the brighter of the two rows' V-Mag (NGC 869: 3.70; NGC 884: 3.80), so 3.7; surface brightness is null. It is recorded in `OVERRIDES` like M102.
- **Magnitude policy:** `vMag` is `V-Mag`, else `B-Mag` (recorded per object as a normalisation), else a documented override `{ id, vMag, source: "<https URL>" }` in `OVERRIDES`. The build throws if a selected object still has no magnitude. About 7 objects need an override: NGC 7023, NGC 7635, NGC 6888, IC 405, NGC 6992, NGC 6960, NGC 2238.
- **Output:**
  - Entry shape is the Messier key order plus `caldwell`, with `messier: null`.
  - `id` is the designation without its space (`NGC7000`).
  - Sorted by `caldwell`.
  - `EXPECTED_CALDWELL_COUNT = 61` asserted (60 + C 14). The build also asserts the Caldwell ids are disjoint from the Messier designations.
- **Meta:** same fields as `messier.meta.json`, plus the selection rule as a string.
- **CSV parsing:** keep the header-keyed splitter. Add a guard that throws if any *selected* row has fewer than 29 fields before `Common names`, so a mis-split that reaches read columns fails the build.

#### 2. Catalogue module

**File**: `src/lib/catalogue/index.ts` (+ new generated `caldwell.json`, `caldwell.meta.json`)

**Intent**: Generalise the object type and validation so both files load through one validated path, keeping the existing exports for callers not yet migrated.

**Contract**:
- `DeepSkyObject` (with `messier: number | null`, `caldwell: number | null`, `label: string`); `MessierObject = DeepSkyObject & { id: \`M${number}\`; messier: number }`.
- `MESSIER` (110, unchanged checks), `CALDWELL` (61, validated: `caldwell` 1..109 unique, id matches `^(NGC|IC)[1-9][0-9]{0,3}$`, `messier === null`), `DEEP_SKY` (Messier then Caldwell), `findDeepSky(id)`, `findMessier(n)`, `CALDWELL_META`.
- Rename `MESSIER_TYPES` / `MessierType` to `DEEP_SKY_TYPES` / `DeepSkyType`, keeping the old names as aliases until Phase 2 removes their engine uses.
- Messier `label` equals `id` ("M31"), computed in the loader; the JSON is not changed.

#### 3. Localised names

**File**: `src/lib/catalogue/common-names.ts`

**Intent**: Key Polish names by object id so Messier and Caldwell share one island-safe map, and add established Polish names for the well-known Caldwell objects.

**Contract**:
- `localCommonName(id: string, englishName, locale)`. Existing entries are re-keyed `1 → "M1"`, etc.
- About 20-30 Caldwell PL names, only where an established Polish name exists (e.g. "Mgławica Ameryka Północna", "Gromada podwójna w Perseuszu", "Mgławica Kocie Oko", "Mgławica Welon").
- All 8 callers move to passing the object id in this phase, since the signature change breaks every one: `ObjectRow.astro:19`, `ObjectCard.astro:21`, `TargetsPageContent.astro:222`, `TonightTiles.astro:47` (`entry.id`), `build.ts:955,1059`, `targets/labels.ts:33` and `target-options.ts:16` (`object.id`). Phase 3 only swaps `entry.messier` for `label`/`caldwell`.
- Fix the stale header comment and add `common-names.test.ts`: every key is a real catalogue id, and PL names are non-empty.

#### 4. Tests, licence, formatting

**Files**: `src/lib/catalogue/caldwell.test.ts` (new), `src/lib/catalogue/messier.test.ts`, `src/lib/catalogue/LICENSE-DATA.md`, `.prettierignore`

**Intent**: Pin the new file's shape and provenance like Messier's, and keep the data licence accurate.

**Contract**:
- **`caldwell.test.ts`:** count 61; meta commit equals the pinned SHA; dec ≥ −23 for all; C 14 is `NGC869` with label "NGC 869 / 884"; every override in the meta carries an https `source`; ids are disjoint from Messier designations.
- **`LICENSE-DATA.md`:** the OpenNGC section names both files and both filters.
- **`.prettierignore`:** add both new JSON files.

### Success Criteria:

#### Automated Verification:

- `npm run catalogue:build` regenerates `messier.json` byte-identically (`git diff --exit-code src/lib/catalogue/messier*.json`) and writes `caldwell.json` with 61 entries
- Running `npm run catalogue:build` twice produces identical `caldwell*.json` bytes
- `npm test` passes, including the new `caldwell.test.ts` and `common-names.test.ts`
- `npx astro check` and `npm run lint` pass

#### Manual Verification:

- Spot-check 5 Caldwell entries (C 14, C 20, C 33, C 39, C 63) in `caldwell.json` against their OpenNGC row and the overrides' sources; record them in `evidence/phase-1.md`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Engine ranking over both catalogues

### Overview

Make the engine's ranking independent of Messier numbers, add the order-only Messier bonus, and guard the mixed ranking with a seasonal calibration test.

### Changes Required:

#### 1. Ranking types and order

**File**: `src/lib/engine/ranking.ts`, `src/lib/engine/score.ts`, `src/lib/engine/moonlight.ts`

**Intent**: Type the engine against `DeepSkyObject`. Order by the bonus-adjusted score, with a deterministic tie-break that prefers Messier.

**Contract**:
- `RankableObject = Pick<DeepSkyObject, "id" | "messier" | "raHours" | "decDeg" | "vMag" | "surfaceBrightness" | "type" | "majorAxisArcmin" | "minorAxisArcmin">`.
- `rankScore = total − (seen ? LOG_PENALTY : 0) + (messier !== null ? MESSIER_RANK_BONUS : 0)`. The bar still reads `total` only (`ranking.ts:213`).
- Tie-break: rankScore desc, then Messier number asc (non-Messier last), then `id` asc. The washed-out order is peak time, then the same tie-break.
- `ScoredObject` and moonlight use `DeepSkyObject`.

#### 2. Parameter

**File**: `src/lib/engine/parameters.ts`

**Intent**: Add the bonus as a documented candidate, and move the type tables to `DeepSkyType`.

**Contract**: `export const MESSIER_RANK_BONUS = 0.03`, with a doc comment ("S-03, candidate: nudges near-ties towards the better-known object; order only, never the bar"). `LOW_INTEREST_TYPES`, `PENALIZED_TYPES_WITHOUT_SURFACE_BRIGHTNESS`, `MOONLIGHT_SENSITIVITY` and `WASHED_OUT_TYPES` are typed over `DeepSkyType`. Remove the `MessierType` alias once nothing uses it.

#### 3. Tests

**Files**: `src/lib/engine/ranking.test.ts`, `src/lib/engine/determinism.test.ts`, `src/lib/engine/fixtures/index.ts`, `src/lib/engine/calibration.test.ts` (new)

**Intent**: Pin the new order rules, run determinism and budget over the full catalogue, and add the calibration guard.

**Contract**:
- **`ranking.test.ts`:**
  - The `synthetic()` helper accepts non-Messier objects.
  - New cases: the bonus breaks a near-tie towards Messier; it never lifts an object below `MIN_OBJECT_SCORE` into the list; the tie-break between non-Messier objects is by `id`.
- **`determinism.test.ts`:** runs on `DEEP_SKY` under the unchanged `LOCAL_BUDGET_MS`. The order comparison at `:175` compares `id`s, not `object.messier` (which is null for Caldwell objects).
- **Fixtures:**
  - `messierTarget` gains a `deepSkyTarget(id)` sibling.
  - `TELESCOPE` (150/750), `EYEPIECES` (25 + 10 mm, 50°) and `warsawDarkWindow` move from `ranking.test.ts:15-62` into `engine/fixtures/index.ts`, so both tests share them.
- **`calibration.test.ts`:**
  - Setup: rank `DEEP_SKY` with `limit: Infinity` on 4 fixed nights (15 Jan, 15 Apr, 15 Jul, 15 Oct 2026) at `WARSAW`, Bortle 5, `TELESCOPE` and `EYEPIECES`.
  - The dark window is `darkWindow(site, observingNight(date, tz), darknessThresholdDegForBortle(5))` (−15°). `RankInput` takes no cloud input, and the Moon is computed inside.
  - Checked during review: all four nights have a −15° window (15 Jul only about 2.2 h, 21:36–23:48 UTC), and all are near new Moon (illumination ≤ 0.25).
  - Loose expectations, from published seasonal lists:
    - (a) each night's cleared list contains at least one Caldwell object;
    - (b) each night's top 5 holds at least 3 Messier objects;
    - (c) the Double Cluster is in the October top 10;
    - (d) no Caldwell galaxy fainter than V 10 is in any top 5.
  - The full top-10 per night is written to `context/changes/deep-sky-beyond-messier/evidence/calibration.md` by hand from a test-logged snapshot, not by the test.
  - If an expectation fails at bonus `0.03`, tune the bonus (record each tried value and the result in the evidence) before touching any expectation.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the new ranking cases and `calibration.test.ts`
- The determinism test passes over `DEEP_SKY` within `LOCAL_BUDGET_MS` locally (logged ms recorded in the evidence)
- `npm run test` → `purity.test.ts` still passes (engine reads no clock or I/O)
- `npx astro check` and `npm run lint` pass

#### Manual Verification:

- The user reviews the four seasonal top-10 snapshots in `evidence/calibration.md` and agrees they look like a sensible beginner list, with the final `MESSIER_RANK_BONUS` value

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Caldwell objects on Tonight

### Overview

Rank `DEEP_SKY` on Tonight and render Caldwell objects with their label, Caldwell detail and localised name on every surface that shows deep-sky objects.

### Changes Required:

#### 1. View model

**File**: `src/lib/tonight/build.ts`

**Intent**: Default the catalogue to `DEEP_SKY`, and carry the display label and Caldwell number instead of the Messier number.

**Contract**:
- `TonightEntry` and `TonightWashedOutEntry` replace `messier: number` with `label: string` and `caldwell: number | null`.
- `id` remains the log key and anchor.
- Sky bodies and plan rows use `label` for their label and `localCommonName(object.id, …)` for the name (`build.ts:955-961`, `:1058-1068`).
- `skyObjects` is typed `DeepSkyObject[]`.

#### 2. Components

**Files**: `src/components/tonight/ObjectCard.astro`, `ObjectRow.astro`, `ObjectDetails.astro` (`srSuffix={entry.id}` at `:24` becomes the label), `TargetsPageContent.astro`, `TonightTiles.astro`, `TargetDetails.astro` (comment), `src/lib/sky-view/view.ts` (comment), `src/lib/tonight/build.ts:707` (comment), `src/pages/design.astro` (`sampleTarget` at `:296-312` builds a `TonightEntry` with `messier`)

**Intent**: Show `entry.label` where `entry.id` is shown today, localise names by `entry.id`, and add "Caldwell <n>" to the row's existing secondary line for Caldwell objects. `/design` gains a Caldwell row in its states.

**Contract**:
- A new i18n key `tonight.object.caldwell({ n })` (EN "Caldwell {n}", PL "Caldwell {n}"), shown before the constellation where that line exists.
- `id="object-<id>"` and `data-object` keep the space-free `id`.
- Labels use existing type roles and tokens only.

#### 3. Tests

**Files**: `src/lib/tonight/build.test.ts`, `src/components/tonight/TonightSkyView.test.ts` (unchanged guard must still pass), `tests/e2e/tonight-targets.spec.ts`

**Intent**: Pin that a Caldwell object flows through to an entry with `label`, `caldwell`, a `/tonight/targets#object-NGC…` href, and a `logHref` with `object=NGC…`. Fix the existing assertions that assume Messier.

**Contract**:
- One new build test with a fixed night where a known Caldwell object ranks. Keep it modest (user preference).
- **Existing assertions to update:**
  - `build.test.ts:213`: the top-5 ids match any catalogue key (`^(M|NGC|IC)\d+$`), not `^M\d+$`.
  - `build.test.ts:1386-1388`: sky bodies' `label` equals the catalogue label (not the key), and the name starts with the label; the comment is updated.
  - `tonight-targets.spec.ts:79`: the `logged` notice is compared with the label shown, not the key. The e2e specs use the real clock, so any season's top rows can be Caldwell objects.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npx astro check` and `npm run lint` pass
- `npm run build` succeeds, and `TonightSkyView.test.ts`'s import guard still passes (no catalogue JSON in the island)
- The existing e2e Tonight specs pass against the local preview (`npm run test:e2e`, recipe in `context/handoff.md`)

#### Manual Verification:

- Playwright screenshots of `/tonight` (sky markers, "Point here first") and `/tonight/targets` and `/tonight/plan` showing at least one Caldwell object, in EN/PL × dark/light/red × 390 px/desktop. Labels fit at 390 px in Polish, and "Caldwell <n>" and the PL name are present. Saved under `evidence/phase-3/`.
- A sky marker for a Caldwell object scrolls to its row on `/tonight/targets#object-NGC…`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Logging Caldwell objects

### Overview

Widen the target grammar and DB check to NGC/IC keys, label and offer Caldwell objects in the log, make the picker's number search catalogue-aware, and reword the Messier-only copy.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/2026100XHHMMSS_observation_target_deep_sky.sql` (new)

**Intent**: Accept NGC/IC keys, following the S-02 pattern.

**Contract**: `alter table observations drop constraint observations_target_key, add constraint observations_target_key check (<existing Messier regex> or target in (<7 planets>, 'moon') or target ~ '^(NGC|IC)[1-9][0-9]{0,3}$')`. The trigger is unchanged: its `^M[0-9]{1,3}$` never matches NGC/IC.

#### 2. Key grammar

**File**: `src/lib/targets/index.ts` (+ `index.test.ts`)

**Intent**: Add the deep-sky key and kind so nothing classifies an NGC key as Messier.

**Contract**:
- `DeepSkyKey = \`NGC${number}\` | \`IC${number}\``. `TargetKey` adds it, and `TargetKind` adds `"deep-sky"`.
- `isDeepSkyKey` uses the same regex as the DB.
- `targetKind` gets explicit branches and no fall-through default to `"messier"`.
- `parseTargetParam` keeps the bare-digit Messier legacy.
- Header comment updated.

#### 3. Labels, options, search

**Files**: `src/lib/targets/labels.ts`, `src/lib/observations/target-options.ts`, `src/lib/observations/target-search.ts` (+ their tests)

**Intent**: Give Caldwell objects a label and picker options, and route number queries by prefix.

**Contract**:
- **`targetLabel`:** a `"deep-sky"` branch via `findDeepSky`, returning `{ id: label, name: localised }`.
- **`targetOptions`:** order is Messier, then Caldwell (by C number), then the Moon, then the planets.
  - A Caldwell option is `label` "NGC 7000 · Mgławica Ameryka Północna", `detail` "Caldwell 20 · Cyg".
  - Its `names` are [localised, English, designation, "C 20", "Caldwell 20"].
- **`NUMBER_QUERY`** becomes `^(m|ngc|ic|c|caldwell)?\s*(\d{1,4})$` (case- and space-insensitive after normalisation):
  - Bare or `m` matches Messier numbers, as today.
  - `ngc` / `ic` match the designation number across all options (so "ngc 224" finds M31 and "ngc 7000" finds C 20). For the Double Cluster both 869 and 884 match.
  - `c` / `caldwell` match the Caldwell number.
  - Ordering on the `ngc`/`ic`/`c` paths: the exact number first, then numbers that start with the query, in ascending order. So "ngc 224" gives M31 (NGC 224) first, then NGC 2244 (C 50).

#### 4. Server-side existence check

**Files**: `src/pages/api/log/index.ts`, `src/pages/api/log/[id].ts`

**Files** (also): `src/pages/log/new.astro`, `src/lib/observations/redirect.ts`

**Intent**: Reject a well-formed key that is not in the catalogue (e.g. `NGC1`) with the existing `errors.observation.objectInvalid` redirect. Island-safe validation can only check the format. Stop the GET path from rendering a form for such a key.

**Contract**:
- `isKnownTarget(key)` lives in `src/lib/targets/labels.ts`, which already reads the catalogue server-side. Planet and Moon return true; Messier and deep-sky go through `findDeepSky`.
- In both POST routes it runs after schema parsing and before the store call. Failure redirects with `?error=errors.observation.objectInvalid`, per the error-response tripwire.
- `log/new.astro` (`:44-45`) treats a format-valid but unknown `?object=` as not found (`objectNotFound`).
- `formRedirect` (`redirect.ts:33-56`) drops a target that isn't known instead of carrying it back as `?object=`.

#### 5. Copy

**Files**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Reword the Messier-only strings.

**Contract**:
- `landing.kicker` (`en.ts:95`): "Messier & Caldwell · your sky, your kit"; PL "Messier i Caldwell · twoje niebo, twój sprzęt".
- `log.manualIntro` (`en.ts:967-968`): "Pick a deep-sky object, the Moon or a planet…".
- The picker placeholder (`en.ts:979`): "e.g. 31, NGC 7000, Andromeda or Jupiter".
- `errors.observation.objectInvalid` (`en.ts:1116`): "Choose an object from the list."
- PL equivalents in `pl.ts:77,853,865,995`.
- The comment at `en.ts:931`, and the header comments of `target-search.ts:1-6,26-35` and `target-options.ts:7-12`.

#### 6. Tests

**Files**: `tests/db/observations.test.ts`, `src/lib/observations/*.test.ts`, `src/lib/targets/*.test.ts`, one e2e spec (extend the existing log spec)

**Intent**: Cover the widened grammar end to end, modestly.

**Contract**:
- **DB:** `NGC7000` and `IC405` are accepted with `messier = null`; an edit from `M31` to `NGC7000` and back re-derives correctly; `NGC0`, `NGC 7000`, `ngc7000` and `IC` are rejected.
- **Unit:**
  - The search prefixes and the `targetKind` branches.
  - `target-search.test.ts:20-23,58`: the option count becomes 179 (110 + 61 + Moon + 7 planets), and the order is Messier, Caldwell, the Moon, then the planets.
  - `target-search.test.ts:83-84`: "ngc 224" / "ngc224" expect M31 first (not an exact one-item list).
  - `isKnownTarget` and the `formRedirect` drop.
- **e2e:**
  - Log a Caldwell object from the manual picker by typing "c 20", and see it in `/log`.
  - Fix `tests/e2e/observation-log.spec.ts`:
    - `:32` accepts any catalogue key on the first row (real clock, so it can be a Caldwell object).
    - `:38` and `:55` compare with the label shown (`targetLabel`), not the key.
    - The test title at `:64` stops saying "outside the Messier catalogue".

### Success Criteria:

#### Automated Verification:

- `npm run test:db` passes against local Supabase with the new migration applied
- `npm run db:types` produces no diff in `src/lib/database.types.ts`
- `npm test`, `npx astro check` and `npm run lint` pass
- `npm run test:e2e` passes, including the new log case
- `npm run smoke` passes against local Supabase

#### Manual Verification:

- Screenshots in EN/PL × dark/light/red × 390 px/desktop: the manual picker with "ngc 7000", "c 20" and "ic 405" queries; the `/log` row for a Caldwell object; the landing kicker (Polish fits at 320-390 px). Saved under `evidence/phase-4/`.
- "Mark observed" on a Caldwell row on `/tonight/targets` saves and returns to the row with its "seen" tag

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 5: Contract migration and docs

### Overview

Drop the legacy `observations.messier` column and its sync trigger, and bring CLAUDE.md and the catalogue docs in line with the two-catalogue world.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/2026100XHHMMSS_drop_observation_messier.sql` (new)

**Intent**: Finish the expand/contract step begun in S-01 (`context/archive/2026-09-30-planets-on-tonight/plan.md:485`).

**Contract**: Drop trigger `observations_sync_target` and its function, then `alter table observations drop column messier`. `target` and `observations_target_key` are unchanged.

#### 2. Types and tests

**Files**: `src/lib/database.types.ts` (regenerated), `tests/db/observations.test.ts`, `tests/db/isolation.test.ts`, `src/lib/observations/store.ts` (comment)

**Intent**: Remove every reference to the dropped column.

**Contract**:
- Regenerate the types with `npm run db:types`.
- Replace the sync-trigger suite with target-only accept/reject cases (keep the Phase 4 cases).
- Update the comment at `isolation.test.ts:92` and the store header comment (`store.ts:38`).

#### 3. Docs

**Files**: `CLAUDE.md`, `src/lib/catalogue/LICENSE-DATA.md` (if not done), `context/foundation/roadmap.md` (status only, by the skills)

**Intent**: Describe the deep-sky catalogue accurately for the next agent.

**Contract**:
- The Project paragraph says Messier and Caldwell objects.
- The Catalogue section covers `DEEP_SKY`, `CALDWELL`, `findDeepSky` and id-keyed `localCommonName`.
- The tripwire "never edit `messier.json`…" extends to `caldwell.json` / `caldwell.meta.json`.
- The key grammar mentions `NGC`/`IC`.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies all migrations cleanly, and `npm run test:db` passes
- `npm run db:types` output is committed and CI's drift check passes locally (`git diff --exit-code src/lib/database.types.ts` after regenerating)
- `grep -rn "messier" supabase/migrations/*drop* tests/db src/lib/observations` shows only intended references
- `npm test`, `npx astro check`, `npm run lint` and `npm run smoke` pass

#### Manual Verification:

- The existing log entries (Messier, planet, Moon, Caldwell) still list and edit correctly on `/log` against local Supabase after `db reset` plus seed data. (Review F4: `seed.sql` is empty and `db reset` recreates the database. Instead, create one entry of each kind on the Phase 4 schema, apply the drop with `npx supabase migration up` (no reset), and check that they list and edit.)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- The catalogue's shape and provenance (`caldwell.test.ts`), with the C 14 merge and the override sources
- Id-keyed names (`common-names.test.ts`)
- Ranking: the bonus breaks near-ties, never touches the bar, and ties between non-Messier objects go by id
- Calibration: 4 seasonal nights with loose expectations
- Key grammar and `targetKind`; prefix number search; labels and options for Caldwell
- A build test: a Caldwell entry's label, caldwell, href and logHref

### Integration Tests:

- `test:db`: the widened check (Phase 4), then target-only after the column drop (Phase 5)
- e2e: log a Caldwell object via "c 20" and see it in `/log`; the existing Tonight and log specs stay green
- smoke against local Supabase

### Manual Testing Steps:

1. Run the seasonal snapshot and read `evidence/calibration.md`: do the top-10s look like a beginner's seasonal list?
2. On local preview, open `/tonight` and `/tonight/targets` for a Polish site in October: Caldwell rows show "NGC … · PL name" with "Caldwell n".
3. Mark a Caldwell object observed from Targets; check the return, the "seen" tag and the `/log` row.
4. In the manual log, search "ngc 224" (finds M31), "c 14" (Double Cluster) and "ic 405".
5. Check the landing kicker in PL at 320 px.

## Performance Considerations

- The engine tracks 171 objects instead of 110 per Tonight render; the determinism budget (1000 ms locally) guards it. On Workers Paid the 10 ms CPU cap no longer applies (since 2026-09-30), but the island's render time is still worth recording in the Phase 2 evidence.
- `caldwell.json` (~61 entries) is server-only, like `messier.json`. The picker options are built server-side and grow by 61 entries in the page HTML of `/log/new` and `/log/[id]` only.

## Migration Notes

- **Phase 4:** an additive check widening. Rollback of the app leaves NGC/IC rows that the old app labels as a raw key (the same accepted risk as S-01/S-02).
- **Phase 5:** destructive (drops `messier`). The column is fully derivable from `target` (`M<n>`), so no data is lost. A rollback to an app version from before S-01 is no longer supported, which S-01 anticipated.

## References

- Research: `context/changes/deep-sky-beyond-messier/research.md`
- Roadmap slice: `context/foundation/roadmap.md` "### S-03"; GitHub #67
- Grammar extension precedent: `context/archive/2026-10-01-moon-as-target/plan.md:273-292`
- Expand/contract origin: `context/archive/2026-09-30-planets-on-tonight/plan.md:225-250,485`
- Generator override pattern: `scripts/build-catalogue.mjs:47-61` (M102)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Caldwell catalogue

#### Automated

- [x] 1.1 `npm run catalogue:build` regenerates `messier.json` byte-identically and writes `caldwell.json` with 61 entries — b72b1df
- [x] 1.2 Running `npm run catalogue:build` twice produces identical `caldwell*.json` bytes — b72b1df
- [x] 1.3 `npm test` passes, including the new `caldwell.test.ts` and `common-names.test.ts` — b72b1df
- [x] 1.4 `npx astro check` and `npm run lint` pass — b72b1df

#### Manual

- [x] 1.5 Spot-check 5 Caldwell entries against OpenNGC and override sources, recorded in `evidence/phase-1.md` — b72b1df

### Phase 2: Engine ranking over both catalogues

#### Automated

- [x] 2.1 `npm test` passes, including the new ranking cases and `calibration.test.ts`
- [x] 2.2 The determinism test passes over `DEEP_SKY` within `LOCAL_BUDGET_MS` locally
- [x] 2.3 `purity.test.ts` still passes
- [x] 2.4 `npx astro check` and `npm run lint` pass

#### Manual

- [ ] 2.5 The user reviews the seasonal top-10 snapshots and the final `MESSIER_RANK_BONUS`

### Phase 3: Caldwell objects on Tonight

#### Automated

- [ ] 3.1 `npm test`, `npx astro check` and `npm run lint` pass
- [ ] 3.2 `npm run build` succeeds and the `TonightSkyView` import guard still passes
- [ ] 3.3 The existing e2e Tonight specs pass against the local preview

#### Manual

- [ ] 3.4 Screenshots of Tonight surfaces with a Caldwell object in EN/PL × three themes × phone/desktop
- [ ] 3.5 A Caldwell sky marker scrolls to its row on `/tonight/targets`

### Phase 4: Logging Caldwell objects

#### Automated

- [ ] 4.1 `npm run test:db` passes with the new migration applied
- [ ] 4.2 `npm run db:types` produces no diff
- [ ] 4.3 `npm test`, `npx astro check` and `npm run lint` pass
- [ ] 4.4 `npm run test:e2e` passes, including the new log case
- [ ] 4.5 `npm run smoke` passes against local Supabase

#### Manual

- [ ] 4.6 Screenshots of picker queries, the `/log` row and the landing kicker in EN/PL × three themes × phone/desktop
- [ ] 4.7 "Mark observed" on a Caldwell row saves and returns with its "seen" tag

### Phase 5: Contract migration and docs

#### Automated

- [ ] 5.1 `npx supabase db reset` applies all migrations cleanly and `npm run test:db` passes
- [ ] 5.2 Regenerated `database.types.ts` is committed with no drift
- [ ] 5.3 `grep` shows only intended `messier` references in migrations, db tests and observations
- [ ] 5.4 `npm test`, `npx astro check`, `npm run lint` and `npm run smoke` pass

#### Manual

- [ ] 5.5 Existing log entries of every kind list and edit correctly after `db reset` plus seed data
