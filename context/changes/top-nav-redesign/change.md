---
change_id: top-nav-redesign
title: Rethink the top navigation so it fits on one line and works on mobile
status: impl_reviewed
created: 2026-09-29
updated: 2026-09-29
archived_at: null
---

## Notes

Rethink the top navigation: too many items (Tonight, Log, My gear, welcome pill, sign out, 3-way theme switch, EN/PL switch) don't fit one line and look awful on mobile. Nothing in that area is set in stone.

### Framing (2026-09-29, inline; /10x-frame is not installed here)

- **Observation (measured):** signed-in header is 169 px tall at 360/390 px wide (4 rows), 88 px at 768, one 46 px row only from 1024. Signed out: 135 px on phones. 11 items: Tonight, Log, My gear, "Welcome!" pill, Sign out, 3 theme segments, 2 language segments (`src/components/Topbar.astro`, `src/components/PreferenceSwitches.tsx`, which wraps since S-10).
- **Reframed problem:** not width but missing hierarchy. Three kinds of item get equal weight: destinations used every visit (3), account items (a decorative pill + rarely used Sign out), and preferences set once (5 buttons), with one exception: red mode, which is wanted in one tap outdoors.
- **Direction board:** https://claude.ai/artifact/VBMVqSE9846VQhhUjtjKTv (A bottom tabs + settings tray, recommended; B tabs under the header; C one menu button). Common to all: drop the Welcome pill; language and Sign out move into settings; signed-out bar = name + Sign in + settings.
- Top bar renders from `AuthShell.astro`, `Welcome.astro`, `gear/GearShell.astro` (Tonight, Log and Gear render through GearShell).
