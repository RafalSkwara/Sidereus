<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: The user's UI adjustments (M-3 S-02)

- **Plan**: context/changes/ui-user-adjustments/plan.md
- **Scope**: Phase 1 of 6
- **Reviewed phases**: 1
- **Date**: 2026-10-08
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 2 observations
- **Commit reviewed**: 6a63158

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria were re-checked on the committed code, and they all passed:
- `astro check`: 0 errors.
- `npm test`: 882 passed.
- eslint: 0 errors.
- e2e on preview port 4331: 15 passed, 2 conditional skips (the Moon and washed-out cases depend on tonight's sky).
- Break-check: the contrast test went red on a weakened red border.
- Manual rows 1.5-1.7 were ticked with screenshot evidence (Targets in dark/light/red at 390 and 1280 px, the offline state, the Moon page).

## Findings

### F1 — In red mode the suggested sky-check answer looks like the other two

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/sky-checks/SkyAnswerForm.astro:37,53-57
- **Detail**: The suggested answer used to be the only one with a border. Now the ghost answers carry `border-action-border` too. In red, that border is #d00000 against the suggestion's #ff0000 outline, about 1.43:1, with the same fill and ink, so the cue disappears. CLAUDE.md now says red differs by shape.
- **Fix**: Give the suggested (outline) answer a second, non-colour cue: `border-2` and the action surface fill.
- **Decision**: FIXED (recommended fix; user chose "apply all", 2026-10-08)

### F2 — Hovering an `action` control shows almost no change

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/ui/button.tsx:36
- **Detail**: `hover:bg-accent` replaces `bg-action-surface` with a near-identical tone: 1.00:1 in red, 1.02 dark, 1.07 light, 1.13 night. The `/design` hover specimen shows nothing in red.
- **Fix**: Hover keeps the fill and moves the cue to the border and the text: `hover:border-primary-strong hover:underline`.
- **Decision**: FIXED (recommended fix; user chose "apply all", 2026-10-08)

### F3 — Standalone clickables outside the inventory still miss the user's "border + bg + icon + colour" rule

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: log/index.astro:71; gear/index.astro:92-93 (used at :128, :163, :195); confirm-email.astro:23-25; SiteForm.tsx:265-271; OnboardingWizard.tsx:512,621
- **Detail**:
  - The /log "Sky checks" link got only a border, with heading ink, no fill and no icon. The "Add entry" button next to it has a `Plus` icon.
  - The /gear "Add …" ghost links are unchanged.
  - "Back to sign in" is the only `action` without an icon.
  - SiteForm's Undo button and onboarding's "manual" `<summary>` toggles still underline only on hover.
  - The plan's inventory missed all of these. The code follows the plan, but the user's rule ("anything clickable") is not met yet.
  - `"border border-action-border"` is repeated as a literal in two places.
- **Fix**: Bring them under the rule. Contract changes:
  - **/log "Sky checks"** becomes `action` with a lucide icon.
  - **/gear "Add …"** links become `action` with a `Plus` icon.
  - **"Back to sign in"** gets an `ArrowLeft` icon.
  - **Undo and the onboarding toggles** get the `link` look (underlined at rest).
  - **Shared border constant.** The ghost-answer resting border moves to one shared constant, and the CLAUDE.md bullet mentions it.
  - Strength: matches the user's rule everywhere a user can tap.
  - Tradeoff: touches the gear hub and onboarding, outside the plan's file list (record it as an addendum).
  - Confidence: HIGH, call sites verified by both reviewers.
  - Blind spot: the 390×844 first-screen pin does not cover /gear or /log, so only the sideways-scroll spec guards them.
- **Decision**: FIXED (recommended fix; user chose "apply all", 2026-10-08)

### F4 — `action` labels render at Tailwind's `text-sm` (14 px), not a type role

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/button.tsx:42 (`sm` size)
- **Detail**: `sm` carries `text-sm`, which wins over the base `text-label` both with and without `cn`. BackLink and Pager dropped from 15 to 14 px, and "Back to sign in" from 16 to 14 px, now smaller than the paragraph above it. CLAUDE.md asks for the type roles.
- **Fix A ⭐ Recommended**: Drop `text-sm` from the `sm` size, so every `sm` control uses the base `text-label` (15 px).
  - Strength: one-line fix that brings all `sm` controls onto a type role.
  - Tradeoff: every existing `sm` control (Now buttons, gear pills, inline links, Skip/All) grows 1 px; the phone fold has a few px to spare.
  - Confidence: MED. Run tonight-phone again.
  - Blind spot: Polish labels at 320 px.
- **Fix B**: Keep `sm` as is and pass `text-label` through `cn` only at the `action` call sites.
  - Strength: no global change.
  - Tradeoff: Mark observed and the washed-out link don't use `cn`, so the order of the generated CSS decides.
  - Confidence: LOW.
  - Blind spot: CSS order.
- **Decision**: FIXED (recommended fix; user chose "apply all", 2026-10-08)

### F5 — Unplanned gap between BackLink and the title; one line in log/new.astro

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: TonightPageSky.astro, TonightPageSkeleton.astro, 6 gear sub-pages, log/[id].astro, log/sky.astro, log/new.astro:83
- **Detail**: Screenshots showed the new bordered BackLink touching the title, so the gap was widened (`mt-1 sm:mt-2` → `mt-4 sm:mt-5` on Tonight, `mt-2` → `mt-4` on gear and log). No phase planned it. `log/new.astro` changes by one spacing-only line, crossing the plan's boundary for that file (owned by the concurrent test-plan Phase 2). The gap is also repeated in 11 views instead of living in a shared part.
- **Fix**: Record it as a Phase 1 addendum in the plan. Move the gap into `BackLink` (a bottom margin), so the 11 wrappers drop their `mt-*`, and leave log/new.astro with no diff against main.
- **Decision**: FIXED (recommended fix; user chose "apply all", 2026-10-08)

### F6 — `action` at the default size would clip a wrapped label; /design shows the default size

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/button.tsx:36,41; src/pages/design.astro:169
- **Detail**: The default size has a fixed `h-11` while `action` wraps. Only a comment says to use `sm`. The /design specimens render `action` at the default size, unlike every real use.
- **Fix**: Render the /design `action` specimens at `size: "sm"`, and make the `default` size `min-h-11` instead of `h-11`. The base already carries `min-h-11`, so it is enough to drop `h-11`.
- **Decision**: FIXED (recommended fix; user chose "apply all", 2026-10-08)

## Triage summary

- Fixed: F1, F2, F3, F4 (Fix A), F5, F6. The user chose "apply all recommended fixes".
- Skipped, accepted or recorded as rules: none.
