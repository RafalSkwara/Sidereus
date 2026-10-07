<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Phone-first UI pass of the Tonight dashboard

- **Plan**: context/changes/ui-mobile-pass/plan.md
- **Mode**: Deep (one Opus verifier, read-only)
- **Date**: 2026-10-07
- **Verdict**: REVISE
- **Findings**: 1 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | FAIL |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

10/10 paths ✓ (`ui/Tile.astro` is new by design), symbols ✓ (`COMPASS_ROW_PX` 16 + `COMPASS_GAP_PX` 8 ≤ `pb-10`; `card.timesIn` has one caller, `VerdictCard.astro:76`), brief↔plan ✓, Progress↔Phase 30/30 rows ✓.

## Findings

### F1 — The first-screen gate is unreachable as written

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: End-State Alignment
- **Location**: Desired End State; Phase 3 criterion 3.6; Phase 4 change #1; What We're NOT Doing (375×667 note)
- **Detail**: The arithmetic below uses the plan's own numbers.
  - **Fixed inputs:** the TabBar is 65 px with its border (`TabBar.astro:26-28`); the panorama nets +208 px and the silhouette +32 px; the EN go answer "● Clear · 9 h in a row with at most 0% cloud in the dark window" wraps to 2 title lines at 358 px, 3 at 328 px and 3–4 in PL (`en.ts:746`, `pl.ts:670`).
  - **At 390×844 (EN, 2 lines):**
    - the verdict ends at about 347;
    - the slider at about 659;
    - the gear link at about 703;
    - the tile heading at about 747 ✓;
    - **the first target row's bottom at about 795, 16 px under the TabBar (779)**.
  - **At 360×780:** even the heading sits about 60 px under the TabBar (715).
  - **The 375×667 note is wrong.** The tile top lands at about 715–743, not about 600 as the plan says.
  - **Measurement width matters.** The verdict min-height must be measured at the narrowest width, or the skeleton swap jumps. Measured there, it reserves more at 390 too.
  - Every success criterion could pass only by weakening the gate.
