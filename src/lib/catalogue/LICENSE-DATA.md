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

## Star catalogues (HYG)

`bright-stars.json`, `bright-stars.meta.json`, `finder-stars.json` and `finder-stars.meta.json` in this
directory are **Adapted Material** derived from the [HYG database](https://github.com/astronexus/HYG-Database) v4.1 by David Nash (astronexus),
file `hyg/CURRENT/hygdata_v41.csv` at commit `c7f7f883fe678cc7680169a50ccd7dcc49b060ce`
(2025-02-14), via `scripts/build-stars.mjs` (one run writes both pairs).

HYG is licensed under the
[Creative Commons Attribution-ShareAlike 4.0 International licence](https://creativecommons.org/licenses/by-sa/4.0/)
(CC BY-SA 4.0). Under its ShareAlike condition, the four generated files are themselves licensed
**CC BY-SA 4.0**, independently of the licence that applies to the application code in this repository.

Changes made to the source data are listed under `filter` and `normalisations` in
`bright-stars.meta.json` and `finder-stars.meta.json`. In short: in `bright-stars.json` the database is
filtered to stars of magnitude 4.5 or brighter (the Sun excluded), right ascension and declination are
converted to J2000 unit vectors, proper names are kept only for the 40 brightest named stars plus
Polaris (41 names), and every other column is dropped. In `finder-stars.json` the database is filtered
to stars of magnitude 7.5 or brighter (the Sun excluded), right ascension and declination (in 0.01
degrees) are packed into one integer per star, magnitudes (in 0.1) are stored as runs over the sorted
stars, HYG ids order the stars but are not stored, and a sparse table keeps HYG's Bayer letter,
Flamsteed number, constellation and proper name for the stars that have one of them; every other column is
dropped. Polish star names are not part of the derived files; they live in `star-names.ts`.

### Upstream: Hipparcos (ESA)

HYG compiles the Hipparcos catalogue of the European Space Agency (ESA), which ESA publishes under the
[Creative Commons Attribution-NonCommercial 3.0 IGO licence](https://creativecommons.org/licenses/by-nc/3.0/igo/)
(CC BY-NC 3.0 IGO, catalogue pages at <https://www.cosmos.esa.int/web/hipparcos/catalogues>). The credit
ESA asks for is **Credit: ESA**; the app shows it beside HYG's (`Attribution.astro`).

The non-commercial condition applies to the star files in this directory as well: HYG's CC BY-SA 4.0
grant cannot lift an upstream condition it does not own, so the files are CC BY-SA 4.0 only as far as
that upstream licence allows. Commercial use needs ESA's authorisation; the owner's request to ESA
(data.licences@esa.int) is pending, and until ESA answers the files must not be used to generate
financial gain.
