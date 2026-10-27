---
change_id: tonight-request-flow
title: Research of the Tonight request flow end to end (10xArchitect m4 L3)
status: preparing
created: 2026-10-27
updated: 2026-10-27
archived_at: null
---

## Notes

Analysis only, no product code: the 10xArchitect module 4 lesson 3 research of one flow, the repo map's risk zone #1 (`context/map/repo-map.md`). The flow: `src/middleware.ts` → `src/pages/tonight.astro` → the `TonightContent` server island (`/_server-islands/*`) → `src/lib/tonight/island.ts` / `load.ts` / `build.ts` (forecast, engine, gear, session plan, sky checks) → the rendered verdict and tiles → the browser and the service worker's stored copy. Three parallel strands: an end-to-end trace, test gaps, blast radius (static graph + git co-change); then an ast-grep verification of every structural claim (lesson m4l3-2).
