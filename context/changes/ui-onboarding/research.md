---
date: 2026-10-05T14:10:32+02:00
researcher: Claude (ui-onboarding agent)
git_commit: d834703
branch: feat/ui-onboarding
repository: sidereus
topic: "/10x-ui audit of /onboarding against the Nightfall contract"
tags: [research, ui, nightfall, onboarding, location-picker]
status: complete
last_updated: 2026-10-05
last_updated_by: Claude (ui-onboarding agent)
---

# Research: /10x-ui audit of /onboarding against the Nightfall contract

**Date**: 2026-10-05T14:10:32+02:00
**Researcher**: Claude (ui-onboarding agent)
**Git Commit**: d834703
**Branch**: feat/ui-onboarding
**Repository**: sidereus

## Research Question

Audit the onboarding view (`/onboarding`: `src/pages/onboarding.astro`, `src/components/onboarding/OnboardingWizard.tsx` and the shared `src/components/location/LocationPicker.tsx`) against the Nightfall contract (`src/styles/global.css`, `src/components/ui/`, `src/components/forms/`, `context/changes/visual-redesign/`), with `/gear` and `/tonight` as the reference views. Output: 3–5 charges with file:line and user impact.

Scope note: single-area audit of three files that were read in full in the main context, so no sub-agents were dispatched. "Before" screenshots (EN/PL × dark/light/red × 390/1280) were taken from a local preview to ground the charges; they live in the session scratchpad (`before/onboarding-*.png`), not in the repo.

## Summary

The view renders and works, but it was built before the Nightfall contract (first-run-onboarding, S-03) and only picked up the restyle through the shared field components (`visual-redesign/plan.md:286`). Four charges:

1. **C1 Missing tokens** – 11 arbitrary values and a hand-picked type scale where the contract has roles (`text-[15px]` ×6, `tracking-[0.18em]`, `ring-[3px]` ×2, `text-4xl sm:text-5xl` title, `h-12 text-base` submit override), plus a second radius tier (`rounded-xl` / `rounded-2xl`).
2. **C2 Missing shared component** – the wizard keeps its own select (`selectBase`), its own `FieldError`, its own spinner and its radio "cards", while `NativeSelect`, `forms/FieldError` and `SubmitButton`'s spinner exist; no shared choice-card component exists (a second copy lives in `ObservationForm.tsx:72-76`).
3. **C3 Accidental architecture (composition)** – the page skips the sky header and puts each step in a boxed card with an uppercase kicker, and the kit step nests boxes three deep, so the first screen after sign-up looks like a different app from the `/tonight` it lands on.
4. **C4 Error states by colour alone (picker and host)** – the place-search failure and the wizard's location / eyepiece-list errors are bare `text-destructive` lines with no icon; in red mode `--destructive` (`#bb0000`) and `--muted-foreground` (`#c40000`) are near-identical, so an error reads as a hint.

## Pre-audit counts

- Hardcoded-value scan (`/10x-ui` regex, plus `rounded-(xl|2xl)` and raw `text-(xs…5xl)` sizes) on the three files: **0 literal colours**, **11 arbitrary values** (onboarding.astro 1, OnboardingWizard 10, LocationPicker 0), 4 `rounded-xl`/`rounded-2xl`, 1 raw heading size pair (`text-4xl sm:text-5xl`).
- Contract imports: `OnboardingWizard` imports `Button`, `FormField`, `ServerError` but not `NativeSelect`, `forms/FieldError`, `SubmitButton`; `onboarding.astro` imports none of `PageHeader`, `Band`; `LocationPicker` imports `Button`, `Input`, `Label`.
- Agent rules: `CLAUDE.md` "UI (Nightfall)" already forbids arbitrary values and asks for sky header + ruled Bands; no rule invites one-off values. The drift predates the rule.

## Charges

### C1 · Missing tokens: arbitrary values and an off-contract type scale

- `src/pages/onboarding.astro:30` – `font-display text-4xl … sm:text-5xl` page title, where the contract's page title is `text-display` (`PageHeader.astro:17`).
- `src/pages/onboarding.astro:31` – `text-[15px]` intro (the `text-label` role is 15 px; `PageHeader` uses `text-body` for the subtitle).
- `src/components/onboarding/OnboardingWizard.tsx:72` – `focus-visible:ring-[3px]` on the local select.
- `OnboardingWizard.tsx:80` – `has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50` on the radio cards.
- `OnboardingWizard.tsx:84` – `tracking-[0.18em]` uppercase kicker.
- `OnboardingWizard.tsx:85` – `text-2xl` step heading, where bands use `text-title` (`Band.astro:36`).
- `OnboardingWizard.tsx:435, 453, 470, 530, 547, 665` – `text-[15px]` card titles, legends and the Add button.
- `OnboardingWizard.tsx:695` – `h-12 … text-base font-semibold` overrides on the submit `Button size="lg"` (which already is `h-12`, `text-label`).
- `OnboardingWizard.tsx:78, 83, 481, 567` – `rounded-xl` / `rounded-2xl` second radius tier where controls use `rounded-lg`.
- **User impact:** keyboard users see a different focus look here (a 3 px, half-transparent halo) than on every other control in the app (a solid 2 px `--ring` outline, `ui/button.tsx:22`); in red mode the half-alpha ring on a near-black surface is faint. Type steps differ from `/gear` and `/tonight`, so the setup page reads as a foreign screen.

### C2 · Missing shared component: local select, field error, spinner and choice cards

