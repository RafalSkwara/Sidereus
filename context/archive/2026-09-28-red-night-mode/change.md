---
change_id: red-night-mode
title: Red night mode as a third theme that preserves dark adaptation
status: archived
created: 2026-09-28
updated: 2026-09-28
archived_at: 2026-09-28T12:49:19Z
---

## Notes

Roadmap S-10 (GitHub #14): red night mode as a third theme on the F-03 tokens, preserving dark adaptation. PRD FR-024; NFR dark by default.

### Implementation notes (impl review 2026-09-28)

- **Native input parts are hidden, not filtered** (F2): `url(#red-only)` does not resolve inside the browser's shadow DOM, so in red mode the date-picker icon is transparent (still clickable; the form draws its own token icon), number spinners are hidden, and focused date segments lose Chrome's system-blue highlight (author CSS cannot target only the active segment). Open `<select>` lists and the date-picker popup stay OS-drawn (plan: known limitation).
- **Top bar wraps on phones** (F1, user chose to keep it): the third segment made phone pages 8 px too wide, so `PreferenceSwitches` now wraps and EN/PL sits under the theme group on narrow screens in every theme. No overflow at 360/390 px in 60 measured combinations.
