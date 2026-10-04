---
change_id: tonight-nightfall
title: Tonight in the Nightfall design
status: archived
created: 2026-10-04
updated: 2026-10-04
archived_at: 2026-10-04T17:35:29Z
---

## Notes

- **Goal (user, 2026-10-04):** make the existing `/tonight` page look like the chosen Nightfall Tonight design on the canvas (https://claude.ai/artifact/8VZbxuqAVU1RntyMQ8u6vu, artboard `NightfallDark` plus its light and red variants). No dashboard or new pages for now: the user will use the restyled page, then decide whether S-11's dashboard move is still needed.
- **Context:** builds on the `visual-redesign` contract (merged in #89 + #90, deployed). The user noticed that change only restyled `/gear` and swapped the font globally; Tonight kept its cards.
- **/10x-ui target:**
  - **View:** `/tonight` (`src/pages/tonight.astro`, the `TonightContent` server island and `src/components/tonight/*`).
  - **Token source:** `src/styles/global.css` (Nightfall).
  - **Components:** `src/components/ui/` and `src/components/forms/`.
  - **Contract variant:** the existing design system, extended.
- **Decisions (user, 2026-10-04):**
  - **Sky header:** decorative stars only. Real planet positions and the time slider stay with S-11's interactive sky.
  - **Band pages:** each summary band (Point here first, The Moon, Planets, Next 7 nights) should eventually get its own page, but that is out of scope here.
- **Assumption (not yet confirmed):** the top of Tonight is the canvas (sky with the big verdict, then summary bands, then the sky check). Today's full detail (Moon slider, planet detail, ranked objects with eyepieces and "Mark observed", the full 7-night strip) stays on the page below, restyled as ruled bands, so no function is lost. Each chevron links to its detail section until the band pages exist.
