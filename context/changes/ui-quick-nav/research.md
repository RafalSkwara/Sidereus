---
date: 2026-10-17T15:53:24+02:00
researcher: Claude (ui-quick-nav subagent)
git_commit: e563fda42ea13fca93cacc3aed6cd8c0367fe003
branch: feat/ui-quick-nav
repository: RafalSkwara/Sidereus
topic: "ui-quick-nav: a Topbar icon button that opens Tonight's pages from every screen (/10x-ui audit of the Topbar)"
tags: [research, ui, topbar, navigation, popover, a11y, offline, 10x-ui]
status: complete
last_updated: 2026-10-17
last_updated_by: Claude (ui-quick-nav subagent)
---

# Research: quick navigation to Tonight's pages from the Topbar

**Date**: 2026-10-17T15:53:24+02:00
**Researcher**: Claude (ui-quick-nav subagent)
**Git Commit**: e563fda (origin/main); PR #212 read at f6b8c97 (`origin/feat/ui-sky-modes`, open, not merged)
**Branch**: feat/ui-quick-nav
**Repository**: RafalSkwara/Sidereus

## Research Question

The `/10x-ui` audit brief for the view **Topbar** (roadmap M-4 S-10, issue #214): where one new icon button fits in
the Topbar's right-hand cluster at 320 px and 768 px in Polish; which popover pattern to reuse (TopbarControls'
settings panel, #212's sky-mode menu); what the `aria-current` and landmark contract must be next to the F6 rule and
the existing specs; how the `TONIGHT_NAV` links behave offline; what signed-out and onboarding visitors see. Output:
3-5 charges with file, line and user impact.

## Summary

- **The button does not fit the 320 px Polish Topbar as it is.** Measured on a dev-server mockup (port 4345,
  Archivo loaded, `evidence/budget-320-pl-dark.png`): signed in at 320 px the row has **36 px** between the wordmark
  and the controls (12 px header gap excluded). One more 44 px button plus its 8 px gap needs 52 px, so the settings
  button ends at x = 320, flush with the screen edge (header `scrollWidth` 304 > `clientWidth` 288). The document does
  not scroll sideways (the overflow lands in the page's 16 px padding), so `tonight-phone.spec.ts`'s document-level
  check would **not** catch it. Shrinking the wordmark to the `text-label` role below 360 px leaves **19 px**; hiding
  it leaves 106 px; tighter gaps leave 0 px. At 360 px the full wordmark fits with 24 px to spare.
- **At 768 px in Polish the pill would wrap.** With the extra button the pill shrinks from 394 px to 384 px and two
  segments ("Dziś w nocy", "Mój sprzęt") break onto two lines inside their 44 px height
  (`evidence/order-768-pl-dark.png`); `navigation.spec.ts:71-100` checks only the row's `scrollWidth`, so it would
  stay green. 10 px must come back: `whitespace-nowrap` plus `px-3` instead of `px-3.5` between `md` and `lg` frees
  16 px. At 1024 px there is room (no wrap measured).
- **Signed out it overflows at 320 px**: the row already carries the sign-in link (the theme button is hidden below
  `sm` for this reason, `TopbarControls.tsx:183-185`); a quick-nav button would push the document to 353 px. Every
  `/tonight*` path is gated (`src/lib/protected-routes.ts`), so signed out the menu could only lead to sign-in.
- **Popover reuse**: TopbarControls' settings panel is a native `popover="auto"` (opens before hydration, Esc and
  outside tap close it, focus returns to the button; `TopbarControls.tsx:51-61,192-213`): a bottom sheet below `sm`,
  a panel under the bar from `sm` (`sm:top-23 sm:right-topbar-edge sm:w-80`). #212 adds a second native popover, the
  sky-mode menu, anchored under its trigger (`sky-mode-control.tsx` on #212). The panel classes live inline in each
  island; nothing shared names them.
- **`aria-current`**: the page-wide rule "one `aria-current="page"` per page" (ui-tonight-nav impl review F6, owner
  2026-10-15) is pinned by `tests/e2e/tonight-subnav.spec.ts:88-93` and `:125`. A menu that marks its current page
  `page` (the owner's 2026-10-17 requirement) adds a second mark on the six focused pages and the dashboard; the
  assertion has to be narrowed to exclude the menu, a requirement change, not a test fix. Two specs locate the pill as
  `header nav` (`navigation.spec.ts:16-19`, `tonight-subnav.spec.ts:23`), which a second `<nav>` in the header breaks.
- **Offline**: `TONIGHT_NAV` links are plain paths; the worker treats a bare Tonight path as the remembered site's
  page (`src/lib/offline/copies.ts:150-162`) and serves a stored copy when the user opened that page online before,
  otherwise `/offline`, which lists what is stored. The sub-nav and the Tonight tab already work this way and carry no
  `data-needs-network` (`navigation.ts:6-11`, `TonightSubNav.astro:12-13`).

## Charges

| # | Category | Evidence (file:line) | Effect on the user | Plan |
| - | -------- | -------------------- | ------------------ | ---- |
| C1 | Accidental architecture | `src/components/gear/GearShell.astro:43-47` renders the sub-nav only in the `skyFlow` strip of the six focused pages; `src/lib/navigation.ts:56-74` (`TONIGHT_NAV`) has no other consumer; `Topbar.astro:44-92` offers only the four destinations | On `/log`, `/log/new`, `/gear` or `/log/progress` (at the eyepiece, mid-entry) reaching the Session plan or the Moon takes two taps and a scroll (Tonight tab, then the tile); the owner wants one button from every screen | Phase 2: `QuickNav.astro` in the Topbar's cluster |
| C2 | Missing shared component | `src/components/TopbarControls.tsx:28-35` (`iconButton`), `:55-61` (`panelClass`), `:206-213` (the panel); #212 `src/components/tonight/sky-mode-control.tsx` (`SKY_MODE_MENU_SURFACE_CLASS`, own positioning); the focus-ring string is repeated in `Topbar.astro:25`, `TopbarControls.tsx:29`, `TonightSubNav.astro:41` (#212 exports it as `SEGMENT_FOCUS_CLASS`) | A third Topbar popover copied by hand would drift from the settings panel (border, sheet handle, safe area, top offset), so two buttons side by side would open panels that look and close differently | Phase 1: `src/components/ui/topbar-popover.ts` (icon button + panel classes), read by TopbarControls and QuickNav |
| C3 | Missing tokens | `TopbarControls.tsx:59` `sm:top-23` (92 px) restates the strip height that #212 names `--topbar-strip-height` (5.5 rem from `sm`, `global.css` on #212) plus 4 px; no breakpoint below `sm` exists (`global.css` has no `--breakpoint-*` token), so a 320 px rule could only be written as an arbitrary `max-[360px]:` | If the strip height changes, the settings panel (and a copy of it) opens over or below the bar; a 320 px fix written as an arbitrary value breaks the "no arbitrary values" rule | Phase 1: `topbar-panel-top` utility from `--topbar-strip-height`; `--breakpoint-xs: 22.5rem` |
| C4 | Accidental architecture (layout budget) | `Topbar.astro:33,36,41,44` (header `gap-3`, wordmark `text-title`, cluster `gap-1 sm:gap-3`); `TopbarControls.tsx:178` (`gap-2`); `Topbar.astro:53` (pill segments `px-3.5`, no `whitespace-nowrap`); `tests/e2e/tonight-phone.spec.ts:131-157` checks only the document's `scrollWidth`; `navigation.spec.ts:71-100` only the header's | At 320 px (PL, signed in) the settings button would touch the screen edge with no gutter; at 768 px (PL) "Dziś w nocy" and "Mój sprzęt" would wrap inside the pill. Neither is caught by today's specs | Phase 2: wordmark `max-xs:text-label` when the quick nav renders; pill `whitespace-nowrap md:px-3 lg:px-3.5`; header-level fit checks at 320 and 768 px |
| C5 | Accidental architecture (a11y contract) | `tests/e2e/tonight-subnav.spec.ts:23,36-41,88-93,125` (bars located as `header nav`, page-wide single `aria-current="page"`); `navigation.spec.ts:16-19`; `navigation.ts:39-49` (`ariaCurrentFor`, F6) | A screen-reader user needs the menu's current page announced (owner 2026-10-17) without a second landmark named "Tonight's pages" next to the sub-nav, and without the bars' section mark becoming ambiguous | Phase 2: disclosure navigation (landmark `nav.quickNav`), `aria-current="page"` on the menu's current link, specs re-scoped with a recorded requirement change |

**Deferred**: raw type sizes in the settings panel (`TopbarControls.tsx:38,47,219,222,309,322`: `text-sm` / `text-xs`
instead of the type roles; `segmented.tsx` on #212 keeps `text-sm` too). Not needed for the quick nav, which uses
`text-label` / `text-caption` only; converting them changes the settings panel's look and belongs to a settings pass,
not this change.

## Detailed Findings

### Pre-audit (source → views and view → source)

- Hardcoded-value scan (the `/10x-ui` grep) on `Topbar.astro`, `TopbarControls.tsx`, `TabBar.astro`,
  `TonightSubNav.astro`, `NavIcon.astro`: **0 hits** (no hex, `rgb()`, palette class or arbitrary `-[Npx]`). Variant:
  existing design system (Nightfall tokens in `src/styles/global.css`, components in `src/components/ui/`); the
  contract is extended, not introduced.
- Raw Tailwind sizes outside the type roles: 6 in `TopbarControls.tsx` (lines 38, 47, 219, 222, 309, 322) and 1 in
  #212's `segmented.tsx` (line 20): deferred above.
- Tokens the new control needs already exist and are already paired in the sub-nav chips and the pill:
  `bg-selected`/`text-selected-foreground`, `hover:bg-accent`, `text-muted-foreground`, `text-heading`, `bg-surface`,
  `border-border`, `outline-ring` (`TonightSubNav.astro:57-62`, `Topbar.astro:53-58`), so the contrast test needs no
  new pair.

### The Topbar today

- One row at every width, `h-16`; logo then `ml-auto` cluster: the pill (`md:flex`, signed in), or the sign-in link
  (signed out), then the `TopbarControls` island (`Topbar.astro:33-92`).
- `TopbarControls` renders the theme cycle button (hidden below `sm` signed out, `:183-185`) and the settings button
  with its native popover (`:192-213`); the panel copies the page theme as `data-theme` because on Tonight the
  Topbar sits in the `night-sky` scope (`:202-211`, CLAUDE.md "Tonight's skies are always night").
- The Topbar is rendered by `GearShell` (three variants, `GearShell.astro:38-62`), `AuthShell`, `Welcome`, and
  `/design` has its own copy of the row (`design.astro:794-806`).
- `TabBar` hides on `/onboarding` and signed out (`TabBar.astro:13`).

### PR #212 (feat/ui-sky-modes) on the same files

`git diff origin/main...origin/feat/ui-sky-modes -- src/components src/styles src/layouts` (15 files):

- `src/components/ui/segmented.tsx` (new): `SegmentedGroup` and `SEGMENT_FOCUS_CLASS`; TopbarControls' theme and
  language groups move onto it and `focusRing` becomes `SEGMENT_FOCUS_CLASS` (`TopbarControls.tsx` −76/+…).
- `global.css`: `--topbar-strip-height` (4.5 rem, 5.5 rem from 40 rem), `--tabbar-height`, `--sky-expanded-share`,
  the `sky-hidden:` / `sky-expanded:` variants and the `sky-expanded-height` utility.
- `Topbar.astro`, `TabBar.astro`, `GearShell.astro`: comments naming those tokens; `GearShell` gains `skyModeScope`;
  `Layout.astro` gains `data-sky-mode` and a shared cookie reader in the head script.
- `sky-mode-control.tsx`: a second native popover (trigger 44 px, panel `w-56` under the trigger, `beforetoggle` copies
  the theme and places it).
- #212 also rewrites `context/foundation/roadmap.md` (adds S-09 to S-12, including this S-10 entry); this change does
  not edit the roadmap.

Overlap: `TopbarControls.tsx` (both changes edit its class constants), `global.css` (both add to the utilities and
`:root`), `Topbar.astro` (comment line 33 on #212 vs this change's cluster). Building on #212 avoids re-extracting
the focus class and lets the panel's top use `--topbar-strip-height`.

### Measurements (dev server 4345, mockup page, Chromium, fonts ready)

| Width, locale, state | Row | Slack / result |
| --- | --- | --- |
| 320 PL signed in, today | logo 16-160, controls 208-304 | 36 px |
| 320 PL signed in, + button | controls 172-320 | header `scrollWidth` 304 > 288: settings flush with the screen edge |
| 320 PL, + button, wordmark `text-label` | logo 16-125, controls 156-304 | 19 px |
| 320 PL, + button, star only | controls 156-304 | 106 px |
| 320 PL, + button, gaps `gap-0.5` / header `gap-2` | | fits with 0 px (8 px logo-to-cluster) |
| 320 PL signed out, + button | | document 353 px: sideways scroll |
| 375 PL signed in, + button | controls 211-359 | 39 px |
| 768 PL signed in, + button | pill 394 → 384 px | two segments wrap |
| 1024 PL signed in, + button | | fits, no wrap |

### Semantics

- WAI-ARIA APG: site navigation in a pop-up is the *disclosure navigation* pattern (a button with `aria-expanded`
  that shows a list of links), not `role="menu"` (application menus of actions, with roving focus and `menuitem`
  roles that hide link semantics and have no defined `aria-current`). The native popover gives Esc, light dismiss
  and focus return to the invoker when focus was inside; Chromium also exposes the invoker's expanded state, but the
  explicit `aria-expanded` keeps WebKit and the e2e assertion honest.
- A second landmark called "Tonight's pages" (the sub-nav's `tonight.subnav.label`) would repeat a landmark name on
  the focused pages; the quick nav's landmark needs its own name.

### Offline

- `TONIGHT_PAGES` (seven pages, `copies.ts:15-23`) are network-first with a ~4 s timeout before the stored copy; a
  page is stored only after the user opened it online (CLAUDE.md Offline (S-06)); a bare path means the remembered
  site (`copies.ts:104,150-162`). Never-opened pages fall back to `/offline`, which lists the stored copies via the
  worker's `list-copies` message (`src/pages/offline.astro:136`).
- The menu therefore needs no `data-needs-network`: the same rule as the Tonight tab (`needsNetwork: false`,
  `navigation.ts:7`) and the sub-nav. Marking unstored pages in the menu while offline would need a `list-copies`
  round trip per open; deferred (plan "What we're not doing").

## Code References

- `src/components/Topbar.astro:33-92` — the row, pill and cluster
- `src/components/TopbarControls.tsx:28-61,178-213` — icon button and settings popover classes and markup
- `src/components/TabBar.astro:10-13` — signed-in, not-on-onboarding rule
- `src/components/tonight/TonightSubNav.astro:44-73` — chips, `aria-current="page"`, landmark name
- `src/lib/navigation.ts:39-74` — `ariaCurrentFor`, `TONIGHT_NAV`, `currentTonightPage`
- `src/lib/offline/copies.ts:15-23,150-162` — stored pages and bare-path site rule
- `tests/e2e/navigation.spec.ts:16-19,71-100` — `header nav` locator, 768/1024 fit
- `tests/e2e/tonight-subnav.spec.ts:23,36-41,88-93,125` — bars locator, one `page` mark per page
- `tests/e2e/tonight-phone.spec.ts:131-157` — document-level sideways check at 320/375
- #212: `src/components/ui/segmented.tsx`, `src/components/tonight/sky-mode-control.tsx`, `src/styles/global.css`
  (`--topbar-strip-height`)

## Architecture Insights

- Server-rendered labels and `aria-current` plus a native popover make the quick nav an Astro component with a small
  `<script>` (focus on open, arrow keys, `aria-expanded`, the page theme), not a React island: it works before
  hydration like the settings popover and adds no client bundle beyond the script.
- Item icons come from lucide (as `fact-icons.ts` does) with the hand-drawn `NavIcon` "tonight" for the dashboard,
  so the dashboard entry matches the Tonight destination.

## Historical Context (from prior changes)

- `context/archive/2026-09-29-top-nav-redesign/` — one-row Topbar with the destinations as a pill from `md` and the
  `TopbarControls` cluster; the theme button hides below `sm` signed out so the Polish row fits 320 px (also in
  `TopbarControls.tsx:183-184`). Supported by the current code.
- `context/archive/2026-10-15-ui-tonight-nav/plan.md:6,18,171,411` — the sub-nav replaced the back link on focused
  pages; F6 (one `aria-current="page"` per page) and the 320/768/1024 fit checks come from there. Supported.

## Related Research

- `context/archive/2026-10-15-ui-tonight-nav/research.md` (TabBar label widths at 320 px)
- #212 `context/changes/ui-sky-modes/research.md` (chrome heights)

## Open Questions

Product choices for the owner (in `plan.md`, "QUESTIONS FOR OWNER"): the icon, list with or without descriptions,
whether the button shows on Tonight pages too, signed-out visibility, the order in the cluster, the panel's form on
phones, and how to win back the 320 px budget.
