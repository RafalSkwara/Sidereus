<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Star Source Switch

- **Plan**: `context/changes/star-source-switch/plan.md`
- **Scope**: Full plan (phases 1-5; 5.8, the PR description, is still open because the PR is being opened)
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-17
- **Branch**: `feat/star-source-switch` at `395a285`, diff base `origin/main` (`82e35cf`)
- **Reviewer**: herdr agent "reviewer" (Opus, high), with two Opus subagents (plan drift; safety, quality and patterns)
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 4 observations
- **change.md**: not touched. In reviewer mode this file is the only write, so the orchestrator stamps `impl_reviewed`.

## Independent checks run for this review

- **Pin.** `hip_main.dat` downloaded from the CDS URL (public GET, the repo URL as contact) is SHA-256 `58ceabb1…3616e0`, 53,316,318 bytes, 118,218 lines, exactly as pinned.
- **Fields promised to ESA.** A reviewer-written Python script reading only HIP, Vmag, RAdeg, DEdeg, pmRA and pmDE gets these results:
  - It finds exactly the ten rows with blank RAdeg/DEdeg at V ≤ 7.5: 31067, 31500, 34716, 50572, 52800, 55203, 59273, 78727, 80579 and 115125. Only for those does it fall back to RAhms/DEdms.
  - It finds the one blank-Vmag row, HIP 120412.
  - It gives 921 stars at V ≤ 4.5 and 25,723 at V ≤ 7.5.
  - After linear propagation J1991.25 → J2000, it reproduces every one of the 921 committed bright-file vectors to within 1.61″ (the 5-digit rounding).
  - So the file's content needs nothing beyond the eight fields in `fieldsUsed`, and propagation is applied (Arcturus moves about 20″).
- **Determinism.** The drift subagent ran a fresh scratch build (`STARS_OUT_DIR=<scratch> node scripts/build-stars.mjs`). All four outputs are byte-identical (`cmp`) to the committed `bright-stars*.json` and `finder-stars*.json`. So the generated files come from `npm run stars:build` only.
- **Reader reads only the listed fields.** `parseRecord` reads every value through `fieldValue()` over `HIPPARCOS_FIELDS_USED` (`scripts/lib/hipparcos.mjs:35-65`).
  - `RECORD_PIPES` only checks that the pipes are where they belong.
  - There is no byte-offset `slice`/`substring`, and nothing reads Hpmag, B-V or the parallax.
  - RAhms/DEdms are read only when both RAdeg and DEdeg are blank and V ≤ the limit (`:131-141`).
  - `hipparcos.test.mjs:85-128` pins the list and feeds garbage into the other fields.
  - The "exactly these ten" property is guarded in the build (`stars-build.mjs:298-304`), in `build-stars.test.mjs:322` and in both catalogue tests.
- **Download integrity.** Nothing is written before the length, row count and SHA-256 match. The rest of the chain:
  - The hash covers the raw chunks.
  - `Accept-Encoding: identity` is sent, and any `Content-Encoding` is refused.
  - A Content-Length that differs from the pin is refused.
  - The single mirror retry is checked against the same pin.
  - There is a stall timer, and the clock is never read.
