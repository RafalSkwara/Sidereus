<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Finder chart (M-3 S-03)

- **Plan**: context/changes/finder-chart/plan.md
- **Scope**: Full plan (commits aa14caa..f04d7a6 on feat/finder-chart, rebased onto e7b8c49)
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-10-13
- **Reviewer**: the "reviewer" agent (Opus), with two Opus sub-agents for the engine and star pipeline and for offline storage; their findings were spot-checked in the code
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 3 observations
- **Triage**: applied by the author on 2026-10-13 (see each Decision line; F2 and 6.6 decided by the owner). Originally not run interactively. The owner is away and the orchestrator's rules forbid asking, so each finding carries a **Recommended resolution** and `Decision: PENDING`. `change.md` was deliberately **not** stamped `impl_reviewed`, against the skill's default: the orchestrator's rule is that the author updates it. The roadmap edit in the working tree is the author's and was not touched. The reviewer wrote only this file.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Evidence

### Gates the reviewer ran (read-only)

| Gate | Result |
|------|--------|
| `npm test` | 101 files, 1760 passed, 1 skipped, 6 todo |
| `npx astro check` | 0 errors |
| `npm run lint` | clean |
| `gzip -c finder-stars.json \| wc -c` | 146,440 bytes, under the 160,000 budget |
| sub-agent runs of `src/lib/engine`, `src/lib/catalogue`, `src/lib/finder` | 752 passed |
| sub-agent runs of `src/lib/offline`, `src/lib/account-plan` and the guard | 144 passed |

### What the reviewer did not run

- **Build, smoke and e2e**, per the orchestrator: the author's results are e2e 54 passed and 3 skipped, smoke passed.
- **`stars:build`**, which rewrites the generated files and needs the network.

### The full-plan gate (page and island)

- **The shell.** `finder.astro` calls `requireFullPlan` and renders `FinderLocked` (with no island) for free and signed-out visitors, `DatabaseMissing` when nothing is configured, and the island only when `ok`. It never redirects.
- **The island.** `loadFinderFor` (`src/lib/finder/load.ts:101-107`) calls `requireFullPlan` first and returns `locked` before reading Tonight, the star file or the engine.
- **Failing closed.** A failed `account_plans` read is `unknown`. `getAccountPlan` maps it to `free`, and `requireFullPlan` answers `needs-full`.
- **The smoke steps** (`scripts/smoke.mjs`):
  - free shell locked with no island;
  - after the grant, a full shell whose island URL is captured, with `&amp;` decoded;
  - a full replay that renders `data-finder-chart`, or `not-ranked` in the no-darkness window;
  - a demoted replay that is locked;
  - a signed-out page that gives a 302 to the exact `next`;
  - a signed-out replay that is locked.
- **Failing loudly.** A missing capture rejects, and a missing key fails under CI and skips locally.

### The CI rule change

- **In CI.** `ci.yml` passes `SUPABASE_URL="$API_URL" SUPABASE_SECRET_KEY="$SECRET_KEY"` inline on `npm run smoke` and on `npm run test:e2e` only.
  - `source supabase.env` sets unexported shell variables, after `npm run preview &` has already started, so the preview never inherits the key.
  - Nothing goes to `.env` or `.dev.vars`.
- **In the docs.** CLAUDE.md "Env" and "Commands" and the header of `account-plan.mjs` are updated.

### Engine and star file

- **Engine purity** holds:
  - `purity.test.ts` covers `finder.ts`;
  - stars arrive as an input, never as an import.
- **Start-star invariant** holds:
  - stars are taken at or above the minimum altitude, using unrefracted altitude, which is the safe side;
  - the starting limit stays at or below the naked-eye limit for b = 1-9.
- **Hop search** is exact:
  - additive integer cost, layered;
  - a 150-sky brute-force comparison test.
- **The 80° rule** is pinned by tests:
  - a 79.9/80.0 boundary test;
  - a zenith-target test;
  - an x = 0 test at least 10° from the zenith.
