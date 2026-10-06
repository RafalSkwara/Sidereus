# Gear catalogue (S-12) — Plan Brief

> Full plan: `context/changes/gear-catalogue/plan.md`
> Research: `context/changes/gear-catalogue/research.md`

## What & Why

A beginner adding a telescope or eyepiece today has to type its name, aperture, focal length and field of view, which they usually don't know. S-12 adds a searchable catalogue of real models. Picking one fills in those fields, and the user can still edit them. User, 2026-10-06: "we should provide some list of gear to choose from and not only expect a beginner to be able to type this in."

## Starting Point

- **The forms:** the `/gear` telescope and eyepiece forms and the onboarding wizard are controlled React islands, and the database stores only numbers.
- **Onboarding:** it offers five generic telescope types and two Plössl kits.
- **The combobox:** an accessible one already exists in the observation log (`TargetPicker`).
- **The data:** no openly licensed dataset of gear specs exists.

## Desired End State

- **`/gear` forms:** both the telescope and eyepiece forms have a "Find your model" combobox above their fields. Typing "heritage 130" finds the Sky-Watcher Heritage-130P, and choosing it fills the fields.
- **Onboarding:**
  - The telescope step leads with the search, with the generic types behind "Not sure of the model?".
  - When the chosen telescope ships with known eyepieces, the eyepiece step offers "Came with <model>: 25 + 10 mm".
- **The catalogue:** about 300 telescopes and 250 eyepieces, each hand-entered from a manufacturer page with its source linked.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Picker | Searchable combobox + "Not listed? Fill in below." | Long lists need type-to-filter, and manual entry must stay. | Research (user) |
| /gear layout | Combobox on top, fields always visible | Edit mode reads naturally, and the existing e2e ids stay. | Research (user) |
| Onboarding telescope | Combobox first, generic types in a "Not sure" disclosure | Exact specs for those who know their scope; the calibrated 150/750 default for the rest. | Research (user) |
| Onboarding eyepieces | "Came with <model>" kit + a search per row, generic kits kept | Most beginners own exactly the bundled pair. | Research (user) |
| Catalogue size | ~300 telescopes + ~250 eyepieces | The user wants the "long list" feel. | Plan (user) |
| Zoom eyepieces | One entry per click stop | Fits one focal length and one AFOV per eyepiece without engine changes. | Plan (user) |
| Bundled eyepieces' field of view | Typical value for the type, flagged `afovEstimated` | Keeps "came with" usable; the user can still edit. | Plan (user) |
| Data source | Hand entry from manufacturer pages, `source` URL each, CC0 | Every available dataset is GPL, unlicensed or forbids scraping, and the EU database right applies. | Research |
| Combobox build | Generalise `TargetPicker` into `forms/Combobox.tsx` (next to `FormField`, since it uses `FieldError`) | No new dependencies, already accessible and safe with the theme tokens. | Research |
| Data delivery | Two lazily imported JSON chunks, started on form mount | About 550 entries are too heavy for page HTML or the form chunks. | Plan |
| Storage | Numbers only, no model id | No migration; saved gear doesn't depend on the list. | Research (roadmap candidate) |
| Tests | Unit tests for search, fill and data; one new /gear e2e test, plus a separate onboarding catalogue test (the default-path test is kept) | The user prefers modest tests, with screenshots for layout. | Plan (user preference) |

## Scope

**In scope:**
- shared combobox and gear search;
- catalogue data, validation and README;
- `/gear` telescope and eyepiece forms;
- onboarding telescope and eyepiece steps;
- the PRD FR-006 note;
- a curation spot check;
- a CLAUDE.md note.

**Out of scope:**
- database migration or a stored model id;
- real zoom support;
- barlows, reducers, mounts or telescope types as data fields;
- user-submitted models;
- bulk import from any database;
- the site form, Tonight and the engine.

## Architecture / Approach

`src/lib/gear/catalogue/` (island-safe) holds:
- `telescopes.json` and `eyepieces.json`;
- `types.ts`;
- `search.ts`, which matches every word, ignoring hyphens and diacritics;
- `fill.ts`, which maps an entry onto form state and turns an unusual AFOV into "other" + degrees;
- `load.ts`, the memoised dynamic `import()`.

`src/components/forms/Combobox.tsx` is the ARIA 1.2 combobox taken out of `TargetPicker`. Its input never posts, and `TargetPicker` becomes a wrapper around it. Each form loads its chunk on mount and calls `onSelect` → `setState`. POST bodies, schemas, routes and the onboarding RPC are unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared combobox and gear search | `forms/Combobox.tsx`, `searchCatalogue`, copy, `/design` states | Regressing the log's object picker |
| 2. Data model, fill helpers, seed | Types, validation test, README, ~40 verified entries, lazy chunks | Getting the schema shape right before 550 entries depend on it |
| 3. /gear forms | Combobox on the telescope and eyepiece forms, one e2e test | Loading and unavailable states on slow networks |
| 4. Onboarding | Search first, "Not sure" disclosure, "Came with" kit, row search | State sequencing between the radios, the combobox and the kits |
| 5. Full curation and close-out | ≥ 300 + ≥ 250 entries, ≥ 10% spot check, CLAUDE.md | Wrong specs at scale; curation time |

**Prerequisites:** none. Web access is needed for curation in phases 2 and 5.

**Estimated effort:** about 3–4 sessions. Phase 5 (curation) is the largest single block.

## Open Risks & Assumptions

- Spec accuracy at about 550 hand-entered entries. This is mitigated by schema and plausibility tests plus a ≥ 10% independent spot check, and the fields stay editable.
- Delta Optical and other EU brands were weakly covered by search, and some may only have retailer sources.
- The estimated AFOV for bundled eyepieces and interpolated zoom stops can be a few degrees off. Both are flagged `afovEstimated` and checked against their `design`.
- Curation spans more than one session: per-brand drafts are merged and committed brand by brand.
- The service worker precaches the catalogue chunks for every install.
- Playwright's handling of radios hidden in `<details>` needs the onboarding spec to open the disclosure first.

## Success Criteria (Summary)

- A beginner finds their scope by typing part of its name, and the fields fill correctly on `/gear` and in onboarding.
- Accepting onboarding's defaults still finishes in under a minute with 150/750 and the 25 + 10 mm pair.
- The catalogue holds at least 300 telescopes and 250 eyepieces, all valid and sourced, with a documented spot check.

> Plan review 2026-10-06 (`reviews/plan-review.md`): NEEDS ATTENTION. All 10 fixes were applied to the plan.
