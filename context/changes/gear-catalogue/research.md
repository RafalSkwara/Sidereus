---
date: 2026-10-06T13:53:02+02:00
researcher: Claude (Opus 5.5) with three Sonnet research workers
git_commit: 1ead14004207b5ef1c1c341420436f5104b4a2b9
branch: feat/gear-catalogue
repository: Sidereus
topic: "S-12 gear catalogue: pick telescopes and eyepieces from a curated list that fills in the form"
tags: [research, gear, onboarding, combobox, catalogue-data, i18n]
status: complete
last_updated: 2026-10-06
last_updated_by: Claude (Opus 5.5)
---

# Research: S-12 gear catalogue

**Date**: 2026-10-06T13:53:02+02:00
**Researcher**: Claude (Opus 5.5), with three read-only Sonnet workers (gear code map, combobox options, data sources)
**Git Commit**: 1ead140 (main at the time of research; no source changes yet)
**Branch**: feat/gear-catalogue
**Repository**: Sidereus

## Research Question

Roadmap S-12 / GitHub #113. When adding a telescope or eyepiece, on the `/gear` pages and in onboarding, the user picks a real model from a long curated list in a searchable combobox. The pick fills in the form fields, which stay editable, and "Not listed? Enter manually" keeps manual entry. The research had to establish four things:
- what the forms and onboarding look like today;
- how to build the combobox in this repo;
- where the spec data can legally come from;
- which tests, PRD requirements and earlier decisions constrain the change.

## Summary

- **The forms are controlled React islands that store plain numbers.** A fill from the catalogue is just a `setState` per field, and no migration is needed.
  - The telescope form holds `name`, `apertureMm` and `focalLengthMm` as state (`src/components/gear/TelescopeForm.tsx:42-44`).
  - The eyepiece form holds `name` and `focalLengthMm`, an AFOV type (`afovPreset`) select and an `afovDeg` field. `afovDeg` is shown only for "other" (`src/components/gear/EyepieceForm.tsx:40-48,112-163`).
  - The database stores only numbers: `aperture_mm`, `focal_length_mm` and `afov_deg` (`supabase/migrations/20260924120000_sites_and_gear.sql:46-53,78-85`). There is no type, barlow, focal ratio or model-id column.
- **A tested ARIA 1.2 combobox already exists:** `src/components/observations/TargetPicker.tsx` (183 lines).
  - It has `role="combobox"`, a listbox, arrow, Enter and Escape handling, a `role="status"` "no match" line outside the listbox, 44 px rows, and only token classes.
  - Its pure filter is `src/lib/observations/target-search.ts`, which normalises case, accents and the Polish `ł`.
  - Generalising it into a shared `ui/` combobox avoids new dependencies. The combobox worker recommended hand-rolling one over adding cmdk with the Radix Popover stack, Base UI or a `<datalist>` (see Combobox options).
- **The data has to be hand-curated.**
  - No permissively licensed telescope or eyepiece dataset was found.
  - Stellarium's Oculars defaults are GPL, the largest community `ocular.ini` gist has no licence, and AstroBin's terms forbid bulk scraping.
  - EU and Polish database law (*sui generis* right) also restricts copying a substantial part of a database, even though each individual spec is a fact.
  - The safe route is entering each spec by hand from the manufacturer's page, with a `source` URL per entry.
- **Onboarding is the delicate part.**
  - Its telescope step shows five generic preset radios with editable fields under them (`src/components/onboarding/OnboardingWizard.tsx:170-177,410-492`, `src/lib/onboarding/presets.ts:21-27`).
  - The eyepiece step shows three kit radios and per-row eyepiece fieldsets (`:494-640`, `presets.ts:56-60`).
  - PRD FR-006 says "The preset set is fixed and named in the specification" (`context/foundation/prd.md:189`).
  - An e2e test selects the `n150` and `pair` radios by label (`tests/e2e/onboarding.spec.ts:43-45`).
  - So replacing the telescope radios is a product decision with a PRD and test footprint (see Open Questions).

