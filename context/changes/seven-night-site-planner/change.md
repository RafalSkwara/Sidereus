---
change_id: seven-night-site-planner
title: Seven night site planner
status: implementing
created: 2026-09-27
updated: 2026-09-27
archived_at: null
---

## Notes

- 2026-09-27, Progress 3.7: the dropdown switches on change with JS (verified). The "via Show (JS disabled)" half cannot be exercised: Tonight's data is an Astro server island (`server:defer`, since the server-latency change), which needs JS to load, so with JS off the page stays on its skeleton. Pre-existing on `main` (S-08's no-JS claim has the same gap); accepted by the user as out of scope, to be raised in `/10x-impl-review`.
- 2026-09-27, Progress 3.9: measured locally with `buildTonight` (Warsaw, 3 runs): `main` 21-24 ms cold / 2.2 ms warm median, branch 25-26 ms cold / 4.1 ms warm. Production CPU check stays a post-merge task (plan, Performance Considerations).
