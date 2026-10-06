# Deep sky beyond Messier (S-03) — Plan Brief

> Full plan: `context/changes/deep-sky-beyond-messier/plan.md`
> Research: `context/changes/deep-sky-beyond-messier/research.md`

## What & Why

Sidereus ranks and logs only the 110 Messier objects. Roadmap S-03 (MS-03, GitHub #67) extends this to bright deep-sky objects beyond Messier, with the same scoring, reasons and eyepiece pair, so a beginner's list isn't capped at one 18th-century catalogue.

## Starting Point

The generator (`scripts/build-catalogue.mjs`) reads only Messier rows from a pinned OpenNGC commit.

- The engine ranks any list of objects, but its types and tie-breaks use the Messier number.
- Tonight uses the Messier number to look up Polish names.
- The log's key rules (TypeScript, DB check, labels, picker) accept `M1`–`M110`, planets and `moon`.

The pinned OpenNGC data already carries Caldwell IDs for 105 of the 109 objects.

## Desired End State

On a clear October night at 52° N, Targets mixes Messier and Caldwell rows, e.g. "NGC 869 / 884 · Gromada podwójna w Perseuszu · Caldwell 14 · Per". The top 5 still lean to Messier. Each row has the usual best time, direction, eyepiece pair, reason and "seen" tag.

A Caldwell object can be marked observed and shows in `/log`. The manual picker finds it by "ngc 7000", "c 20", "ic 405" or its name. The landing reads "Messier & Caldwell · your sky, your kit".

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Which objects | Caldwell objects at dec ≥ −23° (60), plus the Double Cluster by hand = 61 | A recognised beginner list, derived by a generator rule; nothing that never clears 15° at Polish latitudes | Plan (user) |
| Mixing with Messier | One ranking, plus a small order-only `MESSIER_RANK_BONUS` (candidate 0.03) | A bright NGC object can still beat a faint Messier one, while near-ties go to the better-known object | Plan (user) |
| Row label | "NGC 7000 · name", with "Caldwell 20" in the detail line | The NGC number is what Stellarium and charts search by | Plan (user) |
| Missing V-mag (10 objects) | B-Mag where present (3), else a documented override with a source (~7) | Keeps the Veil, North America and Crescent, with traceable numbers | Plan (user) |
| Polish names | Established PL names for well-known objects, others fall back to English | Matches how Messier names are localised | Plan (user) |
| Double Cluster | One entry `NGC869`, labelled "NGC 869 / 884" | One row and one log entry, which is how observers treat it | Plan (user) |
| Calibration | Seasonal test (4 nights, 52° N, Bortle 5, 150 mm) with loose expectations, plus a reviewed snapshot | Repeatable and guards against drift; the user reviews the lists | Plan (user) |
| Landing kicker | "Messier & Caldwell · your sky, your kit" | Accurate and concrete | Plan (user) |
| Picker numbers | A prefix picks the list: bare/`m` = Messier, `ngc`/`ic` = designation, `c`/`caldwell` = Caldwell | Today's habit keeps working, and catalogue numbers become first-class | Plan (user) |
| Key shape and kind | `NGC7000` / `IC405`, kind `"deep-sky"`; format checked in TS + DB, existence on the server | Space-free keys suit URLs, DOM ids and the DB; islands can't hold the catalogue | Plan (delegated) |
| Data model | Shared `DeepSkyObject`, second generated file `caldwell.json`, `DEEP_SKY` + `findDeepSky` | Same generator, provenance and validation as Messier | Research → Plan (delegated) |
| Legacy `messier` column | Drop it and its sync trigger in this change | S-01/S-02 deferred it until S-03 settles the key rules; nothing in the app reads it | Research → Plan (delegated) |

## Scope

**In scope:**
- The Caldwell generator output and loader
- Polish names
- The engine bonus and tie-breaks
- The calibration test
- Tonight rows, markers, plan rows and tiles
- The log migration, key rules, labels, picker and search
- The server-side existence check
- Copy rewording
- Dropping `observations.messier`
- CLAUDE.md

**Out of scope:**
- Caldwell objects south of −23°, and non-Caldwell showpieces
- Retuning other scoring parameters
- New moonlight exemptions
- PL names without an established form
- Landing screenshot recapture
- PRD text edits

## Architecture / Approach

The work goes bottom-up, and each phase is shippable:

1. One generator run writes `messier.json` and `caldwell.json` from the same pinned fetch. The loader validates both into `DEEP_SKY`.
2. The engine ranks `DEEP_SKY`, with the bonus added to the order score only.
3. `buildTonight` carries `label` and `caldwell` instead of `messier` to the components.
4. The log's four mirrors of the key rules (TS, DB check, labels, picker) widen together, as the Moon slice did.
5. A final migration drops the legacy column.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Caldwell catalogue | `caldwell.json` (61), `DEEP_SKY`, id-keyed PL names, licence | Hand-sourced V-mag overrides (~7), and the merged C 14 |
| 2. Engine ranking | Messier-free types, `MESSIER_RANK_BONUS`, seasonal calibration test | The bonus value and the loose expectations are judgement calls; the 1 s determinism budget |
| 3. Tonight | Caldwell rows, markers, plan rows and tile, with label + "Caldwell n" | Longer PL labels at 390 px; must ship with Phase 4 |
| 4. Logging | Migration, `"deep-sky"` kind, picker and prefix search, server check, copy | Grammar mirrors drifting apart; existing e2e use the real clock, so Caldwell rows can appear in any season (assertions fixed per review F1) |
| 5. Contract + docs | `messier` column and trigger dropped, types regenerated, CLAUDE.md | Destructive migration (but fully derivable data) |

**Prerequisites:** local Supabase and the e2e recipe from `context/handoff.md`; network access to raw.githubusercontent.com for `catalogue:build`.
**Estimated effort:** about 2–3 sessions across 5 phases, all in one PR from `feat/deep-sky-beyond-messier`.

## Open Risks & Assumptions

- The calibration expectations are deliberately loose. The user's review of the snapshot is the real check.
- B-Mag overstates faintness slightly for the 3 fallback objects; accepted.
- 171 objects instead of 110 adds about 55% engine work per Tonight render. If the local determinism budget breaks, stop and report.
- Phase 3 links to log keys that only Phase 4 accepts, so the two must ship together.

## Success Criteria (Summary)

- Tonight's ranking at a Polish site includes Caldwell objects with the same detail as Messier, and the seasonal top lists look sensible to the user.
- A Caldwell object can be logged from Tonight or found in the manual picker by NGC, IC, Caldwell number or name.
- All automated suites pass (unit, `test:db`, e2e, smoke). Screenshots in EN/PL × three themes × phone/desktop show the new rows and copy fitting.
