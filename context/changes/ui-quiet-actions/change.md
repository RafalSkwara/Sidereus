---
change_id: ui-quiet-actions
title: Quieter per-item actions through a button hierarchy (ui-refine split, change 1)
status: implementing
created: 2026-10-14
updated: 2026-10-14
archived_at: null
---

## Notes

First change of the `ui-refine` split (`context/changes/ui-refine/audit.md`, findings 1 and 3 and the tile cue; owner decision 1 = direction 3C). The buttons are too loud: every per-item action is the bordered, tinted `action` box. The hierarchy is a hairline "Mark observed" (the one per-item button), text actions for the other per-item links (Finder chart, Manage sites/telescopes, the washed-out link, the back link, the /log header links, Pager, the /gear "Add …" links), a bare tile arrow, and eyepiece names off the link colour. The filled primary stays at most one per screen. Design system variant: **existing** (Nightfall: tokens in `src/styles/global.css`, components in `src/components/ui/`). Docs now; implementation waits for S-07 sky-events to merge (it adds the events tile and page).
