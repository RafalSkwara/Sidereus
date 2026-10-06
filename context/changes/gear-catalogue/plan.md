# Gear catalogue (S-12) Implementation Plan

## Overview

A beginner adding a telescope or an eyepiece can search a hand-curated catalogue of real models instead of typing specs they don't know. The catalogue covers about 300 telescopes and 250 eyepieces. Picking a model fills in the existing form fields, which stay editable. The search is an accessible combobox shared by three surfaces: the `/gear` telescope form, the `/gear` eyepiece form and onboarding. Onboarding keeps its generic types as a "Not sure of the model?" fallback, and adds "the eyepieces that came with <model>". Saved data stays plain numbers: no migration and no API change. Roadmap S-12, GitHub #113.

## Current State Analysis

- **Telescope and eyepiece forms**
  - Both are controlled React islands that post plain HTML forms.
  - Telescope fields: `name`, `apertureMm`, `focalLengthMm` (`src/components/gear/TelescopeForm.tsx:42-44`).
  - Eyepiece fields: `name`, `focalLengthMm`, an `afovPreset` type select, and `afovDeg`, shown only for `other` (`src/components/gear/EyepieceForm.tsx:40-48,112-163`).
  - Validation uses the shared zod schemas (`src/lib/gear/schemas.ts:34-38,83-114`).
- **Onboarding**
  - The telescope step has five generic preset radios over always-visible editable fields (`src/components/onboarding/OnboardingWizard.tsx:127-131,170-177,410-492`, `src/lib/onboarding/presets.ts:21-32`).
  - The eyepiece step has three kit radios and per-row eyepiece fieldsets (`:132-138,179-205,494-640`, `presets.ts:56-64`).
  - It posts hidden inputs only (`:210-226,299-302`).
- **An ARIA 1.2 combobox already exists:** `src/components/observations/TargetPicker.tsx` (183 lines), with its filter in `src/lib/observations/target-search.ts` (`normalizeQuery` and the Messier-specific `filterTargets`).
- **There is no gear catalogue data**, and no openly licensed dataset to import (research: Stellarium is GPL, the community ocular.ini has no licence, AstroBin forbids scraping, and the EU *sui generis* database right applies).
- Full findings: `context/changes/gear-catalogue/research.md`.

## Desired End State

**On `/gear/telescopes/new`, `/gear/telescopes/[id]`, `/gear/eyepieces/new` and `/gear/eyepieces/[id]`:**
- A "Find your model" combobox sits above the unchanged fields, with the hint "Not listed? Fill in below."
- Typing "heritage 130" lists "Sky-Watcher Heritage-130P FlexTube".
- Choosing a model fills the fields:
  - telescope: name, aperture, focal length;
  - eyepiece: name, focal length, type, plus the exact AFOV when it isn't 50, 68 or 82°.
- Every filled field stays editable, and saving works exactly as today.

**In onboarding:**
- The telescope step leads with the same combobox. A collapsed "Not sure of the model? Pick a type" disclosure holds the five generic types, and the fields below show what will be saved (the 150/750 default, as today).
- If the chosen catalogue telescope ships with known eyepieces, the eyepiece step offers a first kit option, "Came with <model>: 25 + 10 mm", and selects it.
- Each eyepiece row has its own search.

**The catalogue itself:**
- It holds at least 300 telescopes and 250 eyepieces.
- Each entry has a source URL. Estimated values are flagged, and zoom eyepieces appear once per click stop.
- A unit test validates every entry against the gear schemas.
- A documented independent check covers at least 10% of entries.

**Verify:** unit tests, the updated e2e tests, and the screenshot set (EN/PL × dark/light/red × 390 px/desktop).

### Key Discoveries:

