# Parallel E2E Flakes Implementation Plan

## Overview

Make the e2e suite pass reliably with parallel workers (GitHub #45) by fixing the root cause: tests start typing and clicking before React has actually hydrated the island they target.

## Current State Analysis

- **Reproduced 2026-09-28:** `npx playwright test --repeat-each 4 --workers 5` on a local preview → **3 of 48** runs failed, all passing serially:
  - 2× `onboardInMadrid` (`tests/e2e/helpers.ts:64`) waiting 120 s for the stubbed "Madrid, Madrid, Spain" result (observation-log-management, seven-night-planner).
  - 1× `observation-log-management.spec.ts:86`: no option in the log form's object picker within 5 s.
- **Diagnosis:** the saved page snapshot (`test-results/…/error-context.md`) shows the search box holding "Madrid" with an **empty** status line. The island's `searchStatus` never left `idle`, so `changeQuery` never ran (`src/components/onboarding/OnboardingWizard.tsx:242-268`). The typed input was lost, not the geocoding reply (the 3000 ms `GEOCODING_TIMEOUT_MS` would have shown "failed").
- **Why:** `waitForHydration` (`tests/e2e/helpers.ts:28-30`) waits for Astro to drop the island's `ssr` attribute. Astro drops it right after calling React's `hydrateRoot`, and React 19 hydrates concurrently, so there is a window where the DOM is interactive but React has not attached the component. Under CPU load (5 workers plus the preview) the window widens and a `fill` or `click` in it is lost. The same mechanism explains the issue's other evidence: a delete click before hydration submits the form natively without the confirm dialog, so `waitForEvent("dialog")` hangs.
- React marks each DOM element it has hydrated with an own `__reactProps$<random>` key (`react-dom-client`, `internalPropsKey`), written bottom-up. So the key on the target form means its whole subtree is hydrated.
- `tests/e2e/landing-screenshot.spec.ts:37-39` has its own copy of the weak check. `tests/e2e/red-night-mode.spec.ts:16` checks the bare `astro-island[ssr]`.
- Housekeeping found on the way: `helpers.ts` has a duplicated doc comment on `signUp` (left by S-09).

## Desired End State

`waitForHydration(page, selector)` resolves only after React has hydrated the element matching `selector`. Every e2e wait for an island uses it. The suite passes `--repeat-each 4 --workers 5` twice in a row with **0 failures** (96 runs), and passes serially as before.

## What We're NOT Doing

- Changing product code (the islands behave correctly for real users, who don't type within milliseconds of load under a 5-worker CPU storm).
- Raising timeouts or adding retries to hide the race.
- Changing CI's `retries: 1` or worker count.

## Implementation Approach

One phase: strengthen the helper, use it everywhere, verify with repeated parallel runs. Test infrastructure only.

Delegated decisions (agent, open to challenge in review):
- Detect hydration via React's `__reactProps$` DOM key, polled with `expect.poll`. It's an internal name, but it's been stable across React 16–19. A behavioural probe (type and retry) would mask real failures.
- Keep the `ssr`-attribute wait as a first step (cheap, and it documents the Astro side), then wait for the props key.

## Phase 1: Wait for real hydration

### Changes Required:

#### 1. Hydration helper

**File**: `tests/e2e/helpers.ts`

**Intent**: `waitForHydration` also waits until the first element matching the selector carries React's props key, and its doc comment explains why the `ssr` attribute alone is not enough. Remove the duplicated `signUp` doc comment.

**Contract**: `waitForHydration(page: Page, selector: string): Promise<void>` (parameter renamed from `formSelector`; call sites unchanged).

#### 2. Other hydration waits

**File**: `tests/e2e/landing-screenshot.spec.ts`, `tests/e2e/red-night-mode.spec.ts`

**Intent**: The landing capture imports the shared helper instead of its private copy. The red-night-mode spec waits for the theme switch group itself (`[role="group"][aria-label="Theme"]`, via `en.preferences.theme`).

**Contract**: no local `waitForHydration` definitions remain under `tests/e2e/`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Parallel stress run passes twice with 0 failures: `BASE_URL=http://localhost:4321 npx playwright test --repeat-each 4 --workers 5` (run 2×)
- Serial suite still passes: `BASE_URL=http://localhost:4321 npx playwright test --workers=1`

#### Manual Verification:

- Deliberate break: with the helper reverted to the `ssr`-only check, the same stress run shows failures again (demonstrates the fix is what removes them).

---

## References

- GitHub #45; S-07 impl review F6 (`context/archive/2026-09-27-observation-log-management/reviews/impl-review.md`)
- `node_modules/react-dom/cjs/react-dom-client.production.js:1010-1011` (`__reactFiber$` / `__reactProps$` keys)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Wait for real hydration

#### Automated

- [x] 1.1 Type check passes — 9bfb48f
- [x] 1.2 Lint passes — 9bfb48f
- [x] 1.3 Parallel stress run passes twice with 0 failures — 9bfb48f
- [x] 1.4 Serial suite still passes — 9bfb48f

#### Manual

- [x] 1.5 Deliberate break brings the failures back — 9bfb48f
