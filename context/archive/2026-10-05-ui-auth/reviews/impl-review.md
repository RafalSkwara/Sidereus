<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth views in Nightfall

- **Plan**: context/changes/ui-auth/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-05
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

Two read-only reviewers: plan drift (every planned change MATCH, nothing missing or extra, auth behaviour unchanged: routes, `?error=` → `serverError`, `safeNextPath` / `next`, form ids, names and actions) and safety/pattern (XSS, red theme, headings, i18n parity, the GearShell pattern, Notice versus e2e). Gates re-run after the triage fixes: lint 0 errors, astro check 0, vitest 648 passed / 6 todo; e2e (23 passed, 2 skipped) and smoke passed on the reviewed code before the F2 class-only change.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Eye button covers 4 px of the input's text padding

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/auth/PasswordToggle.tsx:15 with src/components/forms/FormField.tsx:83 (`endContent && "pr-10"`)
- **Detail**: The button is now 44 px wide (`w-11`) and the input reserves 40 px. Typed text can reach 4 px under the button's transparent edge. It never reaches the icon, which sits 14–30 px from the right. A click in that strip toggles visibility instead of placing the caret.
- **Fix**: Change FormField's end padding to `pr-11`.
- **Decision**: DEFERRED. The fix edits the shared `FormField`, which the log and onboarding passes running alongside this one also use. The effect is a 4 px click strip with no visible overlap. It is worth a one-line follow-up after the four passes merge.

### F2 — Switch link is 1 px smaller than its sentence

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/auth/signin.astro:26, signup.astro:18, confirm-email.astro:23
- **Detail**: `buttonVariants({ variant: "link" })` brings `text-label` (15 px) inside a `text-body` (16 px) sentence.
- **Fix**: Add `text-body` next to `px-1` (twMerge resolves it over `text-label`).
- **Decision**: FIXED. Re-screenshotted in `scratchpad/ui-auth-review/` (390 px, all three themes, EN and PL, no overflow). The link keeps its 44 px height.

### F3 — Sign-up hint uses `text-sm`, not a type role

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/auth/SignUpForm.tsx:67
- **Detail**: This matches `FieldError` (`mt-1.5 text-sm`) on purpose, so the hint and the error line up. It is not a regression.
- **Fix**: None now. If a role is added for hints, move FieldError and the hint over together.
- **Decision**: DISMISSED (consistent with the shared FieldError).

### F4 — The continue note is now a live region

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/auth/signin.astro:18-22
- **Detail**: `Notice` has `role="status"` and announces the note once after load. That is the intent of C3. `sign-in-continue.spec.ts:21` auto-waits through the 150 ms swap, and the spec passed.
- **Fix**: None.
- **Decision**: ACCEPTED (intended by C3).
