<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Tonight as a dashboard of focused pages

- **Plan**: context/changes/tonight-dashboard/plan.md
- **Mode**: Deep (claims verified locally)
- **Date**: 2026-10-04
- **Verdict**: REVISE → SOUND after fixes
- **Findings**: 1 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

8/8 paths ✓, 5/5 symbols ✓, brief↔plan ✓, Progress 28/28 rows ✓

## Findings

### F1 — The log form never posts `from` outside manual mode

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 1 §3
- **Detail**: `ObservationForm.tsx:137` writes the hidden `from` field only in manual mode, and `log/new.astro` passes only `mode`. A `?from=moon` link would be dropped before `POST /api/log`, so every save would return to `/tonight`. ObservationForm.tsx was missing from the plan.
- **Fix**: Add ObservationForm.tsx to Phase 1 §3. The page passes the parsed `from` as `returnTo`, and the form posts the hidden field for any valid value; the `manual` checks stay `=== "log"`.
- **Decision**: FIXED

### F2 — When `logHref`'s `from` starts flowing is undecided

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §3 contract; Phase 2 §2
- **Detail**: The contract read as if `from` were required, while the dashboard's detail bands stay until Phase 4. They could send saves to pages the user never saw.
- **Fix**: `from` is optional. The dashboard never passes it; only the new page islands do.
- **Decision**: FIXED

### F3 — The Moon and Planets "no card" states are misdescribed; the skeleton reload link is missing

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §1, §4; Phase 2 §1
- **Detail**:
  - `moonCard` is null only when the build fails (build.ts:716).
  - `solarSystem` is null when the planet gate is null (build.ts:583, :631), and `noneText` lives inside it.
  - TonightSkeleton's reload link is hard-coded to /tonight (TonightSkeleton.astro:71-76).
- **Fix**: Two copy keys for the null sections, and a `reloadHref` prop on TonightPageSkeleton.
- **Decision**: FIXED

### F4 — Criterion 4.2's grep misses the variable href

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4, Automated 4.2
- **Detail**: The anchors are assigned through `targetsHref = … "#ranking"`, which `href="#` never matches.
- **Fix**: Grep for the quoted anchor strings across `src/components/tonight/`.
- **Decision**: FIXED
