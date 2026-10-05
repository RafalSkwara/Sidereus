# Catalogue data licence

## Messier catalogue (OpenNGC)

`messier.json` and `messier.meta.json` in this directory are **Adapted Material** derived from
[OpenNGC](https://github.com/mattiaverga/OpenNGC) by Mattia Verga, at commit
`da90466031b0372c896588b85be6016c617e205b` (2026-07-26), via `scripts/build-catalogue.mjs`.

OpenNGC is licensed under the
[Creative Commons Attribution-ShareAlike 4.0 International licence](https://creativecommons.org/licenses/by-sa/4.0/)
(CC BY-SA 4.0). Under its ShareAlike condition, the two generated files are themselves licensed
**CC BY-SA 4.0**, independently of the licence that applies to the application code in this repository.

Changes made to the source data are listed under `overrides` and `normalisations` in
`messier.meta.json`. In short: the catalogue is filtered to the 110 Messier objects, NGC 5866 is
listed as M102 (OpenNGC treats M102 as a duplicate of M101), sexagesimal coordinates are converted to
decimal, and the Serpens constellation codes are merged.

OpenNGC asks that the following acknowledgements accompany derived work:

- This research has made use of the NASA/IPAC Extragalactic Database (NED), which is operated by the
  Jet Propulsion Laboratory, California Institute of Technology, under contract with the National
  Aeronautics and Space Administration.
- This research has made use of the SIMBAD database, operated at CDS, Strasbourg, France.
- OpenNGC used several HEASARC tables (messier, mwsc, lbn, plnebulae, lmcextobj, smcclustrs).

## Bright-star catalogue (HYG)

`bright-stars.json` and `bright-stars.meta.json` in this directory are **Adapted Material** derived
from the [HYG database](https://github.com/astronexus/HYG-Database) v4.1 by David Nash (astronexus),
file `hyg/CURRENT/hygdata_v41.csv` at commit `c7f7f883fe678cc7680169a50ccd7dcc49b060ce`
(2025-02-14), via `scripts/build-stars.mjs`.

HYG is licensed under the
[Creative Commons Attribution-ShareAlike 4.0 International licence](https://creativecommons.org/licenses/by-sa/4.0/)
(CC BY-SA 4.0). Under its ShareAlike condition, the two generated files are themselves licensed
**CC BY-SA 4.0**, independently of the licence that applies to the application code in this repository.

Changes made to the source data are listed under `filter` and `normalisations` in
`bright-stars.meta.json`. In short: the database is filtered to stars of magnitude 4.5 or brighter
(the Sun excluded), right ascension and declination are converted to J2000 unit vectors, proper names
are kept only for the 40 brightest named stars plus Polaris (41 names), and every other column is
dropped. Polish star names are not part of the derived files; they live in `star-names.ts`.
