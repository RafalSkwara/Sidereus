---
change_id: observing-milestones
title: Observing milestones - celebrate a milestone once at save and list them on the progress page
status: archived
created: 2026-10-11
updated: 2026-10-13
archived_at: 2026-10-13T12:35:33Z
---

## Notes

Sidereus M-3 slice S-06 observing-milestones (GitHub #127; roadmap "S-06: Observing milestones"; PRD FR-041, US-06). Builds on S-05 observing-progress (archived 2026-10-09). Milestone set is PRD Open Question 18 (owner): propose a default set, mark it pending owner confirmation. Risk: the celebration appears once, at save, and never for an entry rated 1-2.

**Manual checks (2026-10-13, by the agent, screenshots in the session scratchpad, not committed):**
- 4.3 `/log/progress` (EN/PL × dark/light/red × 390/1280, PL at 320, none reached): `scratchpad/milestone-variants/shots/progress-*.png`.
- 6.3 dialog C against the production preview, `/log` and `/tonight/planets` in EN/PL × dark/light/red × 390/1280 plus PL at 320: `scratchpad/manual-6/shots/c-*.png` (25).
  - Keyboard: on open, focus is on Continue/Dalej. Tab cycles Continue → See your progress → (browser chrome) → Continue and never reaches the inert page. Esc closes and clears the URL.
  - Continue/Dalej left focus on the hidden button; fixed in 5940599 and pinned by the e2e. Now it returns focus to the page (body) like Esc.
  - Reduced motion: 5 twinkling stars without the preference, 0 under `reduce`.
- 6.4 `/design` specimens (dev server, toolbar hidden) in dark/light/red × 390/1280: `scratchpad/manual-6/shots/design-celebration-*.png`, `design-milestone-list-*.png`. No modal opens on `/design`.
- Impl review F1 (toast behind the modal): after a real 11 s with the dialog open, the save toast is still there once Continue closes it, on desktop and phone: `scratchpad/manual-6/shots/toast-after-close-en-dark-{desktop,phone}.png`. The e2e pins the same behaviour with a fake clock.
