---
date: 2026-10-06T17:30:00+02:00
researcher: Claude (Opus 5.5) with three Sonnet research workers
git_commit: c1036ad
branch: feat/deep-sky-beyond-messier
repository: sidereus
topic: "S-03 deep sky beyond Messier: what ranking and logging bright NGC/IC objects requires"
tags: [research, catalogue, openngc, engine, ranking, tonight, observations, targets, i18n]
status: complete
last_updated: 2026-10-06
last_updated_by: Claude (Opus 5.5)
---

# Research: S-03 deep sky beyond Messier

**Date**: 2026-10-06 (Europe/Warsaw)
**Researcher**: Claude (Opus 5.5), with three read-only Sonnet workers (catalogue pipeline; ranking and Tonight identity; observation log)
**Git Commit**: c1036ad (main after #115, branch `feat/deep-sky-beyond-messier` created from it)
**Branch**: feat/deep-sky-beyond-messier
**Repository**: sidereus

## Research Question

Roadmap S-03 (`context/foundation/roadmap.md:132-145`, GitHub #67): *the user can see bright deep-sky objects that are not in the Messier catalogue ranked on Tonight with the same scoring, reasons and eyepiece pair as Messier objects, and can log them.* What does the codebase do today, where does it assume "deep sky = Messier", and what would a curated NGC/IC catalogue from the same pinned OpenNGC commit need?

## Summary

- **The "target identity by kind" from S-01 exists only in the log/URL layer.** `src/lib/targets/index.ts:33-36` defines `TargetKey = MessierKey | PlanetKey | MoonKey` and `TargetKind = "messier" | "planet" | "moon"`. No NGC/IC or "other deep-sky" kind exists in any inspected type. `targetKind()` returns `"messier"` for any key that is neither a planet nor the Moon (`targets/index.ts:63-68`), so an NGC key would be silently misclassified today. The roadmap's Foundations note says the identity was generalised "in the ranking and in the observation log" (`roadmap.md:97`). That is **partially supported**: the log was generalised; the deep-sky ranking and `TonightEntry` were not.
- **The engine ranks whatever catalogue it is given, but its types and tie-breaks are Messier-shaped.**
  - `rankObjects` takes `input.catalogue` (`src/lib/engine/ranking.ts:172-178`), and `buildTonight` defaults it to `MESSIER` (`src/lib/tonight/build.ts:589`).
  - `RankableObject` is `Pick<MessierObject, "id" | "messier" | …>` (`ranking.ts:32-43`).
  - Both tie-breaks subtract `object.messier` (`ranking.ts:211`, `:226`).
  - Scoring (`score.ts`), the eyepiece pair (`eyepieces.ts:92-129`), positions (`objects.ts:43`) and the verdict carry no Messier assumption beyond the type alias.
- **Tonight's view model uses the Messier number as the key for localised names.**
  - `TonightEntry` and `TonightWashedOutEntry` carry `messier: number`, documented as "the key for a localised common name" (`build.ts:100-107`, `:251-255`).
  - `localCommonName(messier: number, …)` is keyed by Messier number (`src/lib/catalogue/common-names.ts:11-52`). It is called from 4 components and 3 lib files (see Code References).
  - Row labels show the raw `id` ("M31", no space) and `#object-<id>` anchors use it (`ObjectCard.astro:24`, `build.ts:961,1065`).
  - Nothing carries a catalogue label or designation through to the UI.
- **The log needs a grammar widening in three places, plus picker/label branches.** The DB check `observations_target_key` (`supabase/migrations/20261001120000_observation_target_moon.sql:11-16`) mirrors `isTargetKey`. The S-02 pattern applies: drop and re-add the check, additively. The sync trigger needs no change for keys not matching `^M[0-9]{1,3}$` (`20260930120000_observation_target.sql:32-66`). Already-seen markers and the log penalty work for any key, because `seenSummaries` and `rankObjects` key on the string `object.id` (`engine/log.ts:32-49`, `ranking.ts:201`). They need a catalogue entry whose `id` equals its log key.
- **Picker search by catalogue name already mostly works.**
  - `filterTargets` falls back to an accent- and space-insensitive substring match over each option's `label` + `names`, after the Messier-only `NUMBER_QUERY = /^m?\s*(\d{1,3})$/` path (`src/lib/observations/target-search.ts:27,42-53`).
  - New options that carry their designation and names are therefore found by name. `ngc 7000` falls through to substring matching. A number-only query never reaches them.
- **OpenNGC at the pinned commit carries Caldwell cross-IDs** (checked against the raw files fetched to the scratchpad, never committed). The generator pins commit `da90466…` (`scripts/build-catalogue.mjs:18-22`).
  - The `Identifiers` column holds `C nnn` tokens for **105 distinct Caldwell numbers** of the 109. The missing four are C 9 (Sh2-155, not NGC/IC), C 14 (Double Cluster: no token, but an OpenNGC note on NGC 869 and NGC 884 says "Caldwell 14 refers to both"), C 41 (Hyades) and C 99 (Coalsack).
  - Of the 105, **60 lie at declination ≥ −23°**, which is reachable at 52° N above the default 15° minimum altitude (PRD param 8, `prd.md:530-535`). **45 lie below −23°**, 41 of them below −30°.
  - The Caldwell list can therefore be **derived** from the pinned data by the generator rather than typed by hand.
- **The generator would reject 16 Caldwell objects as-is**, because `toMessierObject` throws when `V-Mag` is empty (`build-catalogue.mjs:139-141`). 10 of them sit at dec ≥ −23°: C 4 Iris (NGC 7023), C 5 (IC 342), C 11 Bubble (NGC 7635), C 20 North America (NGC 7000), C 27 Crescent (NGC 6888), C 31 Flaming Star (IC 405), C 33/C 34 Veil (NGC 6992/6960), C 49 (NGC 2238), C 61 Antennae (NGC 4039).
  - Some of these have a `B-Mag`: NGC 7000 4.00, IC 342 9.68, NGC 4039 11.04.
  - The others have no magnitude at all in OpenNGC.
  - A magnitude policy (B-Mag fallback, documented overrides, or exclusion) is a required decision.
- **Two more data hazards.**
  - Type codes outside `TYPE_MAP` throw (`build-catalogue.mjs:28-41,133-136`). The 105 Caldwell rows use only mapped codes: G 35, OCl 24, GCl 18, PN 13, HII 6, Cl+N 3, Neb 3, SNR 2, RfN 1.
  - The naive `split(";")` parser (`:72-83`) mis-splits 247 rows whose quoted notes contain `;`. One is a Caldwell row (NGC 7331, 33 fields). The extra split falls in the notes columns (30+), after every column the generator reads (≤ 29, header-keyed), so the parsed values are still correct. This is an inference from the header order, not a test run.

## Detailed Findings

### 1. Catalogue pipeline (scripts/build-catalogue.mjs, src/lib/catalogue/)

**Fetch**
- Raw `NGC.csv` + `addendum.csv` from `https://raw.githubusercontent.com/mattiaverga/OpenNGC/<sha>/database_files/` (`build-catalogue.mjs:18-22`, `fetchCsv` `:63-70`).
- `EXPECTED_COUNT = 110` (`:23`).

**Selection and special cases**
- Rows are selected by a non-empty `M` column (`:170-173`).
- M102: the addendum `M102` Dup row is dropped and `NGC5866` is emitted as 102 (`:163-169`, recorded in `OVERRIDES` `:47-61`).
- `designationFor` normalises `NGC0224` to "NGC 224" and `Mel022` to "Mel 22" (`:112-122`).
- `commonNameFor` takes the first comma-separated common name (`:124-130`).

**Columns read** (`:132-158`)
- `Type`, `Name`, `Const`, `V-Mag`, `Common names`, `RA`, `Dec`, `MajAx`, `MinAx`, `B-Mag`, `SurfBr`, plus `M` for selection.
- `Identifiers`, `NGC`, `IC` and the notes are ignored today.

**Output and meta**
- Output key order: `id, messier, designation, commonName, type, raHours, decDeg, constellation, majorAxisArcmin, minorAxisArcmin, vMag, bMag, surfaceBrightness` (`:143-157`). It is written deterministically with no clock (`:12`, `:216-217`).
- Meta fields: `source, files, commit, retrievedAt (commit date), licence, count, overrides, normalisations, typeMap` (`:197-213`).

**Loader** (`src/lib/catalogue/index.ts`)
- Exports `MESSIER_TYPES` / `MessierType` (12 values, `:13-28`), `MessierObject` (`:30-51`, `id: \`M${number}\``, `messier: number`), `MESSIER`, `CATALOGUE_META` and `findMessier(n)` (`:181-188`).
- It validates at import: count 110, `messier` 1..110, `id === "M"+messier`, unique by `messier` (`:61`, `:115-121`, `:153-163`). `validateMeta` checks 5 fields (`:167-179`).
- `messier.test.ts` pins the shape, M102 = NGC 5866, and the meta commit SHA as a literal (`:5`, `:8-30`).

**Guards and licensing**
- `stars.ts:10-11` must never import `./index`, so `messier.json` stays out of browser chunks.
- `TonightSkyView.test.ts:11,72` forbids `@/lib/catalogue` in the sky island.
- `common-names.ts` is island-safe ("no imports beyond types").
- `.prettierignore` lists the 4 generated JSON files.
- `package.json:19` runs `catalogue:build`.
- `LICENSE-DATA.md:3-25` describes the Messier filter ("filtered to the 110 Messier objects", `:15`). A second OpenNGC-derived file needs that text extended.
- `Attribution.astro:11-25` already credits OpenNGC.

### 2. Scoring inputs and fallbacks (src/lib/engine/)

**Fields used**
- `ScoredObject = Pick<MessierObject, "id" | "vMag" | "surfaceBrightness" | "type" | "majorAxisArcmin" | "minorAxisArcmin">` (`score.ts:46-49`).

**`vMag`**
- An object fainter than the telescope's limiting magnitude returns null and is never ranked (`score.ts:132-134`).
- `vMag` also drives brightness (`:176`).
- `bMag` is not read by scoring.

**`surfaceBrightness`**
- If present, the Bortle penalty applies above 21 mag/arcsec² (`score.ts:96-102`, `parameters.ts:124`).
- If null, only `PENALIZED_TYPES_WITHOUT_SURFACE_BRIGHTNESS` are penalised (`parameters.ts:146-152`): galaxy, nebula, emission, reflection and supernova remnant. This is the roadmap risk's type fallback.

**`type`**
- `LOW_INTEREST_TYPES` takes −0.15 (`parameters.ts:117-118`).
- Moonlight sensitivity is set per type (`:340-353`).
- `WASHED_OUT_TYPES` is at `:378`.
- Every one of these is typed over `MessierType`. Mapping NGC/IC rows through the same `TYPE_MAP` keeps them valid without parameter changes.

**Axes**
- `effectiveSurfaceBrightness` returns null when `majorAxisArcmin` is null, so the object can never be washed out. A null minor axis is treated as round (`moonlight.ts:104-116`).

**Per-object data**
- The only per-object entry in parameters is `MOONLIGHT_EXEMPT_IDS = ["M16"]` (`parameters.ts:375`), keyed by `id`.

**Ranking** (`ranking.ts`)
- Ranking uses `rankScore = total − log penalty` (`:206`).
- The bar is on `total >= MIN_OBJECT_SCORE` (`:213`).
- The default limit is `MAX_RANKED_OBJECTS = 5` (`parameters.ts:68`); the Targets page passes `Infinity`.
- `reasonComponents` compares an entry against the listed entries (`:152-170`), so a larger candidate pool shifts each row's lead reason. That is a calibration effect.

**Tests pinning Messier**
- `ranking.test.ts:31-34` (a `synthetic()` helper with `id: M${n}`), `:80-91` (the Messier-number tie-break), and `:99-173` (full `MESSIER` runs).
- `determinism.test.ts:3,54-57,113,175` (full `MESSIER`, `LOCAL_BUDGET_MS = 1000` at `:31`, `:82-85`).
- About 60 extra objects is roughly a 1.5× tracking load on that local budget. That is an estimate; nothing was run.

### 3. Tonight view and UI (src/lib/tonight/, src/components/tonight/, src/lib/sky-view/)

**Pipeline**
- `loadTonightFor` → `loadTonight` → `buildTonight` (`island.ts:37-58`, `load.ts:96-176`, `load.ts:148`).
- The catalogue enters only at `build.ts:589`, typed `MessierObject` at `build.ts:86-87,452,462,697`.

**Entries**
- `TonightEntry` fields: `rank, id, messier, commonName, constellation, window*, bestTime, bestAt, bestDirection, pair, reason, seenText` (`build.ts:100-124`, mapped `:716-731`).
- `id` is also the log key (comment `build.ts:102`).
- `entry.messier` feeds `localCommonName` in `ObjectRow.astro:19`, `ObjectCard.astro:21`, `TargetsPageContent.astro:222` and `TonightTiles.astro:47`.

**Sky view and session plan**
- Sky view and session plan rows use `label: object.id`, `name: "${id} · ${commonName}"` and `href: /tonight/targets#object-${id}` (`build.ts:955-961`, `:1058-1068`).
- `TonightSkyBody.kind` is already `"object" | "planet" | "moon"` (`sky-view/view.ts:10-22`; comment `:14` says "the Messier number").
- Label width is estimated from `label.length` (`TonightSkyView.tsx:303`), so "NGC 7000" only changes placement.
- `SessionPlanRowInput.kind` is already generic (`session-plan.ts:11-15,50`).

**Anchors**
- Only `ObjectCard` (the top 5) renders `id="object-<id>"` (`ObjectCard.astro:24`); `ObjectRow` has `data-object` only (`:22`).
- The logged-row lookup uses `CSS.escape` (`pages/tonight/targets.astro:89-93`).
- A key with a space would also have to survive URL fragments. A space-free key avoids that (inference).

**"Point here first" tile**
- Takes the top `SUMMARY_TARGETS = 3` by rank (`build.ts:71,1152-1158`, `TonightTiles.astro:44-49`), so a mixed ranking can put NGC objects there. This bears on the "tie-break towards Messier" question.

**No Messier logic found in**
- `eyepieces.ts`, `verdict.ts`, `session-plan.ts`, `hash-scroll.ts`, `SeenTag.astro`, `ObjectDetails.astro`, `load.ts`, `island.ts`, `pages/tonight/all.ts`.
- `src/lib/offline/*` was checked by grep only.

### 4. Observation log (supabase/, src/lib/targets/, src/lib/observations/, pages)

**Database**
- `target text not null` with the check `observations_target_key`: the Messier regex, or 7 planets, or `moon` (`20260930120000_observation_target.sql:26-29`, widened in `20261001120000_observation_target_moon.sql:11-16`).
- The legacy `messier smallint` column is nullable with `check 1..110` (`20260926200000_observations.sql:15`).
- The trigger `observations_sync_target` derives `messier` only from `^M[0-9]{1,3}$`.
- RLS, indexes and `database.types.ts:58-98` (`target: string`) need no change for a new key.
- `tests/db/observations.test.ts:196-262` holds accept/reject/edit cases to extend. `tests/db/isolation.test.ts:79-94` needs none.

**Grammar** (`src/lib/targets/index.ts`)
- `MESSIER_KEY` `:38`, `isTargetKey` `:41-43`, `messierNumber` `:59-61`, `targetKind` `:63-68` (default `"messier"`).
- `parseTargetParam` `:74-80` also accepts bare digits as legacy Messier links. An `NGC…`/`IC…` key cannot collide with that.

**Schema and store**
- `observationInputSchema.target` is `z.custom<TargetKey>(isTargetKey)` (`observations/schemas.ts:59`).
- `returnTargetSchema` is `"log" | "targets" | "moon" | "planets"` (`:96`); NGC objects return to `targets`.
- The store reads and writes `target` only (`store.ts:99-233`).
- `listForRanking` filters by rating and orders deterministically (`store.ts:248-259`), satisfying the lessons.md list-query rule.

**Labels and picker**
- `targetLabel` sends every non-planet, non-Moon key through `findMessier(messierNumber(key))` and returns `{ id: key, name: null }` on a miss (`targets/labels.ts:22-35`). An NGC key would show bare.
- `targetOptions` builds options in this order: Messier (`label` "M31 · name", `detail` "NGC 224 · And", `names` = [localised, English, designation]), then the Moon, then the planets (`target-options.ts:13-39`).
- `TargetPicker.tsx` (over `forms/Combobox`) and `ObservationForm.tsx:135-147` take options built server-side, so they need no structural change.

**Routes and pages**
- `/log/new` reads `?object=` via `parseTargetParam` (`pages/log/new.astro:44`).
- Tonight's links come from `logHref` (`tonight/load.ts:183-194`), used at `TargetsPageContent.astro:63-64`.
- `POST /api/log`, `/api/log/[id]` and `/api/log/[id]/delete` are key-agnostic.

**Copy to reword**
- `log.manualIntro` "Pick a Messier object, the Moon or a planet…" (`en.ts:967-968`, `pl.ts:853`).
- The picker placeholder "e.g. 31, Andromeda or Jupiter" (`en.ts:979`).
- `errors.observation.objectInvalid` "Choose a Messier object from M1 to M110." (`en.ts:1116`, `pl.ts:995`).
- The landing kicker "Messier 1 – 110 · your sky, your kit" (`en.ts:95`, `pl.ts:77`).

### 5. OpenNGC data at the pinned commit (scratchpad check)

**Files**
- `NGC.csv` has 13,970 data rows and 32 columns. `addendum.csv` has 64 rows.
- Header: `Name;Type;RA;Dec;Const;MajAx;MinAx;PosAng;B-Mag;V-Mag;J-Mag;H-Mag;K-Mag;SurfBr;Hubble;Pax;Pm-RA;Pm-Dec;RadVel;Redshift;Cstar U-Mag;Cstar B-Mag;Cstar V-Mag;M;NGC;IC;Cstar Names;Identifiers;Common names;NED notes;OpenNGC notes;Sources`.

**Caldwell coverage**
- 105 of the 109 Caldwell numbers appear as `C nnn` in `Identifiers`, each on exactly one row.
- The missing four are listed in the Summary.
- By declination:

| Set | Count |
|---|---|
| Caldwell rows in OpenNGC | 105 |
| …at dec ≥ −23° | 60 |
| …at dec < −23° | 45 |
| …at dec ≥ −30° with V-Mag ≤ 10 | 34 |
| …at dec ≥ −30° with V-Mag ≤ 11 | 47 |
| …with empty V-Mag (all declinations) | 16 |
| …with empty V-Mag at dec ≥ −23° | 10 |

**Broader NGC/IC pool (for comparison)**
- 271 NGC/IC rows have no `M` and V-Mag ≤ 9.0 (excluding `Dup`, `NonEx`, `*`).
- Most of them are open clusters: OCl 203, GCl 27, Cl+N 13, G 8, PN 7, Neb 4, HII 3, \*Ass 3, \*\* 2, Other 1.
- A magnitude cut alone would flood the list with faint-looking open clusters, which is why a curated basis such as Caldwell fits the roadmap candidate better.

## Code References

- `scripts/build-catalogue.mjs:18-23` — pinned SHA, source URL, files, `EXPECTED_COUNT`
- `scripts/build-catalogue.mjs:28-41,132-158,139-141,160-190` — type map, row mapping, V-Mag required, Messier validation
- `src/lib/catalogue/index.ts:13-61,115-188` — types, Messier-only validation, exports
- `src/lib/catalogue/common-names.ts:11-52` — PL names keyed by Messier number
- `src/lib/engine/ranking.ts:32-43,172-178,201,206,211,213,226` — rankable type, input, seen lookup, scores, tie-breaks
- `src/lib/engine/score.ts:46-49,96-102,132-134` — scored fields, SB fallback, limiting magnitude
- `src/lib/engine/parameters.ts:68,117,124,146-152,340-353,375,378` — limits and per-type tables
- `src/lib/tonight/build.ts:71,86-87,100-124,251-255,589,697,716-736,955-961,1058-1068,1152-1158` — view model and catalogue entry
- `src/components/tonight/ObjectRow.astro:19-36`, `ObjectCard.astro:21-35`, `TargetsPageContent.astro:63-70,221-241`, `TonightTiles.astro:44-49` — UI consumers
- `src/lib/sky-view/view.ts:10-22`, `src/components/tonight/TonightSkyView.tsx:303` — sky bodies
- `src/lib/targets/index.ts:33-80`, `src/lib/targets/labels.ts:22-35` — key grammar and labels
- `src/lib/observations/target-options.ts:13-39`, `target-search.ts:27,42-53`, `schemas.ts:59,96` — picker and validation
- `supabase/migrations/20260930120000_observation_target.sql:26-66`, `20261001120000_observation_target_moon.sql:11-16` — check and trigger
- `tests/db/observations.test.ts:196-262`, `src/lib/engine/ranking.test.ts:31-34,80-91`, `determinism.test.ts:31,82-85` — tests to extend
- `src/i18n/messages/en.ts:95,967-968,979,1116` (+ `pl.ts:77,853,995`) — Messier-only copy

## Architecture Insights

- **Generated data, never hand-edited.** A curated NGC/IC list fits the existing pattern: generator plus pinned commit, committed JSON plus meta, a shape and provenance test, and a `.prettierignore` entry. Because Caldwell IDs are in the source, the selection rule can live in the generator (Caldwell, dec floor, Messier excluded by construction) with documented overrides, mirroring M102.
- **Server-only data, island-safe names.** Catalogue JSON must stay out of islands (`stars.ts`, `TonightSkyView.test.ts`). Localised names live in an island-safe TS map. For NGC/IC that map needs a key space that cannot collide with Messier numbers, e.g. the string `id`.
- **One key per target, everywhere.** The catalogue `id` doubles as the log key, the `seen` key, the DOM anchor and the URL `?object=` value. A space-free key (e.g. `NGC7000`, `IC405`) suits all four. The display designation ("NGC 7000") is a separate field, as Messier already has `designation`.
- **Closed grammar, extended in step.** The TS grammar (`targets/index.ts`), the DB check and labels/options change together (S-01 `plan.md:61-66`). S-02 showed the additive, trigger-free migration.

## Historical Context (from prior changes)

- `context/archive/2026-09-30-planets-on-tonight/plan.md:61-66` — "The grammar is closed. S-02 and S-03 extend it together with the database check." (supported: still true at c1036ad)
- `context/archive/2026-09-30-planets-on-tonight/plan.md:47,49` — S-01 left non-Messier deep sky and the deep-sky top-five calibration untouched (supported)
- `context/archive/2026-09-30-planets-on-tonight/plan.md:485` and `context/archive/2026-10-01-moon-as-target/plan.md:103` — dropping `observations.messier` and the sync trigger "waits until S-03 has settled the grammar" (supported; an open choice for this change)
- `context/archive/2026-10-01-moon-as-target/plan.md:286` — add a new kind rather than overloading `messier` (precedent for a `deep-sky`/`ngc` kind)
- `context/archive/2026-10-01-moon-as-target/research.md:60` — noted that `targetKind` defaults non-planet keys to Messier (still true, `targets/index.ts:63-68`)
- `context/archive/2026-09-22-verified-ephemeris-core/plan-brief.md:23-24` — generator → committed JSON with pinned commit; M102 override rationale
- `context/foundation/roadmap.md:97` — identity "by kind … in the ranking and in the observation log" folded into S-01: **partial**, the ranking was not generalised
- `context/foundation/prd.md:478-480` — M-1 Non-Goal "anything outside the Messier catalogue" (superseded for M-2 by MS-03 in the roadmap; the PRD text itself still says it)

## Related Research

- `context/archive/2026-10-01-moon-as-target/research.md` — the target-grammar extension for the Moon
- S-01 (`context/archive/2026-09-30-planets-on-tonight/`) has no research.md, only plan and reviews

## Open Questions

Product and UI (user):

1. **Which objects.** The candidate is the Caldwell list derived from OpenNGC `Identifiers`, minus objects that never clear 15° at the user's latitudes (a dec floor such as −23°, keeping 60), plus C 14 by hand (two rows or one). Alternatives: a magnitude or size cut; Caldwell plus a few famous non-Caldwell objects (e.g. NGC 7789, the Double Cluster split).
2. **Mixing with Messier.** Rank together, with a Messier-first tie-break only (as the roadmap candidate says)? Or keep Messier first in the top 5 / "Point here first"? And should the rows label the catalogue ("NGC 7000", "Caldwell 20") or show both?
3. **Display designation.** "NGC 7000" vs "C 20 · NGC 7000". Beginners' guides often use Caldwell numbers.

Technical (delegable):

4. **Key shape.** `NGC7000` / `IC405`: no leading zeros, no space, regex `^(NGC|IC)[1-9][0-9]{0,3}$`. A `C20` key would collide with nothing but ties the log to one list.
5. **Missing V-Mag** for 10 reachable objects: B-Mag fallback where present, documented overrides from published values, or exclusion.
6. **Catalogue type and module.** Generalise `MessierObject` into a deep-sky object (`messier: number | null`, a `catalogue`/`caldwell` field) with one loader, or keep a second module. Consequences: `RankableObject`, the `TonightEntry.messier` name key, tie-breaks, `localCommonName`'s key.
7. **Polish names** for the new objects (a parallel map keyed by id) and copy rewording (four strings listed in §4).
8. **Contract migration.** Drop `observations.messier` and the trigger now that the grammar settles, or defer again.
9. **Calibration check.** Compare the new objects' ranks against published seasonal lists (roadmap Risk). Re-measure the determinism budget with the larger catalogue.
10. **Moonlight exemptions** (`MOONLIGHT_EXEMPT_IDS`) for any NGC/IC bright-core-in-nebula objects.
