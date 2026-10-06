<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Offline night plan

- **Plan**: context/changes/offline-night-plan/plan.md
- **Mode**: Deep
- **Date**: 2026-10-05
- **Verdict**: REVISE
- **Findings**: 3 critical, 6 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

8/9 paths ✓ (SkyAnswerForm lives in `src/components/sky-checks/`), 6/6 symbols ✓, brief↔plan ✓. The next-night render was verified as feasible: everything follows `date`, and the forecast spans 8 days.

## Findings

### F1 — Stored pages break after any deploy

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 3 (worker routes); What We're NOT Doing (ASTRO_KEY)
- **Detail**: Stored shells and islands reference hashed `/_astro/*` CSS and scripts and the `client:load` components. After a deploy, the new worker's precache cleanup removes the old hashes, and the server no longer has them either. Pages stored before the deploy then replay offline unstyled and without TonightSkyView or MoonTimeSlider.
- **Fix A ⭐ Recommended**: Keep a runtime cache of the `/_astro/*` assets that stored pages reference. Serve them cache-first, and expire each asset with the last pair that references it.
  - Strength: Stored pages replay intact across any number of deploys.
  - Tradeoff: Up to two builds' assets can sit on the device for 36 h.
  - Confidence: HIGH — the assets are content-hashed, so a cached copy is always correct.
  - Blind spot: The asset size per build is not measured; expected to be a few hundred KB.
- **Fix B**: Throw away stored pairs when a new worker activates.
  - Strength: Simplest, and a broken replay can never happen.
  - Tradeoff: An afternoon deploy wipes the plan the user loaded for tonight.
  - Confidence: HIGH
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A)

### F2 — No offline notice when the stored copy is served after a timeout

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 4.1
- **Detail**: The notice depends on `navigator.onLine === false` or a message from the worker. When the ~4 s timeout serves the stored copy, `onLine` is still true. A `postMessage` sent during the navigation also has no client to receive it. The stored plan would then show with no "prepared at" notice.
- **Fix**: When the worker serves a stored shell, it adds `data-from-device` to the shell's `<html>`. The notice shows when that attribute is present or the browser is offline. Disabled controls follow the real offline state.
  - Strength: The marking is synchronous and needs no messaging.
  - Tradeoff: A one-line string replace on HTML the worker serves.
  - Confidence: HIGH
  - Blind spot: None significant.
- **Decision**: FIXED

### F3 — The offline e2e test would not actually test offline

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4.4
- **Detail**: In Playwright 1.55, `setOffline` does not reach the service worker unless `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1` is set (`crServiceWorker.js:44-54`). The spec's "sign back in → /tonight shows offline page" step also recaches /tonight on the post-sign-in landing.
- **Fix**: Set the variable for the e2e run in the config and in CI. Assert the cache is empty right after sign-out, before any Tonight visit.
- **Decision**: FIXED

### F4 — A stored "Logged M31" notice replays forever

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3.2
- **Detail**: The `?logged`, `?skyChecked` and `?error` notices are encrypted island props (`tonight.astro:22-43`, `targets.astro:45-53`). After Mark observed, `/tonight?logged=…` would become the stored copy.
- **Fix**: Never store a shell whose URL carries `logged`, `skyChecked` or `error`.
- **Decision**: FIXED

### F5 — `Vary: Cookie, Accept-Language` makes stored lookups miss

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3.2
- **Detail**: The middleware adds Vary to every HTML response, island responses included (`middleware.ts:46-51`). Cache `match` honours Vary.
- **Fix**: Match with `ignoreVary: true` and strip Vary before `put`.
- **Decision**: FIXED

### F6 — `/offline` can't be precached as written

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2.4, Phase 3.2
- **Detail**: `/offline` is an SSR route whose locale and theme come from cookies. Workbox cannot revision it, and a precached copy is frozen in one language.
- **Fix**: The worker fetches `/offline` on install and again on each committed pair, and keeps it as a runtime entry in the user's current locale and theme.
  - Strength: The page is always in the user's language, using a pattern already in the plan.
  - Tradeoff: Before the first stored visit, offline shows the install-time copy.
  - Confidence: HIGH
  - Blind spot: None significant.
- **Decision**: FIXED

### F7 — Next-night render: three details the plan gets wrong

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2.1–2.3
- **Detail**:
  - TonightContent hard-codes `withSkyChecks: true` (`:63-68`), so `"next"` must override it.
  - `validUntil` should be `planetWindow.end`: the same −6° window, already computed at `build.ts:742`.
  - With no civil window (polar summer), `validUntil` must fall back to `observingNight(date).end`.
- **Fix**: Spell out all three in Phase 2, and add a polar unit test.
- **Decision**: FIXED

### F8 — Index updates race, and empty islands would be committed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3.1–3.2
- **Detail**:
  - The JSON index is read-modify-written by concurrent fetch events: the island, the next-night twin, and the possible preload-plus-fetch duplicates.
  - Signed out, the island answers 200 with an empty body (`island.ts:35-39`).
- **Fix**:
  - Serialise index mutations through one queue in sw.ts.
  - Make the commit idempotent.
  - Commit only island HTML that carries `data-offline-copy`.
- **Decision**: FIXED

### F9 — Notice announces the hidden offline notices too early

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4.1
- **Detail**: The observer in `Notice.astro:35-53` marks the hidden notices announced when they are inserted. Unhiding them later never reaches screen readers.
- **Fix**: Make Notice's observer skip `hidden` notices and announce each one when it is unhidden, by watching the `hidden` attribute.
- **Decision**: FIXED

### F10 — Small precision gaps

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phases 3.1, 4.2, 4.3
- **Detail**:
  - `tonightPageOf` must match the six paths exactly, never by prefix, because `/tonight/all` is a 301. That exact match is what makes the "opaqueredirect ⇒ sign-in bounce" rule safe.
  - The SkyAnswerForm path is wrong in the plan.
  - The theme script is the repo's first `is:inline` script. It cannot import THEMES, and it must do nothing when the cookie is absent.
- **Fix**: Correct all three in the plan text.
- **Decision**: FIXED
