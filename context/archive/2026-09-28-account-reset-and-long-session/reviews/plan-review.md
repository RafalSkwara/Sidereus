<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Rolling 30-Day Session and Continue-After-Sign-In

- **Plan**: context/changes/account-reset-and-long-session/plan.md
- **Mode**: Deep (inline verification, no sub-agent)
- **Date**: 2026-09-28
- **Verdict**: SOUND
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding
Paths ✓ (middleware, signin route/page/form, supabase.ts, smoke.mjs, prd/roadmap/tech-stack/CLAUDE.md); symbols ✓ (`isProtectedPath`, `authErrorKey`, `AUTH_NOT_CONFIGURED`, `setAll`, `@supabase/ssr` maxAge override at cookies.js:228-231/468-471); brief↔plan ✓; Progress 9+9 rows map one-to-one.

## Findings

### F1 — `safeNextPath` must return the normalised URL, not the raw string

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §1
- **Detail**: Validating a string and then echoing it back lets encoded or odd-but-valid inputs through unnormalised; returning `url.pathname + url.search` from the parsed URL removes that class.
- **Fix**: Contract now says "returns the parsed URL's pathname + search, never the raw input", with a percent-encoded test case.
- **Decision**: FIXED (applied by agent, delegated per the user's autonomous-flow preference)

### F2 — Stale line references

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis, Phase 1 §2
- **Detail**: The middleware redirect is at `src/middleware.ts:38` (block 36-40), not 31; sign-in errors are at `signin.ts:13` and `:18`.
- **Fix**: References corrected.
- **Decision**: FIXED
