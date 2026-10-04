# "Use my location" on the Site Form — Plan Brief

> Full plan: `context/changes/site-use-my-location/plan.md`

## What & Why

M-2 S-08 (MS-08, GitHub #72): adding or editing a site offers an explicit "Use my location" button, and the browser asks for location permission only after that click. The site form gets the same three choices as onboarding (use my location · search a place · coordinates) from one shared picker, so the two surfaces can't drift and S-09's map has one component to join.

## Starting Point

Onboarding has the click-triggered locate (rounded before state), place search and confirmation line, all inline in `OnboardingWizard.tsx`. The add/edit site form (`SiteForm.tsx`) has only manual latitude/longitude fields; the server already rounds coordinates on save.

## Desired End State

On `/gear/sites/new` and `/gear/sites/<id>`, a Location block under Name holds the Use my location button, place search, and the latitude/longitude fields, which are always visible and filled by either choice. Picking a place fills an empty Name. On edit, a replaced location shows "Was 40.42, -3.7 · Undo" until Save. Onboarding looks unchanged but runs on the same picker.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Choices on the site form | All three, one shared `LocationPicker` (user) | Matches onboarding and gives S-09 a single component to extend. |
| Replacing a saved location on edit | "Was … · Undo" note, no blocking confirm (user); it stays after a hand-tweak that follows a pick (plan review F1) | Nothing is saved until Save, so an undo line is enough without an extra click every time. |
| Layout | Picker above always-visible lat/lon fields; onboarding keeps its disclosure (user) | Edit always shows the stored coordinates, and the fields stay the one source of truth. |
| Name from a picked place | Fill only when Name is empty; never from Use my location (user) | Saves typing on add and never overwrites a typed name. |
| Test depth | One small unit file plus a two-test e2e spec; the rest by screenshots (user: "be modest with tests") | The suite is already large; the e2e tests pin only what can't be eyeballed. |
| Where rounding lives | New `locateDevice` in `src/lib/location/locate.ts`, rounds before returning (delegated) | One tested place for the privacy guarantee instead of two copies in islands. |
| Geocoding module | `git mv` to `src/lib/location/`, `PlaceResult` gains `name` (delegated) | It's shared now; the short name feeds the Name fill. |
| Copy | Picker keys move from `onboarding.where` to a top-level `location` namespace (delegated) | They are no longer onboarding-specific. |
| Lint | Add `src/lib/location/**`, `src/components/location/**`, `src/components/gear/**` to no-console (delegated) | lessons.md; `SiteForm` was already uncovered. |
| Polish "Was" line | "Było: 40,42; -3,7", with a semicolon between the values (delegated) | The Polish decimal mark is a comma. |

## Scope

**In scope:** the shared picker and locate helper, onboarding refactored onto them, site form Location block, Name fill, the Undo note on edit, EN/PL copy, lint globs, a CLAUDE.md pointer, one unit test file plus one assertion, and one new e2e spec.

**Out of scope:** the map (S-09), any schema, API or store change, a blocking replace-confirmation, re-resolving a manually pinned time zone, and Undo for typed coordinates or on the add form.

## Architecture / Approach

`LocationPicker` (island component) owns the geolocation status, search query, results, debounce and abort, and reports `onPick({ latitudeDeg, longitudeDeg, source })` with values that are already rounded. Each host form keeps owning its coordinate fields, payload and validation, and passes the confirmation text back as `summary`. Device positions go through `locateDevice`, and place results through `searchPlaces`; both round before returning.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared location picker | `src/lib/location/`, `LocationPicker`, shared copy, onboarding rebuilt on it, lint globs; no visible change | Regressing onboarding's focus and stale-search handling during the move |
| 2. Site form uses the picker | Location block, Name fill, Undo note on edit, e2e spec, CLAUDE.md pointer | The Undo predicate showing or hiding at the wrong time |

**Prerequisites:** none (S-08 has no dependencies); local Supabase and the e2e preview for the gates.
**Estimated effort:** about one session, 2 phases.

## Open Risks & Assumptions

- Onboarding's e2e is the only automated guard for the extraction; the phase 1 screenshot covers the visuals.
- Playwright cannot show the browser's permission prompt, so "asked only after the click" is pinned by counting `getCurrentPosition` calls instead.

## Success Criteria (Summary)

- A user can fill a new or edited site's location with one click (or a town search), and the permission prompt appears only after the click.
- A refusal leaves a plain message and a form that still saves typed coordinates.
- Onboarding works exactly as before.
