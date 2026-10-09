---
date: 2026-10-09T21:13:05+02:00
researcher: Claude (coder agent)
git_commit: c2ad0b5f9932ad85bfdf18494e185297afe35659
branch: feat/observing-progress
repository: RafalSkwara/Sidereus
topic: "Observing progress (M-3 S-05): Messier and Caldwell checklists, firsts and \"not seen yet\" marks on tonight's targets (FR-039, FR-040, US-06)"
tags: [research, observations, log, ranking, tonight, progress, catalogue]
status: complete
last_updated: 2026-10-09
last_updated_by: Claude (coder agent)
---

# Research: Observing progress (M-3 S-05)

**Date**: 2026-10-09T21:13:05+02:00
**Researcher**: Claude (coder agent)
**Git Commit**: c2ad0b5 (origin/main at branch point)
**Branch**: feat/observing-progress
**Repository**: RafalSkwara/Sidereus

## Research Question

What does the codebase already provide for roadmap M-3 S-05 (GitHub #126), and what must a plan settle? The slice covers:

- FR-039: the Messier and Caldwell checklists, each with a count ("47 / 110"), and the planets and the Moon as "firsts". All of it is filled from log entries rated 3 or above.
- FR-040: a "not seen yet" mark on tonight's targets that were never logged with a rating of 3 or above.
- US-06 acceptance: deleting or re-rating an entry updates the counts and the marks.
- The PRD invariant: "A log entry rated 1-2 of 5 never ticks a checklist" (`context/foundation/prd.md:579`).

## Summary

- **The "seen" rule already exists in one place.**
  - `seenSummaries(entries, onOrBefore)` (`src/lib/engine/log.ts:32-49`) counts only entries rated `LOG_PENALTY_MIN_RATING` (= 3, `src/lib/engine/parameters.ts:184`) or above. It counts distinct nights per target key and ignores nights after `onOrBefore`.
  - The store's `listForRanking` (`src/lib/observations/store.ts:248-259`) pre-filters on the same constant.
  - Ranked objects, planets and the Moon all get a `seen` summary from it (`src/lib/tonight/build.ts:717`). Each Tonight entry type exposes it only as a formatted `seenText: string | null` (`build.ts:131`, `:165`, `:198`; assigned at `:763`, `:844`, `:900`).
  - So FR-040's "not seen yet" is exactly the case `entry.seen === null`. It needs no new read, only a field on the view model and a mark in four components.
- **Today's read path cannot back an exact checklist.**
  - `listForRanking` returns one row per qualifying entry with no limit (`store.ts:248-259`), so PostgREST's `max_rows = 1000` (`supabase/config.toml:18`) silently caps it.
  - The store's own comment (`store.ts:242-247`) accepts that cap for the ranking, because a cut only undercounts "seen N times".
  - For a checklist, a cut would drop objects seen only on old nights. That conflicts with lessons.md's "Filter and order every per-user list query" rule (`context/foundation/lessons.md:12-18`: aggregate in SQL or paginate, and say which).
  - The precedent for an aggregate is `sky_check_tally()`, a `security invoker`, `set search_path = ''` SQL function granted only to `authenticated` (`supabase/migrations/20261003120000_sky_checks.sql:115-130`), called through `skyCheckStore.tally` (`src/lib/sky-checks/store.ts:157-159`).
- **The checklist denominators come from the catalogue, and only one is a decision.**
  - `MESSIER` has 110 objects and `CALDWELL` has 61. The validators enforce both counts (`EXPECTED_COUNT = 110`, `EXPECTED_CALDWELL_COUNT = 61`, `src/lib/catalogue/index.ts:73-74`).
  - The two lists are disjoint by construction: the Caldwell rows have `messier === null` (`index.ts:191`), and the build keeps only rows with an empty `M` column (`scripts/build-catalogue.mjs:362-363`).
  - The app's Caldwell list is a 61-object subset of the real 109. It excludes 45 objects south of −23°, plus C9, C41 and C99 (`src/lib/catalogue/caldwell.meta.json`).
  - Neither the PRD nor the roadmap states a Caldwell total. Only "47 / 110" for Messier is stated (`prd.md:449`). How to label "x / 61" is a product/UI decision for the plan.
- **No schema change is required for the feature itself.**
  - Progress reads only `observations`. Its RLS already limits every operation to the owner (`supabase/migrations/20260926200000_observations.sql:30-63`).
  - No new table means no `TABLES` entry.
  - If the plan adds an aggregate RPC, it needs a migration and regenerated `database.types.ts`. After PR #147 merges, it also has to satisfy `tests/db/structure.test.ts`: not SECURITY DEFINER, `search_path` set, not executable by `anon`. Those files are absent in this worktree; they come with #147.
- **The natural home is `/log/progress`.**
  - `/log` is already gated (`src/lib/protected-routes.ts`), highlights "Log" in both navs (`src/lib/navigation.ts:5-16`), is network-only (`needsNetwork: true`) and is under the coordinate lint (`eslint.config.js` `gearConfig.files` covers `src/pages/log/**`).
  - `/log/sky` is the exact precedent: `BackLink` + `PageHeader` in the header slot, `Band`s, and an `action` link from `/log`'s header.
  - A top-level `/progress` would need a fourth nav item (TabBar is `grid-cols-3`), a `PROTECTED_ROUTES` entry and a nav icon.

## Detailed Findings

### The log data model

- **Table:** `observations` (`supabase/migrations/20260926200000_observations.sql:12-28`). Columns:
  - `id`;
  - `user_id`, default `auth.uid()`, cascade on user delete;
  - `target text not null`;
  - `night date not null`, the evening date;
  - `rating smallint not null check (rating between 1 and 5)`;
  - nullable `site_id` / `telescope_id` (`on delete set null`);
  - the snapshots `site_name` / `telescope_name`;
  - `created_at`.
- **Indexes:** only `user_id`, `site_id` and `telescope_id` (lines 26-28).
- **RLS:** four `authenticated` policies, one per operation (lines 30-63).
- **Target key check:** shape only (migrations `20260930120000`, `20261001120000`, `20261006190000:15-21`). It accepts:
  - `M1`–`M110`;
  - the seven planet keys;
  - `moon`;
  - `^(NGC|IC)[1-9][0-9]{0,3}$`.
- **Existence check:** whether the catalogue lists the object is the app's `isKnownTarget` (`src/lib/targets/labels.ts:42-44`). It is enforced on create and edit (`src/pages/api/log/index.ts:16-46`, `src/pages/api/log/[id].ts:14-37`).
- **Live reads, no stored counters.**
  - Edit can change `target`, `night` and `rating`. Delete is `src/pages/api/log/[id]/delete.ts:12-25`.
  - Tonight reads the log on every load (comment `delete.ts:7-10`).
  - Any progress view computed on read therefore satisfies "deleting or re-rating updates the counts and the marks" with no invalidation.
  - This holds while the view is fetched live. A stored offline Tonight copy keeps the mark it was rendered with, up to its 36 h expiry (`src/lib/offline/copies.ts`, `EXPIRY_MS`), the same as today's seen tag.
- **No aggregate exists.** No SQL function, RPC or view aggregates observations. The migrations define `complete_onboarding`, the sky-check functions and the account-plan objects; the inspected migrations contain no observation aggregate.

### The seen rule and its consumers

- **The function.** `src/lib/engine/log.ts:32-49` `seenSummaries`:
  - It skips `rating < LOG_PENALTY_MIN_RATING` and `night > onOrBefore` (line 37).
  - It de-duplicates nights per target with a `Set`.
  - It returns `Map<target, { count, lastNight }>`. `count` is distinct nights, a decision from log-observation-from-ranking's plan review F1.
  - It does not carry the first night. A "first seen on" date for the firsts would need `min(night)`, which `SeenSummary` lacks.
- **The constant.**
  - `LOG_PENALTY_MIN_RATING = 3` (`parameters.ts:184`) is re-exported through `export * from "./parameters"` (`src/lib/engine/index.ts:7`).
  - It is imported by `engine/log.ts` and by `observations/store.ts` through the barrel.
  - It is the single source the roadmap risk ("both must stay in step", `context/foundation/roadmap.md:159`) refers to.
  - An SQL aggregate that hard-codes `3` would create a second source. Passing the constant as a function parameter keeps one.
- **Where the rule is consumed.** `build.ts:717` calls `seenSummaries(log, date)` with the ranked night. The result feeds three consumers:
  - `rankObjects` (`src/lib/engine/ranking.ts:69`, lookup at `:223` by `object.id`, penalty `LOG_PENALTY = 0.15` on the rank score only, `:229`);
  - planets (`planet-ranking.ts:39`; tag only, no penalty, per planets-on-tonight `plan.md:50`);
  - the Moon (`moon-target.ts:31`, key `"moon"`).
- **The cut-off.**
  - `onOrBefore` makes the Tonight mark relative to the ranked night. Entries cannot be in the future (`NIGHT_IN_FUTURE` on create and update), so the cut-off matters only when Tonight shows a past or alternative night.
  - A progress page that wants "ever seen" passes no meaningful cut-off, or uses its own aggregate.

### Where tonight's targets render (FR-040 surfaces)

| Surface | Component | Existing seen tag |
| --- | --- | --- |
| `/tonight/targets`, the best band | `src/components/tonight/ObjectCard.astro` | `<SeenTag>` at `:37` |
| `/tonight/targets`, "show the other N" | `src/components/tonight/ObjectRow.astro` | inline muted span at `:37` |
| `/tonight/planets` | `src/components/tonight/PlanetCard.astro` | `<SeenTag>` at `:32` |
| `/tonight/moon` | `src/components/tonight/MoonCard.astro` | `<SeenTag>` at `:59`, only when `card.target` is non-null |

- **The tag component.** `SeenTag.astro` is a 15-line shared pill (`rounded-full bg-accent text-label text-muted-foreground`). It has no `/design` specimen.
- **Surfaces without a tag today:**
  - The dashboard's "Point here first" tile (`TonightTiles.astro`, rows of `view.summaryTargets`, which are `TonightEntry` with `seenText`).
  - The Session plan rows (`SessionTimeline.astro:117-135`, `TonightSessionPlanRowInput` at `build.ts:338-358`).
  - A mark on a plan row needs a new row field. `name` is shared with the live sky's markers, so it must not carry the mark.
- **Tests and fixtures that pin these surfaces:**
  - The phone fold spec (`tests/e2e/tonight-phone.spec.ts`) pins the verdict, the gear cards and the first tile at 390×844. Marks inside tiles or on focused pages are below what it measures.
  - Targets specs locate rows by `data-object` (`tests/e2e/tonight-targets.spec.ts:32-85`).
  - These specs assert the existing tag by catalogue text: `tests/e2e/observation-log.spec.ts:63-65`, `planets-on-tonight.spec.ts:63-65` and `moon-as-target.spec.ts:55-56`.
  - A fresh e2e user has an empty log, so every target will carry the new mark.
  - `/design` has Tonight entry fixtures with `seenText: null` (`src/pages/design.astro:366`, `:417`). A new required field on the entry types makes them fail `astro check` until updated.

### The log pages and navigation (FR-039 page)

- **`/log`** (`src/pages/log/index.astro`):
  - `GearShell` with `PageHeader` in the header slot.
  - The `actions` slot holds the "Sky checks" `action` link (`ListChecks` icon) and the one primary "Add entry".
  - Below: per-night `Band`s and the `Pager`.
- **`/log/sky`** (`src/pages/log/sky.astro`):
  - `BackLink` to `/log` + `PageHeader`.
  - `DatabaseMissing`, the load error and the empty state.
  - `SkyTally` (a count-display precedent, `src/components/sky-checks/SkyTally.astro`) and one `Band`.
- **Navigation.** `NAV_ITEMS` is three items (`navigation.ts:5-9`), and `isCurrentPage` covers sub-paths (`:14-16`). Tests assume three destinations (`tests/e2e/offline.spec.ts:156`).
- **Gating.** `PROTECTED_ROUTES` already covers `/log` and `/api/log` with whole-segment matching; it is pinned by `src/lib/protected-routes.test.ts`.
- **Offline.** `TONIGHT_PAGES` (`src/lib/offline/copies.ts:10-17`) is only the six Tonight pages. Other pages fall back to `/offline`, and `/log` is `needsNetwork`. A `/log/*` page needs no offline work and must not join `TONIGHT_PAGES`.
- **Phone e2e.** The no-sideways-scroll test runs `TONIGHT_PAGES` plus `APP_PAGES = ["/gear", "/log"]` at 320 and 375 px, EN and PL (`tests/e2e/tonight-phone.spec.ts:42-48`). A new page is covered only if added to `APP_PAGES`.

### Catalogue data available to a checklist

- **`DeepSkyObject` fields** (`src/lib/catalogue/index.ts:33-58`): `id`, `messier`, `caldwell`, `designation`, `label`, `commonName`, `type` (12 `DEEP_SKY_TYPES`, `:16-29`), `constellation`, sizes and magnitudes.
- **Type counts:**
  - Messier: galaxy 40, globular 29, open 26, others ≤ 4 each.
  - Caldwell: galaxy 28, open 10, planetary 9, others ≤ 4.
- **No i18n labels exist for `DeepSkyType`** (no match in `src/i18n/messages/en.ts`). Showing a type or grouping by type needs a new key set in `en.ts` and `pl.ts`, which the parity test in `src/i18n/i18n.test.ts` enforces.
- **Names and keys:**
  - Display helpers: `targetLabel(key, locale)` (`src/lib/targets/labels.ts:23-35`) and `localCommonName` (`src/lib/catalogue/common-names.ts`).
  - The Caldwell number is shown as "Caldwell N" (`tonight.object.caldwell`, `format.ts:700-705`).
  - Firsts keys: `PLANET_TARGET_KEYS` (7, solar order, `src/lib/targets/index.ts:24-32`) and `MOON_TARGET_KEY` (`:35`).
- **The checklist must be server-rendered.** `@/lib/catalogue` is server-only: islands must not import it (guard in `TonightSkyView.test.ts`).
- **Existing copy.** The rating hint already explains the rule ("A rating of 1-2 keeps the object where it is; 3-5 moves it down gently", `log.ratingHint` in `en.ts`). No existing key says "not seen yet", "checklist", "firsts" or "progress".

### Quality gates that apply

- **Lessons** (`context/foundation/lessons.md`):
  - coordinate-touching modules go under `gearConfig.files` (`:6-10`). A new `src/lib/progress/**` or `src/components/progress/**` is not covered unless added; `src/pages/log/**` already is.
  - Filter and order every per-user list query (`:12-18`).
  - Don't plan no-JS behaviour inside the Tonight island (`:20-24`). This applies to the marks.
- **Test plan:**
  - `context/foundation/test-plan.md` has no risk or phase that covers progress.
  - §6.3 says to run logs through `seenSummaries`, "never a hand-built `seen` map", with expected values hand-written (an independent oracle).
  - The existing `src/lib/engine/ranking-invariants.test.ts` checks that 1-2 ratings are inert.
- **UI rules** (CLAUDE.md, "UI (Nightfall)"):
  - tokens only;
  - a new shared component gets its `/design` 7-state specimen;
  - a red theme with zero G/B;
  - AA contrast in all themes (`src/styles/contrast.test.ts`);
  - EN and PL;
  - phone first.
- **PR #147 interplay** (orchestrator note, CLAUDE.md "Tripwires"): #147 adds `tests/db/tables.ts`, `tests/db/structure.test.ts` and `no-console` as an error across `src` with a file-by-file guard. A progress change adds no table. Any new public SQL function must pass the structure test's function rules once #147 lands.

## Code References

- `src/lib/engine/log.ts:32-49` - `seenSummaries`, the one seen rule (rated ≥ 3, distinct nights, cut-off)
- `src/lib/engine/parameters.ts:181,184` - `LOG_PENALTY`, `LOG_PENALTY_MIN_RATING`
- `src/lib/observations/store.ts:242-259` - `listForRanking`, rated ≥ 3, ordered, unbounded (max_rows cap)
- `src/lib/tonight/build.ts:131,165,198,717,763,844,900` - `seenText` fields and their assignment
- `src/components/tonight/SeenTag.astro` - the seen pill
- `src/components/tonight/{ObjectCard,ObjectRow,PlanetCard,MoonCard}.astro` - the four target surfaces
- `src/lib/catalogue/index.ts:16-29,33-58,73-74,191,258-279` - types, object shape, counts, Caldwell/Messier disjointness, exports
- `src/lib/catalogue/caldwell.meta.json` - Caldwell selection rule and exclusions (61 of 109)
- `src/lib/targets/index.ts:24-41` - planet and Moon keys, `TargetKey`
- `src/lib/targets/labels.ts:23-44` - `targetLabel`, `isKnownTarget`
- `src/pages/log/sky.astro`, `src/components/sky-checks/SkyTally.astro` - sub-page and tally precedent
- `supabase/migrations/20261003120000_sky_checks.sql:115-130` - `sky_check_tally()` aggregate precedent
- `src/lib/navigation.ts:5-16`, `src/lib/protected-routes.ts` - nav and gating
- `src/lib/offline/copies.ts:10-17` - `TONIGHT_PAGES`
- `tests/e2e/tonight-phone.spec.ts:42-48` - `APP_PAGES` for the sideways-scroll check
- `supabase/config.toml:18` - `max_rows = 1000`

## Architecture Insights

- **Progress is a projection of the log.** Today's pattern computes everything on read (the seen tag, the penalty, the sky tally). Keeping progress on read gives US-06's "re-rating updates the counts" for free, with no stored counters to drift.
- **Keep one rule.** A pure function (for example, progress from per-target qualifying nights) placed next to `seenSummaries` and using `LOG_PENALTY_MIN_RATING` keeps the ranking and progress in step. It can also be tested with hand-written fixtures per the test plan's oracle rule.
- **S-06 builds on this slice.** S-06 observing-milestones (FR-041, `roadmap.md:162-172`) builds on S-05's counts: first galaxy, first globular, 10/25/50/110 Messier, all planets. A progress model that exposes:
  - per-list counts,
  - per-object seen state, and
  - the catalogue `type`

  lets S-06 derive milestones without a new read. The first night per target would also let milestones be dated.
- **Data volume is small and bounded.** At most 110 + 61 + 8 = 179 distinct known keys qualify. An aggregate grouped by `target` returns ≤ 179 rows under the app's write rules (`isKnownTarget`), far under `max_rows`.

## Historical Context (from prior changes)

- `context/archive/2026-09-26-log-observation-from-ranking/plan-brief.md:17-30`, `plan.md:51-61`, `reviews/plan-review.md:25`:
  - seen = rated 3-5 (a user decision);
  - the penalty reorders only;
  - count = distinct nights;
  - any site or telescope counts;
  - only nights ≤ the ranked night.
- The same change's `reviews/impl-review.md:40-56` (F1): the unbounded log read was capped by `max_rows`. It was fixed by filtering to `rating >= 3` and ordering. An SQL aggregate (Fix B) was considered and rejected then as too much surface, which became lessons.md:12-18.
- `context/archive/2026-09-27-observation-log-management/plan-brief.md`: editing to 1-2 or deleting removes the penalty and the tag on the next load (live read).
- `context/archive/2026-09-30-planets-on-tonight/plan.md:50`: planets carry the seen tag but no penalty. The Moon follows the same pattern (`2026-10-01-moon-as-target`).
- `context/archive/2026-10-06-deep-sky-beyond-messier/plan.md:46,101-108`, `reviews/impl-review-phases-1-3.md:105`: the Caldwell selection rule (61 objects, the −23° floor, C9/C41/C99 absent) and Messier disjointness.
- `context/archive/2026-10-03-verdict-check/plan.md:351-355`: `/log/sky` reached from an `action` link in `/log`'s header, with a tally RPC to avoid the row cap. Its review F1 says to tell outcomes apart with a dot plus text, not colour alone (red mode).
- `context/archive/2026-09-29-top-nav-redesign/plan-brief.md:23-30`: three destinations by design.

## Related Research

- `context/archive/2026-09-26-log-observation-from-ranking/research.md`
- `context/archive/2026-10-03-verdict-check/research.md` (notes there was "no tally or stats UI anywhere" before sky checks)

## Open Questions

These are for the plan. They are product and UI choices with no source decision.

1. **Caldwell denominator and label.** "x / 61", with a note that the list covers the Caldwell objects visible from mid-northern latitudes, or another framing? The PRD gives no total.
2. **What a "first" shows.** A tick only, or the date of the first night rated ≥ 3 (which needs `min(night)`, beyond `SeenSummary`)?
3. **Checklist layout on a phone.** 110 + 61 rows (label, common name, seen state, maybe the date) versus a compact grid of numbers. Should it be grouped by type? Type labels need new i18n keys.
4. **Entry points.** Is `/log/progress` linked only from `/log`'s header (like Sky checks)? Should a dashboard tile be added too, given the phone fold spec?
5. **Which surfaces carry the "not seen yet" mark.** The four focused-page cards and rows, planets and the Moon included per "tonight's targets"? Or also the dashboard "Point here first" rows and the Session plan rows (a new row field)?
6. **Data read for the page.** A `security invoker` aggregate RPC taking the min rating as a parameter, per lessons.md:12-18, versus reusing `listForRanking` and accepting the 1000-row cap. Research favours the RPC for an exact checklist, at the cost of a migration and `db:types`. The local DB must not be migrated without the orchestrator's OK.
