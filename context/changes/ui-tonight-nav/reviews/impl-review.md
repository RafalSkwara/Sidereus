<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Tonight sub-nav and Progress as a destination

- **Plan**: context/changes/ui-tonight-nav/plan.md
- **Scope**: Full plan (head 488ae3d, diff base origin/main, merge base 2c4b348)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-15
- **Verdict**: NEEDS ATTENTION (three low-effort warnings; no critical finding, no drift)
- **Findings**: 0 critical, 3 warnings, 5 observations

> Reviewer note: run as herdr agent `reviewer` under the orchestrator's read-only rules. Only this file was written.
> `change.md` was **not** stamped `impl_reviewed`, and no triage was run. The orchestrator or owner does both.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Evidence

**Automated checks, re-run by the reviewer at 488ae3d:**

| Check | Result |
|---|---|
| `npx vitest run` on navigation, subnav, i18n, nav-type-roles and rhythm-roles | 5 files, 165 tests passed |
| `npx astro check` | 0 errors, 0 warnings, 0 hints |
| `npm run lint` | clean |
| `npm test` | 127 files: 2479 passed, 4 skipped, 6 todo |
| `npm run build` | complete; `sw.js` precaches 58 files |

- **Not re-run:** the planted-`text-sm` failure of the guard (3.1). It needs a source edit, which these rules forbid. The regex `\btext-(xs|sm|base|lg|xl)\b` does catch `text-sm` and `sm:text-sm`, and leaves `text-label` alone.
- **E2E not re-run:** no preview server was started, per the orchestrator's rules. The implementer's full run (84 passed, 4 conditional skips) and green smoke at f3b3249 / 488ae3d are taken as given. 488ae3d changes only plan.md.

**Plan drift:** every planned change in Phase 1 §1-6, Phase 2 §1-5 and Phase 3 §1-3 is present and matches its contract (MATCH).
- **Navigation model:** `NAV_ITEMS` order and the Progress entry. `currentDestination` picks the longest match, and `isCurrentPage` stays exported.
- **Bars:** `grid-cols-4` and `text-caption` on the TabBar. `text-label` on the pill, whose icons are `hidden … lg:block` with the hover nudge kept.
- **Log pages:** the Log header's Progress link and its `Award` import are gone, and so is `BackLink` on `/log/progress`. The `log.list.progress` key is removed in both languages. `PROGRESS_PAGE` is still used by `MilestoneCelebration`.
- **Sub-nav list and copy:** `TONIGHT_NAV`, its set test against `TONIGHT_PAGES`, and the `tonight.subnav` copy in EN and PL.
- **Sub-nav component:** `TonightSubNav` has the contract's chip classes, focus ring and `subnav-current` view-transition name. `scrollLeftFor` and `edges` measure with `getBoundingClientRect`, as plan review F3 asked. The fade is an alpha mask, and the view-transition group rules sit in `global.css`.
- **Placement:** GearShell's `subnav` slot is conditional, so the strip is unchanged when the slot is empty. All six pages pass the sub-nav.
- **Back link:** `backHref` is optional with no default in both Sky and Skeleton, using `class:list={[backHref && "mt-1 sm:mt-2"]}`. The rhythm counts are unchanged and their comment is updated (plan review F1).
- **Phase 3:** the `/design` specimens include the 7-state caption and the finder-style `backHref` specimens. The nav type-roles guard exists. The CLAUDE.md layout, Tonight's sky, log and offline lines are updated, and the evidence README exists.

**Scope:** no EXTRA changes. All unplanned files are evidence, scripts, or plan and roadmap bookkeeping.

**Manual checks:**
- **Checked:** 1.5, 2.6 and 3.5 have their shots in `evidence/after/`. The reviewer looked at the 390 px Polish red sub-nav, the 320 px Polish light TabBar and the 768 px Polish dark pill: one bar, nothing clipped, and the current item is a fill.
- **2.5:** re-scoped to the header only (see F7).
- **Pending:** 3.6, the owner's walk.

## Findings

### F1 — Branch conflicts with origin/main in roadmap.md

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/foundation/roadmap.md
- **Detail**:
  - origin/main has moved 8 commits past the merge base 2c4b348, among them the docs-only archive PRs #180 and #181.
  - `git merge-tree --write-tree origin/main HEAD` reports `CONFLICT (content)` in `roadmap.md`. Main flips the neighbouring S-01 and S-04 rows to `done`, and this branch flips S-02 to `in-progress`.
  - Nothing in `src/` or `tests/` overlaps.
