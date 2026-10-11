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
  - Tonight shells read `?logged`: the dashboard `src/pages/tonight.astro:22`, plus `src/pages/tonight/targets.astro:23-31`, `planets.astro:23`, `moon.astro` and `nights.astro` (plan review F9).
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
2. **Usunięcie lub obniżenie oceny wpisu (plan review F1).**
   - Domyślnie kamień milowy jest wyliczany z dziennika tak samo jak liczniki S-05.
   - **To odchodzi od US-06:** kryterium mówi, że kamień milowy jest „pokazany raz, przy zapisie wpisu, który go osiąga, i zostaje na liście na stronie postępów”.
   - Przy wyliczaniu kamień milowy znika z listy, gdy usuniesz wpis, który go osiągnął, albo obniżysz jego ocenę do 1-2. Ponowne osiągnięcie świętujemy wtedy drugi raz.
   - Wybrałem to, bo nie wymaga tabeli, trzyma jedną regułę z S-05 i ogranicza zakres.
   - Alternatywa zgodna z US-06: tabela osiągniętych kamieni milowych (`observing_milestones`, RLS, wpis w `TABLES`). To nowa faza z migracją i testami bazy (`test:db`), plus zasada uzupełnienia dla istniejących dzienników. Wtedy każdy kamień milowy świętujemy dokładnie raz i zostaje na zawsze.
   - Którą wersję wybierasz?
3. **Wygląd świętowania (plan review F5).**
   - Domyślnie istniejący toast (10 s, ikona Award, „Osiągnięto kamień milowy: …”, link „Zobacz postępy”) na stronie, na którą wraca zapis.
   - Czy to wystarczy, czy chcesz coś większego (np. osobna sekcja na stronie)?
   - Zapis, który osiąga kamień milowy, pokazuje też zwykły toast („Zapisano …”). Czy pokazywać dwa toasty (zapisano + kamień milowy), czy jeden połączony?
   - Domyślnie i zgodnie z rekomendacją recenzenta: dwa, ułożone jeden nad drugim, nigdy nie nachodzące na siebie, także przy pierwszym wyrenderowaniu strony.
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

- The pure model lives in `src/lib/progress/milestones.ts`. The save-side helper, which does I/O, lives in `src/lib/observations/celebrate.ts` beside `store.ts` and `redirect.ts` (plan review F8).
- The before/after reads in the routes reuse `listSeenEntries`, so one rule covers everything.
- A failed milestone read never fails the save: the celebration is simply skipped.
- The param is `milestone`, repeated once per key, with keys from the fixed set only.
- The toast is rendered in `GearShell`, signed-in only: the shell every save-return page uses (plan review F3).
- Three phases.
- The interactive planning questions were answered by the agent, as the run's rules require (the owner is away).

## Critical Implementation Details

- **Order inside a route.**
  1. Parse and validate the entry.
  2. If the rating is ≥ `LOG_PENALTY_MIN_RATING`, read `before = listSeenEntries`.
  3. Write.
  4. On success, and only if `before` succeeded, read `after`.
  5. `reached = newlyReached(milestonesOf(observingProgress(before)), milestonesOf(observingProgress(after)))`.

  Either read failing means no celebration, but the redirect still confirms the save. The failure is not hidden (plan review F4). The helper's catch logs one fixed line plus the error's name only, following `src/lib/tonight/build.ts:1227-1231`: `console.error("milestones: the seen read failed", error.name, cause name if any)`. The message is never logged, so no coordinates or values. It takes an `eslint-disable-next-line no-console -- <reason>` and an entry in `ALLOWED_DISABLES` (`src/lib/no-console-guard.test.ts`).
- **The param never carries a value.**
  - `milestone` values are keys from `MILESTONES`, and the readers validate them against the set.
  - The redirect appends them to the URL the route already builds: `?logged=M31&milestone=first-galaxy&milestone=messier-10`. Order follows `MILESTONES`.
- **"Once".**
  - The toast lists `milestone` among its params, so `ToastRegion` clears it with `replaceState` when it adopts the toast. A reload doesn't replay it.
  - `milestone` joins `NOTICE_PARAMS`, so the service worker never stores a Tonight copy carrying it.
