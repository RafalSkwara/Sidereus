---
change_id: ui-sky-mode-trigger
title: One fixed "change the sky view" icon on the sky-mode trigger
status: implemented
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

Owner follow-up to ui-sky-modes (archived 2026-10-17): the 44 px sky-mode trigger on Tonight's sky shows the current mode's icon, and in Default (`RectangleHorizontal`) it reads as a missing/unloaded SVG. Replace it with ONE fixed icon that says "change the sky view" (never the current state). The three icons inside the menu stay as they are. Step 1: 3-4 options rendered in place on the Tonight band (390/1440 px, dark/light/red, plus the open menu) in `evidence/`; the owner picks; step 2 implements.

Owner picked C (2026-10-17, `evidence/trigger-icon-options.png`). Implemented as `SkyViewIcon` (`createLucideIcon`, in `sky-mode-control.tsx`), simplified for 20 px: a star, one peak on the horizon, the up/down cue (`evidence/final-trigger-390.png`). The accessible name stays "Sky view: <mode>" / "Widok nieba: <tryb>"; `data-sky-mode-trigger` still carries the mode. `tonight-sky-modes.spec.ts` pins the name and one icon across all six mode choices (proven red against the old per-mode icon).
