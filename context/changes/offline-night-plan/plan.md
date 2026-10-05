# Offline night plan Implementation Plan

## Overview

S-06 (MS-06, GitHub #70): make Sidereus installable on a phone's home screen and let its Tonight pages — the dashboard and `/tonight/{targets,plan,moon,planets,nights}` — open at a dark site with no network, for every site the user viewed in the last 36 hours. A page served from the device says when it was prepared. After dawn rolls the night over, a pre-rendered "next night" copy built from the same (old) forecast is shown, marked as an old forecast; without one, the old plan shows with a stale-night warning. Screens that need the network fall back to a Nightfall offline page, and the controls that need the network are disabled while offline.

## Current State Analysis

- Nothing installable or offline exists: no manifest, no service worker, no icons beyond a 32 px `public/favicon.png`; `Layout.astro:21` links only the favicon (roadmap baseline, `roadmap.md:87`).
- Every Tonight page is a shell (`GearShell skyFlow`) that paints at once plus one `server:defer` island: `TonightContent` (`src/pages/tonight.astro:43`) and `{Targets,Plan,Moon,Planets,Nights}PageContent` (`src/pages/tonight/*.astro`). The browser fetches the island with a GET to `/_server-islands/<componentId>?e=&p=&s=` (POST only past 2048 chars, `node_modules/astro/dist/runtime/server/render/server-islands.js:24,147`), preceded by a `<link rel="preload" as="fetch">` of the same URL. `replaceServerIsland` swaps the DOM only for a 200 `text/html` response.
- The island URL is **not stable**: props are AES-GCM encrypted with a random IV per render (`node_modules/astro/dist/core/encryption.js:58`), so a cache cannot look an island up by a canonical URL. It *can* replay a stored shell with the island response stored under the exact URL that shell references.
- The site and telescope reach the island as props from `requestedGear` (`src/lib/tonight/requested-gear.ts:28`), read from `?site=`/`?telescope=` or the httpOnly `sidereus-site`/`sidereus-telescope` cookies, which a service worker cannot read. The island resolves them against the user's gear, falling back to the oldest.
- The night is decided on the server from `now`: `loadTonightFor` passes `new Date()` (`src/lib/tonight/island.ts:45`), `buildTonight` takes `tonightDateFor(engineSite, now, …)` (`src/lib/tonight/build.ts:615`); `now` also drives the forecast age (`build.ts:526`), the Moon slider's and the live sky's initial frame (`build.ts:883,931-932`) and the plan tile's "First up/Next" (`build.ts:1062-1067`). The forecast already covers seven nights (`sevenNightOutlook`).
- `TonightContent` records the sky verdict on every load through `skyCheckStore.record` in `waitUntil` (`TonightContent.astro:90-95`).
- Sign-out is a plain POST form in the settings popover (`TopbarControls.tsx:244`) to `/api/auth/signout`, which redirects to `/`; sign-in/sign-up are POSTs to `/api/auth/signin|signup`. A signed-out GET of a gated path gets a 302 to `/auth/signin?next=…` (`src/middleware.ts:37-44`). No route sets `Cache-Control`; the middleware adds `Vary: Cookie, Accept-Language` to HTML (`middleware.ts:46-51`).
- Theme and language are switched client-side through `document.cookie` (`preferences.ts:67`, `TopbarControls.tsx:69-94`); the layout renders `data-theme` from the cookie on the server.
- Network-only actions: "Mark observed" (GET `/log/new`, `logHref` in `load.ts:180-186`), the sky-check answer form (`SkyAnswerForm.astro:37`), every `/log/*`, `/gear/*`, `/onboarding` page and all POSTs.
- Playwright (`playwright.config.ts`) runs one Chromium project, service workers allowed, `baseURL` localhost (a secure context).
- Library check (2026-10-05): `@vite-pwa/astro` 1.2.0 declares `astro ≤5` and pins `vite-plugin-pwa ^1.2`; `vite-plugin-pwa` 2.0.0 declares `vite ^8`, with `workbox-build`/`workbox-window ^7.4.1`. Installed: astro 7.3.2, @astrojs/cloudflare 14.3.1, vite 8.3.0.

## Desired End State

- On Android Chrome the settings popover offers "Install app" (the browser's prompt); on iOS Safari it explains Share → Add to Home Screen; it is hidden once installed. The installed app opens `/tonight` standalone with the star icon.
- Signed in and online, opening any Tonight page stores that page (shell + island) for the site shown, and in the background a "next night" copy of the same page. Each stored site's pages expire 36 h after last refresh.
- Offline (or on a request that times out), opening a stored Tonight page shows it with a warning Notice under the sky: "Offline · prepared Sun 5 Oct, 21:05". After dawn, the next-night copy is shown with "Old forecast from Sun 5 Oct, 21:05 · plan for Mon 6 Oct"; with no next-night copy, the old page shows "This plan is for Sun 5 Oct (prepared 21:05) — the night is over".
- Offline, Mark observed, the sky-check answers, the Log and Gear tabs and sign-out are disabled with "Needs a connection"; any other navigation or POST lands on the Nightfall offline page, which lists the stored Tonight pages.
- Signing out, signing in or signing up, or being bounced to sign-in, empties every stored page.
- Verify: `npm test`, `npx astro check`, `npm run lint`, the new offline e2e spec, and screenshots of the offline states in EN/PL × dark/light/red at 390 px.

### Key Discoveries:

- Island responses can be replayed by exact URL only if stored as a pair with the shell that references them (`encryption.js:58`).
- The shell's `<link rel="preload" as="fetch" href>` gives the service worker the island URL from the shell HTML, so a pair can be recorded when the shell arrives.
- The island must report the *resolved* site (id, name), since the shell may only know a cookie the worker cannot read.
- Each Tonight island already has everything to compute the rollover moment (civil dawn) for its night on the server, so validity needs no astronomy in the browser.
- The lesson "Tonight's content needs JavaScript" (lessons.md) holds: offline replay still runs Astro's island script; no no-JS path is planned.
- The lesson "Put every module that touches site coordinates under the no-console lint" applies to `src/lib/offline/**` and `src/sw.ts` (they handle stored Tonight HTML and site ids).

## What We're NOT Doing

- Logging or answering sky checks offline with later sync (roadmap park, `roadmap.md:294`): they stay disabled offline.
- Computing Tonight on the device: the next-night copy is rendered on the server while online.
- Caching `/log/*`, `/gear/*`, `/onboarding`, `/auth/*` or `/` pages.
- Proactively fetching pages the user never opened (only the next-night twin of a page they opened).
- Re-rendering a stored page in another language: a language switched offline shows stored pages in the language they were prepared in (theme switching does apply, see Phase 4).
- Push notifications, background sync, periodic sync.
- `@vite-pwa/astro` (unsupported on Astro 7) — we use `vite-plugin-pwa` 2 directly.
- Pinning `ASTRO_KEY`: stored pairs replay without the server, so a redeploy's new key does not affect their island URLs. (The hashed `/_astro/*` assets they reference *are* affected by a deploy; Phase 3 keeps them, see Critical Implementation Details.)
- A new brand mark: the icon reuses the Topbar's four-point star.

## Implementation Approach

Workbox via `vite-plugin-pwa` 2 in `injectManifest` mode: our own `src/sw.ts` uses `workbox-precaching` for the built static assets and `workbox-routing` for custom handlers. All decisions the worker makes (cache keys, which copy to serve, expiry, purge triggers, metadata parsing) live as pure functions in `src/lib/offline/` with Vitest tests; `src/sw.ts` is thin wiring. Metadata about stored copies sits in one JSON entry inside the worker's own cache (no IndexedDB dependency). The server's only new responsibilities are the next-night render and embedding the copy's metadata and notices in the island HTML. The page's client script reads the online state and the embedded metadata to show the notice and disable controls.

## Critical Implementation Details

- **Pairing order.** The shell arrives before its island request. The worker records a *pending* pair from the shell's preload href and commits it only when that exact island URL returns 200 `text/html`; a shell whose island never arrived is never served offline. When a pair is committed, the previous pair for the same (site, page, kind) and its island entry are deleted.
- **Which site a navigation means.** `/tonight/plan?site=<id>` means that site; a bare `/tonight/plan` means the site of the most recently committed copy of any page ("last site"), mirroring the remembered cookie. Query params other than `site`/`telescope` (`logged`, `skyChecked`, `error`, `sort`, `night`) are ignored for lookup.
- **Next-night copy must not write.** The `night=next` render must skip the sky-check record and the open sky checks, otherwise the background fetch would record a verdict for a night the user never viewed.
- **Validity is server-computed.** Each copy carries `validUntil` (that night's rollover moment). Offline at time *t*: serve the `tonight` copy if *t* < its `validUntil`; otherwise the `next` copy if one exists and *t* < its `validUntil`; otherwise the `tonight` copy with the stale-night warning.
- **Timeout, not just offline.** At a dark site the network is often present but useless; Tonight navigations and their islands use network-first with a ~4 s timeout before falling back to the stored copy.
- **Stored pages outlive deploys (review F1).** Stored shells and islands reference content-hashed `/_astro/*` CSS, scripts and `client:load` components that a deploy removes from both the server and the new worker's precache. The worker therefore keeps every `/_astro/*` response a Tonight page loads in a runtime cache (`sidereus-assets-v1`), served cache-first (falling back to the precache, then the network), and drops an asset only when no stored pair references it any more (references are parsed from the shell and island HTML at commit time).
- **A stored copy always says so (review F2).** `navigator.onLine` stays true when the ~4 s timeout serves a stored copy, and a navigation has no client to message yet. So whenever the worker answers a navigation from storage it adds `data-from-device` to the shell's `<html …>` tag (a one-occurrence string replace) before returning it. The notice keys off `data-from-device` *or* real offline; disabled controls key off real offline only.
- **What is never stored (review F4, F8).** A shell whose URL carries `logged`, `skyChecked` or `error` (their notices are baked into the island props), any non-200 or redirected response, and any island response without the `data-offline-copy` element (signed out, the island answers 200 with an empty body, `island.ts:35-39`).
- **Cache matching ignores Vary (review F5).** The middleware adds `Vary: Cookie, Accept-Language` to every HTML response, islands included (`middleware.ts:46-51`): strip `Vary` before `put` and `match` with `ignoreVary: true`.
- **One writer for the index (review F8).** The index is read-modify-written by concurrent fetch events (the island, the next-night twin, a preload and a `fetch()` of the same URL): every index mutation goes through one promise queue in `sw.ts`, and `commitPair` is idempotent (committing the same island URL twice is a no-op).
- **Exact Tonight paths (review F10).** `tonightPageOf` matches exactly `/tonight`, `/tonight/targets`, `/tonight/plan`, `/tonight/moon`, `/tonight/planets`, `/tonight/nights` — never the `/tonight/` prefix (`/tonight/all` is a 301). Only then is "an `opaqueredirect` on a Tonight navigation means the sign-in bounce" safe: the middleware's 302 (`middleware.ts:37-44`) is the only redirect those six paths return.
- **Manifest colours are literal hex** (the manifest cannot read CSS tokens); they live in the PWA config outside `src/`, so `no-hardcoded-colors.test.ts` does not scan them. Use the dark theme's `--background`/`--zenith` values and say so in a comment.

## Phase 1: Installable shell

### Overview

Prove `vite-plugin-pwa` 2 builds with Astro 7 + the Cloudflare adapter, then ship the manifest, icons, a minimal Workbox worker (static precache only), its registration, and the "Install app" settings entry.

### Changes Required:

#### 1. Build spike and PWA plugin

**File**: `astro.config.mjs`, `package.json`, `src/sw.ts` (new)

**Intent**: Add `vite-plugin-pwa` 2 (dev deps: `vite-plugin-pwa`, `workbox-*` modules it needs, `@vite-pwa/assets-generator`) to `vite.plugins`, `strategies: "injectManifest"`, `srcDir: "src"`, `filename: "sw.ts"`, `registerType: "autoUpdate"`, `injectRegister: false`, with the worker emitted to the client output so Workers static assets serve `/sw.js` at the root. Verify first that the build emits `dist/client/sw.js` and `dist/client/manifest.webmanifest` and that the precache manifest lists `/_astro/*` assets but no server output. **Fallback** if the plugin cannot target the client output under the Cloudflare build: drop the plugin, bundle `src/sw.ts` with `workbox-build`'s `injectManifest` in a `postbuild` script and write the manifest as a static file in `public/`; record the switch in the plan's phase notes.

**Contract**: `/sw.js` (scope `/`) and `/manifest.webmanifest` served as static assets; precache = built client assets only (`/offline` is server-rendered per locale and theme, so it is stored at runtime, Phase 3). `src/sw.ts` in this phase: `precacheAndRoute(self.__WB_MANIFEST)`, `clientsClaim`, `skipWaiting`.

**Phase 1 outcome (2026-10-05, 52855d4):** the fallback was taken. vite-plugin-pwa 2 never emits under Astro 7: Astro builds through Vite environments under one top-level config with `build.ssr: true`, and the plugin writes the worker only when that flag is off. `scripts/build-sw.mjs` (npm `postbuild`) bundles `src/sw.ts` with a Vite library build and injects the precache manifest with `workbox-build`. The manifest is the static `public/manifest.webmanifest`, and the icons are regenerated by `npm run icons:build` (`pwa-assets.config.mjs`). Later phases extend `src/sw.ts`, and the same script bundles whatever it imports from `src/lib/offline/`.

#### 2. Manifest and icons

**File**: PWA config in `astro.config.mjs` (or `pwa-assets.config.ts`), `public/pwa-icon.svg` (new), generated `public/pwa-*.png`, `public/apple-touch-icon-180x180.png`, `src/layouts/Layout.astro`

**Intent**: Draw the icon from the Topbar's four-point star path (`Topbar.astro:31-33`) in the dark theme's primary ink on its zenith navy, with a maskable variant padded to the safe zone; generate 192/512/maskable/180 px PNGs with `@vite-pwa/assets-generator`. The manifest uses `name` "Sidereus", `start_url` `/tonight`, `display` `standalone`, `scope` `/`, and the dark theme's background/theme colours. The layout links the manifest, the apple-touch-icon and a `theme-color` meta.

**Contract**: Manifest fields above; icon files committed; `Layout.astro` `<head>` gains `<link rel="manifest">`, `<link rel="apple-touch-icon">`, `<meta name="theme-color">`.

#### 3. Worker registration

**File**: `src/layouts/Layout.astro` (inline script) or `src/lib/offline/register.ts` (new)

**Intent**: Register `/sw.js` after `load` in production builds only, and capture `beforeinstallprompt` into a module-level holder so the settings entry can use it later.

**Contract**: Registration skipped when `navigator.serviceWorker` is missing or in `astro dev`; the captured install event is exposed to the `TopbarControls` island via a tiny browser module (e.g. `src/lib/offline/install.ts`: `canPromptInstall()`, `promptInstall()`, `isStandalone()`, `isIosSafari()`).

#### 4. "Install app" in the settings popover

**File**: `src/components/TopbarControls.tsx`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Add an "Install app" item to the settings popover, shown only when not running standalone: with a captured prompt it calls it; on iOS Safari it reveals a short hint ("Tap Share, then Add to Home Screen"); otherwise it is hidden.

**Contract**: New catalogue keys under a new `offline` section (`offline.install.action`, `offline.install.iosHint`); the item uses `Button`/`buttonVariants` and the popover's existing item styling.

#### 5. Lint coverage

**File**: `eslint.config.js`

**Intent**: Add `src/lib/offline/**` and `src/sw.ts` to `gearConfig.files` (lessons.md: modules touching stored Tonight content stay under `no-console`).

**Contract**: Two globs added to `gearConfig.files`.

### Success Criteria:

#### Automated Verification:

- Build emits the worker and manifest: `npm run build` then `ls dist/client/sw.js dist/client/manifest.webmanifest`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Unit tests pass: `npm test`

#### Manual Verification:

- On a local preview, Chrome DevTools → Application shows the manifest with no errors, the icons, and an active service worker at scope `/`
- The settings popover shows "Install app" in Chrome (desktop emulation) and the iOS hint with an iPhone Safari user agent, in EN and PL, at 390 px, in dark/light/red

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Offline-ready Tonight content (server)

### Overview

Teach the Tonight pages to render a next-night copy on request, embed each copy's metadata and its offline notices in the island HTML, and add the `/offline` page.

### Changes Required:

#### 1. Next-night render

**File**: `src/lib/tonight/build.ts`, `src/lib/tonight/load.ts`, `src/lib/tonight/island.ts`

**Intent**: Add a `night?: "tonight" | "next"` option. With `"next"`, the night date is the evening after the one `tonightDateFor(now)` returns; everything else uses the same forecast. The forecast age still uses the real `now`; the time-driven initial selections (Moon slider, live sky frame, plan tile's "First up/Next") are evaluated as at that night's sunset, so they read as the start of the night. `loadTonightFor` passes the option through and, for `"next"`, **forces** `withSkyChecks` off (review F7: `TonightContent.astro:63-68` hard-codes `withSkyChecks: true`, so the override lives in `loadTonightFor`, not in the callers). The view also gains `validUntil`: the night's civil-dawn rollover, which is `planetWindow.end` already computed at `build.ts:742` (the same −6° as `TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG`, `sun.ts:101-105`); with no civil window (polar summer) it falls back to `observingNight(date).end`, where the date changes instead.

**Contract**: `buildTonight(…, options: { …; night?: "tonight" | "next" })`, `TonightIslandLoad.night?: "tonight" | "next"`, `TonightView.validUntil: Date`; default `"tonight"` leaves all current output unchanged (existing tests stay green). New unit tests in `build.test.ts`: a `"next"` build's night date is the following evening and its verdict uses that night's forecast hours; `validUntil` equals the civil dawn after the night; at a polar-summer site (87°N, the S-05 recipe) `validUntil` is the observing night's end.

#### 2. Shells accept `?night=next`

**File**: `src/pages/tonight.astro`, `src/pages/tonight/{targets,plan,moon,planets,nights}.astro`, `src/lib/tonight/requested-gear.ts` (or a sibling helper)

**Intent**: Read `?night=next` (the only accepted value; anything else means tonight) and pass `night` as an island prop. On the dashboard, `TonightContent` skips `skyCheckStore.record` and the sky-check card when `night` is `"next"`.

**Contract**: Shared helper `requestedNight(url): "tonight" | "next"`; islands get a `night` prop; the record call in `TonightContent.astro:85-93` (`recordableVerdict(view)`) and the `pendingCheck(…)` card at `:95` are guarded by `night === "tonight"`.

#### 3. Copy metadata and offline notices in the island HTML

**File**: `src/components/tonight/OfflineCopy.astro` (new), used by `TonightContent.astro` and each `*PageContent.astro`; `src/lib/tonight/build.ts` (view fields); `src/i18n/messages/{en,pl}.ts`

**Intent**: Each island renders, at the top of its content, one element carrying the copy's metadata for the worker and the page script, and three hidden warning `Notice`s with server-formatted text (site time zone, locale): "Offline · prepared {day, time}", "Old forecast from {day, time} · plan for {night}", "This plan is for {night} (prepared {time}) — the night is over". Nothing is visible online.

**Contract**: `<div hidden data-offline-copy data-site-id data-site-name data-night-date data-kind="tonight|next" data-prepared-at data-valid-until data-forecast-fetched-at>`; the Notices carry `data-offline-notice="prepared|old-forecast|stale"` and are `hidden` by default. `validUntil` = `TonightView.validUntil` (Phase 2.1). No coordinates in the attributes. Catalogue keys `offline.notice.prepared`, `offline.notice.oldForecast`, `offline.notice.stale` (parameterised functions of pre-formatted strings).

#### 4. The `/offline` page

**File**: `src/pages/offline.astro` (new), `src/i18n/messages/{en,pl}.ts`

**Intent**: A Nightfall page (sky header `PageHeader` "You're offline", a `Band` "This needs a connection", then a `Band` listing the stored Tonight pages) that the worker serves for any network-only request while offline. Not gated (no user data rendered on the server); the list is filled client-side from the worker's metadata (Phase 3), with an empty state "Nothing saved yet — open Tonight while online".

**Contract**: Route `/offline`, not in `PROTECTED_ROUTES`; a client script asks the worker for the stored copies (`postMessage({ type: "list-copies" })`) and renders links by site name and page title (titles from the catalogue, embedded as a data map in the page). Keys `offline.page.*`. Not precached (review F6: it is server-rendered per locale and theme from cookies, which Workbox cannot revision); the worker stores it at runtime (Phase 3.2).

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new next-night and validUntil (incl. polar) build tests: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- i18n parity holds (part of `npm test`)

#### Manual Verification:

- `/tonight?night=next` and `/tonight/plan?night=next` render the following evening's plan, no sky-check card, and no new `sky_checks` row for that night (checked in local Supabase)
- The island HTML of each Tonight page carries the `data-offline-copy` element with the right site, night, `validUntil` and no coordinates; the notices are hidden online
- `/offline` renders in EN/PL × dark/light/red at 390 px with the empty state

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Service-worker caching

### Overview

Store shell + island pairs per site and page, fetch the next-night twin, serve the right copy offline, expire, purge and fall back to `/offline`.

### Changes Required:

#### 1. Pure offline logic

**File**: `src/lib/offline/copies.ts` (new), `src/lib/offline/copies.test.ts` (new)

**Intent**: Every decision the worker makes, as pure functions over plain data: which Tonight page a URL is (exactly `/tonight`, `/tonight/{targets,plan,moon,planets,nights}`, else none — never a prefix match) and which site it asks for; whether a shell URL may be stored (not with `logged`, `skyChecked` or `error`); the island URL from a shell's HTML (preload href); the copy metadata from island HTML (none → never commit); the `/_astro/*` asset URLs a shell and island reference; marking a served shell (`<html` → `<html data-from-device`); committing a pair into the metadata index (replacing the previous pair, returning the keys to delete); choosing the copy and notice for a navigation at time *t* (the rules in Critical Implementation Details); expiry (36 h since last refresh, per site); "last site".

**Contract**: Types `CopyMeta { siteId; siteName; page; kind; nightDate; preparedAt; validUntil; forecastFetchedAt; shellKey; islandUrl; storedAt }`, `CopyIndex { userScope; lastSiteId; copies: CopyMeta[] }`; functions `tonightPageOf(url)`, `mayStoreShell(url)`, `islandUrlFromShell(html)`, `copyMetaFromIsland(html)`, `assetUrlsIn(html)`, `markFromDevice(html)`, `commitPair(index, meta)` (idempotent per island URL; returns the shell, island and now-unreferenced asset keys to delete), `chooseCopy(index, page, siteId | undefined, now)`, `expire(index, now)`. `CopyMeta` also carries `assets: string[]`. Unit tests cover each rule's boundary (exactly at `validUntil`, exactly 36 h, a shell with no island, an island with no `data-offline-copy`, a repeated commit, a missing next copy, `/tonight/all` and other unknown pages, notice params refused, other query params ignored, an asset shared by two pairs surviving one pair's removal).

#### 2. Worker routes

**File**: `src/sw.ts`

**Intent**: Wire the logic into Workbox:
- Tonight navigations (GET, `tonightPageOf` ≠ none): network-first with a ~4 s timeout. A 200 response whose URL passes `mayStoreShell` is stored as a pending shell; an `opaqueredirect` (the sign-in bounce) triggers a purge and is never stored. Offline/timeout: `chooseCopy` → stored shell passed through `markFromDevice`, else `/offline`.
- `/_server-islands/*` GETs: network-first (same timeout); on 200 `text/html` whose URL matches a pending shell and whose body carries `data-offline-copy`, commit the pair (parse metadata, delete superseded entries, update "last site"), then — if the committed copy is `tonight` and its `next` twin is missing or older than 1 h — fetch `<page>?site=<id>&night=next` and its island in the background and commit them as `kind: "next"`. Offline: stored response by exact URL.
- POSTs to `/api/auth/signin`, `/api/auth/signup`, `/api/auth/signout`: purge every stored copy and the index, then pass through.
- `/_astro/*` GETs: cache-first from `sidereus-assets-v1`, then the precache, then the network; responses requested by a Tonight page are added to `sidereus-assets-v1` and referenced by the pair committed for it (review F1).
- `/offline`: fetched with credentials on `install` and again after each committed pair, stored in `sidereus-tonight-v1` (the user's current locale and theme, review F6).
- Any other navigation or POST that fails at the network: serve the stored `/offline` (if none is stored yet, let the browser's own error show).
- On `activate` and on each committed pair: `expire`, then delete assets no stored pair references.
- `message` handler: `list-copies` returns the index's copies (site name, page, night, kind, preparedAt) to `/offline`.
- Every `put` strips `Vary`; every `match` passes `ignoreVary: true` (review F5). Every index read-modify-write runs through one promise queue (review F8).

**Contract**: Runtime caches `sidereus-tonight-v1` (shells, islands, `/offline` and the index at `/__offline/index.json`) and `sidereus-assets-v1` (the `/_astro/*` files stored pairs reference); Workbox precache for the current build's static assets. The purge empties both runtime caches. Nothing else is cached at runtime.

### Success Criteria:

#### Automated Verification:

- Offline logic unit tests pass: `npm test -- src/lib/offline`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- On a local preview with the forecast fixture: open the dashboard and `/tonight/plan` online, switch DevTools to offline, reload both — they render from the device with styles and the live sky; Cache Storage shows two `tonight` and two `next` pairs, the index, `/offline` and the referenced `/_astro` assets
- Rebuild (new asset hashes) and reload online once so the new worker activates; offline, a pair stored before the rebuild still renders styled with its live sky
- With two sites, open each one's dashboard online; offline, `/tonight?site=<other>` shows the other site, and bare `/tonight` shows the last one opened
- Offline, `/log` and a never-opened Tonight page show `/offline` listing the stored pages
- Signing out (online) empties the cache; signing in as a second user starts empty
- With DevTools' clock override past `validUntil`: the next-night copy is served; with it deleted, the stale copy is served

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Offline state in the page, tests and docs

### Overview

Show the right notice, disable network-only controls offline, keep the theme on stored copies, pin the flow with one e2e spec, and document the contract.

### Changes Required:

#### 1. Offline state script

**File**: `src/lib/offline/page-state.ts` (new, browser), loaded from `src/layouts/Layout.astro`

**Intent**: Keep `data-offline` on `<html>` in step with `navigator.onLine` and the `online`/`offline` events. When an island with `data-offline-copy` is in the document and the page either carries `data-from-device` (set by the worker on any stored shell it serves, review F2) or is offline, reveal the matching notice: `stale` if `Date.now() >= validUntil`, `old-forecast` if `kind = next`, else `prepared`. Also re-check after island insertion (the islands arrive after load, like `hash-scroll.ts`). Disabled controls (4.2) follow `data-offline` only.

**Contract**: `<html data-offline>` (real offline) and `<html data-from-device>` (served from storage) attributes; notices toggled through their `hidden` attribute.

#### 1b. Notice announces on unhide (review F9)

**File**: `src/components/ui/Notice.astro`

**Intent**: The announcement observer (`Notice.astro:35-53`) currently marks a notice announced when it is inserted, even while hidden, so an offline notice revealed later is never read. It must skip notices inside a `hidden` element and announce each one when it becomes visible.

**Contract**: The observer also watches the `hidden` attribute (`attributeFilter: ["hidden"]`); `data-notice-announced` is set only on a visible notice. Existing notices behave as before (pinned by the `/design` 7-state matrix).

#### 2. Disabled controls

**File**: `src/components/tonight/TargetDetails.astro` (Mark observed), `src/components/tonight/PlanetCard.astro`, `src/components/tonight/MoonCard.astro`, `src/components/sky-checks/SkyAnswerForm.astro`, `src/components/TabBar.astro`, `src/components/Topbar.astro`, `src/components/TopbarControls.tsx` (sign-out), `src/styles/global.css`

**Intent**: Mark network-only controls with `data-needs-network`; while `<html data-offline>` is set they look disabled (a `needs-network` utility in `global.css` using existing tokens), get `aria-disabled="true"`, swallow clicks/submits, and expose "Needs a connection" (visually as a caption under the sign-out button and the sky-check form; via `aria-describedby` on links and tabs).

**Contract**: Attribute `data-needs-network` on: Mark observed links, the sky-check answer form, the Log and Gear entries in Topbar and TabBar, the sign-out button. Key `offline.needsConnection`. Focus stays visible on disabled controls.

#### 3. Theme on stored copies

**File**: `src/layouts/Layout.astro` (inline head script)

**Intent**: A stored shell carries the theme it was prepared with; a tiny inline script sets `data-theme` from the readable `sidereus-theme` cookie before paint, so a theme switched offline holds across stored pages.

**Contract**: The repo's first `is:inline` script (processed scripts are deferred modules, too late for paint), so it cannot `import { THEMES }`: pass the list in with `define:vars`. Reads only `sidereus-theme` (set by JS only, not httpOnly, `TopbarControls.tsx:113`); when the cookie is absent or invalid it leaves the server-rendered `data-theme` alone.

#### 4. E2E spec

**File**: `tests/e2e/offline.spec.ts` (new), `playwright.config.ts`, `.github/workflows/ci.yml`

**Intent**: One spec: onboard (`onboardInMadrid`), open the dashboard and `/tonight/plan` online, wait for the worker to control the page and the pairs to be committed, `context.setOffline(true)`, reload both — content renders with the "prepared" notice and Mark observed disabled; navigate to `/log` → offline page listing both pages; go online, sign out, and assert right away (before any Tonight visit, since signing back in lands on `/tonight` and stores it again) that the worker's runtime caches hold no Tonight pairs and no index (`page.evaluate` over `caches`).

**Contract**: Playwright 1.55 applies `setOffline` to a service worker's own fetches only with `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1` (`playwright-core/lib/server/chromium/crServiceWorker.js:44-54`), so the variable is set for the e2e run (in `playwright.config.ts` via `process.env` before launch, and in CI's e2e step), and the spec first asserts that an offline reload is really served by the worker (the `data-from-device` attribute is present). Uses the existing helpers; waits for `navigator.serviceWorker.controller` before going offline; no clock mocking (the stale/next rules are pinned by unit tests).

#### 5. Docs

**File**: `CLAUDE.md`, `context/foundation/lessons.md` (only if a recurring rule emerges)

**Intent**: Document the offline contract: what is stored, `?night=next`, the `data-offline-copy` element every Tonight island must render, `data-needs-network`, the purges, and that a new Tonight page must render `OfflineCopy` and be added to `tonightPageOf`.

**Contract**: A short "Offline (S-06)" paragraph under Architecture and one UI bullet.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- The offline e2e spec passes against a local preview: `npm run test:e2e -- offline`
- The full e2e suite still passes: `npm run test:e2e`

#### Manual Verification:

- Screenshots of a stored dashboard and `/tonight/plan` offline with the prepared notice, the old-forecast notice and the stale notice (clock override), in EN/PL × dark/light/red at 390 px and desktop
- Disabled Mark observed, sky-check form, Log/Gear tabs and sign-out read "Needs a connection" and keep visible focus; contrast passes in all three themes
- A theme switched offline holds across stored pages
- On a real phone (user): install from the settings entry, enable airplane mode, open the installed app → stored Tonight with the notice

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `src/lib/offline/copies.test.ts`: exact page matching, notice params refused, site resolution, island URL and asset extraction, metadata parsing (and its absence), idempotent pair commit/replacement, asset reference counting, `chooseCopy` at the `validUntil` boundary and with a missing next copy, 36 h expiry, last site, `markFromDevice`.
- `build.test.ts`: the `"next"` night option (date, verdict hours, no change to the default) and `validUntil` (civil dawn; polar fallback).

### Integration Tests:

- `tests/e2e/offline.spec.ts`: store online → replay offline → offline page → purge on sign-out/sign-in.

### Manual Testing Steps:

1. Local preview + forecast fixture + local Supabase; open dashboard and plan online; go offline; reload; check notices and disabled controls.
2. Override the clock past `validUntil`; check the old-forecast notice; delete the next copy in DevTools; check the stale notice.
3. Two sites: switch offline between them; bare `/tonight` follows the last site.
4. Sign out, sign in as another user: nothing stored.
5. Real phone install and airplane mode (user).

## Performance Considerations

- The next-night twin doubles island renders, but at most once per page per hour per site and only for pages the user opened; it runs in the background after the visible page.
- Stored HTML is small (tens of KB per pair); 6 pages × 2 kinds × a few sites stays well under any browser quota. The kept `/_astro` assets add roughly one build's client bundle per build still referenced (at most ~2 builds within the 36 h window).
- The ~4 s navigation timeout trades a short wait on a bad connection for never hanging at a dark site.

## Migration Notes

None: no database change. The first deploy installs the worker on the next visit; removing the feature later requires shipping a self-unregistering `sw.js`.

## References

- Roadmap slice: `context/foundation/roadmap.md:206-219` (S-06), MS-06 at `:36`
- Lessons: `context/foundation/lessons.md` (no-console globs; Tonight needs JavaScript)
- Island loading: `src/lib/tonight/island.ts:35-55`, `src/pages/tonight.astro:43`
- Night selection: `src/lib/tonight/build.ts:615`, `src/lib/tonight/tonight-date.ts:9`
- Sky-check record: `src/components/tonight/TonightContent.astro:90-95`
- Sign-out form: `src/components/TopbarControls.tsx:244`; middleware redirect: `src/middleware.ts:37-44`
- Astro islands: `node_modules/astro/dist/core/encryption.js:58`, `node_modules/astro/dist/runtime/server/render/server-islands.js:24,147`
- Plan review: `context/changes/offline-night-plan/reviews/plan-review.md` (F1–F10 applied)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Installable shell

#### Automated

- [x] 1.1 Build emits the worker and manifest — 52855d4
- [x] 1.2 Type check passes — 52855d4
- [x] 1.3 Lint passes — 52855d4
- [x] 1.4 Unit tests pass — 52855d4

#### Manual

- [x] 1.5 DevTools shows a valid manifest, icons and an active worker at scope / — 52855d4
- [x] 1.6 Install entry and iOS hint render in EN/PL × three themes at 390 px — 52855d4

### Phase 2: Offline-ready Tonight content (server)

#### Automated

- [x] 2.1 Unit tests pass, including the next-night and validUntil (incl. polar) build tests
- [x] 2.2 Type check passes
- [x] 2.3 Lint passes
- [x] 2.4 i18n parity holds

#### Manual

- [x] 2.5 night=next renders the following evening with no sky-check card or record
- [x] 2.6 Island HTML carries the offline-copy metadata without coordinates; notices hidden online
- [x] 2.7 /offline renders in EN/PL × three themes at 390 px

### Phase 3: Service-worker caching

#### Automated

- [ ] 3.1 Offline logic unit tests pass
- [ ] 3.2 Type check passes
- [ ] 3.3 Lint passes
- [ ] 3.4 Build passes

#### Manual

- [ ] 3.5 Dashboard and plan replay offline styled; cache holds pairs, index, /offline and assets
- [ ] 3.6 Offline site switching and last-site default work
- [ ] 3.7 Network-only and never-opened pages show /offline with the stored list
- [ ] 3.8 Sign-out and sign-in as another user purge the cache
- [ ] 3.9 Clock past validUntil serves the next copy, else the stale copy
- [ ] 3.10 A pair stored before a rebuild still renders styled with its live sky

### Phase 4: Offline state in the page, tests and docs

#### Automated

- [ ] 4.1 Unit tests pass
- [ ] 4.2 Type check passes
- [ ] 4.3 Lint passes
- [ ] 4.4 Offline e2e spec passes
- [ ] 4.5 Full e2e suite passes

#### Manual

- [ ] 4.6 Offline notice screenshots in EN/PL × three themes, phone and desktop
- [ ] 4.7 Disabled controls read "Needs a connection" with visible focus and AA contrast
- [ ] 4.8 Theme switched offline holds across stored pages
- [ ] 4.9 Real-phone install and airplane-mode check
