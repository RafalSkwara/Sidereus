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

Owner picked C (2026-10-17, `evidence/trigger-icon-options.png`). First implemented simplified for 20 px; the owner rejected that on #222 and picked variant 2 of `evidence/trigger-horizon-variants.png`: option C's horizon exactly as drawn plus the up/down cue, on a 34 x 24 grid drawn at 28 x 20 px (`h-5 w-7`) in the 44 px button. `SkyViewIcon` is a plain lucide-style SVG component in `sky-mode-control.tsx` (`createLucideIcon` fixes a 24 x 24 grid). Final glyph: `evidence/final-trigger-390.png`. The accessible name stays "Sky view: <mode>" / "Widok nieba: <tryb>"; `data-sky-mode-trigger` still carries the mode. `tonight-sky-modes.spec.ts` pins the name and one icon across all six mode choices (proven red against the old per-mode icon).
