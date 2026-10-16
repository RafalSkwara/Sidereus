---
date: 2026-10-16T21:05:00+02:00
researcher: showpieces (herdr agent, Sonnet) with four read-only subagents
git_commit: b6eb4f352ad503c25f830f9f637d86b994d151b6
branch: feat/evening-showpieces
repository: Sidereus
topic: "Evening showpieces, window edges, reason lines and the PRD Primary criterion 2 re-check (M-4 S-05, #173, #21 items 1, 4, 5)"
tags: [research, codebase, ranking, score, duration, bestWindow, calibration, reason-line, prd-criterion-2]
status: complete
last_updated: 2026-10-16
last_updated_by: showpieces
---

# Research: Evening showpieces, window edges, reason lines and the PRD criterion 2 re-check

**Date**: 2026-10-16
**Git Commit**: b6eb4f352ad503c25f830f9f637d86b994d151b6 (origin/main, S-04 merged)
**Branch**: feat/evening-showpieces
**Repository**: Sidereus

## Research Question

What does the engine do today for #21 items 1 (evening-only showpieces undervalued), 4 (10-minute grid window edges) and 5 (a reason that distinguishes nothing); which tests, fixtures and consumers constrain a change; what did earlier changes decide; and how can PRD Primary criterion 2 (the top 5 against a planetarium and an observation planner on 2-3 nights) be re-run and S-03's open calibration sign-off be closed? Status is `complete` for the agreed scope; the variants not yet measured (the AF check, Bieszczady) and what the web check could not verify are listed under Open Questions.

## Summary

1. **Item 1 is real and has one cause.** `duration = placed / track.length` (`src/lib/engine/score.ts:175`) divides the best window's altitude-weighted samples by every sample of the whole dark window, so a 4 h evening pass in a 10 h October night is capped near 0.4 even when it is perfect. Measured on the current engine (Warsaw, Bortle 5, 150/750, probe of 2026-10-16): in October M13 ranks #53 (duration 0.249, window 240 min), M15 #32, M57 #60, M27 #47, M2 #49; all sit 0.15 to 0.26 of `total` below rank 5. The same objects are already in the top 5 or near it in April and July, where the dark window is short (391 and 131 min). Bieszczady (Bortle 3) in October gives no better ranks (M13 #57-59, M57 #61-62).
2. **The issue's "short" is relative.** On 2026-10-15 the evening globulars and M57 have windows of 320-390 min (M13 240 min), not under 4 h; a "window under 4 h" rule instead catches edge-of-night objects (M3 10 min, M25 0 min, M47 84 min). Any fix has to be defined by how a window compares with a useful span, not by a fixed "short" label.
3. **A saturating duration keeps the oracle green in a probe.** Variant (b) `min(1, windowMinutes / SPAN) x mean placement over the window` (SPAN 120, 180 or 240 min give identical Warsaw October results because every window there is at least 240 min) lifts October M13 #53 to #31, M15 #32 to #19 and M57 #60 to #46, and keeps beginner-reference overlap at 3 or more on all four calibration nights (3, 4, 3, 4). It still leaves them outside the top 5. Variant (c) `placed / min(track.length, SPAN / 10)` fails April (overlap 2) at SPAN 120 and 180 and lets M42 into the January and October top 5. The probe covered the four calibration nights only; the AF set check (below) and the Bieszczady cases are not yet measured against any variant.
4. **Item 4 is real, wider than the issue says, and always conservative.** Over all 121 scored objects on Warsaw 2026-10-15 (242 edges), brute-force 1-minute edges differ from the engine's by -9 to +9 min, with 34 edges over 5 min; every error is inward (the engine window is never longer than the true one). M45 starts 4 min late there (the issue's 5.4 min is from 2026-10-10). The object-window edges are not pinned against any independent reference today; `visibility-invariants.test.ts` only checks the altitude at the edges (to 0.05 deg).
5. **Item 5 is stale in wording, alive in mechanism.** The text "100% clear of moonlight" is gone from the shipped catalogue (reworded by moonlight-and-the-verdict; only a demo string in `src/pages/design.astro:856` still has it). The same fault now reads "Holds up better in moonlight than the rest" (`src/i18n/messages/en.ts:759-762`): on a moonless night every moon component is exactly 1, so the phrase can still appear as the second reason, or as the lead through the weighted-value fallback, while distinguishing nothing.
6. **Single-sample windows are three entries in the four calibration nights** (Warsaw 150 mm: M21 on 2026-07-15, M25 and M85 on 2026-10-15, all cleared, all with duration about 0). Pinned as an accepted rule by `visibility-invariants.test.ts:259-271`.
7. **PRD criterion 2 was never run against a planner.** The M-1 checkpoint replaced Telescopius with a Skyfield recompute plus published seasonal lists because Telescopius draws its lists client-side; the roadmap's "M-1 used Telescopius" (`roadmap.md:162`) is wrong. The deep-sky Stellarium fixtures are still `pending` (issue #19). S-03's calibration sign-off (item 2.5) is still open and its snapshot predates S-04.

