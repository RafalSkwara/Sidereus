# Sky events (M-3 S-07) — Plan Brief

> Full plan: `context/changes/sky-events/plan.md`
> Research: `context/changes/sky-events/research.md`

## What & Why

A beginner should know what is worth going out for in the coming weeks. The user sees the next 30 nights of sky events for their site, each with its local time and whether they can see it from there:
- meteor shower peaks;
- planet oppositions;
- Mercury and Venus elongations;
- close Moon-planet and planet-planet pairings;
- solar and lunar eclipses.

The next notable event appears on the dashboard, and tonight's is named under the verdict (PRD FR-042, FR-043, US-07). An event below the horizon is never shown as something to go out for.

## Starting Point

astronomy-engine 2.1.19 already ships searches for eclipses, elongations, oppositions and solar longitude, but the engine uses none of them. There is no pairing search and no meteor data. Tonight builds one view with optional blocks, has focused pages under `/tonight/*`, and stores those pages offline from a fixed list.

## Desired End State

- A new `/tonight/events` page lists the events night by night, with times in the site's zone and a visible or not-visible state that gives the reason. Every solar eclipse carries a safety line. The page has an honest empty state and is stored offline.
- A sixth dashboard tile, straight after Targets, names the next notable visible event.
- On a night with one, a muted plain-text line under the verdict reads "Tonight: Perseids peak".

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where events come from | The pure engine plus one hand-entered shower table; no feed | Deterministic, testable, and it travels in offline copies (US-07). | Research, PRD |
| Meteor data source | Option A: about 10 showers as hand-entered facts. Peak night and rate from NASA; λ derived by our engine from NASA's date (not from the IMO); radiant and speed from the IAU MDC; cross-checked by reading; documented in `LICENSE-DATA.md`. The IAU MDC email is drafted for the owner. | No source both licenses commercial reuse and has every field; facts avoid share-alike (not legal advice). | Owner, review F4 |
| Close pairing | Up to 5° (the binocular field), measured from the site, at the closest moment while both bodies are visible | The owner changed it from the 3° candidate; the Moon's parallax is up to about 0.94°; the geometric minimum is often in daylight. | Owner, 2026-10-13 |
| "Visible" | At least 10° up (eclipses 2°, "low, needs an open horizon" below 10°); Sun at or below −6° for night events; the site's dark window for meteors, or the −6° span on a "short night" | A fixed beginner rule; eclipses are rare enough to be worth a low horizon. | Owner, review F2 and F5 |
| Notable | Visible, except penumbral lunar eclipses (listed as "barely noticeable"); no Uranus or Neptune events | Beginners can see them without optics. | Owner, 2026-10-13 |
| Dashboard | A sixth tile straight after Targets, always shown; a plain-text verdict line only on event nights; the one-line shift on those nights accepted, no reserved space | The owner moved the tile up and accepted the shift; the verdict over the live sky has no controls, so the tile carries the link. | Owner, review F3 |
| Visibility enforcement | Every event carries `visible` and a reason; UI wording reads only visible events | Enforces the PRD invariant in one place. | Plan (delegated) |
| Shower peak time | Search the Sun's J2000 longitude via `Rotation_EQJ_ECL` + `SphereFromVector` | `SearchSunLongitude` and `Ecliptic()` are both of date, about 9 h off in 2026. | Research §2, review F1 |
| Window | 30 observing nights from the selected night; an event belongs to the night containing its moment | Matches the outlook's night model; a daytime eclipse falls on that day's night. | Plan (delegated) |
| Split | Five phases, by event kind first | The roadmap's risk: several kinds of event maths at once. | Roadmap, Plan |
| Interview | The agent answered the technical questions itself; the owner answered the five product choices on 2026-10-13 | The run's rules (no AskUserQuestion). | Plan, Owner |

## Scope

**In scope:**
- `events.ts`, `pairings.ts` and `meteors.ts` in the engine, plus new `parameters.ts` candidates;
- the shower table, its licence note, and a drafted IAU MDC email the owner may send;
- a Skyfield pairing fixture;
- the `withSkyEvents` view block, `/tonight/events`, offline storage, the tile and the verdict line;
- EN and PL copy, `/design` specimens, an e2e spec and a CLAUDE.md note.

**Out of scope:**
- feeds;
- occultations and star pairings;
- Uranus and Neptune;
- minor showers;
- notifications;
- eclipse maps;
- "Mark observed" for events;
- any change to the verdict, ranking or forecast maths;
- a link inside the live-sky verdict.

## Architecture / Approach

`skyEvents(site, fromNight, 30)` runs each kind's search over the window:
- eclipses, elongations and oppositions from astronomy-engine searches;
- pairings from an hourly or 3-hourly topocentric scan, refined;
- showers from a J2000 solar-longitude search.

Every candidate passes one visibility test (altitude in the right part of its night). Tonight formats the result into `TonightView.skyEvents`: `events`, `tonight`, `next`. The page, the tile and the verdict line render from that block.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Event model and searches | The model, the visibility rule, eclipses, elongations, oppositions; test-first | Getting visibility right per kind (the invariant) |
| 2. Close pairings | The topocentric scan and refinement, against a Skyfield fixture | Clustering and the best-visible-moment rule |
| 3. Meteor showers | The fact table with licence note, the J2000 peak search, radiant visibility | Cross-checking the facts; the peak night |
| 4. The events page | View block, `/tonight/events`, offline entry, e2e | Formatting and grouping by night; offline title |
| 5. Tile and verdict line | Sixth tile, verdict line, specimens, whole e2e suite, docs | The pinned verdict height and the phone first screen |

**Prerequisites:**
- The owner's five decisions (answered 2026-10-13).
- A worktree env from local Supabase.
- Preview port 4333, fixture port 4400.

**Estimated effort:** about 3 sessions across 5 phases.

## Open Risks & Assumptions

- Many 30-night windows hold few events, and pairings are uncommon even at 5° (about 0.7–1.0 Moon-planet per 30 nights, simulated). The empty state and the tile's "none" line must read as normal.
- The meteor table's legal footing is a read of the terms, not legal advice. Option A rests on entering facts by hand, and the owner decides.
- On event nights the verdict line shifts the dashboard by one line, and the skeleton jumps (accepted by the owner). `tonight-phone.spec.ts` subtracts the line so it does not depend on the run date.
- The Workers cost of the pass is measured only on a laptop (about 29 ms warm). Phase 4 measures it once on the preview, and the local budget test is the guard.
- The shower table depends on NASA listing each shower. A shower NASA lacks is dropped rather than filled from the IMO.

## Success Criteria (Summary)

- The events page shows the next 30 nights' events for the site, with local times, and never presents an event below the horizon as worth going out for.
- The dashboard shows the next notable event, and the verdict names tonight's, in EN and PL, in all three themes, at phone width.
- The engine tests pin each kind against an independent reference, and the whole e2e suite passes.
