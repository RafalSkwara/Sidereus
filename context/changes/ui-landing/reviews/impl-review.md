<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Landing page in Nightfall, signed-out only

- **Plan**: context/changes/ui-landing/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION (before triage); all findings triaged below
- **Findings**: 0 critical, 2 warnings, 5 observations
- **Reviewer**: a separate read-only review agent (drift + safety/pattern/UI), triaged by the implementing agent (autonomous run)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (P3.1 drift justified and amended in the plan) |
| Scope Discipline | PASS (CTA `size: "lg"` is a benign extra) |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING (F1) |
| Success Criteria | WARNING (F2: a contrast pair had no floor) |

Automated criteria re-run after triage: `npm run lint` (0 errors, 2 pre-existing warnings in `determinism.test.ts`), `npx astro check` (0 errors), `npm test` (63 files, 648 passed, 6 todo), e2e `landing.spec.ts` + `red-night-mode.spec.ts` against the 4324 preview (3 passed), `npm run smoke` (all steps passed). Red-mode pixel audit of `/` at 390 and 1280 px: max green 0, max blue 0.

## Findings

### F1 — CLAUDE.md still says Welcome renders TabBar

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: CLAUDE.md (Architecture → Layout paragraph)
- **Detail**: The Layout paragraph lists `Welcome` among the shells that render `Topbar` and `TabBar`; Welcome no longer renders TabBar.
- **Fix**: State it in the landing rule (the Layout paragraph is shared with three concurrent passes, so it is left untouched).
- **Decision**: FIXED — the "Landing" bullet now says it renders the Topbar but no `TabBar`.

### F2 — Buttons on the sky have no pinned contrast floor

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/styles/contrast.test.ts:70-85; src/components/Welcome.astro (CTAs in `TonightSky`)
- **Detail**: The outline CTA's border (`primary`) and the focus ring (`primary-strong`) over `zenith`/`horizon` were not in the floors; the landing is the first view with buttons on the sky.
- **Fix**: One `CHECKS` row: `primary` and `primary-strong` on `zenith`/`horizon`, floor 3, in all three themes.
- **Decision**: FIXED — row added; passes; break-check (red `--horizon` set to `#ee0000`, worktree only) turned it red, restored.

### F3 — The redirect carries no `Cache-Control: private`

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/pages/index.astro:7
- **Detail**: Session-dependent 302 without `Vary`/`Cache-Control`. Harmless today (Worker responses are not edge-cached).
- **Fix**: Optionally `Cache-Control: private, no-store`.
- **Decision**: SKIPPED — the app's other session-dependent redirects (`/onboarding` → `/tonight`, gated pages → sign-in) do the same; a caching rule would be its own change across all of them.

### F4 — Two "Sign in" links signed out (Topbar + outline CTA)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality (a11y)
- **Location**: src/components/Topbar.astro:56-67, src/components/Welcome.astro
- **Detail**: Same name and href twice in a link list.
- **Fix**: Accept, or drop the outline CTA.
- **Decision**: ACCEPTED — the hero pair is the landing's decision point and the Topbar link is shared navigation; listed under "Visual choices for review" in the PR.

### F5 — `<ol>`/`<ul>` lose list semantics in Safari with `list-style: none`

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality (a11y)
- **Location**: src/components/Welcome.astro (steps `ol`, verdict `ul`)
- **Detail**: VoiceOver drops list semantics for unstyled lists.
- **Fix**: `role="list"`.
- **Decision**: DISMISSED — tried; the repo's lint forbids it (`astro/jsx-a11y/no-redundant-roles`, 2 errors), and every ruled list in the app (`/gear`, Tonight tiles) is a plain list. A repo-wide decision, not this view's.

### F6 — Redirect test only checks the final URL

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Success Criteria
- **Location**: tests/e2e/landing.spec.ts
- **Fix**: Also `page.request.get("/", { maxRedirects: 0 })` → 302 `Location: /tonight`.
- **Decision**: FIXED.

### F7 — Logo click costs signed-in users a redirect hop

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Architecture
- **Location**: src/components/Topbar.astro:27
- **Detail**: The logo links to `/`, which now 302s a signed-in user to `/tonight`.
- **Fix**: Point the logo at `/tonight` when signed in.
- **Decision**: SKIPPED — Topbar is shared with the auth and gear shells while three other passes run; recorded as a follow-up (`follow-ups/review-fixes.md`).
