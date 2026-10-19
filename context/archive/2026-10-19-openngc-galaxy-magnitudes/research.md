---
date: 2026-10-19T10:01:43+02:00
researcher: Claude (herdr agent "galaxies", Sonnet), with one read-only web subagent
git_commit: 3f75fc7
branch: fix/openngc-galaxy-magnitudes
repository: Sidereus
topic: "Where the implausible V magnitudes of 12 catalogue galaxies come from, which sources could correct them, and what each fix does to the what-to-expect bands and ranks (GitHub #178)"
tags: [research, catalogue, openngc, hyperleda, expectation, contrast, ranking, licence, m-4, s-04-follow-up]
status: partial
last_updated: 2026-10-19
last_updated_by: Claude (herdr agent "galaxies", Sonnet)
last_updated_note: "Owner decisions Q1-Q5 recorded"
---

# Research: OpenNGC V magnitudes of 12 galaxies (#178)

**Date**: 2026-10-19 (Europe/Warsaw)
**Git Commit**: 3f75fc7 (origin/main at the branch point)
**Branch**: fix/openngc-galaxy-magnitudes
**Status**: partial. The web leg was stopped on the orchestrator's request after about 36 minutes and 36 tool calls; the gaps are listed under Open Questions.

## Research Question

#178 (small-scope-galaxies impl review F1): in the pinned OpenNGC commit `da90466`, 12 catalogue galaxies have a V magnitude that is not credible (V > B − 0.2). The what-to-expect band and, since S-04, the ranking read that V. Where do the values come from, which sources could correct them with a licence compatible with `src/lib/catalogue/LICENSE-DATA.md`, and how would each fix move the bands and ranks of the 12 galaxies? Data-source and licence choices are the owner's, so this document lists options and does not pick.

## Summary

