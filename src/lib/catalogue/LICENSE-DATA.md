# Catalogue data licence

## Messier and Caldwell catalogues (OpenNGC)

`messier.json`, `messier.meta.json`, `caldwell.json` and `caldwell.meta.json` in this directory are **Adapted Material** derived from
[OpenNGC](https://github.com/mattiaverga/OpenNGC) by Mattia Verga, at commit
`da90466031b0372c896588b85be6016c617e205b` (2026-07-26), via `scripts/build-catalogue.mjs` (one run writes both pairs).

OpenNGC is licensed under the
[Creative Commons Attribution-ShareAlike 4.0 International licence](https://creativecommons.org/licenses/by-sa/4.0/)
(CC BY-SA 4.0). Under its ShareAlike condition, the four generated files are themselves licensed
**CC BY-SA 4.0**, independently of the licence that applies to the application code in this repository.

Changes made to the source data are listed under `overrides` and `normalisations` in
`messier.meta.json` and `caldwell.meta.json`. In short: `messier.json` is filtered to the 110 Messier
objects (NGC 5866 is listed as M102, because OpenNGC treats M102 as a duplicate of M101);
`caldwell.json` is filtered to the rows of OpenNGC's `NGC.csv` and `addendum.csv` that carry a Caldwell
identifier, are not Messier objects and lie at declination -23 degrees or north (61 objects, with the
Double Cluster's two rows NGC 869 and NGC 884 merged into one entry; a missing V magnitude is taken
from the B magnitude); in both, sexagesimal coordinates are converted to decimal and the Serpens
constellation codes are merged.

OpenNGC asks that the following acknowledgements accompany derived work:

- This research has made use of the NASA/IPAC Extragalactic Database (NED), which is operated by the
  Jet Propulsion Laboratory, California Institute of Technology, under contract with the National
  Aeronautics and Space Administration.
- This research has made use of the SIMBAD database, operated at CDS, Strasbourg, France.
- OpenNGC used several HEASARC tables (messier, mwsc, lbn, plnebulae, lmcextobj, smcclustrs).

## Star catalogues (Hipparcos)

`bright-stars.json`, `bright-stars.meta.json`, `finder-stars.json` and `finder-stars.meta.json` in this
directory are **Adapted Material** derived from the Hipparcos Catalogue, Version 1 (ESA, 1997, _The Hipparcos
and Tycho Catalogues_, ESA SP-1200), file `hip_main.dat` of VizieR catalogue I/239, via `scripts/build-stars.mjs`
(one run writes both pairs). ESA publishes the catalogue under the
[Creative Commons Attribution-NonCommercial 3.0 IGO licence](https://creativecommons.org/licenses/by-nc/3.0/igo/)
(CC BY-NC 3.0 IGO, catalogue pages at <https://www.cosmos.esa.int/web/hipparcos/catalogues>), and the four
generated files are licensed under those same terms.

- **Credit:** **Credit: ESA**, and the citation "ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200"
  (`Attribution.astro` shows both on every view that draws stars, including the signed-out landing page; both
  meta files carry them in `attribution`).
- **No endorsement:** nothing here states or implies that ESA or its staff endorse Sidereus, and ESA's name and
  logo are not used in marketing.
- **Non-commercial:** commercial use needs ESA's written authorisation. Until ESA gives it, the files must not
  be used to generate financial gain, and the app takes no payment.
- **Not CC BY-SA any more:** HYG is no longer a source of any file here, and the star files are no longer
  CC BY-SA 4.0. The OpenNGC files above (`messier*.json`, `caldwell*.json`) are still CC BY-SA 4.0.
- **Rendered finder charts are derived from this data:** a finder chart is built from `finder-stars.json`, so
  the same non-commercial condition and the same credit apply to the charts the app renders from it.

### The source file

The generator reads one pinned, checksummed download and writes nothing until its length, row count and SHA-256
match (`scripts/lib/hipparcos.mjs`, `HIPPARCOS_PIN`; the pin changes only by a deliberate edit):

- URL: `https://cdsarc.cds.unistra.fr/ftp/cats/I/239/hip_main.dat`, with
  `https://vizier.cfa.harvard.edu/ftp/cats/I/239/hip_main.dat` as the one retry (the same bytes);
- 53,316,318 bytes, 118,218 rows;
- SHA-256 `58ceabb104d647160d9437ce6e513a02a036bb4ad9f8879a5a22fd52943616e0`.

Only these fields are read from the file (`fieldsUsed` in both meta files, `HIPPARCOS_FIELDS_USED` in the
reader, which reads through that list and nothing else; no other field such as Hpmag or B-V is read):

- HIP (the Hipparcos number), Vmag (V magnitude), RAdeg and DEdeg (right ascension and declination in degrees,
  ICRS, epoch J1991.25), pmRA and pmDE (proper motions, which serve only to bring the positions to J2000);
- RAhms and DEdms (the sexagesimal position), for the ten stars of magnitude 7.5 or brighter that have no
  astrometric solution (no RAdeg or DEdeg): HIP 31067, 31500, 34716, 50572, 52800, 55203, 59273, 78727, 80579
  and 115125. They have no proper motion, so their J1991.25 positions are used unpropagated (`positionFromSexagesimal`
  in the meta files).

### Designations and names

The file has no designations, names or constellations, so those come from other sources; no Hipparcos value is
stored in these tables.

- **Bayer letters and Flamsteed numbers** come from `scripts/data/star-designations.json`, built from
  [Wikidata](https://www.wikidata.org/) (structured data released under CC0 1.0) by `npm run stars:designations`.
  A value is kept only when its constellation matches the one computed from the star's own Hipparcos position,
  and is omitted when Wikidata gives several candidates and no citable source settles it;
  `scripts/data/star-designation-overrides.json` (hand-edited, each entry citing its source) settles the rest.
  The tables record the fetch date, queries and counts.
- **Proper names** come from `scripts/data/iau-star-names.json`, the proper names and HIP numbers of the IAU
  Working Group on Star Names (WGSN) list, read from <https://exopla.net/star-names/modern-iau-star-names/>. IAU
  star names are in the public domain. The etymology texts and images on that page are CC BY and are **not**
  used. Names that are not on the IAU list (for example "Castor B" or "Lacaille 9352") are not in the files.
- **The constellation** of each designated star is computed by `astronomy-engine`'s `Constellation()` at its J2000
  position.

### Changes made

Changes made to the source data are listed under `filter` and `normalisations` in `bright-stars.meta.json` and
`finder-stars.meta.json`. In short:

- Stars are filtered to Vmag 7.5 or brighter (`finder-stars.json`, 25,723 stars) and 4.5 or brighter
  (`bright-stars.json`, 921 stars) among the rows that have a position (the one row without a Vmag, HIP 120412,
  is left out).
- Positions are moved from J1991.25 to J2000 by linear proper motion (pmRA and pmDE over 8.75 years), except for
  the ten stars above, and converted to J2000 unit vectors (`bright-stars.json`, rounded to 5 decimals) or packed
  into one integer per star in 0.01 degrees (`finder-stars.json`); magnitudes in the finder file are stored in
  0.1 as runs over the sorted stars.
- Stars are ordered by magnitude and then by HIP number. The bright file keeps the HIP number as `id`; the finder
  file stores no HIP number, only the order it gives, which the finder chart's tie-break depends on.
- Proper names are kept in the bright file only for the 40 brightest stars that have an IAU name, plus Polaris
  (41 names); the finder file keeps a sparse table of Bayer letter, Flamsteed number, constellation and IAU name
  for the stars that have one of them (3,277 stars). Every other column of the source is dropped. Polish star
  names are not part of the derived files; they live in `star-names.ts`.

To regenerate: `npm run stars:build` rebuilds the four files byte-identically from the pinned download and the two
tables in `scripts/data/` (no other network call), and `npm run stars:designations` re-queries Wikidata and the
WGSN page to rewrite those tables.

### ESA's reply and the follow-up (2026-10-16)

ESA answered about 2026-10-16 (Head Scientist, ESA Space Science Archives): the HYG database, which the
files were built from before this change, is a separately prepared third-party compilation, and ESA could not
grant commercial-use authorisation for it or for files derived from it; Tycho-2 is not an ESA product (its
rights are held by E. Høg et al., 2000, so nothing in this directory is Tycho-2 and none is to be added); ESA
can assess a direct use of Gaia DR3 once the table, fields and delivery are named; and ESA holds the rights to
Hipparcos Version 1 and can assess its direct commercial use.

The owner sent a follow-up on the same day, asking ESA to include the direct use of Hipparcos Version 1 in its
assessment, with the field list above (including the RAhms and DEdms sentence for the ten stars) and the credit
wording above (the draft is in `context/foundation/licensing/`). ESA aims to finish its commercial-use
framework by the end of November 2026; **no answer to the follow-up is on file yet.** No payment is taken
until ESA authorises in writing; if ESA refuses, the files revert or migrate to the SAO Star Catalog in a change
of their own. The correspondence and the reviewer's assessment (not legal advice) are in
`context/foundation/licensing/`.

## Meteor showers (hand-entered facts)

`meteor-showers.ts` lists eight major annual meteor showers (the Quadrantids, Lyrids, Eta Aquariids,
Southern Delta Aquariids, Perseids, Orionids, Leonids and Geminids). It is **not** a derived work of any
database and carries no share-alike condition: the values are facts, entered by hand, rounded, in the
file's own layout, and no table (or its layout) was copied from any source. This is the owner's
reading of the position and not legal advice; the EU database right protects a maker's investment in a
whole collection or a substantial part of it, and about eight hand-typed rows, rounded and checked
against more than one published value, are not that.

Where each field comes from (the file's header says the same):

- **Peak night and approximate rate:** NASA's shower pages (<https://science.nasa.gov/meteor-showers/>,
  "Fast Facts" boxes read on 2026-10-14). NASA content is generally not subject to copyright in the
  United States and may be used without permission, provided it does not imply NASA's endorsement; this
  app does not. NASA has no page for the Draconids or the Ursids, so they are not in the table and were
  not filled in from another source. The rate is NASA's "observed under dark skies" line for that page's
  year (the upper end of a range), approximate, and moves with the Moon and the year.
- **Peak solar longitude:** derived, not taken from any source and **not taken from the International
  Meteor Organization (IMO)**, whose working list and calendar need the publisher's prior written
  permission. The engine computes the Sun's J2000 ecliptic longitude at the middle of NASA's peak night
  (00:00 UT at the turn between its two dates), rounded to 0.1 degree. `meteor-showers.test.ts`
  recomputes it from the peak night recorded in the file.
- **Radiant and speed:** the IAU Meteor Data Center's list of established showers
  (<https://ceresiaumdc.ta3.sk/established>), the annual solution of Jenniskens (2023) with the largest
  sample on each shower's page, rounded to 1 degree and 1 km/s. The MDC states no licence and asks that
  its data be cited (<https://ceresiaumdc.ta3.sk/references>): Jopek, T. J. et al. (2024), Astronomy &
  Astrophysics 682, A159; Jenniskens, P. et al. (2020), Planetary and Space Science 182, 104821.
  A courtesy request to the MDC to confirm this use is drafted for the owner in
  `context/changes/sky-events/iau-mdc-request.md`; the agent never sends it, and no reply is on file.

Each value was cross-checked by reading a second source (NASA's own speeds, and Wikipedia's "List of meteor
showers" for radiants, speeds and peak dates); no value was taken from Wikipedia, the IMO or the American
Meteor Society's list. The app credits NASA and the IAU MDC in its data notice (`Attribution.astro`, added
with the events page, S-07 Phase 4).