- **Fix**: Rebase onto (or merge) origin/main before opening the PR. Keep main's rows and re-apply S-02 `in-progress` in both places it appears.
- **Decision**: APPLIED 2026-10-15 — rebased onto origin/main (4d0bfed); roadmap.md keeps main's S-01/S-04 `done` rows and Done entries, S-02 `in-progress`.

### F2 — Edge fade hides the focus ring of a chip that keyboard focus scrolled to

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/styles/global.css:598-624 (`[data-subnav-row]` masks); src/components/tonight/TonightSubNav.astro:47
- **Detail**:
  - When Tab or Shift+Tab moves focus to a chip outside the visible part of the row, the browser scrolls only until the chip's border box touches the scroll edge.
  - On a phone the row loads centred on Nights. Shift+Tab back to Tonight leaves `scrollLeft` at about 16, so `data-more-start` stays set.
  - The 2rem alpha mask then fades the focused chip's leading edge, and with it the 2 px outline at offset 2. That outline is fully transparent at the very edge. The same happens at the end.
  - This breaks the visible-focus rule the Nightfall UI holds elsewhere.
  - Found by reasoning over the code; not reproduced in a browser.
- **Fix**: Add `scroll-padding-inline: var(--subnav-fade);` to `[data-subnav-row]`, so scrolling a focused chip into view keeps it clear of the fade. A 1-line CSS change; check it at the 3.6 walk.
- **Decision**: APPLIED 2026-10-15 — `scroll-padding-inline: var(--subnav-fade)` on `[data-subnav-row]`. Checked at 390 px (dark, red): Shift+Tab to Tonight scrolls the row to 0 (no start fade) and the ring shows whole (`evidence/after/subnav-focus-edge-start-*-390.jpg`); Tab to Nights reaches the end with no end fade.

### F3 — The six-page sub-nav test runs under the default 30 s timeout

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/e2e/tonight-subnav.spec.ts:33-54
- **Detail**:
  - The test signs up through onboarding, then loads six focused pages and waits for each server island.
  - Comparable multi-page specs (`offline`, `seven-night-planner`, `session-plan-edit`, `observing-progress`, …) raise `test.setTimeout`.
  - CI fails a test that passes only on retry (`failOnFlakyTests`), so a slow runner turns this into a red run.
- **Fix**: Add `test.setTimeout(120_000)` to this test, matching the sibling specs.
- **Decision**: APPLIED 2026-10-15 — `test.setTimeout(120_000)` in the six-page test.

### F4 — The current chip is centred before the web font loads

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/TonightSubNav.astro:73-96
- **Detail**:
  - The script measures once, when the module runs.
  - Archivo is self-hosted with `font-display: swap` and no preload. On a cold cache the chips can change width after the font swap.
  - Later scroll and resize events only re-mark the edges, never re-centre. So the current chip can sit off centre and `data-more-end` can go stale, most visibly for Nights, the last chip.
- **Fix**: Wrap the centring and `markEdges` in a function, and call it again on `document.fonts.ready.then(...)`.
- **Decision**: APPLIED 2026-10-15 — the centring and `markEdges` run on load and again on `document.fonts.ready`.

### F5 — The /tonight/events phone check passes without any centring

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/e2e/tonight-subnav.spec.ts:79-111
- **Detail**:
  - Events is the third chip, so at 390 px it is already inside the row and the viewport before the script runs.
  - The assertion therefore holds whether or not `scrollLeftFor` ran.
  - Only `/tonight/nights` proves the script, through the end clamp.
- **Fix**: For Events, also assert that the chip's centre is within about 2 px of the row's centre.
- **Decision**: APPLIED 2026-10-15 — Events' chip centre within 2 px of the row's centre at 390 px. Deliberate break: with the centring removed it fails (16.9 px off).

### F6 — Two "current page" links on every focused page

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/Topbar.astro:48, src/components/TabBar.astro:36, src/components/tonight/TonightSubNav.astro:43
- **Detail**:
  - On `/tonight/targets` a screen reader now hears "Tonight, current page" in the Topbar or TabBar, and "Targets, current page" in the sub-nav.
  - The bars marking their section with `aria-current="page"` predates this change, but the sub-nav makes the double announcement routine.
  - `/design` adds four landmarks of the same name, each with an `aria-current="page"` that does not match the page (dev only).