- **Where the toast renders** (plan review F3). `GearShell.astro` reads `Astro.url.searchParams.getAll("milestone")` and renders one `MilestoneToast` only when `Astro.locals.user` is set and at least one key passes `isMilestoneKey`. Every page a save returns to (`/log`, the Tonight dashboard and focused pages) uses `GearShell`. The signed-out landing, auth pages, `/offline` and `/design` never show it, so a crafted link can't celebrate for a visitor. A future save returning to a non-`GearShell` page must render it itself.
- **Two toasts, never overlapping** (default for owner decision 3, plan review F5).
  - A milestone save also shows its ordinary toast (`saved`/`updated` on `/log`, `logged` on Tonight).
  - Server-rendered toasts are each `position: fixed` at the same spot until `ToastRegion` adopts them, so the milestone toast must not overlap at first paint. `ToastRegion` and `Notice` get a small change so that toasts rendered by the server stack in one fixed wrapper from first paint, in DOM order. `MilestoneToast` renders after the save's own notice, so the milestone sits under it once adopted.
  - The island's `logged` toast on Tonight still arrives later. The region stacks it, and the two timers run independently.
  - Keyboard: the region comes last in the DOM, so a keyboard user may reach the toast's link only after its 10 s timer has closed it. This is accepted: `/log/progress` is the lasting record.

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

**Files**: `src/pages/api/log/index.ts`, `src/pages/api/log/[id].ts`, `src/lib/observations/redirect.ts`, `src/lib/observations/celebrate.ts` (new), `src/lib/no-console-guard.test.ts` (+ tests)

**Intent**: Celebrate exactly what this save reached, and only for a rating that can count.

**Contract**:
- A shared helper, `reachedBySave({ read, rating, write })`, in `src/lib/observations/celebrate.ts` (new; it does I/O, so not in the pure `src/lib/progress/`, plan review F8).
  - `read: () => Promise<LogEntry[]>` is the seam; the routes pass `() => observationStore.listSeenEntries(supabase)`.
  - It follows the order in Critical Implementation Details: skip when `rating < LOG_PENALTY_MIN_RATING`; read before; write; read after; diff.
  - It returns `{ result, reached: MilestoneKey[] }`. A failed read yields `reached: []` and logs the fixed line (F4). A failed write returns the write's failure unchanged.
- `withMilestones(url, keys)` in `redirect.ts` appends one `milestone=<key>` per key.
- Both routes use the helper and wrap their existing success redirect in `withMilestones`. Error redirects are unchanged.
- Tests (`src/lib/observations/celebrate.test.ts`, with a fake `read` and `write`, no `vi.mock`):
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

**Files**: `src/components/progress/MilestoneToast.astro` (new), `src/components/ui/Notice.astro`, `src/components/ToastRegion.astro`, `src/components/gear/GearShell.astro`, `src/pages/design.astro`, `src/i18n/messages/en.ts`, `pl.ts`

**Intent**: One celebration markup for every page (pending owner decision 3).

**Contract**:
- `Notice` gains an optional `icon` prop, defaulting to the tone's icon (success = `CircleCheck`, `Notice.astro:89`), so a milestone shows `Award` instead of two icons (plan review F2).
- `MilestoneToast` takes `keys: MilestoneKey[]` and an optional `specimen` passed through to `Notice`, for `/design`. It renders a success `Notice` with `toast`, `param="milestone"` and `icon={Award}` (`aria-hidden`).
  - The text is `progress.milestones.reached`, a plural message (`plural(locale, n, …)`; PL impersonal: „Osiągnięto kamień milowy: …” / „Osiągnięto kamienie milowe: …”). It names the milestones, joined with the existing `createFormatter(locale).listOf` (`format.ts:703`), not a new `Intl.ListFormat` (F9).
  - Below them is an `action` link `progress.milestones.see` to `/log/progress`.
- `GearShell.astro` renders it after the page's own notice, signed in only, with keys validated by `isMilestoneKey` (F3). Unknown values are ignored.
- `ToastRegion` and `Notice`: server-rendered toasts stack in one fixed wrapper from first paint, so two never overlap before adoption (F5 default).
- Copy:
  - `progress.milestones.name.<key>` for all 11 milestones;
  - `progress.milestones.{reached, see}`.
  - EN and PL; PL is gender-neutral where it refers to objects.
- `/design` gets a `MilestoneToast` specimen (one milestone, three milestones, via `specimen`) and the `Notice` `icon` variant, in the 7-state matrix, with N/A reasons.

#### 4. e2e

**File**: `tests/e2e/observing-milestones.spec.ts` (new; the celebration half)

**Intent**: Prove "once, at save, never for 1-2" in the browser.

**Contract**: one test, titled "celebrates a milestone once, at save, and lists it on the progress page" (the celebration half here, the page half added in Phase 3 to the same test). It runs from a fresh Madrid user on the all-clear fixture, so nothing depends on test order (plan review F6):
1. `/log/new?object=M31&from=log` rated 2, night left at its default → `/log` shows the saved toast and no milestone toast.
2. Editing that entry to 4 → `/log` shows one milestone toast naming exactly the first galaxy, since one Messier object reaches no count milestone.
3. Reloading → no milestone toast, and the URL has no `milestone`.
4. `/log/new?object=jupiter&from=planets` rated 3. Navigating straight to the form doesn't depend on Jupiter being up tonight → `/tonight/planets` shows the toast naming the first planet.
5. Logging M31 again rated 5 with the night pinned to `madridDateDaysAgo(3)` → no milestone toast (already reached). Because that night is now M31's earliest rated ≥ 3 night, the page half asserts `first-galaxy`'s reached night is `madridDateDaysAgo(3)`, the night the rule derives, not the edit's night.

