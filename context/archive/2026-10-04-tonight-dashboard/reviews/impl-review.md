<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Tonight as a dashboard of focused pages

- **Plan**: context/changes/tonight-dashboard/plan.md
- **Scope**: Full plan (post-merge review of PR #94, commits 0604ff0..cd1790b)
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 6 observations
- **Triage**: 2026-10-05, all 8 fixed on `fix/tonight-dashboard-review` (user chose "fix all, recommended way")

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria evidence (2026-10-05, on main at d74ee2b):

- `npx astro check`: 0 errors.
- `npm run lint`: 0 errors. The 2 warnings are older ones in `determinism.test.ts`.
- `npm test`: 58 files, 617 passed, 6 todo.
- The Phase 4 anchor greps return nothing.
- CI run 37231427784 on the merge commit passed ci, smoke (build plus the full e2e suite), migrate and deploy.
- Manual checks 1.6–5.2 were self-verified with screenshots. 5.3 was approved by the user, who merged #94 and confirmed it on 2026-10-05.

Scope notes:

- The changes outside the plan's file lists are approved gate feedback from p5:
  - `Band.astro` gains `class` and `headingHidden`.
  - `build.ts` gains `planetsAbsentText`.
  - `ObjectCard` gains `data-object`.
  - `MoonCard` gains a `washedOut` link.
  - Targets shows the best 5, then "Show the other N".
- The rest are comment-only updates (`/tonight/all` → `/tonight/targets`) in `ObjectDetails`, `PlanetCard`, `format.ts` and `requested-gear.ts`.

Safety checks that came back clean:

- Every `/tonight/*` path is gated.
- `from` is a fixed enum mapped to fixed paths, so there is no open redirect.
- `/tonight/all` returns a 301 that keeps only a whitelisted `sort`.
- No `set:html` anywhere.
- Ids only in island props, and no coordinates in URLs.
- Every shell has a `DatabaseMissing` path.

## Findings

### F1 — Returning to Targets after a log hides the row and resets the order

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/log/index.ts:39, src/pages/tonight/targets.astro:40
- **Detail**: A save from Targets redirects to `/tonight/targets?logged=<key>` with no `sort`, and `restOpen` is only true when `?sort` is present. Two things go wrong:
  - Logging an object from the "Show the other N" list brings the user back to a closed `<details>`, in rank order. The "logged" notice shows, but their row and its seen tag are hidden.
  - A "by best time" order is lost.
- **Fix A ⭐ Recommended**: When `?logged=` names an object in the rest list, the island opens `#more` and scrolls that row into view. Sort falls back to rank.
  - Strength: The change stays on the Targets page (the shell already passes `notice`; it would also pass the logged id). The log route and form are untouched.
  - Tradeoff: A "by best time" order still resets to rank after a save.
  - Confidence: HIGH — `restOpen` is already a prop, and the scroll-to-target script already opens a `<details>` target.
  - Blind spot: None significant.
- **Fix B**: Also carry `sort` through `logHref` → `log/new` → form → `POST /api/log` → `formRedirect`, on top of Fix A.
  - Strength: The user returns to exactly the view they left.
  - Tradeoff: Touches 5 files and the log schema for a secondary preference.
  - Confidence: MED — the `from` plumbing shows the pattern, but it widens the API surface.
  - Blind spot: Manual-mode log links would need care not to pick up `sort`.
- **Decision**: FIXED (Fix A): the island opens `#more` when the logged object is in the rest list (`data-logged-row`), and the page script scrolls that row into view. Pinned in `tonight-targets.spec.ts`.

### F2 — Focused pages don't explain a missing eyepiece pair

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/TargetsPageContent.astro, src/components/tonight/PlanetsPageContent.astro (prompt only at TonightContent.astro:95,218)
- **Detail**: With an empty eyepiece kit, `ObjectDetails` renders no pair line. The `noEyepiecesPrompt` that used to sit above the lists now shows only on the dashboard. Someone landing on Targets or Planets directly (a bookmark, or the return after a log) sees no advice and no reason why. The plan put the no-eyepieces prompt on the dashboard (a delegated decision), so this is a plan gap rather than drift.
- **Fix**: Render the same one-line prompt (with its `/gear` link) on Targets and Planets when `view && !view.hasEyepieces && !load.eyepiecesError`.
- **Decision**: FIXED: new `EyepiecesPrompt.astro`, shown on Tonight, Targets and Planets. Pinned in `telescope-selector.spec.ts`.

### F3 — Two undocumented deviations from the plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/tonight/TonightTiles.astro:8-9,90,120,143,160; src/components/tonight/TargetsPageContent.astro:138-141
- **Detail**:
  - The plan's tile contract labels every tile with its heading plus "Open …". Only the targets tile carries the suffix: the code comment avoids "The Moon Open The Moon" where the heading matches the page title.
  - The Targets count caption sits under the "Point here first" band, not in `TonightPageSky`, which follows from the approved best-5 layout.
  - Both are reasonable, but the plan doesn't record either.
- **Fix**: Add both as a short "Deviations" note to the plan before archiving.
- **Decision**: FIXED: added the "Deviations" section to plan.md (it also records F8's contract change).

### F4 — Orphaned `tonight.all` copy keys

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/i18n/messages/en.ts:690-695, src/i18n/messages/pl.ts (same keys)
- **Detail**: `tonight.all.title`, `tonight.all.heading` and `tonight.all.back` are no longer referenced in `src`, although the p4 commit says the unused keys were removed.
- **Fix**: Delete the three keys in EN and PL.
- **Decision**: FIXED: removed `tonight.all.{title,heading,back}` from EN and PL.

### F5 — PL "no gear" line says "miejsce obserwacji"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/i18n/messages/pl.ts:744
- **Detail**: Tonight's PL copy calls a site "stanowisko" everywhere else (`addSitePrompt`, `addSite` and 24 other uses). `pages.noGear` is the odd one out.
- **Fix**: "Dodaj stanowisko i teleskop, aby zobaczyć tę stronę."
- **Decision**: FIXED: "Dodaj stanowisko i teleskop, aby zobaczyć tę stronę."

### F6 — The scroll-to-hash script can take over the scroll

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/tonight/targets.astro:72-91
- **Detail**: The observer keeps watching for up to 10 s and scrolls to the target when it appears, even if the user has started scrolling. A malformed hash (`#%E0`) makes `decodeURIComponent` throw. That only kills this script, so it is harmless.
- **Fix**: Disconnect on the first `wheel` / `touchmove` / `keydown`, and wrap the decode in try/catch.
- **Decision**: FIXED: the script stops on the first wheel, touchmove or keydown event and on success; a malformed fragment is caught.

### F7 — Focus ring on the first "other N" row may be clipped

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/TargetsPageContent.astro:186
- **Detail**: This is plausible but not checked visually. The scroll region is `overflow-y-auto` with `px-3` and no vertical padding, so the first row's `outline-offset-2` ring (about 4 px above the row) is likely cut at the top edge.
- **Fix**: Add `py-1` to the region (confirm with a focus screenshot).
- **Decision**: FIXED: `py-1` on the scroll region. A focus screenshot shows the whole ring.

### F8 — The skeleton's links sit inside the busy status region

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/TonightPageSkeleton.astro:29
- **Detail**: `role="status" aria-busy="true"` wraps the real `BackLink` and the reload hint. If the island fails, the fallback stays, and some screen readers skip a region marked busy, which hides the reload link. `TonightSkeleton` already has the same pattern.
- **Fix**: Put `role="status" aria-busy` on the placeholder bars and the sr-only loading text only, leaving the links outside.
- **Decision**: FIXED: `role="status"` moved to the sr-only loading line in both skeletons, with the links outside it.
