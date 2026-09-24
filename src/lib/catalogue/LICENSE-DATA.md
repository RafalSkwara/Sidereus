# Catalogue data licence

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
