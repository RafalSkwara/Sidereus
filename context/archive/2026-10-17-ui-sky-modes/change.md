---
change_id: ui-sky-modes
title: Tonight's live sky - drag to pan and Hidden / Default / Expanded modes
status: archived
created: 2026-10-17
updated: 2026-10-17
archived_at: 2026-10-17T15:24:35Z
---

## Notes

Owner's requirements (2026-10-17), run through /10x-ui for the view `TonightSkyView` (the dashboard's live sky band on `/tonight`):

1. Mouse drag-to-pan left/right on desktop for the panorama (today only the chevrons and touchpad scroll work). Pointer events; keyboard and touch keep working; a drag never triggers a marker click (click-vs-drag threshold), a plain click on a marker still navigates.
2. Two new modes besides the current one (DEFAULT): HIDDEN (sky collapsed, the verdict still readable) and EXPANDED (whole screen on phone, most of the screen on desktop). Positions stay astronomically correct in every mode: the projection is recomputed for the new size and field, never CSS scaling. The mode is remembered per viewer in a cookie, server-rendered like the theme cookie (no flash). Accessible toggle (button semantics / aria-pressed or a radio group, visible focus, 44 px targets), red/light/dark, EN+PL, phone first. `tests/e2e/tonight-phone.spec.ts`'s first-screen pin holds in DEFAULT, and the skeleton does not jump (`sky-band.ts`).
3. Roadmap: add the owner slices ui-sky-modes, ui-quick-nav, ui-progress-rewards and app-icon to `context/foundation/roadmap.md`.

## Design-system contract (/10x-ui)

- **View:** `TonightSkyView` (`src/components/tonight/TonightSkyView.tsx`), the dashboard's live sky band on `/tonight`, with its skeleton (`TonightSkeleton.astro`) and shared heights (`sky-band.ts`).
- **Variant:** existing design system. Values: `src/styles/global.css` (theme blocks, `@custom-variant`, `@utility`); components: `src/components/ui/` (shadcn path `npx shadcn@latest add <name>`); kitchen sink: `/design`. The pre-audit scan found 0 literal colours or arbitrary values in the view's files, so the charges are about geometry tokens, a missing shared control and architecture (`research.md` § Charges).
- **New contract pieces:** the `sky-hidden:` / `sky-expanded:` variants and the chrome-height tokens in `global.css`, `ui/segmented.tsx` (extracted from `TopbarControls`), `skyField()` in `src/lib/sky-view/`.
