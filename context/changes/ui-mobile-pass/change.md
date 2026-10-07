---
change_id: ui-mobile-pass
title: Phone-first UI pass of the Tonight dashboard
status: plan_reviewed
created: 2026-10-07
updated: 2026-10-07
archived_at: null
---

## Notes

Roadmap M-3 **S-01** (MS-01, PRD NFR phone first), GitHub #122. The user, 2026-10-07: "First you'll go over the views (especially mobile as they feel crowded) and try and improve them (especially dashboard/tonight)."

- **View:** the Tonight dashboard, `/tonight` (`src/pages/tonight.astro` → `TonightContent.astro`, `TonightSkyView`, `TonightTiles`). One view per change (`/10x-ui`); the shared Tonight chrome it uses (GearShell sky-flow strip, Topbar, TabBar, `TonightPageSky` on the focused pages) is in scope only where the dashboard needs it. Other views are audited for phone density in research and either fixed through a shared component touched here or listed as deferred follow-ups.
- **Token source:** Nightfall, `src/styles/global.css` (dark, light, red), components in `src/components/ui/` and `src/components/forms/`. Contract variant: **existing design system**: extend it, no new palette, no new library.
- **Mobile width:** 375 px (plus a 320 px check for overflow); desktop 1280 px.
- **Pre-audit (2026-10-07):** the hardcoded-value scan on the dashboard's 12 files finds 0 literal colours and 0 arbitrary values (guarded by `src/styles/no-hardcoded-colors.test.ts`); 9 of them import `components/ui`. The charges are therefore layout density, missing shared components and accidental architecture, not tokens.
