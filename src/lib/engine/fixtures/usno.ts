import type { Site } from "../types";

/**
 * TEST-ONLY. Civil dawn and sunrise on the engine's edge nights, read from the U.S. Naval Observatory
 * API, an oracle independent of this engine (checked 2026-10-08).
 *
 * URL pattern: `https://aa.usno.navy.mil/api/rstt/oneday?date=<YYYY-MM-DD>&coords=<lat>,<lon>&tz=0`
 * (`tz=0`: times are UTC on the UTC calendar day `date`). Values are rounded to the minute. `site`
 * uses USNO's sea-level basis (`elevationM: 0`). `night` is the observing night's evening date (site-local);
 * `civilDawn` and `sunrise` fall on the morning after it, which can be the UTC day before `night + 1`
 * far east of UTC.
 */
export interface UsnoCivilDawn {
  label: string;
  site: Site;
  /** Evening date of the observing night, `YYYY-MM-DD`. */
  night: string;
  /** Sun at -6° in the morning, ISO 8601 UTC. */
  civilDawn: string;
  /** Sunrise, ISO 8601 UTC. */
  sunrise: string;
}

export const USNO_CHECKED = "2026-10-08";

export const USNO_CIVIL_DAWN: readonly UsnoCivilDawn[] = [
  {
    label: "Warsaw 24/25 Oct 2026 (25 h night)",
    site: { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 0, timeZone: "Europe/Warsaw" },
    night: "2026-10-24",
    civilDawn: "2026-10-25T04:44:00Z",
    sunrise: "2026-10-25T05:19:00Z",
  },
  {
    label: "Warsaw 28/29 Mar 2026 (23 h night)",
    site: { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 0, timeZone: "Europe/Warsaw" },
    night: "2026-03-28",
    civilDawn: "2026-03-29T03:44:00Z",
    sunrise: "2026-03-29T04:18:00Z",
  },
  {
    label: "Los Angeles 31 Oct / 1 Nov 2026 (month end, 25 h night)",
    site: { latitudeDeg: 34.05, longitudeDeg: -118.24, elevationM: 0, timeZone: "America/Los_Angeles" },
    night: "2026-10-31",
    civilDawn: "2026-11-01T13:47:00Z",
    sunrise: "2026-11-01T14:13:00Z",
  },
  {
    label: "Auckland 24/25 Oct 2026 (UTC+13)",
    site: { latitudeDeg: -36.85, longitudeDeg: 174.76, elevationM: 0, timeZone: "Pacific/Auckland" },
    night: "2026-10-24",
    civilDawn: "2026-10-24T16:57:00Z",
    sunrise: "2026-10-24T17:24:00Z",
  },
  {
    label: "Kiritimati 24/25 Oct 2026 (UTC+14)",
    site: { latitudeDeg: 1.87, longitudeDeg: -157.4, elevationM: 0, timeZone: "Pacific/Kiritimati" },
    night: "2026-10-24",
    civilDawn: "2026-10-24T15:51:00Z",
    sunrise: "2026-10-24T16:12:00Z",
  },
];