- **Fix A ⭐ Recommended**: Cut the phone verdict further and gate on 390×844 only. Below `sm` use `text-verdict-sm` (Go 88 → 60 px), `mt-5` → `mt-3`, and set the headline in `text-title` with the reason in `text-body` on the same flowing line. The gate is the first row above the TabBar at 390×844 (EN). Drop 360×780 and record 375×667 and 360×780 as known limits.
  - Strength: Meets "first tiles on the first screen" at the PRD's 390 width while keeping the panorama untouched.
  - Tradeoff: The word shrinks more than "a bit" on phones (that is the user's call). The reason in body size reads quieter.
  - Confidence: MED — about 40–50 px saved against a 16–44 px shortfall, arithmetic only.
  - Blind spot: PL answers of 3+ lines; the measurement happens in Phase 3.
- **Fix B**: Keep the verdict as decided and gate only the **heading** of "Point here first" above the TabBar at 390×844 (EN). Drop 360×780 and record the limits.
  - Strength: No further UI change; honest about what fits.
  - Tradeoff: The first targets stay just under the fold, so the roadmap's "first tiles" is met only by the tile's heading.
  - Confidence: HIGH — the heading lands at about 747 < 779.
  - Blind spot: PL and 3-line answers may push even the heading under the fold.
- **Decision**: FIXED (Fix A, user 2026-10-07)

### F2 — The skeleton has no gear-row placeholder, and the min-height measurement width is unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 #2 and #4; manual criterion 3.7
- **Detail**:
  - `TonightSkeleton.astro:48` goes straight from the slider to the tiles. The new gear row (44 px, more with pills or a dropdown) pushes the tiles down when the island swaps in, while 3.7 demands no jump.
  - "Re-measure on EN go" names no width. Content grows as the width shrinks, so a min-height measured at 390 jumps at 320, and one measured at 320 wastes space at 390.
- **Fix**:
  - The skeleton reserves a one-line gear row (`min-h-11` bar) with the same spacing.
  - The verdict's phone min-height is measured at 360 px EN go.
  - Criterion 3.7 is scoped to 360 px and up with one site. A taller verdict (narrower than 360, PL, explanations) or multi-site pills may still grow the page after the swap (recorded, accepted).
- **Decision**: FIXED (user: apply all)

### F3 — Unnamed blast radius: landing, auth and the no-view sky share the changed classes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 #2–#3; Phase 3 #2 and #4
- **Detail**:
  - `Welcome.astro:38,45,47,70-84` and `AuthShell.astro:28,31,34,36` copy GearShell's paddings rather than reusing GearShell. They also render `PageHeader` (fluid display) and, for the landing, `TonightSky`, which uses `VERDICT_CONTAINER_CLASS`.
  - Changing only GearShell makes the Topbar jump 8 px between landing/auth and the app on phones.
  - The Phase 3 container `pt` trim also hits the focused-page headers (already trimmed in Phase 1), the no-view setup sky (`TonightContent.astro:143`) and the no-DB sky (`pages/tonight.astro:50`). That contradicts "the setup state renders exactly as today".
- **Fix**:
  - Phase 1 also applies the same phone paddings to `AuthShell.astro` and `Welcome.astro`'s copies.
  - Move the `VERDICT_CONTAINER_CLASS` phone `pt` trim into Phase 1 (it is a shared-sky change).
  - Replace "renders exactly as today" with "same content, phone rhythm".
  - Add the landing and `/auth/signin` to the Phase 1 regression screenshots.
- **Decision**: FIXED (user: apply all)

### F4 — `telescope-selector.spec.ts` breaks on the new Moon line's "·"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 #2 (Moon tile); Phase 3 #5
- **Detail**: `tests/e2e/telescope-selector.spec.ts:93-94` finds the gear link as `main a:not([data-sky-body])` filtered by "·". The new Moon line "9% · Waning crescent · Up …" makes it match two links, which is a strict-mode failure.
- **Fix**: In Phase 2, scope the locator to `a[href="/gear"]` (a locator-only change, same assertion) and list the spec in Phase 2's changes.
- **Decision**: FIXED (user: apply all)

### F5 — The landing screenshot's fixed size must be re-measured, not kept

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 #3
- **Detail**: The spec clips a fixed 1280×1160 (`landing-screenshot.spec.ts:22,87`), and `Welcome.astro:33` hardcodes the same size. After the desktop changes (smaller word, two more info lines, re-measured min-height, gear row) the first tile's rule moves to about 1125–1150, so "size unchanged" crops part of the next tile.
- **Fix**: Re-measure the height so the capture ends on the first tile's rule, and update it in both the spec and `Welcome.astro:33` (CLAUDE.md landing rule).
- **Decision**: FIXED (user: apply all)

### F6 — Small corrections

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phases 2–3
- **Detail**:
  1. `design.astro` has no SessionTimeline specimen, so "remove its specimen" has nothing to remove. `MINI_DOTS` also goes dead with the `mini` branch.
  2. The `design.astro:521-527` tile hover and focus specimens select by depth (`*:*:bg-accent`), so `Tile.astro` must render the `<a>` as its root with no wrapper.
  3. "Mark observed" never returns to `/tonight` (the focused pages pass `from`, `redirect.ts:26-29`), so the dashboard notice is mostly `?skyChecked` or `?error`.
  4. Reuse `tonight.nights.timesIn` ("Times in {zone}", `en.ts:500`) instead of adding a key.
  5. `site-map`, `site-location` and `observation-log-management` are unaffected, so drop them from the spec list.
  6. `GearSelector` has no `data-needs-network`.
  7. The tile line refs are 107/137/150/173/190.
- **Fix**: Edit the plan text accordingly. The mini branch and `MINI_DOTS` are removed outright.
- **Decision**: FIXED (user: apply all)