- `TargetPicker` already implements the keyboard model, the outside-the-listbox status line and the 44 px rows with token classes. It posts a hidden field rather than its input text (`TargetPicker.tsx:96-176`). Gear needs the same component without the hidden field: its host fields carry the POST.
- `presetForAfov` (`src/lib/gear/eyepiece-presets.ts:24`) maps 50, 68 and 82° to named presets. Any other AFOV must fill `afovPreset = "other"` plus `afovDeg`.
- The schema limits every entry must satisfy: name 1–60 characters, aperture 20–1000, telescope focal length 100–5000, eyepiece focal length 2–60, AFOV an integer 30–120 (`schemas.ts`; the database mirrors them in `supabase/migrations/20260924120000_sites_and_gear.sql:46-53,78-85`).
- Gear islands may import only island-safe modules (`context/archive/2026-09-24-sites-and-gear-management/plan.md:49`). The catalogue must be island-safe, and it must live apart from the server-only `src/lib/catalogue/` (Messier and stars).
- e2e tests fill `#name`, `#apertureMm` and `#focalLengthMm` directly (`tests/e2e/telescope-selector.spec.ts:22-31`, `observation-log-management.spec.ts:24-33`). These ids stay and stay visible.
- `tests/e2e/onboarding.spec.ts:44-45` asserts that the `n150` and `pair` radios are checked by default.
- PRD FR-006 (`context/foundation/prd.md:189`) requires a fixed, named onboarding preset set. The generic presets stay, so FR-006 still holds; the PRD gets a note that the catalogue is added in front of them.

## What We're NOT Doing

