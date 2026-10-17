---
date: 2026-10-16T21:40:07+02:00
researcher: herdr agent "stars" (Sonnet 5.5, high effort), four Sonnet read-only workers
git_commit: b6eb4f352ad503c25f830f9f637d86b994d151b6
branch: feat/star-source-switch
repository: Sidereus
topic: "Switch the star files from HYG v4.1 to Hipparcos Version 1 (VizieR I/239) read directly, with designations from CC0 and IAU sources"
tags: [research, catalogue, stars, hipparcos, licensing, build-stars, finder-chart]
status: complete
last_updated: 2026-10-16
last_updated_note: "Follow-up: owner decision on the ten rows without an astrometric solution (RAhms/DEdms)"
last_updated_by: herdr agent "stars"
---

# Research: star-source-switch (HYG v4.1 to Hipparcos V1 direct)

**Date**: 2026-10-16T21:40:07+02:00
**Researcher**: herdr agent "stars" (four Sonnet read-only workers; the parent read `scripts/build-stars.mjs` and `lessons.md` itself)
**Git Commit**: b6eb4f352ad503c25f830f9f637d86b994d151b6 (origin/main at the start; the docs PR #186 is separate)
**Branch**: feat/star-source-switch
**Repository**: Sidereus

## Research Question

Lean research for roadmap M-4 S-08 (GitHub #185). Licensing is settled by `context/foundation/licensing/esa-reply-assessment-2026-10-16.md` §2-§3 and the owner's decision of 2026-10-16, so it is not re-researched. This document answers, for `/10x-plan`:

1. The I/239 `hip_main.dat` file format.
2. The epoch propagation J1991.25 to J2000.
3. Designations from Wikidata (CC0) and the IAU WGSN names, and the constellation through `astronomy-engine`.
4. The star count and the fixture impact.
5. A reproducible download of `hip_main.dat` with a pinned checksum.

Method: workers ran scratch scripts with node `fetch` (User-Agent carries only the repository URL, no personal data) on 2026-10-16, each download in its own empty directory under the session scratchpad. Nothing in the checkout was changed. Numbers below come from those scripts unless a repo `file:line` is cited. Measurements by a worker are marked "measured" and the claims about what the data means are inference.

## Summary

- **Format.** `hip_main.dat` is 118,218 fixed-width records of 450 characters plus LF (53,316,318 bytes), pipe-delimited at the same byte positions in every row. Splitting a line on `|` gives index 1 = HIP, 5 = Vmag, 8 = RAdeg, 9 = DEdeg, 12 = pmRA, 13 = pmDE. Positions are ICRS at epoch J1991.25 (ReadMe). It has no Bayer, Flamsteed, proper-name or constellation field, only HIP, CCDM, HD and BD identifiers.
- **Download and pin.** `https://cdsarc.cds.unistra.fr/ftp/cats/I/239/hip_main.dat` is served uncompressed over HTTPS. Two independent downloads (CDS and the Harvard VizieR mirror) gave the identical SHA-256 `58ceabb104d647160d9437ce6e513a02a036bb4ad9f8879a5a22fd52943616e0`, 53,316,318 bytes and 118,218 rows. The server's Last-Modified is 1997-06-24. ESA does not host the file; its page points to CDS.
- **Epoch.** Linear propagation by 8.75 years is adequate: against a rigorous space-motion propagation the largest disagreement over the 25,713 stars at V ≤ 7.5 is 0.007″ with zero radial velocity, and at most 0.109″ under an assumed ±500 km/s. It matters: 6 stars at V ≤ 7.5 move by more than the finder file's 0.01° step (36″) and 136 of the 919 bright stars by more than the bright file's 2″ vector precision. HYG's committed positions are already propagated for most stars (842 of 919 bright unit vectors are identical to the propagated Hipparcos vector), so the switch changes positions very little.
- **Counts.** Hipparcos yields 919 stars at V ≤ 4.5 and 25,713 at V ≤ 7.5, among rows that have RAdeg/DEdeg. HYG has 925 and 25,791. The difference is HYG's non-Hipparcos rows (Gliese/Yale companions and a second Capella entry), not a magnitude difference: HYG's `mag` equals Hipparcos Vmag to 2 decimals for 919 of the 920 matched bright stars.
- **Designations.** Wikidata (CC0) carries them as property P528 with a P972 catalogue qualifier (HIP, Bayer, Flamsteed). Joined by position to HYG's 3,307 stars with a Bayer or Flamsteed designation, 3,197 match and 110 do not; the Bayer agrees in 1,470 of 1,471 compared, and 5 of 2,642 Flamsteed values disagree. A label fallback rescues most of the 110 (combined coverage about 99 %). The build must not query Wikidata live. A committed, reviewed table keyed by HIP (about 3,215 entries, 61-74 KB raw) is the right shape.
- **Names.** The IAU WGSN list is public domain for the names themselves. All 41 names shipped today exist in it with identical spelling. Only the page `exopla.net` is current (HTML table, 567 rows with a HIP); the stable `IAU-CSN.txt` is dated 2022-04-04 (411 rows with a HIP). 23 of HYG's 377 finder proper names are not IAU names and will go.
- **Constellation.** `astronomy-engine`'s `Constellation(ra_hours, dec_deg)` agreed with HYG's `con` for all 3,342 designated finder stars (0 mismatches, positions quantised to 0.01°) and costs about 14 ms for 25,791 calls.
- **Size.** The position-and-magnitude part of the Hipparcos finder file gzips to about 119,080 bytes, so about 40,900 bytes of the 160,000-byte test budget remain for designations. The HYG designations cost about 26,100 gzip bytes; the Wikidata-only table is about 17,800.
- **Fixtures.** Every star-pinned test is listed in the Fixture and test impact section. The decisive ones are `example-chart.test.ts` (embeds finder indices), the finder reference hops (HYG-format Bayer strings), and the provenance assertions in `stars.test.ts` and `finder-stars.test.ts`. There is no independent position check today, which the switch needs.
- **Decisions the plan must settle** (see Open Questions): the 10 positionless rows at V ≤ 7.5 (two are naked-eye stars), how many proper names to keep, the Flamsteed conflicts, and where the designation source file lives.

## Detailed Findings

### 1. The I/239 file (`hip_main.dat`)

- Layout, from the CDS ReadMe (`https://cdsarc.cds.unistra.fr/ftp/cats/I/239/ReadMe`, read in full by the format worker; the ReadMe states Lrecl 450 and 118,218 records, matching the file). Every one of the 118,218 rows has `|` at the same 77 byte positions (measured).

  | Field | Bytes (1-based) | Index after `split("|")` | Format and unit | Note |
  | --- | --- | --- | --- | --- |
  | HIP (H1) | 9-14 | 1 | I6, space-padded | Rows are in RA order, not HIP order (4,048 inversions, measured) |
  | Vmag (H5) | 42-46 | 5 | F5.2, mag, Johnson V | the "visual magnitude" field |
  | RAdeg (H8) | 52-63 | 8 | F12.8, degrees | ICRS, epoch J1991.25 |
  | DEdeg (H9) | 65-76 | 9 | F12.8, degrees | ICRS, epoch J1991.25 |
  | pmRA (H12) | 88-95 | 12 | F8.2, mas/yr | already multiplied by cos(dec) |
  | pmDE (H13) | 97-104 | 13 | F8.2, mas/yr | |

  The empirical worker derived the same indices from data rows (Sirius, Barnard's star) before the format worker's ReadMe reading; both agree.

- Epoch, quoted from the ReadMe: "right ascension and declination are expressed in degrees for epoch J1991.25 (JD2448349.0625 (TT)) in the ICRS (consistent with J2000)". Proper motions are at the same epoch.
- Blanks are spaces with the pipes kept; there is no sentinel value. Measured over the whole file: 263 rows have no RAdeg/DEdeg (no astrometric solution; they also lack parallax and proper motion, but keep approximate sexagesimal RAhms/DEdms at an unknown epoch), exactly 1 row lacks Vmag (HIP 120412, which also lacks a position), and no row has a position but no Vmag. No duplicate HIP numbers. HIP numbers are not dense: 138 rows exceed 118,218, up to 120,416.
- Multiplicity: components of a system are separate rows with their own HIP and position (alpha Cen A and B are HIP 71683 and HIP 71681); `Ncomp`/`m_HIP` flag them. The known errata (`https://cdsarc.cds.unistra.fr/ftp/cats/I/239/errata.htx`, revised 2005) name HIP 54738, 114110 and 114176 as non-real; they have V of about 12-13.5, far outside the 7.5 cut.
- Magnitude field: Vmag is right. `Hpmag` (H44) runs about 0.10 mag fainter on average (median Hp-V 0.104 over rows with V ≤ 7.5; 5th-95th percentile -0.03 to 0.17), so substituting it would change the set. Vmag for a variable star is the catalogue's mission-mean value (e.g. Mira, HIP 10826, V 6.47); 2,960 stars with V ≤ 7.5 fade past 7.5 at their minimum, which the HYG-era files share because HYG uses the same V (measured).
- Licence line in the ReadMe: "License: CC-BY-NC-3.0 IGO". The ReadMe has no separate "how to cite" section; its header gives `ESA, 1997, The Hipparcos Catalogue, ESA SP-1200` and bibcode `1997HIP...C......0E`, and lists Perryman et al. 1997, A&A 323, L49. (The citation the owner promised ESA, "ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200", is ESA's own wording from its catalogues page, as quoted in the assessment.) The VizieR landing page's citation text was not fetched.

### 2. Reproducible download and pin

- Measured on 2026-10-16 (about 19:30 UTC), two downloads with `Accept-Encoding: identity`:

  | Property      | Value                                                                                                      |
  | ------------- | ---------------------------------------------------------------------------------------------------------- |
  | Primary URL   | `https://cdsarc.cds.unistra.fr/ftp/cats/I/239/hip_main.dat` (200, Accept-Ranges, Content-Length present)   |
  | Mirror URL    | `https://vizier.cfa.harvard.edu/ftp/cats/I/239/hip_main.dat` (200, identical size and SHA-256)             |
  | Bytes         | 53,316,318 (= 118,218 × 451)                                                                               |
  | Rows          | 118,218, LF endings, no CR, all 450 characters                                                             |
  | SHA-256       | `58ceabb104d647160d9437ce6e513a02a036bb4ad9f8879a5a22fd52943616e0`                                         |
  | Last-Modified | Tue, 24 Jun 1997 23:25:15 GMT, ETag looks inode-derived (`32d8ade-314b580f04cc0`) and should not be pinned |

- There is no `hip_main.dat.gz` (404). `ftp://` URLs cannot be fetched by node; the plain-HTTP and `cdsarc.u-strasbg.fr` variants are not worth using (the HTTPS u-strasbg host reset the connection from node). The VizieR `asu-tsv` and `nph-Cat/txt.gz` endpoints give query results in other formats with no Content-Length, unsuitable for a pin. ESA's own page (`https://www.cosmos.esa.int/web/hipparcos/catalogues`) links to CDS and an ESASky TAP service (not tested), and does not host the file.
- Pin design the format worker recommends and the plan can adopt: constants for URL, mirror, SHA-256, byte length, row count and record length; fetch over HTTPS with identity encoding and reject any `Content-Encoding`; early abort when Content-Length differs from the pin; hash the raw bytes while streaming and parse into memory (118 k rows is small), write nothing until the stream ends and byte count, row count and hash all match; one retry on the mirror, with the hash alone deciding acceptance; never auto-update the pins; sort explicitly by HIP because the file is in RA order. `scripts/build-stars.mjs` already streams with `fetch` and `readline` (`scripts/build-stars.mjs:107-168`), so the fetch and line loop carry over; the CSV parser (`:49-81`) does not.
- Trade-off recorded by the worker: pinning the whole 53 MB file costs about 51 MB per fresh run (heavy for CI) but keeps the selection visible in the pin and allows changing the cut later; a pin on the derived extract's SHA-256 inside a test would add a byte-identical-output check. Whether CI runs the build at all is a plan question: today no workflow runs `stars:build` (the repo worker found no star step in `.github/workflows/ci.yml`).

### 3. Epoch propagation J1991.25 to J2000.0

- Formula the empirical worker tested: `dt = 8.75 yr`, `ra2000 = ra1991.25 + pmRA·dt / cos(dec) / 3.6e6` degrees, `dec2000 = dec1991.25 + pmDE·dt / 3.6e6` degrees (pmRA is already times cos(dec)).
- Shift over the 25,713 stars at V ≤ 7.5 with a solution (measured): p50 0.25″, p90 1.08″, p99 4.15″, p99.9 14.3″, max 61.76″ (HIP 57939, Groombridge 1830). Stars shifting by more than 36″ (one 0.01° step of the finder file): 6; more than 18″: 18; more than 5″: 184; more than 2″: 997.
- Over the 919 bright stars (V ≤ 4.5): p50 0.52″, p99 11.7″, max 35.8″ (HIP 19849). 136 shift by more than 2″ (the unit-vector precision of 5 decimals), 7 by more than 18″, none by more than 36″.
- Adequacy: against a rigorous unit-vector propagation with parallax, the maximum disagreement over all 25,713 stars is 0.007″ with radial velocity zero; the top high-proper-motion stars differ by at most 0.05″ with published radial velocities (from the worker's memory, so approximate), and a worst-case ±500 km/s over the whole set gives at most 0.109″. That is two to three orders of magnitude below the finder file's 18″ packing floor. Inference: linear propagation is adequate, and Barnard's star (HIP 87937, 90.6″) and Kapteyn's star (HIP 24186) are outside the set at V 9.54 and 8.86.
- No star with a solution lacks pmRA/pmDE (measured). Ten stars at V ≤ 7.5 have no solution (HIP 31067, 31500, 34716, 50572, 52800, 55203, 59273, 78727, 80579, 115125); they cannot be propagated and their sexagesimal positions are labelled J1991.25 by the ReadMe but cannot be verified or propagated (see the follow-up section).
- What HYG did (measured against the committed `bright-stars.json`): 842 of 919 matched bright unit vectors are identical to the vector from the propagated Hipparcos position, against 564 identical to the unpropagated one. Among the 38 stars shifting by more than 5″, 36 match the propagated position better, 23 exactly. About seven high-proper-motion stars (HIP 71681 and 71683 alpha Cen, 2021, 1599, 15510, 3821, 99240) deviate 5-18″ from both models; the worker had no HYG CSV and could not explain it. The finder file's offsets are dominated by the packing floor (p50 12.7″), which cannot tell the epochs apart.
- A pre-existing artefact the new build can avoid: Polaris in `bright-stars.json` (HYG id 11734) is about 40″ from the Hipparcos J2000 position because the unit vector is rounded to 5 decimals (`VECTOR_DIGITS = 5`, `scripts/build-stars.mjs:45`) and the declination error scales as 1e-5/cos(dec), with cos(dec) = 0.013 at Polaris. The finder file's Polaris is fine. Whether to change the digits is a plan decision; it changes the committed bright file's bytes either way.

### 4. Star counts: Hipparcos against HYG

- Measured counts (rows with RAdeg/DEdeg): V ≤ 4.5: 919; V ≤ 7.5: 25,713. HYG (committed `*.meta.json`): 925 and 25,791. Adding the 10 sexagesimal-only rows (no solution) gives 921 and 25,723.
- Bright set, 925 against Hipparcos: 920 HYG stars match a Hipparcos star one-to-one; 5 HYG rows have no Hipparcos counterpart at that magnitude (HYG ids 118360 mag 0.96, a second entry for Capella 12.9″ from HIP 24608; 118485 Castor B 2.85; 119131 mag 3.40, 11.4″ from HIP 84012; 118838 gamma Vir B 3.52; 118887 mag 3.95 near Mizar). The repo worker confirmed the six bright rows with HYG id ≥ 118322 are non-Hipparcos supplementary rows and that two of them sit within an arcminute of a brighter star, a duplicate dot on the live sky (`src/components/tonight/TonightSkyView.tsx:294-302`). One Hipparcos star is not in the bright file: HIP 78727 (xi Sco, V 4.16), which has no solution; HYG has its components at 4.8 and 5.0. The bright file loses 5-6 stars net (925 to 919); the ESA draft says "about 925" and needs no change.
- Finder set: 25,781 of 25,791 HYG stars have a Hipparcos star within 0.05°; 10 do not (Eta Carinae, which is not in Hipparcos, and nine others at V 6.0-7.3). 76 are HYG-only in a one-to-one match, mostly Gliese/Yale components of doubles whose Hipparcos entry carries the combined magnitude (60 within 30″ of a Hipparcos star). Matching on HYG mag against Vmag: median |dV| 0.02, p99 0.05 (the tenth-rounding floor); only 3 pairs differ by more than 0.1 (HIP 55203, 78727, 11736/11737).
- Threshold crossings: no matched pair crosses 4.5 on exact values. At the 7.5 limit the tenth-rounded finder file shows 1 crossing pair (HYG tenths 7.5 against HIP 11736, V 7.67). The finder code compares tenths only (`src/lib/engine/finder.ts`, per the repo worker), so rounding at a .x5 boundary can move a star across a start-star limit (4.5 / 3.5 / 2.5).
- Packed-cell collisions: 31 packed 0.01° cells hold more than one Hipparcos star (63 stars) against 67 in the HYG finder file; pairs closer than 5″: 0.

### 5. Designations: Wikidata (CC0), IAU names, constellation

**Wikidata** (fetched 2026-10-16, SPARQL against `query.wikidata.org`; licence quoted verbatim from `https://www.wikidata.org/wiki/Wikidata:Licensing`: "All structured data (i.e. the main, Property, Lexeme, and EntitySchema namespaces) is released into the public domain under Creative Commons Zero."):

- No dedicated Bayer, Flamsteed or Hipparcos property exists. The data is property P528 "catalog code" with qualifier P972 "catalog": Q537199 "Hipparcos Catalogue" (value `"HIP 5447"`), Q105616 "Bayer designation" (`"β And"`), Q111116 "Flamsteed designation" (`"43 And"`). Constellation is P59.
- Extract: 114,980 distinct HIP strings (about 97 % of Hipparcos' 118,218), 1,930 with a Bayer value (1,484 Greek, 447 Latin-letter such as "d Eri", which HYG's Greek-only set would drop), 2,745 with a Flamsteed value, 3,495 with either.
- Agreement with the committed HYG table, joined by J2000 position within 0.06° because the committed JSON stores no HIP ids: of 3,307 HYG stars with a Bayer or Flamsteed (the other 35 of 3,342 are proper-name-only), 3,197 matched a Wikidata designated star and 110 did not. Of 1,471 matched with a Bayer, 1,470 agree (1,443 exact, 27 differ only in the superscript, e.g. HYG "α¹ Cru" against Wikidata "α Cru"). Of 2,642 with a Flamsteed, 2,624 agree, 13 are missing (many Perseus stars) and 5 disagree ("41 Ori" against "43 Ori", "16 Dra" against "17 Dra", "8 Sex" against "9 Sex"); these five need a check against a printed source, not done.
- Label fallback (parsing English labels such as "Beta2 Capricorni" or "30 Sagittarii" of the HIP items, with the constellation from `Constellation()`): rescued 81 of the 109-110 gaps in one run (76 exact), leaving about 28 absent (e.g. μ Cen, γ¹ Vol); combined coverage about 99 %.
- Multi-value and quality problems: 10 Bayer HIPs and 14 Flamsteed HIPs have more than one value, mostly in a former constellation (HIP 677 = "α And" and "δ Peg"); filtering to a suffix equal to the computed constellation resolves 18 of 24 and leaves six for a hand-written override (ρ/ρ³ Ari, d/υ³ Eri, η/η² Dor, ζ/ζ² CrB, ξ/ξ² Cap, 1/11 Sgr). 129 of 4,696 values (2.7 %) carry a constellation other than today's boundary. Four Bayer values carry a component letter ("θ¹ Ori A/C/D", "α Cen A"). Three items have invalid coordinates (RA written into the Dec field), which makes `Constellation()` throw, so positions must come from Hipparcos, never from Wikidata. 1,863 of 2,038 Bayer claims carry no "stated in" reference and the edit history was not audited, so vandalism or drift cannot be excluded; a rerun of the label query already differed by one star between two runs.

**IAU WGSN names** (fetched 2026-10-16):

- `https://www.iau.org/public/themes/naming_stars/` now returns 404. The current list is the WGSN's own page `https://exopla.net/star-names/modern-iau-star-names/`: an inline HTML table (640 rows; 567 with a HIP, covering 566 distinct HIPs, the only duplicate being HIP 72105 with Pulcherrima and Izar; latest adoption 2026-09-22). It has no CSV for the star names, so it must be parsed from HTML. The stable file `https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt` is dated 2022-04-04 and has 451 rows, 411 with a HIP. Do not use `NEC.csv` (carries HR and HD numbers, apparently Bright Star Catalogue derived, licence unstated).
- Licence, quoted from the exopla page: "IAU-star names are free to use and not subject to copyright or intellectual property licensing; they are scientific standards (like the unit of measure "meter" or "light-year"), belong to the public domain and are not owned by anybody (neither the IAU nor WGSN)." Etymology texts and images on the page are CC BY, so they are not to be copied.
- All 41 names the bright file ships today exist with identical spelling in both lists (including Polaris HIP 11767, Rigil Kentaurus HIP 71683, Toliman HIP 71681). Of HYG's 377 finder proper names, 23 are not in the exopla table (non-IAU names such as "Castor B", "Graffias", "Lacaille 8760", "Lalande 21185", "Groombridge 1830") and 28 are not in the 2022 file; those names would vanish.
- The 40-name rule in the generator (`scripts/build-stars.mjs:41-44,187`) gives the brightest 40 named stars plus Polaris. Today 53 of the 925 bright stars at mag ≤ 2.5 carry no name (repo worker). With IAU names by HIP, the top-40 set changes; `STAR_NAMES.pl` has exactly 41 keys keyed by the English name (`src/lib/catalogue/star-names.ts`) and `stars.test.ts:34-37` requires every shipped name to have one, so each new bright name needs a Polish entry (or the plan keeps the current 41 as an explicit list).

**Constellation** (`astronomy-engine` 2.1.19, `package.json` `^2.1.19`, `node_modules` present in the worktree): `Constellation(ra_hours, dec_deg)` takes J2000 coordinates (RA wraps mod 24; Dec outside -90..90 throws a string, not an Error), precesses to B1875 and scans 346 boundary rows; the boundary data are Roman 1987, per its repo README citing CDS VI/42 (Delporte 1930 IAU boundaries). It returns `{symbol: "Ori", name, ra1875, dec1875}`. Measured: 25,791 calls take 13.6 ms; against HYG's `con` for all 3,342 designated finder stars it gives 0 mismatches (88 constellations occur; Serpens is a single "Ser" in both, 55 designated stars). Positions were quantised to 0.01° for that test, so a star within seconds of a boundary could differ at full precision (not tested).

**Normalisation** (the plan decides): the app shows `Greek[superscript] CON` with the 3-letter IAU abbreviation (`formatDesignation`, `src/lib/catalogue/finder-stars.ts:247-262`), never the Latin genitive. The stored tuple convention is `[bayer, flamsteed, con, proper]` with `bayer` HYG's 3-letter Greek abbreviation plus a `-n` component suffix (`Alp`, `Pi-1`; table at `finder-stars.ts:206-231`, `bayerLetter` at `:236-240`). The worker's mapping from Wikidata is α→Alp, β→Bet, γ→Gam, δ→Del, ε→Eps, ζ→Zet, η→Eta, θ→The, ι→Iot, κ→Kap, λ→Lam, μ→Mu, ν→Nu, ξ→Xi, ο→Omi, π→Pi, ρ→Rho, σ→Sig, τ→Tau, υ→Ups, φ→Phi, χ→Chi, ψ→Psi, ω→Ome, with superscript digits (including two-digit forms such as "ψ¹⁰ Aur") written as `-n`. The IAU table writes "τ2 Aqr" with an ASCII digit.

**Reproducibility (worker recommendation):** do not query Wikidata in the build. Commit a reviewed source table keyed by HIP (`{hip: [bayerAbbr|null, flamsteed|null]}`) plus an IAU name list (HIP to name) and an override file for the manual choices, with the query text, fetch date and counts in the file, and a separate regeneration script. A sample built from Wikidata alone (3,215 entries: 1,477 Bayer, 2,639 Flamsteed) is 60,765 bytes compact JSON (17,333 gzipped) and 73,627 bytes one entry per line (17,818 gzipped), against 97,558 bytes (23,545 gzipped) for HYG's current `designations` object; the label fallback, IAU names and overrides would add a few hundred entries. A VizieR TAP search for other Bayer/Flamsteed sources returned HTTP 503 twice, so no other CC0 source is established; none was found.

### 6. Size budget

- `finder-stars.test.ts` holds the gzip of `finder-stars.json` under 160,000 bytes (`GZIP_BUDGET_BYTES`, `finder-stars.test.ts:83`). The committed file gzips to 145,431 bytes by the empirical worker's measurement (the repo worker measured 146,440; the difference is the compression setting, both far below budget).
- The same encoding (the `pos` packing, tenths runs, `finderJson` layout) for Hipparcos with an empty designations table: 119,034 bytes gzip for the 25,713 stars with a solution, 119,080 with the 10 positionless rows, 119,051 unpropagated and 119,085 with ties ordered by position. So propagation and tie order move the size by tens of bytes. Designations add about 17,800 (Wikidata-only table) to about 26,100 (HYG's) gzip bytes, leaving about 14,800 bytes of the 160,000 unused even at HYG's designation size (160,000 - 119,080 - 26,100). Per `lessons.md:90-99`, the plan must still measure the real built file before committing a budget.

### 7. Fixture and test impact (repo inspection)

Everything below was read by the repo worker (excerpts, not full reads, for the engine tests); `file:line` anchors are theirs and are re-checkable.

- **Generator** `scripts/build-stars.mjs` (334 lines): source-specific are the header (`:3,12-18`), the pin constants (`:26-30`), `readStars` (`:107-168`), `parseCsvLine` (`:49-81`), the required columns (`:125`), `SOL_ID` (`:34,145,285,305`) and the HYG-supplied `proper/bayer/flam/con` (`:158-161`). Reusable are `requireNumber`/`round` (`:83-94`), `unitVector` (`:97-105`, takes RA in hours), the `pos` packing (`:195-203`), `finderJson` (`:260-266`) and the writers (`:318-324`). Count guards: 925 ± 10 and 25,791 ± 50 (`:36-40`); the bright named-count guard expects 41 names (`:41-44,273-275`). The designation guard throws when a designated star has no `con` or a non-integer Flamsteed (`:237-247`).
- **Meta** has no field for designation-source provenance or licence (`:277-316`); `scripts/build-sw.mjs:94-110` fails the build if the finder meta's `filter` string or the first 40 characters of `pos` appear in `dist/client`, so the new finder `filter` must stay non-empty and different from the bright one.
- **Order and index:** the finder `index` is the position in the sort by magnitude tenths then HYG id (`build-stars.mjs:212-213`). The engine's last tie-break is `a.star.index - b.star.index` (`src/lib/engine/finder.ts:574`), so the tie-break key (use HIP) can change which start star or hop is chosen. The bright file's `id` is the HYG id and is used only for the duplicate check, the sort tie-break, the label key `star-${star.id}` (`TonightSkyView.tsx:302`) and one test message (`stars.ts:15,46,77-83`).
- **Consumers to touch:** `stars.ts` (count 915-935 at `:26`, id comment `:15`), `finder-stars.ts` (count 25741-25841 at `:41`, comments `:8-11,18,30,40,235`), `star-names.ts` (41 Polish names), `src/lib/finder/load.ts:167-169,197-200` (designations), `src/components/design/finder-samples.ts` (loads the real file), `src/lib/engine/parameters.ts:614` and `src/lib/engine/fixtures/finder-reference.ts:20` (HYG wording in comments).
- **Tests that pin provenance and must be rewritten, not made green:** `stars.test.ts:7,23-27` (HYG commit, "CC BY-SA 4.0"), `finder-stars.test.ts:36-43` (same commit and URL for both metas, licence string, attribution contains "Credit: ESA").
- **Tests tied to the data:** `example-chart.test.ts:122-126` deep-equals `EXAMPLE_FINDER_CHART` and `EXAMPLE_STAR_DESIGNATIONS` against the engine's output from the real file, so any position, order, count, magnitude or designation change fails it until regenerated (`EXAMPLE_CHART_REGENERATE=1 npx vitest run src/lib/finder/example-chart.test.ts`, then prettier; documented at `example-chart.ts:12-22`). It embeds finder indices, and `steps.test.ts:88-97` and `finder-samples.test.ts:15` hard-code route sentences ("Find Alphecca (α CrB), magnitude 2.2…", "Mirach (β And)") that only change if the route changes. The published-hop reference (`src/lib/engine/fixtures/finder-reference.ts`, matcher `finder.test.ts:905-960`) matches route stars by HYG-format `bayer` strings and `con`, and its `bandReason` prose embeds HYG magnitudes near the limits (e.g. "ν And (4.5)", "μ And (3.9)", "γ Sge (3.5)"); a rounding flip at 3.5 or 4.5 could change a start star with correct positions. The coverage gate (`finder.test.ts:1044-1105`, hop share ≥ 0.97 over about 373 Bortle-3 object-nights, measured 1.0) must be re-run.
- **Not pinned to star data** (inspected): `tests/e2e/**`, `scripts/smoke.mjs` (finder steps are gate-only), and there are no `.snap` files.
- **Docs and notices mentioning HYG:** `LICENSE-DATA.md:31-62`, `Attribution.astro:3-4,19-28` (HYG link and "(CC BY-SA 4.0)" hard-coded in markup; i18n keys `tonight.attribution.starData` and `hipparcosCredit` are labels only, `en.ts:882-883`, `pl.ts:785-786`), `CLAUDE.md` lines 17, 28, 29, 62, 90, 96 (`AGENTS.md` is a symlink), PRD `:747` and item 21, `roadmap.md`, `context/handoff.md:51,71,90`. `.prettierignore:8-12` already covers the four generated files; `package.json:21` holds `stars:build`; `silent-catch-guard.test.ts:100` allowlists `finder-stars.ts` with count 1.
- **Distribution of today's designations** (committed `finder-stars.json`, 25,791 stars, 3,342 designated): flamsteed only 1,745; bayer + flamsteed 676; bayer only 544; bayer + flamsteed + proper 276; bayer + proper 39; proper only 35; flamsteed + proper 27. 377 carry a proper name (87 of them fainter than 4.5); 103 distinct Bayer strings; 88 constellations; no designated star lacks `con`. The bright file carries names only (41) and no designations.
- **Gaps with no test today:** no independent position check (both files come from one run, so the nearest-star test at `finder-stars.test.ts:45-66` compares them with each other, and a systematic epoch or unit error would pass); no check of computed constellations beyond four names; no check of designation counts beyond equality with themselves; no byte-identical regeneration test for the script; no duplicate or near-duplicate check in the bright list; no test that `Attribution` lists the credits in both locales.

## Code References

- `scripts/build-stars.mjs:26-30,107-168` - pin constants and the HYG streaming reader to replace.
- `scripts/build-stars.mjs:97-105,195-203,260-266` - reusable unit vector, `pos` packing and JSON layout.
- `scripts/build-stars.mjs:187,273-275` - the 40-name rule and its count guard.
- `src/lib/catalogue/finder-stars.ts:206-262` - Greek table, `bayerLetter`, `formatDesignation`.
- `src/lib/catalogue/stars.ts:15,26,46,77-83` - id meaning, count range and checks.
- `src/lib/engine/finder.ts:574` - index is the final tie-break.
- `src/lib/finder/example-chart.ts` (GENERATED block) and `example-chart.test.ts:122-126` - regeneration tripwire.
- `src/lib/engine/finder.test.ts:905-960,1044-1105` - published hops and coverage gate.
- `scripts/build-sw.mjs:94-110` - leak check that reads the finder meta `filter` and `pos`.
- `src/components/tonight/Attribution.astro:19-28` - hard-coded HYG and ESA credits.

## Architecture Insights

- The files are generated artefacts guarded by byte-identical regeneration (`scripts/build-stars.mjs:17`, CLAUDE.md tripwires), so the source pin, the sort order and the designation table must all be deterministic and explicit (HIP as the tie-break; no clock; no live network for designations).
- The finder `index` is both identity and a tie-break, which is why the sort key is a behavioural decision rather than a detail.
- Source data and generated output are separate concerns today only because HYG is one file. After the switch there are three inputs of different licences (Hipparcos, a designation table from Wikidata CC0, IAU names), so the meta needs a place to record each input's source, licence and fetch date; the generated files stop being CC BY-SA and become "CC BY-NC 3.0 IGO plus CC0 and public-domain inputs" (the assessment §3 option 1).
- Lessons applying: measure sizes on the shipped encoding (`lessons.md:90-99`); a failing reference is an engine finding, never a fixture edit (`lessons.md:79-88`), which constrains how the reference hops are handled if a route changes.

## Historical Context (from prior changes)

- `context/foundation/licensing/esa-reply-assessment-2026-10-16.md` §2-§3, §6 - licensing basis, the ranked options and the repo follow-ups (supported: the assessment's count estimate "≈25,713 stars ≤ 7.5 with a HIP number" and "925 unchanged, verify" are borne out for 25,713 and refuted for 925, which is 919 with a solution).
- `context/archive/2026-10-11-finder-chart/` (research §9 and §9.1, plan D-2, D-5, D-10) - the HYG choice and the SAO fallback measurement; archived and immutable, read by reference only. Its Tycho-2 filing under ESA is corrected in the PRD by PR #186.
- `context/foundation/prd.md` item 21 (as updated by PR #186) - the decision this change implements.

## Related Research

- `context/changes/ui-refine/` and `context/changes/error-visibility/` - not related.

## Open Questions

1. **Resolved 2026-10-16 (owner): option (b), see the follow-up section below.** **The 10 positionless rows at V ≤ 7.5** (no RAdeg/DEdeg, approximate RAhms/DEdms of unknown epoch). Two are naked-eye stars (HIP 55203 Alula Australis V 3.79 and HIP 78727 xi Sco V 4.16) and HIP 115125 is V 5.19. Dropping them keeps the declared fields exactly as in the draft to ESA (RAdeg, DEdeg, Vmag, pmRA, pmDE) but leaves a hole in the bright set (919 stars, not 921) and in HYG-era charts; using the sexagesimal fields is an additional ESA field and an unverified epoch. The plan must pick one and, if it uses RAhms/DEdms, tell the owner so ESA's request can be corrected. (Not verified: the epoch of those positions.)
2. **Proper names and the bright-file naming rule.** Keep the current 41 as an explicit list, or let the IAU list drive the brightest 40 (the set will change; each new name needs a Polish entry in `star-names.ts`). The 23 non-IAU HYG names (Lacaille 9352, Lalande 21185, Castor B, Graffias, …) disappear either way unless the owner wants a different source for them.
3. **Designation gaps.** About 1 % of today's designated stars (about 28 of 3,307) have no Wikidata value even after the label fallback, 13 Flamsteed numbers are missing, and 5 conflict with HYG ("41 Ori" against "43 Ori", "16 Dra" against "17 Dra", "8 Sex" against "9 Sex"). No printed source was checked, and no CC0 source for Bayer/Flamsteed by HIP other than Wikidata was found. The plan should accept the gaps explicitly (with a count guard) or add an override file whose entries are hand-verified against a source the repo may cite.
4. **Where the designation table lives and how it is refreshed:** a committed source file with its own regeneration script (the worker's recommendation) versus a one-off extraction. It also needs a licence line (Wikidata CC0, IAU names public domain) in `LICENSE-DATA.md` and the meta files.
5. **The pin's cost in CI.** The 53 MB file is not fetched in CI today because CI does not run `stars:build`; whether to add a CI check that regenerates and diffs (heavy, and the CDS mirror could be unavailable) or keep a local-only script with the pinned hash is a plan decision.
6. **Vector digits.** Whether to raise `VECTOR_DIGITS` above 5 to remove the 40″ Polaris offset; it changes the committed bright file but not behaviour elsewhere.
7. **Credit text.** `Attribution.astro` hard-codes HYG; the switch removes it, keeps "Hipparcos, Credit: ESA" and adds the SP-1200 citation (new keys in `en.ts` and `pl.ts`), and probably credits Wikidata (CC0, voluntary) and the IAU WGSN. The landing page's missing credit (`Welcome.astro`) is a separate pre-existing gap (PRD item 21).
8. **Not verified by the workers:** the Wikidata edit histories; the VizieR landing page's citation text; any reuse licence for I/239 beyond the ReadMe's "CC-BY-NC-3.0 IGO" line; the ESA FTP and the ESASky TAP service; the radial velocities used in the rigorous-propagation check (from memory); and why about seven high-proper-motion stars deviate 5-18″ from both propagation models in HYG's file.

## Follow-up (2026-10-16): the ten rows without an astrometric solution

Owner decision, relayed by the orchestrator on 2026-10-16: option (b), take the positions of the ten stars at V ≤ 7.5 that have no RAdeg/DEdeg from the sexagesimal fields RAhms and DEdms of the same file; the ESA reply draft was updated (docs PR #186) to list those two fields for the ten stars. This resolves Open Question 1 above.

- Field layout, from the ReadMe (`https://cdsarc.cds.unistra.fr/ftp/cats/I/239/ReadMe`, lines 116-117 of the copy fetched on 2026-10-16): RAhms is bytes 18-28, A11, "Right ascension in h m s, ICRS (J1991.25) (H3)"; DEdms is bytes 30-40, A11, "Declination in deg ' ", ICRS (J1991.25) (H4)". So the ReadMe labels them J1991.25, which corrects the earlier statement that their epoch is unknown: the label says J1991.25, but for these rows nothing verifies it (no proper motion or parallax exists to propagate with).
- Measured on the ten rows (HIP 31067, 31500, 34716, 50572, 52800, 55203, 59273, 78727, 80579, 115125): RAhms reads like `11 18 11.24` (hours, minutes, seconds with two decimals, so 0.15″ resolution) and DEdms like `+31 31 50.8` (sign, degrees, arcminutes, arcseconds with one decimal, 0.1″). RAdeg, DEdeg, pmRA, pmDE and parallax are all blank for them; V magnitudes run from 3.79 (HIP 55203) to 7.37 (HIP 31500).
- For a normal row the sexagesimal fields equal RAdeg/DEdeg to 0.04″ median and 0.09″ max (empirical worker), so the parse is consistent with the degree fields where both exist.
- Effect on counts (measured earlier): V ≤ 4.5 becomes 921 (919 plus HIP 55203 and 78727) and V ≤ 7.5 becomes 25,723 (25,713 plus the ten). The finder file's gzip with these ten rows and no designations was 119,080 bytes.
- Reader implication: blank RAdeg/DEdeg is not an error for a row with Vmag ≤ 7.5; the reader falls back to RAhms/DEdms, unpropagated, and flags the row. A blank Vmag is not an error either: exactly one row (HIP 120412, which also has no position) lacks it and is skipped.
