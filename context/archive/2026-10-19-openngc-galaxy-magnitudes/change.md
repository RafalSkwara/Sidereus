---
change_id: openngc-galaxy-magnitudes
title: Correct implausible OpenNGC V magnitudes of 12 galaxies
status: archived
created: 2026-10-19
updated: 2026-10-19
archived_at: 2026-10-19T09:31:25Z
---

## Notes

GitHub #178, M-4 S-04 follow-up (Stream B, advice you can trust). From small-scope-galaxies impl review F1: in the pinned OpenNGC commit (da90466) 12 galaxies have V > B - 0.2 (M58, M61, M88, M91, M98, M106, IC342, NGC4449, NGC5005, NGC4565, NGC6822, NGC4039), so their core is dimmed in contrastDeficit and the band, the what-to-expect line and, since S-04, the ranking all move. Rule and caps are correct; the input is wrong. Branch fix/openngc-galaxy-magnitudes.

Archived 2026-10-19 after PR #227 merged and deployed (main dd58f55). Still open at archive time, deliberately kept unchecked in `plan.md` Progress as the owner's manual checks: 1.5 (published V table against its SEDS and SIMBAD pages), 2.8 and 2.9 (the 12 `vMagColour` entries, the `LICENSE-DATA.md` paragraph), 3.6 (the new M106 references and the divergence cap log), 3.7 (M106's line on `/tonight/targets` at 150 mm, Bortle 5 and 6). GitHub #178 stays open: M106 at 150 mm / Bortle 6, the issue's own case, is still `faint` (deficit 1.61 against 1.5), and no second galaxy reference (M61) was added. The owner decides whether to close it.
