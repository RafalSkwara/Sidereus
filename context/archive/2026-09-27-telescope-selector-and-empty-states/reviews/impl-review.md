<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Telescope Selector and Empty States

- **Plan**: context/changes/telescope-selector-and-empty-states/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-09-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Plan adherence: every Changes Required item is present (MATCH). One minor adaptation: `TelescopeSelector.astro` reads `Astro.locals.locale`, as `VerdictCard.astro` does, instead of taking a `locale` prop. No unplanned files. Automated criteria 1.1–1.5 and 2.1–2.4 were re-run or evidenced (unit 495 passed, astro check 0 errors, lint 0 errors, build OK, e2e 7 passed locally, PR #41 `ci` + `smoke` green). Manual rows 1.6–1.9, 2.5 and 2.6 are pending the user.

## Findings

### F1 — Tonight shows the night that just ended until local noon

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Success Criteria
- **Location**: src/lib/engine/night.ts:112 (`observingNightDateFor`), used by src/lib/tonight/build.ts:175, src/pages/log/new.astro:41-43, src/lib/observations/store.ts:42
- **Detail**: Found by the user in manual verification: on Sunday 27 September at about 11:10 site time, Tonight was dated "Saturday, 26 September" and showed a dark window (21:20–06:52) that had already ended. This is S-02's deliberate noon-to-noon rule (at 01:30 "tonight" stays the night in progress), not an S-08 regression. Its cost is that every morning shows a finished night. The log shares the rule for its latest allowed night, so Tonight cannot change alone: "Mark observed" would prefill a night the store rejects as future.
- **Fix** (chosen by the user before triage: "when darkness ends"): add a pure engine function giving the evening date of the night Tonight should show. It is the noon-rule night, unless that night's dark window has already ended, in which case it is the next evening; nights without a dark window keep the noon rule. Use it in `buildTonight`, the log form's default and latest night, and the store's future-night check.
  - Strength: fixes the morning view while keeping "tonight" correct after midnight, and Tonight and the log stay consistent.
  - Tradeoff: touches S-02/S-06 code paths and the engine; in the morning, "Mark observed" prefills the coming night, so logging last night means editing the date.
  - Confidence: HIGH — the dark window is already computed for every site, and the rule is a small pure function with fixture-free unit tests.
  - Blind spot: the Workers KV forecast cache is keyed per site and hour, not per night, so no cache impact is expected; not measured.
- **Decision**: FIXED — `tonightDateFor` in the engine, `tonightDateForSite` wrapper; Tonight, log max night and store check use it; tests in sun.test.ts, build.test.ts, tests/db/observations.test.ts

### F2 — Manual check 1.8's "JS disabled" half cannot happen

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Phase 1 Manual Verification / Progress 1.8
- **Detail**: With JavaScript off, the `TonightContent` server island (the whole ranking and selector) never loads, so the dropdown's no-JS "Show" button can only matter when its enhancement script fails. The e2e covers the scripted path (button hidden, select navigates on change).
- **Fix**: Add a one-line note to Phase 1's manual verification saying the no-JS half is unreachable, so 1.8 is satisfied by the scripted path. The Progress title stays unchanged.
- **Decision**: FIXED — note added under Phase 1 Manual Verification (Progress title unchanged)
