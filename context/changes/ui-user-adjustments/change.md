---
change_id: ui-user-adjustments
title: The user's own UI adjustments to Tonight, notifications and clickable affordances
status: impl_reviewed
created: 2026-10-08
updated: 2026-10-08
archived_at: null
---

## Notes

M-3 S-02 (#123): the user's own UI adjustments list for /tonight, /tonight/plan, /tonight/targets, /tonight/nights, app-wide notifications, clickable affordances and subpage background stars.

Runs concurrently with test-plan Phase 2 (`testing-night-and-date-boundaries`, main checkout) in the worktree `.claude/worktrees/ui-user-adjustments`. Keep out of `src/lib/engine`, the log's night hazards (`src/pages/log/new.astro`, `src/lib/observations/store.ts`) and the existing `src/lib/tonight/format.ts` helpers (add, don't change).

This list supersedes the S-01 decisions "never touch the panorama", "the verdict word stays" and "date, dark window and zone on separate lines".

The user's list (2026-10-08, verbatim apart from formatting):

**/tonight**

- The one-word poster needs to be removed. In its place we upgrade the verdict with coloured dot (like red dot + word Cloudy) to be the main info. Should be bigger than now, not nearly as big as the poster word (No-go).
- The top part with the date, darkness window and timezone needs changing. Date should remain on top but dark window is not necessary, it's almost repeated just under the skyline map. Let's just modify this slider to somehow show the dark window exactly, and the info about timezone can go next to the current time shown above the slider.
- Both gear and location toggles need their own cards. They should be next to each other (50% width, a gap between them, except for the smaller screens where they can be 100% width), with top line being the card title, bottom-left part being a large icon (location icon and telescope icon, pick something fitting) and bottom right showing currently chosen option and a select input for the user to pick from existing options.
- When sky check is saved and we have the skyChecked=1 param in url, we have the notification permanently displayed. We don't want that. All these notifications (everywhere in the app, whatever they are for) should appear on top of everything, fixed (under top navigation on large screens, a bit above the bottom nav on smaller), they should be displayed for 10 seconds with a close button on their right hand side to close them quicker. The exception should be the informational notifications (like saved copy – prepared XXX): they should stay where they are but they should also be possible to be closed.
- The last text line before sky map (like forecast updated x mins ago) overlaps with the map on every screen size obstructing many stars. Change the styles for the sky's parent container from `margin-top: calc(var(--spacing) * -24);` to `margin-top: calc(var(--spacing) * -16);`.
- On the sky map, the chevrons have bg and borders: remove that, they are too visible, they're only meant as suggestions.
- Session plan, the Moon and planets sections still have not enough space to breathe between texts; the paddings or margins between them should be bigger, especially on smaller screens.
- Browsers show the scrollbar underneath the sky map. Make it invisible and instead add an indicator in the middle of the top bar (the one with cardinal directions): it should mark the direction that is closest to the middle (both main and minor, so S and SSW alike). Can be underline, color, highlight, circle/border, whatever seems best.

**/tonight/plan**

- Not enough breathing room between listed objects, needs more padding.
- On smaller screens the sunset/dark/moonrise informations should be split: each on its own line.
- Reconsider whether the way we show visibility and best time to observe on a slider for each object is optimal. The user wants to see other options; also there is no information about what any of this means.

**/tonight/targets**

- Data points below the title need their own lines.
- The Mark observed button doesn't look clickable; make it stand out more. Anything clickable, link or button, needs to be more differentiated from the rest, in both light and dark theme.

**/tonight/nights** (the list said "Tonight/targets" twice; the user confirmed the second means /tonight/nights)

- Data points below the title need their own lines.
- More breathing space between lines for items on this screen.

**General**

- Symbolic stars on screens other than the main dashboard (only the ones in the background under subpage titles) should be dimmer, less distracting.
