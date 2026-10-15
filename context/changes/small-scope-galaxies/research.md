---
date: 2026-10-15T00:00:00+02:00
researcher: Claude (herdr agent "galaxies", Opus)
git_commit: 42ce808
branch: feat/small-scope-galaxies
repository: sidereus
topic: "Galaxies in a small telescope: why M31 reads 'very faint' beside 'bright for your 60 mm', why M101 ranks high in an 80 mm, and what published references say"
tags: [research, engine, expectation, ranking, score, catalogue, calibration, m-4, s-04]
status: complete
last_updated: 2026-10-15
last_updated_by: Claude (herdr agent "galaxies", Opus)
---

# Research: Galaxies in a small telescope (M-4 S-04, #172, #159, #21 item 3)

**Date**: 2026-10-15 (Europe/Warsaw)
**Researcher**: Claude (herdr agent "galaxies", Opus), with four read-only subagents (two web-source, two codebase)
**Git Commit**: 42ce808 (main at branch point)
**Branch**: feat/small-scope-galaxies
**Repository**: sidereus

## Research Question

M-4's north star (roadmap PR #176, S-04; GitHub #172) says: a user with a small telescope gets galaxy advice that agrees with itself. A big bright galaxy such as M31 is not called "very faint" beside "bright for your 60 mm" (#159), and a faint, low-surface-brightness galaxy such as M101 is not ranked high in an 80 mm (#21 item 3). This document covers:

1. Why the two lines disagree today.
2. Why the ranking lifts M101.
3. What published small-scope references say about M31, M33, M81 and M101 (plus a few secondary galaxies), as input for the reference fixture before any rule changes (lessons.md, "Judge advice that no observer can check against source-cited references").
4. Which rule shapes can fix both problems without breaking the engine's invariants and the calibration oracle.

## Summary

- **Two measures, one physics.**
  - The reason line "bright for your N mm" comes from the `brightness` score component: total magnitude against the telescope's limiting magnitude (`src/lib/engine/score.ts:176`, worded in `src/lib/tonight/format.ts:318`).
  - The what-to-expect line comes from a core surface brightness: `effectiveSurfaceBrightness`, which spreads V over the catalogue ellipse and subtracts a flat `BRIGHT_CORE_OFFSET_MAG` = 1.5 (`src/lib/engine/moonlight.ts:103-112`, `parameters.ts:376`). That core is compared with the moonless sky (`expectation.ts:80-87`).
  - For M31 (V 3.44, 177.8′ × 69.7′) the core comes out at 20.8 mag/arcsec². That is far fainter than the bulge observers see. The line therefore reads `galaxyFaint` at 60 mm under Bortle 6, while the brightness component is high.
- **Reproduced in a probe** (a scratch vitest file, since removed; Warsaw at the calibration nights, Bortle 3/5/6, apertures 60/80/150 mm):
  - M31 ranks #1 or #2 on 2026-07-15 and 2026-10-15 at Bortle 6 for every aperture probed (60, 80 and 150 mm), with `galaxyFaint`.
  - M101 ranks #6 on every 2026-04-15 run, including 60 mm / Bortle 6, where its own line is `galaxyLimit`.
  - M101 ranks #5 at the S-02 checkpoint's Night 3 (Bieszczady, 2027-04-06, Bortle 3, 80/400), where its line is `galaxySmudge`.
  - M33 ranks #8 at 60 mm / Bortle 6 on 2026-10-15 with `galaxyLimit`.
- **The ranking's low-surface-brightness penalty cannot tell galaxies apart.**
  - `skyPenalty` applies `bortlePenaltyForBortle(bortle)` to every object whose catalogue surface brightness is above 21 mag/arcsec² (`score.ts:96-102`, `parameters.ts:124-140`).
  - All 68 catalogue galaxies are above 21 (from 21.1 to 25.0; the full list was printed from `messier.json` + `caldwell.json`). The penalty therefore works as a flat "galaxy" penalty of weight 0.1, with no aperture input. The penalty is identical for M81 and M101.
