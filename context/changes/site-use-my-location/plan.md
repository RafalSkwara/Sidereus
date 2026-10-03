# "Use my location" on the Site Form Implementation Plan

## Overview

M-2 S-08 (MS-08, GitHub #72): a user adding or editing a site gets the same location choices as onboarding — **Use my location · search a place · coordinates** — from one shared `LocationPicker`. The browser asks for location permission only after the button is clicked; a device position is rounded to about 1 km before anything else sees it; a refusal or failure leaves the form usable with a plain message and the manual fields. Extracting the picker now also gives S-09 ("Pick from map") the one component it joins.

## Current State Analysis

- Onboarding owns the only location picker, inline in `src/components/onboarding/OnboardingWizard.tsx`: the click-triggered `locateMe` (`:183-205`, rounds with `roundCoordinate` before state, maps `PERMISSION_DENIED` to "denied" and everything else to "unavailable"), the debounced, abortable place search (`:207-249`, `searchPlaces` from `src/lib/onboarding/geocode.ts`), the confirmation line (`:403-410`, focused after a place pick) and the status texts (`:412-429`). Its copy lives under `onboarding.where.*` (`src/i18n/messages/en.ts:279-303`, mirrored in `pl.ts`).
- The add/edit site form `src/components/gear/SiteForm.tsx` has only manual latitude/longitude fields (`:128-162`); `/gear/sites/new.astro` and `/gear/sites/[id].astro` mount it with `client:load`, the edit page passing the stored values as `initial`.
- The server already rounds: `siteInputSchema` transforms both coordinates with `roundCoordinate` (`src/lib/gear/schemas.ts:47-48`), so the POST routes need no change.
- `src/components/gear/**` is missing from the `no-console` globs in `eslint.config.js:84-104` although `SiteForm` handles coordinates (lessons.md, "Put every module that touches site coordinates under the no-console lint").
- `PlaceResult` carries only a joined `label` ("Madrid, Madrid, Spain", `geocode.ts:104-109`), not the short place name.
- E2E references to the picker copy: `tests/e2e/helpers.ts:83`, `tests/e2e/landing-screenshot.spec.ts:67`, `tests/e2e/onboarding.spec.ts:38,40,66,68`. Place search is stubbed by `stubPlaceSearch` (`helpers.ts:55`); `onboardInMadrid` (`helpers.ts:77`) creates a user with one Madrid site.

## Desired End State

- `/gear/sites/new` and `/gear/sites/<id>` show, under Name, a **Location** block: the "Use my location" button, "or", the place search with its results and confirmation line, then the latitude/longitude fields, always visible and filled by either choice.
- No geolocation call happens until the button is clicked. A granted position fills the fields with 2-decimal values; denied or unavailable shows the existing plain messages, and typing coordinates still saves.
- Picking a place while Name is empty sets Name to the place's short name ("Kraków"); a typed Name is never changed; "Use my location" never touches Name.
- On the edit form, when a picked location (device or place) differs from the saved one, a line "Was 40.42, -3.7 · Undo" shows until Save; Undo restores the saved coordinates.
- Onboarding looks and behaves exactly as before, now built on the same `LocationPicker`.

Verify with the automated gates below plus Playwright screenshots of both site pages and onboarding.

### Key Discoveries:

- `OnboardingWizard.tsx:183-205` — the reference `locateMe`; options `{ enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }` stay as they are.
- `OnboardingWizard.tsx:322` — validation focuses `place-search` for a location error; the picker keeps that id (one picker per page).
- `schemas.ts:47-48` — the server rounds independently; the client rounding is the privacy guarantee for what reaches React state.
- `SiteForm.tsx:76-78` — automatic time zone mode resolves from the coordinates server-side, so a new location in auto mode needs nothing extra.

## What We're NOT Doing

- No map ("Pick from map" is S-09) and no new third-party request: place search reuses onboarding's Open-Meteo geocoding.
- No schema, migration, store or API route change.
- No blocking "Replace saved location?" confirmation (the user chose the Undo note).
- No change to a manually pinned time zone when the location changes; it stays pinned as today.
- No Undo note on the add form, and none for typed coordinates (the fields show what was typed).
- No new unit tests beyond `locate.test.ts` and one `name` assertion in the moved `geocode.test.ts`; denied/unavailable and place search on the site form are checked by screenshots, not new e2e tests (user: "be modest with tests").

## Implementation Approach

Phase 1 extracts the picker with no visible change and proves it through the existing onboarding e2e; phase 2 mounts it on the site form. Device location goes through a small, island-safe, unit-tested `locateDevice` so the "rounded before anything sees it" guarantee lives in one place. The host form keeps owning the coordinate fields, the hidden payload and validation; the picker only reports picks.

## Critical Implementation Details

- **User experience spec**: after a place pick, focus moves to the confirmation line (as today); after Undo, focus moves to the latitude field so a keyboard user is not dropped on `<body>`.
- **Timing & lifecycle**: the picker cancels a pending search on unmount and ignores a stale (aborted) search's rejection, exactly as `OnboardingWizard.tsx:166-173,238-246` does now; keep both when moving the code.

## Phase 1: Shared location picker

### Overview

Move the location logic out of onboarding into `src/lib/location/` and `src/components/location/`, with shared copy, and rebuild onboarding's Where section on it. Users see no change.

Before touching `OnboardingWizard.tsx`, capture the baseline screenshot of onboarding's Where section (EN, dark, 390 px) that check 1.5 compares against.

### Changes Required:

#### 1. Location library

**File**: `src/lib/location/geocode.ts`, `src/lib/location/geocode.test.ts` (moved with `git mv` from `src/lib/onboarding/`)

**Intent**: Place search becomes shared, so it moves next to the new locate helper; `PlaceResult` gains the short place name for the site form's Name fill.

**Contract**: `PlaceResult` adds `name: string` (the trimmed `results[].name`). Everything else (URL, timeout, `GEOCODING_FAILED`, rounding) unchanged. Update the import in `OnboardingWizard.tsx` (the only importer). The existing test gains one assertion that `name` is the bare place name.

**File**: `src/lib/location/locate.ts`, `src/lib/location/locate.test.ts` (new)

**Intent**: One place that asks the browser for the position and rounds it before returning, so neither form can let a raw position into state.

**Contract**: `locateDevice(geolocation: Geolocation | undefined): Promise<{ latitudeDeg: number; longitudeDeg: number }>`; resolves with `roundCoordinate`ed values; rejects with `Error` whose message is `"denied"` (for `PERMISSION_DENIED`) or `"unavailable"` (any other error, or `geolocation` undefined). Same `getCurrentPosition` options as today. Island-safe: imports only `@/lib/gear/coordinates`; never logs. Tests (node env, fake `Geolocation`): rounds a 5-decimal position; denied → "denied"; timeout → "unavailable"; undefined → "unavailable" without a call.

#### 2. LocationPicker island component

**File**: `src/components/location/LocationPicker.tsx` (new)

**Intent**: The Use my location button + status, the "or" divider, the place search with results and status, and the confirmation line, lifted from `OnboardingWizard.tsx` with its markup and classes unchanged.

**Contract**: props `{ locale: Locale; onPick: (pick: LocationPick) => void; summary: string | null; invalid?: boolean }`, where `LocationPick = { latitudeDeg: number; longitudeDeg: number; source: { kind: "device" } | { kind: "place"; label: string; name: string } }`. The component owns geo status, query, results, debounce and abort; the host owns coordinates and passes `summary` (null hides the line). Element ids stay `place-search` / `place-search-status`; all text inputs keep `name=""` so nothing of the picker is submitted.

#### 3. Shared copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: The picker's copy is no longer onboarding-specific.

**Contract**: new top-level `location` namespace holding the keys moved from `onboarding.where`: `useLocation, locating, locationDenied, locationUnavailable, or, searchLabel, searchPlaceholder, searching, noResults, resultsLabel, resultsCount, searchFallback, usingDevice, usingPlace, usingCoordinates` (texts unchanged). `onboarding.where` keeps `kicker, heading, hint, manualToggle`. Update `tests/e2e/helpers.ts`, `tests/e2e/landing-screenshot.spec.ts` and `tests/e2e/onboarding.spec.ts` to the new paths.

#### 4. Onboarding on the picker

**File**: `src/components/onboarding/OnboardingWizard.tsx`

**Intent**: Replace the inline locate/search state, handlers and JSX with `<LocationPicker>`; keep the manual-coordinates disclosure, the hidden payload, validation and its `place-search` focus target.

**Contract**: `onPick` sets latitude/longitude/source and clears `errors.where`; `summary` is the existing `whereSummary`; `invalid` is `Boolean(errors.where) && !manualOpen`. The header comment's privacy note points at `locateDevice` / `searchPlaces`.

#### 5. Lint coverage

**File**: `eslint.config.js`

**Intent**: Every module touching coordinates is under `no-console` (lessons.md).

**Contract**: add `"src/lib/location/**"`, `"src/components/location/**"` and `"src/components/gear/**"` to `gearConfig.files`; drop nothing.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including `locate.test.ts` and the moved `geocode.test.ts`: `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- Onboarding e2e passes unchanged in behaviour: `npx playwright test tests/e2e/onboarding.spec.ts`

#### Manual Verification:

- Onboarding's Where section looks identical to before (Playwright screenshot, EN, dark, phone width)

**Implementation Note**: After completing this phase and all automated verification passes, run the manual check (Playwright screenshot, per the delegated-verification agreement) before proceeding to the next phase.

---

## Phase 2: Site form uses the picker

### Overview

Mount the picker on the add/edit site form with always-visible coordinates, Name fill from a picked place, and the Undo note when an edit replaces the saved location.

### Changes Required:

#### 1. Site form

**File**: `src/components/gear/SiteForm.tsx`

**Intent**: Under Name, a "Location" group: a label, `<LocationPicker>`, then the existing latitude/longitude grid and coordinates hint (unchanged ids, names and validation).

**Contract**:
- New state `source: "device" | { place label } | "manual" | null`. `onPick` writes `String(latitudeDeg)` / `String(longitudeDeg)` into the fields, clears their errors and records the source; typing in either field sets the source to manual.
- `summary`: `location.usingDevice` for device, `location.usingPlace({ place: label })` for a place, `null` for manual or untouched (the fields already show the values).
- Name fill: on a place pick, if `name.trim() === ""`, set Name to `pick.source.name` and clear its error. Never on a device pick.
- Undo note (edit only, `initial` present): shown while the picker has been used since the page loaded (a sticky flag set by `onPick`, so a hand-tweak after a pick keeps the note) and the field values, as numbers, differ from `initial.latitudeDeg` / `initial.longitudeDeg`; typing alone, with no pick, never shows it. Text `siteForm.previousLocation({ latitude, longitude })` with the saved values formatted for the locale, plus an `Undo` button (`siteForm.undoLocation`, `type="button"`) that restores both saved values, sets the source to null, resets the sticky flag and focuses `#latitudeDeg`.
- The group is a `<fieldset>` with a `<legend>` (`siteForm.location`) so screen readers announce the block.

#### 2. Site form copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: The three new strings.

**Contract**: `siteForm.location` ("Location" / "Lokalizacja"), `siteForm.previousLocation(p: { latitude: string; longitude: string })` ("Was 40.42, -3.7" / "Było: 40,42; -3,7" — Polish uses a semicolon because its decimal mark is a comma), `siteForm.undoLocation` ("Undo" / "Cofnij"). Parity holds via `satisfies Messages`.

#### 3. E2E

**File**: `tests/e2e/site-location.spec.ts` (new, two tests)

**Intent**: Pin the two promises nobody can eyeball reliably: no permission request before the click, and Undo on edit.

**Contract**:
- *New site*: an init script wraps `navigator.geolocation.getCurrentPosition` to count calls; with geolocation granted at a 4-decimal point, the count is 0 after `/gear/sites/new` hydrates, the click fills latitude/longitude with the 2-decimal values, and after filling Name and Bortle (a device pick fills neither; reuse the `SITE_FORM` / `addSite` pattern from `tests/e2e/seven-night-planner.spec.ts:49-59`) saving lands on `/gear` with the site listed.
- *Edit site*: `onboardInMadrid`, open the site from `/gear`, geolocation granted elsewhere (e.g. Kraków), click → the "Was 40.42, -3.7" line shows → Undo → the fields read 40.42 / -3.7 again.

#### 4. Agent context

**File**: `CLAUDE.md`

**Intent**: Keep the next agent on the shared picker.

**Contract**: one sentence in Architecture: onboarding and the site form share `src/components/location/LocationPicker.tsx`; device positions go through `locateDevice` (`src/lib/location/locate.ts`), which rounds before returning; place search is `src/lib/location/geocode.ts`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass (i18n parity included): `npm test`
- Type check passes: `npx astro check`
- Lint passes: `npm run lint`
- New site-location e2e passes: `npx playwright test tests/e2e/site-location.spec.ts`
- Full e2e suite stays green: `npm run test:e2e`

#### Manual Verification:

- Add and edit site pages show the Location block correctly in EN and PL, in dark, light and red, at phone width (Playwright screenshots)
- With location denied, the denied message shows and typed coordinates still save
- Place search on the add form fills the coordinates and an empty Name, and leaves a typed Name alone

**Implementation Note**: After completing this phase and all automated verification passes, run the manual checks yourself with local preview on local Supabase and Playwright screenshots (delegated-verification agreement), then hand over for merge.

---

## Testing Strategy

### Unit Tests:

- `locate.test.ts`: rounding, denied, unavailable, missing API.
- `geocode.test.ts` (moved): one added assertion for `name`.

### Integration Tests:

- Existing `onboarding.spec.ts` guards the extraction (place search and Use my location paths).
- New `site-location.spec.ts`: no call before click + rounded fill + save; edit Undo.
- Existing `seven-night-planner.spec.ts` (`addSite`, typed coordinates on `/gear/sites/new`) guards the manual path of the reworked site form.

### Manual Testing Steps:

1. `/gear/sites/new`, deny location: the denied message shows; type 52.23 / 21.01 and save.
2. `/gear/sites/new`, search "Madrid" (stubbed), pick it: fields read 40.42 / -3.7, Name reads "Madrid"; repeat with a typed Name and confirm it stays.
3. Screenshots of both pages in EN/PL × dark/light/red at 390 px, plus onboarding's Where section.

## Performance Considerations

None: the picker code moves rather than grows, and the site form's island gains only that shared module.

## Migration Notes

None (no data change).

## References

- Roadmap: `context/foundation/roadmap.md` S-08 (and S-09, which joins this picker)
- PRD: FR-004 (rounding to about 1 km), MS-08
- Reference implementation: `src/components/onboarding/OnboardingWizard.tsx:183-249,403-429`
- Lessons: `context/foundation/lessons.md` (no-console globs)
- Prior change: `context/archive/2026-09-26-first-run-onboarding/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared location picker

#### Automated

- [ ] 1.1 Unit tests pass, including `locate.test.ts` and the moved `geocode.test.ts`: `npm test`
- [ ] 1.2 Type check passes: `npx astro check`
- [ ] 1.3 Lint passes: `npm run lint`
- [ ] 1.4 Onboarding e2e passes unchanged in behaviour: `npx playwright test tests/e2e/onboarding.spec.ts`

#### Manual

- [ ] 1.5 Onboarding's Where section looks identical to before (Playwright screenshot, EN, dark, phone width)

### Phase 2: Site form uses the picker

#### Automated

- [ ] 2.1 Unit tests pass (i18n parity included): `npm test`
- [ ] 2.2 Type check passes: `npx astro check`
- [ ] 2.3 Lint passes: `npm run lint`
- [ ] 2.4 New site-location e2e passes: `npx playwright test tests/e2e/site-location.spec.ts`
- [ ] 2.5 Full e2e suite stays green: `npm run test:e2e`

#### Manual

- [ ] 2.6 Add and edit site pages show the Location block correctly in EN and PL, in dark, light and red, at phone width (Playwright screenshots)
- [ ] 2.7 With location denied, the denied message shows and typed coordinates still save
- [ ] 2.8 Place search on the add form fills the coordinates and an empty Name, and leaves a typed Name alone
