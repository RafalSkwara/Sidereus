<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Seven-Night Planner and Site Switching

- **Plan**: context/changes/seven-night-site-planner/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-09-27
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 6 observations
- **Triage mode**: autonomous. The user was asleep and delegated every decision ("do a review and make your own recommended amendments"); each decision below records the agent's reasoning for the user to confirm.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Evidence

- Drift: all 18 planned items (Phase 1 §1-7, Phase 2 §1-5, Phase 3 §1-7) MATCH their contracts, including plan-review F1-F7. Known adaptations (moonLine signature, `nights.timesIn`, Intl comma in Polish dates, null `reasonText` on no-darkness nights, corrected DST assertion, "Stanowisko", `requestedGear()`, kept `tonight.selector`) were checked and hold. No "What We're NOT Doing" item was violated.
- Safety: site/telescope names render escaped only; the `sidereus-site` cookie is uuid-checked on write and read, httpOnly, SameSite=Lax, Secure on https, and resolved only against the user's RLS-scoped sites; island props carry ids only; coordinates reach only the Open-Meteo request; new files sit under the no-console globs (lesson 1); engine purity holds; old 4-day cache entries still parse and degrade to "No cloud outlook yet".
- Automated criteria on HEAD 8eee754: `npm test` 611 passed / 6 todo, `npx astro check` 0 errors, `npm run lint` 0 errors (4 older console warnings in test files), `npm run build` OK; e2e (10 passed, 1 opt-in skip) and smoke passed on identical source at df25c24.
- Manual criteria: all rows `[x]` with evidence (user confirmation, screenshots, `change.md` notes for 3.7 and 3.9); none rubber-stamped.

## Findings

### F1 — Nights 2-3 computed twice on a weather no-go; strip adds ~1.5 ms CPU

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (performance)
- **Location**: src/lib/tonight/build.ts:236 (`nextNightNotNoGo`), src/lib/engine/outlook.ts:141-162
- **Detail**: `sevenNightOutlook` costs ~1.3-1.7 ms warm (seven `darkWindow` bisections at ~0.13 ms each; moon searches ~0.05 ms per night) against ~0.15 ms for the single night it replaced. On a weather no-go `nextNightNotNoGo` then recomputes nights 2-3's dark windows and verdicts, which the outlook already holds. infrastructure.md sets the Workers free-plan cap at 10 ms per request and a warm Tonight p95 above 8 ms as the upgrade trigger; the ranking already uses most of it.
- **Fix**: Derive the FR-020 "next night" from the outlook's nights 2..VERDICT_NIGHTS with a pure engine helper that mirrors `nextNightNotNoGo` (stop at the first no-weather-data night, return the first night that is not a no-go), pinned by an equivalence test against `nextNightNotNoGo`; keep the production CPU watch as the plan's post-merge task.
  - Strength: Removes the only duplicated verdict computation, and the no-go text and the strip chips then come from one value, like the card and night 1.
  - Tradeoff: A second implementation of the same walk exists until `nextNightNotNoGo` is retired; the equivalence test holds them together.
  - Confidence: HIGH — the walk is 15 lines over data the outlook already carries.
  - Blind spot: The larger cost (seven bisections) remains; only production `cpuTime` shows whether it matters.
- **Decision**: FIXED — agent decision under delegation: cheap, removes duplication and a possible disagreement between strip and explanation.

### F2 — "Works without JavaScript" claim is false inside Tonight's server island

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/GearSelector.astro:1-3
- **Detail**: The component comment says pills and dropdown "both work without JavaScript", and plan row 3.7 (like S-08 before it) planned a JS-off check. Tonight's data is an Astro server island (`server:defer`, since the server-latency change) that a script fetches, so with JS off the page stays on its skeleton (verified, `change.md` note 3.7). Pre-existing on `main`; recurring (S-08, S-05).
- **Fix**: Reword the comment to say the controls need no client script of their own but live inside the JS-loaded island; record a lesson so plans stop promising no-JS behaviour inside the island; queue a no-JS fallback for Tonight as a follow-up.
- **Decision**: FIXED + ACCEPTED-AS-RULE: Tonight's content needs JavaScript (server island) — agent decision under delegation; the lesson entry is new and should be confirmed by the user.

