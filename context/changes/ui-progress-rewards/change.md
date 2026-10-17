---
change_id: ui-progress-rewards
title: Progress rewards - a badge per milestone and type-icon tiles for the Messier and Caldwell checklists
status: plan_reviewed
created: 2026-10-17
updated: 2026-10-17
archived_at: null
---

## Notes

Roadmap M-4 S-11, GitHub issue #215. Owner's request (2026-10-17), supersedes the progress part of the dropped S-03 (#171):

1. Each of the 11 milestones gets its own icon/badge as a reward, with distinct reached vs. ahead states; ahead shows progress where it applies (e.g. 37/50).
2. The Messier (110) and Caldwell (61) checklists become visually appealing instead of a plain ticked list: a grid of tiles with object-type icons (galaxy, globular, open cluster, nebula, planetary, ...) and a clear seen / not-seen state.

Constraints: private progress only (no sharing, no social badges); red/light/dark, red reads by shape and weight; EN+PL; phone first 320-390 px; accessible list/grid semantics; tokens only; lucide icons or a shared custom icon set; MilestoneCelebration consistent with the badges; /log/progress stays network-only; 171 tiles rendered on the server; object types without shipping catalogue JSON to the browser.

Flow: /10x-ui for the view /log/progress (audit -> /10x-research -> /10x-plan).
