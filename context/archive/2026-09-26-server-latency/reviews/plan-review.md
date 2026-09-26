<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Server latency and /tonight loading state

- **Plan**: context/changes/server-latency/plan.md
- **Mode**: Deep
- **Date**: 2026-09-26
- **Verdict**: SOUND
- **Findings**: 0 critical 1 warning 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding
13/13 paths ✓. 6/6 symbols ✓: getClaims, cfContext, the server-island route, the traces/placement schema, AbortSignal combinators and the global.fetch option. brief↔plan ✓.

## Findings

### F1 — A failed island request leaves the skeleton pulsing forever

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Skeleton fallback; brief Open Risks
- **Detail**: Astro's `replaceServerIsland` returns without touching the page on a non-200 status, a non-HTML response or a network error, so the fallback stays. The plan named the deploy-window key mismatch but said it "recovers on reload" without giving the user any way to find that out.
- **Fix A ⭐ Recommended**: A CSS-delayed (~10 s) "taking longer than usual — Reload" hint inside the skeleton, with no JS
  - Strength: Covers every failure mode cheaply.
  - Tradeoff: May flash just before a very slow but healthy load lands.
  - Confidence: HIGH — the replacer removes the whole fallback on success.
  - Blind spot: None significant.
- **Fix B**: A stable ASTRO_KEY secret for build and CI
  - Strength: Removes the deploy mismatch at its root.
  - Tradeoff: Does not cover network or 5xx failures; adds a secret.
  - Confidence: MED — CI wiring unverified.
  - Blind spot: Key rotation reintroduces the window.
- **Decision**: FIXED (Fix A)

### F2 — The 5 s Supabase timeout also covers sign-in, sign-up and gear writes

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Supabase client timeout
- **Detail**: An aborted call has no `error.code`, so it falls through to the generic keys; the plan did not say so.
- **Fix**: State the scope, and that no new handling is needed, in Phase 1 §3.
- **Decision**: FIXED