## Detailed Findings

### Gear forms

- **TelescopeForm** (`src/components/gear/TelescopeForm.tsx`)
  - Props: `action`, `initial?`, `serverError?`, `locale` (`:17-23`).
  - New and edit share the component. Only `initial` differs (`:42-44`).
  - Validation runs on submit through `telescopeInputSchema.safeParse` (`:49-72`).
  - A derived f/ratio is shown, not saved (`:31,124-133`).
  - The fields are `FormField` inputs whose `name` defaults to `id` (`src/components/forms/FormField.tsx:73`), so they post `name`, `apertureMm` and `focalLengthMm`.
- **EyepieceForm** (`src/components/gear/EyepieceForm.tsx`)
  - The AFOV "type" is a `NativeSelect` named `afovPreset` (`:112-144`).
  - `afovDeg` renders only when the preset is `other` (`:146-163`).
  - In edit mode the preset is derived with `presetForAfov(initial.afovDeg)` (`:40`).
- **AFOV presets** (`src/lib/gear/eyepiece-presets.ts`)
  - `plossl` is 50°, `wide` 68° and `ultrawide` 82° (`:8-12`). Options are listed at `:17` and `presetForAfov` is at `:24`.
  - **Consequence:** a catalogue eyepiece with 52°, 60° or 66° must fill `afovPreset = "other"` and `afovDeg = <exact>`. One with exactly 50, 68 or 82 maps to the named preset. The fill function should use `presetForAfov`.
- **Schemas** (`src/lib/gear/schemas.ts`)
  - Name: trimmed, 1–60 characters (`:34-38`).
  - Telescope: aperture 20–1000 mm, focal length 100–5000 mm, decimals allowed (`:83-87,26-32`).
  - Eyepiece: focal length 2–60 mm (`:99`); `afovDeg` an integer 30–120, read only for `other` (`:93-114`).
  - The database mirrors these ranges: aperture `numeric(6,1)`, eyepiece focal length `numeric(4,1)`, AFOV `smallint`. These are the bounds a catalogue validation test must enforce.
- **Mounting**
  - `src/pages/gear/telescopes/new.astro:26` and `[id].astro:48-58` mount the telescope form.
  - The eyepiece pages are the same (`src/pages/gear/eyepieces/new.astro:26`, `[id].astro:48-58`).
  - All are `client:load`.

### Onboarding

- **Telescope step:** `ChoiceCard` radios named `telescopePreset` (`OnboardingWizard.tsx:416-433`). `chooseTelescope(id)` overwrites the always-visible editable name, aperture and focal-length fields (`:170-177`).
  - Presets (`presets.ts:21-27`): r102 102/500, n130 130/650, n150 150/750 (the default, `:32`), d200 200/1200, m127 127/1500.
  - The first-run-onboarding plan records n150 as the calibrated reference kit (`context/archive/2026-09-26-first-run-onboarding/plan-brief.md:31`). The same plan records "The telescope has no 'Other' preset beyond editing values" (`plan.md:65`).
- **Eyepiece step:** kits `pair` (25 + 10 mm Plössl, the default, `presets.ts:64`), `plossl-set` (32, 17, 13, 8 and 6 mm) and `none` (`:56-60`).
  - `chooseKit` replaces the rows (`:179-183`).
  - Each row is a fieldset with name, focal length, AFOV select and remove (`:494-640`), up to `MAX_ONBOARDING_EYEPIECES` = 10. "Add eyepiece" appends a blank Plössl row (`:205`).
  - No row has a catalogue picker today.
- **Submit:** the visible controls have `name=""`. Only hidden inputs post: `telescopeName`, `apertureMm`, `focalLengthMm`, and `eyepieces` as a JSON array (`:210-226,299-302`).
  - These are validated by `onboardingInputSchema` (`src/lib/onboarding/schemas.ts:56-78`), which reuses the gear schemas.
  - They are saved atomically by the `complete_onboarding` RPC (`supabase/migrations/20260926120000_complete_onboarding.sql:14-59`), called from `src/pages/api/onboarding.ts:25-36`.
  - **Consequence:** a combobox inside the wizard only sets state. The wizard's payload builder already carries the values.
