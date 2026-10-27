---
change_id: stream-error-boundary
title: Log throws that happen after Astro starts streaming a page or island
status: implemented
created: 2026-10-27
updated: 2026-10-27
archived_at: null
---

## Notes

— log a throw that happens after Astro starts streaming (child component or server-island descendant: 200, empty body, no line today) via a middleware stream wrapper (`request.stream`) plus a catch around next() (`request.uncaught`); from observability audit 2026-10-27 finding P1/P8, owner decision D1: keep streaming, add the wrapper

GitHub: #244 (board #1, Change ID `stream-error-boundary`).
