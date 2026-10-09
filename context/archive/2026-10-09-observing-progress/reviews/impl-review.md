<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Observing progress (M-3 S-05)

- **Plan**: context/changes/observing-progress/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-09
- **Verdict**: NEEDS ATTENTION → triaged 2026-10-09: F1, F2, F4–F8, F10 fixed; F3 measured and closed without the band (no reachable gap), e2e pin kept; F9 accepted
- **Findings**: 0 critical, 3 warnings, 7 observations
- **Reviewers**: plan drift + safety/quality/patterns (Opus agents); automated criteria re-run in the main session (unit 1484 passed, `astro check` 0 errors, lint clean, `test:db` observations 54 passed; PR #149 CI `ci` and `smoke` pass on b7de3e8)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — A failed log read marks every Tonight target "Not seen yet"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/build.ts:770,852,909 with src/lib/tonight/load.ts:87-96,124
- **Detail**: `load()` turns a failed `listSeenEntries` into `{ items: [], error: "tonight.logError" }`, so `buildTonight` gets `log = []` and sets `notSeenYet: true` on every object, planet and the Moon. That sits right beside the `tonight.logFailed` notice ("Could not load your observation log"). Before this change a failed read only hid the seen tags, which is honest. Now the page asserts something false. The paged read makes more requests, so this path is a little more likely than before. No test covers it.
- **Fix**: Pass whether the log is known into `buildTonight` (a `logKnown` flag set from `logError === null`) and set `notSeenYet` to false when the log failed. Add a `build.test.ts` / `load.test.ts` case for a failed log.
- **Decision**: FIXED — `TonightInput.logKnown` (optional, default true; load.ts passes `logError === null`); a failed read sets `notSeenYet` false everywhere; build.test + load.test cases (break-check: red with the flag ignored).

### F2 — The paging loop skips rows under a lower `max_rows` and costs every load an extra round-trip

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/lib/observations/store.ts:253-272
- **Detail**: The loop advances `from += SEEN_PAGE_SIZE` (a fixed 1000), not by the rows received. With a hosted `max_rows` of 500, `range(0,999)` returns 500 rows and the next request starts at 1000, so rows 500-999 are skipped silently. That is the loss plan review F6 meant to rule out, yet the doc comment (`store.ts:249`) claims the opposite. The empty-page stop also means every user with fewer than 1,000 qualifying entries (everyone, realistically) makes 2 sequential requests instead of 1, on every Tonight island and on `/log/progress`. The plan says "Tonight's cost is unchanged" (Performance). Latent today: local and presumably hosted `max_rows` are 1000, and the db test can't see it.
- **Fix A ⭐ Recommended**: Ask for the total on the first page (`select(..., { count: "exact" })`), advance by `data.length`, and stop once `entries.length` reaches the count (or a page is empty, as a guard). Add a unit test with a mocked client that returns short pages.
  - Strength: One request in the normal case, and correct under any `max_rows`.
  - Tradeoff: A `count(*)` over the user's rated ≥ 3 rows on the first request; small, and indexed by `user_id`.
  - Confidence: HIGH — supabase-js supports `count: "exact"` with `range`, and the sky-check store already relies on exact PostgREST semantics.
  - Blind spot: The exact count's cost on a very large log isn't measured.
- **Fix B**: Stop on a short page (`data.length < SEEN_PAGE_SIZE`), advance by `data.length`, and add a test that pins `supabase/config.toml` `max_rows` ≥ `SEEN_PAGE_SIZE`, documenting that hosted must match.
  - Strength: The simplest loop, with no count query.
  - Tradeoff: Correctness rests on a config value the repo can't check for the hosted project.
  - Confidence: MED — it relies on the hosted setting staying at 1000.
  - Blind spot: The hosted `max_rows` was not verified.
- **Decision**: FIXED via Fix A — first page `count: "exact"`, `from` advances by rows received, stop at the count (empty page / null count as guards); `cause` kept; store.test with a fake client capping pages at 500 (break-check: fixed-page advance → 2 tests red); one request for <1000 rows.

### F3 — The hover tooltip can't be reached with the pointer (WCAG 1.4.13 "hoverable")

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: src/styles/global.css:575-580; src/components/tonight/NotSeenTip.astro; NotSeenMark.astro (`size-6`)
- **Detail**: The CSS shows the tooltip while the button or the tooltip is `:hover`. The 24 px button sits in a 28 px `text-title` line, and the tooltip starts at the bottom of the `<h3>`. That leaves a strip of about 2 px where neither is hovered. Moving the pointer from the icon to the tooltip crosses it, the tooltip turns `display:none`, and the pointer lands on the detail line underneath. The Moon's wrapper has the same geometry. The desktop e2e test and the manual check (2.6) only hovered the button, never the tooltip, so 2.6's "hover" evidence is incomplete.
- **Fix**: Bridge the gap: add the heading itself to the `:has()` hover condition (`[data-not-seen-scope]:has(h3:hover [data-not-seen-button], …)`), or give the tooltip a transparent top extension, and add an e2e step that moves from the button onto the tooltip and asserts it stays visible.
  - Strength: Meets 1.4.13 with CSS alone, and the e2e pins it.
  - Tradeoff: Hovering anywhere on the name also opens the tooltip on desktop (arguably helpful).
  - Confidence: MED — the geometry was read from tokens; the exact pixels weren't measured in a browser.
  - Blind spot: Behaviour on the Moon card's wrapper needs its own check.
- **Decision**: FIXED DIFFERENTLY, then reverted after measurement (orchestrator timebox) — the user's fix (transparent `before:` band on the tooltip) was tried and probed in Chromium: in the real layout the tooltip's top edge meets the 24 px button with no gap a pointer can land in (at y=519.7 px `elementFromPoint` is already the tooltip without the band; the review's ~2 px premise does not hold), and the band overlapped the button's lower 8 px, taking pointer events from the icon while open. So the band was removed. Kept: the e2e step that moves the pointer in quarter-pixel steps from the icon onto the tooltip and asserts it stays visible; it passes on the real layout and fails when an 8 px gap is introduced (verified), so it pins WCAG 1.4.13 'hoverable'.

### F4 — Tooltip state can outlive the interaction

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/not-seen-tip.ts:38-45,57-81
- **Detail**: Three cases:
  - Enter or Space on the button sets `data-open`, which stays after Tab moves on. Several tooltips can then be open at once, covering content, until Esc or a pointer press.
  - On a desktop, a second click can't close the tooltip while the pointer still hovers, because the CSS keeps it shown.
  - On a touch device with a keyboard, keyboard focus opens nothing visible (the focus rule sits under `hover: hover`). Screen readers still get `aria-describedby`.
- **Fix**: Clear `data-open` in the `focusout` handler when focus leaves the button for anything other than its tooltip.
- **Decision**: FIXED — `focusout` closes a tooltip when focus moves to anything but its button or tooltip.

### F5 — The init guard lives in the module, not the DOM

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/not-seen-tip.ts:16,33
- **Detail**: The build inlines the script (the `inlinedScripts` map in `dist/server/chunks/entrypoints_*.mjs`), so each inline copy is its own module instance. If a page ever ran two copies (the shell plus an island, or two islands), the listeners would register twice, and one click would toggle `data-open` twice, which does nothing. Latent today, since every page renders it once. `GearCard`'s script guards on the DOM (`dataset.enhanced`).
- **Fix**: Guard on `document.documentElement.dataset.notSeenTip === "ready"` instead of the module-level `started`.
- **Decision**: FIXED — init guards on `html[data-not-seen-tip="ready"]`; module flag removed.

### F6 — `build.test.ts` "false after a rating ≥ 3" can pass vacuously for deep-sky objects

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/tonight/build.test.ts:418-431
- **Detail**: The assertion is wrapped in `if (seen) …`, and the `every(...)` checks pass if the logged object drops out of the ranking or the tile. The planet and Moon cases are strict.
- **Fix**: Assert that the logged object is present first (pick a fixture object that stays ranked), then assert `notSeenYet === false`.
- **Decision**: FIXED — unlimited ranking, asserts the logged object is present, then `notSeenYet === false`.

### F7 — The paged read drops the DB error's cause

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/observations/store.ts:265-267; src/pages/log/progress.astro:28-33
- **Detail**: The store throws `new Error(LOAD_FAILED)` without a `cause`, and the page's `catch {}` keeps only the key. This matches the project pattern (DB text never reaches the user; `/log/sky` does the same), but the workspace rule says "no dropped error causes", and a production failure of the multi-request read leaves no trace.
- **Fix**: Throw `new Error(LOAD_FAILED, { cause: error })` in `listSeenEntries`. It never reaches the user, and it keeps the cause for anything that does log.
- **Decision**: FIXED — `new Error(LOAD_FAILED, { cause: error })`, with a test.

### F8 — Small a11y and pattern gaps on the progress page and the tile

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/progress/ChecklistGrid.astro:48-55; SeenList.astro; src/pages/log/progress.astro:58-66; src/components/tonight/TonightTiles.astro:117-126
- **Detail**:
  - For Caldwell objects, sighted users see "C20" while the chip's `sr-only` text and the SeenList row say only "NGC 7000". Screen-reader users never get the C number, and a chip can't be matched to its row.
  - The empty state puts the whole sentence inside the link, where `/log/sky` uses a `<p>` plus a separate link.
  - The tile link's accessible name repeats "Not seen yet" up to four times.
- **Fix**:
  - Add "C20" to the Caldwell chip's `sr-only` text and the SeenList row.
  - Split the empty state into `<p>` + link like `sky.astro`.
  - Drop the `sr-only` text inside the tile (its name comes from `aria-labelledby` anyway) and keep the legend line.
- **Decision**: FIXED — Caldwell "C n" in chip sr-only text and SeenList rows (`prefix`); empty state `<p>` + separate action link (`progress.toTonight`); tile marks without sr-only text (`srLabel={false}`), legend kept; /design Caldwell SeenList specimen.

### F9 — The skeleton always reserves the legend bar, so the tile shrinks when all three targets are seen

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/TonightSkeleton.astro:78-79; TonightTiles.astro:126
- **Detail**: The plan asked for the bar. But the legend renders only when a row is unseen, so a user who has seen all three tile targets gets about a 28 px shrink when the skeleton swaps, against "the skeleton never jumps". Rare, and it shrinks rather than pushing content down.
- **Fix**: Accept as is and note it in the plan, or reserve the legend's line height in the tile (an empty `aria-hidden` line when all are seen).
- **Decision**: ACCEPTED — recorded in the plan's Implementation Notes (rare shrink when all three tile targets are seen).

### F10 — The plan doesn't record the accepted deviations

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/observing-progress/plan.md (Phase 3 §1 "Data"; Phase 2 §2)
- **Detail**:
  - Phase 3 still reads `listSeenEntries → seenSummaries → observingProgress`, but the code correctly follows the F4 contract (`observingProgress(entries)`).
  - Benign extras are documented only in code and in `evidence/README.md`:
    - the `NotSeenLegend` component;
    - the second state `data-dismissed` and the desktop Esc fix;
    - the `html[data-not-seen-tip]` readiness marker;
    - `open` living on `NotSeenTip`;
    - the extra contrast pin for `primary-strong`.
- **Fix**: Add a short "Implementation notes" addendum to the plan, recording these as accepted deviations, and correct the Phase 3 data line.
- **Decision**: FIXED — plan addendum "Implementation Notes (impl review, 2026-10-09)" and corrected Phase 3 data line; CLAUDE.md paging sentence updated.
