---
date: 2026-10-07T19:49:55+02:00
researcher: Claude (Opus 5.5) with three Sonnet research workers
git_commit: cbf77f7
branch: feat/ui-mobile-pass
repository: sidereus
topic: "Phone-first audit of the Tonight dashboard (/10x-ui charges) plus a phone-density sweep of the other views"
tags: [research, ui, mobile, tonight, dashboard, nightfall, 10x-ui]
status: complete
last_updated: 2026-10-07
last_updated_by: Claude (Opus 5.5)
---

# Research: Phone-first audit of the Tonight dashboard

**Date**: 2026-10-07T19:49:55+02:00
**Researcher**: Claude (Opus 5.5), with three read-only Sonnet workers (dashboard density, other views, archived decisions)
**Git Commit**: cbf77f7 (`docs/roadmap-m3`, roadmap PR #130 not yet merged; this branch is cut from it)
**Branch**: feat/ui-mobile-pass
**Repository**: sidereus

## Research Question

The `/10x-ui` two-way audit of the signed-in Tonight dashboard (`/tonight`) at phone width (375 px, with 320 and 390 px checks) and on desktop (1280 px). The output is 3–5 charges, each with file:line and its effect on the user. The audit focuses on phone density. The user says the dashboard and Tonight "feel crowded" (roadmap MS-01). The roadmap S-01 outcome asks for three things: the page leads with its answer, nothing scrolls sideways, and the first screen shows the verdict and its first tiles (also PRD NFR phone first, `context/foundation/prd.md:516-520`). A short sweep of the other views lists the follow-ups.

## Summary

- **The first screen shows the verdict and part of the sky, and no tile.** This was measured on the production preview against local Supabase with the all-clear forecast fixture, after onboarding in Madrid with the default kit, on 2026-10-07 at ~19:45 CEST.
  - The first tile starts at **y = 916 px** at 320, 375 and 390 px, in EN and PL.
  - The usable first screen ends at 603 px (375×667) or 780 px (390×844), because the 64 px TabBar covers the bottom of the viewport.
  - The sky stack alone runs from y = 80 to y = 884, made of four pieces:
    - the verdict container, `min-h-109` (436 px), `sky-band.ts:13`;
    - the panorama strip, `h-52` (208 px), partly under the verdict through `-mt-24`, `sky-band.ts:21,30`;
    - the silhouette, 32 px, `sky-band.ts:18`;
    - the slider row, `h-32` (128 px), `sky-band.ts:34`.
  - The tiles then start under a `pt-8` gap (`TonightContent.astro:166`).
  - The PRD/roadmap "verdict and first tiles on the first screen" criterion therefore fails today.
- **Nothing scrolls sideways.** `scrollWidth` equals `clientWidth` on `/tonight`, `/tonight/targets`, `/tonight/plan`, `/tonight/moon`, `/gear` and `/log` at 320, 375, 390 and 1280 px (EN), and on `/tonight` in PL at 320, 375 and 390 px. The verdict word is fluid (`global.css:551-562`), and the panorama scrolls inside its own `overflow-x-auto` scroller (`TonightSkyView.tsx:339`).
- **There is no missing-token debt in the view.** The `/10x-ui` hardcoded-value scan finds 0 literal colours and 0 arbitrary values in the 12 dashboard files, and `src/styles/no-hardcoded-colors.test.ts` guards it. The density problem lives in the **rhythm**: the type and spacing scale has no phone step. `--text-display` is a fixed 2.5rem (`global.css:527`), `Band` is `py-8` at every width (`Band.astro:30`), and the dashboard's own gaps are fixed (`TonightContent.astro:166,168,182,188`).
- The five charges are:
  1. the sky stack fills the first screen (architecture, with a missing size step);
  2. the verdict text repeats itself (density);
  3. the block order follows feature history, so the selectors, post-save notice and sky check sit far below where they act (architecture);
  4. the tile markup is copied 5× with inverted hierarchy (missing shared component);
  5. the spacing and type scale has no phone step, which affects every view (missing tokens, global).

Contract variant: **existing design system (Nightfall)**. Extend its tokens and components, with no new palette or library.

## Charges

Each charge has an anchor, an effect on the user, a category and a direction for the fix. The plan maps each one to a phase or defers it.

### C1 — The sky stack fills the whole first screen (accidental architecture + missing size step)

- **Evidence:**
  - `src/components/tonight/sky-band.ts:13`: `min-h-109 sm:min-h-111` reserves 436 px for the verdict, sized to the longest EN go-verdict content. With a 54 px "Marginal" word, 100+ px of that is empty sky.
  - `sky-band.ts:21,30`: the 208 px panorama, with 96 px under the verdict.
  - `sky-band.ts:18,34`: the silhouette (32 px) and the slider row (128 px).
  - `TonightContent.astro:166`: `pt-8` before the tiles.
  - Measured: tiles at y = 916 px against a 603 / 780 px fold (evidence: `evidence/en-375x667_tonight-fold.png`, `evidence/en-390x844_tonight-full.png`).
- **Effect on the user:** on a phone the "what do I point at" answer is never on the first screen. The user scrolls about 1.5 screens past sky to reach "Point here first", and the slider's Now button and track sit under the TabBar at 390×844.
- **Constraint (user decisions, keep):**
  - The verdict stays above the panorama, with the slider on the ground (`context/archive/2026-10-05-interactive-sky/plan-brief.md:35`).
  - The user asked for a panorama "about 200 px tall" (`…/plan-brief.md:15,27`).
  - The giant verdict word is a user decision (`context/archive/2026-10-04-tonight-nightfall/plan-brief.md:32-33`).
  - The skeleton must keep matching the island's heights (`sky-band.ts:1-7`, `TonightSkeleton.astro`).
  - Shrinking these on phones only (below `sm`) keeps desktop as approved. How much to shrink is a **UI decision for the user** (see Open Questions).
- **Category:** accidental architecture (the heights were each set by a separate change with desktop-first verification at 390/1280, and none of them budgeted the phone's first screen), plus a missing size step.

### C2 — The verdict says the same thing three ways (density)

- **Evidence:** `src/components/tonight/VerdictCard.astro:63-92`. The parts are:
  - the date line with the dark window and "times in <zone>", which wraps to 2 lines at 375 px and 3 in PL at 320 px (`:66-76`);
  - the giant word "Go" (`:79-81`);
  - the headline "● Clear" (`:82-84`);
  - the reason "— 11 h in a row with at most 0% cloud in the dark window", which starts a new line with a dangling em dash and wraps to 2–3 lines (`:85-88`, copy `en.ts:746-747`);
  - an optional explanation (`:90-91`);
  - the forecast-status line (`:92`).
- The dark window then repeats on the slider legend (`TonightSkyView.tsx:497-503,537-543`) and on the Session plan tile (`SessionTimeline.astro:62`).
- Screenshots: `evidence/pl-320x568_tonight-fold.png` shows 9 lines of text before the compass row.
- **Effect on the user:** about 6–9 lines of text before the sky. The reason line reads as a broken sentence, starting with "— 11 h …". Go/Clear is a verdict plus a synonym, so the eye has no single answer line under the word.
- **Category:** density / hierarchy (no token debt).

### C3 — Block order follows the order features shipped, not what the user acts on (accidental architecture)

- **Evidence:** `src/components/tonight/TonightContent.astro`. The island renders, in order:
  1. the sky;
  2. `OfflineCopy` (`:164`);
  3. the post-save notice (`:167-177`);
  4. the tiles (`:180`);
  5. the sky check (`:183`);
  6. the gear line and the site/telescope selectors (`:185-211`);
  7. the load errors (`:215-216`);
  8. the setup prompts (`:218-245`);
  9. the tonight error (`:247`);
  10. the eyepieces prompt (`:249-253`).
- Each layer came from a different change: nightfall, dashboard, verdict-check, S-05/S-08 selectors, offline.
- **Effect on the user:**
  - After "Mark observed" or a sky-check answer, the confirmation `Notice` renders at y ≈ 916, below the fold, so the save looks like it did nothing.
  - With 2+ sites the site selector, which changes everything above it, is the last block on a ~2100 px page.
  - The sky check, the only question the app asks, sits under five tiles.
  - The gear line ("Home · 150 mm reflector") is at the very bottom (see the full screenshot).
- **Category:** accidental architecture.

### C4 — Tiles are hand-copied 5× and their hierarchy is inverted (missing shared component)

- **Evidence:**
  - `src/components/tonight/TonightTiles.astro:107,136,149,172,189` repeat the `<a class={tile} aria-labelledby><h2 class={heading}>…<ArrowRight/></h2>…</a>` block. The `tile`/`heading` class strings are at `:38-41`.
  - The row class is copied again in `SessionTimeline.astro:54-55` and `TonightSkeleton.astro:17`.
  - Weights inside the tiles:
    - the headings are muted `text-label` (15 px);
    - the Moon's percentage is `text-display` (40 px, extrabold, `:159`), the loudest element under the verdict;
    - the Planets list is `font-display text-title font-bold` (`:180`), so "Jupiter, Saturn, Mars, Uranus and Neptune" wraps to 2 lines at display weight;
    - the 7-night tile is 237 px tall.
- **Effect on the user:**
  - Every tile is the same weight. The Moon's "9%" is shouted while the actionable "Point here first" is not.
  - Measured tile heights at 375 px are 221 + 117 + 177 + 153 + 237 = 905 px, about 1.5 phone screens of tiles.
  - Any phone-compact rule has to be written five times.
- **Category:** missing shared component (a `Tile` / dashboard-row component next to `Band`).

### C5 — The spacing and type scale has no phone step (missing tokens, global)

- **Evidence:**
  - `src/styles/global.css:527-528`: `--text-display` is a fixed 2.5rem/2.75rem, used by `PageHeader`'s h1 (`src/components/ui/PageHeader.astro:18`) and the Moon tile.
  - `src/components/ui/Band.astro:30` and `band.tsx:28`: `py-8` at every width.
  - Gaps that never step down: `GearShell.astro:35,38,47`, `TonightContent.astro:166,168,182,188` and `GearSelector.astro:34,56`, plus `tonight.astro:60` (`mt-10 pt-4` before the attribution).
  - The focused Tonight pages start their content at about y = 360 px, after a header block (`TonightPageSky.astro`) with BackLink, title and a 2-line context line (`evidence/en-375x667_tonight_targets-fold.png`).
- **Effect on the user:** every page spends 30–40% of the first phone screen on chrome and gaps. Fixing only the dashboard by hand would fork its rhythm from `/gear`, `/log` and the focused pages again.
- **Category:** missing tokens (a phone step for the display role and the band rhythm), applied through the shared components so all views benefit. This is the "global tokens" part this change may touch.

### Deferred (not this change)

- **D1 — Focused target cards are 5–6 lines of equal-weight text, and the rest list is a nested scroll region.**
  - Anchors: `ObjectCard.astro:31-38`, `TargetDetails.astro:32-55`, `ObjectRow.astro:56` (a `pl-10` indent), `TargetsPageContent.astro:204` (`max-h-128 overflow-y-auto`, a scroll trap on phones).
  - Why deferred: M-3 S-03/S-04 (finder chart, what to expect) rework these cards, so this follows them or goes to S-02.
- **D2 — A shared list row for gear, log and Targets.** The same `rowLink` pattern is copied in `pages/gear/index.astro:95-98`, `pages/log/index.astro:63-65`, `ObjectRow.astro:28-55` and `TargetsPageContent.astro:226-244`. It is its own `/10x-ui` change per view.
- **D3 — `/log/sky` rows (~220–260 px per night, 6 equal-weight facts, `sky.astro:105-155`) and onboarding's long single form (`OnboardingWizard.tsx`, remove button `top-4 -right-3` at `:759`).** These are separate views and get separate changes.
- **D4 — `NightStrip.astro:31` fixed `w-26` column and `buttonVariants` `whitespace-nowrap` (`button.tsx:21`) on long PL labels.** Not reproduced as overflow at 320 px in this audit. Re-check in S-02.
- **D5 — The sky view's bare `catch { skyView = null }` (`src/lib/tonight/build.ts:1006-1008`) drops the live sky without logging.** This breaks the workspace rule "never hide the evidence". It is not a UI charge, so it needs its own small fix change (log with cause) or a line in F-01. It is noted here because the plan must not add more of these.

## Detailed Findings

### Measured layout (production preview, 2026-10-07)

| Viewport | Page | Doc height | First tile top | Overflow |
| --- | --- | --- | --- | --- |
| 375×667 EN | /tonight | 2082 | 916 | none |
| 390×844 EN | /tonight | 2062 | 916 | none |
| 320×568 EN | /tonight | 2098 | 916 | none |
| 320×568 PL | /tonight | 2198 | 916 | none |
| 1280×900 EN | /tonight | 1982 | 948 | none |
| 375×667 EN | /tonight/targets | 2290 | — | none |
| 375×667 EN | /gear, /log | 988, 667 | — | none |

Other fixed points: the slider input sits at y = 812 on every phone width, and the h1 at y = 103 (sr-only on the dashboard). The capture was made by a temporary Playwright spec (deleted, not committed). It ran with `onboardInMadrid`, cookies `sidereus-lang`, and the viewport sizes above.

### Dashboard block inventory (375 px, from code + measurement)

The stack runs Topbar strip 80 → verdict container 436 → panorama net +208 → silhouette 32 → slider row 128 → `pt-8` 32 → tiles 905 → sky check ~230 (conditional) → gear line 68 → selectors 68–96 each (2+ sites/telescopes) → setup prompts (no-view states) → eyepieces prompt ~85 (no eyepieces) → attribution ~137 → TabBar spacer 64. Anchors are in the worker report summarised in C1–C4 and in `TonightContent.astro:125-253`.

### Edge states (architecture check)

- **Signed out, direct link:** the middleware redirects to `/auth/signin?next=/tonight` (`src/lib/protected-routes.ts:6`, `src/middleware.ts:38-43`). Fine.
- **No site or telescope:** a short title-only `TonightSky` plus setup Bands, with no tiles (`TonightContent.astro:117-119,143-160,218-245`). That is a real empty state, so it is fine and not part of the first-screen problem.
- **Forecast error:** the verdict becomes "No forecast" (`src/lib/tonight/format.ts:136-139`), but `tonightError` renders after the prompts at the bottom (`TonightContent.astro:247`). C3 covers it.
- **Supabase missing:** `DatabaseMissing` under the sky (`tonight.astro:49-56`). Fine.

### Other views (phone sweep, code-read; overflow measured on four of them)

- **Shared chrome:**
  - Topbar `h-16` plus `pt-4` is 80 px (`GearShell.astro:35`). Sub-pages add BackLink plus `PageHeader`.
  - `text-display` titles wrap to 2–3 lines at 320 px in PL.
  - TabBar is sound: a spacer that matches the fixed bar, safe-area padding, 64 px targets (`TabBar.astro:23-28`).
  - The settings popover has no `max-h`/scroll (`TopbarControls.tsx:53-54`, not verified on a short screen).
- **The BackLink + `PageHeader` block** is hand-built in at least 7 pages (`gear/sites/[id].astro:35-40`, `log/{sky,new,[id]}.astro`, `TonightPageSky.astro`, `TonightPageSkeleton.astro`, gear `*/new`). A `back` prop on `PageHeader` would fold them in. Consider it in C5's phase only if it is cheap, else defer to D2.

## Code References

- `src/components/tonight/sky-band.ts:10-34`: the shared heights of the sky band (verdict min-height, strip, overlap, silhouette, slider row).
- `src/components/tonight/VerdictCard.astro:48-92`: verdict size picker and text stack.
- `src/components/tonight/TonightSkyView.tsx:243-244,320-350,458-519`: panorama width, scroller, slider row.
- `src/components/tonight/TonightContent.astro:125-253`: the island's block order.
- `src/components/tonight/TonightTiles.astro:38-41,107-237`: tile classes and the five copies.
- `src/components/tonight/TonightSkeleton.astro:17,27-47`: reserved heights that must follow any change.
- `src/styles/global.css:527-562`: the type roles and fluid verdict sizes.
- `src/components/ui/Band.astro:30,37`, `band.tsx:28`, `PageHeader.astro:16-22`: shared rhythm.
- `src/components/gear/GearShell.astro:27-47`: the shell paddings.

## Architecture Insights

- Heights are shared through `sky-band.ts` precisely so the skeleton and both skies cannot drift. Any phone step has to live there (as responsive class strings plus the px numbers the projection uses, `STRIP_HEIGHT_PX`). It must not go into the components separately.
- `TonightSkyView` projects into `STRIP_HEIGHT_PX + STRIP_OVERLAP_PX`. A responsive strip height means the island needs the phone value at render. Either pick by `matchMedia`/`ResizeObserver` (it already measures width, per the interactive-sky impl-review note about the first paint assuming 390 px), or keep one height and shrink only the overlap/verdict. This is a plan decision.
- The design system is healthy at the token-colour level. The gaps are a missing rhythm step and the missing tile component. A `Tile` (or `DashboardTile`) in `src/components/ui/` with its states in `/design` follows the CLAUDE.md rule "a new shared component gets its states there".

## Historical Context (from prior changes)

- `context/archive/2026-10-04-tonight-dashboard/plan-brief.md:5-40,97`: the user chose "verdict + ruled tiles opening focused pages". The goal was "sky plus four tiles in about two phone screens", and phase 4 "may tighten row padding". That is supported as a goal and was only checked as "noticeably shorter" (`plan.md:588`). The fifth tile (Session plan, `context/archive/2026-10-05-session-plan-timeline/plan-brief.md:24,46`) flagged the dashboard height as a risk.
- `context/archive/2026-10-05-interactive-sky/plan-brief.md:15,27-35`: a panorama of about 200 px, with the verdict above, the panorama below and the slider on the ground. This stays as the desktop layout, and the phone step is the open question.
- `context/archive/2026-10-04-tonight-nightfall/plan-brief.md:32-33`, `plan.md:537-538`: the giant word in tiers sized for a 360 px phone. The min-height matches the skeleton, and it was "unplanned" per its impl-review (`reviews/impl-review.md:131`).
- Every prior UI plan used a 390/1280 matrix. 375 px was never in a plan, and 320 px only in one review fix.
- No committed screenshot assertion exists (`toHaveScreenshot` absent). The `/design` kitchen sink has the Tonight specimens (`src/pages/design.astro`, imports ~29-35, TonightTiles ~522, verdict states ~200-455). The landing capture (`tests/e2e/landing-screenshot.spec.ts`) embeds a desktop Tonight shot and may need recapturing.

## Related Research

- `context/archive/2026-10-04-visual-redesign/research.md` (the Nightfall baseline, deferred views list at `:277-281`, overflow gate `:325`).
- `context/archive/2026-10-04-tonight-dashboard/` (plan-brief, plan).

## Open Questions (user decisions for /10x-plan)

1. **How compact the phone sky gets** (C1). Options: shorter panorama on phones (e.g. ~140 px), a smaller phone verdict tier plus a content-height min, a slimmer slider row. The target is the verdict plus the first tile on a 375×667 screen.
2. **What the verdict block keeps** (C2). Drop the headline word duplicate, shorten the reason, or move the date/zone line into a compact context row.
3. **Dashboard order** (C3). Proposed: notice right under the sky; the sky check above the tiles when open; the gear line and selectors as a compact row near the top (under the sky or in the context line).
4. **Tile hierarchy** (C4). Proposed: "Point here first" leads; the Moon and Planets become one-line summaries; the 7-night bars get shorter on phones.