- **Reference hops:** 7, with no divergences.
- **Coverage gate:** 97 %, against a measured 100 % (373/373).
- **The bright-star pair** is byte-identical to e7b8c49.
- **Generated file consistency.** `finder-stars` meta and data agree: count 25,791, 3,342 designated, HYG pin `c7f7f883…`.
- **Who reads the star file.** It is read only through `loadFinderStars` (dynamic import), and the memoised promise resets on failure.
- **`.prettierignore`** lists both files.

### Licence

- **`LICENSE-DATA.md`** has an "Upstream: Hipparcos (ESA)" section:
  - CC BY-NC 3.0 IGO, with its link;
  - "Credit: ESA";
  - the ESA request is pending;
  - BY-SA cannot lift the NC condition.
- **`Attribution`** reads "Hipparcos, Credit: ESA (CC BY-NC 3.0 IGO)", linked.
- **PRD OQ21** keeps the uncertainty about the SAO fallback.
- **Where Attribution is rendered:**
  - the chart;
  - the not-ranked, no-gear and failed states;
  - the not-configured shell;
  - the free explainer;
  - `/design`.

### Offline

- **Keying and copy rules:**
  - `storedPageOf` gives the canonical key (`31` → `M31`);
  - pairs are keyed by `(siteId, page, target, kind)`;
  - a chart has no next-night copy.
- **What stores and what drops:**
  - `copyMetaFor` refuses a non-full chart, a missing target or a mismatched target;
  - charts are dropped only on an explicit `free`: a free island commit, a locked shell or a locked island;
  - `unknown` neither drops nor commits a chart.
- **Old indexes** still parse: `target`, `targetName` and `freeSince` read as `null`, and `plan` as `unknown`.
- **Concurrency:** every index mutation runs inside `serial`.
- **Purges:** the owner, auth-POST, signed-out and 36 h purges all cover charts.
- **Serving and listing:**
  - served copies get `markFromDevice`;
  - `/offline` builds links from the key and the site id only;
  - no coordinates go into the index or URLs.

### The author's declared deviations, judged

- **The packed star encoding.**
  - What it is: positions as `ra×18001+dec` integers in one string, magnitude runs, and a sparse designation table.
  - Verdict: acceptable. It is 146 KB gzip, validated by the loader and deterministic.
  - Not yet recorded in the plan; see F5.
- **The server bundle: +424,700 bytes.**
  - The intent (+500 KB) is met. The absolute budget in Progress 4.7 (4,290,555) is exceeded (4,306,138), because main grew after the plan was written.
  - Verdict: acceptable; restate the row.
- **`poleUp` at southern sites.**
  - What it is: south up, toward the visible pole, with matching copy ("south is at the top").
  - Verdict: correct by D-6's intent ("toward the visible celestial pole"); the plan's literal "north up" needs a one-line amendment.
  - Latitude 0 gives north, which is tested.
- **`freeSince` from the Date header.**
  - What it is: the time is used only for locked answers, rounded up to the end of the second, so it errs toward refusing a chart.
  - Verdict: sound while Date is present. The fallback without a header is the device's clock; see F6.

## Findings

### F1 — A chart whose plan was read before a demotion can still be stored, and it clears `freeSince`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/OfflineCopy.astro:34; src/lib/offline/copies.ts:354-375; src/components/finder/FinderContent.astro (load before render)
- **Detail**:
  - **Which time is compared.** `preparedAt` is `new Date()` when `OfflineCopy` renders. In the chart island that happens *after* `loadFinderFor` has run its plan guard, loaded Tonight and the star file, and built the chart. The plan read happened at the start; the time stamped is the end.
  - **The race.** The chart island reads `full` at t1. The account is demoted. A Tonight island reads `free` and commits at t3, setting `freeSince = t3` and dropping the charts. The chart island then renders at t4 > t3.
  - **What `commitPair` does with it.** It accepts the chart as not stale (`:355`). It also treats it as "the plan's return" (`returned`, `:364-365`) and sets `freeSince` to `null`.
  - **The result.** A chart built for a pre-demotion plan read is stored after the drop. It stays until the next online free answer. The window is the chart build time, during a demotion, so it is narrow. But the plan's critical detail promises that "a chart rendered before the device last saw a free account never comes back".
