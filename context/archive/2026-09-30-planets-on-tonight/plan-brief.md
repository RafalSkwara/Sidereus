# Planets on Tonight — Plan Brief

> Full plan: `context/changes/planets-on-tonight/plan.md`

## What & Why

M-2's first slice (roadmap S-01, GitHub #65) puts the planets on Tonight: a "Planets tonight" section above the deep-sky top five, where each planet can be marked observed. Planets are what a beginner points a first telescope at. They also break M-1's assumptions in the most places: they move, they are visible in twilight, they want magnification rather than field, and the log only knows Messier numbers. Settling those here gives the Moon, extra deep-sky objects and double stars (S-02 to S-04) a pattern to reuse.

## Starting Point

The engine ranks fixed J2000 Messier positions over the dark window, and only on a go or marginal night that has a dark window. The observation log is keyed by Messier number from the database check to the URLs and the picker. `astronomy-engine` already computes planet positions, magnitude, phase and Saturn's ring tilt.

## Desired End State

On any night whose twilight-to-dawn weather is go or marginal, Tonight lists every planet above the site's minimum altitude, best-placed first. That includes cloud no-go nights with a clear twilight and no-darkness summer nights. Each card shows:

- window, best time and direction;
- magnitude and apparent size;
- phase (Mercury, Venus) or ring tilt (Saturn);
- one detail eyepiece from the user's kit;
- a placement reason and a short "what you'll see" note, in EN and PL.

Uranus and Neptune appear only at 130 mm or more. Marking a planet observed puts it in the log, and the manual picker finds planets by name. Messier behaviour is unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where planets appear | Own section above the Messier top 5 | Scored on different grounds; a beginner looks for them first; M-1's calibration stays intact. | Plan (user) |
| Planet window | Sun below −6°, judged by the same cloud rule; shown on no-darkness nights too | Planets stay useful in summer; reuses `darkWindow` and `verdict` unchanged. | Plan (user) |
| Which planets | Mercury to Saturn always; Uranus/Neptune only at ≥130 mm | Honest about what a small scope shows. | Plan (user) |
| Card content | Facts + detail eyepiece + fixed "what you'll see" note | Sets expectations, the product's promise to beginners. | Plan (user) |
| Order | Planet score: altitude at best (0.6) + apparent size (0.4), no bar | The top card is the best bet; low planets are flagged, not hidden. | Plan (user) |
| Log identity | Target key (`M31`, `jupiter`) in a new `target` column, trigger-synced with `messier` | Migrations run before deploy; the old app must keep working. | Plan (codebase) |
| Log penalty for planets | Seen tag only, no reordering | Planets are worth revisiting every night. | Plan |
| Eyepiece rule | Highest magnification with exit pupil ≥ 0.7 mm and ≤ min(2×aperture, 250×) | Standard useful-magnification ceiling; all candidates in `parameters.ts`. | Plan |
| Verification | Skyfield/DE421 reference fixture, generated in a throwaway venv | The M-1 checkpoint precedent; no domain experience to check by eye. | Plan (archive) |

## Scope

**In scope:**
- Planet engine: tracks, facts, score, eyepiece.
- Target-keyed log: migration, store, routes, pages, picker.
- The Tonight section, EN/PL copy, e2e, and the CPU re-measure (#22).

**Out of scope:**
- The Moon, non-Messier deep sky, double stars, the timeline (later M-2 slices).
- Planets on `/tonight/all` or in the seven-night strip.
- Dropping the `messier` column.
- A finding eyepiece for planets; Stellarium hand fixtures (#19).

## Architecture / Approach

Inside out. First a pure `planets.ts` + `planet-ranking.ts` in the engine, verified against Skyfield. Then a `src/lib/targets` key module that replaces the Messier number across the log, via an additive migration whose trigger fills whichever column the writer omitted. Finally `buildTonight` computes a second window, `darkWindow(site, night, −6)`, judges it with the existing `verdict`, and hands a `planets` view to new `PlanetSection`/`PlanetCard` components above the ranking.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Planet engine | Pure planet positions, selection, score, facts, eyepiece; Skyfield reference | Candidate numbers judged without observing experience |
| 2. Target identity in the log | `target` key end to end, with Messier unchanged and planets loggable | Wide refactor; the migration must stay compatible with the old app |
| 3. Planets on Tonight | Section and cards, EN/PL, mark observed, e2e, CPU check | Tonight CPU on the Free plan (#22) |

**Prerequisites:** M-1 done; local Supabase for `test:db`; a scratchpad Python venv for the Skyfield reference.
**Estimated effort:** ~3 implementation sessions, one per phase.

## Open Risks & Assumptions

- All new numbers are uncalibrated candidates (score weights, −6°, 130 mm, 20° "low", magnification ceiling), chosen from general observing guidance rather than experience.
- The fixed "what you'll see" notes are written from reference reading and kept conservative.
- After the dark window ends, Tonight moves to the evening ahead, so the current dawn's morning planets aren't shown.
- Planet rows would read as unknown in an old app if the app were rolled back after planets were logged.

## Success Criteria (Summary)

- A beginner sees which planets are up tonight, when, where and with which eyepiece, including on clear summer twilight nights.
- A planet can be logged from Tonight or the manual picker and shows up in the log by name.
- Nothing about the Messier ranking or log experience changes.
