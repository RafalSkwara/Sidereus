# Offline night plan — Plan Brief

> Full plan: `context/changes/offline-night-plan/plan.md`

## What & Why

S-06 (MS-06, #70): Sidereus becomes installable on a phone and its Tonight pages — the dashboard plus Targets, Plan, Moon, Planets and Nights — open at a dark site with no signal, for every site viewed in the last 36 h, always saying when they were prepared. A beginner loads tonight's plan at home and still has it in the field.

## Starting Point

No manifest, service worker or app icons exist. Every Tonight page is a shell plus one Astro server island fetched by script; the island URL is encrypted with a random IV per render, so it cannot be cached by a canonical URL — only replayed as a pair with the shell that referenced it. The night is chosen on the server from `now`, and the forecast already covers seven nights.

## Desired End State

"Install app" sits in the settings popover (iOS gets a Share → Add to Home Screen hint). Online visits store each Tonight page per site plus a background "next night" copy from the same forecast. Offline, a stored page shows a warning Notice under the sky — "Offline · prepared Sun 5 Oct, 21:05"; after dawn the next-night copy shows "Old forecast from … · plan for Mon 6 Oct", or, without one, the old plan with "the night is over". Mark observed, sky-check answers, Log/Gear tabs and sign-out are disabled with "Needs a connection"; anything else lands on a Nightfall offline page listing stored pages. Sign-out, sign-in, sign-up or a bounce to sign-in empties the store.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| What is stored | Every Tonight page the user opened, per site, for 36 h since last refresh | Covers checking two sites before leaving and a plan loaded in the afternoon used after midnight. |
| After dawn | Server-rendered next-night copy from the old forecast, marked as old; else the old plan with a stale warning | Your rule: use the cached forecast for tonight when it exists, never pass an old plan off as current. |
| How next night is produced | `?night=next` shells rendered online in the background, no sky-check write | Reuses the server engine unchanged instead of rebuilding Tonight in the browser. |
| Prepared-at marking | Warning `Notice` under the sky, only when offline | Existing component, impossible to miss, AA in all three themes. |
| Network-only screens | Nightfall `/offline` page + disabled controls offline | Never a browser error, and the user sees in advance what won't work. |
| Install | Settings entry + iOS hint, hidden when installed | Discoverable without nagging; iOS has no prompt API. |
| Icon | The Topbar's four-point star on zenith navy | No design round; consistent with the brand. |
| Worker tooling | Workbox via `vite-plugin-pwa` 2 directly (injectManifest); `workbox-build` postbuild fallback | `@vite-pwa/astro` declares Astro ≤5 only; plugin 2.0 supports Vite 8. |
| Tests | Vitest for the pure offline logic + one offline Playwright spec | Pins worker behaviour and the purge; the rest by screenshots. |
| Delegated (technical) | Pair storage keyed by exact island URL with a JSON index in the cache; ~4 s network timeout; purge on auth POSTs; theme kept from cookie on stored copies | Derived from the code; recorded so review can challenge them. |
| Deploys vs stored pages (review F1) | Keep the `/_astro/*` assets stored pairs reference in a runtime cache, cache-first | A deploy must not leave tonight's stored plan unstyled or without its live sky. |
| Stored copy always marked (review F2) | The worker tags a served stored shell with `data-from-device`; the notice shows on that or real offline | A timeout on a weak signal serves stored copies while `navigator.onLine` is still true. |
| Other review fixes (F3–F10) | No storing of `?logged/?skyChecked/?error` shells; ignore `Vary`; `/offline` stored at runtime per locale; one queue for index writes; Notice announces on unhide; the e2e run sets `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1` | See `reviews/plan-review.md`. |

## Scope

**In scope:** manifest, icons, Workbox worker, install entry; next-night render; copy metadata and notices in every Tonight island; `/offline`; pair caching, expiry, purges; offline page state and disabled controls; one e2e spec; CLAUDE.md notes.

**Out of scope:** offline logging/sync; computing Tonight on the device; caching log/gear/onboarding/auth pages; prefetching unopened pages; re-rendering stored pages in a newly chosen language; push/background sync; `@vite-pwa/astro`; a new brand mark.

## Architecture / Approach

The server gains a `night: "next"` option and, in every Tonight island, a hidden `data-offline-copy` element (site id/name, night, prepared-at, server-computed `validUntil`, forecast time) plus three hidden localized notices. The worker (`src/sw.ts`, thin) delegates every decision to pure functions in `src/lib/offline/`: it records the shell's island URL from its preload link, commits the pair when that island returns, fetches the next-night twin, and offline picks tonight → next → stale by `validUntil`. A small page script sets `<html data-offline>`, reveals the right notice and disables `data-needs-network` controls.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Installable shell | Plugin spike, manifest, icons, worker registration, Install entry | `vite-plugin-pwa` 2 under the Cloudflare build (fallback planned) |
| 2. Offline-ready content | `?night=next`, copy metadata + notices, `/offline` | Next-night render must not write a sky check |
| 3. Service-worker caching | Pairs, next twin, offline choice, expiry, purges, fallback | Pairing shell and island correctly; stale copy shown as current |
| 4. Page state, tests, docs | Notices, disabled controls, theme sync, offline e2e, docs | SW e2e flakiness |

**Prerequisites:** S-05 and S-11 done (yes); local Supabase + forecast fixture for previews.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- `vite-plugin-pwa` 2 is unproven with Astro 7 + `@astrojs/cloudflare` 14; Phase 1 opens with the spike and has a `workbox-build` fallback.
- iOS home-screen storage can be evicted under pressure; a real-phone check (4.9) is with you.
- Island responses must stay GET (props well under 2048 chars); a POST island would not be stored.
- Playwright reaches service-worker fetches only behind an experimental flag (`PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS`); if a Playwright upgrade drops it, the offline spec needs another way to cut the network.

## Success Criteria (Summary)

- Installed on a phone, in airplane mode, the user opens tonight's dashboard and plan for a site viewed earlier and sees when it was prepared.
- After dawn offline, the user sees tonight from the old forecast clearly marked as old — never yesterday's plan passed off as current.
- After sign-out, nothing of the user's plans remains on the device.
