---
date: 2026-10-15T20:30:00+02:00
researcher: Claude (herdr agent "tonight-nav", Opus)
git_commit: 2c4b348
branch: feat/ui-tonight-nav
repository: sidereus (worktree ui-tonight-nav)
topic: "/10x-ui audit of the navigation: the Tonight sub-nav (4A) and Progress as the fourth destination (4B)"
tags: [research, ui, navigation, tonight, tabbar, topbar, progress, skeleton]
status: complete
last_updated: 2026-10-15
last_updated_by: Claude (herdr agent "tonight-nav", Opus)
---

# Research: Tonight sub-nav and Progress as a destination (ui-refine split, change 4)

**Git Commit**: 2c4b348 (main, #177 and #179 merged; archive PRs #180 / #181 not merged yet)
**Branch**: feat/ui-tonight-nav

## Research Question

The /10x-ui audit of the shared navigation for roadmap M-4 S-02 (#170): the focused Tonight pages' way between
siblings (4A, the sub-nav that replaces the back link) and Progress as the fourth destination in the TabBar and the
Topbar pill (4B), plus finding 12 (raw type sizes in the nav). Source: `context/changes/ui-refine/audit.md`
findings 6, 7, 12 and owner decision 4 ("4A plus 4B"); Experiment A (`ui-refine/evidence/exp-a/experiment-a.diff`,
`targets-phone-en-dark-fold.jpg`). Design system variant: **existing** (Nightfall; tokens in
`src/styles/global.css`, components in `src/components/ui/`).

## Summary

The hardcoded-value scan over the nine nav files (`Topbar.astro`, `TabBar.astro`, `NavIcon.astro`,
`TonightPageSky.astro`, `TonightPageSkeleton.astro`, `ui/BackLink.astro`, `lib/navigation.ts`,
`pages/log/index.astro`, `pages/log/progress.astro`) finds **0** literal colours, palette classes or arbitrary
values. The nav is token-clean. What is missing is structure: no sibling navigation between the seven Tonight pages,
Progress reachable only from the Log header, and a current-page rule that cannot tell Log from Progress.

Five charges (C1-C5), each with a measured or read constraint. The plan addresses all five; nothing is deferred.

## Charges

### C1. The focused Tonight pages have no sibling navigation (accidental architecture)

- **Evidence**: `src/components/tonight/TonightPageSky.astro:33` and `TonightPageSkeleton.astro:76` render one
  `BackLink` to `/tonight` as the only way off a focused page. Six focused pages share it
  (`src/pages/tonight/{targets,plan,moon,planets,nights,events}.astro`); `/tonight/finder` passes its own
  `backHref` / `backLabel` (`src/lib/finder/from.ts:15-28`).
- **Effect on the user**: Targets → Session plan is back, scroll, tile: two taps, a scroll and two island loads, at
  the telescope, with gloves, in red mode.
- **Constraint found**: the sky band is rendered **twice**, by the skeleton and then by the island
  (`server:defer`), and the swap replaces it. A sub-nav inside `TonightPageSky` / `TonightPageSkeleton` (as
  Experiment A did) would (a) be duplicated in two components that must stay in pixel parity and (b) lose its
  horizontal scroll position on the swap: on a phone the sub-nav scrolls (C2), so a user who has scrolled it while
  the island loads sees it jump back. The shell has a better home: `GearShell`'s `skyFlow` branch
  (`src/components/gear/GearShell.astro:34-39`) already draws a `night-sky bg-zenith` strip around the Topbar,
  outside `<main>` and outside the island. A sub-nav there is rendered once by the server, never swapped, needs no
  island data (its labels and links are static) and sits in the night-sky scope (navy in light, red-safe).
  The dashboard `/tonight` uses the same shell but passes no sub-nav, so `tonight-phone.spec.ts`'s first screen is
  untouched.
- **Links**: the dashboard's tiles link plain paths (`TonightTiles.astro:127-197`, `EventsTile.astro:33`), and the
  site and telescope live in cookies (`src/lib/tonight/requested-gear.ts`). The sub-nav links the same plain paths;
  offline, a plain path is served from the stored copy of the remembered site exactly as a tile's is. A
  `?night=next` copy's sub-nav leads to tonight's copies, as its tiles already do.
- **Order**: `TONIGHT_PAGES` (`src/lib/offline/copies.ts:15-23`) is the offline list's order, with Events last
  because `listCopies` orders by it and it was appended (S-07). The dashboard's tile order is Targets, **Events**,
  Session plan, Moon, Planets, Nights (`TonightTiles.astro`, Events second since S-07). The sub-nav should follow
  what the user sees on the dashboard, so its order is its own list; a unit test keeps it the same **set** as
  `TONIGHT_PAGES` (the audit's "shared with TONIGHT_PAGES", kept as a set, not an order).

### C2. The sub-nav must scroll on a phone, and its current page can start off-screen (missing shared component)

- **Evidence** (label widths measured in Chromium with the repo's Archivo files, `text-label` 15 px, weight 600):
  short labels EN Tonight 49.5, Targets 47.8, Plan 29.2, Moon 37.5, Planets 46.7, Nights 41.7, Events 43.3 px;
  PL Dziś w nocy 75.8, Cele 28.3, Plan 29.2, Księżyc 49.2, Planety 48.3, Noce 31.7, Zjawiska 59.2 px. With 12 px
  padding a side and a 4 px gap, the row is about 490 px (EN) / 520 px (PL), against 358 px of content at 390 px.
  The page titles as labels (Session plan 78.8, Sky events 67.9, "Next 7 nights", "Zjawiska na niebie" 120.9) would
  make it about 620 / 700 px. It scrolls on every phone and fits from `sm` (608 px of content) only with short labels.
- **Effect on the user**: on Events (the last chip) or Nights the selected chip starts outside the row, so the page
  does not say where you are; Experiment A's screenshot cuts "The Moon" at the edge with no cue that more follows
  (audit 4A: "a fade or chevron is still to design").
- **Fix shape**: one shared `TonightSubNav.astro` with short labels (new `tonight.subnav.*` keys), the current chip
  `bg-selected text-selected-foreground` like the Topbar pill (and `aria-current="page"`), a 44 px target, a
  hidden scrollbar (`scrollbar-hidden`, already used by the panorama strip), the current chip scrolled into view on
  load by setting the row's `scrollLeft` (never `scrollIntoView`, which can scroll the page), and an edge fade
  (`mask-image`, alpha only, no colour) on the side that has more chips, toggled by the same small script. Its
  states go to `/design`.

### C3. Progress is two levels deep, behind a header link (accidental architecture)

- **Evidence**: `src/lib/navigation.ts:5-9` lists three destinations; `/log/progress` is reached from the Log
  header's `quiet` "Progress" link (`src/pages/log/index.astro:69-72`) and from the milestone celebration's "See
  your progress" (`MilestoneCelebration.astro`). `/log/progress` opens with a `BackLink` to Log
  (`src/pages/log/progress.astro:61`).
- **Effect on the user**: the app's motivational view is hidden under the log; a celebration points at a page the
  nav does not know.
- **Measured fit** (same method, `text-caption` 12 px, weight 600): the TabBar's `max-w-md grid` gives each of four
  tabs 80 px at 320 px; the longest Polish label, "Mój sprzęt", is 55.6 px, "Dziś w nocy" 60.7 px. Four tabs fit at
  320 px in Polish (the roadmap unknown is answered: yes).
- **URL**: keeping `/log/progress` avoids moving a URL the celebration, `src/lib/observations/redirect.ts`, smoke and
  three e2e specs use, and Progress is about the log's entries. The cost is C4.

### C4. The current-page rule would mark Log and Progress both current (accidental architecture)

- **Evidence**: `isCurrentPage` (`src/lib/navigation.ts:13-15`) matches a destination and everything below it, and
  `Topbar.astro:16` / `TabBar.astro:16` call it per item. With Progress at `/log/progress`, both "Log" and
  "Progress" would carry `aria-current="page"` there, and the view-transition names `nav-current` / `tab-current`
  would be duplicated (a duplicate `view-transition-name` aborts the transition).
- **Fix shape**: one `currentDestination(pathname)` that returns the **longest** matching href (or `null`), used by
  both bars; unit-tested (`/log/progress` → Progress, `/log/sky` and `/log/new` → Log, `/login` → none,
  `/tonight/targets` → Tonight).

### C5. Raw type sizes in the nav, and the md pill has no room for a fourth item (missing tokens)

- **Evidence**: `Topbar.astro:49` `text-sm` (14 px) on the pill's segments, `TabBar.astro:37` `text-xs` (12 px) on
  the tabs: the only type sizes off the roles in the nav (audit finding 12). `TopbarControls.tsx:38,47,219,222,309,322`
  also use `text-sm` / `text-xs` inside the settings popover.
- **Measured fit at `md` (768 px; GearShell's Topbar container is `max-w-5xl px-8`, so 704 px)**: logo ≈ 112 px
  (22 px mark, 10 px gap, "Sidereus" 80 px), gaps 16 + 12 px, the controls 100 px (two 44 px buttons and a 12 px gap),
  the pill = 4 × (28 px padding + 16 px icon + 6 px gap + label) + 6 px. Polish at `text-label`: 75.8 + 57.5 + 50.0 +
  69.6 = 253 px of labels → pill ≈ 459 px → row ≈ **699 of 704 px** (5 px to spare, under font rounding risk).
  At today's `text-sm`: ≈ 680 px. English at `text-label`: ≈ 638 px.
- **Effect on the user**: moving the pill onto `text-label` with a fourth item puts the Polish top bar at the edge
  of overflow between `md` and `lg`.
- **Fix shape**: the pill on `text-label` and the tabs on `text-caption` (the roles), with the pill's icons shown
  only from `lg` (−88 px at `md`, ≈ 611 px in Polish); from `lg` (1024 px, 960 px of row) everything fits with
  icons. The settings popover's sizes belong to TopbarControls, which this change does not otherwise touch; they
  stay (noted, not a nav-row charge).

## What the plan must keep

- **The dashboard's first screen**: `/tonight` gets no sub-nav; `tests/e2e/tonight-phone.spec.ts` stays green
  unchanged (its sideways-scroll check over the focused pages and `/log/progress` also covers the new row: the
  sub-nav scrolls inside itself, never the page).
- **Skeleton parity**: the back link leaves `TonightPageSky` and `TonightPageSkeleton` together (both still take
  `backHref` / `backLabel` for the finder, which keeps its back link to its origin and gets no sub-nav).
- **Offline**: `TONIGHT_PAGES` is unchanged (no new page); the sub-nav is part of each stored shell. Progress is
  `needsNetwork: true` like Log (the log pages are network-only).
- **Red mode**: the current chip uses `bg-selected` like the pill (red has no hue, so the fill carries it); the fade
  is an alpha mask, no colour.
- **E2E that use the old back link**: `tests/e2e/tonight-dashboard.spec.ts:90` (clicks the `main` link named
  Tonight) and `tests/e2e/sky-events.spec.ts:58` (`main a[href="/tonight"]`); `observing-progress.spec.ts:217`
  clicks the Log header's Progress link.
- **/design**: `TonightPageSky` specimens (`design.astro:3106-3125`) lose the back link; the sub-nav and the
  four-item bars need specimens (default, hover, focus-visible, current; disabled = offline for Log, Progress, Gear).

## Code references

- `src/lib/navigation.ts:5-15` — `NAV_ITEMS`, `isCurrentPage`.
- `src/components/Topbar.astro:16,46-75` — the pill. `src/components/TabBar.astro:16,30-68` — the tabs (`grid-cols-3`).
- `src/components/NavIcon.astro` — three hand-drawn glyphs; Progress needs a fourth.
- `src/components/gear/GearShell.astro:34-39` — the skyFlow strip.
- `src/components/tonight/TonightPageSky.astro:33`, `TonightPageSkeleton.astro:76` — the back link.
- `src/lib/finder/from.ts:15-28` — the finder's origin.
- `src/lib/offline/copies.ts:15-23` — `TONIGHT_PAGES`.
- `src/pages/log/index.astro:69-72`, `src/pages/log/progress.astro:61` — Progress links.
- `src/i18n/messages/en.ts:38-47`, `pl.ts:26-35` — `nav.*`.

Measurement script: `evidence/measure-nav-labels.mjs` (Chromium + the repo's Archivo woff2 files).
