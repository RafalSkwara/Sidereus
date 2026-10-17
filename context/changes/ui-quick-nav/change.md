---
change_id: ui-quick-nav
title: Quick nav to Tonight's focused pages from every screen (Topbar icon button)
status: planned
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

Roadmap M-4 S-10, GitHub issue #214. Owner's requirement (2026-10-17): Tonight's focused pages (TONIGHT_NAV) reachable from every screen through one new icon button in the Topbar's right-hand cluster, next to the theme and settings buttons, opening a popover or menu. Keyboard and screen-reader friendly (menu or disclosure semantics, focus management, Esc, aria-current, 44 px targets); red/light/dark, EN+PL, phone first (320 px Polish Topbar, signed in and out); offline behaviour; must not duplicate the TabBar or the sub-nav confusingly. Reuse TopbarControls' native-popover pattern. Builds on PR #212 (feat/ui-sky-modes: `ui/segmented.tsx`, chrome height tokens); implementation starts only after #212 merges.

/10x-ui: view **Topbar** (`src/components/Topbar.astro` + `TopbarControls.tsx`). Contract variant: **existing design system** (Nightfall tokens in `src/styles/global.css`, components in `src/components/ui/`), extended with a shared Topbar popover module, one breakpoint token and one placement utility; no new dependency.
