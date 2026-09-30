---
change_id: planets-on-tonight
title: Planets on Tonight
status: implemented
created: 2026-09-30
updated: 2026-09-30
archived_at: null
---

## Notes

- 2026-09-30: Progress 3.10, re-measuring `/tonight` CPU against the Workers Free 10 ms cap, is superseded. The user moved the account to Workers Paid (30 s CPU default), so the cap no longer applies. It was recorded in `context/foundation/infrastructure.md` (risk register) and on #22. Local timings: `buildTonight` ~6.6 ms warm, of which planets ~2.3 ms; ~30 ms cold.
