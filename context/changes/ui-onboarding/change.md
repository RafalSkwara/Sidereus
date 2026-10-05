---
change_id: ui-onboarding
title: Onboarding in Nightfall (/10x-ui pass)
status: impl_reviewed
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Notes

- Part of S-10 `visual-redesign` (#86): one of four concurrent /10x-ui passes (log, auth, onboarding, landing).
- **/10x-ui target:** `/onboarding` (`src/pages/onboarding.astro`, `src/components/onboarding/OnboardingWizard.tsx` and the shared `src/components/location/LocationPicker.tsx`, which `/gear/sites/{new,[id]}` also renders through `SiteForm`).
- **Token source:** `src/styles/global.css` (Nightfall values on `:root` / `[data-theme]`, published through `@theme inline`); components in `src/components/ui/` and `src/components/forms/`. Values: `context/changes/visual-redesign/tokens-nightfall.md`.
- **Contract variant:** existing design system, extended. No new palette; any shared addition is a new file or an appended token.
- **Reference views:** `/gear` (sky header and ruled Bands) and `/tonight`.
- **Constraint:** the picker's behaviour (`locateDevice` only on the click, rounding, geocode) stays unchanged; this is a visual pass.
- **Delegated (agent, 2026-10-05; the user asked for no questions in this run):**
  - Planning complexity LOW, zero interview questions: the research charges settle every decision, and visual calls follow Nightfall and `/gear`.
  - The wizard keeps its own `Button` submit (with `SubmitButton`'s spinner classes) instead of extending `SubmitButton`, to avoid editing a shared file during four parallel passes.
  - No new tests; the existing onboarding and site-location e2e specs pin behaviour.
  - The three unused `onboarding.*.kicker` keys are removed from both catalogues.
  - Node is run from `~/.nvm/versions/node/v24.21.0/bin` on `PATH` (same as `nvm use`): the worktree guard refuses the `. nvm.sh` prefix.