## Detailed Findings

### The duration component and its constraints

- Formula: `bestWindow` (`src/lib/engine/objects.ts:76-105`) returns the longest contiguous run at or above the minimum altitude; `scoreObject` sums `clamp01((alt - min) / (40 - min))` over that run only and divides by `track.length` (`score.ts:136-175`). The moon component divides by `windowSamples` instead (`score.ts:176`).
- `indexOfTime` (`score.ts:86-94`) throws when a window instant is not a sample of the track, so any refined (non-sample) window edge needs explicit sample indices in `scoreObject`.
- Parameters: `SCORE_WEIGHTS` 0.35 / 0.30 / 0.25 / 0.10 (`parameters.ts:57`), `MIN_OBJECT_SCORE` 0.45 (`:65`), `WELL_PLACED_ALTITUDE_DEG` 40 (`:111`), `MESSIER_RANK_BONUS` 0.03 (`:191`, added to `rankScore` only, `ranking.ts:259-260`), `DEFAULT_TRACK_STEP_MINUTES` 10 (`:41`).
- Duration only reorders: with moon 1 and sky 1, a brightness-1 object has `total` at least 0.65, above the 0.45 bar even at duration 0 (so a duration change moves ranks, but only affects the cleared set for faint objects).
- `WELL_PLACED_ALTITUDE_DEG` is shared with `planet-ranking.ts`, `moon-target.ts` and their tests; retuning that constant moves planets and the Moon, so a new term should be a new named candidate in `parameters.ts` (lesson "Judge advice ... against source-cited references": every tuned number is a named candidate).
- Dark-window lengths (Warsaw, Bortle 5, -15 deg Sun), engine-measured in the probe: 2026-01-15 740 min (75 samples), 2026-04-15 391 (41), 2026-07-15 131 (15), 2026-10-15 614 (63); Bieszczady Bortle 3, 2026-10-15 581 (60).
- History (checkpoint, `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md:108-114, 281`): the M-1 night of 2026-10-10 recorded M13 #26 (duration 0.272), M15 #18, M57 #29 under the whole-10-hour denominator, and named two candidate fixes (a fixed useful span saturating at N hours, or a lower `SCORE_WEIGHTS.duration`), neither tried. `WELL_PLACED_ALTITUDE_DEG` = 40 came from the Phase 1 calibration amendment (M-1 plan `:158-176`); no sweep of alternatives is recorded.

Measured October ranks on Warsaw 2026-10-15, cleared-set rank (probe, 115 cleared; gap = rank-5 `total` 0.918 minus own `total`):

| Object | Duration | Window (min) | Rank | Gap |
|---|---|---|---|---|
| M13 | 0.249 | 240 | 53 | 0.230 |
| M15 | 0.509 | 390 | 32 | 0.154 |
| M57 | 0.430 | 350 | 60 | 0.260 |
| M27 | 0.453 | 360 | 47 | 0.208 |
| M2 | 0.341 | 330 | 49 | 0.211 |

Probe variants on the same night (rank of M13 / M15 / M57; overlap with the beginner reference per night Jan, Apr, Jul, Oct):

| Variant | M13 | M15 | M57 | Overlap (Jan/Apr/Jul/Oct) |
|---|---|---|---|---|
| (a) current | 53 | 32 | 60 | 3 / 3 / 3 / 3 |
| (b) SPAN 120, 180, 240 | 31 | 19 | 46 | 3 / 4 / 3 or 3 / 4 |
| (c) SPAN 120 | 11 | 16 | 39 | 3 / 2 / 3 / 3 (fails April) |
| (c) SPAN 180 | 22 | 14 | 38 | 3 / 2 / 3 / 3 (fails April) |
| (c) SPAN 240 | 42 | 11 | 35 | 3 / 3 / 3 / 3 |

