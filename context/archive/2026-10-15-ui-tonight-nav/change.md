---
change_id: ui-tonight-nav
title: Tonight sub-nav and Progress as a destination
status: archived
created: 2026-10-15
updated: 2026-10-15
archived_at: 2026-10-15T19:48:27Z
---

## Notes

M-4 S-02 (#170), change 4 of the ui-refine umbrella (`context/changes/ui-refine/`, owner decision 4): Tonight sub-nav (4A) and the Progress tab (4B). Roadmap: `context/foundation/roadmap.md` → S-02.

## Archive notes

- Shipped as PR #182 (merged, main b8d01d9). Impl-reviewed (phases 1-3); findings F1-F6 applied.
- Progress row 3.6 (the owner's walk on the preview) stays unticked in `plan.md`: it was covered by the owner's merge of #182, not by a separate walk.
- Open follow-ups from the PR:
  - `/tonight/targets` keeps a second `aria-current="page"` on its own sort control (the current order); it could become `aria-pressed` or `"true"`.
  - How VoiceOver and TalkBack announce `aria-current="true"` in a nav was not tested; check on a device.
