---
date: 2026-10-01T14:46:27Z
researcher: Claude (claude-opus-5-5)
git_commit: 8f2a737
branch: main
repository: RafalSkwara/Sidereus
topic: "Moon as a target on Tonight: reuse of the S-01 planet pattern, existing Moon engine, and beginner lunar observing guidance"
tags: [research, codebase, engine, moon, tonight, observations, targets, i18n]
status: complete
last_updated: 2026-10-01
last_updated_by: Claude (claude-opus-5-5)
---

# Research: Moon as a target on Tonight

**Date**: 2026-10-01T14:46:27Z
**Researcher**: Claude (claude-opus-5-5)
**Git Commit**: 8f2a737
**Branch**: main
**Repository**: RafalSkwara/Sidereus

## Research Question

For roadmap M-2 S-02 `moon-as-target` (MS-02, GitHub #66):

1. How S-01 `planets-on-tonight` integrated solar-system targets (target identity, twilight window, ranking group, eyepiece, log) and what the Moon can reuse.
2. What the engine already computes for the Moon.
3. External guidance on beginner lunar observing per phase, full-moon advice, magnification, and when moonlight makes faint deep sky a poor bet.

External research used web search and fetch, because connectors were unavailable. skyandtelescope.org returned 403, so S&T claims below come from search snippets, not full reads.

## Summary

- **The planet pattern carries over almost as-is.**
  - The Moon fits as one new target key, `moon`, in the closed grammar in `src/lib/targets/index.ts`. The DB `CHECK` needs a new migration. The sync trigger and zod schema need no change.
  - It can use the same −6° twilight window and window verdict as the planets (`build.ts:376-424`), the same "Mark observed" → `/log/new?object=<key>` flow and the same seen tag.
  - Its card can be the first consumer of the shared window/best/log block that S-01's review F10 deferred to this slice.
- **The engine has Moon position and illumination, but not the facts a Moon card needs.**
  - `moon.ts` gives topocentric alt/az, illuminated fraction and phase angle (`moon.ts:25-37`), a track (`:116`) and a moon-free-minutes total (`:81-113`).
  - It has no rise/set times, no waxing/waning flag, no phase-band or age classifier and no apparent diameter.
  - astronomy-engine already exports `MoonPhase` (ecliptic elongation 0–360°, which gives both the band and waxing/waning), `SearchRiseSet` and `Libration`. None is used yet.
- **Moonlight already affects deep sky only through scoring.** `score.ts` gives it weight 0.30 (`parameters.ts:57-62`). VerdictCard and `verdict.ts` say nothing about the Moon. Nothing on Tonight tells the user "bright Moon: faint deep sky is a poor bet, try the Moon and planets". That would be new.
- **The external guidance is consistent enough for conservative, phase-banded notes.**
  - Key the notes on elongation, not illumination %. RASC notes that libration moves the terminator by about ±½ day.
  - Each band has 2–3 well-known features (RASC *Explore the Moon* Q-day list).
  - Full moon means rays (Tycho, Copernicus, Kepler) and Aristarchus, with an optional filter for comfort.
  - Start at low power, then go up along the terminator, under the same ceiling as planets.
  - Aim for 30° or more of altitude.
  - Faint deep sky suffers from about first quarter to last quarter when the Moon is up. S&T puts a quarter moon at about 4× and a full moon at about 40× the dark-sky background.
- **Fixture gap.** The Skyfield planet reference does not cover the Moon (`scripts/planet-reference.py:44-52`). The Stellarium Moon fixtures are still `pending` (#19). A Moon reference fixture would have to be generated, as it was for planets.

## Detailed Findings

### 1. Target identity (log, picker, labels)

- **Grammar:**
  - `PLANET_TARGET_KEYS` is at `src/lib/targets/index.ts:18-26`.
  - `TargetKey = MessierKey | PlanetKey` and `TargetKind = "messier" | "planet"` are at `:29-30`.
  - `isTargetKey` is at `:35`, `messierNumber` at `:50` and `parseTargetParam` at `:62`.
  - `targetKind` (`:54`) treats any non-planet key as `"messier"`. That breaks once `moon` exists, so it must gain a `"moon"` kind.
  - The header comment says the grammar is closed and mirrors the DB check.
- **DB:**
  - `supabase/migrations/20260930120000_observation_target.sql:26-29` constrains `target` to the Messier regex or the seven planet names.
  - Its `:4` says "S-02 and S-03 extend the grammar together with this check".
  - Adding `moon` needs a migration that drops and re-adds `observations_target_key`.
  - The trigger (`:32-66`) derives `messier` only from `^M[0-9]{1,3}$`, so a `moon` row gets `messier = null` and passes, the same as a planet.
  - `database.types.ts` types `target` as `string`, so the types do not drift.
- **Validation:** `src/lib/observations/schemas.ts:59` uses `z.custom<TargetKey>(isTargetKey)`, so it follows the grammar automatically.
- **Picker:**
  - `target-options.ts:13-31` lists Messier, then planets with `targets.planetDetail`. The Moon needs its own option and detail string.
  - `target-search.ts:43-52` handles a number query through `messierNumber`, so it never matches `moon`. Name search is generic.
- **Labels:** `src/lib/targets/labels.ts:22-34` falls through to the Messier branch for any non-planet key, so it needs a Moon branch.
- **i18n:** the `targets` block is at `en.ts:618-630`, mirrored in `pl.ts` (`satisfies Messages`, plus a parity test).
- **Tests to mirror:**
  - `src/lib/targets/index.test.ts:6-38`.
  - `tests/db/observations.test.ts:197-222, 336-346` (the planet target cases).

### 2. The planet pipeline S-01 built

- **Engine:**
  - `planets.ts`: `planetTracks` (`:52-68`) is of-date `Equator` with aberration, then `Horizon("normal")` on the `sampleInstants` grid. `planetFacts` (`:83-93`) gives magnitude, diameter, phase and ring tilt.
  - `planet-ranking.ts`: `rankPlanets` (`:126-164`) reuses `bestWindow`. Its score is placement × size, with no log penalty. `placementOf` (`:89`) gives low/well/high, with `PLANET_LOW_ALTITUDE_DEG` (`parameters.ts:248`) and `WELL_PLACED_ALTITUDE_DEG = 40` (`:111`). `timingOf` (`:100`) splits the window into thirds.
- **Window:**
  - `PLANET_WINDOW_SUN_ALTITUDE_DEG = -6` (`parameters.ts:214`).
  - `build.ts:376-424` computes `darkWindow(site, night, −6)` and judges it with the existing `verdict`. The section shows only if that verdict is go or marginal.
  - When the main dark-window verdict fails, tracks are masked to clear hours with `clearIntervals`.
  - The block is wrapped in try/catch: on failure, `planets = null`.
- **Eyepiece:** `planetEyepiece` (`eyepieces.ts:131-143`) picks the highest magnification with exit pupil ≥ 0.7 mm, capped at min(2 × aperture mm, 250×) (`parameters.ts:254-257`). On an empty kit it returns null.
- **View and UI:**
  - The view types are `TonightPlanetEntry` (`build.ts:92-122`), `TonightPlanets` (`:129-141`) and `TonightView.planets` (`:217`).
  - `PlanetSection.astro:19-36` and `PlanetCard.astro:20-67` render the section.
  - `TonightContent.astro:169` places it. `showSections` (`:65`) and `nightsLink` (`:148`) gate on `planets || ranking`, so the Moon has to join both conditions.
- **Log flow:**
  - `logHref` (`load.ts:153-161`) builds `/log/new?object=<key>&night&site&telescope`.
  - After a save, `/tonight?logged=<key>` is resolved via `parseTargetParam` + `targetLabel` (`src/pages/tonight.astro:15-32`).
  - The seen tag comes from `seenSummaries` (`engine/log.ts:32-46`), keyed by target string.
- **E2E:** `tests/e2e/planets-on-tonight.spec.ts` runs on the real clock with an all-clear forecast. It takes the first planet card, or `test.skip`s when there is none. The Moon's phase and visibility also vary with the date, so assertions about Moon content belong in unit/build tests with a pinned date. The e2e should stay tolerant.

### 3. What exists for the Moon today

- **`src/lib/engine/moon.ts`:**
  - `MoonState` (`:25-30`) holds alt/az, `illuminatedFraction` and `phaseAngleDeg` (0 = full, 180 = new).
  - `moonState(site, time)` (`:37`) is topocentric.
  - `moonSeparationDeg` (`:61`) is geocentric, without parallax.
  - `moonFreeMinutes(site, interval)` (`:81-113`) returns a total, not crossing times.
  - `moonTrack` (`:116`).
- **Missing for a Moon card:**
  - rise and set times;
  - waxing vs waning;
  - phase band or age;
  - apparent diameter.
  - All can come from astronomy-engine without new dependencies:
    - `MoonPhase(date)` gives elongation 0–360°: 0 new, 90 first quarter, 180 full, 270 last quarter.
    - `SearchRiseSet(Body.Moon, …)` gives rise and set times.
    - `Libration(date)` gives `diam_deg` and the distance.
  - Elongation alone gives both the band and waxing/waning.
- **Scoring:**
  - `score.ts:89-90, 120-131` computes the Moon component as (1 − illumination at the object's peak) × the share of best-window samples with the Moon up. It has weight 0.30.
  - `ranking.ts:159` builds `moonTrack` once per ranking.
- **Display today:**
  - NightStrip's `moonText` (`NightStrip.astro:61, 87`) comes from `outlook.ts:141-177` through `format.ts` `moonLine` (`:345-363`).
  - The deep-sky reason phrase "N% clear of moonlight" is at `format.ts:186-187`.
  - The i18n keys are `tonight.nights.moon*` (`en.ts:398-403`) and `tonight.reason.moon.lead/follow` (`:514-516`). No `targets.moon` or Moon-card copy exists.
  - VerdictCard has no Moon content.
- **Tests:**
  - `moon.test.ts` covers synthetic cases (`:19-114`) and a Stellarium block (`:116-130`) that registers `test.todo` while fixtures are pending.
  - `fixtures/stellarium/warsaw-2026-10-24.json:30-31` and `tromso-2026-06-21.json:30-31` are `pending`. `warsaw-2026-10-10.json` is `not-applicable` because it is new moon.
  - The Skyfield reference `fixtures/skyfield/planets-warsaw-2026-10-10.json` falls on a new-moon night and covers only planets. A Moon reference needs a different date, for example the 2026-10-24 waxing gibbous.

### 4. Beginner lunar observing guidance (external)

**Lunar age and illumination.**
- The synodic month is 29.530589 days. Elongation grows about 12.19° per day, and illuminated fraction k ≈ (1 − cos elongation)/2.
- First quarter is about day 7.4, full about 14.8 and last quarter about 22.1.
- The table below was derived from the formula:

| Age (d) | 2 | 4 | 6 | 7.4 | 9 | 11 | 13 | 14.8 |
|---|---|---|---|---|---|---|---|---|
| Illum % | 4.5 | 17 | 36 | 50 | 67 | 85 | 97 | 100 |

- RASC *Explore the Moon* (https://www.rasc.ca/sites/default/files/EtM_Telescope_V4_1.pdf) says "percent illumination is not a precise indicator". Libration moves the terminator by about ±½ day, and a feature often looks best the night after the terminator crosses it. **So key the notes on elongation bands and hedge the wording ("around", "near the shadow line").**

**Features by band.**
RASC lists features by Q-days (days from first quarter), cross-checked against Sky at Night (https://www.skyatnightmagazine.com/advice/skills/how-to-observe-the-moon).

| Band (waxing) | Approx. age | Features (2–3 to pick from) |
|---|---|---|
| Crescent | 3–6 d | Mare Crisium; Langrenus–Vendelinus–Petavius–Furnerius; Theophilus–Cyrillus–Catharina by day 5–6; earthshine on the thinnest crescents |
| First quarter | 6.5–8.5 d | Apennine and Alps mountains with the Alpine Valley; Plato and Archimedes; Ptolemaeus–Alphonsus–Arzachel; Straight Wall (Rupes Recta) |
| Gibbous | 9–13 d | Copernicus; Sinus Iridum with the Jura mountains; Gassendi; Aristarchus |
| Full | about 14–16 d | Ray systems of Tycho, Copernicus and Kepler; bright Aristarchus; few shadows, so craters look flat |
| Waning gibbous / last quarter / crescent | 16–27 d | The same features in reverse, at sunset along the western terminator. Sky at Night's day-21 list: Plato, Copernicus, Aristarchus, Grimaldi. A waning crescent needs a pre-dawn session. |

**Full moon** (RASC; S&T "Full Moon is Tycho time", snippet only; Astronomy magazine https://www.astronomy.com/observing/the-best-filters-for-observing-the-moon/):
- detail is washed out, and the rays are the thing to see;
- an ND (about 13%) or variable polarising filter improves comfort and contrast;
- **disagreement:** Sky at Night advises avoiding full moon, while S&T and RASC recommend it for rays. Astronomy magazine frames brightness as eye protection; most sources call it glare and comfort. Treat a filter as optional comfort, not safety.

**Magnification** (Astronomy magazine; Space.com https://www.space.com/14296-moon-telescope-viewing-skywatching-tips.html):
- low power with the whole disc to orient;
- then raise the power along the terminator until the atmosphere degrades the view;
- the same about 2×/mm ceiling as planets;
- **disagreement:** sources differ on practical limits (half of the theoretical maximum, or 100–150× typical). The planet ceiling (`parameters.ts:254-257`) is therefore a reasonable upper bound, and a low-power "whole disc" eyepiece is a natural second suggestion.

**Altitude** (Space.com): observe above about 30°, because near the horizon the image "boils". No primary source gives a hard minimum. In Poland the summer full moon stays low and the spring first quarter rides high.

**Earthshine** (Sky at Night, EarthSky): best on crescents within a few days of new moon, in the evening west after sunset or the morning east before dawn. Northern-hemisphere evenings are best in spring.

**Moonlight vs deep sky** (S&T Q&A on lunar skyglow, snippet; secondary rules of thumb):
- With a dark-site sky at about 22.0 mag/arcsec²:
  - a 4-day Moon (16%) adds less than the natural background;
  - a quarter moon makes the sky about 4× brighter (about 20.5);
  - a full moon makes it about 40× brighter (about 18.0).
- Rule of thumb: about a week either side of full is poor for faint galaxies and nebulae when the Moon is up.
- Planets, the Moon itself, bright clusters and double stars remain good targets.
- From suburban skies the relative cost of moonlight is smaller, because light pollution already brightens the background.
- **No single source gives an illumination/time threshold.** The roadmap's candidate (>70% lit and up for most of the dark window) is stricter than the "first to last quarter" rule of thumb. Whichever threshold is chosen is a judgment call and belongs in `parameters.ts` as an uncalibrated candidate.

**The Moon as a beginner target:** RASC, Sky at Night, Celestron and Space.com all call it the best or ideal first target. This matches the PRD research note (`prd.md:305`): "the things a beginner most wants to log are Jupiter, the Moon, …".

## Code References

- `src/lib/targets/index.ts:18-62`: target grammar, kinds and parsing.
- `src/lib/targets/labels.ts:22-34`: target labels; needs a Moon branch.
- `supabase/migrations/20260930120000_observation_target.sql:4, 26-29, 32-66`: the grammar check (to extend) and the sync trigger (unchanged).
- `src/lib/observations/schemas.ts:59`, `target-options.ts:13-31`, `target-search.ts:43-52`: validation, picker options and search.
- `src/lib/engine/moon.ts:25-116`: existing Moon functions.
- `src/lib/engine/planets.ts:52-93`, `planet-ranking.ts:27-164`: the planet engine pattern.
- `src/lib/engine/eyepieces.ts:131-143`, `parameters.ts:214-257`: the planet eyepiece rule and solar-system parameters.
- `src/lib/engine/score.ts:89-131`, `parameters.ts:57-62`: the moonlight penalty in deep-sky scoring.
- `src/lib/tonight/build.ts:92-141, 217, 335, 376-424`: planet view types, seen summaries and the twilight-window block.
- `src/components/tonight/PlanetSection.astro:19-36`, `PlanetCard.astro:20-67`, `TonightContent.astro:65, 148, 169`: the Tonight UI.
- `src/lib/tonight/load.ts:153-161`, `src/pages/tonight.astro:15-32`: the log link and the `?logged=` notice.
- `src/lib/tonight/format.ts:186-187, 345-363`, `src/i18n/messages/en.ts:398-403, 514-516, 618-630`: existing Moon wording and target copy.
- `src/lib/engine/moon.test.ts:116-130`, `fixtures/stellarium/*.json:30-32`, `scripts/planet-reference.py:44-52`: Moon verification status.
- `tests/e2e/planets-on-tonight.spec.ts`: the e2e pattern.

## Architecture Insights

- Solar-system targets are a separate section, scored on their own grounds, above the Messier ranking. M-1's deep-sky calibration is untouched. The Moon slots in as a single-entry section or card next to "Planets tonight", rather than inside `rankPlanets`, whose size-based score makes no sense for the Moon.
- The engine stays pure. Any new Moon facts (elongation, band, rise/set, diameter) belong in `moon.ts` or a new `moon-target.ts`, with candidate thresholds in `parameters.ts`, under `purity.test.ts`.
- Copy lives in the i18n catalogue (EN and PL with a parity test). Phase-band notes are fixed keyed strings, as the planet "what you'll see" notes are (`en.ts:490-493`).
- The guardrail "never outside the darkness window" was already relaxed for solar-system targets by S-01's −6° window. The PRD is still v2 and still lists "Anything outside the Messier catalogue" under Non-Goals (`prd.md:455`). Roadmap Open Question 1 remains unresolved, and S-01 shipped under the roadmap charter.

## Historical Context (from prior changes)

- `context/archive/2026-09-30-planets-on-tonight/plan.md:47, 66, 485`: the Moon is deferred to S-02. S-02 extends the key grammar and DB check. Dropping `messier` and the trigger waits until S-02/S-03 settle the grammar. All three are supported by the current code.
- `context/archive/2026-09-30-planets-on-tonight/reviews/impl-review-phase-3.md:146-154` (F10, accepted): extract the shared window/best/log block, duplicated between PlanetCard and ObjectDetails, when building the Moon card. This is still open: PlanetCard still has its own copy.
- `context/archive/2026-09-22-verified-ephemeris-core/change.md:16`: the six Moon/object Stellarium captures were deferred to #19, which is still open.
- `context/foundation/roadmap.md` S-02: candidate "Moon night" rule (>70% lit and up for most of the dark window) and coarse phase-band notes. The risk it names is "advice that sounds confident but is wrong".

## Related Research

- `context/archive/2026-09-30-planets-on-tonight/plan.md`: the planet-slice research and plan this change builds on.

## Open Questions

Product and UI questions for `/10x-plan`:

1. **Placement.** Is the Moon its own card above or beside "Planets tonight", or the first entry in a "Solar system" section? Is it shown every night it is up, or only above some illumination?
2. **Moon-night rule.** Pick a threshold: the roadmap's >70% and up for most of the dark window, or the stricter rule of thumb, about first to last quarter (≥50%) and up for most of astronomical darkness. Also decide where the "faint deep sky is a poor bet tonight" message goes (verdict card or a ranking banner) and whether it changes the ranking or only explains it.
3. **Eyepiece.** One eyepiece, or two: a low-power whole disc plus the planet-rule detail eyepiece? The Moon's 0.5° disc has to fit the field for the whole-disc pick.
4. **Window.** Use the planet −6° window, and decide whether a morning-only waning Moon counts when Tonight shows the evening ahead (the same limitation S-01 accepted for morning planets).
5. **Verification.** Generate a Skyfield/DE421 Moon reference (elongation, illumination, rise/set, alt/az) on a non-new-moon date, for example 2026-10-24 Warsaw, as S-01 did for planets. Capturing the pending Stellarium fixtures (#19) is the alternative.
