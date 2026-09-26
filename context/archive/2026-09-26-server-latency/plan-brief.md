# Server latency and /tonight loading state — Plan Brief

> Full plan: `context/changes/server-latency/plan.md`

## What & Why

Signed-in pages on prod feel slow: the first load of `/tonight` can take seconds, and switching language takes about 3 s. Telemetry shows the Worker uses only 15–50 ms of CPU per request and spends the rest waiting on Supabase, KV and Open-Meteo. So the fix is fewer and bounded external calls plus visible loading feedback, not the paid tier.

## Starting Point

Every request calls Supabase Auth (`getUser()`) in `src/middleware.ts`. `/tonight` then runs 3 list queries, a KV read, sometimes an Open-Meteo fetch, and a KV write that the response waits for, all before sending any HTML. Only Open-Meteo has a timeout. The language switch reloads the whole page. No traces are recorded, so a 20 s outlier on 2026-09-26 cannot be attributed to one call.

## Desired End State

On `/tonight` the top bar and heading appear at once, and a pulsing skeleton shaped like the verdict and object cards fills in when the data arrives. Tapping EN or PL shows a spinner right away. A signed-in request makes no Supabase Auth call unless the token needs refreshing. A hung Supabase call fails after 5 s, and a KV read slower than 1 s counts as a cache miss. Cloudflare traces show where each request spent its time.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Paid Workers tier | Not now | The bottleneck is waiting on I/O, not CPU; the paid tier raises CPU and request limits, not upstream speed. |
| Auth check | `getClaims()` (local check of the ES256 token) | Removes a 150–470 ms round trip from every signed-in request; revocation lags up to 1 h, which the user accepted. |
| Loading UI on `/tonight` | Server island (`server:defer`) + skeleton | The shell paints without waiting on any service, and the skeleton avoids a layout jump (user's pick over a spinner). |
| Language-switch feedback | Spinner in the tapped segment, both disabled | Instant acknowledgement and no double taps; reuses the existing spinner style (user's pick). |
| Timeouts | Supabase 5 s, KV read 1 s (miss), Open-Meteo 3 s (existing) | Far above normal latencies, far below the observed 17–20 s hangs (delegated to agent). |
| KV write | Via `cfContext.waitUntil` through a `defer` hook | Keeps `service.ts` pure and testable while freeing the response (delegated to agent). |
| Observability and placement | Traces on, Smart Placement on | Free; traces make the next slowdown diagnosable (delegated to agent). |

## Scope

**In scope:**
- `wrangler.jsonc` traces and placement
- Middleware `getClaims()` and a minimal `SessionUser` type
- A Supabase fetch timeout helper
- Deferred KV write and a KV read timeout
- A `/tonight` server island with a skeleton and a localized loading label
- The language-switch pending state

**Out of scope:**
- Paid tier
- Client-side language switching
- Deferring `/gear` pages
- Caching list queries
- `ASTRO_KEY` for island props
- Cleaning up the prod test account (user's action)

## Architecture / Approach

The shell request does locale and theme resolution, a local JWT check (plus a refresh only when needed), and renders `GearShell` with the skeleton. The browser then fetches `/_server-islands/TonightContent`, which runs the existing loads (lists → KV → Open-Meteo), renders the verdict and ranking, and hands the KV write to `waitUntil`. Every external call is bounded by a timeout.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Platform config and a local auth check | Traces, Smart Placement, `getClaims()`, 5 s Supabase timeout | A token-refresh edge case signs someone out; mitigated by the unchanged `setAll` write-back and a manual sign-in walk |
| 2. Forecast off the response path | `defer` hook for the KV write, 1 s KV read timeout | None significant; covered by unit tests |
| 3. Loading feedback | `/tonight` island + skeleton, EN/PL loading label, language-switch spinner | The island route is outside `PROTECTED_ROUTES`, so it must guard on `locals.user` itself |

**Prerequisites:** Branch `feat/server-latency` from `origin/main`. `nvm use` before npm commands.
**Estimated effort:** About 1 session across 3 small phases.

## Open Risks & Assumptions

- Server-island props are encrypted with a key generated per build. During a deploy, a page served by the old version whose island request reaches the new version can fail once. Astro then leaves the skeleton in place, so a CSS-delayed "taking longer than usual — Reload" hint (plan review F1, Fix A) covers this and any other island failure. Setting `ASTRO_KEY` is left for later.
- With little traffic, Smart Placement may keep running the Worker at the edge. That is harmless.
- Traces and placement can only be verified on Cloudflare: after merge, or on a preview version uploaded with the user's per-case OK.

## Success Criteria (Summary)

- Signed-in `/tonight` paints its shell about as fast as an anonymous page, and the skeleton covers the data wait.
- Language switching acknowledges the tap at once and never looks frozen.
- The next slow request can be pinned to one call from the traces view.
