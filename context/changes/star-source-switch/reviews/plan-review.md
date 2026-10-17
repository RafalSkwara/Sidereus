<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Star Source Switch

- **Plan**: `context/changes/star-source-switch/plan.md` (5 phases, no Progress row done)
- **Date**: 2026-10-16
- **Reviewer**: herdr agent "reviewer" (Opus, medium), one Opus claim-verification subagent
- **Inputs read**: plan.md, plan-brief.md, research.md, change.md (`planned`), the ESA reply draft and assessment (PR #186, `esa-decision` worktree), the CDS I/239 ReadMe (fetched 2026-10-16)
- **Owner decisions received during the review (via orchestrator)**: the 10 stars without an astrometric solution are drawn from RAhms/DEdms (option b; the ESA email will list those fields); the landing page gets the `Attribution` footer (yes).
- **Not done**: no verification command was run. The new files do not exist yet, `npm test` is the hook's job, and e2e and smoke need servers, which this review may not start. Every command was checked to resolve against `package.json` scripts and the installed tools; `npm run stars:designations` is created by Phase 2 itself.
- **change.md**: not touched (reviewer mode: this file is the only write).

```
═══════════════════════════════════════════════════════════
  PLAN REVIEW: Star Source Switch
  Phases: 5  |  Date: 2026-10-16
  Findings: 1 critical  5 warnings  3 observations
═══════════════════════════════════════════════════════════

  Claim Accuracy        WARNING ⚠️   (1 finding)
  Substance             PASS    ✅
  Feasibility           FAIL    ❌   (1 finding)
  Sequencing            PASS    ✅
  Architecture Fit      PASS    ✅
  Scope Discipline      WARNING ⚠️   (1 finding)
  Verifiability         WARNING ⚠️   (1 finding)
  Coverage              WARNING ⚠️   (5 findings)

  ► Overall: NEEDS ATTENTION
```

The plan is strong. The pin design, propagation, offline designation tables, build-first-then-switch phasing and "a failing reference is never a fixture edit" stop rule are all right, and almost every claim about the code holds (see "Claims checked" below). The one critical finding is not a plan error: the owner's decision (b) arrived after the plan was written and changes the reader contract and every count in it. The rest are cheap sharpenings. None needs `/10x-plan` again.

## Verdicts

| Dimension        | Verdict | Findings   |
| ---------------- | ------- | ---------- |
| Claim Accuracy   | WARNING | F9         |
| Substance        | PASS    |            |
| Feasibility      | FAIL    | F1         |
| Sequencing       | PASS    |            |
| Architecture Fit | PASS    |            |
| Scope Discipline | WARNING | F3         |
| Verifiability    | WARNING | F4         |
| Coverage         | WARNING | F2, F5, F6, F7, F8 |

## Findings

### F1 — The plan excludes the 10 stars without an astrometric solution; the owner chose to draw them from RAhms/DEdms

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — non-trivial edit across several phases; think before deciding
- **Dimension**: Feasibility
- **Location**: plan.md "Decisions taken here › Rows without a solution", Phase 1 §1-§3 and 1.3, Phase 3 §1 (guards, `excludedNoSolution`) and 3.2, Phase 4 §2 (count ranges), Phase 5 §1 ("the 10 excluded stars") and 5.8, Desired End State, Testing Strategy; plan-brief "Stars without a solution"
- **Decision**: ACCEPTED, applied 2026-10-16 (owner via orchestrator: apply all F1-F9 as recommended)

**Detail.** As written, Phase 1's `readHipparcos` drops rows with blank RAdeg/DEdeg. Criteria 1.3 and 3.2 assert 919 / 25,713, and the generator guards and the `stars.ts` / `finder-stars.ts` ranges are centred there. Under the owner's decision (b), the correct counts are **921 / 25,723**: research §4 measured 919 + 2 and 25,713 + 10. As written, every one of those lines is wrong, and the Phase 4 ranges would reject the right file.

Facts for the rewrite, checked here:

- The CDS ReadMe (lines 116-117) defines `RAhms` as "Right ascension in h m s, ICRS (J1991.25)" and `DEdms` as "Declination in deg ' \", ICRS (J1991.25)". Their epoch is therefore stated, not unknown. Research §3 and Open Question 1 ("unknown epoch, not verified") are superseded.
- These rows carry no proper motion, so they cannot be propagated. Using the J1991.25 position as J2000 leaves at most a few arcseconds of error for these stars (ξ UMa is the largest mover). That is far under the finder file's 36″ step, and it is the 5-decimal precision of the bright file either way.
- After `split("|")` these are indices 3 and 4. Their precision is 0.01 s and 0.1″.

**Fix.** Rewrite the reader contract:

- Rows with RAdeg/DEdeg propagate as planned.
- Rows with blank RAdeg/DEdeg and Vmag ≤ 7.5 take their position from RAhms/DEdms unpropagated. Malformed sexagesimal throws with the line number.
- Rename the meta's `excludedNoSolution` to `positionFromSexagesimal`, listing the HIPs with a note "J1991.25, no proper motion, not propagated".
- Re-pin the counts to 921 / 25,723 everywhere: guards, source-check, criteria 1.3 and 3.2, Phase 4 ranges, LICENSE-DATA, PR text and the brief.
- Add one reader test for a sexagesimal row, plus one build or catalogue test that pins exactly those 10 HIPs.
- Drop the "Cost: Alula Australis and ξ Sco are not drawn" sentence.

The assessment of this fix:

- **Strength:** HYG drew these stars, so including them removes drift rather than adding it. ξ UMa and ξ Sco stay on the live sky.
- **Tradeoff:** two more fields go to ESA (owner accepted), plus one small parsing branch.
- **Confidence:** HIGH. The ReadMe text and the research counts were both read.
- **Blind spot:** Where 8 of the 10 stars fall was not checked. HIP 80579 is near RA 16h27m, the CrB/M13 longitude of the example chart, so the Phase 3 comparison must place all ten (see F2).

### F2 — Nothing protects the published-hop and example-chart stars from the omit-when-in-doubt policy until Phase 4

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — obvious, narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md Phase 2 §1/§4, Phase 3 §2, Phase 4 §5
- **Decision**: ACCEPTED, applied 2026-10-16 (owner via orchestrator: apply all F1-F9 as recommended)

**Detail.** The reference matcher (`finder.test.ts:905-912`) requires `con` to match. It then requires `bayer` to match when the route star has a Bayer letter, and `flamsteed` otherwise. It never uses proper names. The route stars are:

- β, μ and ν And
- η, ζ and π Her
- β and γ Lyr
- α UMa
- **24 UMa**, which has a Flamsteed number only
- γ Sge

The example chart also carries α, ε, ν¹ and υ CrB-area designations. If the policy omits one of these (24 UMa's Flamsteed number, or a β Lyr that Wikidata splits into β¹/β²), the plan finds out only in Phase 4, where it must stop and cannot edit the fixture. Two route stars, ν And and 24 UMa, sit exactly at the 4.5 limit (tenths 45). Keeping them selectable depends on the tenths rule staying `Math.round(mag*10)` (`build-stars.mjs:212`), which disagrees with `toFixed(1)` on 391 of 901 ".x5" values.

**Fix.**

- In Phase 2, add a check, and an override with a citable source where needed, so that every reference route star and example-chart star keeps an identical `bayer` / `flamsteed` / `con`. Record this in `designation-check.md`.
- In Phase 3, write down "tenths = `Math.round(Vmag*10)`, unchanged" and pin it with one test row at x.x5.
- In the Phase 3 comparison, confirm the tenths of ν And and 24 UMa are unchanged.
- In the Phase 3 comparison, place the 10 sexagesimal stars against the reference routes and the CrB–M13 field (F1).

### F3 — The designation policy uses the HYG-era value as a decision input

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — obvious, narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: plan.md "Decisions taken here › Designations policy" ("or disagrees with the HYG-era committed value, … omitted"), against Phase 2 §1's `chooseDesignation(candidates, computedCon, override)` and the end state "no HYG input"
- **Decision**: ACCEPTED, applied 2026-10-16 (owner via orchestrator: apply all F1-F9 as recommended)

**Detail.** The policy sentence makes HYG (CC BY-SA, with Yale BSC-derived designations) an input to which designations ship. The function contract has no such input, and the end state promises none. If the regeneration script reads HYG, two problems follow. A later `npm run stars:designations` after the switch has no HYG file to compare against, so it is not reproducible. And the CC0 table's provenance would carry a BY-SA dependency, which is exactly what the switch removes.

**Fix.** State that `build-star-designations.mjs` never reads HYG. The HYG comparison lives only in the throwaway `designation-check.md` step. Each disagreement it finds is settled by an entry in `star-designation-overrides.json` that cites a citable source (`omit: true` or the value), so the committed inputs alone reproduce the table.

### F4 — Several verification lines pass vacuously or cannot pass as written

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — obvious, narrowly scoped
- **Dimension**: Verifiability
- **Location**: Phase 2 2.4; Phase 4 4.8; Phase 5 5.4 and 5.5
- **Decision**: ACCEPTED, applied 2026-10-16 (owner via orchestrator: apply all F1-F9 as recommended)

**Detail.**

- **2.4.** `git diff --exit-code scripts/data/` ignores untracked files, so it passes on the first run before anything is committed. Research §5 also saw a Wikidata rerun differ by one star, so "a second run on the same day changes no byte" can fail for reasons outside the code.
- **4.8.** `git diff --stat origin/main...HEAD` also lists the files from Phases 1-3, so the claim "only the four generated files, this phase's files and the example chart" is false by construction.
- **5.4 and 5.5.** Per CLAUDE.md, the finder e2e specs and the smoke script need `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY>` inline against the local stack. Without them, the finder steps are skipped or fail.

**Fix.**

- **2.4:** test determinism of the transform. Save the raw SPARQL and WGSN responses to a scratch directory, give the script a `--from-raw <dir>` mode, run it twice and `cmp` the outputs, with the generated tables committed or staged first.
- **4.8:** diff from the Phase 3 commit (`git diff --stat <phase-3-sha>..HEAD`).
- **5.4 and 5.5:** write the inline-env form of both commands.

### F5 — ESLint for `scripts/` lacks the globals the reader and its tests need

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — obvious, narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md Phase 1 §1/§3 (criterion 1.2), `eslint.config.js:76-81`
- **Decision**: ACCEPTED, applied 2026-10-16 (owner via orchestrator: apply all F1-F9 as recommended)

**Detail.** The scripts block declares only `console`, `process`, `fetch`, `URLSearchParams` and `URL`, and `no-undef` is active for `.mjs`. The subagent linted a probe through `--stdin-filename scripts/lib/probe.test.mjs`. `Response`, `Headers`, `Buffer`, `TextDecoder` and `setTimeout` each fail `no-undef`, and the injected-fetch tests and the streaming hash will use them. Importing `vitest` and `astronomy-engine` lints clean. `eslint.config.js` is not in the plan's file list.

**Fix.** Either add `eslint.config.js` to Phase 1 with those globals, or require `node:` imports (`node:crypto`, `node:buffer`, `node:timers`) and construct `new Response(...)` from a `globalThis` reference. Prefer the globals edit.

### F6 — The used-field list promised to ESA is not recorded or checked

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — obvious, narrowly scoped
- **Dimension**: Coverage
- **Location**: Phase 1 §1 contract, Phase 3 §1 meta, Phase 5 §1
- **Decision**: ACCEPTED, applied 2026-10-16 (owner via orchestrator: apply all F1-F9 as recommended)

**Detail.** The owner's rule is that the build uses exactly the fields the ESA email lists. After F1 these are HIP, RAdeg, DEdeg, Vmag, pmRA and pmDE, plus RAhms and DEdms for the 10 stars. The plan states this in prose only. Nothing makes the field list visible in the output or stops a later edit from reading, say, `Hpmag` or `B-V`. The ESA draft also describes the derived files as "position, magnitude and HIP identifier". The finder file stores no HIP (the index ties by HIP, "not stored"). That is not wrong, but the meta should say so.

**Fix.**

- Export `HIPPARCOS_FIELDS_USED` (names and split indices) from the reader.
- Have `parseRecord` read only through that table.
- Write it to both metas as `fieldsUsed`.
- Pin it in the provenance tests against the exact list in the email.
- List it in `LICENSE-DATA.md`.

### F7 — The landing credit is now decided; the plan still marks it "owner confirms"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — obvious, narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md Phase 5 §2 and 5.7
- **Decision**: ACCEPTED, applied 2026-10-16 (owner via orchestrator: apply all F1-F9 as recommended)

**Detail.** The owner chose to render `Attribution` at the landing page's foot. `Welcome.astro` already imports from `tonight/` (`TonightSky`, `verdict-tones`), and its footer starts at line 100, so this is a one-line include. On the landing the only star data is `public/landing/tonight.png`; `TonightSky` there is a decorative, generated field. The full `Attribution` also credits OpenNGC, Open-Meteo and the meteor sources. That is correct, because the screenshot shows Tonight content.

**Fix.**

- Change 5.7 from "the owner confirms the landing placement" to a check that the footer renders in both locales at 320 and 360 px without sideways scroll.
- Have `tests/e2e/tonight-phone.spec.ts` or the landing spec still pass.
- Optionally add a one-line e2e assertion that the signed-out `/` contains "Credit: ESA".

### F8 — The test load is heavier than "modest"

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — obvious, narrowly scoped
- **Dimension**: Coverage
- **Location**: Phases 1-4 test sections
- **Decision**: ACCEPTED, applied 2026-10-16 (owner via orchestrator: apply all F1-F9 as recommended)

**Detail.** The plan adds three new script test files plus a new Vitest include, on top of rewriting the provenance tests. Most of it earns its place: pin failure, propagation, independent published positions, constellation pins and near-duplicates are the guards this switch lacked. A few cases are low-value for a file unchanged since 1997: the mirror-retry test, `Content-Encoding` rejection as its own test, and the "two-digit superscript" normalisation, which no current star needs (`bayerLetter` maps digit by digit, so `-10` already renders).

**Fix.** Keep the pin, propagation, sexagesimal-row (F1), designation-policy and catalogue-position tests. Fold the mirror retry and encoding rejection into one failure-mode test, and drop the cases that test only string formatting already covered by `formatDesignation`.

### F9 — Small claim errors

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — obvious, narrowly scoped
- **Dimension**: Claim Accuracy
- **Location**: Current State Analysis, Phase 4 §2/§4, Phase 5 §1
- **Decision**: ACCEPTED, applied 2026-10-16 (owner via orchestrator: apply all F1-F9 as recommended)

**Detail.**

- **Onboarding.** `Attribution` is **not** rendered on onboarding. `onboarding.astro` has its own location credit, so nothing changes there.
- **LICENSE-DATA lines.** The HYG section of `LICENSE-DATA.md` is lines **31-65** (its "Upstream: Hipparcos" subsection is 54-65), not 31-62. "Meteor showers" starts at 67.
- **Bright range.** `stars.ts`'s bright range (915-935) already admits 919 or 921. Only the finder range (25,741-25,841) must move.
- **Duplicate-id error.** The duplicate error to reword is at `stars.ts:80`.
- **HYG comments.** The generator also says "HYG" at `build-stars.mjs:211, 289, 309, 312`, besides 207-208.
- **Untouched test.** `finder-stars.test.ts:45-74` requires the nearest finder star's `proper` to equal each bright name. The plan does not mention it. It passes as long as both files take names from the same IAU table.

**Fix:** correct the line numbers and the onboarding sentence, and add the `finder-stars.test.ts:45-74` test to Phase 4's "must pass unchanged" list.

## Claims checked and confirmed

All were confirmed against the worktree at `b6eb4f3`:

- **Generator.**
  - The generator anchors hold: `unitVector` 97-105, `pos` packing 195-203, `finderJson` 260-266, guards 36-40, the named rule 41-44 and `VECTOR_DIGITS` 45.
  - The sorts are bright `mag || id` (173) and finder `tenths || id` (213).
  - The bright `mag` is unrounded.
- **Engine.**
  - `finder.ts:574` breaks start-star ties on `distanceCenti || magTenths || index`. Limits are compared in tenths (529, 544). Route cost also ties on index order (326-401): the example's two 4.8° hops (4106, 2103) are such a tie, and the plan's "same stars" check before keeping the regenerated chart covers it.
- **Build and tests.**
  - The `build-sw.mjs:94-110` leak markers are `["finder-stars", filter, pos.slice(0,40)]`, with a non-empty `filter` required.
  - `EXAMPLE_CHART_REGENERATE` is the right variable (`example-chart.ts:17`). The deep-equal is at `example-chart.test.ts:122-126`.
  - `vitest.config.ts` includes only `src/**/*.test.ts`. `astro check` does not type-check `.mjs`. The end-of-turn hook lints `*.mjs`, while lint-staged does not.
  - The `.prettierignore` star entries exist. `scripts/data/` and `scripts/lib/` do not, so nothing collides.
  - The purity, no-console and silent-catch guards scan only `src`, and no test greps "HYG".
- **Data and dependencies.**
  - `GREEK` includes `Omi`.
  - The bright `id` is used only as a React key and DOM id in `TonightSkyView.tsx`. No e2e spec, smoke step or landing spec reads star ids, indices or names, so no data migration is needed.
  - `astronomy-engine` 2.1.19 `Constellation` imports in Node ESM and returns CMa for Sirius and UMi for Polaris.
  - No reference star uses a component-suffixed Bayer or a non-IAU proper name.
  - ξ UMa and ξ Sco are far from every reference route and from the CrB–M13 example field.
- **Propagation.** The plan's formula (`pmRA·dt/cos(dec)`, with pmRA already multiplied by cos dec, plus RA wrap) is correct, and the research's 0.007″ agreement with the rigorous model makes linear propagation sufficient.
- **Pin.** Exact length plus row count plus SHA-256, identity encoding, early Content-Length abort, mirror accepted on the hash alone, and no auto-update are a sound reproducible-download design.
- **Licensing and docs.**
  - Wikidata's main namespace (statements and labels) is CC0, so crediting it is voluntary and the plan's credit is fine. WGSN names are public domain; only the page's etymology texts are CC BY, and the plan takes only name and HIP.
  - The CLAUDE.md, LICENSE-DATA and Attribution updates are all scheduled in Phase 5, and the "never edit by hand" tripwires are rewritten there.
  - The SPARQL User-Agent carries the project URL only, with no personal data.

## Owner questions

Both owner questions were settled during the review (option b; landing footer yes), and F1 and F7 carry them into the plan. No question remains open.