Under (b), January's top 5 swaps M81 and NGC869 for M45 and M34 and October's swaps M33 for M45. The probe is not a recommendation: it shows the zero-slack oracle tolerates a saturating term and that the item's real lever is the span definition, not a weight.

### Constraints any retune must keep

- `calibration.test.ts` (`:24-143`): four Warsaw nights, Bortle 5, 150/750; at least 3 Messier in the top 5, at least 1 Caldwell cleared, NGC869 in the October top 10, no Caldwell galaxy fainter than V 10 in the top 5, and overlap with `BEGINNER_REFERENCE` of at least `BEGINNER_OVERLAP_MIN` = 3. Today the overlap is exactly 3 on every night (matched: Jan NGC869, M35, M37; Apr M3, M13, M81; Jul M39, M13, NGC7000; Oct M31, NGC869, M39). A retune must not regenerate the snapshot or edit the reference to pass (`beginner-reference.ts:1-9`, test-plan section 6.3).
- `ranking.test.ts:238-252`: on Warsaw 2026-10-10 (Bortle 6, Messier only, 150 mm) the whole top 5 must lie in `AF_FALL_LIST` (Astronomy.com fall picks, none of M13, M15, M57, M27, M2) and contain M31. This check is stricter than the oracle's k = 3: a retune that lets M13/M15/M57 into that top 5 fails it. The M-1 plan documented retune A as green for the oracle and red for this check (`impl-review.md:116`, test-plan 6.6). Whether variant (b) passes it is not measured. Resolving this needs either a reorder within AF's picks, an AF-independent reference for that night (a legitimate "reference change" only with real sources and a dated note in `fixtures/README.md`, before the engine is looked at), or an owner decision.
- `ranking-invariants.test.ts:30-39`: (a) ratings 1-2 inert, (b) seen never decides the bar, (c) Messier bonus never decides the bar, (d) the bar is `score.total >= MIN_OBJECT_SCORE`, (e) washed-out never listed, (f) total order, (g) a bigger aperture never shrinks the cleared set (a new term must not decrease with aperture). None pins a duration value.
- `small-scope.test.ts` (G1-G6) and `score.test.ts` (S-04's galaxy cap) stay green: S-04 left the duration and Moon terms untouched on purpose (S-04 plan `:97`).
- `KNOWN_DIVERGENCES` in the what-to-expect reference is full (3 of 3, S-04 plan `:100`); S-05 does not change that rule.
- Owner decision (`CLAUDE.md`, Engine): M31 in a 60-80 mm under Bortle 7-8 reads "very faint" and leaves the top 5; do not "fix" that.
- Retune hygiene (test-plan Risk #4, section 6.3): relations and source-cited references, never values copied from engine output; `CALIBRATION_SNAPSHOT=1` output is a recording aid only.

### Window edges (item 4) and short windows

- Sampling: `sampleInstants` (`sampling.ts:12-28`) emits start + i x step plus the exact interval end; object, planet, Moon, `skyFrames` and ranking tracks share the 10-minute grid. Dark-window edges are exact; only altitude-crossing edges are quantised.
- No object-window interpolation exists. `altitude-curve.ts:30-75` interpolates linearly between samples for the SVG only; bisection exists for the Sun's dark window and the Moon's crossings (`sun.ts:52-120`, `moon.ts:99-131`, `build.ts:577-602`).
- Measured (Warsaw 2026-10-15, min altitude 15, probe against a 1-minute track through the same `bestWindow`): M45 +4 / 0, M13 0 / -7, M57 0 / -6, M42 +8 / 0, M15 0 / -9 (start / end error, engine minus brute, minutes); over all 121 scored objects: range -9 to +9, 34 of 242 edges over 5 min, all inward. The 1-minute track is the same code path, so this measures the grid error, not the engine against a planetarium.
- Reference status: `ALTITUDE_TOLERANCE_DEG` = 1 and `TIME_TOLERANCE_MINUTES` = 5 (`parameters.ts:35,38`) are exercised only by position tests (`objects.test.ts:128-132`) and Sun/dark-window edges (`sun.test.ts:115-154`); no test compares an object window's edges with an independent reference. `visibility-invariants.test.ts` (seed 20261008, 200 cases) checks altitude at start, end and best time against astronomy-engine called directly, to 0.05 deg.
- What an interpolated edge touches (consumers of `window`): `ranking.ts` (reachable, washed-out and entry windows), `plan-window.ts:53-102` (`deepSkyWindow`, `solarSystemWindow`, with `plan-window.test.ts:149,182,202` pinning `toEqual` parity with the ranking), `build.ts:865-877, 945-1004, 1202-1366` (`windowText`, plan rows, `windowEnd`), `format.ts:278,313` (the "Up for X" reason; a one-sample window prints 0 min), `session-plan.ts:93-96`, `plan-order.ts`, `altitude-curve.ts`, and `maskedTrack` in `solar-system-window.ts:28-37` (planets and Moon, which assume sample-aligned intervals). Tests asserting sample-aligned edges: `objects.test.ts:64-117`, `build.test.ts:1850` (`m13.windowText` is "19:25–23:35"), `planet-ranking.test.ts:226-227`. `events.ts` (own 5-minute grid) and `finder.ts` do not read object windows.
- Risk to test, not measured: linear interpolation on a curved track could place an edge a hair below the minimum, against the 0.05 deg invariant; the edge must also be clamped to the dark interval. Lesson "Pin a sampled scan against a brute-force reference": the refined edge must be pinned against a 1-minute reference including short and single-sample windows.
- Cost context: moving to a 5-minute grid roughly doubles ranking CPU (checkpoint `:284`), and the account is on Workers Paid since 2026-09-30, so the 10 ms cap no longer applies; interpolation at the edges is the cheaper candidate the checkpoint named.
- Short windows: three single-sample entries on the four calibration nights (M21 2026-07-15, M25 and M85 2026-10-15; January and April none); the Phase 3 invariants run counted 134 of about 13,800 entries over 200 generated cases. The decision of 2026-10-08 was "document and pin, no product change" (`visibility-invariants.test.ts:38-41, 259-271`); a minimum useful span would zero that count and the test would need a deliberate edit. A one-sample window gets duration about 0 yet clears the bar on brightness and moon alone (totals 0.48-0.63), which is exactly what a minimum-span rule would address.

### Reason lines (item 5)

- Wording (`src/i18n/messages/en.ts:753-772`, `pl.ts:669-686`): `reason.line` = lead · second; moon = "Holds up better in moonlight than the rest"; brightness = "Bright for your N mm"; duration = "Up for X of the dark window"; mapping in `src/lib/tonight/format.ts:299-332` (`componentPhrase`, `reasonLine`), called from `build.ts:871`.
- Mechanism (`ranking.ts:172-197`, `reasonComponents`): the lead is the component with the largest `weight x (value - mean over the listed entries)`; with no positive deviation, or a single entry, the largest weighted value leads, ties in the order duration, moon, brightness, sky. On a night when the Moon is down (or the object is, `moonlight.ts:82-83`) the moon component is exactly 1 for every entry: deviation 0, so it is never the lead by deviation but beats negative deviations as the second reason, and in the weighted-value fallback it leads whenever duration is below about 0.857.
- Tests pinning the selection: `ranking.test.ts:271-319` (including the fallback at `:305-311`), `small-scope.test.ts:123-148` (G5, a brightness reason must agree with the galaxy's expectation key), `build.test.ts:190`. No e2e spec or i18n test matches reason text.
- The documented fix point is `reasonComponents`/`topTwo`; no phrase has to change unless the owner wants new wording.

### PRD criterion 2: reference sources (from the checkpoint and the repo)

- M-1 evidence: `checkpoint.md:7-23, 251-286` records a Skyfield + DE421 recompute in a scratch virtualenv (never committed) on three nights (Warsaw 2026-10-10 and 2026-10-24, Bieszczady 2027-04-06) with altitude agreement 0.005 deg, azimuth 0.06 deg and dark window 0.2 s, verdict "SANE", and states that the planner was replaced by Skyfield plus published seasonal lists because Telescopius renders client-side (`:23`; M-1 `plan.md:415`, plan-brief `:34`). No Telescopius capture exists in the repo.
- The committed deep-sky planetarium fixtures are `pending` (`src/lib/engine/fixtures/stellarium/warsaw-2026-10-10.json:35-36`); Skyfield JSON fixtures exist only for planets, the Moon and pairings (`fixtures/skyfield/`, scripts `scripts/*-reference.py`). The independent altitude helper is astronomy-engine by another road (`fixtures/independent-altitude.ts`).
- The M-1 nights were Warsaw 2026-10-10 and 2026-10-24 (Bortle 6, 150/750) and Bieszczady 2027-04-06 (Bortle 3, 80/400). The one breach of the 5-minute tolerance was M45's window start (+5.4 min), the grid effect of item 4.

### PRD criterion 2: planners reachable by an agent (web check, accessed 2026-10-16)

Requests used the agreed User-Agent (the repo URL as contact, no email) and Warsaw as the only place.

| Tool | Reachable | Output | Fixed date and place | Terms |
|---|---|---|---|---|
| in-the-sky.org | Yes: static server-rendered HTML, no login, empty robots.txt | `/data/object.php?id=M13` gives rise, set, accessible-from and highest point (time, altitude) per object; `/data/deepsky.php` lists the night's objects by type ordered by magnitude, not a ranking | Yes: `?town=<GeoNames id>&year=&month=&day=` (verified `town=756135` is Warsaw; `latitude=`/`longitude=` were ignored, so always pass `town`) | Free to redistribute and modify with the copyright text and credit to Dominic Ford, not for profit (`about.php#copyright`); Sidereus has a paid plan, so the owner decided on 2026-10-16 that nothing from the site (text or numbers) enters the repo |
| Telescopius | Web UI is a JavaScript app (as M-1 found); an official REST API v2.2 exists and needs a key (401 without one) | `/targets/search` takes lat, lon, datetime, `cat=M,C`, `min_alt`, `min_alt_minutes`, hour window, `order`; per object `tonight_visibility.max_altitude`, `max_altitude_hour`, `windows` | Yes, any `datetime` per the spec | Spec: "Commercial use not allowed unless you have prior written authorization"; no key obtained, so no live response was seen |
| Stellarium desktop | Manual (GUI) | Info panel alt/az, rise/transit/set | Yes | Already the hand-read M-1 fixture tool |
| Skyfield + DE421 | Yes | Anything | Yes | Open source and JPL data; scripts already exist for planets, Moon, pairings (`scripts/*-reference.py`) |
| Stellarium Web, Heavens-Above, TheSkyLive, Astro-Planner | WebGL SPA, network reset, 403, not reachable | none read | not verified | not verified |

Observed caveats for in-the-sky.org: winter times were correct local clock but labelled "(CEST)"; its twilight rule is undocumented and appears position-dependent, so window edges depend on its rule while altitude and transit do not; its "accessible" cutoff altitude differs between objects; some object queries returned no usable sentence, so a reader must tolerate gaps; space requests 1.2 s to 2.5 s apart (ECONNRESET at 1.2 s). Telescopius `/targets/highlights` is by its definition the best-near-midnight list, so it is not an evening-showpiece list.

Published guidance for the showpieces (each fetched; none gives a clock-time evening window): M13 "May through September is prime season", "Best Seen in the Evening: Summer and Fall" (Telescope Advisor 2026; Telescopic Watch), one of "20 great objects you can see between the time it gets dark and midnight" (Astronomy.com mini marathon, 2021); M15 "autumn's showpiece globular cluster" (Astronomy.com, 2018), "Fall Objects" (Starizona); M57 "June through October", "Best Seen in the Evening: Summer and Fall", "a great target for small scopes". The AF page (`AF` in the repo's reference) lists none of M13, M15, M27, M57 or M92. A per-object evening window therefore has to come from an ephemeris, not from these pages.

Proposed procedure (a design input for the plan; the owner decides the legal and manual parts):
- Nights: reuse `calibration.test.ts` nights; for the PRD's 2-3 nights use 2026-04-15, 2026-07-15 and 2026-10-15 at Warsaw (April is the counter-case), adding 2026-01-15 only to match all four.
- Planetarium reference: a committed Skyfield + DE421 fixture (the `events-reference.py` pattern, venv run by hand once) of the engine's top ten plus M13, M15, M57, M27, M92: apparent altitude and azimuth every 10 minutes across the dark window, the true 15-degree crossings and the true maximum, and the Sun's -15 degree crossing. Test: peak altitude within 1 deg, peak time and window edges within 5 min of the true crossing (OQ 9). Window edges fail by up to one grid step until item 4 is fixed.
- Planner reference (decided by the owner on 2026-10-16: in-the-sky.org, manual cross-check, nothing committed): per-object altitude and time sanity, not a ranked list; the Telescopius API (account and key, licence forbids commercial use without written authorisation) is not used.
- "Survives" fixed before running: every top-5 object within the ephemeris tolerances; at least 3 of the engine's top 5 in the planner's top 10 by maximum altitude (mirrors the oracle's k = 3), none with maximum altitude under 15 deg or a window under 60 min; on July and October M13, M15 and M57 above 15 deg at the start of the dark window with the window on the evening side. Never edit a reference to make a night pass.

## Code References

- `src/lib/engine/score.ts:86-94, 136-180` - `indexOfTime` (throws on non-sample edges), window, `duration = placed / track.length`, moon over `windowSamples`
- `src/lib/engine/objects.ts:76-105` - `bestWindow`, the longest run above the minimum, first and last sample
- `src/lib/engine/parameters.ts:35-41, 57, 65, 105-111, 191` - tolerances, step, weights, bar, well-placed altitude, Messier bonus
- `src/lib/engine/ranking.ts:172-197, 243-289` - `reasonComponents`, reachable entries, ranking
- `src/lib/engine/calibration.test.ts:24-143` - oracle (four nights, overlap 3)
- `src/lib/engine/ranking.test.ts:238-252, 271-319` - AF set check, reason tests
- `src/lib/engine/visibility-invariants.test.ts:38-41, 124-152, 259-271` - edge invariants and the short-window pin
- `src/lib/tonight/plan-window.ts:53-102`, `plan-window.test.ts:149,182,202` - window parity with the ranking
- `src/lib/tonight/format.ts:278, 299-332` - duration text, reason mapping
- `src/i18n/messages/en.ts:753-772`, `pl.ts:669-686`; `src/pages/design.astro:856` - reason wording and the stale demo string
- `src/lib/engine/fixtures/beginner-reference.ts:1-9, 94-155, 171-192` - reference, counting rule, `AF_FALL_LIST`
- `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md:7-23, 108-114, 249, 277-286` - M-1 cross-check, items 1, 4, 5

## Architecture Insights

- One measure, many consumers: the ranking window, the Session plan rows and the planet/Moon masks all derive from `bestWindow` on the shared 10-minute grid, with parity tests; a refined edge must be one shared function, or three paths diverge.
- A duration change only reorders (it never gates a bright object), so its risk is the order oracles, not the cleared count; a window-edge change instead ripples through text, the plan axis and tests with sample-aligned expectations.
- The beginner-reference oracle (overlap 3, zero slack) and the stricter AF set check are the binding constraints; the lessons require references first, a named divergence list for known misses, and every tuned number a named candidate.

## Historical Context (from prior changes)

- `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md` - the original items 1-5, M-1 cross-check method and results
- `context/archive/2026-10-08-testing-ranking-invariants-and-calibration-oracle/` - invariants (a)-(g), the short-window decision, retune A green/red notes
- `context/archive/2026-10-06-deep-sky-beyond-messier/plan.md:538`, `evidence/calibration.md` - the open sign-off 2.5 and the stale four-night top-10 snapshot (it predates S-04, which changed April's #10; the archive is immutable, so S-05 records the sign-off in its own evidence)
- `context/archive/2026-10-15-small-scope-galaxies/` - S-04 touched `score.ts` (galaxy brightness cap) and left duration, Moon, weights and the bar alone; zero slack on the oracle; follow-up #178 is not S-05
- `context/archive/2026-10-02-moonlight-and-the-verdict/` - reworded the moon reason (item 5's text); explicitly left #21 items 1, 3, 4 for later

## Related Research

- `context/archive/2026-10-15-small-scope-galaxies/research.md` - the same lesson-driven reference approach for S-04

## Open Questions

1. Which useful-span definition fits (a fixed span, or relative to the shortest useful pass), and does it pass the AF set check on 2026-10-10 and the Bieszczady cases? Not measured; needs a plan-phase probe once the reference is fixed.
2. Where does the owner want the AF check to go if M13/M15/M57 legitimately enter the 2026-10-10 top 5 (reorder only, an AF-independent reference with new sources, or a relaxed check)? Product trade-off for the owner.
3. Interpolation versus a finer grid for window edges, and what to do with single-sample windows (a minimum useful span, or keep the pinned rule). A single-sample entry is up at its shown time, so the PRD invariant holds either way.
4. Planner for criterion 2: decided on 2026-10-16 (in-the-sky.org, manual, nothing committed). Unverified: any live Telescopius response, in-the-sky.org's twilight rule and far-future dates, Sky & Telescope pages (403).
5. The reason-line fix has no wording decision, but a different second reason for moonless nights is a small product choice.

## Follow-up (2026-10-16): the planned duration rule, measured

Probe of the exact rule the plan uses, `duration = min(1, windowMinutes / SPAN) × placed / windowSamples` (VB), recomputed outside the engine with every other term as it is; throwaway test, deleted, `git status` clean; the replication reproduced `rankObjects` order and `clearedCount` exactly for the current formula in all 8 runs. Warsaw Bortle 5 150/750 unless stated; overlap is with `BEGINNER_REFERENCE[date]`.

- **Oracle:** VB60, VB120 and VB180 keep every night at 3 or more (Jan 3, Apr 4, Jul 3, Oct 4); the current formula is 3 on every night. `duration = 1` for every object (the upper bound) falls to 1 on April, July and October.
- **Spans:** 60, 120 and 180 give the same top 5 on every night except July at 180 (M39, M31, M13, NGC7000, M71, still 3); Warsaw's July dark window is only 131 min, so a span above it scales every July object down.
- **AF check (Warsaw Bortle 6, 150 mm, Messier only, 2026-10-10):** current top 5 M31, M34, M39, M45, M52; VB top 5 M31, M45, M34, M39, M52. Every id is in `AF_FALL_LIST` and M31 is in the top 5, so the check passes unedited; with `duration = 1` it fails (M44, M42, M47, M41 enter, M31 leaves).
- **October ranks (cleared rank, current to VB120):** M13 53 to 31, M15 32 to 19, M57 60 to 46, M27 47 to 30, M2 49 to 35; top 5 swaps M33 for M45. Bieszczady Bortle 3, 2026-10-15, 80 mm: M13 57 to 37, M15 34 to 20, M57 61 to 50; 150 mm: 59 to 37, 34 to 19, 62 to 50; top 5 unchanged at 150 mm and M45 enters at 80 mm. April 2027-04-06 at 80 mm: M13 #4 to #5 and M44 enters the top 5.
- **Ceiling:** with `duration = 1` the best October-night ranks for M13, M15, M57, M27 and M2 are #17, #26, #57, #40 and #25 at Warsaw, and no better than #12 for M13 at Bieszczady 150 mm; the best across the calibration nights (July) are #10, #17, #42, #28 and #16. Brightness and type, not duration, bound how high these objects can rank.
- **Beneficiaries:** objects with long windows and low whole-night duration rise most: M45 8 to 4, M35 25 to 10, M37 20 to 12, M44 36 to 13, M36 19 to 14 (Warsaw, 2026-10-15).
- **Aperture invariant (g):** the cleared set at 60, 80 and 150 mm on 2026-10-15 is nested under both formulas (95, 99, 115 current; 101, 106, 118 VB120).
- **Reasons:** while checking item 5 the analysis found that removing only the moon phrase would promote the sky phrase on the same nights (equal sky components beat negative deviations), so the plan applies one rule to both (plan D-5).

Planner capture for criterion 2 (research phase, in-the-sky.org, Warsaw, three nights, 56 object pages, no email or personal data) is held outside the repository by the lead agent; per the owner's decision of 2026-10-16 (F6) nothing from it is committed. Observed about it: every page returned a sentence, but only about half state a highest altitude, a few objects are "not readily observable" or give no numbers, and the site's twilight is undocumented and varies slightly by object.
