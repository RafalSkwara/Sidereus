<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Offline night plan

- **Plan**: context/changes/offline-night-plan/plan.md
- **Scope**: Phase 1 of 4
- **Reviewed phases**: 1
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Phase 1 was committed as 52855d4. The plan's own fallback was taken: `scripts/build-sw.mjs` runs as npm `postbuild`, and the manifest is static, because vite-plugin-pwa 2 does not emit under Astro 7. The fallback is implemented in full.

Checks that came back clean:

- Nothing per-user is cached. The precache holds only the 39 hashed `_astro` files, and no navigation is intercepted.
- `install.ts` is a single shared chunk, so there is no duplicate `beforeinstallprompt` state.
- `useSyncExternalStore` hydrates without a mismatch.

The automated checks were re-run on the committed tree. Tests: 658 passed, 6 todo. Build outputs are present. Lint and type check were green at the commit.

## Findings

### F1 — Stale vite-plugin-pwa wording; fallback not recorded in the plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/sw.ts:2; plan.md Phase 1
- **Detail**: The `sw.ts` header still says the worker is "built by vite-plugin-pwa in injectManifest mode". The plan asked for the fallback switch to be recorded in the plan's phase notes, but it is only in `change.md`. A Phase 3 implementer reading either file would assume the plugin.
- **Fix**: Point the `sw.ts` comment at `scripts/build-sw.mjs`, and add a short "Phase 1 outcome" note to the plan's Phase 1 section.
- **Decision**: FIXED

### F2 — build-sw.mjs passes silently on a broken build layout

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/build-sw.mjs:25-57
- **Detail**: If Astro's output moves (no `dist/client/_astro`), Vite still writes a `sw.js` and `injectManifest` precaches 0 files, yet the build stays green. The sibling `build-stars.mjs` asserts its counts. The Vite library build also copies `public/` into `dist/client` a second time.
- **Fix**: Exit 1 when `dist/client/_astro` is missing or `count === 0`, and set `publicDir: false`.
- **Decision**: FIXED

### F3 — promptInstall can leave a dead "Install app" entry and an unhandled rejection

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/offline/install.ts:68-77
- **Detail**: `deferredPrompt` is cleared, but listeners are only notified after `userChoice` resolves. While the dialog is open, the entry stays visible and inert. If `prompt()` or `userChoice` rejects, `notify()` never runs, and the caller's `void` leaves the rejection unhandled.
- **Fix**: Call `notify()` right after clearing `deferredPrompt`, and wrap the awaits in try/catch so a rejected prompt is swallowed.
- **Decision**: FIXED

### F4 — The iOS hint also shows in in-app webviews

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/offline/install.ts:45-50
- **Detail**: `isIos()` matches every iOS browser, including Instagram and Gmail webviews. Those have no Add to Home Screen, so the hint misleads there. Chrome and Firefox on iOS 16.4+ can add to the home screen through their own Share menu.
- **Fix**: Show the iOS hint only when the user agent carries a `Safari/` token, which in-app webviews lack. Chrome and Firefox on iOS keep it.
- **Decision**: FIXED

### F5 — `npx astro build` alone ships no service worker

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: package.json:8 (postbuild); CLAUDE.md
- **Detail**: The worker is only built through npm's `postbuild`. A manual hotfix built with `npx astro build` and deployed with `npx wrangler deploy` has no `/sw.js`.
- **Fix**: Add a Tripwire line to CLAUDE.md: always build with `npm run build`, because postbuild bundles `/sw.js`.
- **Decision**: FIXED

### F6 — Every first visit downloads the whole precache (~815 KiB)

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/layouts/Layout.astro (registration on every page); scripts/build-sw.mjs:45
- **Detail**: The worker registers on every page, signed-out landing included. It then precaches all 39 `_astro` files (815 KiB per build-sw's count) in the background.
- **Fix**: Accept it. An installable app warms its assets once per deploy, and the files are the ones the app loads anyway.
  - Strength: Keeps installability on every page, with no extra condition.
  - Tradeoff: A one-off visitor to the landing page pays ~0.8 MB in the background.
  - Confidence: MED — typical PWA practice; landing traffic not measured.
  - Blind spot: Mobile data cost for one-off visitors.
- **Decision**: ACCEPTED — typical PWA warm-up; files the app loads anyway