- **SIMBAD cross-read.** I queried SIMBAD TAP for Vega, Arcturus, Sirius, HIP 55203 and HIP 78727. All five match the decimal degrees in `stars.test.ts:45-60` to the last digit. SIMBAD's coordinate source is `2007A&A...474..653V` (the Hipparcos re-reduction) for the three bright stars and UCAC4 for the two without a solution.
- **A second, non-Hipparcos source.** VizieR's TAP is still down (503). Its ASU endpoint works: FK5 (I/149A) gives Arcturus at 14 15 39.677 +19 10 56.71, which is within 0.07″ of the test's value. FK5 is ground-based and does not depend on Hipparcos (see F1).
- **Reference fixtures.** `src/lib/engine/fixtures/` changed by one comment line (`finder-reference.ts:20`, "HYG" → "the star file"). `finder.test.ts`, `steps.test.ts` and `finder-samples.test.ts` are untouched. The regenerated example chart keeps Alphecca as its start star and the same hop stars (α, ε, υ, ν¹ CrB) with identical x/y and step sizes; only the indices moved and three HYG-only field stars are gone.
- **No HYG input.** `git grep -i hyg` outside `context/` finds 14 hits. Each is a comment explaining the switch, a "never reads HYG" statement, or a hash false positive in `package-lock.json`. No HYG URL or file is read anywhere.
- **Commands** (subagent runs on the reviewed head):
  - `npx eslint --max-warnings 0 scripts/ src/lib/catalogue/ vitest.config.ts eslint.config.js`: exit 0.
  - `npx astro check`: 0 errors, 0 warnings, 2 hints in `designations.mjs:579,586`.
  - `npm test`: 2,677 passed and 2 failed on the first run. The two failures were timeouts in `agent-hooks.test.ts` and `no-console-guard.test.ts`, on a machine at load ≈ 13, in files the change does not touch. Rerun alone, both pass (33/33).
  - The changed areas (`scripts/lib`, `src/lib/catalogue`, `src/lib/finder`, `engine/finder.test.ts`, `finder-samples.test.ts`): 16 files, 234 tests, all pass.
  - `npm run build`, e2e and smoke were not re-run. `evidence.md` records them on the rebased branch: 86 passed, 3 skipped, 0 flaky, and smoke green.

```
═══════════════════════════════════════════════════════════
  IMPLEMENTATION REVIEW: Star Source Switch
  Scope: Full plan (phases 1-5)  |  Date: 2026-10-17
  Findings: 0 critical  4 warnings  4 observations
═══════════════════════════════════════════════════════════

  Plan Adherence        WARNING ⚠️   (2 findings)
  Scope Discipline      PASS    ✅
  Safety & Quality      WARNING ⚠️   (2 findings)
  Architecture          PASS    ✅
  Pattern Consistency   PASS    ✅
  Success Criteria      PASS    ✅

  ► Overall: NEEDS ATTENTION
```

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

**Scope Discipline.** The extras are benign:

- the roadmap S-08 row moved `ready` → `in-progress` (the plan forbade only `done` before archive);
- `evidence.md`, `plan-brief.md`, 14 screenshots and `5.7-footer-report.json`, which are evidence for the manual rows.

**Success Criteria.** All automated rows were re-verified or reproduced (lint, astro check, unit suite, scratch build byte-identical). The manual rows 2.7-2.9, 3.7-3.8, 4.9 and 5.7 have concrete evidence in `evidence.md` and the screenshots, so they were not rubber-stamped. 5.8 (the PR description) is pending.

**Focus points the orchestrator named:**

| Point                               | Result                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fields promised to ESA              | Pass. `fieldsUsed` is in both metas, is deep-equal to `HIPPARCOS_FIELDS_USED` and to the ESA list, and RAhms/DEdms carry `onlyWhen`. The test enforces it, and I reproduced it independently.                                                                                                                                |
| Pinned, checksummed download        | Pass. See F3 and F7 for diagnostics only.                                                                                                                                                                                                                                                                                    |
| Epoch J1991.25 → J2000              | Pass. Reproduced to 1.61″ for all 921 bright stars.                                                                                                                                                                                                                                                                          |
| Reference fixtures untouched        | Pass. Only one comment line changed.                                                                                                                                                                                                                                                                                         |
| Six independent star positions      | Partly. The values are correct: I spot-checked five against SIMBAD and Arcturus against FK5. They now cite SIMBAD with a query URL and an access date. But only one source is named, and for most stars it is a Hipparcos re-reduction, not independent astrometry (F1).                                                     |
| Designation loss 3.1 %              | Acceptable and documented in `designation-check.md`: 101 of 3,290 matched stars lose both values. Every loss is an omission, so no wrong value was guessed, and all 15 route and example-chart stars are intact. The plan estimated "roughly 1 %", and `plan.md` was not updated (F8). The guard range of 3,212-3,342 holds. |
| Wikidata CC0 + IAU attribution      | Pass. Attribution has the three new keys in both locales, `LICENSE-DATA.md` has its Hipparcos section, and the landing footer renders `<Attribution />` (`Welcome.astro:107`), asserted by `landing.spec.ts:35,51`. See F4 for the landing image and F8 for the WGSN link target.                                            |
| No HYG input in the build           | Pass.                                                                                                                                                                                                                                                                                                                        |
| Generated files only via the script | Pass. The scratch build is byte-identical.                                                                                                                                                                                                                                                                                   |