Milestone toasts are located by `[data-toast-param="milestone"]` (or by text), never by the bare `[data-toast-region] [data-toast]`, which also matches the save's own toast (F5). Expected copy comes from the catalogue (`en.progress.milestones.*`).

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/observations/celebrate.test.ts src/lib/offline/copies.test.ts src/lib/toasts.test.ts src/lib/no-console-guard.test.ts` passes
- `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test tests/e2e/observing-milestones.spec.ts -g "celebrates a milestone once"` passes (preview on 4333 and fixture on 4400 already running, `nvm use` prefix; see "Running the checks")
- `npx astro check`, `npm run lint` and `npm test` (incl. i18n parity) pass

#### Manual Verification:

- Screenshots of the milestone toast on `/log` and `/tonight/planets` in EN/PL × dark/light/red at 390 px and desktop: readable, the link reachable, red mode legible, nothing hidden behind the TabBar; with two toasts stacked (never overlapping, also at first paint) and PL at 390 px

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
- `MilestoneList` renders a `Band` (`progress.milestones.title`) placed first among the bands, after the page's empty-state notice (`data-progress-empty`, `progress.astro:60`) when the log is empty (F9). It holds a `divide-y` list in `MILESTONES` order:
  - **Reached:** a lucide `Check` (`aria-hidden`), the name (`text-heading`), and `progress.milestones.reachedOn({ date })` via `createFormatter(locale).formatShortDate`.
  - **Not yet:** a muted name and `progress.milestones.notYet`, or `progress.milestones.progress({ seen, total })` for count milestones.
  - Each row carries `data-milestone={key}` and `data-reached` (present only when reached) for e2e.
  - Red mode tells the two apart by icon and weight, not hue.
- `/design` gets a `MilestoneList` specimen (none reached, some reached), in the 7-state matrix.

#### 2. e2e, phone width and docs

**Files**: `tests/e2e/observing-milestones.spec.ts`, `CLAUDE.md`

**Intent**: Pin the band and document the slice.

**Contract**:
- The page half, appended to the same test as the Phase 2 journey (F6):
  - `/log/progress` shows `[data-milestone="first-galaxy"][data-reached]` with `madridDateDaysAgo(3)` formatted by `formatShortDate`, and `first-planet` reached;
  - `messier-10` not reached and showing "1 / 10".
- `/log/progress` is already in `APP_PAGES` (S-05), so the sideways-scroll check covers the band.
- `CLAUDE.md`: a short paragraph on `src/lib/progress/milestones.ts`, `celebrate.ts`, the `milestone` param (in `TOAST_PARAMS` and `NOTICE_PARAMS`) and the Milestones band.

### Success Criteria:

#### Automated Verification:

- `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test tests/e2e/observing-milestones.spec.ts tests/e2e/tonight-phone.spec.ts` passes; the phone spec covers `/log/progress` for a fresh user only, so dates and PL wrapping are manual check 3.3
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
- `src/lib/observations/celebrate.test.ts`:
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

- [ ] 2.1 `npx vitest run src/lib/observations/celebrate.test.ts src/lib/offline/copies.test.ts src/lib/toasts.test.ts src/lib/no-console-guard.test.ts` passes
- [ ] 2.2 `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test tests/e2e/observing-milestones.spec.ts -g "celebrates a milestone once"` passes (preview on 4333 and fixture on 4400 already running, `nvm use` prefix; see "Running the checks")
- [ ] 2.3 `npx astro check`, `npm run lint` and `npm test` (incl. i18n parity) pass

#### Manual

- [ ] 2.4 Screenshots of the milestone toast on `/log` and `/tonight/planets` in EN/PL × dark/light/red at 390 px and desktop: readable, the link reachable, red mode legible, nothing hidden behind the TabBar; with two toasts stacked (never overlapping, also at first paint) and PL at 390 px

### Phase 3: Milestones on the progress page

#### Automated

- [ ] 3.1 `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test tests/e2e/observing-milestones.spec.ts tests/e2e/tonight-phone.spec.ts` passes; the phone spec covers `/log/progress` for a fresh user only, so dates and PL wrapping are manual check 3.3
- [ ] 3.2 `npx astro check`, `npm run lint`, `npm test` and `npm run build` pass

#### Manual

- [ ] 3.3 Screenshots of `/log/progress` (none reached; several reached) in EN/PL × dark/light/red at 390 px and desktop: the band reads first, reached vs not yet distinguishable in red mode, PL wraps at 320 px
- [ ] 3.4 `/design` specimens for `MilestoneToast` and `MilestoneList` render in all themes
