<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: All Tonight's Objects

- **Plan**: context/changes/tonight-all-objects/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-09-29
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Diff matches the plan: `limit` on `rankObjects` (default unchanged), `rank`/`bestAt` on entries, `sortEntries`/`parseSort`, shared `loadTonight`, `/tonight/all` shell + `AllObjectsContent` island + `ObjectRow`, shared `ObjectDetails`, Tonight's two links, `src/pages/tonight/**` in the coordinate lint. Only ids travel in URLs (log links), never coordinates. Evidence: 643 unit tests, 0 type errors, lint 0 errors, build, e2e 15/15 with 5 workers; Tonight's top five byte-identical before/after the loader refactor; 36 screenshot views with no overflow; red audit 12/12; overcast empty state verified.

## Findings

### F1 — Unplanned small refactors

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/tonight/ObjectDetails.astro, src/lib/tonight/requested-gear.ts
- **Detail**: Card details and the site/telescope request handling were extracted so the new page reuses them instead of copying; Tonight's output is unchanged (verified byte-identical).
- **Fix**: None needed.
- **Decision**: ACCEPTED

### F2 — Empty state prefixes the verdict level

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/tonight/AllObjectsContent.astro
- **Detail**: `verdictText` is the reason only ("too cloudy: …"), so the empty state shows "No-go — too cloudy: …", matching Tonight's verdict card.
- **Fix**: None needed.
- **Decision**: ACCEPTED
