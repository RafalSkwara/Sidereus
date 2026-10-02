# Follow-ups from reviews

From `reviews/impl-review.md` (phases 1–4, 2026-10-02). Both are deferred to Phase 5 by the user. The time slider changes what they need.

- **F7: the disc's aria-label repeats the card heading** (`MoonDisc.astro`, `MoonCard.astro`). Once the slider moves the shown moment away from the heading, decide one of two options. Either the disc's label carries the slider's moment and the heading stays nightly, or the disc is `aria-hidden`, with the slider's `aria-valuetext` and a live region carrying the state.
- **F8: clipPath ids for redrawn discs** (`MoonDisc.astro:24`). Give the slider island its own `idPrefix`, or one per instance, so a redrawn disc never shares an id with the server-rendered one, and the id always matches the state shown. Leave the duplicated `moonTrack` in `build.ts` and `rankObjects` as is: about 2.5 ms on a 20 h window.

## Post-merge checks

From `reviews/impl-review-phase-5.md` (F5) and the Phase 1 checkpoint (review rev 2, F4):

- After 2026-10-22, take bright-Moon screenshots of Tonight and `/tonight/all`: the washed-out line, the group, and the Moon card's "Bright Moon" line.
- Take one Firefox red-mode screenshot of the Moon card slider. The custom range styling was verified only in Chromium; check that `::-moz-range-progress` shows no user-agent colour.
