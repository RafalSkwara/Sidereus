# Correct implausible OpenNGC V magnitudes of 12 galaxies Implementation Plan

## Overview

Twelve catalogue galaxies carry a V magnitude that is physically impossible against their own B (B−V below 0.2, in three cases negative by 0.7 or more). For ten of them the V is HyperLEDA's `vt`, which OpenNGC ships with an uncertainty of 1 to 1.6 mag; for two (IC 342, NGC 4039) OpenNGC has no V and the generator copies B into V. The what-to-expect band and, since S-04, the ranking read that V one for one, so the advice for these galaxies is wrong. The rule and the caps are right; the input is wrong (GitHub #178, small-scope-galaxies impl review F1).

This plan fixes the cause in the generator (rule C, the owner's choice), behind a test that is red first: a catalogue-wide guard that no galaxy ships an impossible colour, plus a test-only table of published V values for the six Messier galaxies as an independent oracle.

## Owner decisions (settled 2026-10-19)

The owner answered the five questions of the first draft on 2026-10-19 (relayed by the orchestrator). They are settled and the plan is written for them.

| # | Decision | Owner's answer |
|---|---|---|
| Q1 | Source of the corrected V | **Rule C**: V = B − the median B−V of the catalogue's own credible galaxies of the same Hubble group, computed at build time from the pinned file. No new source, no licence change. The six published values are test-only references, never shipped. |
| Q2 | Licence reading for hand-entered values | **Not needed** (no hand-entered value is shipped). |
| Q3 | IC 342 and NGC 4039 (B copied into V by the generator) | **Same rule**: a galaxy with no V takes the rule's V, not B. |
| Q4 | NGC 4449 and NGC 4565 (their catalogue B is 0.5 and 0.4 mag brighter than NED's unfiltered magnitude) | **Apply the rule** and record the doubt about their B (about 0.4 mag) in the meta entry's `reason`. |
| Q5 | New 150 mm / Bortle 5-6 galaxy references and the divergence cap (3, full) | **The implementer may raise the cap** when a new reference diverges. The reason is recorded in this plan (section "Divergence cap log" below) and in the fixture entry's `reason`; the cap is raised to exactly the new count, and the expected key is never edited to fit. |

## Divergence cap log

Empty until a new reference diverges. If Phase 3 raises the cap in `src/lib/engine/expectation.test.ts` (`expect(KNOWN_DIVERGENCES.length).toBeLessThanOrEqual(3)`), the implementer appends here, in the same commit: the entry id and setting, the key the sources support, the key the rule computes, the sources, and the new cap.

## Current State Analysis

- 12 galaxies fail V > B − 0.2: M58, M61, M88, M91, M98, M106, IC 342 (C 5), NGC 4449 (C 21), NGC 5005 (C 29), NGC 4565 (C 38), NGC 6822 (C 57), NGC 4039 (C 61). Re-derived from `messier.json` and `caldwell.json` (68 galaxies in the catalogue). `research.md` section 1.
- A newer OpenNGC commit (`be3cd6c`) does not change any of the 12 rows, so a pin bump does not fix this. `research.md` Summary 3.
- `effectiveSurfaceBrightness` reads `vMag` and the axes, never `surfaceBrightness` (`src/lib/engine/moonlight.ts:103-112`); `brightnessOf` reads `vMag` for the ramp and the band cap (`src/lib/engine/score.ts:204-210`). A V error is a one-for-one error in the core brightness.
- The generator has a B-fallback for Caldwell rows without V (`scripts/build-catalogue.mjs:388-395`), Caldwell `vMag` overrides (`:84-97`), and Messier overrides of `drop` and `assign` only (`:71-83`). Both metas list deviations under `overrides` and `normalisations`.
- Nothing tests catalogue data for physical plausibility; the JSON's shape is checked only at generation, provenance at `messier.test.ts` / `caldwell.test.ts` (guards project).
- On the engine's thresholds the rule's V moves, at 150 mm: M106 `faint`→`smudge` at Bortle 5 (deficit 0.81) but only `faint` (1.61 against the 1.5 edge) at Bortle 6; M58, M88, M91, M98 move one band at Bortle 5 or 6; IC 342 and NGC 6822 stay `limit` at 150 mm / Bortle 6 whatever V is (their 19.8′ and 17.4′ catalogue sizes dim them). `research.md` section 5 table.

## Desired End State

- No galaxy in `messier.json` / `caldwell.json` has B−V below 0.2; the 12 carry a corrected `vMag`, each with a meta entry that says what it was, what it is, which rule and which median.
- The corrected values of the six Messier galaxies are within 0.3 mag of the published V values in a test-only reference.
- `npm run catalogue:build` regenerates the files byte-identically; the diff of the data files is only `vMag` of 12 objects.
- `calibration.test.ts`, `small-scope.test.ts` and `expectation.test.ts` stay green without being edited or regenerated.
- Galaxy references at 150 mm / Bortle 5-6 exist for M106 and at least one more of the 12, each with at least two published sources, or the report says which ones diverged and why none was added.

### Key Discoveries:

- The bad V is a source value (HyperLEDA `vt`, `e_vt` 0.99 to 1.64 mag for the Messier ones), so the fix belongs in the generator, never in the JSON (CLAUDE.md tripwire).
- The rule agrees with published V within 0.17 mag on all six galaxies that have one, without being tuned to them (`research.md` option D paragraph): the six published values are a genuine independent oracle for it.
- The review's M106 figures (0.490 → 0.438, under the bar) were not reproduced: on a Messier-only 150 mm / Bortle 6 ranking for 2026-10-10 with the small-scope test's site and eyepieces M106 is listed (#58 of 67, total 0.519, brightness 0.100); with V 8.4 it would be #42, 0.599. The plan records its own before and after, not the review's.

## What We're NOT Doing

- Not changing the rule (`contrastBand`, `EXPECT_*`, the caps), the near-limit floor, `BRIGHT_CORE_OFFSET_MAG` or the sizes (`MajAx`, `MinAx`) of any galaxy.
- Not bumping the OpenNGC pin (it would change 33 other galaxy rows' B or V in the whole file and every provenance pin; a separate change).
- Not adding a new data source or a HyperLEDA/RC3 pull (Q1 would reopen this).
- Not touching non-galaxy B fallbacks (nebulae such as NGC 7000 take B as V, `caldwell.meta.json` normalisations); noted as a possible follow-up only.
- Not editing an assertion in `calibration.test.ts`, `small-scope.test.ts` or `expectation.test.ts`, with one owner-permitted exception: the cap of 3 in `expectation.test.ts` may be raised, to exactly the new count, when a new 150 mm / Bortle 5-6 reference diverges (Q5), with the reason logged above.
- Not hand-editing the generated JSON or metas.
- No UI, i18n or engine code change; the user-visible effect is only a different band and rank for the 12.

## Implementation Approach

Red first, then the cause, then the evidence. Phase 1 adds the two tests and the test-only published table; they fail on today's data and name the 12. Phase 2 adds a small pure helper for the colour rule (unit-tested like `scripts/lib/*`), applies it in the generator to Messier and Caldwell galaxies, regenerates, and records every correction in the metas and in `LICENSE-DATA.md`. Phase 3 shows the engine still agrees with itself on the corrected data (calibration, small-scope, reference), records before and after, and adds the 150 mm / Bortle 5-6 references the issue asks for. Phase 4 runs the gates the way CI does and prepares the PR.

## Critical Implementation Details

- **A red tree between Phase 1 and Phase 2.** Phase 1's tests are red on purpose and live in the `reference` project, which the end-of-turn hook runs. Commit Phase 1 on its own, then start Phase 2 in the same turn run; if the hook sends a turn back, it is the expected red, not a new failure (record the red output as evidence first).
- **The criterion and the rule use one constant.** `MIN_GALAXY_BV = 0.2` (the issue's V > B − 0.2) lives in the helper; the guard test spells `0.2` as a literal on purpose, so the two cannot drift together unnoticed.
- **The medians come from the pinned file, not from a table in the repo.** The credible set is the catalogue's own galaxies that have both magnitudes and B−V ≥ 0.2; a group with fewer than 3 credible galaxies fails the build, and an unknown Hubble string fails the build (as an unknown type code does today).
- **The deliberate-break check per phase** is part of each phase's automated criteria (the owner's rule for this change).

## Phase 1: Failing regression tests (no production change)

### Overview

Pin the bad case before touching the generator: a guard that says no galaxy has an impossible colour, and an oracle of published V values for the six Messier galaxies. Both are red on the current data.

### Changes Required:

#### 1. Colour guard and published oracle

**File**: `src/lib/catalogue/galaxy-colour.test.ts` (new, `reference` project)

**Intent**: Protect against a galaxy shipping a V that no galaxy has, which dims its own advice (the risk named by lessons, "Name the risk a test is the only protection of"). Two tests. The guard: over every catalogue galaxy, B−V is at least 0.2; it asserts the galaxy count (68) first and names every failing id with its V and B, so an empty sample cannot pass. The oracle: for the six Messier galaxies in the published table, the catalogue's V is within `PUBLISHED_V_TOLERANCE_MAG` of the published value.

**Contract**: reads `DEEP_SKY` from `@/lib/catalogue`; the tolerance is a named constant in the fixture (0.3 mag: above the rule's largest observed gap to the published values, 0.17, below the smallest current error, 0.55). The guard is the only place that states the floor as a literal `0.2`. It accepts no exceptions: Q3 and Q4 are settled so that every one of the 12 is corrected.

#### 2. Test-only published V table

**File**: `src/lib/engine/fixtures/galaxy-v-reference.ts` (new, not exported from `fixtures/index.ts`)

**Intent**: Hold the independently published V for M58, M61, M88, M91, M98 and M106 as facts typed by hand with their sources, the way `expect-reference.ts` holds its sources, so the oracle is never shipped data.

**Contract**: one entry per galaxy `{ id, publishedV, sources: [{ title, publisher, url, accessed }] }`: M58 9.7, M61 9.7, M88 9.6, M91 10.2, M98 10.1, M106 8.4 (SEDS pages `https://messier.seds.org/m/m058.html` and the other five; SIMBAD V 9.66, 9.65, 10.14 and 8.41 as second source for M58, M61, M98, M106; accessed 2026-10-19, values from `research.md` section 4). The M88 and M91 entries have one usable source and say so in a `note`. A header comment states the file is test-only and that a value is a fact, not a table copy.

### Success Criteria:

#### Automated Verification:

- The new tests fail on the current catalogue and name exactly the 12 ids (guard) and the six Messier galaxies (oracle): `npx vitest run --project reference src/lib/catalogue/galaxy-colour.test.ts` exits non-zero; the output is saved to `context/changes/openngc-galaxy-magnitudes/evidence/phase1-red.txt`.
- Deliberate-break check: with one of the 12 corrected in a scratch copy of the catalogue the guard lists 11 ids, so the failure message is not vacuous (scratch copy deleted afterwards).
- Lint and format pass on the two new files: `npx eslint --max-warnings 0 src/lib/catalogue/galaxy-colour.test.ts src/lib/engine/fixtures/galaxy-v-reference.ts`
- Every other test still passes: `npm run test:reference` has no failure outside `galaxy-colour.test.ts`.

#### Manual Verification:

- The reviewer reads the published table and its URLs against the pages (SEDS and SIMBAD) and confirms the six values and the "one usable source" notes for M88 and M91.

**Implementation Note**: Commit this phase alone; the tree stays red until Phase 2.

---

## Phase 2: Generator rule, regeneration and provenance

### Overview

Add the colour rule as a tested pure helper, apply it in the generator to Messier and Caldwell galaxies, regenerate, and record every correction in the metas and the licence note.

### Changes Required:

#### 1. The colour rule

**File**: `scripts/lib/galaxy-colour.mjs` (new) and `scripts/lib/galaxy-colour.test.mjs` (new)

**Intent**: One pure, deterministic rule: which galaxies have an impossible colour, which Hubble group each belongs to, the median colour of each group from the credible galaxies, and the corrected V.

**Contract**: exports `MIN_GALAXY_BV` (0.2), `colourGroupOf(hubble)` (four groups: early `E E-S0 S0 S0-a`; Sa-Sb `Sa SABa SBa Sab SABab SBab S? Sb SABb SBb`; Sbc-Sc `Sbc SBbc SABbc Sc SABc SBc Scd SBcd SABcd`; late everything else that is a galaxy type; unknown or empty Hubble throws), `groupMedians(galaxies)` (median of B−V over galaxies with both magnitudes and B−V ≥ `MIN_GALAXY_BV`, rounded to 0.01; fewer than 3 in a group throws), and `correctedV(bMag, median)` = round(B − median, 2). The unit test covers the median, the thin-group and unknown-type refusals, the boundary (B−V exactly 0.2 is credible), and a sign check that the corrected V is fainter than B.

#### 2. Apply it in the generator

**File**: `scripts/build-catalogue.mjs`

**Intent**: After the Messier and Caldwell objects are built, correct every galaxy whose B−V is below the floor, and every galaxy whose V came from the B fallback (Q3), then record each in the metas. The generated files stay the only output.

**Contract**: new expected count `EXPECTED_COLOUR_CORRECTIONS = 12` (the build fails on any other count, like `EXPECTED_COUNT`); the B-fallback normalisation lines for IC 342 and NGC 4039 are replaced by their correction entries (non-galaxy fallbacks keep theirs); each correction is an `overrides` entry `{ id, action: "vMagColour", fromVMag (null for a fallback row), vMag, bMag, hubble, group, medianBV, reason, source }` where `source` is the pinned `NGC.csv` URL as for the other overrides and the reason names the doubt for NGC 4449 and NGC 4565 (Q4). Messier entries go to `messier.meta.json`, Caldwell entries to `caldwell.meta.json`. Key order and the 2-space JSON format are unchanged.

#### 3. Regenerate and review

**File**: `src/lib/catalogue/messier.json`, `messier.meta.json`, `caldwell.json`, `caldwell.meta.json` (generated)

**Intent**: Regenerate with `npm run catalogue:build` (a fetch of the pinned commit; the repo URL, never a personal address, is the only contact in any header) and review the diff.

**Contract**: the data diff changes only `vMag` of the 12 objects; the meta diffs add the correction entries and drop the two fallback lines; nothing else moves.

#### 4. Licence note

**File**: `src/lib/catalogue/LICENSE-DATA.md`

**Intent**: Say in the OpenNGC section that the V magnitude of 12 galaxies is a derived value (B minus the median colour of the catalogue's own credible galaxies of the same Hubble group), under the same CC BY-SA 4.0, listed per object under `overrides`.

**Contract**: one paragraph and the existing "Changes made" sentence extended; no change to the star or meteor sections.

### Success Criteria:

#### Automated Verification:

- Phase 1's tests are green: `npx vitest run --project reference src/lib/catalogue/galaxy-colour.test.ts`
- The helper's unit tests pass: `npx vitest run --project reference scripts/lib/galaxy-colour.test.mjs`
- Regeneration is reproducible: running `npm run catalogue:build` twice leaves `git diff` identical the second time.
- The data diff is only `vMag` of 12 objects: a scratch script compares the old and new JSON key by key and prints the changed object ids and keys (exactly the 12 ids, only `vMag`).
- Deliberate-break check: flipping the helper's sign (V = B + median) turns the helper test and Phase 1's guard red; removing one object from the correction list fails the build's count check (both reverted afterwards).
- The provenance pins pass: `npm run test:guards`
- Lint passes: `npm run lint`

#### Manual Verification:

- The reviewer reads the 12 `overrides` entries and the group medians and confirms the reasons, especially for NGC 4449 and NGC 4565.
- The reviewer reads the `LICENSE-DATA.md` paragraph.

**Implementation Note**: Pause for the reviewer's confirmation before Phase 3; the corrections are the part the owner cares about.

---

## Phase 3: Engine agrees with the corrected data; references at 150 mm / Bortle 5-6

### Overview

Show that the rule, the caps and the oracles stand on the corrected catalogue without edits, record the before and after, and add the galaxy references the issue asks for.

### Changes Required:

#### 1. Evidence of the change

**File**: `context/changes/openngc-galaxy-magnitudes/evidence/before-after.md` (new)

**Intent**: Record, for the 12 galaxies at 80 and 150 mm and Bortle 4 to 7, the band and expectation key before and after, and for M106 on Warsaw 2026-10-10 (150 mm, Bortle 6, Messier-only) the total, brightness and rank before and after, from the same call; name the call so a reviewer can repeat it.

**Contract**: produced by a scratch probe test (copied into `src/lib/` for the run and deleted, never committed), run once on the Phase 1 commit's catalogue and once on the regenerated one.

#### 2. Galaxy references at 150 mm / Bortle 5-6

**File**: `src/lib/engine/fixtures/expect-reference.ts` and the `HARD` list in `src/lib/engine/expectation.test.ts`

**Intent**: Add `hard` references for M106 and at least one more of the 12 (M61 or M88 first) at 150 mm / Bortle 5 and 6, each with at least two published visual reports read in this phase (a subagent reads the pages; no personal data in any request) and the expected key decided from the sources before the rule is run. The `HARD` list in the test is extended by the new ids: adding the plan's new cases, not editing an assertion to fit.

**Contract**: each entry has `sources` (at least two, https, dated), a `note` with the counter-evidence, `kind: "hard"`. If the rule computes the key the sources support, the entry goes to `EXPECT_REFERENCES`. If it computes a different key, the entry goes to `KNOWN_DIVERGENCES` with `computed` and a `reason`, and the cap in `expectation.test.ts` is raised to exactly the new count (owner decision Q5; the expected key is never edited to fit, and the rule is not changed in this change); the reason is logged in "Divergence cap log". Fixture header counts (27 references) are updated for what lands.

#### 3. Documentation

**File**: `CLAUDE.md`

**Intent**: In "What to expect" replace the clause that says 12 galaxies' OpenNGC V is follow-up #178 with what is now true (corrected in the generator, listed in the metas), and in the "Catalogue" paragraph add one sentence on the correction.

**Contract**: only those two paragraphs change.

### Success Criteria:

#### Automated Verification:

- The three oracles pass unedited: `npx vitest run --project reference src/lib/engine/calibration.test.ts src/lib/engine/small-scope.test.ts src/lib/engine/expectation.test.ts src/lib/engine/ranking-invariants.test.ts`
- `git diff` shows no edit to any assertion in those four files except the extended `HARD` list: `git diff --stat -- src/lib/engine/*.test.ts` lists only `expectation.test.ts` and the added lines are ids and settings.
- The new references pass: `npx vitest run --project reference src/lib/engine/expectation.test.ts`
- Deliberate-break check: setting M106's V back to 9.29 in a scratch copy turns Phase 1's oracle and the M106 reference red (both restored afterwards).
- `evidence/before-after.md` exists and holds the 12 rows and the M106 totals from one named call.

#### Manual Verification:

- The reviewer reads the new references' sources and notes, the evidence table and the "Divergence cap log", and confirms no diverging entry was hidden.
- The reviewer (or the lead) opens `/tonight/targets` locally at 150 mm and Bortle 5 on an April evening (pinned clock) and reads M106's line.

---

## Phase 4: Gates and PR

### Overview

Run everything the way CI does and open the one PR.

### Changes Required:

#### 1. Gates and PR

**File**: none (commands); the PR description

**Intent**: Lint, type check, both Vitest projects, a fresh build, the whole e2e suite and smoke against a local production preview and the local Supabase (never reset), as `lessons.md` ("Run the whole e2e suite before a PR, the way CI runs it") says; then push the branch and open one PR against `main` that reports the counts, the 12 corrections, the evidence and the owner decisions taken. The merge is the owner's.

**Contract**: ports 4335 (preview) and 4402 (forecast fixture); the keys inline on the commands, never exported; servers stopped by port; `dist/server/.dev.vars` pointed at the local stack.

### Success Criteria:

#### Automated Verification:

- `npx astro sync && npx astro check` has 0 errors; `npm run lint` is clean
- `npm test` (both projects) is green; the counts are reported
- Fresh `npm run build` succeeds
- `npm run test:e2e` and `npm run smoke` pass against the local preview (counts reported in the PR)
- Only the intended files changed: `git diff --stat origin/main` lists the generator, the helper and its test, the 4 generated files, `LICENSE-DATA.md`, `CLAUDE.md`, the two fixtures, the two test files and the change folder

#### Manual Verification:

- The owner reads the PR description, the 12 corrections and the decisions taken, and merges (human only).

---

## Testing Strategy

### Unit Tests:

- `galaxy-colour.test.ts` (Phase 1): the guard (68 galaxies, B−V ≥ 0.2) and the oracle (six published V within 0.3 mag).
- `galaxy-colour.test.mjs` (Phase 2): the rule's median, refusals, boundary and sign.
- The existing oracles (calibration, small-scope, expectation, ranking invariants) are re-run, not edited.

### Integration Tests:

- `npm run catalogue:build` is idempotent and its diff is the 12 `vMag`s.
- e2e and smoke as CI runs them.

### Manual Testing Steps:

1. Read M106's line on Targets at 150 mm / Bortle 5 before and after (evidence screenshot or text).
2. Read the 12 correction entries in the metas.

## Performance Considerations

None: the data files keep their size within a few bytes (12 numbers), and the generator's extra work is a median over 68 rows.

## Migration Notes

No data migration. The corrected values change the advice of the 12 galaxies for everyone at the next deploy; the Tonight pages stored on devices keep their old text until the next online visit (existing offline rule for Targets copies).

## References

- Related research: `context/changes/openngc-galaxy-magnitudes/research.md`
- Prior change: `context/archive/2026-10-15-small-scope-galaxies/reviews/impl-review.md` (F1) and `implementation-notes.md:71`
- Generator: `scripts/build-catalogue.mjs:71-97, 214-224, 388-395, 462-513`
- Engine: `src/lib/engine/moonlight.ts:103-112`, `src/lib/engine/contrast.ts:51-87`, `src/lib/engine/score.ts:204-210`
- Fixture precedent: `src/lib/engine/fixtures/expect-reference.ts`, `src/lib/engine/expectation.test.ts:120-185`
- Lessons: "Judge advice that no observer can check against source-cited references", "Name the risk a test is the only protection of", "Run the whole e2e suite before a PR, the way CI runs it"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Failing regression tests (no production change)

#### Automated

- [ ] 1.1 The new tests fail on the current catalogue and name exactly the 12 ids (guard) and the six Messier galaxies (oracle), output saved to evidence/phase1-red.txt
- [ ] 1.2 Deliberate-break check: with one of the 12 corrected in a scratch copy the guard lists 11 ids
- [ ] 1.3 Lint and format pass on the two new files
- [ ] 1.4 Every other test still passes (npm run test:reference has no failure outside galaxy-colour.test.ts)

#### Manual

- [ ] 1.5 The reviewer reads the published table and its URLs against the pages and confirms the six values and the one-source notes

### Phase 2: Generator rule, regeneration and provenance

#### Automated

- [ ] 2.1 Phase 1's tests are green
- [ ] 2.2 The helper's unit tests pass
- [ ] 2.3 Regeneration is reproducible: a second npm run catalogue:build leaves git diff identical
- [ ] 2.4 The data diff is only vMag of 12 objects (scratch comparison prints exactly the 12 ids)
- [ ] 2.5 Deliberate-break check: a flipped sign and a removed correction turn the helper test, the guard or the build's count check red
- [ ] 2.6 The provenance pins pass (npm run test:guards)
- [ ] 2.7 Lint passes (npm run lint)

#### Manual

- [ ] 2.8 The reviewer reads the 12 overrides entries and the group medians and confirms the reasons
- [ ] 2.9 The reviewer reads the LICENSE-DATA.md paragraph

### Phase 3: Engine agrees with the corrected data; references at 150 mm / Bortle 5-6

#### Automated

- [ ] 3.1 The four oracles pass unedited (calibration, small-scope, expectation, ranking-invariants)
- [ ] 3.2 git diff shows no assertion edit in those files except the extended HARD list and, only for a diverging new reference, the logged cap raise
- [ ] 3.3 The new references pass (expectation.test.ts)
- [ ] 3.4 Deliberate-break check: M106's V back at 9.29 in a scratch copy turns Phase 1's oracle and the M106 reference red
- [ ] 3.5 evidence/before-after.md exists with the 12 rows and the M106 totals from one named call

#### Manual

- [ ] 3.6 The reviewer reads the new references' sources and notes, the evidence table and the divergence cap log and confirms no diverging entry was hidden
- [ ] 3.7 M106's line on /tonight/targets at 150 mm and Bortle 5 on an April evening is read locally

### Phase 4: Gates and PR

#### Automated

- [ ] 4.1 astro sync and astro check have 0 errors; npm run lint is clean
- [ ] 4.2 npm test (both projects) is green, counts reported
- [ ] 4.3 A fresh npm run build succeeds
- [ ] 4.4 npm run test:e2e and npm run smoke pass against the local preview, counts reported
- [ ] 4.5 Only the intended files changed (git diff --stat origin/main)

#### Manual

- [ ] 4.6 The owner reads the PR description, the 12 corrections and the decisions taken, and merges
