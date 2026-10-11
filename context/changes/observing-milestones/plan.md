# Observing milestones (M-3 S-06) Implementation Plan

## Overview

When a log entry is saved and it reaches a milestone from a fixed, named set, the page the save returns to celebrates it once, and `/log/progress` lists every milestone with the night it was reached. Roadmap M-3 S-06 (GitHub #127), PRD FR-041, US-06. It builds on S-05 observing-progress.

The milestone set is PRD Open Question 18, owned by the owner. This plan proposes a default set and builds on it, **pending owner confirmation** (see "Owner decisions pending").

## Current State Analysis

Evidence: `context/changes/observing-milestones/research.md`.

- **What S-05 provides.** It left one pure model of the log: `observingProgress(entries)` (`src/lib/progress/progress.ts`).
  - The Messier (110) and Caldwell (61) checklists. Items carry `type` and `seen.firstNight`.
  - The planet and Moon firsts, each with `firstNight`.
  - It is built through `seenSummaries`, so only entries rated 3 or above count.
- **The read.** `observationStore.listSeenEntries(client)` is the one exact read of those entries: a paged count, normally one request.
- **Saves.** They happen in `POST /api/log` (create; `src/pages/api/log/index.ts`) and `POST /api/log/[id]` (edit; `src/pages/api/log/[id].ts`).
  - Create returns to the Tonight page named in `from` with `?logged=<key>`, or to `/log?saved=<key>`.
  - Edit returns to `/log?updated=<key>` (`logNotice`, `src/lib/observations/redirect.ts:83`).
  - Delete can only lose milestones.
- **Notices.** They travel as fixed query params:
  - Tonight shells read `?logged` (`src/pages/tonight/targets.astro:23-31`, `moon.astro`, `nights.astro`).
  - `/log` reads `readLogNotice`.
  - Toasts clear only `TOAST_PARAMS` (`src/lib/toasts.ts`).
  - Tonight URLs that carry any of `NOTICE_PARAMS` (`src/lib/offline/copies.ts:35`) are never stored offline.
- **Nothing about milestones exists yet:** no table, no model, no copy.

## Desired End State

- **The celebration.** Saving an entry rated 3 or above that completes a milestone shows a celebration toast on the page the save returns to: a Tonight focused page, `/log` after a manual entry, or `/log` after an edit.
  - It shows an `Award` icon, "Milestone reached" and the milestone's name. Several milestones reached by one save are named in one toast.
  - It links to `/log/progress`.
  - It shows once: the param is cleared on show, never stored offline, and a re-save that changes nothing reaches nothing.
  - An entry rated 1-2 never celebrates.
- **The progress page.** `/log/progress` opens with a "Milestones" band listing every milestone in a fixed order:
  - reached: a check, the name and "reached <night>";
  - not yet: muted, and count milestones show how far along the user is ("12 / 25").
- **Verification:**
  - pure unit tests with hand-written entries;
  - an offline/toast param unit test;
  - an e2e journey: rating 2 doesn't celebrate, re-rating to 4 celebrates once and not on reload, the band lists it, a planet logged from Tonight celebrates on the Planets page;
  - the phone-width check covers the page;
  - a screenshot matrix.

### Key Discoveries:

- Every candidate milestone can be derived from `ObservingProgress`. First of a kind is the earliest `firstNight` in a group; the N-th object is the N-th earliest `firstNight` in a list; all of a set is the latest `firstNight` once all are seen (research.md "Deriving milestones").
- "Reached by this save" = reached after minus reached before, with the same read and the same rule. A rating of 1-2 leaves both sets equal, so the roadmap's guard is a consequence of the rule. It is also checked explicitly.
- `NOTICE_PARAMS` exists because a stored copy with a notice param "would show 'Saved' forever" (`copies.ts:34-35`). A celebration param must join it and `TOAST_PARAMS`.

## Owner decisions pending

These are defaults chosen by the agent because the owner owns them. The plan is built on them and changes only in the named places if the owner decides otherwise. Questions in Polish for the owner:

1. **Zestaw kamieni milowych (PRD OQ 18).**
   - Domyślnie 11, w tej kolejności:
     1. pierwszy Księżyc;
     2. pierwsza planeta;
     3. wszystkie planety (7);
     4. pierwsza galaktyka;
     5. pierwsza gromada kulista;
     6. pierwsza mgławica;
     7. 10 obiektów Messiera;
     8. 25 obiektów Messiera;
     9. 50 obiektów Messiera;
     10. wszystkie 110 obiektów Messiera;
     11. wszystkie 61 obiektów Caldwella z listy.
   - „Terminator Księżyca” z kandydatów zastępuje „pierwszy Księżyc”, bo dziennik nie zapisuje, na co dokładnie patrzono.
   - „Mgławica” obejmuje typy: mgławica, emisyjna, refleksyjna, planetarna, pozostałość po supernowej oraz gromada z mgławicą.
   - Czy ten zestaw jest OK? Dodać np. pierwszą gromadę otwartą albo 10 / 25 Caldwella?
   - Zmiana dotyczy tylko `MILESTONES` w `src/lib/progress/milestones.ts` i tekstów.
2. **Usunięcie lub obniżenie oceny wpisu.**
   - Domyślnie kamień milowy jest wyliczany z dziennika tak samo jak liczniki S-05, więc znika, gdy znika wpis, który go osiągnął.
   - Ponowne osiągnięcie świętujemy ponownie.
   - Czy wolisz, żeby osiągnięty kamień milowy zostawał na zawsze? To wymaga nowej tabeli i migracji, czyli osobnej fazy.
3. **Wygląd świętowania.**
   - Domyślnie istniejący toast (10 s, ikona Award, „Kamień milowy osiągnięty: …”, link „Zobacz postępy”) na stronie, na którą wraca zapis.
   - Czy to wystarczy, czy chcesz coś większego (np. osobna sekcja na stronie)?
4. **Sekcja „Kamienie milowe” na `/log/progress`.**
   - Domyślnie jest pierwszą sekcją strony i pokazuje wszystkie 11.
   - Osiągnięte mają znacznik i datę nocy; nieosiągnięte są wyciszone, a liczbowe pokazują postęp („12 / 25”).
   - Czy pokazywać nieosiągnięte, czy tylko osiągnięte (wtedy pusta lista na start)?

## What We're NOT Doing

- No stored milestone table, migration or RPC. Milestones are derived on read (pending owner decision 2), so nothing joins `TABLES`.
- No celebration on delete, and no "milestone lost" notice.
- No sharing, badges, points or leaderboard. The PRD Non-Goals keep progress private (`prd.md:637-640`).
- No push or email notification of a milestone.
- No celebration for milestones reached by rows inserted outside the app's save routes. Only the two routes celebrate.
- No change to the seen rule, `LOG_PENALTY_MIN_RATING`, the ranking or the S-05 checklists.
- No offline storage of `/log/progress` or of any page carrying the celebration param.

## Implementation Approach

The work runs bottom-up in three phases:

1. A pure milestone model (test-first).
2. The celebration at save: routes, param, toast, offline and toast param lists.
3. The progress-page band.

The guard "never for an entry rated 1-2" is enforced twice, independently:

- **By the rule:** the before/after diff over `observingProgress` is empty for such an entry.
- **By a short-circuit:** the routes skip the milestone reads entirely when the saved rating is below `LOG_PENALTY_MIN_RATING`.

**Decisions delegated to the agent** (non-UI; recorded in the brief):

- The pure model lives in `src/lib/progress/milestones.ts`.
- The before/after reads in the routes reuse `listSeenEntries`, so one rule covers everything.
- A failed milestone read never fails the save: the celebration is simply skipped.
- The param is `milestone`, repeated once per key, with keys from the fixed set only.
- The toast is rendered once in `Layout.astro`, for every page.
- Three phases.
- The interactive planning questions were answered by the agent, as the run's rules require (the owner is away).

## Critical Implementation Details

- **Order inside a route.**
  1. Parse and validate the entry.
  2. If the rating is ≥ `LOG_PENALTY_MIN_RATING`, read `before = listSeenEntries`.
  3. Write.
  4. On success, and only if `before` succeeded, read `after`.
  5. `reached = newlyReached(milestonesOf(observingProgress(before)), milestonesOf(observingProgress(after)))`.

  Either read failing means no celebration, but the redirect still confirms the save. No `console` is used: an error is swallowed only into "no celebration", which the plan accepts because the save itself is confirmed.
- **The param never carries a value.**
  - `milestone` values are keys from `MILESTONES`, and the readers validate them against the set.
  - The redirect appends them to the URL the route already builds: `?logged=M31&milestone=first-galaxy&milestone=messier-10`. Order follows `MILESTONES`.
- **"Once".**
  - The toast lists `milestone` among its params, so `ToastRegion` clears it with `replaceState` when it adopts the toast. A reload doesn't replay it.
  - `milestone` joins `NOTICE_PARAMS`, so the service worker never stores a Tonight copy carrying it.
- **Where the toast renders.** `Layout.astro` reads `Astro.url.searchParams.getAll("milestone")` and renders one `MilestoneToast` when any valid key is present. Every page gets it, the Tonight shells included: the shell is the page, and islands don't render `Layout`.

## Phase 1: The milestone model

### Overview

A pure, fixed, ordered milestone set and the functions that derive what is reached, and when, from `ObservingProgress`. Driven test-first.

### Changes Required:

#### 1. Milestone model

**File**: `src/lib/progress/milestones.ts` (new; + `milestones.test.ts`)

**Intent**: One place that names the milestones and derives them from S-05's progress model, so the page, the celebration and later changes share one rule.

**Contract**:
- `MILESTONES`: a readonly ordered list of `{ key, kind }` (pending owner decision 1):
  - `first-moon`: the Moon has a `firstNight`;
  - `first-planet`: any planet in `firsts`;
  - `all-planets`: all 7 planets;
  - `first-galaxy`, `first-globular`, `first-nebula`: by checklist `type`, over both checklists. `NEBULA_TYPES` is `nebula`, `emission-nebula`, `reflection-nebula`, `planetary-nebula`, `supernova-remnant` and `cluster-with-nebula`;
  - `messier-10`, `messier-25`, `messier-50`, `messier-110`;
  - `caldwell-all`: every item in the Caldwell checklist (61).
- `type MilestoneKey`, plus `isMilestoneKey(value)`, which is island-safe (no catalogue import), for the param readers.
- `milestonesOf(progress: ObservingProgress): MilestoneState[]` returns, in `MILESTONES` order, `{ key, reachedNight: string | null, progress?: { seen: number; total: number } }`.
  - `progress` is present only for count and all-of-a-set milestones.
  - `reachedNight` is the night the milestone was reached, derived from `firstNight`s as in Key Discoveries.
- `newlyReached(before: readonly MilestoneState[], after: readonly MilestoneState[]): MilestoneKey[]` returns the keys reached in `after` but not in `before`, in `MILESTONES` order.
- The module imports only the progress types and catalogue type names. It has no I/O.

**Tests**: hand-written `LogEntry[]` fed through `observingProgress`, never a hand-built progress object (test-plan §6.3).
- An object logged only at rating 2 reaches nothing.
- The 10th distinct Messier object reaches `messier-10` on the night of the 10th earliest first night.
- Two entries for one object count once.
- A planetary nebula reaches `first-nebula`; a globular does not.
- `all-planets` waits for the seventh planet and is dated at its first night.
- `newlyReached` is empty for an unchanged log and for an added rating-2 entry.
- Removing the reaching entry un-reaches the milestone.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/progress/milestones.test.ts` passes, including the rating-2-reaches-nothing and unchanged-log-reaches-nothing cases
- `npx astro check`, `npm run lint` and `npm test` pass

**Implementation Note**: Test-first (`/10x-tdd`). Commit the phase on green, without asking, per the run's rules.

---

## Phase 2: The celebration at save

### Overview

Compute what a save reaches in both save routes, carry it to the returning page as a fixed param, and show one celebration toast that clears itself and is never stored offline.

### Changes Required:

#### 1. Routes

**Files**: `src/pages/api/log/index.ts`, `src/pages/api/log/[id].ts`, `src/lib/observations/redirect.ts` (+ tests)

**Intent**: Celebrate exactly what this save reached, and only for a rating that can count.

**Contract**:
- A shared helper, `reachedBySave(client, rating, write)`, in `src/lib/progress/celebrate.ts` (new). It follows the order in Critical Implementation Details: skip when `rating < LOG_PENALTY_MIN_RATING`; read before; write; read after; diff. It returns `{ result, reached: MilestoneKey[] }`. A failed read yields `reached: []`; a failed write returns the write's failure unchanged.
- `withMilestones(url, keys)` in `redirect.ts` appends one `milestone=<key>` per key.
- Both routes use the helper and wrap their existing success redirect in `withMilestones`. Error redirects are unchanged.
- Tests (`src/lib/progress/celebrate.test.ts`, with a fake store):
  - a rating of 2 makes no read;
  - a failed before-read still writes and celebrates nothing;
  - a failed write celebrates nothing;
  - a write that reaches `first-galaxy` returns it.

#### 2. Param plumbing: toasts and offline

**Files**: `src/lib/toasts.ts`, `src/lib/offline/copies.ts` (+ `copies.test.ts`, `toasts.test.ts`)

**Intent**: The celebration shows once and is never replayed from storage.

**Contract**:
- Add `"milestone"` to `TOAST_PARAMS` and to `NOTICE_PARAMS`.
- Tests:
  - a Tonight URL with `?milestone=first-galaxy` is not storable;
  - `withoutParams` drops every `milestone`.

#### 3. The toast

**Files**: `src/components/progress/MilestoneToast.astro` (new), `src/layouts/Layout.astro`, `src/pages/design.astro`, `src/i18n/messages/en.ts`, `pl.ts`

**Intent**: One celebration markup for every page (pending owner decision 3).

**Contract**:
- `MilestoneToast` takes `keys: MilestoneKey[]`. It renders a success `Notice` with `toast` and `param="milestone"`, a lucide `Award` icon (`aria-hidden`) and `progress.milestones.reached` with the milestone names joined in locale order (`Intl.ListFormat`). Below them is an `action` link `progress.milestones.see` to `/log/progress`.
- `Layout.astro` renders it when `Astro.url.searchParams.getAll("milestone")` holds valid keys (`isMilestoneKey`). Unknown values are ignored.
- Copy:
  - `progress.milestones.name.<key>` for all 11 milestones;
  - `progress.milestones.{reached, see}`.
  - EN and PL; PL is gender-neutral where it refers to objects.
- `/design` gets a `MilestoneToast` specimen (one milestone, three milestones) in the 7-state matrix, with N/A reasons.

#### 4. e2e

**File**: `tests/e2e/observing-milestones.spec.ts` (new; the celebration half)

**Intent**: Prove "once, at save, never for 1-2" in the browser.

**Contract** (from a fresh Madrid user on the all-clear fixture):
1. `/log/new?object=M31&from=log` rated 2 → `/log` shows the saved toast and no milestone toast.
2. Editing that entry to 4 → `/log` shows one milestone toast naming exactly the first galaxy, since one Messier object reaches no count milestone.
3. Reloading → no milestone toast, and the URL has no `milestone`.
4. Logging `jupiter` rated 3 from the Planets page (`from=planets`) → `/tonight/planets` shows the toast naming the first planet.
5. Logging M31 again rated 5 on another night → no milestone toast (already reached).

Expected copy comes from the catalogue (`en.progress.milestones.*`).

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/progress/celebrate.test.ts src/lib/offline/copies.test.ts src/lib/toasts.test.ts` passes
- `tests/e2e/observing-milestones.spec.ts` celebration cases pass against a local preview (see "Running the checks")
- `npx astro check`, `npm run lint` and `npm test` (incl. i18n parity) pass

#### Manual Verification:

- Screenshots of the milestone toast on `/log` and `/tonight/planets` in EN/PL × dark/light/red at 390 px and desktop: readable, the link reachable, red mode legible, nothing hidden behind the TabBar

**Implementation Note**: Commit on green without asking. Manual checks are deferred to the end and verified by the agent with screenshot evidence where possible.

---

## Phase 3: Milestones on the progress page

### Overview

The "Milestones" band on `/log/progress`, listing every milestone with its reached night or how far along the user is.

### Changes Required:

#### 1. Band

**Files**: `src/pages/log/progress.astro`, `src/components/progress/MilestoneList.astro` (new), `src/pages/design.astro`, `src/i18n/messages/en.ts`, `pl.ts`

**Intent**: Every milestone reached stays listed on the progress page (FR-041), next to the ones still ahead (pending owner decisions 2 and 4).

**Contract**:
- The page computes `milestonesOf(progress)` from the `progress` it already builds; no extra read.
- `MilestoneList` renders a `Band` (`progress.milestones.title`) placed first on the page, holding a `divide-y` list in `MILESTONES` order:
  - **Reached:** a lucide `Check` (`aria-hidden`), the name (`text-heading`), and `progress.milestones.reachedOn({ date })` via `createFormatter(locale).formatShortDate`.
  - **Not yet:** a muted name and `progress.milestones.notYet`, or `progress.milestones.progress({ seen, total })` for count milestones.
  - Each row carries `data-milestone={key}` and `data-reached` (present only when reached) for e2e.
  - Red mode tells the two apart by icon and weight, not hue.
- `/design` gets a `MilestoneList` specimen (none reached, some reached), in the 7-state matrix.

#### 2. e2e, phone width and docs

**Files**: `tests/e2e/observing-milestones.spec.ts`, `CLAUDE.md`

**Intent**: Pin the band and document the slice.

**Contract**:
- The page half of the spec:
  - after the Phase 2 journey, `/log/progress` shows `[data-milestone="first-galaxy"][data-reached]` with the edit's night, and `first-planet` reached;
  - `messier-10` not reached and showing "1 / 10".
- `/log/progress` is already in `APP_PAGES` (S-05), so the sideways-scroll check covers the band.
- `CLAUDE.md`: a short paragraph on `src/lib/progress/milestones.ts`, `celebrate.ts`, the `milestone` param (in `TOAST_PARAMS` and `NOTICE_PARAMS`) and the Milestones band.

### Success Criteria:

#### Automated Verification:

- `tests/e2e/observing-milestones.spec.ts` page cases pass, plus `tests/e2e/tonight-phone.spec.ts` (no sideways scroll on `/log/progress`)
- `npx astro check`, `npm run lint`, `npm test` and `npm run build` pass

#### Manual Verification:

- Screenshots of `/log/progress` (none reached; several reached) in EN/PL × dark/light/red at 390 px and desktop: the band reads first, reached vs not yet distinguishable in red mode, PL wraps at 320 px
- `/design` specimens for `MilestoneToast` and `MilestoneList` render in all themes

**Implementation Note**: After this phase, `/10x-impl-review` with Opus reviewers.

---

## Running the checks

S-05's recipe, adapted to this worktree and run:

1. `npm ci` in the worktree, with the `nvm use` prefix.
2. Build `.env` / `.dev.vars` from `npx supabase status -o env` in the scratchpad, then copy them into the worktree (both are gitignored). Never copy them from the main checkout, never print their values, and never point e2e at hosted Supabase.
3. Start the forecast fixture (`node tests/e2e/forecast-fixture.mjs`). Its port, 4400, is shared, so confirm it is free or already serving the fixture.
4. `npm run build`, then `npm run preview -- --port 4333`. **Restart the preview after every rebuild**, or a stale build won't hydrate.
5. `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test <spec>`.
6. Never reset or reseed the shared local Supabase. Tests only create their own users.

## Testing Strategy

### Unit Tests:

- `milestones.test.ts`:
  - derivation per kind;
  - reached nights;
  - 1-2 ratings inert;
  - `newlyReached` empty for unchanged and rating-2 logs;
  - un-reaching on removal.
- `celebrate.test.ts`:
  - the short-circuit at rating < 3;
  - read and write failures;
  - the diff.
- `copies.test.ts` / `toasts.test.ts`: the `milestone` param is not storable and gets cleared.

### Integration Tests:

- e2e `observing-milestones.spec.ts`:
  - rating 2 no toast;
  - re-rate celebrates once;
  - reload doesn't;
  - a Tonight save celebrates on its page;
  - a repeat save doesn't;
  - the band lists reached milestones and progress.

### Manual Testing Steps:

1. On a fresh account, log M31 rated 2 from `/log`: no milestone toast.
2. Edit it to 4: one toast "Milestone reached: first galaxy". Reload: gone.
3. Log Jupiter from `/tonight/planets`: the toast there, and its link opens `/log/progress`.
4. On `/log/progress`, the Milestones band is first, with two reached (dated) and the rest muted with progress.

## Performance Considerations

- A save rated ≥ 3 makes two extra `listSeenEntries` reads (normally one request each).
- A save rated 1-2 makes none.
- The progress page adds no read.
- Tonight's load is unchanged.

## Migration Notes

None, unless the owner picks stored milestones (decision 2), which would add a phase with a table, RLS and a `TABLES` entry.

## References

- Research: `context/changes/observing-milestones/research.md`
- PRD: `context/foundation/prd.md:191-203,451,723-725`
- Roadmap: `context/foundation/roadmap.md` "S-06: Observing milestones"
- S-05: `context/archive/2026-10-09-observing-progress/`
- Progress model: `src/lib/progress/progress.ts`
- Notice params: `src/lib/offline/copies.ts:34-35`, `src/lib/toasts.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The milestone model

#### Automated

- [ ] 1.1 `npx vitest run src/lib/progress/milestones.test.ts` passes, including the rating-2-reaches-nothing and unchanged-log-reaches-nothing cases
- [ ] 1.2 `npx astro check`, `npm run lint` and `npm test` pass

### Phase 2: The celebration at save

#### Automated

- [ ] 2.1 `npx vitest run src/lib/progress/celebrate.test.ts src/lib/offline/copies.test.ts src/lib/toasts.test.ts` passes
- [ ] 2.2 `tests/e2e/observing-milestones.spec.ts` celebration cases pass against a local preview (see "Running the checks")
- [ ] 2.3 `npx astro check`, `npm run lint` and `npm test` (incl. i18n parity) pass

#### Manual

- [ ] 2.4 Screenshots of the milestone toast on `/log` and `/tonight/planets` in EN/PL × dark/light/red at 390 px and desktop: readable, the link reachable, red mode legible, nothing hidden behind the TabBar

### Phase 3: Milestones on the progress page

#### Automated

- [ ] 3.1 `tests/e2e/observing-milestones.spec.ts` page cases pass, plus `tests/e2e/tonight-phone.spec.ts` (no sideways scroll on `/log/progress`)
- [ ] 3.2 `npx astro check`, `npm run lint`, `npm test` and `npm run build` pass

#### Manual

- [ ] 3.3 Screenshots of `/log/progress` (none reached; several reached) in EN/PL × dark/light/red at 390 px and desktop: the band reads first, reached vs not yet distinguishable in red mode, PL wraps at 320 px
- [ ] 3.4 `/design` specimens for `MilestoneToast` and `MilestoneList` render in all themes
