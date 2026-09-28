<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Red Night Mode

- **Plan**: context/changes/red-night-mode/plan.md
- **Mode**: Deep (inline verification, no sub-agent)
- **Date**: 2026-09-28
- **Verdict**: SOUND
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding
9/9 paths ✓, 5/5 symbols ✓ (THEMES, isTheme, chooseTheme, derived-token scope `:root, [data-theme]`, `dark:` variant), brief↔plan ✓. Blast radius: no other `Theme` consumers (no `Record<Theme>`, no exhaustive switches).

## Findings

### F1 — Contrast floor measured against --background only

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3 palette, §4 guard test
- **Detail**: Most text sits on `--surface` cards. Planned foreground `#ee0000` is 4.58:1 on `#0a0000` but 4.47:1 on `#170000`, below the promised 4.5.
- **Fix**: Test floors against both `--background` and `--surface`; start foreground at `#f20000`.
- **Decision**: FIXED (applied by agent, delegated per the user's autonomous-flow preference)

### F2 — accent-color targets controls that never render

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 §4, check 2.8
- **Detail**: All radios are `sr-only` (`OnboardingWizard.tsx:641`, `ObservationForm.tsx:235`) and there are no checkboxes. The visible browser-drawn number spin buttons were not covered.
- **Fix**: Drop `accent-color`; add the red-only filter to `::-webkit-inner-spin-button`; audit a hovered number field instead of a checked radio.
- **Decision**: FIXED (applied by agent, delegated)

### F3 — SVG filter on <img> verified in Chromium only

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §3, check 2.8
- **Detail**: `playwright.config.ts` has only a Chromium project; `filter: url(#id)` on HTML content in WebKit (iOS) was unverified.
- **Fix**: Local WebKit screenshot in 2.8; fallback of grayscale + `--primary` multiply overlay on the landing figure if WebKit ignores the filter.
- **Decision**: FIXED (applied by agent, delegated)
