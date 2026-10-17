# Quick navigation to Tonight's pages (ui-quick-nav) — Plan Brief

> Full plan: `context/changes/ui-quick-nav/plan.md`
> Research: `context/changes/ui-quick-nav/research.md`
> Roadmap M-4 S-10 · issue #214 · **starts only after PR #212 merges and the branch is rebased**

## What & Why

The owner wants Tonight's seven pages (the dashboard, Targets, Events, Plan, Moon, Planets, Nights) reachable from
every screen through one icon button in the Topbar's right-hand cluster. Today, from `/log`, `/gear` or
`/log/progress`, the Session plan is the Tonight tab plus a scroll to its tile; the sub-nav exists only on the six
focused pages.

## Starting Point

The Topbar is one `h-16` row: logo, the four destinations as a pill from `md`, and `TopbarControls` (theme button and
a native-popover settings panel). #212 (open) extracts `ui/segmented.tsx`, adds `--topbar-strip-height` and a second
popover (the sky-mode menu). Measured: at 320 px in Polish the row has 36 px to spare, the button needs 52 px; at
768 px the pill would wrap two Polish labels; neither is caught by today's specs.

## Desired End State

Signed in, on every page but `/onboarding`, a grid-icon button "Tonight's pages" / "Strony nocy" left of the theme
button opens a bottom sheet on phones (a panel under the bar from `sm`) with seven 44 px rows, the current page
filled and marked `aria-current="page"`. It works with the keyboard alone (focus into the list, arrows, Esc back to
the button), in dark, light and red, EN and PL, and fits 320 px with its gutter.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Semantics | Disclosure navigation: `nav` "Quick navigation" > button `aria-expanded` > popover list of links | APG's pattern for navigation in a pop-up; keeps link semantics and `aria-current` | Research |
| Current page | `aria-current="page"` on the menu's current row; the bars keep F6 | The owner's requirement; F6's page-wide single mark gets one exception, specs re-scoped | Plan (owner req.) |
| Build | `QuickNav.astro` + small script, native `popover="auto"` | Server-rendered labels and marks, works before hydration, no React | Research |
| Shared contract | `ui/topbar-popover.ts` (icon button, panel, handle) + `topbar-panel-top` from #212's strip token + `--breakpoint-xs` | A second Topbar popover must not copy the first by hand; no arbitrary values | Research (C2, C3) |
| Icon | `LayoutGrid` | Not a second moon beside the theme button | Owner Q1 ⭐ |
| Rows | Icon + name, no descriptions | Scannable, fits 568 px, no new copy | Owner Q2 ⭐ |
| Where | Every signed-in page incl. Tonight pages; hidden signed out and on onboarding | Stable place; `/tonight*` is gated; no room at 320 px signed out | Owner Q3, Q4 ⭐ |
| Order | [Tonight's pages][theme][settings] | Settings keeps the edge | Owner Q5 ⭐ |
| Panel | Sheet below `sm`, panel from `sm`, like settings | Thumb reach, one look | Owner Q6 ⭐ |
| 320 px | Wordmark at `text-label` below 360 px while the button shows (19 px left) | Keeps all 44 px controls and the signed-in theme button | Owner Q7 ⭐ |
| 768 px | Pill `whitespace-nowrap`, `md:px-3 lg:px-3.5` | No wrapped labels, ~6 px left | Plan |
| Offline | Plain paths, no `data-needs-network` | Same rule as the sub-nav; stored copy or `/offline` | Research |

## Scope

**In scope:** the button and panel, the shared popover module and two tokens, the Topbar budget fixes, one landmark
label (EN+PL), the e2e journey and fit checks, `/design` specimens, the screenshot gate, the `CLAUDE.md` rule.

**Out of scope:** TabBar, pill destinations, sub-nav and tiles unchanged; no finder entry; no `role="menu"`; no
offline marking of unstored pages; no descriptions; no settings-panel type-role pass; no roadmap edit; no pixel
baselines.

## Architecture / Approach

`Topbar.astro` renders `QuickNav.astro` (when `appNavVisible(signedIn, pathname)`, the TabBar's rule moved to
`navigation.ts`) before the `TopbarControls` island in one `gap-2` row. `QuickNav` maps `TONIGHT_NAV` to rows, marks
`currentTonightPage(pathname)`, and its script syncs `aria-expanded`, copies the page theme on `beforetoggle`, moves
focus on open, handles arrows and closes on focus leaving. Both panels share `TOPBAR_PANEL_CLASS`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Rebase on #212 and the shared Topbar popover contract | `ui/topbar-popover.ts`, `--breakpoint-xs`, `topbar-panel-top`; settings panel unchanged | #212's names change before merge |
| 2. The quick nav in the Topbar | Failing e2e first, then `QuickNav.astro`, budget fixes, re-scoped specs | 19 px (320) and ~6 px (768) of slack |
| 3. States, the visual gate and the rule | `/design` 7-state matrix, `evidence/impl/` screenshots, `CLAUDE.md` rule | Screenshots drift from the mockups |

**Prerequisites:** #212 merged; branch rebased; `npm ci`; local Supabase and the forecast fixture for e2e.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- #212 overlap in `TopbarControls.tsx`, `global.css` and `Topbar.astro`; the plan assumes its names as of f6b8c97.
- The 320 px and 768 px margins are small; any later Topbar control needs a new measurement.
- The F6 exception (menu's own `aria-current`) should be confirmed in plan review.
- Seven owner questions (Polish, ⭐ defaults) in the plan; a different answer changes D4-D8 only.

## Success Criteria (Summary)

- From `/log`, keyboard only, the Moon page opens in a few keystrokes, and the menu marks it as current next time.
- The 320 px Polish row keeps a 16 px gutter; no pill label wraps at 768 px; the phone first-screen pin stays green.
- Every state is on `/design` in three themes, and `CLAUDE.md` tells the next agent where the contract lives.