1. **The bad V is a HyperLEDA value, not a Sidereus bug.** For the 10 galaxies that have a V-Mag in the pinned `NGC.csv`, the web agent found that the pinned V and B equal HyperLEDA's `vt` and `bt` (checked for all 10 in the agent's HyperLEDA table, e.g. M106 `vt` 9.293 / `bt` 9.124; the pinned file has 9.29 / 9.12). OpenNGC's README says galaxy B-Mag and V-Mag "usually originate from LEDA if available, otherwise are from SIMBAD" (`README.md` of OpenNGC at `be3cd6c`, "NOTES ON OBJECT DATA"). HyperLEDA's own uncertainty on `vt` for the Messier objects among them is 0.99 to 1.53 mag (`e_vt`, agent table), so the value was never precise.
2. **Two of the 12 are a generator artefact, not a source value.** IC 342 (C 5) and NGC 4039 (C 61) have **no** V-Mag in the pinned file; `scripts/build-catalogue.mjs:388-395` copies B into V for a Caldwell row without a V-Mag, which makes their B−V exactly 0 by construction (`caldwell.meta.json` `normalisations` lists both: "IC0342 (C 5): vMag taken from B-Mag 9.68", "NGC4039 (C 61): vMag taken from B-Mag 11.04").
3. **A newer OpenNGC commit does not help.** The default branch head (`be3cd6c`, six commits after the pin) leaves B-Mag, V-Mag and SurfBr of all 12 rows unchanged (compared row by row, pinned vs head, both CSVs; scratch copies, not committed).
4. **Published V values exist for 6 of the 12** (the Messier ones): SEDS lists 9.7 (M58), 9.7 (M61), 9.6 (M88), 10.2 (M91), 10.1 (M98) and 8.4 (M106); SIMBAD's V agrees for M58 (9.66), M61 (9.65), M98 (10.14) and M106 (8.41). M88 and M91 have one usable source (SEDS). For the other six (IC 342, NGC 4449, NGC 5005, NGC 4565, NGC 6822, NGC 4039) no clean independent V was found (details in the table).
5. **The correction matters mostly at the edges of a band.** On the engine's own thresholds, a corrected V moves M106 at 150 mm / Bortle 6 from `faint` (deficit 2.34) to `smudge` (published 8.4, deficit 1.45 against the 1.5 edge) or only to `faint` (deficit 1.61, for a B-based estimate of 8.56). Which source the owner picks therefore decides the outcome for the issue's own example.
6. **Not reproduced:** the review's M106 totals (0.490 → 0.438, "under the bar"). On the same date, Bortle and aperture with the Messier-only catalogue and the small-scope test's eyepieces and site, M106 is listed (#58 of 67, total 0.519, brightness credit 0.100); with V = 8.4 it is #42, total 0.599, brightness 0.419. The setup behind the review's figures is not recorded in the archive (`implementation-notes.md:71` gives the totals but not the call), so the plan must reproduce the baseline before it asserts a rank (see Open Questions).

## Detailed Findings

### 1. The 12 galaxies as the catalogue holds them

From `src/lib/catalogue/messier.json` and `caldwell.json` (galaxies: 68 of the 171 objects; condition V > B − 0.2; the other 56 galaxies are the "credible" set below):

| Object | Hubble | V (cat.) | B | B−V | Origin of V |
|---|---|---|---|---|---|
| M58 | Sb | 10.30 | 10.44 | 0.14 | LEDA `vt` |
| M61 | Sbc | 10.25 | 10.16 | −0.09 | LEDA `vt` |
| M88 | Sb | 10.33 | 10.24 | −0.09 | LEDA `vt` |
| M91 | Sb | 10.96 | 10.94 | −0.02 | LEDA `vt` |
| M98 | SABb | 10.84 | 10.82 | −0.02 | LEDA `vt` |
| M106 | Sbc | 9.29 | 9.12 | −0.17 | LEDA `vt` |
| IC 342 (C 5) | SABc | 9.68 | 9.68 | 0.00 | generator copies B (no V in OpenNGC) |
| NGC 4449 (C 21) | IB | 9.64 | 9.50 | −0.14 | LEDA `vt` (`e_vt` 0.005, agent table) |
| NGC 5005 (C 29) | SABb | 10.71 | 10.54 | −0.17 | LEDA `vt` |
| NGC 4565 (C 38) | Sb | 10.86 | 10.05 | −0.81 | LEDA `vt` |
| NGC 6822 (C 57) | IB | 10.05 | 9.36 | −0.69 | LEDA `vt` |
| NGC 4039 (C 61) | SBm | 11.04 | 11.04 | 0.00 | generator copies B (no V in OpenNGC) |

(Caldwell numbers read from `caldwell.json`.) Just above the criterion, B−V between 0.2 and 0.4 and not part of the 12: M51 (0.25), M84 (0.22), NGC 4236, NGC 1275, NGC 4244, NGC 4631 and NGC 4559; none was examined against a second source.

**NGC 4449 and NGC 4565 are the two where B itself is doubtful.** NGC 4449's B−V is −0.14 (B 9.50, V 9.64), which no galaxy has; but HyperLEDA's `e_vt` for it is only 0.005 and SIMBAD's V (9.64, `2014MNRAS.445..881C`) equals the catalogue's, while NED's unfiltered main-table magnitude is 9.99, 0.49 mag fainter than the catalogue's B. So for NGC 4449 it may be B that is too bright rather than V too faint. NGC 4565 is similar: catalogue B 10.05 against NED's unfiltered 10.42 (0.37 fainter). A V computed as B minus a typical colour would carry that B error. This is an owner question (Q4).

### 2. Where the generator touches V

- `scripts/build-catalogue.mjs:221`: `toMessierObject` takes `vMag` from `row["V-Mag"]`, or from `options.vMag`; it throws when it is null (`:222-224`).
- `:388-395`: Caldwell rows without a V-Mag take B-Mag (recorded as a `normalisations` line), else a `CALDWELL_OVERRIDES` entry of `action: "vMag"` (`:84-97` documents the shape: `{ caldwell, action, id, vMag, reason, source }`, "every entry carries the https page its value was read from"); `:418-422` fails the build on an override that was not used.
- The Messier side has `OVERRIDES` (`:71-83`, actions `drop` and `assign` only); there is no V override for a Messier object today. A correction for M58 to M106 needs a new action or a shared mechanism, recorded in `messier.meta.json` as the existing overrides are.
- Both metas carry the pinned commit and `licence: "CC BY-SA 4.0"` (`:462`, `:484`); `messier.test.ts` and `caldwell.test.ts` assert only the commit and licence (`src/lib/catalogue/messier.test.ts:5-10`). The catalogue's shape is checked only at generation (CLAUDE.md "Never edit ... by hand"; test-suite-diet D7). No test today states anything about a galaxy's B−V.

### 3. How V reaches the band and the ranking

- `effectiveSurfaceBrightness` (`src/lib/engine/moonlight.ts:103-112`) is `vMag + 2.5·log10(π/4·a·b·3600) − BRIGHT_CORE_OFFSET_MAG` over the catalogue ellipse; the catalogue's `surfaceBrightness` field is **not** read. So a 1 mag error in V is a 1 mag error in the core brightness, and it moves `contrastDeficit` one for one (`src/lib/engine/contrast.ts:51-64`).
- Bands: `bright` below 0.5, `smudge` below 1.5, `faint` below 2.5, else `limit` (`EXPECT_BRIGHT_BELOW`, `EXPECT_SMUDGE_BELOW`, `EXPECT_FAINT_BELOW`, `parameters.ts:442-455`), plus a near-limit floor (`contrast.ts:83-87`).
- `brightnessOf` (`src/lib/engine/score.ts:204-210`) uses V twice: the headroom ramp `(limitingMag − vMag) / BRIGHTNESS_RAMP_MAG`, then `min(ramp, cap)` with the band's cap (`GALAXY_FAINT_BRIGHTNESS_CAP` 0.1, `GALAXY_LIMIT_BRIGHTNESS_CAP` 0). So a V error moves the ramp and the band.
- The sizes (`MajAx`, `MinAx`) are from the same LEDA-derived rows; that is a separate possible error source and is not examined here.

### 4. Candidate sources: values, terms and effect

Values are from the web subagent's report (checked 2026-10-19; it could not read SEDS live and read the Internet Archive copy). Its caveats are kept: SIMBAD V/B pairs from `2010A&A...518A..10V` (M88, M91, NGC 5005, NGC 4565) are 3 to 4 mag too faint and unusable; Wikipedia's `appmag_v` for M58, M61, M88, M91, M98 cites SEDS and for the others cites NED, so it is not an independent source; NED's main-table magnitude had no filter letter except M88 (B) and M106 (V).

**Published V per galaxy**

| Galaxy | SEDS | SIMBAD V | NED main table | HyperLEDA `vt` / `bt` |
|---|---|---|---|---|
| M58 | 9.7 | 9.66 | 10.48 (no filter) | 10.297 / 10.438 |
| M61 | 9.7 | 9.65 | 10.18 (no filter) | 10.254 / 10.159 |
| M88 | 9.6 | unusable | 9.56 (flagged B) | 10.333 / 10.245 |
| M91 | 10.2 | unusable | 10.96 (no filter) | 10.964 / 10.935 |
| M98 | 10.1 | 10.14 | 10.95 (no filter) | 10.841 / 10.823 |
| M106 | 8.4 | 8.41 | 8.41 (flagged V) | 9.293 / 9.124 |
| IC 342 | not found | none | 9.10 (no filter) | none / 9.679 |
| NGC 4449 | not found | 9.64 | 9.99 (no filter) | 9.637 / 9.501 |
| NGC 5005 | not found | unusable | 10.61 (no filter) | 10.709 / 10.539 |
| NGC 4565 | not found | unusable | 10.42 (no filter) | 10.856 / 10.055 |
| NGC 6822 | not found | 8.1 ± 0.2 (`2012AJ....144....4M`) | 9.31 (no filter) | 10.05 / 9.359 |
| NGC 4039 | not found | none | 11.08 (no filter) | none / 11.039 |

**Options**

- **A. Bump the OpenNGC pin to the current head.** No effect on the 12 (finding 3 of the Summary). It would also change B or V on 33 galaxy rows of the whole OpenNGC (counted pin vs head, not reviewed) and touch every provenance pin, so it is not a fix for #178 and would need its own change.
- **B. Hand-entered per-object V (override entries), each citing an https page.** Fits the existing override pattern (`:84-97`) and the meteor-shower precedent (facts entered by hand, rounded, no table copied; `LICENSE-DATA.md`, "Meteor showers", with its "owner's reading, not legal advice" wording). Coverage: the six Messier galaxies with SEDS (+ SIMBAD for four of them); M88 and M91 rest on one source. Terms found: SIMBAD asks that "the following acknowledgment would be appreciated" with the Wenger et al. 2000 citation (`https://simbad.cds.unistra.fr/guide/`); SEDS terms not read (site unreachable to the agent); NED's reuse terms not read (only its acknowledgement link and the standard sentence quoted in OpenNGC's README). Effect, from the probe (the other six values unchanged; table in section 5): at 150 mm, M106 goes `faint`→`smudge` at Bortle 5 and 6; M58 `smudge`→`bright` at Bortle 6; M88, M91 and M98 `smudge`→`bright` at Bortle 5; M91 and M98 `faint`→`smudge` at Bortle 6.
- **C. A generator rule: V = B − typical B−V of the galaxy's Hubble type, for a galaxy whose catalogue B−V is implausible (and for the B-fallback rows).** Stays inside OpenNGC's data (the typical colours come from the catalogue's own credible galaxies: median B−V 0.88 early types, 0.81 Sa to Sb, 0.56 Sbc to Sc, 0.47 later, computed over the 56 credible galaxies; `Sb` alone 0.81 over 5, which is a thin sample), so no new source or licence; the correction is recorded in the meta. Cost: a model, not a measurement; the catalogue's B can itself be off (NGC 4565: LEDA `bt` 10.05 against NED 10.42 unfiltered). It also matches the one published V available for a fallback row: IC 342's rule value 9.12 against NED's 9.10 (unfiltered).
- **D. Mixed: B for the six with SEDS (and SIMBAD), C for the rest.** For the six galaxies that have a published value, the rule value of C is within 0.17 mag of it (M58 9.63 vs 9.7, M61 9.60 vs 9.7, M88 9.43 vs 9.6, M91 10.13 vs 10.2, M98 10.01 vs 10.1, M106 8.56 vs 8.4), with no tuning toward those values (the medians come from the 56 credible galaxies). That is a six-point cross-check of C, not a proof for the other six.
- **E. A new V source: HyperLEDA directly.** The agent found no licence page, only "If HyperLeda was helpful to your research an acknowledgment would be appreciated" (`http://atlas.obs-hp.fr/hyperleda/`); the owner ruled HyperLEDA out for S-04 only. It would give the same `vt` that OpenNGC already ships, so a direct pull gains nothing for V. It has a fitted `bve` colour column (0.34 for NGC 4449 to 0.97 for NGC 4565, agent's partial query), which would be a per-object alternative to C but needs the licence review first.
- **F. VizieR RC3 (VII/155) or other catalogue tables.** Not checked (the agent did not read the RC3 ReadMe). VizieR says commercial use "is subject to rules depending of the origin" per catalogue (`https://cds.unistra.fr/vizier-org/licences_vizier.html`), so it needs its own review.

**Licence compatibility, as far as it was read.** `LICENSE-DATA.md` licenses the four OpenNGC files CC BY-SA 4.0 (ShareAlike). B and C stay inside that. A hand-entered value from a page with no stated licence is a fact, entered by hand; the owner's meteor-shower reading is the only precedent in the repo, and the agent could not read SEDS's or NED's terms. Not legal advice.

### 5. What each option does to the bands (the probe)

Probe: the catalogue with only the 12 `vMag`s replaced; `contrastBand` and `expectationFor` at 80 and 150 mm, Bortle 5 and 6 (scratch test, deleted; the probe copy is in the session scratchpad, not in the repo). Bands as `band(deficit)`; "published" is option B on the six Messier galaxies and leaves the other six unchanged; "rule" is option C on all 12; "mixed" is D.

| Galaxy | current 150/B5 | 150/B6 | B (published) 150/B5 | 150/B6 | C (rule) V → 150/B5 | 150/B6 |
|---|---|---|---|---|---|---|
| M58 | bright | smudge | bright | bright | 9.63 → bright | bright |
| M61 | smudge | faint | smudge | faint | 9.60 → smudge | faint |
| M88 | smudge | smudge | bright | smudge | 9.43 → bright | bright |
| M91 | smudge | faint | bright | smudge | 10.13 → bright | smudge |
| M98 | smudge | faint | bright | smudge | 10.01 → bright | smudge |
| M106 | faint | faint | smudge | smudge | 8.56 → smudge | faint |
| IC 342 | limit | limit | limit | limit | 9.12 → limit | limit |
| NGC 4449 | bright | bright | bright | bright | 9.03 → bright | bright |
| NGC 5005 | bright | bright | bright | bright | 9.73 → bright | bright |
| NGC 4565 | smudge | faint | smudge | faint | 9.24 → bright | bright |
| NGC 6822 | limit | limit | limit | limit | 8.89 → faint | limit |
| NGC 4039 | smudge | faint | smudge | faint | 10.57 → smudge | smudge |

(The `bright` cells print the key `galaxySmudge` in `expectationFor` unless V is within 5 mag of the limit (`galaxyKey`, `expectation.ts:48-60`); the band column is shown, not the key. At 80 mm / Bortle 6 the six published values change two bands, M61 and M106 (`limit`→`faint`); C changes those two and also NGC 4449 (`faint`→`bright`), NGC 4565 (`limit`→`smudge`) and NGC 6822 stays `limit`.)

Observations:

- **M106 at 150 mm / Bortle 6 is the one case that depends on the option.** Published 8.4 gives `smudge` (deficit 1.45 against 1.5); rule 8.56 gives `faint` (1.61). A 0.1 mag difference in the correction decides it.
- **Several galaxies move `smudge`→`bright` or `bright`→`smudge` only in the band, not in the phrase** (the `galaxyBright` phrase needs `vMag ≤ limit − 5`). The line the user reads changes mainly for M106 (`galaxyFaint`→`galaxySmudge`) and, with option C, NGC 6822 at 150/B5 (`galaxyLimit`→`galaxyFaint`).
- **IC 342 and NGC 6822 stay in `limit` at 150/B6 under every option**: their 19.8′ and 17.4′ catalogue sizes spread V over a large area, so V is not what dims them. A fix of V does not make them easy, and the test should not expect it.
- **Rank (small-scope-style setup, Warsaw, mixed catalogue, 150 mm, Bortle 6)**: M106 on 2026-04-15 #39 → #12 of 121 with V 8.4; on 2026-10-10 #97 → #77 of 110. M58, M88, M91 and M98 rise 9 to 14 places on 2026-04-15 and stay off the list in October. These are order effects from the probe, not asserted values. The top-5 oracle of `calibration.test.ts` was **not** run against any variant; the probe shows M106 at #12 in April, so the top ten of that night may change. The plan must run it.
- **Option C moves NGC 4565 a lot** (2026-04-15 #61 → #32, and it enters the October list at #113 of 113) from a 10.86 → 9.24 shift, on a B that is itself 0.4 mag brighter than NED's unfiltered 10.42. It is the most uncertain of the C values.

### 6. The reference fixture and the divergence cap

- Issue item 3 asks for source-cited galaxy references at 150 mm / Bortle 5 to 6 in `src/lib/engine/fixtures/expect-reference.ts` (27 references today per CLAUDE.md "What to expect"; `KNOWN_DIVERGENCES` at `:551` holds 3, the test's cap, `expectation.test.ts`). The fixture header requires at least two published sources per entry and says a failing reference is an engine finding, never a fixture edit (`:18-20`).
- Which galaxies have two published visual reports at those settings was **not** researched (the web leg went to magnitudes and licences). Candidates named by the issue are M106 and the brighter Messier galaxies of the 12; the sources must be read before the entries are written.
- A new diverging entry needs a rule fix or an owner decision on the cap (3).

## Code References

- `scripts/build-catalogue.mjs:71-83` - Messier `OVERRIDES` (`drop`, `assign` only).
- `scripts/build-catalogue.mjs:84-97` - `CALDWELL_OVERRIDES` documentation: the `action: "vMag"` entry shape and the "https page per value" rule.
- `scripts/build-catalogue.mjs:214-224` - `toMessierObject`, V from the row or `options.vMag`, throws on null.
- `scripts/build-catalogue.mjs:388-395` - the B-Mag fallback for a Caldwell row without a V-Mag.
- `scripts/build-catalogue.mjs:418-422` - unused-override check.
- `scripts/build-catalogue.mjs:462-513` - meta writing (`licence`, `overrides`, `normalisations`).
- `src/lib/catalogue/caldwell.meta.json` - `normalisations` lines for IC 342 and NGC 4039.
- `src/lib/catalogue/LICENSE-DATA.md` - OpenNGC section (CC BY-SA 4.0, the `overrides`/`normalisations` rule) and the hand-entered meteor-shower precedent.
- `src/lib/engine/moonlight.ts:103-112` - `effectiveSurfaceBrightness` reads V and the axes, not `surfaceBrightness`.
- `src/lib/engine/contrast.ts:51-87` - `contrastDeficit`, `rawBand`, `contrastBand`.
- `src/lib/engine/score.ts:204-210` - `brightnessOf` and the galaxy cap.
- `src/lib/engine/expectation.ts:48-60` - `galaxyKey`.
- `src/lib/engine/parameters.ts:442-455, 607-614` - band edges and the two galaxy caps.
- `src/lib/engine/fixtures/expect-reference.ts:551` - `KNOWN_DIVERGENCES`.
- `context/archive/2026-10-15-small-scope-galaxies/reviews/impl-review.md` (F1) and `implementation-notes.md:71` - the finding and the M106 figures.

## Architecture Insights

- The catalogue JSON is generator-only (CLAUDE.md tripwires), so any correction is a generator change plus a regeneration whose diff is reviewed; the metas are the record of deviations.
- Nothing tests catalogue data for physical plausibility today (the shape is checked at generation only; provenance pins check the commit and licence). A plausibility pin on galaxy B−V is a new kind of guard, and it is the natural red-first test for this bug.
- The engine's V dependence is direct (one for one in the deficit), so the data fix is the right layer; the rule and caps are not at fault (the review said the same).

## Historical Context (from prior changes)

- `context/archive/2026-10-15-small-scope-galaxies/plan.md:100` - "No new data source" was deliberate for S-04; the V errors are follow-up #178. Supported.
- `context/archive/2026-10-15-small-scope-galaxies/reviews/impl-review.md` F1 - the list of 12 and "HyperLEDA was ruled out for S-04 only". Supported for the list (re-derived above: the same 12); the review's "usually 8.4" for M106 is supported by SEDS, SIMBAD and NED. The review's M106 total (0.490 → 0.438) was not reproduced (Summary 6).
- `context/foundation/lessons.md`, "Judge advice that no observer can check against source-cited references": a rule or data change comes with referenced cases, and a failing reference is an engine finding.
- `context/foundation/lessons.md`, "Name the risk a test is the only protection of": the new guard must name its risk (a galaxy whose catalogue colour is impossible would dim its own advice).

## Related Research

- `context/archive/2026-10-15-small-scope-galaxies/research.md` - the band rule and the reference fixture.

## Open Questions

For the plan (owner decisions are marked **Q**):

1. **Q1, source of the corrected V.** B (published per-object values, six galaxies), C (rule from the catalogue's own colours, no new source), D (mixed) or a new source (HyperLEDA, RC3). The research favours none: D uses the best evidence per galaxy but adds hand-entered values whose sites' terms (SEDS, NED) were not read; C is licence-neutral but is a model.
2. **Q2, licence reading for hand-entered V values** (B or D): is a published V, entered by hand with an https source and the SIMBAD acknowledgement, acceptable alongside the CC BY-SA files, as the meteor-shower table's note decided for those facts? SEDS and NED terms are unread; reading them is a follow-up if the owner picks B or D.
3. **Q3, what to do with IC 342 and NGC 4039** (B copied into V by the generator): apply the same colour rule to every Caldwell galaxy that falls back to B, correct only these two, or leave the documented fallback.
4. **Q4, NGC 4449 and NGC 4565:** their catalogue B is 0.5 and 0.4 mag brighter than NED's unfiltered magnitude, so a V computed from B (option C or D) may be 0.4 to 0.5 mag too bright. Apply the rule anyway and record the doubt, or leave these two unchanged and documented (their B−V stays impossible).
5. **Q5, the divergence cap and the new references:** at most 3 diverging references today. If the new 150 mm / Bortle 5 to 6 galaxy references diverge, raise the cap, fix the rule, or leave the entry out.
6. The M106 baseline of the review (0.490 → 0.438, "under the bar") was not reproduced; the plan reproduces the baseline first, through the call the review used (probably the Tonight path rather than `rankObjects` directly).
7. The calibration oracle (`calibration.test.ts`, top 5 of four nights, overlap ≥ 3) and `small-scope.test.ts` were not run against any corrected catalogue; the plan runs them before and after.
8. Not researched: published mean B−V per Hubble type (agent's Part 3, not started), the RC3 values and licence, SEDS's and NED's terms, the sizes (`MajAx`, `MinAx`) of the 12 and the two published visual reports per galaxy that the reference fixture needs.

## Follow-up 2026-10-19: owner decisions

The owner answered Q1 to Q5 on 2026-10-19 (relayed by the orchestrator): Q1 = option C (rule from the catalogue's own credible galaxies, no new source); Q2 not needed; Q3 = the same rule for IC 342 and NGC 4039 instead of copying B; Q4 = apply the rule to NGC 4449 and NGC 4565 and record the doubt about their B in the meta; Q5 = the divergence cap may be raised when a new reference diverges, with the reason recorded in the plan. Open Questions 1 to 5 above are settled; 6 to 8 stay open and go to the plan's phases (baseline reproduction, the calibration run, the missing sources).