## Findings

### F1 — Reference positions rest on one source, mostly a Hipparcos re-reduction

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/lib/catalogue/stars.test.ts:30-60, :168-177; src/lib/catalogue/finder-stars.test.ts:51-76
- **Detail**:
  - **The contract.** Plan Phase 4.4 asks for each reference star to have "at least two sources named in the test", for the set to include α Cen A, and for at least one propagation-sensitive star.
  - **What the tests name.** Only SIMBAD. For Sirius, Arcturus, Vega, Procyon, Capella and Betelgeuse, SIMBAD's coordinate source is van Leeuwen 2007, a re-reduction of the same satellite data. The comments say so honestly.
  - **What the check proves.** It proves the reader and the propagation against a published J2000 position. It does not prove the positions against independent astrometry.
  - **Missing star.** α Cen A is absent; Betelgeuse is used instead.
  - **Test that cannot fail.** "would fail an unpropagated build" (`stars.test.ts:168-177`) only does arithmetic on the test's own constants, so no data change can make it fail. The real guard is `:159-166`. Measured by the subagent: an unpropagated bright file would fail on Arcturus, Sirius and Procyon (20.3″, 11.8″ and 11.4″ against 3″).
  - **Thin finder-file guard.** An unpropagated finder file would fail only on Arcturus: 31.7″ against the 25.56″ floor, while Sirius and Procyon would still pass at 24.1″ and 24.2″.
  - **Values are right.** The SIMBAD figures match exactly, and FK5 (I/149A, through VizieR's ASU endpoint, which answered today while TAP gave 503) agrees on Arcturus to 0.07″. So this is about evidence, not correctness.
- **Fix A ⭐ Recommended**: Add FK5 (I/149A, J2000, ground-based, independent of Hipparcos) as the second named source for the bright reference stars, and add α Cen A if FK5 carries it. Replace or delete the arithmetic-only test.
  - Strength: meets the plan's contract with a source that is genuinely not Hipparcos, and the VizieR ASU endpoint works today, as checked for Arcturus.
  - Tradeoff: about one more lookup per star plus comment edits. FK5's precision (about 0.05″ at J2000) is far finer than the 3″ tolerance, so no tolerance changes.
  - Confidence: HIGH — Arcturus agrees to 0.07″.
  - Blind spot: the other five stars were not checked in FK5. FK5 is not a source for the two sexagesimal stars, which keep SIMBAD/UCAC4 (that is fine, since UCAC4 is not Hipparcos).
- **Fix B**: The owner accepts SIMBAD alone. Record the deviation in the plan, and turn the arithmetic test into a comment.
  - Strength: no work, and the values are already correct.
  - Tradeoff: the plan's "two sources" promise stays unmet, and the check stays circular for most stars.
  - Confidence: MED — this is an evidence question, not a correctness question.
  - Blind spot: None significant.
- **Decision**: **ACCEPTED, SIMBAD only (owner, 2026-10-17).** The single source is recorded as a deviation in `plan.md` (Testing Strategy) and in both test comments. The test that claimed to prove a missed propagation from its own constants was deleted, with the unused proper-motion fields; the 3 arcsecond tolerance of the position check is what fails an unpropagated build. Applied in follow-up PR `fix/star-source-review`.

### F2 — Fourteen `omit` overrides cite "a second compilation", which is the HYG-era file

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: scripts/data/star-designation-overrides.json (8832, 9347, 39953, 40023, 69481, 71762, 81710, 86974, 90968, 90969, 91926, 101923, 107310, 110960)
- **Detail**:
  - **The rule.** The plan requires each override to cite "something the repo may cite … never the HYG file".
  - **What the entries say.** Each gives as its `source` "Wikidata … gives X; a second compilation gives Y". `designation-check.md:30-56` shows the "second compilation" is the HYG-era finder file.
  - **Licence risk is low.** Every one of them is an omission, so no HYG value enters the table.
  - **Wording problem.** The phrase hides where the doubt came from, and `designation-check.md:7` ("no override cites it") is literally true but misleading. If ESA or a reviewer ever asks what the "second compilation" is, the answer is the source this change removes.
- **Fix**: Reword the 14 `source` strings to name the trigger plainly, for example "omitted: the one-off comparison with the former HYG-era file (designation-check.md) showed a component-digit disagreement and no citable source settles it". Re-run `npm run stars:designations -- --from-raw <dir>` only if the table's meta embeds these strings; the star files do not change.
- **Decision**: **APPLIED.** The 14 `omit` sources name the one-off HYG-era comparison as the trigger (overrides file and the table's meta, regenerated with `--from-raw`; the star files did not change); `designation-check.md` says so.

### F3 — Error causes are dropped when both downloads fail, and one retry path is silent

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/lib/hipparcos.mjs:299-307; scripts/build-stars.mjs:90-93; scripts/build-star-designations.mjs:111-116
- **Detail**:
  - **Primary error loses its cause.** The combined "pinned URL and mirror both failed" error embeds only `primaryError.message`, and only the mirror error becomes `cause`. The primary error's own cause chain (ENOTFOUND, ECONNRESET, …) is lost.
  - **Mirror cause is not printed.** `build-stars.mjs` prints `err.message` only, so it drops the mirror cause as well. `npm run stars:build` therefore prints "fetch failed / fetch failed" with no reason.
  - **The sibling scripts do it right.** `hipparcos-source-check.mjs` and `build-star-designations.mjs` print the chain through `describe()`.
  - **Silent retry.** `politeFetch` retries a thrown error (network failure or abort) without logging it, while its HTTP-status path does log each retry.
  - **Which rule is broken.** The project's "never hide the evidence / no dropped error causes" rule.
- **Fix**: Make the combined error carry both causes (`cause: new AggregateError([primaryError, mirrorError])` or `{ primary, mirror }`), print the cause chain in `build-stars.mjs` with the same `describe()` the other two scripts use, and log `describe(error)` before `politeFetch` sleeps.
- **Decision**: **APPLIED.** The combined download error carries both failures as an `AggregateError` cause; one shared `describeError` (in `scripts/lib/hipparcos.mjs`) prints the chain in all three scripts; `politeFetch` logs a retried thrown error. Tests cover both causes and the printed chain.

### F4 — The landing image is still the HYG-era render, and the HYG credit is gone

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: public/landing/tonight.png (last captured 2026-10-15, `b0ad3f98`); src/components/Welcome.astro:107
- **Detail**:
  - **What the plan did.** It kept the screenshot ("No recapture of `public/landing/tonight.png`; only a credit is added") and, in the same change, removed the HYG credit from `Attribution`.
  - **Why that matters.** The picture's stars were drawn from the HYG-built `bright-stars.json`. The landing now shows a HYG-derived render under a credit that names only Hipparcos/ESA, Wikidata and the IAU.
  - **What the change promises.** It exists so that nothing shipped derives from HYG: ESA said it cannot authorise HYG-derived material, and HYG's CC BY-SA asks for its credit.
  - **Is the image covered at all?** Whether a rendered sky picture is "material derived from" the data is a legal judgement, not a code fact. But it is the one shipped artefact that still traces to HYG, and it sits on the page that was added to the credited views specifically for ESA.
  - **Cost of fixing.** Recapture is a single documented command, `CAPTURE_LANDING=1 … npx playwright test landing-screenshot`, against the new files.
- **Fix A ⭐ Recommended**: Recapture `public/landing/tonight.png` on this branch with the documented command, as a small addendum to Phase 5.
  - Strength: removes the last HYG-derived shipped artefact, so the ESA field list and credit describe everything on the page.
  - Tradeoff: a plan addendum (the plan explicitly excluded recapture), and the image changes slightly, with a few stars fewer.
  - Confidence: HIGH — the capture spec and the size constants exist (CLAUDE.md, Landing).
  - Blind spot: the capture needs a running preview and the fixture forecast, so the visual may differ from the current image in more than the stars.
- **Fix B**: Keep the image, and the owner records the decision. Optionally add a HYG credit line for the image only.
  - Strength: no scope change.
  - Tradeoff: one HYG-derived artefact stays shipped without its credit, or with a credit that contradicts "HYG is no longer a source".
  - Confidence: MED — this depends on the legal reading.
  - Blind spot: ESA's assessment scope does not cover this image.
- **Decision**: **APPLIED (owner, 2026-10-17): re-capture.** `public/landing/tonight.png` re-captured on the Hipparcos data with `CAPTURE_LANDING=1 … landing-screenshot` in the follow-up PR.

### F5 — Some newly added "Flamsteed" numbers are Gould numbers or unverifiable

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: scripts/data/star-designations.json (additions listed in designation-check.md:258)
- **Detail**:
  - **What was accepted.** The 23 Flamsteed "additions" were accepted as single Wikidata values with no further check.
  - **Gould numbers.** Several are not Flamsteed numbers at all but Gould (Uranometria Argentina) numbers in southern constellations: 140, 188 and 212 Pup, 113 Vel, 191 Car, and probably 33 and 53 Vel, 9 Cha, 26 Cir. SIMBAD knows them as `* 212 Pup` and so on, so they are real designations, but the field is called `flamsteed`.
  - **Values SIMBAD does not know.** In a SIMBAD identifier lookup of 8 of the 23 HIPs, two values were absent: HIP 7588 (Achernar) "70 Eri", and HIP 112355 "54 Oct" (SIMBAD lists only `* B Oct`).
  - **User impact.** Small. Achernar shows its Bayer α. Octans, Carina and Vela never rise from the PRD's Polish sites, and 205 Dra is a real SIMBAD identifier.
  - **The underlying gap.** Additions bypass the omit-when-in-doubt policy that disagreements get. Row 2.8 confirmed Flamsteed numbers only through the IAU list (5 stars).
- **Fix**: Add `omit: ["flamsteed"]` overrides for HIP 7588 and 112355, citing the SIMBAD identifier list. Either document in the table's `rules` that numbers above Flamsteed's range are Gould numbers kept as SIMBAD writes them, or omit them.
- **Decision**: **APPLIED (owner, 2026-10-17): drop.** Nine Gould numbers (140, 188, 212 Pup; 33, 53, 113 Vel; 191 Car; 9 Cha; 26 Cir) and the two values SIMBAD does not know (70 Eri, 54 Oct) are omitted by overrides that say why; the table's `rules` describe it; both tables regenerated through the scripts only (Flamsteed values 2,639 to 2,628, designated stars 3,222 to 3,212). **Open:** a lookup of all 23 additions found a third value SIMBAD does not know, 30 Sgr (HIP 88760), kept because the decision named two; reported to the owner.

### F6 — Overrides apply only at `stars:designations`, and nothing pins the table to the override file

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: scripts/build-stars.mjs:43-44; scripts/data/star-designations.json (`meta.overridesApplied`)
- **Detail**:
  - **The mismatch.** The Phase 2 overview says the star build reads three files. It reads two, the designation table and the IAU table.
  - **What happens today.** Overrides are folded into the table by the network script, and the committed `meta.overridesApplied` currently matches all 18 override keys (checked).
  - **The risk.** A later hand edit to `star-designation-overrides.json` without re-running `stars:designations` changes nothing, and no test notices.
- **Fix**: Add a unit test asserting that `Object.keys(overrides)` equals `meta.overridesApplied` and that each override's value or omission is reflected in `stars`. Alternatively, have `build-stars.mjs` assert the same before writing.
- **Decision**: **APPLIED.** A test pins `meta.overridesApplied` (decision, value, source) and the table's values to the overrides file.

### F7 — Reader diagnostics and small robustness gaps

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/lib/hipparcos.mjs:57, 188, 226-265; scripts/build-star-designations.mjs:212-222; scripts/lib/designations.mjs:515-526, 554-556
- **Detail**: None of these can produce wrong files.
  - **Parse runs before the hash.** Records are parsed while the file streams, so a corrupt or HTML answer fails with "Line N: …" instead of the pin-mismatch report with Last-Modified and ETag.
  - **The download is not stopped on that throw.** The controller is not aborted on the throw, so the socket stays open while the mirror is tried; Node still exits promptly, as the subagent tested.
  - **Untested branch.** The "more bytes than the pin" branch has no test.
  - **No total deadline.** Only a 60 s stall timer exists.
  - **Pre-redirect URL recorded.** `stats.url` is the requested URL, not the one after redirects.
  - **`--from-raw` skips the pin check.** It does not compare the saved rows' `sha256` with `HIPPARCOS_PIN`.
  - **Order of label-fallback candidates.** They keep the SPARQL response order (the query has no `ORDER BY`), so `omitted[].candidates` could reorder between two live runs. `--from-raw` runs are deterministic.
- **Fix**: Abort the controller in a `finally` and prefix parse errors with the URL. Add the over-length test. Check the pin in `--from-raw`. Sort the fallback candidates.
- **Decision**: **APPLIED, except the total download deadline.** A record that does not parse is reported after the hash; the download is aborted on any throw; `--from-raw` checks the pin; fallback candidates are sorted; the over-length branch has a test; `stats.url` is the URL after redirects. Not done: a total deadline (the stall timer stays).

### F8 — Stale numbers and wording in comments, the plan and the roadmap

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/catalogue/stars.ts:25; context/foundation/roadmap.md:213; plan.md (Decisions, designations policy); scripts/lib/designations.mjs (names meta `rules`); src/components/tonight/Attribution.astro (WGSN link); scripts/hipparcos-source-check.mjs:15-17
- **Detail**:
  - `stars.ts:25` says the range leaves "a margin of 10 either way", but 915-935 around 921 is −6/+14.
  - `roadmap.md:213` still says "the 925-star bright file is expected to stay unchanged" (it is 921).
  - The plan says "roughly 1 %" of designated stars lose a designation; the measured figure is 3.1 %, which is documented only in `designation-check.md`.
  - The IAU names meta rule says only the proper-name and HIP columns are read, but `parseIauTable` also reads the Bayer ID column (for HIP 72105).
  - The "IAU WGSN" credit links to exopla.net, a third-party mirror of the list, rather than the IAU's WGSN page. It is the page actually read, but a credit to the IAU would normally point at the IAU.
  - `hipparcos-source-check.mjs` repeats 921, 25,723 and the ten HIPs instead of importing `BUILD_LIMITS`.
- **Fix**: Re-centre or reword the range comment. Fix the roadmap line at archive. Add a one-line plan note on the 3.1 %. Correct the names meta rule. Optionally link "IAU WGSN" to the IAU page and keep exopla.net in `LICENSE-DATA.md` as the copy that was read. Import `BUILD_LIMITS` in the source check.
- **Decision**: **APPLIED, except the roadmap line (at archive).** Range comment, the plan's measured 3.1 %, the names meta rule (table regenerated), the credit's link to the IAU's WGSN page (`https://www.iau.org/WG280/WG280/Home.aspx`; `LICENSE-DATA.md` keeps exopla.net as the copy that was read) and the source check importing `BUILD_LIMITS`. `roadmap.md:213` ("925-star bright file") is fixed when the change is archived.
