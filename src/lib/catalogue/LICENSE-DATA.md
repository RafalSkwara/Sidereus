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
Meteor Society's list. The app credits NASA and the IAU MDC in its data notice (to be added with the events
page, S-07 Phase 4).
