<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Observing milestones (M-3 S-06)

- **Plan**: context/changes/observing-milestones/plan.md (commit ecbd0e2, branch feat/observing-milestones)
- **Phases**: 3
- **Date**: 2026-10-11
- **Reviewer**: the "reviewer" agent (Opus), independent of the plan's author
- **Verdict**: NEEDS ATTENTION. No critical finding; the premise (milestones derived from `observingProgress`, diffed before and after a save) holds and the "once" mechanics are sound. Seven warnings sharpen the plan; one of them (F1) is an owner decision that can change the plan's structure.
- **Findings**: 0 critical, 7 warnings, 3 observations
- **Triage** (2026-10-11, by the plan's author on the orchestrator's instruction): F2, F3, F4, F6, F7, F8 and F9 applied to plan.md; F1 and F5 pending the owner (questions 2 and 3 updated); F10 no action. Originally: not run interactively. The owner is away and the orchestrator's rules forbid asking, so each finding carries the reviewer's **Recommended resolution** and `Decision: PENDING`. The plan's author applies the accepted fixes; `change.md` was deliberately left at `planned` (the author flips it).

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Claim Accuracy | WARNING |
| Substance | PASS |
| Feasibility | WARNING |
| Sequencing | PASS |
| Architecture Fit | WARNING |
| Scope Discipline | WARNING |
| Verifiability | WARNING |
| Coverage | WARNING |

## Grounding

- **Claims:** two sub-agents (claim verification; feasibility and coverage) plus the reviewer's spot checks.
- **Confirmed:**
  - `observingProgress`, `Checklist`, `ChecklistItem.type`, `seen.firstNight`, `First.firstNight` (`src/lib/progress/progress.ts:23-40,72-77`); `firsts` = 7 planets then the Moon.
  - `listSeenEntries(client): Promise<LogEntry[]>` filters `rating >= LOG_PENALTY_MIN_RATING` in SQL and **throws** `Error("errors.load.observations", { cause })` (`src/lib/observations/store.ts:256-270`); `create`/`update` return `WriteResult` (`:104`, `:174`), `update` writes `rating` (`:221`).
  - Routes and redirects: `src/pages/api/log/index.ts:38-45`, `[id].ts:36`, `logNotice` / `readLogNotice` / `tonightReturnPath` (`redirect.ts:83,91,29`); `returnTargetSchema` accepts `log`, `targets`, `moon`, `planets` (`schemas.ts:96`); `/log/new?object=…&from=log` (`src/pages/log/new.astro:21-22`); the form's night is an editable date field (`ObservationForm.tsx:152-157`).
  - `TOAST_PARAMS` (`src/lib/toasts.ts:17`), `withoutParams` deletes every repeated value (`:21-25`), `toasts.test.ts` exists; `ToastRegion` stacks several toasts (`flex flex-col gap-2`, newest last) and adopts island-inserted ones by MutationObserver.
  - `NOTICE_PARAMS` (`src/lib/offline/copies.ts:34-35`) used only by `mayStoreShell` (`:128-130`, `src/sw.ts:503`).
  - `DEEP_SKY_TYPES` holds all eight type strings the plan uses (`src/lib/catalogue/index.ts:16-29`); both lists contain galaxies, globulars and nebulae; M31 is `galaxy`.
  - `LOG_PENALTY_MIN_RATING = 3` via the engine barrel; `PLANET_TARGET_KEYS` has 7 keys; `createFormatter().formatShortDate` and `listOf` exist (`format.ts:382,703`); `/log/progress` is in `APP_PAGES` (`tests/e2e/tonight-phone.spec.ts:42`); `onboardInMadrid` and `madridDateDaysAgo` exist (`tests/e2e/helpers.ts:96,139`).
