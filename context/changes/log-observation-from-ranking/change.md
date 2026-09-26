---
change_id: log-observation-from-ranking
title: Log an observation from the ranking
status: implementing
created: 2026-09-26
updated: 2026-09-26
archived_at: null
---

## Notes

Roadmap slice S-06 (GitHub #11). User marks a ranked object as observed (prefilled night, site, telescope; 1-5 rating); later rankings mildly deprioritize objects rated 3+ (never 1-2) and tag a still-ranking logged object "seen N times - last [date]". PRD refs: US-04, FR-016, FR-018, Business Logic invariant 4. Log penalty candidate 0.15 (Open Question 6).
