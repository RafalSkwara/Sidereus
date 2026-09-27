<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Telescope Selector and Empty States

- **Plan**: context/changes/telescope-selector-and-empty-states/plan.md
- **Mode**: Deep
- **Date**: 2026-09-27
- **Verdict**: SOUND (after fixes: SOUND, all PASS)
- **Findings**: 0 critical, 0 warnings, 1 observation
- **Previous pass (same day)**: F1 "dropdown is a client island inside a server island" was fixed via Fix A: the dropdown is a plain Astro GET form with a script enhancement, and the e2e covers the 4+ dropdown. This pass reviews the revised plan.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding
8/8 paths ✓, symbols ✓, brief↔plan ✓ (no leftover React-island references), Progress 15/15 rows ✓, no checkboxes outside Progress ✓

## Findings

### F1 — E2E walks through the stale-cookie fallback without asserting it; end-state "Verify" line omits the dropdown

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Desired End State ("Verify:" bullet); Phase 2 §3 e2e contract
- **Detail**: The spec picks the third telescope in the dropdown, which sets the cookie, and then deletes the third and fourth. The next Tonight load therefore runs on a cookie pointing at a deleted telescope, which is the fallback case in manual step 1.7. The plan does not assert what happens there, so the one automated pass through that path proves nothing. The Desired End State "Verify" line also still lists only the pre-review walk (no dropdown).
- **Fix**: After "delete the third and fourth", add "→ Tonight falls back to the oldest telescope (its pill is `aria-current`, no error)". Add "switch by pill and by dropdown" to the Verify line.
- **Decision**: FIXED — fallback assertion added to the Phase 2 §3 e2e contract; Verify line updated