- **Published references** (detail below). Verified quotes support:
  - M31's core stays visible from suburban skies, but is "detectable but faint" at Bortle 5-6 and "very difficult" at Bortle 7-8 (Telescope Advisor). Astronomy: "M31's bright central core will pierce all but the worst sky glow". → `galaxySmudge` in a 60 mm at Bortle 5-6, `galaxyFaint` at Bortle 8. Today's rule says `galaxyFaint` at Bortle 6 and `galaxyLimit` at Bortle 7-9.
  - M33 is hard or invisible from suburbs, and a "very large diffuse patch" in an 80 mm when the sky allows. M101 shows a "large nebulous haze with a brighter centre" in an 80 mm under dark skies, and is "difficult" (B5-6) to "effectively invisible" (B7-8) under light pollution. Today's rule already matches these, except M33 at 80 mm / Bortle 6, where it computes a deficit of 2.47 against the `galaxyLimit` threshold of 2.5.
- **One catalogue fact separates M31 from M33.**
  - The pinned OpenNGC commit (`da90466…`, the same pin as `scripts/build-catalogue.mjs`) has a `Hubble` column for every catalogue galaxy. It gives M31 `Sb`, M81 `Sab` and M51 `SABb`, but M33 `Sc`, M101 `SABc` and NGC 2403 `SABc`.
  - Bulge-dominated spirals have bright, concentrated centres; late-type discs do not. A bulge-type core term moves M31 and leaves the disc-type references (M33, M101), which already pass, untouched.
  - Today the catalogue does not carry the field. `npm run catalogue:build` would need to extract it (CLAUDE.md tripwire: change the generator and re-run it, never hand-edit).
- **Calibrated window.** With a fixed extra core term `e` for bulge-type spirals (S0 to Sb, plain, barred and SAB), the published M31 bands at 60 mm fix `e`:
  - Bortle 5 and Bortle 6 both read `galaxySmudge` (deficit 1.36 − e must sit in [0.5, 1.5), and 2.16 − e below 1.5). This needs 0.66 < e ≤ 0.86.
  - Bortle 8 reads `galaxyFaint` (3.26 − e in [1.5, 2.5)). This needs 0.76 < e ≤ 1.76.
  - Together: **0.77 ≤ e ≤ 0.86**. If the owner accepts `galaxyBright` at Bortle 5, the window widens to 0.77 ≤ e ≤ 1.66.
  - At e = 1.25, the existing 150 mm / Bortle 4 references are unchanged (0 keys move there), and 6 galaxies change key at 60 mm / Bortle 6.
- **Ranking fix that keeps the invariants.**
  - For galaxies, cap the `brightness` component by how visible the galaxy's core is in this telescope from this sky (the same contrast deficit as the expectation). The reason line then follows automatically.
  - The deficit only falls with aperture and only rises with Bortle, so ranking invariant (g) ("aperture never shrinks the cleared set", `ranking-invariants.test.ts:386-392`) and the D-3 monotonicity (`expectation.test.ts:56,69`) still hold.
  - M101 at a dark site in an 80 mm is a source-backed `galaxySmudge`, and its brightness credit (0.50) is already below what such a cap would allow. A cap tied to the expectation therefore leaves it at #5 at Bieszczady. Whether it must still leave the top 5 there is a product call for the owner (Q1 below).

## Detailed Findings

### 1. The what-to-expect rule (`src/lib/engine/expectation.ts`)