- **Fix**: Stamp the plan *read* time.
  - `readOnce` in `src/lib/account-plan/index.ts` stores the time with the memoised promise.
  - `OfflineCopy` renders it as `data-plan-at`, and the finder's locked root renders it too.
  - `commitPair` uses `planAt`, not `preparedAt`, for the stale check and for setting and clearing `freeSince`.
  - Add a `copies.test.ts` case: chart `planAt` < a free answer's `planAt` < chart `preparedAt` must be refused and must not clear `freeSince`.
  - Strength: closes the race exactly, with the same server clock and no new request.
  - Tradeoff: one more attribute, plus a small change in the account-plan module.
  - Confidence: HIGH. Traced in `FinderContent`, `OfflineCopy` and `commitPair`.
  - Blind spot: how long the chart build takes on Workers (the size of the window).
- **Recommended resolution**: apply the fix (delegated).
- **Decision**: APPLIED (delegated, 2026-10-13). The memoised plan read records when it was read (`accountPlanForCopy` → `{ plan, at }`, still one query; `at` taken before the query for `full`, after it for `free`/`unknown`, so a slow read errs toward refusing). `OfflineCopy` and both locked finder roots render `data-plan-at`; `planAt` on `IslandCopy`/`CopyMeta` (old copies and a missing attribute fall back to `preparedAt`); `commitPair` compares `planAt` for the stale check and for setting/clearing `freeSince`. New test: chart planAt < free planAt < chart preparedAt is refused and keeps `freeSince`.

### F2 — The overhead note promises a zenith cross that is often not drawn

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/i18n/messages/en.ts:889-890, pl.ts:788-789; src/components/finder/FinderChart.astro:31,45; src/lib/engine/finder.ts:452-458
- **Detail**:
  - **The copy.** `overheadNorth` and `overheadSouth` always say "the cross marks the zenith".
  - **The engine.** `buildPanel` draws the marker only when the zenith falls inside a panel.
  - **The gap.** A target whose panel centre is 80-85° up switches to the overhead orientation with the zenith outside both panels. The repo's own test at `finder.test.ts:596-600` asserts `orientation: "overhead"` with both `zenith` values `null`. So the user is told to look for a cross that isn't there.
  - **Against the plan.** D-6 and O-2, which the owner confirmed, say "draws a zenith marker".
- **Fix**: Two ways, both keeping north or south up:
  - Default: when neither panel holds the zenith, draw a small marker on the panel's rim pointing toward the zenith, labelled "Zenith", so O-2's "zenith marker" holds.
  - Cheaper: add a copy variant without "the cross" for that case.
- **Recommended resolution**: apply the rim marker. The note is user-visible: **pending owner confirmation of the marker's look** (Polish: „Gdy zenit leży poza mapką, na jej krawędzi rysujemy znacznik ze strzałką w stronę zenitu. Czy tak?”). Until the owner answers, at least make the copy match what is drawn.
- **Decision**: APPLIED per the owner's decision (2026-10-13): in the overhead orientation a panel that does not hold the zenith draws an arrow on its edge pointing toward the zenith, labelled "Zenith" (`zenithEdge` per panel; the ray meets the square edge; great-circle direction beyond 85°). The note says the zenith is at the cross or in the direction of the arrow (en + pl). Geometry unit tests (engine and SVG), a `/design` overhead-edge specimen with a red-mode cell, red check by screenshot (arrow strokes rgb(255,0,0)).

### F3 — The build's leak check would miss a statically imported star file

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/build-sw.mjs:88-116; src/lib/catalogue/finder-stars.test.ts:219-224
- **Detail**:
  - **What the check looks for.** `dist/client` files are searched for the text `finder-stars` and the meta's `filter` string. That catches today's dynamic `import()`, whose chunk name contains `finder-stars`.
  - **What it misses.** A static `import … from "…/finder-stars.json"` reached by an island would be inlined by Vite, with neither string in it.
  - **The source scan doesn't close the gap.** It covers direct imports from `.tsx` files, `sky-view/**`, `stars.ts` and `index.ts`. A `.ts` helper that an island imports gets through.
  - **The stakes.** About 372 KB of server-only data in the browser bundle: a weight problem, not a secret leak.