- **Copy:** preset labels are i18n keys `onboarding.telescopes.<id>` and `onboarding.eyepieceKits.<id>` (`src/i18n/messages/en.ts:346-357`). Kit eyepiece names are data (`` `${mm} mm Plössl` ``, `presets.ts:53`).

### Combobox options

Weighed for this repo by the combobox worker, then checked against `TargetPicker.tsx`:

| Option | New dependencies | Fit |
|---|---|---|
| Generalise `TargetPicker` into a shared `ui/combobox.tsx` | none | Already ARIA 1.2, uses only token classes, renders inline (no portal), and is proven in the log form. It needs generic `Option`/`onSelect` types, an empty/"no match" state with a manual-entry action, and a `/design` 7-state section. |
| shadcn Popover + Command (cmdk) | `cmdk`, `@radix-ui/react-popover` and its Radix and Popper dependencies | A portalled popover struggles with the phone keyboard. Generated styles would need a token review against the two colour tests. Per the worker's estimate (unverified), it is heavier than the gear form chunks themselves (3.1 KB and 2.7 KB, `dist/client/_astro`, from a stale local build). |
| shadcn Combobox (Base UI) | `@base-ui/react` | A new primitive family next to Radix. The worker didn't confirm it with the repo's `new-york` registry. |
| `<input list>` + `<datalist>` | none | Drawn by the OS, so the red theme can't reach it. Substring matching is inconsistent (iOS shows suggestions in the keyboard bar). The label can't differ from the value. Rejected. |

- **Shared parts:** `normalizeQuery` (`target-search.ts`) is reusable as is. `filterTargets` is Messier-specific (number queries), and it matches the whole query as one substring.
  - "heritage 130" against "Sky-Watcher Heritage-130P FlexTube" fails as a single substring because of the hyphen.
  - The gear filter therefore needs a "every space-separated token is a substring of the normalised name or alias" rule, with hyphens normalised to spaces. This is a new pure function with its own unit test.
- **How options reach the island:** `TargetPicker` takes `options` as props built by the page (`src/pages/log/new.astro:72`), which serialises them into the island's props in the HTML.
  - For about 300–500 gear entries at ~80 B each, that is ~25–40 KB raw per page. That's a worker estimate, not measured.
  - The alternative is a dynamic `import()` of the catalogue module on first focus.
  - The forms and the wizard both mount with `client:load`. The plan should pick one approach and measure it.

### Catalogue data: sources, licence and shape

- **Sources checked** (data-source worker; links in the worker report, summarised):
  - Stellarium `plugins/Oculars/resources/default_ocular.ini`: about 18 eyepieces and 22 telescopes, GPL.
  - A community `ocular.ini` gist: 298 eyepieces and 563 telescopes, no licence.
  - AstroBin's equipment database: its terms forbid bulk scraping.
  - astronomy.tools, Telescopius and SkySafari: proprietary or unverified terms.
  - None can be copied into an MIT-licensed repo. They are only useful as checklists of which models exist.
- **Legal notes:**
  - Individual specs are facts, not copyrightable.
  - The EU *sui generis* database right (Directive 96/9/EC; Polish Act of 27 July 2001 on the protection of databases) restricts extracting a substantial part of someone else's database.
  - Hence: enter by hand from manufacturer pages, cross-check one retailer, never copy descriptions or images, and record a `source` URL per entry.