- `contrastDeficit` (`:80-87`) = `effectiveSurfaceBrightness(object)` − `darkSkyZenithMagForBortle(bortle)` − 0.5·log2(aperture / 150).
- The bands are `bright` < 0.5 ≤ `smudge` < 1.5 ≤ `faint` < 2.5 ≤ `limit` (`:89-100`, `parameters.ts:416-429`).
- Near-limit floor: an object within 1 mag of `telescopeLimitingMag` is at least `faint` (`:106-110`, `parameters.ts:436`).
- `galaxyKey` (`:112-126`): `bright` becomes `galaxyBright` only when the galaxy is at least `EXPECT_BRIGHT_GALAXY_MARGIN_MAG` = 5 mag above the telescope's limit (`parameters.ts:518`). Otherwise it is `galaxySmudge`. In practice this caps every galaxy except M31 and M81 at `galaxySmudge` at 150 mm / Bortle 4. At 60 mm / Bortle 4 it caps every galaxy except M31.
- `effectiveSurfaceBrightness` (`moonlight.ts:103-112`) is shared with the washed-out rule (`score.ts:146`). It is re-exported from `index.ts:21` and imported nowhere else in `src` (codebase worker's grep).
- Today's computed bands for the galaxies in question (current code, computed with the same formulas in a scratch script):

| Galaxy | 60 mm B4 | 60 mm B5 | 60 mm B6 | 60 mm B7 | 60 mm B8 | 80 mm B3 | 80 mm B6 | 150 mm B4 |
|---|---|---|---|---|---|---|---|---|
| M31 (core 20.80) | smudge 0.66 | smudge 1.36 | **faint 2.16** | limit 2.76 | limit 3.26 | bright | faint 1.9 | bright 0.00 |
| M33 (core 21.31) | smudge 1.17 | faint 1.9 | limit 2.7 | limit | limit | bright 0.4 | faint 2.47 | smudge |
| M81 (core 20.01) | smudge | smudge 0.6 | smudge 1.4 | faint 2.0 | faint | smudge | smudge 1.2 | bright |
| M101 (core 21.89) | faint 1.8 | faint 2.5 | limit 3.2 | limit | limit | smudge 0.94 | limit 3.0 | smudge 1.1 |

### 2. The ranking and the reason line

- Aperture enters the score only through `telescopeLimitingMag` (`score.ts:92-94,131`). That limit feeds the visibility cut (`:132`) and the brightness component, `clamp01((limit − vMag) / 8)` (`:176`).
- `skyPenalty` (`score.ts:96-102`) is flat per Bortle class:
  - 0 at Bortle 1-2, 0.067 at 3, 0.2 at 5, 0.267 at 6, 0.4 at 8-9 (`parameters.ts:130-140`, pinned in `score.test.ts:74-81`);
  - it applies to every object above 21 mag/arcsec²;
  - weights: duration 0.35, moon 0.3, brightness 0.25, sky 0.1 (`parameters.ts:57-62`).
- Rank score is `total − seen penalty + MESSIER_RANK_BONUS` (0.03 for Messier objects), with ties broken by Messier number (`ranking.ts:201-212,258-267`).
- Reasons (`ranking.ts:150-195`): each listed entry's lead reason is the component that stands out most against the mean of the listed entries, weighted by `SCORE_WEIGHTS`. The brightness phrase is `tonight.reason.brightness.lead/follow`, "Bright for your {aperture} mm" (`src/i18n/messages/en.ts:763-766`, picked at `format.ts:303-323`). It shares no code with the expectation, which is computed only in the Targets island and the finder chart (`src/lib/tonight/expectation.ts`).
- Probe results (current code, top-10 positions; the full output is in the session):
  - **2026-07-15 Warsaw, Bortle 6:** M31 is #2 at 60, 80 and 150 mm with `galaxyFaint` and brightness 0.79-1.00. This is the #159 contradiction.
  - **2026-10-15, Bortle 6:** M31 is #1 at 60/80 mm (`galaxyFaint`). M33 is #8 (`galaxyLimit` at 60 mm, `galaxyFaint` at 80 mm).
  - **2026-04-15, Bortle 5 and 6:** M101 is #6 at every aperture, with `galaxyFaint` at Bortle 5 and `galaxyLimit` at Bortle 6. Total 0.782 at 60 mm / Bortle 6.
  - **Bieszczady, 2027-04-06, Bortle 3, 80/400:** M101 is #5 (total 0.868; brightness 0.50, sky 0.93, `galaxySmudge`). M81 is #2. This reproduces the S-02 checkpoint (`context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md:201`).
  - In every run the top ten includes non-galaxies (globulars, open clusters). The galaxies just below M101 at Bieszczady are M94 (0.857), M82 (0.856), M51 (0.854) and M64 (0.849); the globular M92 is at 0.850.

### 3. Tests and guards a change must keep or touch

- **`expectation.test.ts`:**
  - D-3 invariants over every catalogue object, Bortle 1-9 and apertures {20, 60, 80, 100, 130, 150, 200, 300, 1000}: total and deterministic, a band never brightens at a worse sky (`:56`) and never fades at a bigger aperture (`:69`), globular resolution never regresses, and every key is reachable (`:98`).
  - Reference tests: the showcase and hard lists are counted exactly at 15 + 7 = 22 (`:182-196`), so new entries extend those lists. Each entry needs ≥ 2 distinct https sources (`:198-211`), and the published key is computed for every entry (`:213-218`).
  - `KNOWN_DIVERGENCES`: at most 3 entries, and each must still diverge (`:220-228`).
- **`score.test.ts`:** sky component at `:263-286`, brightness ramp at `:233-260`, totals at `:300-304`. The washed-out tests (`:170-231`) move only if `effectiveSurfaceBrightness` changes.
- **`ranking.test.ts`:** borderline objects at `:115-125` and `:352-355` are tuned to the flat sky penalty and the brightness ramp at 150 mm. They use a double star with surface brightness 22, not a galaxy, so a galaxy-only change leaves them alone.
- **`ranking-invariants.test.ts`:** relations over the calibration nights and 20 generated cases. (d) every listed entry has total ≥ `MIN_OBJECT_SCORE`; (e) washed-out objects are never listed; (g) the set cleared at 150 mm is a subset of the set cleared at 300 mm (`:386-392`). A new term must not decrease with aperture.
- **`calibration.test.ts`:**
  - Setup: Warsaw, Bortle 5, 150/750 only, nights 2026-01-15, 04-15, 07-15, 10-15 (`:23-50`).
  - Top-5 overlap with `BEGINNER_REFERENCE` ≥ 3 (`:28,104-114`). Today the overlap is **exactly 3 on all four nights**, so there is no slack.
  - In-reference matches: Jan NGC869, M35, M37; Apr M3, M13, M81; Jul M39, M13, NGC7000; Oct M31, NGC869, M39.
  - Other rules: ≥ 1 Caldwell clears, ≥ 3 Messier in the top 5, NGC869 in the October top 10, no Caldwell galaxy fainter than 10 mag in the top 5.
  - Nothing in the suite runs at 60 or 80 mm, or at any Bortle other than 5.
  - Roadmap S-05 requires calibration.test.ts and the beginner reference to "stay green without being regenerated" (roadmap PR #176, S-05 Risk).
- **`purity.test.ts`:** the engine stays free of clock, env, network and filesystem. Any new parameter or catalogue field is plain data.
- **Catalogue tests:** `messier.test.ts` and `caldwell.test.ts` assert the shape and provenance of the generated JSON. A new field changes their shape check.

### 4. Published references (all fetched 2026-10-15; "V" = verified on the page, "S" = search snippet only)

Fetched text went through a summarising fetcher, so quotes are near-verbatim. The lead agent re-fetched and confirmed the four marked ★. No personal data was sent in any request.

**M31**
- ★ Telescope Advisor, "Does light pollution ruin telescope viewing" (https://www.telescopeadvisor.com/does-light-pollution-ruin-telescope-viewing/, already `SRC.TELESCOPE_ADVISOR_LIGHT_POLLUTION` in the fixture). Its table puts bright galaxies (M31, M81, M82) at "Detectable but faint" for Bortle 5-6 (suburb) and "Very difficult" for 7-8. It puts faint galaxies (M101, Leo Triplet) at "Difficult" for 5-6 and "Effectively invisible" for 7-8. It also lists "Faint galaxies — M101, M51, Leo triplet (need Bortle 4 or better)". (V)
- ★ Telescope Advisor, "Can you see the Andromeda Galaxy from a city" (https://www.telescopeadvisor.com/can-you-see-andromeda-galaxy-from-city/): Bortle 7 "Core + short surrounding elongation"; Bortle 8 "Compact oval core, limited halo" (4-8 inch, low power); Bortle 9 "Core only, intermittent with averted vision". (V)
- ★ Astronomy, "Explore deep-sky delights" (https://www.astronomy.com/observing/explore-deep-sky-delights/): "Although light pollution will squelch the faint extensions of its spiral arms, M31's bright central core will pierce all but the worst sky glow." (V)
- Telescope Advisor, "How to find the Andromeda Galaxy" (https://www.telescopeadvisor.com/how-to-find-andromeda-galaxy-telescope/):
  - 50-70 mm: "A large, elongated grey patch. The core region appears brighter and slightly oval".
  - "The core of Andromeda is visible from suburban skies (Bortle 5–6) through binoculars or a small telescope". (V)
- Astronomy Now (https://astronomynow.com/?p=8797): "the bright nucleus, M32 and M110 are easy targets for small telescopes." (V)
- Skyhound, M31 page with the Astronomy magazine text (https://observing.skyhound.com/archives/oct/M_31.html): "From a relatively light-polluted location all you will see is the feeble glow of the nucleus." (V)
- Already in the fixture at 150 mm / Bortle 4 (`galaxyBright`): Starlust, Astronomy "Michael's Miscellany: Andromeda", and Telescope Advisor light-pollution (`fixtures/expect-reference.ts:277-285`).
- **Mapping:** at 60 mm, Bortle 5-6 → `galaxySmudge` (core visible, "detectable but faint", core pierces the glow); Bortle 8 → `galaxyFaint` ("very difficult", "compact oval core", "feeble glow of the nucleus"); Bortle 9 → `galaxyFaint` or `galaxyLimit` (one source, "core only, intermittent with averted vision"). The sources disagree on Bortle 7 ("core + short elongation" vs "very difficult"), so no entry is proposed there.

**M33**
- ★ Astronomy, "Explore deep-sky delights" (URL above): "spotting it using binoculars through light-polluted suburban skies is challenging enough"; "many an amateur has spent long hours searching for it to no avail"; averted vision with "any" instrument. (V)
- Astronomy Now, "Observe majestic Messier 33" (https://astronomynow.com/2022/10/12/observe-majestic-messier-33-a-local-group-heavyweight/, already `SRC.ASTRONOMY_NOW_M33`): hard to pick out under "an urban or even a suburban sky"; "blighted with low surface brightness"; from a dark site "a fine sight through binoculars or a small, wide-field refractor". (V)
- FreeStarCharts, Messier 33 (https://freestarcharts.com/messier-33): "An 80mm (3.1-inch) scope shows the galaxy as a very large diffuse patch of light"; "even a small amount of light pollution can render it invisible." (V)
- Sky & Telescope, Nov 2023 (nxtbook, 403): hard from suburban backyards, averted vision "usually". (S, not citable as verified)
- **Mapping:** 80 mm / Bortle 6 → `galaxyLimit` (three verified sources). 60-80 mm / Bortle 3-4 → `galaxySmudge` (Astronomy Now and FreeStarCharts). Today's rule computes `galaxyFaint` at 80 mm / Bortle 6 (deficit 2.47, 0.03 short of `limit`) and `galaxySmudge` at 60-80 mm / Bortle 4.

**M81 (and M82)**
- Telescope Advisor, M81/M82 guide (https://www.telescopeadvisor.com/bodes-galaxy-m81-m82-telescope-guide/, already `SRC.TELESCOPE_ADVISOR_M81`): "visible in any telescope with at least 80mm (3-inch) aperture under dark skies"; at 100 mm, "Bright oval disc with intense core". (V)
- Starlust, M81 and M82 (https://starlust.org/m81-and-m82-galaxies): "bright enough to be visible in 7×50 binoculars in suburban skies". (V)
- National Geographic (https://www.nationalgeographic.com/science/article/160425-weeks-night-sky-jupiter-galaxies-space-astronomy): can be located easily with binoculars and backyard telescopes "even from light-polluted suburbia" (partial quote). (V)
- Telescope Advisor light-pollution table (above): "Detectable but faint" at Bortle 5-6.
- **Mapping:** 80 mm / Bortle 5 → `galaxySmudge` (today's rule: `galaxySmudge`, capped by the 5-mag margin).

**M101**
- FreeStarCharts, Messier 101 (https://freestarcharts.com/messier-101): "Small 80mm (3.1-inch) refractors display a large nebulous haze with a brighter centre"; "dark moonless skies are a must"; "suffers from low surface brightness and in … light polluted areas" is sometimes difficult to spot even with 200 mm scopes. (V; ★ re-fetched)
- Telescope Advisor, M101 guide (https://www.telescopeadvisor.com/pinwheel-galaxy-m101-telescope-guide/): "M101 is strongly affected by light pollution"; "a completely different object under Bortle 3 skies than Bortle 5"; "80mm sees the core" (dark skies); at 100 mm, "a large, diffuse glow with a slightly brighter centre … Very low contrast. Averted vision essential." (V)
- Astronomy, "101 must-see cosmic objects: M101" (already `SRC.ASTRONOMY_M101`): "The core is relatively easy to observe in small scopes"; "M101 can be a wonder or a disappointment, depending on observing conditions." (V)
- Astronomy, "Discover the secrets of the Northern Pinwheel" (https://www.astronomy.com/science/discover-the-secrets-of-the-northern-pinwheel-galaxy/): "a large, faintly glowing circular area"; first-time observers can "pass right over" it. (V)
- Skyhound, M101 (https://observing.skyhound.com/archives/may/M_101.html): the author searched for its spiral structure "with all sorts of instruments, from binoculars to a 21-inch telescope". (V; this is about structure, not detection.)
- **Mapping:** 80 mm / Bortle 3 → `galaxySmudge` (FreeStarCharts, Telescope Advisor, Astronomy); 80 mm / Bortle 6 → `galaxyLimit` (Telescope Advisor "difficult" to "effectively invisible", FreeStarCharts). Today's rule matches both.
- **No source says to avoid M101 at a dark site with 80 mm.** The S-02 checkpoint judged its #5 "optimistic for an 80 mm" (`checkpoint.md:236-241,265`). That was a reviewer's judgement, not a published source.

**Secondary (one source each unless noted; not proposed as fixture entries)**
- M51:
  - Skyhound (already in the fixture): "In 6-inch or smaller scopes … a large, round, hazy spot with a large, slightly brighter center".
  - Telescope Advisor: "a faint oval glow in a 70mm telescope under dark skies"; at Bortle 5-6 "fainter but its core and companion are still visible in a 150mm+ scope".
- M74, Astronomy: "difficult to observe, especially from light-polluted areas"; a 4-inch at low power shows "a ghostly globe of uniform light surrounding a bright, starlike nucleus".
- NGC 2403, Astronomy: "isn't difficult in a 4-inch".
- NGC 6946, M110, IC 342: nothing verified.

**Gaps.**
- No verified page states a 60-80 mm aperture together with a Bortle class for M31 or M33. Every small-scope entry above combines a sky-class source with an aperture source (in some cases from the same publisher).
- Sky & Telescope, Cloudy Nights articles, SEDS and BBC Sky at Night were unreachable (403 or no result). Forum posts were not used.
- The plan's Phase 1 must re-read each page when it writes the fixture (`accessed` date), and must not cite a snippet.

### 5. The `Hubble` field and the core term

- OpenNGC's `NGC.csv` at the pinned commit `da90466031b0372c896588b85be6016c617e205b` (the same commit as `messier.meta.json`) has a `Hubble` column. Every one of the 68 catalogue galaxies has a value. The counts are E 14, Sb 9, Sc 7, SABb 5, Sbc 5, Sab 5, SABc 5, S0-a 3, SABa 2, Sa 2, IB 2, SBm 2, S? 1 (M82), SBd 1, S0 1, SBcd 1, SBbc 1, I 1, E-S0 1.
- Membership of a bulge-type class (S0, S0-a, E-S0, Sa, SABa, Sab, Sb, SABb), from the lead agent's script over the pinned CSV:
  - In the class: M31, M51, M58, M64, M65, M66, M77, M81, M85, M88, M90, M91, M94, M95, M96, M98, M100, M102, M104, NGC891, NGC1275, NGC2775, NGC3115, NGC3626, NGC4565, NGC5005, NGC5248, NGC7814.
  - Outside it: M33 (Sc), M101 (SABc), NGC2403 (SABc), M74 (Sc), M83 (Sc), the ellipticals and the irregulars.
- **Why the class matters physically.** A flat 1.5 mag "core is brighter than the mean" offset fits a disc-dominated galaxy. The references calibrated it on M33 and M101 at 150 mm (`expect-reference.ts`), and those references still pass. A bulge-dominated spiral concentrates its light. M31's bulge is about 30 % of its mass (Wikipedia citing Tamm et al. 2012, a mass and not a light fraction), and its central region is far brighter than the D25-ellipse mean (one Sérsic fit snippet gives I0 ≈ 15.4 V mag/arcsec² within the inner 5′; unverified, so it is not used as a number).
- **Ellipticals** (14, including the dwarfs M110, NGC147 and NGC185, which have low surface brightness) are better left out of the bulge class. A blanket E offset would brighten the dwarfs, and NGC4889 is already a known divergence in the brightening direction (`expect-reference.ts:432-441`).
- **Simulated effect** of a bulge term `e` (scratch script over the generated JSON plus the pinned CSV):
  - **M31 at 60 mm**, by `e`:

    | e | B4 | B5 | B6 | B7 | B8 | B9 |
    |---|---|---|---|---|---|---|
    | 0.8 | bright | smudge | smudge | faint | faint | limit |
    | 1.0 | bright | **bright** | smudge | faint | faint | limit |
    | 1.25 | bright | bright | smudge | faint | faint | faint |
    | 1.5 | bright | bright | smudge | smudge | faint | faint |

    At 150 mm / Bortle 4 it stays `galaxyBright`.
  - At e = 1.25, 6 galaxies change key at 60 mm / B6 (M31 faint→smudge; M51 faint→smudge; M88, M91, M98 and NGC4565 limit→faint). 0 change at 150 mm / B4, 14 at 150 mm / B7 (each moves one band brighter) and 1 at 200 mm / B5. The plan has to re-run this table at its chosen `e`.
  - Fixed per object, the term keeps D-3 monotonicity: it is a per-object constant inside the deficit.
- **Alternatives considered:**
  - **Headroom floor:** a galaxy at least N mag above the limit never reads below `galaxySmudge` (the #159 issue's suggestion). It cannot separate M31 from M33, because both are bright in total magnitude. Any N that lifts M31 at 60 mm / B6 (headroom 6.3) also lifts M33 at 150-200 mm / B6 (headroom 6.0-7.1), against the sources.
  - **A per-object exception** for M31, like the fixed keys of M24, M40 and M73: it works, but it is ad hoc and leaves M81-class galaxies on the old core.
  - **HyperLEDA's mean effective (half-light) surface brightness:** this is a better concentration-aware measure (HyperLEDA field docs, https://leda.univ-lyon1.fr/a105/fields.html). It would be a new pinned data source with its own licence review, which is out of scope for the slice.
  - **A bulge-plus-disc model** with B/T by Hubble type: it needs a bulge size that the catalogue does not have, and it over-brightens M33 (a 5′ "bulge" carrying 10 % of the light gives 20.4 against the disc's 21.3).

### 6. Ranking options

- **R-a (contrast cap on brightness, galaxies only).** `brightness = min(headroom ramp, visibility ramp)`, where the visibility ramp falls from 1 at the `bright` threshold to 0 at a candidate deficit, for example 3.5 = `WASHED_OUT_CONTRAST_MAG`. It uses the same deficit as the expectation, including the bulge term. Arithmetic on the probe values with a zero at 3.5:
  - M101 at 80 mm / Bortle 6 (deficit 3.0): brightness 0.31 → 0.17, total 0.801 → 0.766, out of the top 10.
  - M33 at 60 mm / Bortle 6 (deficit 2.7): total 0.834 → 0.776.
  - M31 at 60 mm / Bortle 6 (deficit 2.16 − e): brightness unchanged at 0.79, because the cap does not bind. M31 stays #1 or #2 and its line becomes `galaxySmudge`.
  - M101 at Bieszczady (deficit 0.94, cap 0.85 > 0.50): unchanged, still #5.
  - Calibration, Oct 150 mm / B5: M33's total falls about 0.01, so it may swap with NGC752 at #5/#6. The overlap stays M31, NGC869, M39 = 3.
  - The reason line follows the component, so "bright for your N mm" stops leading for a galaxy the line calls faint.
- **R-b (graded sky penalty, galaxies only).** Replace the flat Bortle penalty with one graded by the contrast deficit. Its weight is only 0.1, so it moves totals by at most 0.1. It does not touch the reason line, and it changes `score.test.ts:263-286` semantics.
- **R-c (stricter for small apertures).** An extra low-surface-brightness penalty below about 100 mm, so that M101 leaves the top 5 at a dark site. It contradicts the sources at Bortle 3, and if it uses the margin-capped band it would also hit M81 (`galaxySmudge` at 80 mm because of the 5-mag margin).
- Any of these must keep (g) and (d). With R-a, an object can fall below `MIN_OBJECT_SCORE` and leave the list, the same way the flat penalty does today. The engine already drops objects that never clear the bar.

## Code References

- `src/lib/engine/expectation.ts:80-126` – contrast deficit, bands, near-limit floor, galaxy key
- `src/lib/engine/moonlight.ts:103-112` – `effectiveSurfaceBrightness` (flat core offset)
- `src/lib/engine/score.ts:92-102,131-183` – limiting magnitude, sky penalty, components, washed-out rule
- `src/lib/engine/parameters.ts:57-65,97-140,376,402-525` – weights, bar, ramp, Bortle penalty, core offset, `EXPECT_*`
- `src/lib/engine/ranking.ts:150-195,201-288` – reasons, tie-break, rank score, top-N
- `src/lib/tonight/format.ts:303-334` – reason phrases, including "Bright for your N mm"
- `src/lib/tonight/expectation.ts` – the server gate that computes the expectation key (unchanged by this slice)
- `src/lib/engine/fixtures/expect-reference.ts:33-55,231,277-330,418-441` – fixture shape, entries, divergences
- `src/lib/engine/expectation.test.ts:38-110,153-229` – D-3 invariants, reference tests
- `src/lib/engine/calibration.test.ts:23-114`; `src/lib/engine/fixtures/beginner-reference.ts:5-9,91-170`
- `src/lib/engine/ranking-invariants.test.ts:37-39,386-392`
- `scripts/build-catalogue.mjs:3-23,51-65` – OpenNGC pin, type mapping (the `Hubble` column is not extracted today)
- `src/lib/onboarding/presets.ts:22-32,78-82` – onboarding telescopes 102-200 mm (default n150); sky scenes city B8, suburb B6, town B5, village B4, remote B2
- `src/lib/gear/catalogue/telescopes.json` – the "Find your model" catalogue has 21 telescopes at 60 mm, 21 at 70 mm and 33 at 80 mm, so small apertures are common picks even though no onboarding preset is below 102 mm

## Architecture Insights

- The expectation and the ranking are pure engine functions over the same catalogue fields, but they use different brightness measures. Sharing one "core contrast in this telescope from this sky" function between them is what "agrees with itself" means in code. It also keeps the reason line consistent without touching `format.ts`.
- Every tuned number lives as a named candidate in `parameters.ts`, with a comment naming its calibration. A new catalogue field goes through the generator, never by hand.
- The fixture discipline is strict: entries before the rule change, ≥ 2 sources each, a failing entry is an engine finding, and at most 3 known divergences.

## Historical Context (from prior changes)

- `context/archive/2026-10-14-what-to-expect/plan.md:142-196` (D-2, D-3, D-6) – permitted rule changes, the invariants, and calibration against the fixture. Its manual check 2.9 (`manual-checks.md:10,19-23`) recorded #159 and named "a large-galaxy core term" as the candidate fix, left to the owner.
- `context/archive/2026-09-25-tonight-verdict-and-ranking/checkpoint.md:176-283` – Night 3 Bieszczady, M101 #5 at 80 mm "optimistic"; follow-up 3 names the flat, aperture-free penalty. Night 2 (Bortle 6) judged M31 #1 defensible.
- `context/archive/2026-10-02-moonlight-and-the-verdict/checkpoint.md:23-26` – washed-out threshold 3.5 and core offset 1.5 matched the calibration table without tuning, and M31 is never washed out. Changing `effectiveSurfaceBrightness` for every caller would reopen that table.
- `context/archive/2026-10-08-testing-ranking-invariants-and-calibration-oracle/plan.md:229-232` – invariants (d) and (g); the overlap oracle.
- PRD `context/foundation/prd.md:24,51` – the persona's first telescope is "typically 100-200 mm". FR-013 (`:368`), FR-038 (`:468`), Open Question 5 (Bortle penalty, uncalibrated) and Open Question 17 (wording judged without an observer). MS-02 is in roadmap PR #176: "The advice agrees with itself and with published references".

## Related Research

- `context/archive/2026-10-14-what-to-expect/` (research, plan, reviews, manual checks)
- `context/archive/2026-10-06-deep-sky-beyond-messier/evidence/calibration.md` (top ten per night when the calibration guard was written)

## Open Questions (for the plan; product and astronomy calls go to the owner)

1. **M101 at a dark site in an 80 mm** (owner). The sources say it is visible as a haze with a brighter centre (`galaxySmudge`), and the roadmap's outcome example says it should not rank high. Option R-a keeps it at #5 there and drops it from suburban skies. R-c drops it everywhere below about 100 mm.
2. **M31 from a suburb in a 60 mm** (owner). `galaxySmudge` at Bortle 5-6, as Telescope Advisor's table says (narrow window, e ≈ 0.8), or `galaxyBright` at Bortle 5, as "pierces all but the worst sky glow" and "easy targets for small telescopes" suggest (wider window, e ≈ 1.25)?
3. **How general the core fix is** (owner). Every bulge-type spiral (28 galaxies, some lines move one band brighter at small apertures or bright skies), or an M31-only exception?
4. **Galaxies at the "limit" band in the ranking** (owner). Should they stay listed, low but still a recommendation, or leave the recommendations like washed-out objects?
5. **Technical, for the plan to decide and record:** store the raw `hubble` string and map classes in `parameters.ts`; galaxies only (nebulae stay on the flat penalty); keep the washed-out rule on today's `effectiveSurfaceBrightness`; add a small-aperture ranking guard (60/80 mm, Bortle 3 and 6) beside `calibration.test.ts` without regenerating it; add a reason/line consistency invariant.
