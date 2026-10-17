# Evidence for the manual rows and the SIMBAD cross-read

Gathered on 2026-10-17 on the rebased branch (origin/main `82e35cf`), by the implementing agent, for the reviewer. Public GETs only (SIMBAD's TAP service, the CDS file of the Hipparcos Catalogue), the repo URL as the User-Agent contact, no personal data. The throwaway scripts live in the session scratchpad, outside the repository.

## Independent star positions in the tests (finding)

The reference positions in `stars.test.ts` (six stars plus two without an astrometric solution) and `finder-stars.test.ts` (ten stars plus the same two) had been typed from memory. All of them were read from SIMBAD's `basic` table (`ra`, `dec`, `pmra`, `pmdec`; ICRS, epoch J2000) and the tests now carry the decimal degrees, the access date and a sample query URL in their comments.

| Check                                                           | Result                                                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sirius, Arcturus, Vega, Procyon, Capella, Betelgeuse, Polaris   | Typed positions within 0.01″ of SIMBAD                                                                                                           |
| Unukalhai, Alpheratz, Elnath                                    | Within 0.07″                                                                                                                                     |
| Alula Australis (ξ UMa), ξ Sco (the two without a solution)     | Typed to 0.1 s and 1″, so 0.6″ and 2.1″ off; **corrected** to SIMBAD's values (tolerance is 30″, no test change)                                 |
| Capella's proper motion (the propagation check's input)         | **Mismatch**: typed 75.52, −427.11 mas/yr, SIMBAD 75.25, −426.89; **corrected** (the check uses Arcturus, Sirius and Procyon only, so no effect) |
| V magnitudes (only used to pick the star out of its neighbours) | Typed Hipparcos V differs from SIMBAD's by at most 0.05 (Polaris 1.97 against 2.02); inside the tests' tolerance, left as is                     |

Caveat, written into both test comments: SIMBAD's coordinate source for all but Unukalhai (Gaia) and the two stars without a solution (UCAC4) is the Hipparcos re-reduction (2007A&A...474..653V), so for those the check proves our reader and the epoch propagation against a published J2000 position, not astrometry independent of Hipparcos. The planned second source, Gaia DR3 through VizieR's TAP, was not available: the service answered 503 on every try that day.

## Rows 2.7 to 2.9 (designations)

