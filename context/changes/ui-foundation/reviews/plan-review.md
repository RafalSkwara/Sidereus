<!-- PLAN-REVIEW-REPORT -->
# Plan Review: UI Foundation (F-03)

- **Plan**: context/changes/ui-foundation/plan.md
- **Mode**: Deep (risky claims verified locally, no sub-agent)
- **Date**: 2026-09-26
- **Verdict**: SOUND (after fixes; REVISE before)
- **Findings**: 0 critical · 2 warnings · 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding
- **Paths:** 12/12 ✓.
- **Symbols:** ✓ (`capitalize`, `COMPASS_POINTS`, the `en-GB` formatters in format.ts, and `hover:bg-accent`/`dark:` in button.tsx).
- **Packages:** the `@fontsource-variable/newsreader`, `@fontsource-variable/public-sans` and `@fontsource/ibm-plex-mono` packages exist at 5.3.0.
- **Guard test:** the hex-literal check currently hits only Banner.astro, which Phase 2 retrofits.
- **Brief↔plan:** ✓.

## Findings

### F1 — Brand amber mapped to shadcn `--accent`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §1, Phase 2 §1
- **Detail**: shadcn uses `--accent` as a subtle hover surface. `button.tsx:16,18` applies `hover:bg-accent` to the outline and ghost buttons, so those hovers would turn solid amber.
- **Fix**: The brand amber becomes `--primary`/`--primary-foreground`/`--primary-strong`. `--accent` stays a subtle hover surface, and the kicker and CTA classes use `primary`.
- **Decision**: FIXED (agent-applied, per user's minimal-questions preference)

### F2 — Removing `@custom-variant dark` makes `dark:` follow the OS

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §1
- **Detail**: Tailwind v4's built-in `dark:` variant uses `prefers-color-scheme`. `button.tsx` has several `dark:` classes, which would fire in the light theme on a dark-mode OS.
- **Fix**: Redefine the variant on the theme attribute: `@custom-variant dark (&:where(:root:not([data-theme="light"]), :root:not([data-theme="light"]) *));`
- **Decision**: FIXED

### F3 — English next-night line needs a lowercase level key

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §2
- **Detail**: `format.test.ts:186` expects "— go, …". Reusing the verdict card's capitalised label "Go" would break the promise that English output stays unchanged.
- **Fix**: Add separate `tonight.nextNight.level.{go,marginal}` lowercase keys.
- **Decision**: FIXED

### F4 — No `Vary` header on responses that now vary by cookie and language

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §3
- **Detail**: HTML now depends on `sidereus-theme`/`sidereus-lang` and `Accept-Language`. Nothing caches today, but a future cache would mix visitors' preferences.
- **Fix**: The middleware appends `Vary: Cookie, Accept-Language` to HTML responses.
- **Decision**: FIXED

### F5 — Localised "Home" site name: application point ambiguous

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 §3
- **Detail**: `onboardingInputSchema` hard-codes `site.name = "Home"`, and the plan did not say which layer applies the localised name.
- **Fix**: The schema stops outputting the name. The route passes `messages.onboarding.homeSiteName` into `completeOnboarding(client, input, { siteName })`.
- **Decision**: FIXED
