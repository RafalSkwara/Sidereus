---
date: 2026-10-14T09:40:00+02:00
researcher: Claude (what-to-expect agent, herdr run)
git_commit: 172c0cf3b9702b657e0e28ab684df0b02eebf676
branch: feat/what-to-expect
repository: RafalSkwara/Sidereus
topic: "M-3 S-04 what-to-expect: the data, the surfaces, the plan gate and the phrase-set rule (PRD FR-038, US-05, OQ17)"
tags: [research, what-to-expect, catalogue, engine, account-plan, tonight, finder-chart, offline, i18n]
status: complete
last_updated: 2026-10-14
last_updated_by: Claude (what-to-expect agent)
---

# Research: What to expect (M-3 S-04)

**Date**: 2026-10-14T09:40:00+02:00
**Researcher**: Claude (what-to-expect agent, herdr run; three Sonnet Explore workers plus local checks)
**Git Commit**: 172c0cf (main at branch cut)
**Branch**: feat/what-to-expect
**Repository**: RafalSkwara/Sidereus

## Research Question

With each ranked target, what will it look like in the user's own telescope from their site? This is a plain-language line from a fixed phrase set, chosen by object type, surface brightness against the site's sky quality, and aperture (PRD FR-038, US-05's third clause, OQ17). It is a full-plan feature (FR-045). The research covers:

- the data the codebase already has;
- where the line would render;
- how to gate it;
- what offline storage does with it;
- what the parallel S-07 sky-events change touches;
- published references for the rule's thresholds.

## Summary

- **Requirement.** FR-038 (`context/foundation/prd.md:446`) asks for "a plain-language line on what to expect in their own telescope from their site". Its examples are "a faint grey smudge; use averted vision" and "a bright, tight ball of stars that resolves at the edge". The line is "derived from the object's type, size and brightness, the aperture and the site's sky quality". Plan: full.
  - US-05's acceptance criterion (`prd.md:188-189`) repeats the same five inputs.
  - US-05 itself (`prd.md:174-189`) puts the line on the finder chart.
  - FR-038 says "with each ranked object".
  - OQ17 (`prd.md:734-737`) is the candidate rule: a fixed phrase set by type, surface brightness against sky quality, and aperture, judged without an observer.
- **Data needed.**
  - Type, magnitude and size are on every catalogue object. The exceptions are the major axis, missing for M40 and M73 (§1).
  - Sky quality is the site's Bortle class 1-9, the only stored measure (§2).
  - Aperture is `TelescopeRecord.apertureMm` (§2).
  - The engine already turns these into the numbers a rule needs: a core surface brightness for every object with a size (`effectiveSurfaceBrightness`, `src/lib/engine/moonlight.ts:103-112`), the sky brightness per Bortle (`darkSkyZenithMagForBortle`, `parameters.ts:316-328`) and a telescope limiting magnitude (`telescopeLimitingMag`, `score.ts:92-94`, not in the barrel).
  - Nothing computes "resolvability" of a cluster, concentration, or apparent size in the eyepiece. A rule has to derive these, and the plan must record them as new candidates.
- **Planets and the Moon.** Both already ship a fixed, free "what a 100-200 mm telescope shows" note:
  - planets: `tonight.planets.note[key]`, `src/i18n/messages/en.ts:623-632`, set at `src/lib/tonight/build.ts:855`;
  - Moon: `tonight.moon.note[band]`, `en.ts:715-730`, `build.ts:912`.
  - FR-045 (`prd.md:461`) keeps everything shipped before v3 free, so those notes cannot be gated.
  - The new, gated line is therefore naturally the **deep-sky** line. Whether planets also get an aperture-aware line is a plan decision (§7).
- **Surfaces.** Every ranked deep-sky row on `/tonight/targets` renders through one component, `ObjectDetails.astro` (`src/components/tonight/ObjectDetails.astro:21-49`): `ObjectCard` covers the best five and `ObjectRow` the rest.
  - The finder chart page (`FinderContent.astro`, chart state at `:81-94`) shows no such line today. The S-03 plan explicitly left it to S-04 (`context/archive/2026-10-11-finder-chart/plan.md:50`).
  - The dashboard tile lists only names and best times (`TonightTiles.astro:41-47`), so it needs nothing.
- **Gating.** The view model `TonightView` / `TonightEntry` is built for every plan (`build.ts:110-143`, `:760-781`), so a line computed there would reach free accounts' HTML. The finder's pattern is to check the plan inside the island, which is replayable at `/_server-islands/*` without the shell.
  - `requireFullPlan` is in `src/lib/finder/load.ts:102-104`.
  - `getAccountPlan` (`src/lib/account-plan/index.ts:67`) is memoised per request, and every Tonight island already starts that read (`TargetsPageContent.astro:56`).
  - So the island can branch on the plan at no extra query. The text stays out of `TonightView`, and `loadTonightFor`, `island.ts` and `load.ts` stay untouched.
- **Offline.** A stored `/tonight/targets` pair that contains full-plan text is not dropped when the plan is lost. Only finder pairs are (`src/lib/offline/copies.ts:371-414`). Such a copy is replaced at the next online visit to that page, or expires 36 h after its site's last refresh (`EXPIRY_MS`, `copies.ts:39`). This is a plan decision (§5).
- **S-07 overlap.** S-07 changes `TonightView`, `build.ts`, `load.ts`, `island.ts`, `TONIGHT_PAGES`, the dashboard tiles, `VerdictCard`, `TonightContent`, `TonightSkeleton`, `sky-band.ts` and the dashboard/phone specs (sky-events `plan.md:153-472`).
  - S-07 touches no `ObjectDetails`, `ObjectCard`, `ObjectRow`, `TargetsPageContent`, `PlanetCard`, finder components or `src/lib/finder`.
  - The shared files are `en.ts` / `pl.ts`, `parameters.ts`, `design.astro`, `CLAUDE.md` and `roadmap.md`. All of these are textual merge conflicts, not semantic ones (§6).

## Detailed Findings

### 1. Catalogue data (type, brightness, size)

- `DeepSkyObject` (`src/lib/catalogue/index.ts:33-58`) has these fields:
  - `type`, from the 12-value `DEEP_SKY_TYPES` at `index.ts:16-29`;
  - `vMag`, non-null for all 171 objects, range 1.2-14.1;
  - `majorAxisArcmin` and `minorAxisArcmin`;
  - `surfaceBrightness` (mag/arcsec², galaxies only: null for all 103 non-galaxy objects across both lists);
  - `id`, `label` and `commonName`.
- Type counts (Messier / Caldwell, counted from the JSON):

  | Type | Messier | Caldwell |
  |---|---|---|
  | galaxy | 40 | 28 |
  | globular-cluster | 29 | 3 |
  | open-cluster | 26 | 10 |
  | planetary-nebula | 4 | 9 |
  | nebula | 4 | 2 |
  | emission-nebula | 1 | 4 |
  | reflection-nebula | 1 | 1 |
  | supernova-remnant | 1 | 2 |
  | cluster-with-nebula | 1 (M42) | 2 (IC5146, NGC2244) |
  | asterism | 1 (M24) | 0 |
  | double-star | 1 (M40) | 0 |
  | other | 1 (M73) | 0 |

- `majorAxisArcmin` is null for exactly M40 and M73. `minorAxisArcmin` is null for 62 Messier and 22 Caldwell objects, including every globular.
- There is no concentration class, star count, Hubble type or description field. Localised common names only are in `src/lib/catalogue/common-names.ts`.
- Core surface brightness from `effectiveSurfaceBrightness` (vMag spread over π/4·a·b, less `BRIGHT_CORE_OFFSET_MAG` = 1.5; `moonlight.ts:103-112`, `parameters.ts:376`), computed locally over all 171 objects. Median by type (min-max in brackets):
  - planetary nebula: 16.4 (12.7-21.1);
  - globular: 19.0 (17.0-20.7);
  - open cluster: 18.9 (16.5-25.6);
  - galaxy: 20.6 (19.2-23.3);
  - emission nebula: 22.3 (20.0-23.3);
  - nebula: 21.8 (19.1-25.1).

  The catalogue's own `surfaceBrightness` is a whole-ellipse mean without the core offset. It is used only by the sky penalty (`score.ts:96-102`).
- **Contrast distribution.** The deficit is core SB − sky (`darkSkyZenithMagForBortle`), over the 169 objects with a size:

  | Bortle | < 0 (core brighter than sky) | 0-1.5 | 1.5-2.5 | 2.5-3.5 | ≥ 3.5 (washed-out band) |
  |---|---|---|---|---|---|
  | 3 | 143 | 19 | 4 | 0 | 3 |
  | 5 | 93 | 56 | 12 | 5 | 3 |
  | 7 | 39 | 60 | 38 | 19 | 13 |

  A contrast band therefore separates objects meaningfully and moves with sky class. The engine's washed-out rule uses the same deficit against the moonlit sky, with a threshold of `WASHED_OUT_CONTRAST_MAG` = 3.5 (`score.ts:164-168`, `parameters.ts:370`).

### 2. Site, telescope and the engine's sky numbers

- **Sky quality.** `sites.bortle smallint not null check (1..9)` (`supabase/migrations/20260924120000_sites_and_gear.sql:16`) is the only sky-quality field; a grep for SQM found none. It is `SiteRecord.bortle` (`src/lib/gear/store.ts:28`) and reaches the ranking at `build.ts:742-753`.
- **Telescope.** `TelescopeRecord` is `apertureMm` plus `focalLengthMm` (`store.ts:35-41`). There is no optical type and no obstruction field.
- **Eyepieces.** `EyepieceRecord` is `focalLengthMm` plus `afovDeg` (`store.ts:43-49`). The ranking's pair comes from `pairEyepieces` (`src/lib/engine/eyepieces.ts:92-123`). `TonightEntry.pair` carries only the names and magnifications (`build.ts:491-511`).
- **Engine numbers a rule can reuse.** All are candidates in `src/lib/engine/parameters.ts`, a file with no runtime imports:
  - `DARK_SKY_ZENITH_MAG` / `darkSkyZenithMagForBortle`, Bortle to mag/arcsec² (`:316-328`);
  - `nakedEyeLimitingMagForBortle` (`:82-88`);
  - `EYE_PUPIL_REFERENCE_MM` = 7 (`:97`);
  - `telescopeLimitingMag(bortle, aperture)` (`score.ts:92-94`; exported from `score.ts`, not from the `src/lib/engine/index.ts` barrel). `scoreObject` drops anything fainter (`score.ts:131-134`), so every ranked object is within that limit.
- **Existing type groupings** (`parameters.ts`):
  - `MOONLIGHT_SENSITIVITY` by type (`:347-360`);
  - `WASHED_OUT_TYPES` (`:385-393`);
  - `PENALIZED_TYPES_WITHOUT_SURFACE_BRIGHTNESS` (`:146-152`);
  - `LOW_INTEREST_TYPES` (`score.ts:189`).

  None of them describes "stars vs glow", which is what wording needs. A new grouping is needed, or a reuse documented in the plan.
- **Moonlight.** `ObjectScore.washedOut` is a boolean, and washed-out objects are never ranked (`ranking.ts:99-117, 209-254`). The deep-sky reason line already speaks about the Moon (`tonight.reason.moon.*`, `en.ts:741-760`). FR-038 lists no Moon input, and it is the only listed requirement for this line.

### 3. Where ranked targets render

- **`/tonight/targets`.** The shell is `src/pages/tonight/targets.astro:45-58`, and the island `TargetsPageContent.astro`:
  - it loads at `:58` through `loadTonightFor(…, { limit: Infinity })`;
  - the best five render through `ObjectCard` (`:163-169`) and the rest through `ObjectRow` in `<details id="more">` (`:221-223`);
  - both use `ObjectDetails` (`ObjectCard.astro:50`; `ObjectRow.astro:61-64`), whose slot shows the eyepiece pair, the none-fit line and `entry.reason` (`ObjectDetails.astro:31-48`);
  - `load.site` and `load.telescope` (full records, with `bortle` and `apertureMm`) are in scope in the island (`src/lib/tonight/load.ts:65-85`).
- **`TonightEntry`** (`build.ts:110-143`) has no type, magnitude, size, aperture or Bortle. A line can be computed either:
  - (a) in the island from `findDeepSky(entry.id)`, `load.site.bortle` and `load.telescope.apertureMm`. The finder loader already does `findDeepSky(target)` server-side (`src/lib/finder/load.ts:79`); or
  - (b) in `buildTonight` beside `reason` (`build.ts:755-781`). That touches the file S-07 changes and puts the text in the plan-blind view.
- **`/tonight/planets`.** `PlanetsPageContent.astro` → `SolarSystemSection.astro:25-31` → `PlanetCard.astro`, whose slot shows the eyepiece, `entry.reason` and `entry.note` (`PlanetCard.astro:54-62`).
- **Finder chart.** The shell is `src/pages/tonight/finder.astro`, the island `FinderContent.astro`, and the loader `loadFinderFor` (`src/lib/finder/load.ts`):
  - the chart state (`load.ts:181`, `FinderContent.astro:81-94`) holds the view, the chart and the labels;
  - the loader has the catalogue object (`:79`) and the full plan already proven (`:102`), so a line there needs no extra gate;
  - planets also have finder charts (`from=planets`).
- **Dashboard.** The "Point here first" tile shows the name, best time and not-seen mark only (`TonightTiles.astro:41-47, 111-139`). It is out of scope.
- **Moon.** The Moon has no finder chart and its own band notes. It is out of scope.

### 4. The plan gate

- `src/lib/account-plan/index.ts` provides:
  - `getAccountPlan(locals)` (`:67`; memoised, `readOnce` `:54-61`; a failed or unknown read is `free`);
  - `accountPlanForCopy` (`:78`, offline metadata only, never access);
  - `requireFullPlan` (`:89-100`).

  Islands never import the store. The middleware never reads the plan (CLAUDE.md, Request flow).
- **Finder precedent.**
  - The shell checks the plan (`finder.astro:38`) and so does the island's loader (`load.ts:102`), because `/_server-islands/*` replays without the shell.
  - A free account sees `FinderLocked`, a 200 explainer with a fixed example and an info `Notice` (`src/components/finder/FinderLocked.astro`; copy `tonight.finder.locked.*`, `en.ts:879+`).
  - The "Finder chart" link is shown to every account (`TargetDetails.astro:71-76`), with the gate at the destination.
  - `scripts/smoke.mjs:238-313` proves both layers over HTTP (`bodyIncludes` / `bodyExcludes`).
- **Tonight islands today.** They call `void getAccountPlan(Astro.locals)` only to start the read for `OfflineCopy`'s `data-plan` (`TargetsPageContent.astro:56`, `PlanetsPageContent.astro:55`). No row component takes a plan prop.
- **What FR-045 requires for this feature** (`prd.md:461`):
  - a free account sees "what they do and that they need the full plan - never as an error or an empty state";
  - "the server enforces the plan".

  For an inline line there is no destination page. A free row therefore needs a short locked line or a single explainer per page, in the same way as `NotSeenLegend` (`TargetsPageContent.astro:213`).

### 5. Offline copies

- `/tonight/targets` and `/tonight/planets` are already in `TONIGHT_PAGES` (`copies.ts:11-18`), so a per-row line needs no page-list change.
- On a free island, `commitPair` (`copies.ts:371-396`) and `dropFinderCopies` (`:405-414`) drop **finder** pairs only. A stored Targets pair with full-plan text survives a plan loss until one of these happens:
  - the next online visit to that page replaces it;
  - its next-night copy is refreshed (hourly, `NEXT_REFRESH_MS`);
  - it expires 36 h after its site's last refresh (`EXPIRY_MS`, `:39`).
- The text is derived from public catalogue data and the user's own gear, and carries no personal data or coordinates. Two options:
  - accept the window and document it;
  - widen the plan-loss drop to Targets and Planets pairs in `copies.ts` and `copies.test.ts`, which S-07 also edits for `TONIGHT_PAGES`.

### 6. The parallel S-07 sky-events change

- The sibling worktree `feat/sky-events` has two docs-only commits on main (`2823909`, `aaaf31f`). No source code has changed yet.
- Its plan changes:
  - `parameters.ts` (`EVENT_*`, `PAIRING_*`, `METEOR_*` candidates);
  - `build.ts`, `load.ts` and `island.ts` (`withSkyEvents`, `TonightView.skyEvents`);
  - `TONIGHT_PAGES` (adds `/tonight/events` last) and `copies.test.ts`;
  - `offline.astro` and `sw.ts`;
  - `no-console-guard.test.ts`;
  - `TonightContent`, `TonightTiles`, `TonightSkeleton`, `VerdictCard` and `sky-band.ts`;
  - `design.astro`;
  - `en.ts` / `pl.ts` (`tonight.events.*`, `tonight.summary.events`, `tonight.pages.events`, `targets.meteorShower.*`);
  - `tonight-dashboard.spec.ts`, `tonight-phone.spec.ts` and `sky-events.spec.ts`;
  - `CLAUDE.md` (sky-events `plan.md:153-165, 354-390, 444-472`).
- It touches none of `ObjectDetails`, `ObjectCard`, `ObjectRow`, `TargetDetails`, `TargetsPageContent`, `PlanetCard`, `PlanetsPageContent`, `src/components/finder/**` or `src/lib/finder/**`.
- Conflict-free choices for S-04:
  - its own `tonight.expect.*` i18n sub-object;
  - an `EXPECT_*` block in `parameters.ts`;
  - no new log line, which keeps `ALLOWED_DISABLES` unchanged;
  - no edit to `build.ts`, `load.ts`, `island.ts`, `copies.ts` or the dashboard;
  - a separate `design.astro` section.
- `tonight-phone.spec.ts` fails on sideways scroll at 320 and 375 px and covers the Targets page list (`:35-38`). A longer Polish line must wrap.

### 7. Published references for the thresholds

These are judged without an observer (roadmap Open Roadmap Question 1, `roadmap.md:218`; the PRD calls it "Open Question 2", `prd.md:737`, a stale number).

- **Globular resolution vs aperture.** Several published observing guides agree:
  - a 4-inch (≈100 mm) starts to resolve M13's outer edge into points;
  - about 4.5-6 inches (115-150 mm) gives a clearly resolved edge;
  - the core does not resolve in amateur apertures.

  Sources: [Astronomy, "101 must-see cosmic objects: the Hercules Cluster"](https://www.astronomy.com/observing/101-must-see-cosmic-objects-the-hercules-cluster/); [Astronomy, Glenn Chaple, "Bust out the big boy"](https://www.astronomy.com/observing/glenn-chaples-observing-basics-bust-out-the-big-boy/); [Princeton, "Globular Clusters in Hercules"](https://www.princeton.edu/~rpascal/astro5.html); [Starlust, "M13 Globular Cluster"](https://starlust.org/m13-globular-cluster/).

  M13 (core SB 17.0 by the formula above) is the brightest globular in the north. Fainter globulars need more aperture. This finding comes from search summaries; the full articles were not read.
- **Extended-object visibility vs sky.** A common rule of thumb puts the threshold at about 5 % of the sky background. In magnitudes, an object is detectable up to about 3.25 mag/arcsec² fainter than the sky ([J. R. Torres, "On the Prediction of Visibility for Deep Sky Objects"](https://www.uv.es/jrtorres/visib.html); [Wikipedia, Surface brightness](https://en.wikipedia.org/wiki/Surface_brightness)). The author himself warns that such rules are rough.
  - The engine's washed-out threshold (3.5 mag) sits in the same place, so a "faint, averted vision" band just inside it and a "washed out" band beyond it are consistent with the existing rule.
  - [RASC Calgary's sky-glow table](https://calgary.rasc.ca/lp/skyglow.html) rates skies of 21.3-20.8 mag/arcsec² as having a modest impact on deep-sky work, and 20.8-20.1 as serious. That matches the Bortle 4-5 values in `DARK_SKY_ZENITH_MAG`.
- **Calibration template.** The finder chart's D-11 (`context/archive/2026-10-11-finder-chart/plan.md:69`) and the ranking oracle use a committed, source-cited fixture with a rule fixed in advance. They are `src/lib/engine/fixtures/finder-reference.ts` and `beginner-reference.ts` (header `:1-10`); the latter counts an object only when at least 2 published sources name it.

  A what-to-expect fixture would pin a handful of objects to the band that published small-telescope descriptions give them, for example:
  - M13 resolving at the edge in 150 mm;
  - M57 a small ring;
  - M33 hard from a suburban sky;
  - M42 bright with structure.

## Code References

- `context/foundation/prd.md:174-189`: US-05, including the what-to-expect clause and its acceptance criterion.
- `context/foundation/prd.md:446`: FR-038.
- `context/foundation/prd.md:461`: FR-045, the plan gate and "never an error or an empty state".
- `context/foundation/prd.md:734-737`: OQ17, the candidate phrase-set rule.
- `context/foundation/roadmap.md:137-148, 218`: S-04 slice; Open Roadmap Question 1.
- `src/lib/catalogue/index.ts:16-58`: `DEEP_SKY_TYPES`, `DeepSkyObject`.
- `src/lib/engine/moonlight.ts:103-112`: `effectiveSurfaceBrightness`.
- `src/lib/engine/score.ts:92-102, 131-134, 164-168`: telescope limit, sky penalty, the limit filter, washed-out contrast.
- `src/lib/engine/parameters.ts:82-97, 146-152, 316-328, 347-393`: limiting magnitudes, the sky table, type groupings.
- `src/lib/tonight/build.ts:110-143, 755-781, 855, 912`: `TonightEntry`, the row mapping, the planet and Moon notes.
- `src/components/tonight/ObjectDetails.astro:21-49`: the one deep-sky details slot.
- `src/components/tonight/TargetsPageContent.astro:56-75, 163-169, 213, 221-223`: the plan read, the rows and the legend.
- `src/components/tonight/PlanetCard.astro:54-62`: planet slot with the existing `note`.
- `src/lib/finder/load.ts:79, 102-104, 181`: catalogue lookup, plan guard, chart state.
- `src/components/finder/FinderContent.astro:81-94`: chart state rendering.
- `src/components/finder/FinderLocked.astro`: the locked-explainer precedent.
- `src/lib/account-plan/index.ts:54-100`: plan reads and the guard.
- `src/lib/offline/copies.ts:11-18, 39, 371-414`: stored pages, expiry, plan-loss drop (finder only).
- `src/i18n/messages/en.ts:623-632, 715-730, 741-760, 879+`: planet and Moon notes, reason phrases, finder locked copy.
- `scripts/smoke.mjs:238-313`: HTTP proof of the finder's plan layers.
- `tests/e2e/helpers.ts:180-212`: `requirePlanGrant`, `setPlan`, `finderLink`.

## Architecture Insights

- Wording comes from fixed i18n phrase sets keyed by an engine enum. The planet notes are keyed by `PlanetKey`, the Moon notes by `MoonPhaseBand`, and the reason lines by score component through `createFormatter` (`src/lib/tonight/format.ts:281-312`). A what-to-expect set keyed by a pure engine classification (type group × contrast band × aperture band) fits this pattern. It keeps the engine locale-free and deterministic, as the purity test requires.
- Full-plan content is computed server-side after the plan check inside the island, never by the shell and never in the plan-blind `TonightView`.
- Every number is a named "Candidate" in `parameters.ts`, with calibration by a committed, source-cited fixture.

## Historical Context (from prior changes)

- `context/archive/2026-10-11-finder-chart/plan.md:50`: "No what-to-expect line (FR-038, US-05's third clause): that is S-04 `what-to-expect`, which will add it to this page." Supported; no slot is reserved.
- `context/archive/2026-10-11-finder-chart/plan.md:69` (D-11): calibration without an observer through a source-cited reference fixture. This is the template.
- `context/archive/2026-09-30-planets-on-tonight/plan.md:26-32, 66-75`: the planet card's "fixed note on what to expect", a closed grammar, and the numbers as "new, uncalibrated" candidates.
- `context/archive/2026-10-08-testing-ranking-invariants-and-calibration-oracle/plan.md:270-296` and `context/foundation/test-plan.md:154`: the reference-fixture rules (sources cited, rule fixed before comparing, never edited to make a test pass).

## Related Research

- `context/archive/2026-10-11-finder-chart/research.md`: plan gating, offline finder copies.
- `context/changes/sky-events/research.md` (sibling worktree, not read): S-07.

## Open Questions

These go to the plan. Technical choices are decided there; product choices go to the owner if they change what the user sees.

1. **Scope.** Is the gated line deep-sky only, with the free planet and Moon notes as they are, or do planets also get an aperture-aware line? Should the finder chart show the line for planets (reusing the free note) as well as for deep-sky objects?
2. **What a free account sees.** One explainer per page (like `NotSeenLegend`), or a short locked line in every row?
3. **Plan loss and offline copies.** Accept that a stored Targets copy can keep the text until it is replaced or expires, or widen the drop in `copies.ts` (shared with S-07)?
4. **Whether the Moon tonight modifies the line.** FR-038 lists no Moon input, and the reason line and the washed-out rule already speak about the Moon.
5. **Classification for types without stars-vs-glow data:** planetary nebulae (small and bright), cluster-with-nebula, asterism / double star / other (M24, M40, M73).
6. **Polish phrasing**, which is reviewed by the owner like the rest of the catalogue.