- `OnboardingWizard.tsx:71-73` (`selectBase`, `inputOk`, `inputBad`) and `:611-627` – a hand-built `<select>` that shadows `NativeSelect` (`ui/native-select.tsx:7`): it draws the OS chevron, which `NativeSelect` replaces with a token-coloured one, so in red mode the eyepiece-type arrow is the browser's grey.
- `OnboardingWizard.tsx:133-139` – a local `FieldError` (12 px, no icon) that shadows `forms/FormField.tsx:29` (`FieldError`, 14 px with `CircleAlert`). Errors in the same form therefore look two different ways (FormField fields vs the type select).
- `OnboardingWizard.tsx:698-701` – a hand-built spinner (`border-primary-foreground/30 border-t-primary-foreground`) where `SubmitButton.tsx:58` has the shared `border-current/30 border-t-current` one. (`SubmitButton` itself cannot be used as is: the wizard's submit also needs `disabled` until a location is set and an `aria-describedby`.)
- `OnboardingWizard.tsx:76-81, 116-125` – the radio "card" and its `CheckDot`: the onboarding's main control (11 cards across three groups) has no shared component; `ObservationForm.tsx:72-76` holds a second, already diverging copy (`bg-selected/15`). Not in `/design`, so its states are not reviewable.
- **User impact:** the same form shows two error styles and two select looks; the one control a new user touches most has no reviewed hover / focus / checked / disabled states.

### C3 · Accidental architecture: the page is not composed in Nightfall

- `src/pages/onboarding.astro:29-31` – `GearShell` without the `header` slot and an `h1` in `<main>`, so there is no sky header (`GearShell.astro:22-35`), unlike `/gear` (`src/pages/gear/index.astro` `PageHeader slot="header"`) and the `/gear/*/new` forms.
- `OnboardingWizard.tsx:83` – each step is a boxed card (`rounded-2xl border bg-surface/40 p-4 sm:p-6`), where the contract says "content in ruled `Band`s rather than boxed cards" (`CLAUDE.md` UI (Nightfall)).
- `OnboardingWizard.tsx:84, 343-345, 412-414, 443-445` – uppercase tracked kickers ("1 · WHERE"), which `PageHeader.astro:3` explicitly drops ("No uppercase kicker").
- `OnboardingWizard.tsx:481` (telescope fields box) and `:567` (one box per eyepiece) inside the kit card – three levels of borders at 390 px; each level adds 16 px of padding per side, so eyepiece inputs are 32 px narrower than the page column and the kit step is the longest part of the page.
- `Band.astro` is an Astro component and the three steps live inside one React form island, so the island cannot use it; a React counterpart with the same classes is needed (new file, `Band.astro` untouched).
- **User impact:** the first screen after sign-up looks like a different, older app than the `/tonight` it lands on; at 390 px the boxed, nested kit step is visually heavy and narrows the fields.
- Entry points checked (no charge): signed out, `/onboarding` is gated (`src/lib/protected-routes.ts:10`) and redirects to sign-in; a user with gear is redirected to `/tonight` (`onboarding.astro:20-22`); without Supabase it renders `DatabaseMissing` (`:35`); the TabBar is hidden here by design (`TabBar.astro:13`).

### C4 · Error states rely on colour alone (LocationPicker and host)

- `src/components/location/LocationPicker.tsx:209-218` – the place-search failure message only switches to `text-destructive`; no icon.
- `OnboardingWizard.tsx:404-408` – the "set a location" error under the picker, and `:678-682` – the eyepiece-list error: bare `<p role="alert" className="text-destructive text-sm">`.
- Red theme values: `--no-go` / `--destructive` `#bb0000` vs `--muted-foreground` `#c40000` (`global.css` red block), so in red mode these errors are indistinguishable from the muted hints around them; `/10x-ui` matrix: "error … not colour alone".
- The shared `FieldError` (`forms/FormField.tsx:29`) already pairs the colour with `CircleAlert`.
- Picker scope: only the failure line's presentation changes; `locateDevice` on the click, rounding and `searchPlaces` stay as they are. `/gear/sites/{new,[id]}` (`SiteForm.tsx:180`) renders the same picker, so it gets the same fix and must be re-screenshotted.
- **User impact:** an observer using red mode at the telescope cannot tell that the place search failed or that the location is missing, only that some text appeared.

### Deferred / out of area

- `ObservationForm.tsx:72-76` copy of the choice card – the log pass's area; the new shared component is available to it (noted in the PR).
- Disabled submit look (filled `muted-foreground`, `ui/button.tsx:33`) – contract-wide decision, unchanged here.

## Code References

- `src/pages/onboarding.astro:29-53` – shell, title, intro, credits.
- `src/components/onboarding/OnboardingWizard.tsx:71-139` – local class constants, `CheckDot`, `FieldError`.
- `src/components/onboarding/OnboardingWizard.tsx:329-715` – the form markup.
- `src/components/location/LocationPicker.tsx:150-259` – picker markup.
- `src/components/gear/SiteForm.tsx:180` – the second picker host.
- `src/components/ui/Band.astro:27-45`, `PageHeader.astro:15-27`, `ui/native-select.tsx:7-24`, `forms/FormField.tsx:29-37`, `forms/SubmitButton.tsx:55-64`.

## Historical Context (from prior changes)

- `context/changes/visual-redesign/plan.md:55-60` – composition passes for onboarding were deferred to their own `/10x-ui` pass; shared field components restyle everywhere.
- `context/changes/visual-redesign/research.md:117, 123` – `OnboardingWizard.tsx:78` named as a second card tier and `:71` as one of four `selectBase` copies.

## Related Research

- `context/changes/visual-redesign/research.md`.

## Open Questions

None blocking. Visual judgement calls are listed in the plan and the PR.
