# The Moon as a Target — Plan Brief

> Full plan: `context/changes/moon-as-target/plan.md`
> Research: `context/changes/moon-as-target/research.md`

## What & Why

This is M-2's second slice: roadmap S-02, GitHub #66.

- The Moon becomes a target on Tonight that can be logged.
- Each phase gets a short note on what is worth looking at.
- On bright-Moon nights, Tonight says plainly that faint deep sky is a poor bet and points at the Moon and planets instead.

Every source consulted calls the Moon the best first target for a beginner, yet today Sidereus only treats it as interference: a penalty in the deep-sky score.

## Starting Point

S-01 built the solar-system pattern:
- a civil-dusk-to-dawn window with its own weather verdict;
- a separate section above the deep-sky ranking;
- target keys in the log (`M31`, `jupiter`).

The engine already has the Moon's position, illumination and moon-free minutes. It has no phase band, no waxing/waning flag and no Moon eyepiece rule, and the log's target grammar has no `moon`.

## Desired End State

"Planets tonight" becomes **"Solar system tonight"**. The Moon card comes first, whenever the Moon clears the site's minimum altitude in that window's clear hours. It shows:
- phase and % lit;
- window, best time and direction;
- a whole-disc eyepiece and a detail eyepiece;
- a reason line, with a warning below 30°;
- a hedged note for the current phase band;
- "Mark observed".

On a go or marginal night, when the Moon is at least 50% lit and up for more than half the dark window, the verdict card adds a bright-Moon line. The ranking itself is unchanged. The Moon appears in the log and in the picker as "Moon" / "Księżyc".

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Placement | First card in a renamed "Solar system tonight" section | One section for everything that ignores the dark window; the Moon comes first as the easiest target. | Plan (user) |
| Bright-Moon message | One line in the verdict card; ranking unchanged | Seen before scrolling; M-1's calibration stays untouched. | Plan (user) |
| Bright-Moon rule | ≥ 50% lit at the dark-window midpoint **and** up for more than half the dark window | Matches the "about a week either side of full" guidance. | Plan (user), Research |
| Window and weather | Same as planets: sun below −6°, its own verdict, clear-hours masking | Reuses S-01's block; the Moon is as bright as planets in twilight. | Plan (delegated) |
| Phase notes | 7 fixed EN/PL notes keyed on elongation bands (`MoonPhase`), with hedged wording | % lit hides waxing vs waning; libration shifts the terminator by about ±½ day. | Research, Plan (delegated) |
| Eyepieces | Whole disc: the most magnification with a true field ≥ 0.7°; detail: the planet rule | Standard practice: start at low power, then raise it along the terminator. | Research, Plan (delegated) |
| Low line | Below 30° the reason warns that the image will shimmer (planets use 20°) | The sources consulted advise 30° or more for high power. | Research, Plan (delegated) |
| Illumination floor | No card below 3% lit; detail eyepiece hidden when no stronger than whole-disc | A 1–2% twilight sliver is not a beginner target; avoids nonsense eyepiece pairs. | Plan review F10 |
| Bright-Moon inputs | Pure `isBrightMoon`, fed from the outlook's night-1 Moon values; pointer sentence only when the section has targets | One source of truth with the strip; never points at an empty section. | Plan review F5, F6 |
| Log identity | New key `moon`, kind `"moon"`; a migration widens the CHECK; the trigger is unchanged | The closed grammar S-01 designed for this extension. | Research |
| Verification | Skyfield/DE421 Moon reference, Warsaw 2026-10-24, in a throwaway venv | The S-01 precedent; no observing experience to check by eye. | Plan (delegated) |
| Shared details block | Extract the window/best/log block used by objects, planets and the Moon | S-01 review F10 deferred it to this slice. | Research |

## Scope

**In scope:**
- Moon engine: band, target entry, whole-disc eyepiece, bright-Moon predicate, Skyfield reference.
- `moon` target key end to end: migration, grammar, labels, picker, EN/PL.
- The Tonight section rename, the Moon card, the shared details block, the verdict line, notes, e2e.

**Out of scope:**
- Moonrise/moonset facts (S-05 timeline).
- Re-ranking or hiding deep-sky objects on bright nights.
- Terminator or colongitude prediction, libration, eclipses.
- The Moon on `/tonight/all` or in the strip.
- Stellarium fixtures (#19), the #22 CPU re-measure (now on Workers Paid), the PRD v3 amendment.

## Architecture / Approach

Inside out, as S-01 did.
1. `moon-target.ts` in the pure engine produces one entry from `moonTrack` over the planet window, masked and passed to `bestWindow`. The bright-Moon predicate is a pure `isBrightMoon`, fed from the seven-night outlook's own night-1 Moon values (illumination at the dark-window midpoint, moon-free minutes), so the verdict card and the strip can never disagree.
2. `src/lib/targets` gains `moon`, and a migration widens the DB check.
3. `buildTonight` computes the Moon inside the existing solar-system try/catch. A Moon failure drops only the Moon. `SolarSystemSection` renders `MoonCard` before the planet list, and `VerdictCard` gets the optional line.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Moon engine | Bands, target entry, eyepieces, bright-Moon predicate, Skyfield reference | Candidate numbers judged without observing experience |
| 2. The Moon in the log | `moon` key in the DB, grammar, labels, picker | Must stay compatible with the app deployed before it (CHECK only widens) |
| 3. The Moon on Tonight | Section rename, Moon card, shared details, verdict line, EN/PL notes, e2e | Phase-note copy sounding confident but wrong; the planets e2e relies on the card order |

**Prerequisites:**
- S-01 done (yes).
- Local Supabase for `test:db`.
- A scratchpad Python venv with Skyfield, and `~/projects/de421.bsp`.

**Estimated effort:** about 3 implementation sessions, one per phase. Phase 3 is the largest.

## Open Risks & Assumptions

- All new numbers are uncalibrated candidates: band edges, 0.7° field, 30° low, 3% floor, 50%/50% bright rule.
- The phase notes come from RASC, Sky at Night and Astronomy magazine reading, kept coarse and hedged. Sources disagree on full moon (avoid it, or use it for the rays), and the notes follow RASC and S&T: rays are worth seeing.
- The real-clock e2e may skip the Moon on days it is not up. The unit tests on pinned nights carry the assertions.
- A morning-only waning Moon after civil dawn rollover is not shown, the same limitation S-01 accepted.

## Success Criteria (Summary)

- A beginner sees the Moon first in "Solar system tonight", with its phase, when and where to look, which eyepieces to use and what is worth seeing, and can log it.
- On bright-Moon nights the verdict card explains why faint deep sky is a poor bet.
- Planets, the Messier ranking and the log behave as before.
