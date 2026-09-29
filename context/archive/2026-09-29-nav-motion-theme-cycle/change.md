---
change_id: nav-motion-theme-cycle
title: Sliding navigation indicator and a theme-cycling eye button
status: archived
created: 2026-09-29
updated: 2026-09-29
archived_at: 2026-09-29T14:07:45Z
---

## Notes

User follow-up to top-nav-redesign (2026-09-29):
- A cool animation when a pill segment goes from inactive to active after a click, and a separate one for the phone tab bar. User picked the **sliding indicator**: the amber fill glides from the old segment to the new one across the page change (cross-document View Transitions; Firefox switches instantly), the phone tab bar gets a gliding amber bar plus a small icon bounce, both squeeze on press, about 250 ms, off with reduced motion.
- The eye button is unclear: it should **cycle through all three themes, Dark → Light → Red**, and show the current one. This replaces top-nav-redesign's "red ↔ last theme" behaviour (and its `sidereus-theme-return` cookie).