- **Fix**: Add a marker taken from the data itself (e.g. the first 40 characters of the `pos` string) to `FINDER_LEAK_MARKERS`, and widen the source scan to every module that a `.tsx` island transitively imports, or to all of `src/components/**`.
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED. `build-sw.mjs` adds a marker taken from the data (the first 40 characters of the `pos` string) to the leak scan of every `dist/client` file; `finder-stars.test.ts` scans every module under `src/components/**` (the server-only `/design` sample helper is allowlisted and still scanned). Break check: a static import of the star file into `TonightSkyView.tsx` failed the build (`the finder star file leaked into the browser bundle`), then restored.

### F4 — A failed plan read is logged with no error name or code

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/account-plan/index.ts:35-38; src/lib/account-plan/store.ts (read)
- **Detail**:
  - **What is logged.** Only `"getAccountPlan: the plan read failed"`. `accountPlanStore.read` discards the error (`{ error: true }`).
  - **What was asked.** The plan (re-review F11) asked for the fixed line plus the error's name or code, as in `build.ts:1227-1231` and `loadFinderFor`'s two logs. The repo's debugging rule says not to drop error causes.
  - **Why it matters.** Without the code, a production trace can't tell an RLS refusal from a timeout.
- **Fix**: Have `read` return `{ error: true, code: error.code ?? error.name }` (fixed PostgREST codes, never the message), log the code, and update the `ALLOWED_DISABLES` reason.
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED. `accountPlanStore.read` returns `{ error: true, code }` (PostgREST `code`, else the error's `name`, never the message); `getAccountPlan` logs the fixed line with it; `ALLOWED_DISABLES` reason updated (count 1); new `store.test.ts`.

### F5 — Deviations from the plan's contracts are not written into the plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: plan.md D-2, D-3, D-6, Phase 1 contract, Progress 4.7; src/lib/catalogue/finder-stars.ts:29-38; scripts/build-stars.mjs:208,212; finder-stars.test.ts:203
- **Detail**: None of these is a defect. `/10x-archive` and the next slice will read the plan as the truth.
  - **The star file has no HYG ids.** The packed file stores none and `FinderStar` has no `id`. So the loader can't check "unique ids", which the build checks instead. And "every `BRIGHT_STARS` star with the same HYG id" became a match by position (1′) and magnitude (0.05).
  - **`poleUp: "south"`** at southern sites (D-6 says "north up").
  - **The bundle row.** Progress 4.7's absolute budget (4,290,555) is exceeded at 4,306,138. The +500 KB intent is met (+424,700) because main grew.
  - **The gzip budget has no test.** `build-stars.mjs:208` points to a size-budget test in `finder-stars.test.ts` that doesn't exist.
  - **Rounded magnitudes.** The starting limit compares magnitudes rounded to 0.1 (`build-stars.mjs:212`), so the effective limit is about 4.549. The PRD invariant still holds, with the naked-eye limits well above.
  - **Close doubles.** 69 pairs share a packed position (within 0.01°): harmless to the hop search, but they may draw as overlapping dots.
  - **Stale comment.** `finder-stars.test.ts:203` says "~680 KB"; the file is 372,338 bytes.
- **Fix**: Add a short "Deviations" addendum to plan.md covering D-2 (encoding, no ids, position match), D-3 (0.1 rounding), D-6 (visible pole up) and 4.7 (restated against the e7b8c49 baseline). Add the gzip size test, or drop the reference to it, and fix the stale comment.
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED. plan.md gains "Deviations recorded after implementation" (D-2 encoding and no ids with the position match, D-3 0.1 rounding, D-6 visible pole up, the 4.7 budget against the e7b8c49 baseline, the 69 shared positions); Progress 4.7 restated; the gzip budget test (< 160,000 bytes) is in `finder-stars.test.ts`; the stale ~680 KB comment now says ~372 KB.

### F6 — Offline edge gaps

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/sw.ts:556 (`mayStoreShell` gate), :316, :414; src/lib/offline/copies.ts:292-295; tests/e2e/finder-offline.spec.ts:103
- **Detail**:
  - **(a) Notice params skip the locked-shell drop.** A finder or Tonight navigation whose URL carries a notice param (`?logged=`, `?error=`, `?milestone=`) fails `mayStoreShell` before the locked-shell check runs, so its locked answer drops nothing. The next plain Tonight page drops the charts.
  - **(b) A missing Date header.** Without one, `answerTime` falls back to the device's clock, which is not the server's. A fast device clock refuses every chart until a later full render; a slow one could let a stale chart in. Cloudflare always sends Date, but whether local workerd does is unverified.
  - **(c) E2E covers one drop path.** Only path (a), a free Tonight island, is covered. The locked shell and locked island paths are unit-tested only.
  - **(d) Assertion order.** `data-from-device` is asserted right after a click, when the old page (also from the device) may still be showing. The next line, `[data-finder-chart]`, is what proves the new page.
- **Fix**:
  - Run the locked-finder check before the `mayStoreShell` gate.
  - Skip setting `freeSince` when the Date header is missing.
  - Assert `[data-finder-chart]` before `data-from-device`.
  - Optionally, add a locked-navigation step to the e2e.
- **Recommended resolution**: apply (a), (b) and (d); (c) is optional.
- **Decision**: APPLIED (a), (b), (c), (d). (a) a locked finder shell is checked before the `mayStoreShell` gate, so a notice param no longer skips the drop; (b) `freeSince` comes from the locked answer's `data-plan-at`, else the Date header, else it is not set (never the device clock; the charts are still dropped); (c) `finder-offline.spec.ts` covers the second purge path (re-grant, chart stored again, demote, open the finder URL online: the locked shell clears it); (d) `[data-finder-chart]` is asserted before `data-from-device`.

### F7 — Pending manual checks, the owner's acceptance, and one e2e drift

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 3.3, 3.4, 4.4-4.6, 5.4, 5.5, 6.3, 6.4, 6.6; tests/e2e/finder-chart.spec.ts:44
- **Detail**:
  - **Pending rows.** Nine rows are still `[ ]`: the phone and red-mode legibility checks, the M31 specimen against a published chart, the offline phone checks, CI on the PR, and **6.6, the owner's acceptance of the `SUPABASE_SECRET_KEY` rule change**.
  - **Manual rows marked done.** 1.5 (spot-checking stars) and 2.3 (reference hops "look like the published routes") are `[x]`. The 2.3 evidence is the reference test, which is reasonable for an agent, but the owner hasn't looked.
  - **E2E drift.** The plan asks `finder-chart.spec.ts` to assert `not-ranked` in the no-darkness window "the way smoke does". It skips the test instead (`test.skip(inNoDarknessWindow(), …)`), so for those three weeks nothing in e2e covers the page.
- **Fix**: Run the manual rows. Put the key-rule change in the PR description for the owner (6.6). Make the e2e assert `data-finder-state="not-ranked"` in the window instead of skipping.
- **Recommended resolution**: apply. **6.6 needs the owner's decision** (accepting the CI key rule change).
- **Decision**: APPLIED (e2e drift; 6.6 accepted by the owner on 2026-10-13, Progress 6.6 ticked, CLAUDE.md records it, the PR description will call it out). `finder-chart.spec.ts` no longer leaves the no-darkness window uncovered: a test that runs only in that window opens `/tonight/finder?object=M13` and expects the chart or the not-ranked state (the e2e site, Madrid, has darkness all year, so smoke's exact not-ranked does not transfer). Remaining manual rows (3.3, 3.4, 4.4-4.6, 5.4, 5.5, 6.4) are the owner's; 6.3 runs on the PR.
