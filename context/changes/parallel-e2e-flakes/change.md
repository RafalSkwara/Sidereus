---
change_id: parallel-e2e-flakes
title: Make the e2e suite reliable under parallel workers
status: implementing
created: 2026-09-28
updated: 2026-09-28
archived_at: null
---

## Notes

GitHub #45 (S-07 impl review F6). With 5 parallel workers the e2e suite sometimes hangs for 2 minutes on an event wait (telescope-selector `deleteGear` dialog; `onboardInMadrid` click on the stubbed Madrid result, helpers.ts:61); CI's retry hides it. Serially every spec passes. Suspects in the issue are undiagnosed: reproduce first.
