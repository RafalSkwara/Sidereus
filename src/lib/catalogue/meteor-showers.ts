/**
 * The meteor showers of the sky events list (M-3 S-07, sky-events Phase 3): eight major annual showers,
 * entered by hand as rounded facts in this file's own layout. Nothing is copied as a table from any source
 * and no value is taken from the International Meteor Organization (IMO), whose working list and calendar
 * need the publisher's written permission. Not legal advice; see `LICENSE-DATA.md` ("Meteor showers").
 *
 * Where each field comes from:
 *
 * - **Peak night** (`nasaPeakNight`) and **rate** come from NASA's shower pages, the "Fast Facts" boxes of
 *   2026-10-14, a US government work reusable without implying NASA's endorsement:
 *   https://science.nasa.gov/solar-system/meteors-meteorites/quadrantids/ (and `lyrids/`, `eta-aquarids/`,
 *   `delta-aquariids/`, `perseids/`, `orionids/`, `leonids/`, `geminids/` beside it, listed at
 *   https://science.nasa.gov/meteor-showers/). NASA lists eight showers, so the Draconids and the Ursids,
 *   which it has no page for, are not in the table (they are not filled in from any other source).
 * - **Peak solar longitude** (`peakSolarLongitudeJ2000Deg`) is not taken from any source. Our own engine
 *   computes it from NASA's peak night: the Sun's ecliptic longitude for the equinox of J2000.0 at the
 *   middle of that night, taken as 00:00 UT at the turn from the night's evening date to its morning date,
 *   rounded to 0.1 degree (`sunLongitudeJ2000Deg` in `src/lib/engine/meteors.ts`;
 *   `meteor-showers.test.ts` recomputes it from `nasaPeakNight`). It is a derived fact, good to about a
 *   degree (about a day), which is why the app shows a peak as a night and never a minute.
 * - **Radiant and speed** (`radiantRaDeg`, `radiantDecDeg`, `speedKmS`) come from the IAU Meteor Data
 *   Center's list of established showers, https://ceresiaumdc.ta3.sk/established, each shower's page
 *   there, the annual solution of Jenniskens (2023) with the largest sample, rounded to 1 degree and
 *   1 km/s. The IAU MDC asks that its data be cited: Jopek, T. J. et al. (2024), Astronomy & Astrophysics
 *   682, A159; Jenniskens, P. et al. (2020), Planetary and Space Science 182, 104821. See
 *   https://ceresiaumdc.ta3.sk/references.
 *
 * Cross-checks, read only (no value was copied): the speeds against NASA's own speeds on the pages above
 * (all within 2 km/s), and the radiants, speeds and peak dates against Wikipedia's "List of meteor
 * showers" (radiants within 3 degrees in RA and Dec, speeds within 1 km/s, peak dates the same night; the
 * Leonids' and Eta Aquariids' derived longitudes sit about 1 and 0.6 degrees below Wikipedia's, which is
 * the resolution of NASA's night-level dates, not a fault in the engine).
 *
 * Island-safe: no imports. The shower names live in the i18n catalogue (`tonight.events.showerName.<key>` and
 * `showerNameInLine.<key>`), typed by `ShowerKey` in both languages.
 */

/** The showers' keys, in the order of the table: the one list the i18n names and the engine's events are typed by. */
export const SHOWER_KEYS = [
  "quadrantids",
  "lyrids",
  "etaAquariids",
  "southernDeltaAquariids",
  "perseids",
  "orionids",
  "leonids",
  "geminids",
] as const;

export type ShowerKey = (typeof SHOWER_KEYS)[number];

export interface MeteorShower {
  /** Stable id and the key of `tonight.events.showerName` / `showerNameInLine`: lower camel case. */
  key: ShowerKey;
  /**
   * The Sun's ecliptic longitude at the shower's peak, degrees [0, 360), for the equinox of J2000.0 (not
   * of date: the engine searches the J2000 longitude directly). Derived from `nasaPeakNight`, see above.
   */
  peakSolarLongitudeJ2000Deg: number;
  /** The evening date (`YYYY-MM-DD`, UT calendar) of the observing night NASA gives as the peak, e.g. "2026-08-12" for "Aug. 12-13". */
  nasaPeakNight: string;
  /** Radiant right ascension, J2000, degrees [0, 360). */
  radiantRaDeg: number;
  /** Radiant declination, J2000, degrees [-90, 90]. */
  radiantDecDeg: number;
  /** Geocentric speed, km/s. */
  speedKmS: number;
  /**
   * Approximate meteors per hour under dark skies, from NASA's "Observed under dark skies" line for the
   * page's year (the upper end of a range, or the bound of "fewer than"). It moves with the Moon and the
   * year, so it is an order of magnitude, never a forecast.
   */
  rate: number;
}

export const METEOR_SHOWERS: readonly MeteorShower[] = [
  {
    key: "quadrantids",
    peakSolarLongitudeJ2000Deg: 283.0,
    nasaPeakNight: "2027-01-03",
    radiantRaDeg: 230,
    radiantDecDeg: 50,
    speedKmS: 40,
    rate: 10,
  },
  {
    key: "lyrids",
    peakSolarLongitudeJ2000Deg: 32.2,
    nasaPeakNight: "2027-04-22",
    radiantRaDeg: 272,
    radiantDecDeg: 33,
    speedKmS: 47,
    rate: 6,
  },
  {
    key: "etaAquariids",
    peakSolarLongitudeJ2000Deg: 44.9,
    nasaPeakNight: "2027-05-05",
    radiantRaDeg: 339,
    radiantDecDeg: 0,
    speedKmS: 66,
    rate: 10,
  },
  {
    key: "southernDeltaAquariids",
    peakSolarLongitudeJ2000Deg: 127.5,
    nasaPeakNight: "2026-07-30",
    radiantRaDeg: 341,
    radiantDecDeg: -16,
    speedKmS: 41,
    rate: 8,
  },
  {
    key: "perseids",
    peakSolarLongitudeJ2000Deg: 139.9,
    nasaPeakNight: "2026-08-12",
    radiantRaDeg: 48,
    radiantDecDeg: 58,
    speedKmS: 59,
    rate: 25,
  },
  {
    key: "orionids",
    peakSolarLongitudeJ2000Deg: 208.2,
    nasaPeakNight: "2026-10-21",
    radiantRaDeg: 96,
    radiantDecDeg: 16,
    speedKmS: 66,
    rate: 20,
  },
  {
    key: "leonids",
    peakSolarLongitudeJ2000Deg: 234.3,
    nasaPeakNight: "2026-11-16",
    radiantRaDeg: 154,
    radiantDecDeg: 21,
    speedKmS: 70,
    rate: 3,
  },
  {
    key: "geminids",
    peakSolarLongitudeJ2000Deg: 261.6,
    nasaPeakNight: "2026-12-13",
    radiantRaDeg: 113,
    radiantDecDeg: 32,
    speedKmS: 34,
    rate: 50,
  },
];