- **Fix**: Follow-up change: the bars use `aria-current="page"` only when `pathname === href`, and `aria-current="true"` (section) otherwise. The `/design` specimens leave `aria-current` out when `current` is overridden.
  - Strength: Correct ARIA semantics. One current page per page.
  - Tradeoff: Touches both bars and `navigation.spec.ts`, which asserts `aria-current="page"` on Log at `/log/sky`. The CSS keyed on `aria-current` has to accept both values.
  - Confidence: MED — standard ARIA guidance; the repo has no precedent either way.
  - Blind spot: How VoiceOver and TalkBack actually announce `"true"` inside a nav was not tested.
- **Decision**: FIX NOW (owner, 2026-10-15), APPLIED 2026-10-15 — `ariaCurrentFor` (`navigation.ts`): on Tonight sub-pages the Topbar and TabBar mark Tonight `aria-current="true"`, the sub-nav chip keeps `"page"`, and `/design` specimens carry none. Pinned in `navigation.test.ts` (break check: 4 of 52 red when it always returns `"page"`) and `tonight-subnav.spec.ts` (six pages, the dashboard, the finder). Left: the Targets sort control's own `aria-current="page"` (out of scope, noted in the PR).

### F7 — Criterion 2.5 was re-scoped from the whole page to the header

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/ui-tonight-nav/plan.md:470-476 (Progress 2.5)
- **Detail**:
  - **What the plan asked:** skeleton and real page within 2 px over the whole page, on the six pages and the finder.
  - **What was shown instead:** the header this change touched matches exactly (`header-heights.mjs`). The whole-page deltas match main's: Plan 1051 / 1003 px, finder 129 / −295, events −56 / −76, and so on.
  - So the change introduces no jump. But a 1 000 px skeleton-to-page jump on `/tonight/plan` predates this branch and stays.
  - 2.5 also has no commit SHA, unlike the other steps.
- **Fix**: Record the re-scope as accepted, and open a follow-up issue for the pre-existing whole-page skeleton deltas (Plan above all).
  - Strength: Keeps S-02 within scope and makes a real UX jump visible.
  - Tradeoff: One more backlog item.
  - Confidence: HIGH — the main baseline is in the plan's own note, same seed and same evening.
  - Blind spot: Whether the Plan delta comes from the seeded full-plan fixture rather than a typical account.
- **Decision**: ACCEPTED (owner, 2026-10-15) — 2.5 narrowed to the header; no follow-up issue.

### F8 — Offline, a chip can switch site silently (same as the tiles)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/TonightSubNav.astro:38; src/lib/offline/copies.ts (`lastSiteId` lookup)
- **Detail**:
  - The `/offline` list links to `/tonight/<page>?site=B`. From there a sub-nav chip, a plain path, is served from the worker's last-refreshed site, which may be site A.
  - This is exactly what the tiles and the old back link did, so it is not a regression, and the plan chose plain paths on purpose.
  - But the sub-nav makes jumps between sibling pages far more common.
- **Fix**: Keep the plain paths now. Optionally, carry `?site=` on the chips when the current URL's `site` passes `isGearId`, and do the same on the tiles.
  - Strength: The offline walk stays on one site.
  - Tradeoff: Touches tiles and sub-nav together, plus the offline e2e.
  - Confidence: MED — reasoned from `copies.ts`, not reproduced offline.
  - Blind spot: How often users really open a non-default site's copies offline.
- **Decision**: LEAVE (owner, 2026-10-15) — the chips keep the tiles' plain paths.

### F9 — Cosmetic view-transition edges for the sub-nav chip

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/TonightSubNav.astro:63; src/styles/global.css:459-472
- **Detail**:
  - Going between a focused page and `/tonight` or the finder, `subnav-current` exists on one side only, so its snapshot fades for 250 ms over the other page.
  - Separately, the new page may be captured before the deferred script sets `scrollLeft`. On a phone the chip could then glide to its unscrolled, off-screen spot.
  - Neither is verified in a browser.
- **Fix**: Watch for both during the owner's 3.6 walk. If either shows, give the one-sided groups `animation: none`, or set `scrollLeft` from an inline script before the first paint.
- **Decision**: DEFERRED to the owner's 3.6 walk (in the PR's checklist).
