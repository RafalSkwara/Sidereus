<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Phone-first UI pass of the Tonight dashboard

- **Plan**: context/changes/ui-mobile-pass/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4. Phases 2 and 4 are code-complete. Their open rows are the user's manual checks 2.6 and 4.8.
- **Date**: 2026-10-07
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 7 observations
- **Reviewers**: two Opus agents (plan drift; safety, quality and patterns). Automated criteria are taken from the Phase 4 gate run: astro check, eslint, vitest 835, build, `tonight-phone` 3/3, full e2e 37 passed / 1 skipped.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — The first-screen spec depends on which object ranks first

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (test reliability)
- **Location**: tests/e2e/tonight-phone.spec.ts:57-89; src/components/tonight/TonightTiles.astro:110-113
- **Detail**: The margin is 3 px at 390×844. The first target row is `text-title` with `break-words`, and the spec runs on the real clock. A long top name (M13 "Hercules Globular Cluster", which ranks first in Madrid for much of the summer) wraps to 2 lines, adding 28 px, so the assertion fails for part of the year.
- **Fix**: Assert that the first target's **first line** sits above the TabBar (row top + one `text-title` line ≤ TabBar top), and document the one-line assumption in the spec header. "The first target is on screen" stays true whatever the name length, with no truncation the user hasn't decided on.
  - Strength: Deterministic across the year. Keeps the user-visible promise (the target starts on the first screen).
  - Tradeoff: A wrapped second line may sit under the TabBar.
  - Confidence: HIGH. The verdict block's height is fixed by the reserved min-height, so only the name length varies.
  - Blind spot: A 2-line PL verdict answer at 390 px. Measured as 2 lines today, the same as EN.
- **Decision**: FIXED (agent, per the user's "keep going"): the spec measures the first target's first line; header documents why; break-check red at 812 > 779

### F2 — On phones, Tab reaches Now before the slider

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (accessibility, WCAG 2.4.3)
- **Location**: src/components/tonight/sky-band.ts:50-54; src/components/tonight/TonightSkyView.tsx:484-550; src/pages/design.astro "Sky slider and Now button" note
- **Detail**: The DOM order is time · Now · track. Below `sm` the order classes show time · track · Now. The `/design` note says "the slider, then Now", which is wrong for the real DOM.
- **Fix**: Make the DOM follow the phone order (time · track · Now) and rebuild the desktop layout with `sm:order-*`. On desktop, Now then sits on the first line but is reached after the slider, which is a smaller mismatch on the secondary layout. Correct the `/design` note.
  - Strength: The phone, the primary target of this change, gets a matching focus order.
  - Tradeoff: Desktop gets a mild visual/focus mismatch instead.
  - Confidence: MED. The order-class mechanics are already in place.
  - Blind spot: Screen-reader reading order on desktop.
- **Decision**: FIXED: Now moved after the track in the DOM (phone order); desktop keeps its layout through `sm:order-*`; /design note corrected

### F3 — Stale "ESTIMATE" comment on the verdict min-height

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/sky-band.ts:12-18
- **Detail**: The comment says the value is an unverified estimate (242 / 385.6 px), but `verification.md` records it measured: 244 px at 360 and 388 px at 640.
- **Fix**: Replace it with the measured values and their conditions (EN go, all-clear fixture, 2026-10-07).
- **Decision**: FIXED: comment now carries the measured 244/388 px and the re-measure rule

### F4 — `--text-verdict-xl` is now dead

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/styles/global.css:569-571
- **Detail**: Nothing in `src` uses it after the word-size change.
- **Fix**: Remove the token and its comment line, so no unused variant is left behind (the plan's own rule for `mini`).
- **Decision**: FIXED: `--text-verdict-xl` and its comment mentions removed

### F5 — The skeleton repeats the gear-row and tiles spacing strings

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/components/tonight/TonightSkeleton.astro:62-66 vs TonightContent.astro:183-214
- **Detail**: `pt-2 sm:pt-4` and `pt-3 sm:pt-6` are typed out in both files. The "one source for heights" rule is broken for these two values.
- **Fix**: Export both from `sky-band.ts` and use them in both files.
- **Decision**: FIXED: `GEAR_ROW_GAP_CLASS` / `TILES_GAP_CLASS` in sky-band.ts, used by TonightContent and TonightSkeleton

### F6 — The verdict borrows the nights strip's `timesIn` key

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/VerdictCard.astro:79; src/i18n/messages/{en,pl}.ts
- **Detail**: `m.tonight.nights.timesIn` belongs to NightStrip, so a wording change there would silently change the verdict. The two " · " separator keys (`card`, `summary`) and the existing literal " · " joins elsewhere are left as they are.
- **Fix**: Give the card its own `tonight.card.timesIn` ("Times in {zone}" / "Czas w strefie {zone}").
- **Decision**: FIXED: own `tonight.card.timesIn` (EN/PL); duplicate separator keys and pre-existing literal joins left as they are

### F7 — The first-screen gear link has no `data-needs-network`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (offline)
- **Location**: src/components/tonight/TonightContent.astro:188
- **Detail**: `/gear` needs the network (`src/lib/navigation.ts:8`), and the TabBar and Topbar mark it. The gear link, now on the first screen, doesn't, so offline it lands on `/offline`. The gap predates this change.
- **Fix**: Add `data-needs-network` (the layout's hidden "Needs a connection" describes it).
- **Decision**: FIXED: `data-needs-network` on the gear link

### F8 — Duplicate tile ids among the `/design` specimens

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/design.astro:1699-1719
- **Detail**: TonightTiles is rendered 5× on the dev-only page, so the `tile-*-heading` ids and the MoonDisc clip id repeat. This predates the change; the new Tile specimens use unique ids.
- **Fix**: Thread an `idPrefix` through TonightTiles in a later UI change. Dev-only, low impact.
- **Decision**: SKIPPED: dev-only, predates the change; for a later UI change

### F9 — Progress overclaims; the multi-site jump is undocumented

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 4.5 and 3.8; CLAUDE.md "Phone first"
- **Detail**:
  - 4.5 says "reviewed by the user", but the user has not reviewed the matrix yet.
  - 3.8 covers marginal and no-go by construction, not by render.
  - With 2+ sites the skeleton→island swap still jumps, and the first target falls under the fold at 390×844. Both are accepted, but CLAUDE.md doesn't say so.
- **Fix**:
  - Untick 4.5 until the user reviews.
  - Keep 3.8 with its recorded reasoning.
  - Add the multi-site caveat to the CLAUDE.md phone-first bullet.
- **Decision**: FIXED: 4.5 unticked until the user reviews; 3.8 kept with its recorded reasoning; multi-site caveat added to CLAUDE.md
