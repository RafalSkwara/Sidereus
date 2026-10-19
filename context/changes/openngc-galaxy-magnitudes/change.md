---
change_id: openngc-galaxy-magnitudes
title: Correct implausible OpenNGC V magnitudes of 12 galaxies
status: implementing
created: 2026-10-19
updated: 2026-10-19
archived_at: null
---

## Notes

GitHub #178, M-4 S-04 follow-up (Stream B, advice you can trust). From small-scope-galaxies impl review F1: in the pinned OpenNGC commit (da90466) 12 galaxies have V > B - 0.2 (M58, M61, M88, M91, M98, M106, IC342, NGC4449, NGC5005, NGC4565, NGC6822, NGC4039), so their core is dimmed in contrastDeficit and the band, the what-to-expect line and, since S-04, the ranking all move. Rule and caps are correct; the input is wrong. Branch fix/openngc-galaxy-magnitudes.