- **Wrong / missing:** see F2 (Notice has no icon prop) and F9 (shell list, page order).
- **Commands:** `npm test` (`vitest run`, include `src/**/*.test.ts`), `npm run lint`, `npx astro check`, `npm run build`, `npx vitest run <file>` and `npx playwright test <spec>` all resolve to real scripts/config. Not executed: the worktree has no `node_modules` yet, and the reviewer does not run `npm ci` in the author's worktree. Playwright has no `webServer`; the preview and the forecast fixture must already run.
- **Sequencing:** no phase depends on a later one and none leaves the repo broken (Phase 2's toast links to a progress page that gains its band in Phase 3, harmless). No `test:db` work is needed while there is no table.

## Findings

### F1 — The derived-lifetime default departs from US-06's literal text
- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; the owner's answer can add a table, migration and db tests
- **Dimension**: Scope Discipline
- **Location**: plan.md "Owner decisions pending" #2; plan-brief.md "Key Decisions" (Lifetime)
- **Detail**: US-06's acceptance criterion says a milestone "is shown once, when the log entry that reaches it is saved, and **stays listed** on the progress page (FR-041)" (`prd.md:202-203`). The plan's default derives milestones from the log, so deleting or down-rating the reaching entry un-lists the milestone, and re-logging celebrates it a second time. The brief calls this "consistent with US-06 'deleting or re-rating updates…'", but that criterion is about counts and marks, not milestones. Decision 2 asks the right question, but presents the default as neutral when it contradicts the PRD's wording. A derived design also cannot recover a celebration lost to a failed after-read (see F4).
- **Fix A ⭐ Recommended**: Keep the derived default, and reword decision 2 to say plainly that it departs from US-06 ("stays listed", "shown once") and why (no table, one rule with S-05, the user's preference for modest scope). Then let the owner choose knowingly. · Strength: no migration or RLS work, consistent with S-05's compute-on-read decision · Tradeoff: if the owner picks the stored model, Phase 1 grows a table, `TABLES` entry and isolation test · Confidence: HIGH — PRD text verified · Blind spot: the owner's preference is unknown
- **Fix B**: Store reached milestones (`observing_milestones`, per-user, RLS, `TABLES`, insert-on-conflict-do-nothing; celebrate exactly the rows inserted by this save). · Strength: matches US-06 literally, makes "once" exact and survives deletes · Tradeoff: a new phase with migration, `db:types`, `test:db` cases, and a backfill rule for existing logs · Confidence: MED — design sketched, not verified · Blind spot: how the "reached night" is chosen for backfilled rows
- **Recommended resolution**: Fix A now; Fix B only if the owner asks for "stays listed forever". **Needs an owner decision** (decision 2).
- **Decision**: PENDING (owner). Derived default kept; owner question 2 reworded: it now says plainly that the derived model departs from US-06 ("shown once … and stays listed"), with the table alternative as a new phase with a migration and db tests. The brief's Lifetime row and risks updated to match.

### F2 — `Notice` has no icon prop and no specimen passthrough
- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, narrowly scoped
- **Dimension**: Claim Accuracy
- **Location**: plan.md Phase 2 › Changes Required › 3 "The toast"; `src/components/ui/Notice.astro:25-37,89`
- **Detail**: The contract says `MilestoneToast` "renders a success `Notice` … a lucide `Award` icon". `Notice` props are `tone`, `toast`, `dismissible`, `specimen` and `param`. The icon is fixed per tone (success = `CircleCheck`, `:89`), so a slotted `Award` would sit next to a `CircleCheck`. The `/design` specimen also needs `Notice`'s `specimen` mode, which `MilestoneToast` cannot pass through as written. `Notice.astro` is not in the plan's file list.
- **Fix**: Add an optional `icon` prop to `Notice` (defaulting to the tone's icon) and a `specimen` prop on `MilestoneToast` passed through to `Notice`. List `Notice.astro` (and its `/design` specimen) under Phase 2.3's files.
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED. Phase 2.3: `Notice` gains an optional `icon` prop (default: the tone's icon); `MilestoneToast` passes `icon={Award}` and a `specimen` prop through to `Notice`. `Notice.astro` and its `/design` variant added to the files.

### F3 — The toast renders in `Layout`, so it shows on signed-out pages and to anyone sent a crafted link
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture Fit
- **Location**: plan.md "Critical Implementation Details › Where the toast renders"; `src/layouts/Layout.astro:14,66`
- **Detail**: `Layout` wraps the signed-out landing (`index.astro`), the auth pages (`AuthShell`), `/offline` and `/design`. With the plan as written, `/?milestone=messier-110` shows "Milestone reached: all 110 Messier objects" to anyone, signed in or not. It is harmless data-wise, but it is a spoofable celebration and differs from the existing save notices (`saved`, `updated`, `logged`), which render only on the gated pages a save returns to. Every page a save returns to (`/log`, the Tonight shells) uses `GearShell` (`GearShell.astro:25`).
- **Fix**: Render `MilestoneToast` in `GearShell` (or in `/log` and the Tonight shells), and only when `Astro.locals.user` is set. The keys are still validated with `isMilestoneKey`. · Strength: same footprint as the existing notices, no signed-out exposure · Tradeoff: a future save that returns to a non-`GearShell` page must render it itself · Confidence: HIGH — Layout and shell usage verified · Blind spot: none significant
- **Recommended resolution**: apply the fix. This was a delegated choice; it doesn't change what a signed-in user sees.
- **Decision**: APPLIED. The toast renders in `GearShell` only when `Astro.locals.user` is set, keys validated by `isMilestoneKey`; `Layout` is no longer touched. Critical Implementation Details, Phase 2.3, delegated decisions and the brief updated.

### F4 — A failed milestone read is swallowed with no trace, and the loss is permanent
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Coverage
- **Location**: plan.md "Critical Implementation Details › Order inside a route" ("No `console` is used: an error is swallowed only into 'no celebration'"); brief "Failure handling"
- **Detail**: `listSeenEntries` throws with a `cause` (`store.ts:270`). The plan catches it into `reached: []` and logs nothing. The repo does drop optional reads silently (`src/lib/tonight/load.ts:117`, the sky-check record in `TonightContent.astro:95-104`), but here the loss cannot be recovered. If the after-read fails once the write has succeeded, the next save's before-read already counts the milestone, so it is never celebrated, and nobody can tell why. That clashes with the workspace rule "Never hide the evidence … If the fix needs a `catch`, it logs or reports the error with its cause". The repo has a sanctioned pattern: `src/lib/tonight/build.ts:1227-1231` logs a fixed line plus `error.name` only (no message, so no coordinates), with an allowlisted `eslint-disable-next-line no-console -- <reason>` and an entry in `no-console-guard.test.ts`'s `ALLOWED_DISABLES`.
- **Fix**: In the helper's catch, use the `build.ts` pattern: a fixed line ("milestones: the seen read failed") plus `error.name` (and the cause's name, if any). Add the disable, bump `ALLOWED_DISABLES`, and list `src/lib/no-console-guard.test.ts` under Phase 2's files. Keep the save's redirect unchanged. · Strength: follows an existing, guarded precedent; leaves a trace in Workers logs · Tradeoff: one more allowlisted log line · Confidence: HIGH — pattern and guard verified · Blind spot: none significant
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED. The helper's catch logs one fixed line plus `error.name` and the cause's name (the `build.ts:1227-1231` pattern), with an allowlisted `eslint-disable-next-line no-console -- <reason>` and an `ALLOWED_DISABLES` entry; `src/lib/no-console-guard.test.ts` joins Phase 2's files and line 2.1.

### F5 — Two toasts at once: overlap at first paint, order, phone coverage
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Coverage
- **Location**: plan.md Phase 2.3, "Owner decisions pending" #3; `src/components/ToastRegion.astro`; `global.css:493-512`; `tests/e2e/toasts.spec.ts:32`
- **Detail**: Every milestone save also shows its ordinary toast (`saved` or `updated` on `/log`, `logged` on Tonight).
  - **Overlap at first paint:** once adopted, toasts stack (`flex flex-col gap-2`). Before the deferred module adopts them, though, every server-rendered toast is `position: fixed` (`toast-region`) at the same spot, so on `/log?updated=…&milestone=…` the two can overlap at first paint.
  - **Order and timers:** on Tonight, the island's `logged` toast arrives later and lands under the milestone toast, and the two 10 s timers run out of step.
  - **Phone:** on 390×844, two toasts (one with a link and long Polish names) above the TabBar cover a large part of the screen.
  - **Keyboard:** the region comes last in the DOM, so a keyboard user may reach the link only after the 10 s timer has closed it. That is acceptable because `/log/progress` is the lasting record, but the plan should say so.
  - **e2e:** the existing toast locator `[data-toast-region] [data-toast]` matches both toasts, so the new spec must filter it.

  Whether a save shows one toast or two is user-visible, so it belongs with owner decision 3, not with the delegated choices.
- **Fix**: Keep two stacked toasts as the default and add the question to decision 3 (in Polish, e.g. „Czy przy kamieniu milowym pokazywać dwa toasty (zapisano + kamień milowy), czy jeden połączony?"). Make the pre-adoption overlap impossible: either render the milestone toast with `specimen`-like flow positioning until adopted, or stack server-rendered toasts in one fixed wrapper. Add "two toasts stacked, nothing behind the TabBar, PL at 390 px" to manual check 2.4. Filter the e2e locator by text or by `data-toast-param="milestone"`. Note the keyboard limitation in the plan. · Strength: no new mechanism; closes the visual gap · Tradeoff: a small `ToastRegion`/`Notice` change, outside the plan's current file list · Confidence: MED — overlap inferred from CSS and script timing, not observed · Blind spot: how long the overlap lasts on a real phone
- **Recommended resolution**: apply the fix. **The one-toast-or-two question needs an owner decision** (added to decision 3).
- **Decision**: PENDING (owner). Owner question 3 now also asks one toast or two; the default (and the reviewer's recommendation) is two, stacked, never overlapping on first render. The plan carries that default's mechanics: server-rendered toasts stack in one fixed wrapper from first paint (`ToastRegion`/`Notice`); the e2e filters by `[data-toast-param="milestone"]`; manual check 2.4 covers two stacked toasts and PL at 390 px; the keyboard limitation is noted.

### F6 — The e2e journey depends on test order and the run date, and one of its oracles is wrong
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Verifiability
- **Location**: plan.md Phase 2 › 4 "e2e" steps 4-5; Phase 3 › 2 "after the Phase 2 journey"; `context/foundation/test-plan.md` §6.5
- **Detail**:
  - **(a) Order:** Phase 3's page cases run "after the Phase 2 journey", but no spec in `tests/e2e/` uses `describe.serial` or `describe.configure`; each test signs up its own user. §6.5 reproduces flakes with `--repeat-each 4 --workers 5`, which breaks order dependence, and CI fails tests that only pass on retry.
  - **(b) Wrong oracle:** step 5 logs M31 "on another night". The form caps the night at `maxNight`, so in practice that night is earlier, and `first-galaxy`'s `reachedNight` becomes that earlier night, not "the edit's night" that Phase 3 asserts. Whether a later night is even allowed depends on the clock (civil dawn).
  - **(c) Run date:** step 4 logs `jupiter` "from the Planets page". "Mark observed" exists only for planets that are up (`planets-on-tonight.spec.ts:38` skips otherwise), so a fixed Jupiter can be absent on the run date.
- **Fix**:
  - Put the page assertions into the same test as the journey (or give the page test its own user and seed it through the form).
  - Pin step 5's night with `madridDateDaysAgo(n)` and assert the night the rule derives (the earliest rated ≥ 3 night).
  - For step 4, navigate directly to `/log/new?object=jupiter&from=planets` (the redirect needs only `from`), then assert the toast on `/tonight/planets`.
  - Confidence: HIGH, helpers and form limits verified. Blind spot: none significant.
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED. One test holds the journey and the page assertions, so it is order-independent. Step 4 navigates to `/log/new?object=jupiter&from=planets`, so it doesn't depend on Jupiter being up. Step 5 pins `madridDateDaysAgo(3)`, and the page half asserts that night, as the rule derives it.

### F7 — Verification lines 2.2 and 3.1 are not runnable commands
- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, narrowly scoped
- **Dimension**: Verifiability
- **Location**: plan.md Progress 2.2, 3.1; "Running the checks"
- **Detail**: "celebration cases pass against a local preview (see 'Running the checks')" and "page cases pass" name no command or test filter. Playwright has no `webServer`, so the preview on 4333 and the fixture on 4400 must already be running. Every npm/npx line needs the `nvm use` prefix (Tripwires), and the worktree has no `node_modules` yet. Line 3.1's phone check covers `/log/progress` only for a fresh user (nothing reached), so PL wrapping with dates stays a manual check.
- **Fix**: Write each line as the exact command, e.g. `BASE_URL=http://localhost:4333 SUPABASE_URL=… SUPABASE_KEY=… npx playwright test tests/e2e/observing-milestones.spec.ts -g "celebrat"`. Name the test titles the `-g` filters match, and note in 3.1 that dates and PL wrapping are covered by manual check 3.3.
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED. Lines 2.2 and 3.1 are now exact commands, with the `BASE_URL`/`SUPABASE_*` env and the `-g "celebrates a milestone once"` filter, and they name the running preview and fixture. 3.1 notes that dates and PL wrapping are manual check 3.3. The Progress rows were synced, since implementation hasn't started.

### F8 — `celebrate.ts` does I/O inside the pure progress module and has no seam for its fake store
- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, narrowly scoped
- **Dimension**: Architecture Fit
- **Location**: plan.md Phase 2 › 1 "Routes"; plan-brief.md Scope ("both pure and tested")
- **Detail**:
  - `progress.ts` documents itself as "Pure: entries in, plain data out". `reachedBySave(client, rating, write)` reads through `observationStore` around a write, which is I/O, and the brief wrongly calls it pure. It sits more naturally in `src/lib/observations/` beside `store.ts` and `redirect.ts`.
  - The signature has no store seam, so "with a fake store" means `vi.mock`.
  - Cost note: a save rated 3 or above makes two full `listSeenEntries` reads, and the before-read delays the write. That is acceptable as planned. An in-memory "after" for creates is possible, but not worth the second rule.
- **Fix**: Move it to `src/lib/observations/celebrate.ts`, take `read: () => Promise<LogEntry[]>` as a parameter (routes pass `() => observationStore.listSeenEntries(supabase)`), and correct the brief.
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED. The helper moves to `src/lib/observations/celebrate.ts` with a `read: () => Promise<LogEntry[]>` seam; its tests use fakes (no `vi.mock`); the brief no longer calls it pure.

### F9 — Small claim and copy corrections
- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, narrowly scoped
- **Dimension**: Claim Accuracy
- **Location**: plan.md "Current State Analysis › Notices"; Phase 2.3 copy; Phase 3.1 "placed first"
- **Detail**:
  - The list of Tonight shells that read `?logged` omits `planets.astro:23` and the dashboard `tonight.astro:22`. It has no consequence for the plan, but the research is cited as evidence.
  - `progress.astro` already has a `data-progress-empty` block (`:60`) before its bands, so "placed first" needs a rule for the empty state.
  - The names should be joined with the existing `createFormatter(locale).listOf` (`format.ts:703`) rather than a new `Intl.ListFormat`.
  - "Milestone reached" vs "Milestones reached" needs `plural(locale, n, …)`, or a number-free form such as PL „Osiągnięto kamień milowy: …", where "Osiągnięto" is impersonal.
- **Fix**: Correct the shell list. State that the Milestones band comes after the empty-state notice (or replaces the notice for a fresh log). Use `listOf`. Make `progress.milestones.reached` a plural message.
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED. The shell list now includes `tonight.astro:22` and `planets.astro:23`. The Milestones band comes after the empty-state notice. The names are joined with `createFormatter(locale).listOf`. `progress.milestones.reached` is a plural message, with an impersonal PL form („Osiągnięto…”).

### F10 — What the plan gets right (no action)
- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, narrowly scoped
- **Dimension**: Sequencing
- **Location**: plan.md "Key Discoveries", "Critical Implementation Details"
- **Detail**:
  - `newlyReached`, keyed on reached status, handles an edit that changes the target or moves the night.
  - `listSeenEntries` filters ratings below 3 in SQL, so an edit from 2 to 4 is correctly absent from the before-read.
  - `withoutParams` removes every repeated `milestone`.
  - Adding `milestone` to `NOTICE_PARAMS` keeps the shell, which bakes in the toast, out of storage.
  - The 1-2 guard holds both by the rule and by the short-circuit.
  - The four pending decisions are rightly the owner's.
  - Two near-simultaneous saves double-celebrating is an accepted, documented risk.
- **Fix**: none.
- **Recommended resolution**: none; recorded so a re-review doesn't re-open these questions.
- **Decision**: N/A (no action)
