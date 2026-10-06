# Catalogue spot check (S-12, phase 5)

- **Date**: 2026-10-06
- **Catalogue checked**: 340 telescopes and 346 eyepieces, as merged from the curation drafts (commits 77fe2f2..8e24020 plus earlier groups)
- **Method**: three independent Opus agents re-read each sampled entry's `source` page with WebFetch, one page at a time, and compared the numbers. None of them took part in the curation. The random sample uses seed 20261006.

## Sample

| Set | Entries | Share |
| --- | --- | --- |
| Telescopes, random | 34 | 10% of 340 |
| Eyepieces, random (not estimated, not zoom) | 35 | 10% of 346 |
| Every `afovEstimated` or zoom eyepiece | 60 | all |

## Results

| Set | MATCH | MATCH (design assumed) | MISMATCH | UNVERIFIABLE |
| --- | --- | --- | --- | --- |
| Telescopes | 34 | — | 0 | 0 |
| Random eyepieces | 33 | — | 0 | 2 |
| Estimated and zoom eyepieces | 52 | 8 | 0 | 0 |

## Actions taken

- **Unverifiable**: `baader-morpheus-12-5mm` and `baader-morpheus-14mm`. Baader's set page renders without its specs, and the First Light Optics page does too. Following the README rule (leave out what can't be read), I removed all six Morpheus entries. I also removed the two Hyperion Aspheric entries, whose figures came from search excerpts of the same kind of empty page. Eyepieces: 346 → 338.
- **Design assumed (8)**: the bundled eyepieces `celestron-bundled-4mm`, `-8mm`, `-9mm`, `-12mm`, `meade-bundled-9mm` and `skywatcher-bundled-10mm`, `-20mm`, `-25mm`. Each page lists the focal length but no design. The README now states how such eyepieces are classed ("Super" and "SR" count as Kellner, "H" as Huygens, "PL" as Plössl), so the estimated AFOV follows a documented rule.
- **Zoom rounding**: the Baader Hyperion Zoom's interpolated stops (63.5 → 64, 54.5 → 55) round halves up. The README now says so.
- **Alias**: removed "FL-DOB0806" from `explore-scientific-firstlight-203-1218`; it doesn't appear on the source page. The page gives the model code as ESFL8.
- **Kept, by the README rule** that mount variants of one optical tube go in aliases: "NexStar Evolution 6" on `celestron-nexstar-6se` and "Virtuoso GTi 150P" on `skywatcher-heritage-150p`.

## Open notes

- `explore-scientific-bundled-26mm`: the 6" Dobsonian page says 26 mm in its headline but quotes 47x, which fits 25 mm. The headline value is kept.
- `bresser-bundled-10mm`: its source now redirects to Bresser's "Discontinued" listing, which still names the Plössl 10 + 25 mm kit. A more specific page would be better at the next edit.
- **Delta Optical**: no entries. deltaoptical.pl returned 503 throughout curation and again at close-out, so this is a follow-up. Its range is mostly Sky-Watcher and GSO tubes, which the catalogue already has under their own brands.

Raw per-entry results: `reviews/spot-check/spot-{a,b,c}-results.json`.
