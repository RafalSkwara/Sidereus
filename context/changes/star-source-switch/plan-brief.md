# Star Source Switch — Plan Brief

> Full plan: `context/changes/star-source-switch/plan.md`
> Research: `context/changes/star-source-switch/research.md`

## What & Why

Replace the star source of both star files (925 bright stars shipped to browsers, 25,791 finder stars kept on the server) from HYG v4.1, a third party's compilation of ESA's Hipparcos data, with the Hipparcos Catalogue Version 1 read directly from a pinned, checksummed download. ESA cannot authorise HYG-derived files but has offered to assess V1 used directly (PRD Open Question 21), and the owner decided on 2026-10-16 that the app must be ready to take payments. V1 is CC BY-NC 3.0 IGO, fine while the app is free; no payment is taken until ESA authorises in writing.

## Starting Point

`scripts/build-stars.mjs` streams HYG's CSV from a pinned commit and writes both pairs of files, sorted by magnitude then HYG id; HYG supplies the positions, names, Bayer and Flamsteed designations and constellations. Tests pin the HYG commit and licence, an example chart is generated from the real file, and the finder's published-hop references match HYG-format Bayer strings.

## Desired End State

`npm run stars:build` reads the pinned `hip_main.dat`, verifies it before writing anything, and regenerates the four files byte-identically. Positions come from Hipparcos propagated to J2000, designations from a committed Wikidata (CC0) table, names from the IAU WGSN list, constellations from `astronomy-engine`. Nothing depends on HYG. The charts and live sky behave as before, the credits ESA was promised ("Credit: ESA" plus the SP-1200 citation) appear on every view that draws stars, including the landing page, and `LICENSE-DATA.md` says what the files now are.

## Key Decisions Made

| Decision                                 | Choice                                                                                                                                                  | Why (1 sentence)                                                                                       | Source          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------- |
| Source file and pin                      | `hip_main.dat` from CDS, SHA-256 + bytes + rows pinned, Harvard mirror as one retry                                                                     | Two downloads and a mirror gave identical bytes; the file is unchanged since 1997                      | Research        |
| Epoch                                    | Linear propagation J1991.25 → J2000 over 8.75 years                                                                                                     | Agrees with rigorous propagation to 0.007″; HYG's positions are already propagated                     | Research        |
| Ids and tie-break                        | HIP number; sort by magnitude then HIP                                                                                                                  | The finder index is the sort position and the engine tie-breaks on it                                  | Plan            |
| Stars without a solution (10 at V ≤ 7.5) | Positioned from RAhms/DEdms of the same file, unpropagated, listed in the meta                                                                          | Owner decision: keeps Alula Australis and ξ Sco on the chart; the ESA draft lists the two extra fields | Owner           |
| Used fields                              | `HIPPARCOS_FIELDS_USED` exported, the only way the parser reads the file, written to both metas as `fieldsUsed` and pinned against the ESA email's list | The build cannot silently read a field ESA was not told about                                          | Review          |
| Designations                             | Committed table from Wikidata, omitted when in doubt, overrides need a citable source                                                                   | ~97 % of today's designations carry over; a wrong designation is worse than a missing one              | Research + Plan |
| Proper names                             | IAU WGSN only                                                                                                                                           | Public domain; 23 non-IAU HYG names (e.g. Lalande 21185) disappear                                     | Research + Plan |
| Constellation                            | `astronomy-engine` `Constellation()`                                                                                                                    | 0 mismatches against HYG's `con` for all 3,342 designated stars                                        | Research        |
| Build stays offline for names            | No live Wikidata/IAU query, manual regeneration script, no CI download                                                                                  | Deterministic output; Wikidata drifts                                                                  | Plan            |
| Vector precision                         | Unchanged (5 decimals)                                                                                                                                  | Keeps the change to the source; the known Polaris offset is pre-existing                               | Plan            |
| Landing credit                           | Render the existing `Attribution` as the footer of the signed-out landing page                                                                          | The ESA draft promises the credit on every view that draws stars                                       | Owner           |

## Scope

**In scope:** pinned reader, designation tables and their regeneration script, rewritten `build-stars.mjs`, regenerated files, loaders, tests and fixtures, example chart, attribution and notices, project docs, one PR.

**Out of scope:** Gaia DR3, Tycho-2, SAO, payments or any commercial enablement, the lawyer check, a landing screenshot recapture, a CI download, changes to vector precision, PR merge (owner only).

## Architecture / Approach

Build the inputs first behind tests: a verified Hipparcos reader, then the designation tables (using the reader's positions for the constellation filter), then the rewritten build run into a scratch directory and compared with today's files. Only then regenerate the committed files and update every consumer, test and fixture in one phase so the suite is never red between phases; finish with notices, docs and the PR.

## Phases at a Glance

| Phase                                       | What it delivers                                                                                        | Key risk                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1. Pinned Hipparcos reader                  | Verified download, parser, propagation, source-check command                                            | Pin mismatch or a CDS change                              |
| 2. Designation source data                  | Wikidata and IAU tables, overrides, regeneration script, comparison with today's table                  | Wikidata gaps and conflicts; the IAU page is HTML         |
| 3. Build script on the new source           | Rewritten generator, scratch run, byte-identical and size checks                                        | Counts, gzip budget, name set changes                     |
| 4. Switch files, consumers, tests, fixtures | Committed new files, rewritten provenance tests, independent position checks, regenerated example chart | Reference hops and the coverage gate flipping on rounding |
| 5. Notices, attribution, docs, PR           | LICENSE-DATA, credits (including the landing), CLAUDE.md, PRD, handoff, full gates, PR                  | Merge conflicts with docs PR #186                         |

**Prerequisites:** docs PR #186 (PRD, LICENSE-DATA, roadmap S-08) merged, or a rebase afterwards; `npm ci` done; local Supabase for the e2e and smoke gates.
**Estimated effort:** about 5 sessions across 5 phases.

## Open Risks & Assumptions

- The ten stars without a solution use their J1991.25 sexagesimal positions unpropagated (no proper motion exists for them); the ESA reply draft discloses the two extra fields.
- About 1 % of today's designations are lost to the omit-when-in-doubt rule; five Flamsteed conflicts with HYG are unresolved until checked against a citable source.
- If a published-hop reference or the coverage gate fails on rounding at 3.5 or 4.5, the fixture is not edited; the finding goes to the owner.
- The exopla IAU page has no CSV, so its HTML shape is guarded and may need a fix when it changes.
- The ESA reply draft says "about 925 stars"; the real bright count is 921 with the ten sexagesimal stars (still "about").

## Success Criteria (Summary)

- The four star files regenerate byte-identically from the verified pinned file with no HYG input, and the whole unit, type, lint, build, e2e and smoke gates pass.
- The finder charts and live sky look and behave as before, with independent published-position checks proving the epoch handling.
- Every notice (data licence, attribution on every star-drawing view, project docs) states Hipparcos V1, CC BY-NC 3.0 IGO and "no commercial use until ESA authorises".
