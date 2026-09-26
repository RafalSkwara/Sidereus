---
change_id: server-latency
title: Cut server wait on signed-in pages and show a loader while /tonight loads
status: implementing
created: 2026-09-26
updated: 2026-09-26
archived_at: null
---

## Notes

Server latency cheap fixes + loading state for Sidereus. Scope: (1) enable Workers tracing in wrangler.jsonc observability; (2) middleware: replace supabase.auth.getUser() with local JWT verification via getClaims() (tokens are ES256 asymmetric); (3) Smart Placement ("placement": {"mode": "smart"}); (4) forecast KV write off the response path via waitUntil, plus timeouts on Supabase/KV calls; (5) show a loader while /tonight waits on external services (Supabase lists, KV, Open-Meteo) — likely an Astro server island (server:defer) with a skeleton fallback so the shell paints immediately, including after the language-switch reload.

Evidence from prod telemetry 2026-09-26 (Workers observability, colo WAW): /tonight CPU 15-50 ms but wall 0.16-3.7 s (outliers 20.6 s and a 17.6 s cancel); /dashboard 302 with only getUser = 471 ms vs 2 ms signed out. Anonymous pages 35-50 ms TTFB. Client payload ~75 KB JS. Paid Workers tier explicitly not needed: the bottleneck is I/O wait, not CPU. Language switch = cookie + full reload, so it pays the same /tonight cost.

Not on the roadmap: an operational change requested by the user after the perf investigation.