- No database migration, no stored model id, and no API or route change. Saved gear stays numbers only.
- No real zoom support. A zoom eyepiece appears once per click stop, and the engine still sees one focal length per eyepiece.
- No astrographs faster than f/3 (RASA, Hyperstar).
- No barlows, focal reducers, telescope types or mounts as data fields. A mount variant goes in `aliases`, not in a separate entry.
- No user-submitted additions or in-app "suggest a model" flow.
- No bulk import from Stellarium, AstroBin, astronomy.tools or any retailer database. Every entry is hand-entered from a manufacturer page (or a retailer page when the manufacturer doesn't publish it).
- No catalogue on the site form, and no changes to Tonight or the engine.
- The generic onboarding presets and kits are not removed, and their labels don't change.

## Implementation Approach

1. Build the shared combobox and a gear search first (phase 1).
2. Define the catalogue's types, validation and fill helpers with a small verified seed (phase 2), so the UI phases (3, 4) work against real but short data.
3. Grow the data to full size in phase 5, as pure data work behind the same validation test, with an independent spot check.

**How the data reaches the forms:**
- The catalogue loads as its own chunks, one for telescopes and one for eyepieces, through a dynamic `import()` started when a form mounts. It is not passed as page props: about 550 entries would add tens of KB to every gear page's HTML.
- While the chunk loads, the combobox shows its loading state. If the import fails, it shows "List unavailable: fill in below" and the manual fields are unaffected.
- The service worker already precaches the build's `/_astro` files, so the chunks are cached like any other asset.

## Critical Implementation Details

- **The combobox input must never post.** It has no `name`, like `TargetPicker`'s visible input. The gear forms' own fields carry the POST, and onboarding's payload is still its hidden inputs (its radios also post `telescopePreset`/`eyepieceKit`, which nothing reads; that stays harmless).
- **Enter must not submit the form while an option is highlighted.** `TargetPicker` already handles this (`:72-77`), and the shared component must keep it, because a gear form submits on Enter.
- **State sequencing in onboarding:**
  - Picking a catalogue telescope clears the generic radio selection.
  - Picking a generic type clears the combobox text.
  - In both cases the fields below are overwritten, and the user can edit them afterwards.
  - `telescopeId` becomes `TelescopePresetId | null`: null after a catalogue pick.
  - The kit state becomes `EyepieceKitPresetId | "bundled"`. `bundled` lives outside `EYEPIECE_KIT_PRESETS`, so the fixed preset set, `kitPreset()` and `presets.test.ts` stay as they are. It has its own card, with a parameterised "Came with {model}" label, and its own rows builder from `eyepieceFill`, since `kitRow` only accepts Plössl preset keys.
  - A `kitTouched` flag is set when the user picks any kit card. Picking a catalogue telescope with bundled eyepieces auto-selects `bundled` only while `kitTouched` is false.
  - While the kit is `bundled`, picking another catalogue telescope with bundled eyepieces replaces the rows with its eyepieces.
  - Picking a telescope without bundled eyepieces, or a generic type, while the kit is `bundled` switches to `pair` and replaces the rows, as `chooseKit` does today.
  - The "Came with" card renders only once the eyepieces chunk has loaded and the telescope's bundled ids resolve. If the chunk fails, the card never appears.
- **Hidden radios in e2e:** the generic radios move inside a collapsed `<details>`, and Playwright's `getByRole` skips hidden elements. `onboarding.spec.ts` must open the disclosure before asserting `n150`.

## Phase 1: Shared combobox and gear search

### Overview

Generalise `TargetPicker` into a shared `forms/Combobox.tsx` that the log's object picker keeps using unchanged. Add the gear search rule and the combobox's copy.

### Changes Required:

#### 1. Shared combobox

**File**: `src/components/forms/Combobox.tsx` (new), `src/components/observations/TargetPicker.tsx`, `CLAUDE.md` (components list)

**Intent**: Move the ARIA 1.2 combobox mechanics out of `TargetPicker` into a generic component.
- The mechanics: input with `role="combobox"`, a listbox, arrow, Enter and Escape handling, a status line outside the listbox, 44 px rows, scroll-into-view, and mouse-down that keeps focus.
- `TargetPicker` becomes a thin wrapper that keeps its hidden `target` field and its Messier search.
- The new component adds a `loading` state, an `unavailable` state, a result cap with a "keep typing" status, and an optional `hint` line under the input ("Not listed? Fill in below.").

**Contract**: `Combobox<T>` lives in `src/components/forms/`, next to `FormField` and `ChoiceCard`, because it uses `FieldError` and `forms` already depends on `ui`, never the reverse. Props:
- `id`, `label`, `placeholder`, `options: readonly T[]`, `state: "loading" | "ready" | "unavailable"`;
- `text` + `onTextChange` (controlled text, so a host can clear it);
- `defaultOpen?` / `defaultActive?` (for the `/design` state cells);
- `filter: (options, query) => T[]`, `getKey`, `getLabel`, `getDetail`;
- `onSelect(option: T)`, `initialLabel?`, `hint?`, `status` strings (no match, loading, unavailable, more results);
- `maxResults` (default 50), `error?`.

`aria-describedby` lists the hint id and, when present, the error id. The visible input has no `name`. Token classes only, and the list keeps `bg-surface` (`TargetPicker.tsx:139,173`) so the log picker looks the same. The log keeps its accessible name and its Enter-submits-when-nothing-is-highlighted behaviour (`observation-log-management.spec.ts:83-86,104`). The existing log e2e and `target-search.test.ts` must pass unchanged.

#### 2. Gear search rule

**File**: `src/lib/gear/catalogue/search.ts` (new), `search.test.ts` (new)

**Intent**: Implement the "every word matches" rule:
- Each space-separated token of the normalised query must be a substring of the normalised name or one of its aliases.
- Normalisation: reuse `normalizeQuery`, and also treat `-`, `/` and `.` as spaces, so "heritage 130" matches "Heritage-130P" and "150/750" matches "150 750".
- Ranking: entries whose `name` (which starts with the brand) or one of its words starts with the first token come first, then catalogue order.

**Contract**: `searchCatalogue<T extends { name: string; aliases?: readonly string[] }>(entries: readonly T[], query: string): T[]`. Island-safe: it imports only `normalizeQuery` (moved to `src/lib/text/normalize.ts` and re-exported from `target-search.ts`, so gear doesn't depend on the observation log).

#### 3. Copy

**File**: `src/i18n/messages/en.ts`, `pl.ts`

**Intent**: Add the combobox strings for telescope and eyepiece:
- label, placeholder, hint, no-match ("No match: fill in below"), loading, unavailable, more results (plural);
- the option detail formats: "130 mm · 650 mm · f/5", "25 mm · 52°", "≈45° (estimated)", "discontinued".

**Contract**: new keys under `gearCatalogue.*`. PL parity is enforced by `src/i18n/i18n.test.ts`. Numbers in the detail lines arrive pre-formatted with the island's `Intl.NumberFormat` for the locale (as `OnboardingWizard.tsx:117` does), so PL reads "f/4,9".

#### 4. Kitchen sink

**File**: `src/pages/design.astro`, `src/components/design/ComboboxDemo.tsx` (new)

**Intent**: Add a `c-combobox` section showing the 7-state matrix: default, hover row, focus-visible, disabled, error, empty (no match) and loading.
- Astro can't pass function props to a `client:load` island, so a small `ComboboxDemo` island owns the sample options and the `filter`/`getLabel`/`onSelect` functions. It takes only serialisable props: the state to show, plus the copy.
- The interactive specimen is hydrated, and the static state cells use `defaultOpen` / `defaultActive`.

**Contract**: follows the existing section pattern (`block`, `blockTitle`, state cells).

### Success Criteria:

#### Automated Verification:

- `search.test.ts` covers: "heritage 130" matching "Heritage-130P"; "150/750"; Polish diacritics; aliases; ranking (brand or model prefix first); an empty query returning everything.
- The existing log picker tests still pass: `npm test` (`target-search.test.ts`) and `tests/e2e/observation-log-management.spec.ts`.
- `npm run lint`, `npx astro check` and `npm test` pass, including i18n parity, no-hardcoded-colours and red-theme.

#### Manual Verification:

- `/design` shows the combobox in all 7 states in dark, light and red, and keyboard navigation works there.
- The log's "Add observation" object picker behaves as before: arrow keys, Enter to choose, Escape to close, a click to pick.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Catalogue data model, fill helpers and seed

### Overview

Define the catalogue's shape, validation and the pure mapping onto form fields. Ship about 40 verified seed entries, so phases 3 and 4 work against real data.

### Changes Required:

#### 1. Types and data files

**File**: `src/lib/gear/catalogue/types.ts`, `telescopes.json`, `eyepieces.json` (new)

**Intent**: Define island-safe types and hand-entered JSON data. The JSON stays prettier-formatted, because it is authored by hand rather than generated.

**Contract**:
- Telescope entry: `{ id, brand, model, name, apertureMm, focalLengthMm, aliases?, bundledEyepieces?: string[] /* eyepiece ids */, discontinued?: true, source: url }`.
- Eyepiece entry: `{ id, brand, line, name, focalLengthMm, afovDeg /* integer */, design?: "plossl" | "kellner" | "huygens" | "orthoscopic" | "other", afovEstimated?: true, zoom?: { minMm, maxMm }, aliases?, discontinued?: true, source: url }`.
- `name` is what fills the form, at most 60 characters.
- `id` is a stable kebab slug, e.g. `skywatcher-heritage-130p`, `baader-hyperion-zoom-8-24-at-12`.

#### 2. Fill helpers and loader

**File**: `src/lib/gear/catalogue/fill.ts`, `load.ts` (new)

**Intent**:
- `fill.ts` maps an entry onto form state as strings: `telescopeFill(entry)` → `{ name, apertureMm, focalLengthMm }`, and `eyepieceFill(entry)` → `{ name, focalLengthMm, afovPreset, afovDeg }`, using `presetForAfov`.
- `bundledEyepieces(telescope, eyepieces)` resolves a telescope's bundled ids to entries.
- `load.ts` wraps the dynamic `import()` of each JSON file, once per page, memoised, returning the typed arrays.

**Contract**: `loadTelescopes(): Promise<readonly TelescopeEntry[]>`, `loadEyepieces(): Promise<readonly EyepieceEntry[]>`. Each JSON file becomes its own chunk, not part of a form chunk.

#### 3. Validation test

**File**: `src/lib/gear/catalogue/catalogue.test.ts` (new)

**Intent**: Pin data integrity:
- Every telescope fill passes `telescopeInputSchema`, and every eyepiece fill passes `eyepieceInputSchema`.
- Ids are unique, and `name` values are unique within each file.
- `source` is an https URL.
- Every `bundledEyepieces` id exists, and points at an eyepiece.
- A zoom entry's focal length lies within its own range.
- Focal ratio is plausible (f/3–f/16). Astrographs faster than f/3 (RASA, Hyperstar) are out of scope.
- At most one decimal on every number (the database stores `numeric(…,1)`).
- An `afovEstimated` entry either has a `design` whose AFOV equals the README's typical value for it, or is a zoom click stop.

#### 4. Provenance and licence

**File**: `src/lib/gear/catalogue/LICENSE-DATA.md` (new, following `src/lib/catalogue/LICENSE-DATA.md`), `src/lib/gear/catalogue/README.md` (new)

**Intent**: State that:
- the data was entered by hand from manufacturer specification pages, each linked in `source`, with no bulk extraction from any database;
- it is released under CC0, separate from the app code;
- brand names are trademarks used only to identify products;
- which estimated AFOV value is used per eyepiece type (Plössl 50°, Kellner/SR 45°, Huygens/H 40°);
- how zoom eyepieces' click stops and interpolated AFOVs are derived: linear between the published ends, rounded to whole degrees, and flagged `afovEstimated`.

`LICENSE-DATA.md` carries the provenance, CC0 and trademark lines. The README covers how to add an entry, including a rule for shortening names to fit 60 characters (e.g. "Mak" for Maksutov-Cassegrain, "SCT", and no mount in the name).

#### 5. Seed data

**File**: `telescopes.json`, `eyepieces.json`

**Intent**: About 20 telescopes and 20 eyepieces, each checked against its source page:
- the verified research samples (Heritage-130P, StarSense Explorer DX 130AZ, Skymax 127, NexStar 5SE, StarBlast 4.5, National Geographic 114/900);
- Sky-Watcher's bundled 25 and 10 mm, linked from the Heritage-130P;
- Omni Plössl and X-Cel LX;
- one zoom with its click stops.

### Success Criteria:

#### Automated Verification:

- `catalogue.test.ts` and the `fill.ts` unit tests pass:
  - 52° fills `other` + 52;
  - 68° fills `wide`;
  - an unknown bundled id fails the test.
- `npm run lint`, `npx astro check` and `npm test` pass.
- `npm run build` emits separate chunks for the two JSON files: they appear as their own files in `dist/client/_astro/`. *Verified in phase 3:* nothing on the client imports `load.ts` until the forms do, so phase 2 cannot emit the chunks (see 3.8).

#### Manual Verification:

- The README reads clearly, and a sample of seed entries matches its source pages.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Catalogue on the /gear forms

### Overview

Put the combobox on top of the telescope and eyepiece forms, both new and edit, with the fields always visible below.

### Changes Required:

#### 1. Telescope form

**File**: `src/components/gear/TelescopeForm.tsx`

**Intent**:
- Start `loadTelescopes()` on mount, and render the `Combobox` above the name field with the "Not listed? Fill in below." hint.
- On select, set name, aperture and focal length from `telescopeFill` and clear their field errors. The derived f/ratio updates as today.
- In edit mode the combobox starts empty and the fields hold the saved values.

**Contract**: props unchanged. Field ids `name`, `apertureMm` and `focalLengthMm` stay. The POST body is unchanged.

#### 2. Eyepiece form

**File**: `src/components/gear/EyepieceForm.tsx`

**Intent**: The same, with `loadEyepieces()` and `eyepieceFill`. Selecting a non-preset AFOV switches the type to "other" and shows the exact degrees. The option detail marks estimated AFOVs and zoom settings.

**Contract**: props and POST body unchanged. FR-009's type picker stays for manual entry.

#### 3. e2e

**File**: `tests/e2e/gear-catalogue.spec.ts` (new)

**Intent**: One test only, covering what screenshots can't show:
- On `/gear/telescopes/new`, type "heritage 130" and press Enter (typing already highlights the best match, `TargetPicker.tsx:116`; ArrowDown would move to the second). Assert that `#name`, `#apertureMm` and `#focalLengthMm` hold the Heritage values.
- Save, and see the success notice.

### Success Criteria:

#### Automated Verification:

- `tests/e2e/gear-catalogue.spec.ts` passes against the local preview recipe.
- The existing `telescope-selector.spec.ts` and `observation-log-management.spec.ts` pass unchanged.
- `npm run lint`, `npx astro check` and `npm test` pass.
- Catalogue chunks are separate: `npm run build && ls dist/client/_astro | grep -E '^(telescopes|eyepieces)\.'` lists both, and `grep -l Heritage dist/client/_astro/TelescopeForm*.js` finds nothing.

#### Manual Verification:

- Screenshots of the telescope and eyepiece forms with the list open and after a pick, in EN/PL × dark/light/red at 390 px and desktop:
  - nothing overflows at 390 px with Polish copy;
  - the focus ring is visible;
  - the red theme has no green or blue.
- Edit mode starts with an empty combobox and the saved values, and picking a model overwrites them.
- Picking a 52° eyepiece shows type "Other" with 52.
- With the network throttled the loading state shows. With the chunk blocked, "List unavailable" shows and the manual entry still saves.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Catalogue in onboarding

### Overview

Lead the telescope step with the combobox, keep the generic types behind "Not sure of the model?", add the "Came with <model>" kit and a search on each eyepiece row.

### Changes Required:

#### 1. Telescope step

**File**: `src/components/onboarding/OnboardingWizard.tsx`

**Intent**:
- Render the telescope `Combobox` first.
- Move the five `ChoiceCard` radios into a native `<details>`, collapsed, summary "Not sure of the model? Pick a type".
- Keep the editable fields below. The state sequencing follows Critical Implementation Details.
- Default state is unchanged: the `n150` values fill the fields and its radio is checked inside the disclosure.

**Contract**: the hidden payload fields (`telescopeName`, `apertureMm`, `focalLengthMm`) are unchanged, and `onboardingInputSchema` is untouched.

#### 2. Eyepiece step

**File**: `src/components/onboarding/OnboardingWizard.tsx`

**Intent**:
- When the chosen catalogue telescope has `bundledEyepieces`, a first `ChoiceCard` reads "Came with <model>", with the eyepieces listed. Choosing it fills the rows from `eyepieceFill`.
- Each eyepiece row gets its own `Combobox` (ids `eyepiece-${key}-model`) above its fields.
- "Add eyepiece" and removal work as today.
- Kit state, `kitTouched` and the transitions follow Critical Implementation Details. `src/lib/onboarding/presets.ts` is unchanged, and `DEFAULT_EYEPIECE_KIT_ID` stays `pair`.
- The kit grid gains a fourth card. Check its `sm:grid-cols-3` layout (`:504`) in the screenshots.

**Contract**: the `eyepieces` JSON payload is unchanged.

#### 3. Copy, PRD note and tests

**File**: `src/i18n/messages/en.ts`, `pl.ts`, `context/foundation/prd.md`, `tests/e2e/onboarding.spec.ts`, `src/lib/onboarding/presets.test.ts`

**Intent**:
- Add the disclosure summary and the "Came with {model}" kit copy.
- Add a quoted note under FR-006: on 2026-10-06 (M-2 S-12) a catalogue search was added in front of the fixed presets, which stay as the "Not sure" fallback.
- `onboarding.spec.ts` keeps its default-path test as it is, adding only the step that opens the disclosure before asserting `n150`. A separate test with its own sign-up picks "heritage 130" (type + Enter), sees the "Came with" kit selected with 25 + 10 mm rows, and finishes onboarding. The bundled eyepiece names contain "25 mm", so the existing `/25 mm/` targets check still applies.
- `presets.test.ts` keeps passing (the generic presets are unchanged).

### Success Criteria:

#### Automated Verification:

- `tests/e2e/onboarding.spec.ts` passes with the opened-disclosure assertion and the new catalogue path.
- `npm run test:db` passes (onboarding RPC unchanged).
- `npm run lint`, `npx astro check` and `npm test` pass.

#### Manual Verification:

- Screenshots of the onboarding telescope and eyepiece steps (EN/PL × dark/light/red × 390 px/desktop): the disclosure closed and open, after a catalogue pick, the "Came with" kit, and a row with its search open.
- The under-a-minute path still works: accepting the defaults without touching the combobox finishes onboarding with 150/750 and the 25 + 10 mm pair.
- These kit transitions behave as specified:
  - picking a generic type after a catalogue scope, while "Came with" is selected, falls back to `pair`;
  - a manually chosen kit is never replaced.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Full catalogue curation and close-out

### Overview

Grow the data to at least 300 telescopes and 250 eyepieces from manufacturer pages, verify a sample independently, and document the feature.

### Changes Required:

#### 1. Curation

**File**: `src/lib/gear/catalogue/telescopes.json`, `eyepieces.json`

**Intent**: Enter models brand by brand, current plus common second-hand.

Telescopes:
- Sky-Watcher;
- Celestron;
- Bresser and National Geographic;
- Levenhuk;
- Omegon;
- Delta Optical;
- Orion (US);
- Meade;
- Explore Scientific;
- Apertura, Zhumell and GSO;
- Saxon;
- refractors from Askar, William Optics and TS-Optics.

Eyepieces:
- the lines from those brands, plus Baader, TeleVue, SVBony, BST/StellaLyra, Explore Scientific and Pentax basics;
- every focal length in each line;
- zooms by click stop;
- the bundled eyepieces of popular scopes, linked through `bundledEyepieces`.

Rules for each entry:
- one entry per optical tube, with mount variants in `aliases`;
- the focal length goes in the name whenever a model name is shared;
- a catadioptric uses its effective focal length;
- a missing manufacturer page means a retailer source;
- no copied descriptions.

How the work is done:
- Subagents with web access each draft one brand group, with sources, into the session scratchpad. They never write to the repo.
- The main agent reviews each draft and merges it into the two JSON files in a fixed order: brand alphabetically, then aperture (telescopes) or line and focal length (eyepieces).
- Prettier and `catalogue.test.ts` run after every merge.
- Commit after each brand group, so the phase can resume across sessions. Expect more than one session.
- Nothing is copied from the excluded databases.

#### 2. Independent check

**File**: `context/changes/gear-catalogue/reviews/catalogue-spot-check.md` (new)

**Intent**:
- A separate agent re-reads the source page of a random sample of at least 10% of entries per file, plus every `afovEstimated` and zoom entry, and records match or mismatch.
- Mismatches are fixed before close-out.

#### 3. Size floor and docs

**File**: `src/lib/gear/catalogue/catalogue.test.ts`, `CLAUDE.md`, `context/handoff.md`, `context/foundation/roadmap.md`

**Intent**:
- The test asserts at least 300 telescopes and 250 eyepieces, so a bad merge can't silently shrink the list.
- CLAUDE.md gets a short "Gear catalogue (S-12)" note: where the data lives (and that it is not the server-only `src/lib/catalogue/`), the hand-entry and source rule, the shared `forms/Combobox`, and the lazy chunks.
- The handoff is updated, and roadmap S-12 plus board #113 move forward at close-out, as `/10x-archive` does.

### Success Criteria:

#### Automated Verification:

- `catalogue.test.ts` passes with the floors (≥ 300 telescopes, ≥ 250 eyepieces) and every entry valid.
- `npm run lint`, `npx astro check`, `npm test` and `npm run build` pass.
- The full e2e suite passes on the local preview recipe.

#### Manual Verification:

- `reviews/catalogue-spot-check.md` records the sample (≥ 10% per file plus every estimated and zoom entry) with all mismatches fixed.
- Searching for a handful of real beginner scopes on a phone-sized screen finds each one: Heritage 150P, AstroMaster 130EQ, Skyliner 200P, Delta Optical, Bresser Messier.
- The catalogue chunk sizes are noted in the PR, and the gear pages' first load is not visibly slower.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `search.test.ts`: tokens, separators, diacritics, aliases, ranking, empty query.
- `fill.ts` tests: preset mapping (50/68/82 to named presets, otherwise "other"), string formatting, bundled resolution.
- `catalogue.test.ts`: every entry against the gear schemas, unique ids and names, sources, bundled references, zoom bounds, f-ratio plausibility, size floors.

### Integration Tests:

- `tests/e2e/gear-catalogue.spec.ts`: pick a telescope on `/gear` and save.
- `tests/e2e/onboarding.spec.ts`: the default path behind the disclosure, plus a catalogue pick with the "Came with" kit.
- The existing log, telescope-selector and onboarding database tests stay green. Following the user's preference, no other new tests: screenshots cover the layout.

e2e runs on the "Local e2e recipe" in `context/handoff.md`, which follows CI's `smoke` job: local Supabase, the forecast fixture, `npm run build`, `dist/server/.dev.vars`, and `npx astro preview --port 4321`. Then run `SUPABASE_URL=$API_URL SUPABASE_KEY=$ANON_KEY BASE_URL=http://localhost:4321 npm run test:e2e -- <spec>`. Run `npx astro sync` before `npx astro check`.

### Manual Testing Steps:

1. `/gear/telescopes/new` in PL on a 390 px phone with the red theme: type "heritage", choose with the keyboard, edit the aperture, save.
2. `/gear/eyepieces/new`: pick a 60° X-Cel LX and see type "Other" with 60. Pick a Hyperion zoom click stop.
3. Onboarding: accept the defaults (150/750 + pair). Then repeat with a fresh user, pick Heritage 130P, and see the "Came with" kit.
4. Block the catalogue chunk in DevTools: "List unavailable" shows, and manual entry saves.

## Performance Considerations

- The catalogue is about 550 entries in two dynamically imported chunks (roughly 25–40 KB raw each, a fraction of that gzipped). It is not in the form chunks or the page HTML.
- The combobox renders at most 50 rows. Filtering 300 entries per keystroke is trivial.
- The service worker precaches every `_astro/**/*.js` file (`scripts/build-sw.mjs:49`), so every installing client downloads both catalogue chunks once, even without opening `/gear`. This is accepted, and the size is noted in the PR (5.6).

## Migration Notes

None. No schema change; saved gear is untouched. Existing users see the combobox in their gear forms.

## References

- Research: `context/changes/gear-catalogue/research.md` (including the user's UI decisions)
- Combobox to generalise: `src/components/observations/TargetPicker.tsx:1-183`
- AFOV presets: `src/lib/gear/eyepiece-presets.ts:8-24`
- Onboarding presets and steps: `src/lib/onboarding/presets.ts:21-64`, `src/components/onboarding/OnboardingWizard.tsx:127-205,410-640`
- Roadmap: `context/foundation/roadmap.md` S-12; GitHub #113

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared combobox and gear search

#### Automated

- [x] 1.1 search.test.ts covers tokens, separators, diacritics, aliases, ranking, empty query — cfbefa9
- [x] 1.2 Existing log picker tests still pass (target-search.test.ts, observation-log-management.spec.ts) — 36ae3b0
- [x] 1.3 npm run lint, npx astro check and npm test pass (i18n parity, colour and red-theme tests) — cfbefa9

#### Manual

- [ ] 1.4 /design shows the combobox in all 7 states in dark, light and red with working keyboard navigation
- [ ] 1.5 The log's object picker behaves as before

### Phase 2: Catalogue data model, fill helpers and seed

#### Automated

- [x] 2.1 catalogue.test.ts and fill tests pass (52° → other + 52, 68° → wide, unknown bundled id fails) — 23f0af8
- [x] 2.2 npm run lint, npx astro check and npm test pass — 23f0af8
- [x] 2.3 npm run build emits separate chunks for the two catalogue JSON files — 36ae3b0

#### Manual

- [ ] 2.4 README is clear and a sample of seed entries matches its source pages

### Phase 3: Catalogue on the /gear forms

#### Automated

- [x] 3.1 tests/e2e/gear-catalogue.spec.ts passes against the local preview — 36ae3b0
- [x] 3.2 telescope-selector.spec.ts and observation-log-management.spec.ts pass unchanged — 36ae3b0
- [x] 3.3 npm run lint, npx astro check and npm test pass — 36ae3b0
- [x] 3.8 Build lists separate telescopes/eyepieces chunks and the form chunk holds no catalogue data — 36ae3b0

#### Manual

- [ ] 3.4 Screenshots of both gear forms (list open, after a pick) in EN/PL × dark/light/red × 390 px/desktop
- [ ] 3.5 Edit mode starts with an empty combobox and saved values; a pick overwrites them
- [ ] 3.6 A 52° eyepiece pick shows type Other with 52
- [ ] 3.7 Loading state shows when throttled; blocked chunk shows List unavailable and manual entry saves

### Phase 4: Catalogue in onboarding

#### Automated

- [x] 4.1 onboarding.spec.ts passes with the disclosure assertion and the catalogue path — 04727c2
- [x] 4.2 npm run test:db passes — 04727c2
- [x] 4.3 npm run lint, npx astro check and npm test pass — 04727c2

#### Manual

- [ ] 4.4 Screenshots of the onboarding telescope and eyepiece steps in EN/PL × dark/light/red × 390 px/desktop
- [ ] 4.5 Accepting the defaults still finishes onboarding with 150/750 and the 25 + 10 mm pair
- [ ] 4.6 Kit transitions behave as specified (fallback to pair, a chosen kit never replaced)

### Phase 5: Full catalogue curation and close-out

#### Automated

- [x] 5.1 catalogue.test.ts passes with floors of 300 telescopes and 250 eyepieces — c10c350
- [x] 5.2 npm run lint, npx astro check, npm test and npm run build pass — c10c350
- [x] 5.3 The full e2e suite passes on the local preview — c10c350

#### Manual

- [ ] 5.4 reviews/catalogue-spot-check.md records at least 10% per file plus every estimated and zoom entry, mismatches fixed
- [ ] 5.5 A handful of real beginner scopes are found on a phone-sized screen
- [ ] 5.6 Catalogue chunk sizes noted in the PR; gear pages not visibly slower
