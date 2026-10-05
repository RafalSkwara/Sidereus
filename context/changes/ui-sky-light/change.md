---
change_id: ui-sky-light
title: Tonight's skies stay navy in the light theme, and the panorama shows it scrolls
status: implementing
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Notes

— /10x-ui pass on Tonight's skies (TonightSkyView on /tonight, its TonightSky skeleton and TonightPageSky on /tonight/*): (1) light theme keeps a slightly lighter navy night sky with light ink so stars and markers show (scoped token set, other views' sky headers unchanged — user decision 2026-10-05); (2) edge chevron buttons as the panorama's scroll cue (user decision 2026-10-05). Token source: src/styles/global.css (Nightfall). Part of S-10 follow-ups, #86.

Design-system variant: **existing design system** (Nightfall). Extend it; never fork a palette.