`designation-check.md` already holds the content of the three rows: 21 Bayer and 1 Flamsteed disagreements with the decision for each (override citing the IAU WGSN list or Wikidata's own item, or omission), the 96 Flamsteed and 60 Bayer gaps as accepted omissions, the five omitted multi-value stars, the additions, the ten stars checked against the IAU WGSN list (five Bayer, five Flamsteed, Alpheratz as the multi-value star) and the fifteen route and example-chart stars with identical `bayer` / `flamsteed` / `con`. Nothing there is guessed: every disagreement the sources do not settle is omitted. A new check against SIMBAD's identifiers (a source that neither Wikidata nor HYG feeds), for the fifteen route stars, the ten checked stars and the two stars without a solution (26 distinct HIPs):

- **Bayer letter and constellation: all agree.** Every table value that has a Bayer letter (Bet/Mu/Nu And, Eta/Zet/Pi Her, Bet/Gam Lyr, Alp UMa, Gam Sge, Alp/Eps/Nu-1/Ups CrB, Alp Lyr, Alp Ori, Alp And, Alp UMi, Xi UMa, Xi Sco) is the one SIMBAD lists, including the component digit of ν¹ CrB; Alpheratz carries α And and δ Peg in SIMBAD, and the table keeps the one in its own constellation.
- **Flamsteed numbers:** SIMBAD drops the Flamsteed number whenever a star has a Bayer letter, so it confirms only 109 Vir (a star with no Bayer letter). The other Flamsteed numbers stay confirmed only by what the design note records: the five from the IAU WGSN list (55 Cnc, 88 Psc, 109 Vir, 34 Boo, 41 Ari) and the reference fixtures and example chart that the tests hold identical. This is the one limit of rows 2.8 and 2.9; I could not close it because VizieR's Bright Star Catalogue (V/50) was down.
- HIP 43587 (Copernicus, 55 Cnc): the table has Flamsteed 55 and no Bayer letter; SIMBAD lists both ρ¹ Cnc and ρ Cnc for it, which is the several-values case the table omits.

## Rows 3.7 and 3.8 (comparison with the HYG-era files)

The scratch build (`STARS_OUT_DIR=<scratch> npm run stars:build`) re-read the pinned file from CDS (SHA-256 `58ceabb1…3616e0`, as pinned) and is byte-identical to the four committed files, so the comparison below is of the committed files against the HYG-era files of `origin/main`.

| Measure                                     | HYG-era | Hipparcos | Explained by                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finder stars                                | 25,791  | 25,723    | 78 HYG rows with no Hipparcos counterpart gone (non-Hipparcos Gliese and Yale companions, 17 of them designated), 10 stars without a solution added (−78 + 10 = −68)                                                                                                                                                                                                                                           |
| Matched by position (≤ 0.1°, V within 0.25) | 25,713  | 25,713    | Same Hipparcos stars; median and 99th-percentile offset 0″, largest 35″ (one cell of the 0.01° packing, a rounding step at a cell edge), none over 36″; no star's magnitude tenths differ                                                                                                                                                                                                                      |
| Bright stars                                | 925     | 921       | −4                                                                                                                                                                                                                                                                                                                                                                                                             |
| Stars at V ≤ 4.5 in the finder file         | 966     | 962       | −4: six HYG rows gone (a second Capella row 13″ from the first, Castor B, a second row at η Oph's position, Gam 29 Vir, Zet 79 UMa, the Yale Alula Australis row at V 4.3), two stars added (Alula Australis V 3.8 and ξ Sco V 4.2, both positioned from RAhms/DEdms)                                                                                                                                          |
| Stars at V ≤ 7.5                            | 25,791  | 25,723    | As the first row                                                                                                                                                                                                                                                                                                                                                                                               |
| Designated stars (Bayer or Flamsteed)       | 3,307   | 3,222     | Bayer 1,535 → 1,471 and Flamsteed 2,724 → 2,639: 3,307 − 17 designated rows removed − 100 matched stars that lose both values + 30 matched stars that gain one + 2 of the ten new stars (Alula Australis, ξ Sco) = 3,222; the omissions and additions are itemised in `designation-check.md` (which counts 101 stars losing both values; one star's match differs between its HIP join and this position join) |
| Proper names                                | 377     | 498       | 144 stars gain an IAU name, 17 matched stars lose a non-IAU name, 2 are renamed (Cih to Tiansi, Revati B to Paushna) and 4 names go with removed rows (Castor B, Alula Australis B, Graffias, Guniibuu B): 23 non-IAU names in all; the 144 and the 17 equal `designation-check.md`'s                                                                                                                          |

Row 3.8: ν And (V 4.53) is at tenths 45 in both files (new index 856, old 860) and 24 UMa (V 4.54) at tenths 45 (new 896, old 900). The ten stars positioned from RAhms/DEdms are exactly the ten finder stars with no HYG-era match, and each sits within 25.5″ (the packing's half-diagonal) of SIMBAD's J2000 position, which also takes the J1991.25 to J2000 gap (the unpropagated epoch) into account:

| HIP   | V (file) | Offset from SIMBAD | HIP    | V (file) | Offset from SIMBAD |
| ----- | -------- | ------------------ | ------ | -------- | ------------------ |
| 31067 | 6.2      | 7.5″               | 59273  | 6.7      | 16.7″              |
| 31500 | 7.4      | 6.5″               | 78727  | 4.2      | 13.7″              |
| 34716 | 7.4      | 21.1″              | 80579  | 6.7      | 5.8″               |
| 50572 | 7.2      | 8.0″               | 115125 | 5.2      | 21.1″              |
| 52800 | 6.9      | 16.2″              | 55203  | 3.8      | 13.9″              |

Observation, not investigated further: SIMBAD's V for the object it ties to HIP 34716, 50572 and 59273 is fainter than the file's (8.5, 9.99 and 9.3 against 7.35, 7.19 and 6.65), which suggests SIMBAD points at a component of a double; the positions agree either way. The published-hop references (`finder.test.ts`, passing unedited) and the example chart cover the route and field side of the row: `3.8-finder-example-chart-1280.png` shows the explainer's M13 chart in Hercules with α (Alphecca), ε, υ and ν¹ Coronae Borealis as its hops.

## Row 4.9 (local preview)

Production preview on the rebased branch, local Supabase, forecast fixture. `reviews/screenshots/4.9-tonight-live-sky-1280.png` is Tonight's live sky (star field, planets, M42 and M45 marked, labelled bright stars: Betelgeuse, Rigel, Bellatrix, Aldebaran, Procyon, Sirius, Wezen, Adhara, Alnitak, Regulus) and `4.9-finder-m13-chart-1280.png` is M13's finder chart for a full-plan account (start star η Her, one numbered hop, both panels). Neither shows a hole, a doubled star or a wrong constellation label; star duplicates and constellations are also held by `stars.test.ts` (no pair closer than 5″) and by the generator's constellation filter (0 of 3,290 matched designated stars differ from the HYG-era constellation).

## Row 5.7 (credit line and footer)

`reviews/screenshots/5.7-footer-<page>-<320|360>-<en|pl>.png` crops the credit line on the signed-out landing, Tonight and a finder chart; `5.7-footer-report.json` holds the measurements. At 320 and 360 px, in English and Polish, on all three pages (and on the locked finder explainer): the document's `scrollWidth` equals its `clientWidth` (no sideways scroll), the credit line lies inside the viewport, and it reads "Star data: Hipparcos, Credit: ESA (CC BY-NC 3.0 IGO) · ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200 · Star designations: Wikidata (CC0), IAU WGSN (names)" ("Dane gwiazd: Hipparcos, Credit: ESA …", "Oznaczenia gwiazd: Wikidata (CC0), IAU WGSN (nazwy)" in Polish; ESA's credit and citation stay in ESA's wording). The footer is one shared component, so the crops are the same line wrapped at each width.

## Runs on the rebased branch

- `npm run build`: passes, including the star-data leak check; the preview ran on port 4337 with the forecast fixture on 4403.
- Smoke against local Supabase: all steps passed.
- Whole e2e, `CI=1` (a pass only on retry fails the run): 86 passed, 3 skipped, 0 failed, 0 flaky. The skips are the opt-in landing capture, the no-darkness-window finder test (outside its window) and the old `/tonight/all#washed-out` bookmark test.

## After the implementation review (2026-10-17)

Follow-up branch `fix/star-source-review` (decisions in `reviews/impl-review.md`): nine Gould numbers and two values SIMBAD does not know are dropped, so the designated-star count is **3,212** (Flamsteed values 2,628) and not the 3,222 and 2,639 above; the bright file is unchanged. The landing image was re-captured on the Hipparcos data. Re-run: unit suite 2,681 passed, smoke 45 steps passed, whole e2e with `CI=1` 86 passed, 3 skipped, 0 flaky.