### F3 — Strip length hard-coded as 7 outside parameters.ts

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/TonightSkeleton.astro:44, src/i18n/messages/en.ts:382-383, src/i18n/messages/pl.ts:394-395
- **Detail**: The skeleton rows and the heading/jump-link messages repeat 7, while CLAUDE.md keeps the PRD's numbers in `parameters.ts` (`OUTLOOK_NIGHTS`).
- **Fix**: Build the skeleton rows from `OUTLOOK_NIGHTS` (island-safe import from `@/lib/engine/parameters`) and pass the count to `heading` / `jumpLink` as a pre-formatted param.
- **Decision**: FIXED — agent decision under delegation.

### F4 — Outage fallback shows nights 4-7 cloud numbers from a stale copy

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/lib/engine/outlook.ts:159, src/lib/tonight/build.ts:224-231
- **Detail**: When the refresh fails, the saved copy (up to 7 days old) feeds the outlook's cloud numbers; only the page-level forecast status line flags the age. Nights 1-3 are already capped at marginal with a "could not be refreshed" reason.
- **Fix**: Accept: the status line already carries the age, and an old copy mostly fails to span nights 4-7 and reads "No cloud outlook yet" anyway.
- **Decision**: ACCEPTED — agent decision under delegation: honest degradation already in place; revisit if users misread it.

### F5 — A throw on any of the seven nights blanks the whole Tonight view

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/lib/engine/outlook.ts:144-161, src/components/tonight/TonightContent.astro:108-127
- **Detail**: `darkWindow` (bisection) or `SearchAltitude` can throw; TonightContent's catch turns any throw into `tonight.failed`, so a failure on night 6 now also hides the verdict and ranking. Reachability is low (none seen across the test corpus and e2e).
- **Fix**: Accept for now; if it ever shows, build the strip in its own try so only the strip degrades.
- **Decision**: ACCEPTED — agent decision under delegation.

### F6 — Site selector also requires a telescope

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/tonight/TonightContent.astro:156
- **Detail**: The plan gates the site selector on two or more sites; the code also requires a telescope, as the telescope selector always did. With no telescope Tonight shows the add-telescope prompt and no verdict or strip, so there is nothing to switch.
- **Fix**: None; the behaviour is right.
- **Decision**: DISMISSED — agent decision under delegation: intended, nothing to switch without a view.

### F7 — Dark-span dash joined in the formatter, not a message key

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/tonight/format.ts:310
- **Detail**: `darkSpanText` joins two times with a literal en dash, while the verdict card uses `darkFrom` / `darkTo` keys; ObjectCard joins its window times the same literal way.
- **Fix**: None needed; an en dash between two 24-hour times is locale-neutral in English and Polish.
- **Decision**: SKIPPED — agent decision under delegation.

### F8 — No iteration cap on the moon crossing loop

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/lib/engine/moon.ts:81-113
- **Detail**: Termination is sound (roots stay inside the limit, direction flips after each crossing, `null` ends the loop), so a cap would only be belt-and-braces and could hide a real bug by truncating silently.
- **Fix**: None.
- **Decision**: SKIPPED — agent decision under delegation.

## Triage summary

Autonomous triage (user asleep, decisions delegated), 2026-09-28.

| Outcome | Findings |
|---|---|
| Fixed | F1, F3 |
| Fixed + rule | F2: lesson "Tonight's content needs JavaScript: never plan no-JS behaviour inside the server island" added to `context/foundation/lessons.md` |
| Accepted | F4, F5 |
| Dismissed | F6 |
| Skipped | F7, F8 |

Follow-ups queued in `context/changes/seven-night-site-planner/follow-ups/review-fixes.md`: a no-JS fallback for Tonight (its own change), the production CPU check after merge, and strip failure isolation if a throw is ever seen.

Verification after fixes: `npm test` 612 passed / 6 todo (new equivalence test `nextNightInOutlook` ≡ `nextNightNotNoGo` over 8 scenarios, break-checked red), `npx astro check` 0 errors, `npm run lint` 0 errors, `npm run build` OK, e2e 10 passed / 1 opt-in skip, `npm run smoke` passed. Everything ran against local Supabase and the forecast fixture.