- **Verified samples** (seen on manufacturer or retailer pages in the worker's searches):
  - Sky-Watcher Heritage-130P FlexTube 130/650, ships with 10 and 25 mm eyepieces.
  - Celestron StarSense Explorer DX 130AZ 130/650.
  - Sky-Watcher Skymax 127 127/1500.
  - Celestron NexStar 5SE 125/1250.
  - Orion StarBlast 4.5 114/450.
  - Bresser National Geographic 114/900.
  - Celestron Omni Plössl 52° and X-Cel LX 60°.
  - Baader Hyperion Zoom Mark IV 8–24 mm (AFOV varies with focal length).
  - About 40 more models and lines were listed from the worker's memory, unverified. Each needs checking against its manufacturer page during implementation.
- **Data pitfalls to design for:**
  - **Mount variants:** one optical tube is sold on several mounts with the same optics, so there is one entry per tube, and the mount goes in aliases.
  - **Same name, different focal length:** e.g. Explorer 130/900 and 130/650. The focal length must appear in the name.
  - **OEM rebrands** across Sky-Watcher, Orion, Omegon and others: each brand gets its own entry.
  - **Discontinued but common second-hand models.**
  - **Catadioptric telescopes** (Maksutov, Schmidt-Cassegrain): use their effective focal length.
  - **Zoom eyepieces:** one focal length and AFOV per stored row (`EyepieceForm` stores one of each). A zoom therefore has to become several fixed entries or a single representative value.
  - **Bundled eyepieces** (the generic "Sky-Watcher 25 mm/10 mm" that ships with beginner scopes) have no published AFOV. Kellner-type is roughly 40–52° (unverified).
  - **Barlows:** the schema has nowhere to store them, so they are out of scope.
- **Fits the form limits:**
  - Every known beginner telescope (76–254 mm aperture, 300–2032 mm focal length) and eyepiece (2.3–40 mm) sits inside the schema ranges.
  - Names must fit in 60 characters. "Sky-Watcher Heritage-130P FlexTube" is 34.

### Tests and docs that pin current behaviour

- **e2e**
  - `tests/e2e/onboarding.spec.ts:43-45` selects radios by `en.onboarding.telescopes.n150` and `en.onboarding.eyepieceKits.pair`.
  - `:55-58` expects a 25 mm eyepiece in the first target row.
  - `tests/e2e/telescope-selector.spec.ts:22-31` and `observation-log-management.spec.ts:24-33` fill `#name`, `#apertureMm` and `#focalLengthMm` in the telescope form. Those ids must stay and stay visible.
  - No e2e spec fills the eyepiece form.
- **Unit:** `src/lib/onboarding/presets.test.ts:21-53` checks that every preset passes the gear schemas. `src/lib/gear/schemas.test.ts`, `eyepiece-presets.test.ts` and `src/lib/onboarding/schemas.test.ts` also apply.
- **Database:** `tests/db/onboarding.test.ts:173,192` posts eyepieces with `afovPreset` `plossl` and `other`.
- **i18n:** `src/i18n/i18n.test.ts:39` requires PL parity. Brand and model names are data, not catalogue copy.
- **`/design`:** a kitchen-sink section per shared component, with a 7-state table (`src/pages/design.astro`, around `:143-152`). `TargetPicker` isn't in `/design` today.
- **PRD:**
  - FR-006 (`prd.md:189`): fixed, named onboarding presets.
  - FR-009 (`prd.md:204`): manual eyepiece entry offers the type picker rather than a bare number. The catalogue must keep that picker for manual entry.

## Code References

| Location | What's there |
|---|---|
| `src/components/gear/TelescopeForm.tsx:17-23,42-72,124-133` | Props, controlled state, submit validation, f/ratio |
| `src/components/gear/EyepieceForm.tsx:40-48,112-163` | Preset derivation, AFOV select and "other" field |
| `src/lib/gear/eyepiece-presets.ts:8-24` | AFOV presets and `presetForAfov` |
| `src/lib/gear/schemas.ts:26-38,83-114` | Bounds the catalogue must respect |
| `src/lib/gear/store.ts:209-211,270-272` | Column mapping (numbers only) |
| `src/components/onboarding/OnboardingWizard.tsx:170-183,210-226,410-640` | Preset handlers, payload, telescope and eyepiece steps |
| `src/lib/onboarding/presets.ts:21-64` | Generic telescope presets and kits |
| `src/components/observations/TargetPicker.tsx:1-183` | Existing ARIA 1.2 combobox to generalise |
| `src/lib/observations/target-search.ts` | `normalizeQuery` (reusable) and `filterTargets` (Messier-specific) |
| `src/components/forms/FormField.tsx:73` | `name` defaults to `id`; the combobox input must not post a field |
| `tests/e2e/onboarding.spec.ts:43-58` | Onboarding preset selectors |

## Architecture Insights

- **Island-import boundary:** gear islands may import only zod, `zones.ts`, `coordinates.ts`, `eyepiece-presets.ts` and the engine parameters (`context/archive/2026-09-24-sites-and-gear-management/plan.md:49`). A catalogue module must be island-safe, and its size counts because it ships to the browser. That points to `src/lib/gear/catalogue/` with data plus pure helpers, separate from the server-only `src/lib/catalogue/` (Messier and stars).
- **A fill is pure:** `telescopeFill(entry)` → `{name, apertureMm, focalLengthMm}` as strings, and `eyepieceFill(entry)` → `{name, focalLengthMm, afovPreset, afovDeg}` via `presetForAfov`. Both are testable without React.
- **The input text is never posted:** like `TargetPicker`, the combobox input must have no `name` (the forms' own fields carry the POST), consistent with the island's plain-POST pattern.
- **Data stays data:** hand-curated JSON (or a typed TS array) with `id`, `brand`, `model`, numbers, `aliases`, `source`, plus a schema test (ranges, unique ids, name ≤ 60, f/ratio plausible). This follows the roadmap risk note (`roadmap.md` S-12).

## Historical Context (from prior changes)

| Source | Decision recorded |
|---|---|
| `context/archive/2026-09-26-first-run-onboarding/plan-brief.md:31` | Why the five telescope presets exist (n150 is the calibrated reference kit) |
| `context/archive/2026-09-26-first-run-onboarding/plan.md:65` | The telescope has no "Other" preset; values are editable instead |
| `context/archive/2026-09-24-sites-and-gear-management/plan.md:49,188-202,362` | Island import boundary; the AFOV select is a deliberate FR-009 design |
| `context/foundation/roadmap.md` S-12 | Settled combobox + manual escape; candidates for hand-curated data, numbers-only storage, onboarding presets |

No archived change mentions a gear catalogue, autocomplete or a combobox for gear.

## Related Research

- `context/archive/2026-09-26-first-run-onboarding/` (onboarding presets)
- `context/archive/2026-09-24-sites-and-gear-management/` (gear forms, AFOV picker)

## Open Questions

1. **Onboarding telescope step (UI, user):**
   - Option A: replace the five generic radios with the combobox, with editable fields under it.
   - Option B: keep the radios as a "not sure" fallback next to the combobox.
   - Either way, PRD FR-006 needs an amendment note and `onboarding.spec.ts:43-45` needs a new selector.
2. **Onboarding eyepieces (UI, user):** keep the kit shortcut and add a per-row combobox? Or offer "the eyepieces that came with my telescope" (bundled eyepieces pre-filled from the chosen scope)?
3. **Gear form layout (UI, user):** the combobox above the always-visible fields (onboarding's pattern), or the fields hidden behind "Enter manually"? The e2e tests fill `#name`, `#apertureMm` and `#focalLengthMm` directly, so visible fields keep them green.
4. **How options reach the island (team):** serialised props versus a lazy `import()`. Measure the props payload at the final catalogue size.
5. **Catalogue scope (team):**
   - Target size (about 150–300 telescopes, 100–200 eyepieces).
   - Representing zoom eyepieces.
   - An AFOV for generic bundled eyepieces.
   - A `discontinued` flag.
   - Which brands. Delta Optical, a Polish brand, was weakly covered by the search.
6. **Data licence note (team):** where to state the data's provenance and licence (a `LICENSE-DATA.md` next to the data, as `src/lib/catalogue/` does), plus a trademark/nominative-use line.
