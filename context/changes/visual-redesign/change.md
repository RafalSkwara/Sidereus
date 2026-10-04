---
change_id: visual-redesign
title: Visual redesign
status: implementing
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Notes

- Design directions canvas (2026-10-04): https://claude.ai/artifact/8VZbxuqAVU1RntyMQ8u6vu. A Atlas, B Instrument, C Nightfall; each row is a style tile plus the Tonight dashboard on a phone in dark, light and red.
- **Decisions (user, 2026-10-04):**
  - Direction: **C · Nightfall**. Newsreader and Public Sans are replaced by Archivo (widths); IBM Plex Mono to be reconsidered in the contract.
  - Landing: a bigger rework than the in-app views, and `/` is for signed-out visitors only; a signed-in user is redirected to `/tonight` (later the dashboard).
  - The interactive sky (slider across the dark window, targets at their real positions) belongs to S-11's dashboard, built on this change's contract; recorded in the roadmap's S-11 unknowns.
- **/10x-ui target (2026-10-04):**
  - **View:** `/gear`, meaning the hub (`src/pages/gear/index.astro`) and its new/edit forms (`src/pages/gear/{sites,telescopes,eyepieces}/{new,[id]}.astro`), inside `GearShell` with `Topbar` and `TabBar`. It is the most representative stable view (research §4). Tonight is left to S-11, and the landing page gets its own change.
  - **Token source:** `src/styles/global.css` (values on `:root` and `[data-theme]`, published through `@theme inline`). Components live in `src/components/ui/` (shadcn; add via `npx shadcn@latest add`) and `src/components/forms/`.
  - **Motif:** C · Nightfall, mapped onto the existing role names.
  - **Contract variant:** existing design system, extended. Keep the shadcn role names and the colour/red guards, and add the missing non-colour tokens (type roles, surface tiers, radius) and shared components. Fonts stay self-hosted (fontsource); no second design system.
  - **Pre-audit:** 0 literal colours and 20 arbitrary values (sizes, tracking, heights, ring) across 20 view files. 2 of 20 files import from `src/components/ui/`.
