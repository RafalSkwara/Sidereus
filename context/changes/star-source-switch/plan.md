# Star Source Switch Implementation Plan

## Overview

Replace the star source of both generated star pairs (`bright-stars*.json`, `finder-stars*.json`) from HYG v4.1 (CC BY-SA 4.0, a third party's compilation of ESA's data) with the Hipparcos Catalogue, Version 1 (ESA 1997, VizieR I/239 `hip_main.dat`, CC BY-NC 3.0 IGO) read directly from a pinned, checksummed download. Bayer and Flamsteed designations come from a committed table built from Wikidata (CC0), proper names from the IAU WGSN list (public domain), and the constellation from `astronomy-engine`'s `Constellation()`. This is roadmap M-4 S-08 (GitHub #185), the owner's decision of 2026-10-16: the app must be ready to take payments, ESA has offered to assess direct use of Hipparcos V1 and cannot authorise HYG-derived files (PRD Open Question 21; assessment `context/foundation/licensing/esa-reply-assessment-2026-10-16.md`). V1 is non-commercial, which is fine while the app is free; no payment is taken until ESA authorises in writing.

## Current State Analysis

- `scripts/build-stars.mjs` (334 lines) streams HYG's CSV from a pinned GitHub commit, takes `id, proper, ra (hours), dec, mag, bayer, flam, con`, and writes both pairs in one run. It sorts by magnitude then HYG id and guards counts at 925 ± 10 and 25,791 ± 50.
- The shipped files: 925 stars to magnitude 4.5 (41 proper names, browser-delivered) and 25,791 stars to 7.5 (3,342 designated, server-only). `finder-stars.ts` renders designations as `Mirach (β And)` from tuples `[bayer, flamsteed, con, proper]` with HYG's `Abc` / `Abc-n` Bayer form.
- Hipparcos V1 differs in four ways that matter (measured, `research.md`): positions are J1991.25 and need propagation; there are no designations, names or constellations; the counts are 919 and 25,713 among rows with a solution (HYG's extra rows are non-Hipparcos Gliese/Yale companions, one a duplicate Capella); and 10 stars at V ≤ 7.5 have no astrometric solution (no RAdeg/DEdeg, only the sexagesimal RAhms/DEdms, which the owner decided to use: 921 and 25,723 with them).
- The finder index is the sort position and the engine breaks ties on it, so the tie-break key is a behavioural decision. Provenance is pinned in two tests, an example chart is generated from the real file, and the published-hop reference fixtures match HYG-format Bayer strings.
- `Attribution.astro` hard-codes HYG and the ESA credit and is rendered on the Tonight pages and the finder (onboarding carries its own location credit); the signed-out landing (`Welcome.astro`) draws Hipparcos-derived stars in `public/landing/tonight.png` with no credit (PRD Open Question 21, pre-existing).

## Desired End State

- `npm run stars:build` reads `hip_main.dat` from the pinned URL (mirror as one retry), verifies byte length, row count and SHA-256 before writing anything, and regenerates the four files byte-identically on every run, with no clock, no network call for designations and no HYG input.
- Both pairs carry Hipparcos numbers, positions propagated to J2000 from RAdeg/DEdeg and pmRA/pmDE (the ten stars without a solution from RAhms/DEdms, unpropagated), Vmag, designations from the committed source table, IAU names, and computed constellations. The meta files record the Hipparcos pin, its licence ("CC BY-NC 3.0 IGO"), the exact fields read from the file (`fieldsUsed`) and the designation inputs' sources and licences.
- Nothing in `src/`, `scripts/` or the docs depends on HYG, its ids or its licence. `Attribution` credits "Hipparcos, Credit: ESA" with the SP-1200 citation, and the designation sources; the landing page credits the stars too (the draft to ESA promises the credit "on every view that draws stars").
- The finder chart and live sky behave as before: the published-hop reference fixtures, the coverage gate and the explainer chart pass without editing a fixture's expectations.
- Verified by: the new unit tests (reader, designations, build functions, independent position and constellation checks), the whole existing unit suite, `npx astro check`, `npm run lint`, `npm run build`, the full e2e suite and `npm run smoke` against local Supabase, and one visual check of the live sky and a finder chart.

### Key Discoveries:

- `hip_main.dat` is 118,218 records of 450 characters plus LF, pipe-delimited at fixed positions; fields by `split("|")` index: HIP 1, Vmag 5, RAdeg 8, DEdeg 9, pmRA 12, pmDE 13, plus RAhms 3 and DEdms 4 for the ten rows without a solution (`research.md` §1 and its follow-up).
- Pin: `https://cdsarc.cds.unistra.fr/ftp/cats/I/239/hip_main.dat`, 53,316,318 bytes, 118,218 rows, SHA-256 `58ceabb104d647160d9437ce6e513a02a036bb4ad9f8879a5a22fd52943616e0`; the Harvard VizieR mirror gives the identical bytes; the server copy has not changed since 1997 (`research.md` §2).
- Linear propagation over 8.75 years agrees with a rigorous space-motion propagation to 0.007″ (zero radial velocity) and is what HYG's committed positions already match for most stars (842 of 919 bright vectors identical) (`research.md` §3).
- `scripts/build-stars.mjs:97-105,195-203,260-266` (unit vector, `pos` packing, JSON layout) and the streaming fetch loop carry over; the CSV parser, `SOL_ID` and the HYG column reads go.
- `src/lib/engine/finder.ts:574` tie-breaks on `index`, so ordering by HIP is deliberate and must be written down in the generator and in `finder-stars.ts`.
- `scripts/build-sw.mjs:94-110` fails the build if the finder meta's `filter` string or the first 40 characters of `pos` reach `dist/client`; the new finder `filter` must stay non-empty and differ from the bright one.
- `src/lib/finder/example-chart.test.ts:122-126` deep-equals the committed explainer chart against the engine's output from the real file; regeneration is documented at `example-chart.ts:12-22`.
- `lessons.md`: measure size budgets on the built file in its shipped encoding; a failing reference is an engine finding, never a fixture edit.
- Vitest includes only `src/**/*.test.ts` (`vitest.config.ts`), and `scripts/**/*.mjs` are linted without type information (`eslint.config.js:76-77`), so pure script helpers can be tested only after the include is widened.

## What We're NOT Doing

- No Gaia DR3, no Tycho-2 (not ESA's), no Hipparcos new reduction (van Leeuwen 2007, I/311), no SAO fallback. SAO stays the reverse path if ESA refuses, in a change of its own.
- No payments, pricing or commercial-use enablement: V1 is CC BY-NC 3.0 IGO and stays non-commercial until ESA authorises in writing. The lawyer check of ESA's wording is a human step before the first payment.
- No change to the 925 / 41 naming design beyond the source: the bright file keeps "the brightest 40 named stars plus Polaris", now with IAU names.
- No change to the unit-vector precision (`VECTOR_DIGITS = 5`). The known 40″ Polaris offset in the bright file comes from that rounding, is pre-existing and stays; the new position tests use stars where the rounding does not matter.
- No recapture of `public/landing/tonight.png`; only a credit is added next to it.
- No live Wikidata or IAU query in the star build, and no CI step that downloads the 53 MB file.
- No edits to `context/archive/`, to the Messier/Caldwell generated files, or to any reference fixture's expectations.
- No PR merge: only the owner merges (CLAUDE.md tripwire).

## Implementation Approach

Build the new inputs first, behind tests, and switch the committed files only once everything that reads them is ready:

1. A verified Hipparcos reader (pin, streaming hash, record parser, propagation) as an importable pure module.
2. A designation source table and IAU name table, produced by a manual regeneration script from Wikidata and the WGSN page, committed with an override file, so the star build stays offline and deterministic.
3. The rewritten `build-stars.mjs` consuming both, run first into a scratch directory and compared with the committed HYG-era files.
4. The switch: regenerate into the catalogue directory, then update every consumer, test and fixture in one phase so the suite is never left red between phases.
5. Notices, attribution, docs and the PR.

Decisions taken here (agent side, from the research; owner-visible ones are marked):

- **Tie-break and ids:** HIP number is the id and the tie-break for both files (`mag` then HIP for the bright file, magnitude tenths then HIP for the finder file). The `id` key in `bright-stars.json` keeps its name and now means the Hipparcos number.
- **Rows without a solution (owner decision, 2026-10-16):** the 10 stars at V ≤ 7.5 with no RAdeg/DEdeg (HIP 31067, 31500, 34716, 50572, 52800, 55203, 59273, 78727, 80579, 115125) are drawn from the sexagesimal fields RAhms (H3, bytes 18-28, `hh mm ss.ss`) and DEdms (H4, bytes 30-40, `±dd mm ss.s`) of the same file, which the ReadMe labels ICRS (J1991.25). They have no proper motion, so their positions are used unpropagated (the error is bounded only by an unknown proper motion; the sexagesimal precision is 0.15″ in right ascension and 0.1″ in declination). The field list used from the file is therefore HIP (H1), Vmag (H5), RAdeg (H8), DEdeg (H9), pmRA (H12) and pmDE (H13), plus RAhms (H3) and DEdms (H4) for these ten stars only; the ESA reply draft lists it (docs PR #186). The meta lists the ten HIPs as `positionFromSexagesimal`, and the counts become 921 and 25,723. Two of them are naked-eye stars (HIP 55203 Alula Australis, V 3.79; HIP 78727 ξ Sco, V 4.16).
- **Designations policy:** the table keeps only values whose constellation matches the computed one, Greek-letter Bayer only, no component letters, superscripts as `-n`; where Wikidata offers several values for one star, the number or letter is omitted rather than guessed unless an override cites a source. The regeneration script never reads HYG: the one-off comparison with the HYG-era file lives only in `designation-check.md`, and each disagreement it finds is settled by an entry in `star-designation-overrides.json` (the value or `omit: true`, with a citable source), so the committed inputs alone reproduce the table. Roughly 1 % of today's designated stars lose a designation; counts are guarded.
- **Proper names:** IAU WGSN names only. The 23 non-IAU HYG names (Lacaille 9352, Lalande 21185, Castor B, …) disappear.
- **Magnitude tenths:** unchanged, `Math.round(Vmag*10)` as `build-stars.mjs:212` does today, so the two stars at the 4.5 limit in the published routes (ν And, 24 UMa) stay selectable; pinned by a test row at an x.x5 magnitude.
- **Pin handling:** verify while streaming, write nothing until byte count, row count and SHA-256 match, one retry on the mirror, never auto-update the pins.
- **Landing credit (owner decision, 2026-10-16: yes):** render the existing `Attribution` as the footer at the bottom of the signed-out landing page rather than inventing a new credit component.

## Phase 1: Pinned Hipparcos reader

### Overview

An importable module that downloads, verifies and parses `hip_main.dat`, plus a small committed command to check the pin. Nothing is written to the catalogue yet.

### Changes Required:

#### 1. Reader module

**File**: `scripts/lib/hipparcos.mjs`

**Intent**: Replace the HYG CSV reader with one for `hip_main.dat`: fetch the pinned URL, hash the raw bytes while streaming, parse into memory, and refuse to return anything unless length, row count and SHA-256 match the pin. Provide the pure helpers the build needs.

**Contract**: exports `HIPPARCOS_PIN` (`url`, `mirror`, `sha256`, `bytes`, `rows`, `recordLength` = 450 with the values in Key Discoveries), `readHipparcos(options)` (returns the rows with Vmag ≤ 7.5, sorted by HIP: each with RAdeg/DEdeg propagated to J2000 or, for the ten rows with no RAdeg/DEdeg, the position parsed from RAhms/DEdms and left unpropagated, flagged `fromSexagesimal`; it also lists the skipped rows), `HIPPARCOS_FIELDS_USED` (the field names and `split("|")` indices read from the file: HIP, Vmag, RAdeg, DEdeg, pmRA, pmDE, and RAhms and DEdms for the ten rows without a solution; `parseRecord` reads only through this table, so a later edit cannot read another field such as Hpmag or B-V without changing it and its test), `parseRecord(line, lineNo)`, `propagateToJ2000(row)` and `quantiseVmag`-style helpers only if the build needs them. Fetch uses `Accept-Encoding: identity` and rejects any `Content-Encoding`; Content-Length differing from the pin aborts early; every line must be 450 characters with pipes at the expected positions (check the first and last record); blanks (spaces) in RAdeg/DEdeg mean "no solution", in which case RAhms and DEdms must parse (`hh mm ss.ss`, `±dd mm ss.s`, ranges checked) or the record throws when its Vmag is ≤ 7.5; a blank Vmag skips the row (exactly one such row, HIP 120412, is expected and asserted), while a blank HIP or a malformed number throws with the line number. Propagation is `ra += pmRA·8.75/cos(dec)/3.6e6`, `dec += pmDE·8.75/3.6e6`, RA wrapped into [0, 360). On a pin mismatch it throws with expected and actual hash, bytes and rows plus the response's Last-Modified and ETag, after one retry on the mirror; the pin constants are changed only by a deliberate edit. The clock is never read.

#### 2. Source check command

**File**: `scripts/hipparcos-source-check.mjs`

**Intent**: Let the owner or CI-by-hand confirm the pin without building anything: download, verify and print hash, bytes, rows, the counts at V ≤ 4.5 and V ≤ 7.5, and the ten stars positioned from RAhms/DEdms.

**Contract**: exit 0 and print the counts on success; non-zero with the reader's mismatch report otherwise. Expected: 118,218 rows, and 921 and 25,723 stars (919 and 25,713 with a solution, plus the ten sexagesimal-only stars).

#### 3. Reader tests

**File**: `scripts/lib/hipparcos.test.mjs`, `vitest.config.ts`, `eslint.config.js`

**Intent**: Test the reader without the network. Widen the Vitest include to `scripts/**/*.test.mjs` so script helpers can be tested like `src/` code.

**Contract**: tests use synthetic 450-character records built in the test (never copies of the catalogue), an injected `fetch`, and a tiny pin override: record parsing including blank RA/Dec with a sexagesimal fallback (RAhms `hh mm ss.ss`, DEdms `±dd mm ss.s`, a negative declination such as `-00 30 00.0`), a malformed sexagesimal field and a blank Vmag, propagation (a star with known proper motion moves by the expected arc; RA wraps at 360; no division blow-up near a pole), pin verification passing, and one failure-mode test covering a flipped byte, a wrong length, a wrong row count, a `Content-Encoding` header and the mirror retry (the file has not changed since 1997, so no separate case for each). `vitest.config.ts`: `include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"]`. `eslint.config.js`: the scripts block (`:76-81`) declares only `console`, `process`, `fetch`, `URLSearchParams` and `URL`, and `no-undef` is on for `.mjs`, so add the globals the reader and its tests use (`Response`, `Headers`, `Buffer`, `TextDecoder`, `setTimeout`, `clearTimeout`).

### Success Criteria:

#### Automated Verification:

- Reader tests pass: `npx vitest run scripts/lib/hipparcos.test.mjs`
- Lint passes with no warnings on the new files: `npx eslint --max-warnings 0 scripts/lib/hipparcos.mjs scripts/lib/hipparcos.test.mjs scripts/hipparcos-source-check.mjs vitest.config.ts eslint.config.js`
- The pinned file verifies and counts match: `node scripts/hipparcos-source-check.mjs` reports 118,218 rows, 921 stars at V ≤ 4.5 and 25,723 at V ≤ 7.5, and lists the ten stars positioned from RAhms/DEdms
- The whole unit suite still passes: `npm test`

---

## Phase 2: Designation source data

### Overview

Produce and commit the designation inputs: a Bayer/Flamsteed table keyed by HIP (Wikidata, CC0), an IAU name table keyed by HIP, and a hand-edited override file. The star build will read these three files and nothing else for names.

### Changes Required:

#### 1. Pure helpers

**File**: `scripts/lib/designations.mjs`

**Intent**: Hold the rules that turn raw Wikidata and WGSN values into the app's tuple convention, so they are testable.

**Contract**: `bayerAbbreviation(value)` maps a Greek-letter Bayer string with optional superscript digits to HYG's convention (`β And` → `Bet`, `π¹ Ori` → `Pi-1`, `ψ¹⁰ Aur` → `Psi-10`; all 24 letters, including the Greek omicron U+03BF → `Omi`), returning the constellation abbreviation separately; Latin-letter Bayer and component-letter values (`θ¹ Ori A`, `α Cen A`) return `null`. `flamsteedNumber(value)` returns `{ number, con }`. `chooseDesignation(candidates, computedCon, override)` keeps only values whose constellation equals `computedCon`, applies the omit-when-in-doubt policy (several surviving values or a conflict → omitted unless the override gives the value with its source), and never returns a value for a star without an override or a single clear candidate. `parseIauTable(html)` extracts proper name and HIP from the exopla WGSN table and throws with a clear message if the header, the column positions or a minimum row count (≥ 600 rows, ≥ 500 with a HIP) are not as recorded.

#### 2. Regeneration script and data

**File**: `scripts/build-star-designations.mjs`, `scripts/data/star-designations.json`, `scripts/data/iau-star-names.json`, `scripts/data/star-designation-overrides.json`, `package.json`, `.prettierignore`

**Intent**: A manual, network-using script that queries Wikidata and the WGSN page once, applies the rules with positions from the verified Hipparcos reader (never from Wikidata, three of whose items have invalid coordinates), and writes the two generated tables; the overrides file is hand-edited input.

**Contract**: `npm run stars:designations`. Wikidata: two SPARQL queries to `https://query.wikidata.org/sparql` with the User-Agent `Sidereus (+https://github.com/RafalSkwara/Sidereus)` and no personal data; properties P528 with P972 qualifiers Q537199 (Hipparcos), Q105616 (Bayer), Q111116 (Flamsteed), P59 for the constellation, plus the label fallback (parsing English labels of HIP items such as "Beta2 Capricorni") only where P528 gives nothing. `star-designations.json` is `{ "meta": { sources, queries, fetchedAt, counts, rules }, "stars": { "<hip>": [bayer|null, flamsteed|null] } }`, keys numeric ascending, one entry per line; `iau-star-names.json` is `{ "meta": {...}, "names": { "<hip>": "<name>" } }` (the one HIP with two names, 72105, keeps both names' rule documented in the file); `star-designation-overrides.json` is hand-edited `{ "<hip>": { "bayer"?, "flamsteed"?, "omit"?, "source": "<citable reference>" } }`, empty at first except for what the check in this phase shows is needed. `build-star-designations.mjs` never reads HYG. Run live it can save the raw SPARQL and WGSN responses with `--save-raw <dir>`; with `--from-raw <dir>` it rebuilds the tables from those saved responses with no network call, which is how the determinism of the transform is tested. The fetch date lives only in `meta`, so the star build never reads it. The two generated files are added to `.prettierignore`.

#### 3. Helper tests

**File**: `scripts/lib/designations.test.mjs`

**Intent**: Pin the normalisation and the omit-when-in-doubt policy.

**Contract**: all 24 letters and the digit-by-digit `-n` form (no two-digit case: no current star needs it), Latin-letter and component-letter rejection, the ASCII-digit form `τ2 Aqr`, multi-value stars resolved by the constellation filter, an unresolved multi-value star omitted, an override winning with its source, and `parseIauTable` rejecting a table that changed shape.

#### 4. One-off comparison with the HYG-era file

**File**: `context/changes/star-source-switch/designation-check.md`

**Intent**: Record, before the switch, how the new table compares with what ships today, so each lost designation is a known and accepted loss. The comparison reads the committed HYG-era `finder-stars.json` from `origin/main` (the throwaway script lives outside the repo) and matches by position; this one-off step is the only place HYG-era data is read.

**Contract**: the file lists counts (designated, Bayer, Flamsteed, names), every Bayer disagreement, every Flamsteed disagreement or gap, and each omitted multi-value star, with the decision taken (override or accepted omission). Where an override is added (the value or `omit: true`), the source it cites is something the repo may cite (a published catalogue or a CC0/PD source), never the HYG file or the Yale BSC copy. It also lists, for every route star in `src/lib/engine/fixtures/finder-reference.ts` (β, μ and ν And; η, ζ and π Her; β and γ Lyr; α UMa; 24 UMa; γ Sge) and the example chart's four designated stars (α, ε, ν¹ and υ in the Corona Borealis field), the HIP it resolves to and whether `bayer` / `flamsteed` / `con` are identical to what the reference expects; any miss is settled by an override with a citable source in this phase, so Phase 4 cannot be the first to find it.

### Success Criteria:

#### Automated Verification:

- Designation helper tests pass: `npx vitest run scripts/lib/designations.test.mjs`
- The regeneration script completes and writes both tables: `npm run stars:designations`
- Table counts are plausible: at least 3,100 designated stars, 1,400 Bayer values and 2,500 Flamsteed values in `star-designations.json`, and at least 500 HIPs in `iau-star-names.json`
- The transform is deterministic: with the raw responses saved by the live run, `npm run stars:designations -- --from-raw <scratch dir>` run twice gives byte-identical tables (`cmp`)
- Lint passes with no warnings on the new files: `npx eslint --max-warnings 0 scripts/lib/designations.mjs scripts/lib/designations.test.mjs scripts/build-star-designations.mjs`
- The whole unit suite still passes: `npm test`

#### Manual Verification:

- `designation-check.md` shows every disagreement with the HYG-era table and the decision taken for it, and no designation was guessed
- Ten stars from the table (five Bayer, five Flamsteed, including one multi-value star) are confirmed against a published source named in `designation-check.md`
- Every route star of the published-hop references and the example chart's designated stars resolves to a HIP with identical `bayer` / `flamsteed` / `con`, recorded in `designation-check.md`

---

## Phase 3: Build script on the new source

### Overview

Rewrite `scripts/build-stars.mjs` to use the Hipparcos reader and the designation tables, and run it into a scratch directory so the committed files are untouched while the output is compared.

### Changes Required:

#### 1. Generator

**File**: `scripts/build-stars.mjs`

**Intent**: Drop everything HYG (CSV parser, `SOL_ID`, the HYG pin and column reads); build both pairs from the reader's rows and the committed designation tables, keeping the output formats the consumers already read.

**Contract**:

- Order: bright by `mag` then HIP; finder by magnitude tenths then HIP; tenths are `Math.round(Vmag*10)`, unchanged from the HYG-era generator (`build-stars.mjs:212`); the comments at `build-stars.mjs:207-208` and in `finder-stars.ts` say so, and every HYG mention in the generator goes (`:3,12-18,207-208,211,289,309,312`).
- Bright file entries keep `{ id, mag, x, y, z, name? }` with `id` = HIP, positions from the propagated RA/Dec through the existing `unitVector` (RA converted from degrees to hours), and `name` only for the 40 brightest stars that have an IAU name plus Polaris; the named-count guard stays at 41.
- Finder file keeps `pos`, `mag` runs and sparse `designations` as `[bayer, flamsteed, con, proper]`, where `con` comes from `Constellation(raHours, decDeg)` of the propagated position, `proper` from the IAU table and `bayer`/`flamsteed` from the designation table plus overrides; a star with any of the three gets an entry, a missing `con` throws.
- Guards: counts exact to the measured 921 and 25,723 with a small margin (the pinned file cannot change), duplicate HIP check, a designated-count range set from the Phase 2 counts, and a check that every IAU name the bright file uses is unique.
- Meta (both files): `source` (`https://www.cosmos.esa.int/web/hipparcos/catalogues`), `url`, `mirror`, `file` (`I/239/hip_main.dat`), `sha256`, `bytes`, `rows`, `epoch` ("J1991.25 propagated to J2000 by proper motion; the ten stars without a solution keep their J1991.25 sexagesimal position"), `licence` ("CC BY-NC 3.0 IGO"), `attribution` ("Credit: ESA; ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200"), `commercialUse` ("requires ESA authorisation"), `positionFromSexagesimal` (the HIPs and Vmag of the ten stars at V ≤ 7.5 positioned from RAhms/DEdms, with the note "J1991.25, no proper motion, not propagated"), `fieldsUsed` (exactly `HIPPARCOS_FIELDS_USED`: HIP, Vmag, RAdeg, DEdeg, pmRA, pmDE, and RAhms, DEdms for the ten; the finder file stores no HIP, only the order the HIP tie-break gives, which the meta notes), `filter` (distinct strings for the two files, non-empty, no "Sol"), counts, `normalisations`, and for the names and designations an `inputs` list naming Wikidata (CC0 1.0) with its table's fetch date and counts and the IAU WGSN list (public domain names), with the table file names.
- `STARS_OUT_DIR` selects the output directory (default: the catalogue directory); the script prints the counts, the number of named stars and the number of designated stars.

#### 2. Build function tests

**File**: `scripts/lib/build-stars.test.mjs` (with the pure functions moved to `scripts/lib/stars-build.mjs` as needed)

**Intent**: Test what the script computes without the 53 MB download: ordering and tie-break by HIP, the 40-names-plus-Polaris rule with IAU names, designation joining, `Constellation` use, packing and run-length encoding against a few synthetic stars, and that the same input twice gives identical output strings.

**Contract**: small synthetic rows; no copies of the catalogue; includes a star whose designation was omitted by policy, a star with an IAU name but no Bayer, a star at an x.x5 magnitude pinning `Math.round(Vmag*10)`, and a sexagesimal-positioned star.

### Success Criteria:

#### Automated Verification:

- Build function tests pass: `npx vitest run scripts/lib/build-stars.test.mjs`
- A scratch run succeeds and prints 921 bright stars and 25,723 finder stars: `STARS_OUT_DIR=<scratch dir outside the repo> npm run stars:build`
- A second scratch run is byte-identical: the SHA-256 of all four scratch files is unchanged after re-running
- The scratch finder file's gzip is under the 160,000-byte test budget, and its size is recorded in the phase's note
- Lint passes with no warnings: `npx eslint --max-warnings 0 scripts/build-stars.mjs scripts/lib/`
- The whole unit suite still passes (the committed files are untouched): `npm test`

#### Manual Verification:

- The comparison of the scratch output with the committed HYG-era files (position offsets against the old file, named stars gained and lost, designated count, stars at the 4.5 and 7.5 thresholds) is reviewed and each difference is explained by the research (non-Hipparcos rows removed, 10 stars without a solution, 23 non-IAU names, designation omissions)
- In that comparison ν And and 24 UMa keep magnitude tenths 45, and the ten RAhms/DEdms stars are placed against the reference routes and the field of the example chart (M13 in Hercules, with α, ε, ν¹ and υ Coronae Borealis)

---

## Phase 4: Switch the committed files, consumers, tests and fixtures

### Overview

Regenerate into the catalogue directory and update everything that reads, pins or documents-by-test the star data, in one phase, so the suite is green at its end.

### Changes Required:

#### 1. Regenerate the four files

**File**: `src/lib/catalogue/bright-stars.json`, `bright-stars.meta.json`, `finder-stars.json`, `finder-stars.meta.json`

**Intent**: Commit the output of `npm run stars:build` against the pinned file; never edit by hand.

**Contract**: the diff is the generator's output only.

#### 2. Loaders and comments

**File**: `src/lib/catalogue/stars.ts`, `src/lib/catalogue/finder-stars.ts`, `src/lib/engine/parameters.ts` (comment at `:614`), `src/lib/engine/fixtures/finder-reference.ts` (comment at `:20`)

**Intent**: Move the count ranges to the new counts and replace HYG wording with Hipparcos wording; fix the meaning of `id` and the tie-break comments.

**Contract**: `FINDER_STAR_COUNT_RANGE` (25,741-25,841) is re-centred on 25,723 with the generator's margin; `BRIGHT_STAR_COUNT_RANGE` (915-935) already admits 921 and stays; `BrightStar.id` documented as the Hipparcos number; the duplicate-id error (`stars.ts:80`) says "Hipparcos number"; `StarDesignation.bayer` keeps the `Abc` / `Abc-n` form (so `bayerLetter` and the `GREEK` table are unchanged); `FinderStar.index` documented "ties by HIP number (not stored)".

#### 3. Polish and English names

**File**: `src/lib/catalogue/star-names.ts`

**Intent**: Every proper name the bright file now ships (IAU names, keyed by English name) has an entry in `STAR_NAMES.pl`; names Polish uses unchanged map to themselves, as the file's convention says.

**Contract**: new keys only for names that newly enter the top 40; existing established Polish forms are untouched.

#### 4. Provenance tests rewritten

**File**: `src/lib/catalogue/stars.test.ts`, `src/lib/catalogue/finder-stars.test.ts`

**Intent**: Replace the HYG commit and "CC BY-SA 4.0" assertions with the new provenance, and add the independent checks the old tests lacked.

**Contract**:

- Provenance: both metas carry the pinned SHA-256 (written in the test, as the old commit was), `licence` "CC BY-NC 3.0 IGO", an `attribution` containing "Credit: ESA" and "SP-1200", distinct non-empty `filter` strings, the same `url` across the pair, and `fieldsUsed` in both metas equal to the exact list in the ESA email (HIP, RAdeg, DEdeg, Vmag, pmRA, pmDE, and RAhms, DEdms for the ten stars).
- Independent positions: a handful of stars (Sirius, Arcturus, Vega, Procyon, Capella, α Cen A and Polaris at the finder file's tolerance) located at published J2000 coordinates, each reference with at least two sources named in the test, within 3″ for the bright file and within the finder packing floor (about 25″) for the finder file; at least one reference star has a proper motion large enough (Arcturus, about 20″ of propagation) to fail an unpropagated build.
- Constellations pinned for known stars (Sirius CMa, Polaris UMi, Vega Lyr, Betelgeuse Ori, a Serpens star, two stars near a boundary), and a plausible designated count and Bayer/Flamsteed counts (ranges from the Phase 2 counts).
- No two finder stars closer than 5″ (Hipparcos has none; this catches a duplicate-dot regression like HYG's second Capella).
- The meta `filter` check the build's leak guard relies on, as a test.
- The ten stars positioned from RAhms/DEdms are present: HIP 55203 (Alula Australis) and HIP 78727 (ξ Sco) appear in the bright file at their sexagesimal positions, and the meta's `positionFromSexagesimal` lists exactly the ten HIP numbers (31067, 31500, 34716, 50572, 52800, 55203, 59273, 78727, 80579, 115125).
- The existing `formatDesignation` assertions (Mirach, Sulafat, Vega, Sirius, the Greek-abbreviation scan) stay unchanged and must pass, and so must the nearest-bright-star name check (`finder-stars.test.ts:45-74`, which holds while both files take their names from the same IAU table).

#### 5. Explainer chart and fixtures

**File**: `src/lib/finder/example-chart.ts` (generated block), `src/lib/finder/steps.test.ts`, `src/components/design/finder-samples.test.ts`

**Intent**: Regenerate the committed explainer chart from the new file and check that the route is the same star path before accepting it.

**Contract**: run `EXAMPLE_CHART_REGENERATE=1 npx vitest run src/lib/finder/example-chart.test.ts`, then `npx prettier --write src/lib/finder/example-chart.ts`; confirm the start star is still Alphecca (α CrB, magnitude ≤ 2.5) and the hop stars are the same stars before keeping it. The sentences in `steps.test.ts:88-97` and the "Mirach (β And)" check in `finder-samples.test.ts:15` are edited only if the regenerated route genuinely changed. If a published-hop reference (`finder.test.ts:905-960`) or the coverage gate (`finder.test.ts:1044-1105`) fails, stop: the fixture is not edited; report the star, the magnitude rounding or the missing designation to the owner as an engine or data finding.

### Success Criteria:

#### Automated Verification:

- The whole unit suite passes: `npm test`
- Type check passes: `npx astro check`
- Lint passes with no warnings: `npm run lint`
- Published-hop references and the coverage gate pass without any fixture edit: `npx vitest run src/lib/engine/finder.test.ts`
- The explainer chart test passes after regeneration and the start star is still Alphecca: `npx vitest run src/lib/finder/example-chart.test.ts src/lib/finder/steps.test.ts`
- The finder file's gzip is under the 160,000-byte budget on the real build output: `npx vitest run src/lib/catalogue/finder-stars.test.ts`
- The production build passes, including the star-data leak check: `npm run build`
- Since Phase 3, the diff touches only the four generated files, the files listed in this phase and the example chart: `git diff --stat <phase-3-commit>..HEAD`

#### Manual Verification:

- A local preview shows Tonight's live sky with the star field and a labelled bright-star set, and one finder chart (for example M13) with its start star and hops, without a visible hole, duplicate star or wrong constellation label; two screenshots are saved next to the plan review notes

---

## Phase 5: Notices, attribution, docs and the PR

### Overview

Make every notice say what the files now are, add the credits ESA was promised, update the project docs, run the full gates and open one PR.

### Changes Required:

#### 1. Data licence

**File**: `src/lib/catalogue/LICENSE-DATA.md`

**Intent**: Rewrite the "Star catalogues (HYG)" section for the new source: the files are Adapted Material of the Hipparcos Catalogue V1 (ESA 1997, ESA SP-1200, CC BY-NC 3.0 IGO, "Credit: ESA"), commercial use needs ESA's written authorisation and until then the files must not be used to generate financial gain; designations from Wikidata (CC0) and names from the IAU WGSN (public domain); the changes made; the pin; that HYG is no longer a source and the files are no longer CC BY-SA; the field list used from the file, including RAhms/DEdms for the ten stars without a solution; and that rendered finder charts are derived from NC data.

**Contract**: replaces lines 31-65 (the HYG section including its "Upstream: Hipparcos" subsection at 54-65; "Meteor showers" starts at 67) and the note the docs PR (#186) added there, and lists the fields used from the file (`fieldsUsed`); the OpenNGC and meteor sections are untouched.

#### 2. Attribution and the landing credit

**File**: `src/components/tonight/Attribution.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`, `src/components/Welcome.astro`

**Intent**: Remove the HYG credit; keep "Hipparcos, Credit: ESA (CC BY-NC 3.0 IGO)" and add the citation "ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200", a credit for the designation sources (Wikidata CC0, IAU WGSN), and render the credit on the landing page.

**Contract**: new keys under `tonight.attribution` in both locales (parity test); the header comment of `Attribution.astro` updated; `Welcome.astro` renders `<Attribution />` at its foot (no new component, no raw size or colour); the line wraps within 320-360 px without sideways scroll in both locales, and the landing e2e (or a new one-line spec) asserts that the signed-out `/` contains "Credit: ESA".

#### 3. Project docs

**File**: `CLAUDE.md` (`AGENTS.md` is a symlink), `context/foundation/prd.md`, `context/handoff.md`

**Intent**: Bring the tripwires, the catalogue paragraph, the PRD figures and the handoff in line.

**Contract**: `CLAUDE.md` lines for the star counts, the two "never edit" tripwires, the `stars:build` comment, the Catalogue paragraph, the star-name exception and the credits sentence now name Hipparcos V1, the pin and ESA's condition, and mention `stars:designations` and `scripts/data/`; the PRD's star-file sentence (about 25,791 stars from HYG, with its stale gzip figure) and Open Question 21 note the switch as done; `context/handoff.md` replaces "awaits the reply" and the SAO fallback wording with the state (ESA's reply received, V1 direct in place, owner sends the follow-up, no payment before ESA authorises). The roadmap's S-08 row does not exist on this branch until the docs PR (#186) merges; the status flip to `done` is made when this change is archived, not here.

#### 4. Pull request

**Intent**: Open one PR from `feat/star-source-switch`; the owner merges. Rebase onto main first if #186 has merged, since both touch the PRD, `LICENSE-DATA.md` and the roadmap.

### Success Criteria:

#### Automated Verification:

- i18n parity and the whole unit suite pass: `npm test`
- Type check and lint pass: `npx astro check` and `npm run lint`
- Formatting passes on the changed Markdown and JSON: `npx prettier --check` on the changed files
- The full e2e suite passes against a fresh production preview and the local stack, counts reported in the PR: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run test:e2e` against a fresh `npm run build` preview (port 4337, forecast fixture 4403), the local stack's values inline and never exported (lessons: run the whole suite before a PR)
- The smoke walk passes against local Supabase: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> BASE_URL=<preview URL> npm run smoke`
- No HYG reference remains outside archives and history: `grep -rn "HYG" src scripts CLAUDE.md` finds only the comments that explain the switch

#### Manual Verification:

- The credit line reads correctly and the landing footer renders in English and Polish on Tonight, a finder chart and the signed-out landing at 320 and 360 px, without sideways scroll
- The PR description states the counts, the ten stars positioned from RAhms/DEdms, the Polish and non-IAU name changes, and that no payment is enabled

---

## Testing Strategy

### Unit Tests:

- Reader: record parsing, blanks, propagation, pin verification and one combined failure-mode test (synthetic records, injected fetch).
- Designations: normalisation of all 24 letters and superscripts, rejection rules, the omit-when-in-doubt policy, overrides with sources, WGSN table shape guard.
- Build: ordering by HIP, naming rule, designation join, constellation, packing and runs, determinism.
- Catalogue: provenance, independent published positions (propagation-sensitive), constellation pins, designation counts, no near-duplicate stars, unchanged `formatDesignation` behaviour.

### Integration Tests:

- The existing published-hop references and the coverage gate over the new star file; the explainer chart's deep-equal test after regeneration.
- The full e2e suite and the smoke walk (finder gate steps need no star text).

### Manual Testing Steps:

1. Run `node scripts/hipparcos-source-check.mjs` and compare the printed hash with the pin.
2. Open the preview, look at the live sky and an M13 finder chart, compare with production's look.
3. Read the credit line in both languages at 360 px, including the landing.

## Performance Considerations

- The finder file's gzip is estimated at about 119,000 bytes without designations plus 17,800-26,100 with them, under the 160,000 test budget (`research.md` §6); the phase 3 and 4 criteria measure the real file.
- The bright file is browser-delivered; its size changes by a few hundred bytes (fewer stars, longer IAU names).
- The star build reads a 53 MB file and holds 118 k rows in memory; it is a manual command, not part of CI or `postbuild`.

## Migration Notes

- Nothing is stored per user from the star files; HYG ids appear in no database row, URL or e2e spec (the bright `id` is a transient label key), so no data migration is needed.
- Reverse path: `git revert` of the Phase 4 commit restores the HYG-era files (the HYG pin stays in history); the SAO route is a separate change.

## References

- Related research: `context/changes/star-source-switch/research.md`
- Licensing basis: `context/foundation/licensing/esa-reply-assessment-2026-10-16.md`, PRD Open Question 21, roadmap M-4 S-08 (GitHub #185, docs PR #186)
- Generator: `scripts/build-stars.mjs:97-105,195-203,260-266`
- Tie-break dependence: `src/lib/engine/finder.ts:574`
- Leak guard: `scripts/build-sw.mjs:94-110`
- Explainer chart regeneration: `src/lib/finder/example-chart.ts:12-22`, `example-chart.test.ts:122-126`
- Published-hop references: `src/lib/engine/finder.test.ts:905-960,1044-1105`
- Lessons applied: `context/foundation/lessons.md` (size budgets on shipped encodings; failing reference is an engine finding)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pinned Hipparcos reader

#### Automated

- [x] 1.1 Reader tests pass: `npx vitest run scripts/lib/hipparcos.test.mjs` — 2bcff3d
- [x] 1.2 Lint passes with no warnings on the new files: `npx eslint --max-warnings 0 scripts/lib/hipparcos.mjs scripts/lib/hipparcos.test.mjs scripts/hipparcos-source-check.mjs vitest.config.ts eslint.config.js` — 2bcff3d
- [x] 1.3 The pinned file verifies and counts match: `node scripts/hipparcos-source-check.mjs` reports 118,218 rows, 921 stars at V ≤ 4.5 and 25,723 at V ≤ 7.5, and lists the ten stars positioned from RAhms/DEdms — 2bcff3d
- [x] 1.4 The whole unit suite still passes: `npm test` — 2bcff3d

### Phase 2: Designation source data

#### Automated

- [ ] 2.1 Designation helper tests pass: `npx vitest run scripts/lib/designations.test.mjs`
- [ ] 2.2 The regeneration script completes and writes both tables: `npm run stars:designations`
- [ ] 2.3 Table counts are plausible: at least 3,100 designated stars, 1,400 Bayer values and 2,500 Flamsteed values in `star-designations.json`, and at least 500 HIPs in `iau-star-names.json`
- [ ] 2.4 The transform is deterministic: with the raw responses saved by the live run, `npm run stars:designations -- --from-raw <scratch dir>` run twice gives byte-identical tables (`cmp`)
- [ ] 2.5 Lint passes with no warnings on the new files: `npx eslint --max-warnings 0 scripts/lib/designations.mjs scripts/lib/designations.test.mjs scripts/build-star-designations.mjs`
- [ ] 2.6 The whole unit suite still passes: `npm test`

#### Manual

- [ ] 2.7 `designation-check.md` shows every disagreement with the HYG-era table and the decision taken for it, and no designation was guessed
- [ ] 2.8 Ten stars from the table (five Bayer, five Flamsteed, including one multi-value star) are confirmed against a published source named in `designation-check.md`
- [ ] 2.9 Every route star of the published-hop references and the example chart's designated stars resolves to a HIP with identical `bayer` / `flamsteed` / `con`, recorded in `designation-check.md`

### Phase 3: Build script on the new source

#### Automated

- [ ] 3.1 Build function tests pass: `npx vitest run scripts/lib/build-stars.test.mjs`
- [ ] 3.2 A scratch run succeeds and prints 921 bright stars and 25,723 finder stars: `STARS_OUT_DIR=<scratch dir outside the repo> npm run stars:build`
- [ ] 3.3 A second scratch run is byte-identical: the SHA-256 of all four scratch files is unchanged after re-running
- [ ] 3.4 The scratch finder file's gzip is under the 160,000-byte test budget, and its size is recorded in the phase's note
- [ ] 3.5 Lint passes with no warnings: `npx eslint --max-warnings 0 scripts/build-stars.mjs scripts/lib/`
- [ ] 3.6 The whole unit suite still passes (the committed files are untouched): `npm test`

#### Manual

- [ ] 3.7 The comparison of the scratch output with the committed HYG-era files (position offsets against the old file, named stars gained and lost, designated count, stars at the 4.5 and 7.5 thresholds) is reviewed and each difference is explained by the research (non-Hipparcos rows removed, 10 stars without a solution, 23 non-IAU names, designation omissions)
- [ ] 3.8 In that comparison ν And and 24 UMa keep magnitude tenths 45, and the ten RAhms/DEdms stars are placed against the reference routes and the field of the example chart (M13 in Hercules, with α, ε, ν¹ and υ Coronae Borealis)

### Phase 4: Switch the committed files, consumers, tests and fixtures

#### Automated

- [ ] 4.1 The whole unit suite passes: `npm test`
- [ ] 4.2 Type check passes: `npx astro check`
- [ ] 4.3 Lint passes with no warnings: `npm run lint`
- [ ] 4.4 Published-hop references and the coverage gate pass without any fixture edit: `npx vitest run src/lib/engine/finder.test.ts`
- [ ] 4.5 The explainer chart test passes after regeneration and the start star is still Alphecca: `npx vitest run src/lib/finder/example-chart.test.ts src/lib/finder/steps.test.ts`
- [ ] 4.6 The finder file's gzip is under the 160,000-byte budget on the real build output: `npx vitest run src/lib/catalogue/finder-stars.test.ts`
- [ ] 4.7 The production build passes, including the star-data leak check: `npm run build`
- [ ] 4.8 Since Phase 3, the diff touches only the four generated files, the files listed in this phase and the example chart: `git diff --stat <phase-3-commit>..HEAD`

#### Manual

- [ ] 4.9 A local preview shows Tonight's live sky with the star field and a labelled bright-star set, and one finder chart (for example M13) with its start star and hops, without a visible hole, duplicate star or wrong constellation label; two screenshots are saved next to the plan review notes

### Phase 5: Notices, attribution, docs and the PR

#### Automated

- [ ] 5.1 i18n parity and the whole unit suite pass: `npm test`
- [ ] 5.2 Type check and lint pass: `npx astro check` and `npm run lint`
- [ ] 5.3 Formatting passes on the changed Markdown and JSON: `npx prettier --check` on the changed files
- [ ] 5.4 The full e2e suite passes against a fresh production preview and the local stack, counts reported in the PR: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> npm run test:e2e` against a fresh `npm run build` preview (port 4337, forecast fixture 4403), the local stack's values inline and never exported (lessons: run the whole suite before a PR)
- [ ] 5.5 The smoke walk passes against local Supabase: `SUPABASE_URL=<API_URL> SUPABASE_SECRET_KEY=<SECRET_KEY> BASE_URL=<preview URL> npm run smoke`
- [ ] 5.6 No HYG reference remains outside archives and history: `grep -rn "HYG" src scripts CLAUDE.md` finds only the comments that explain the switch

#### Manual

- [ ] 5.7 The credit line reads correctly and the landing footer renders in English and Polish on Tonight, a finder chart and the signed-out landing at 320 and 360 px, without sideways scroll
- [ ] 5.8 The PR description states the counts, the ten stars positioned from RAhms/DEdms, the Polish and non-IAU name changes, and that no payment is enabled
