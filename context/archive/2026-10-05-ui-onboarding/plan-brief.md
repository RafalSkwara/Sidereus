# Onboarding in Nightfall — Plan Brief

> Full plan: `context/changes/ui-onboarding/plan.md`
> Research: `context/changes/ui-onboarding/research.md`

## What & Why

`/onboarding` is the first screen after sign-up, and it still looks like the pre-Nightfall app: its own title size, boxed steps with uppercase kickers, nested boxes in the kit step, local copies of the select, field error and radio card, and error lines that rely on colour alone (unreadable as errors in red mode). This pass puts it on the Nightfall contract so it matches the `/tonight` it hands over to.

## Starting Point

The view works (S-03, S-08) and only picked up the restyle through `FormField`/`Input`. No colour literals; 11 arbitrary values; 0 imports of `PageHeader`, `Band` or `NativeSelect`.

## Desired End State

Sky header, three ruled bands and a ruled submit area; every control a shared component; one focus look; every error with an icon. `/gear/sites/new` keeps working with the same picker tweak.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Band inside the island | New `ui/band.tsx` twin of `Band.astro` | One form spans three bands; Astro components can't render inside React | Research C3 |
| Radio cards | New shared `forms/ChoiceCard.tsx` | Main control of the page, no shared component, a second copy exists in the log form | Research C2 |
| Step kickers | Dropped, keys removed | `PageHeader` contract: no uppercase kicker | Research C3 |
| Submit button | Keep `Button`, borrow the shared spinner | `SubmitButton` lacks `disabled`/`aria-describedby`; avoids touching a shared file | Plan (delegated) |
| Picker | Only the failure line gets the icon | Visual pass; behaviour untouched | Research C4 |
| Tokens | None added | Every needed value exists | Plan |
| Tests | No new ones | Existing e2e pins behaviour; screenshots cover looks | User preference |

## Scope

**In scope:** `onboarding.astro`, `OnboardingWizard.tsx`, the picker's failure line, `ui/band.tsx`, `forms/ChoiceCard.tsx`, `/design` specimens, removal of three kicker keys, one CLAUDE.md line.

**Out of scope:** picker behaviour, `ObservationForm`'s cards (log pass), `SubmitButton`, `Band.astro`, `global.css`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared components | `Band` (React), `ChoiceCard`, `/design` states | Drift between the two Band twins |
| 2. The view | Sky header, ruled bands, shared controls | e2e selectors on radios/buttons |
| 3. States, picker, rule | Icons on errors, screenshot matrix, CLAUDE.md line | `/gear/sites/new` regressions |

**Prerequisites:** local Supabase running; preview on 4323, fixture on 4402.
**Estimated effort:** one session.

## Open Risks & Assumptions

- Concurrent passes may also edit `/design` and CLAUDE.md; edits are appended blocks to keep merges trivial.

## Success Criteria (Summary)

- A new user's setup page reads like the rest of Sidereus in all three themes and both languages.
- Errors on the page are recognisable without colour.
