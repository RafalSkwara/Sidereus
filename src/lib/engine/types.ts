/**
 * Shared vocabulary of the sky engine. Everything here is plain data: the engine is pure
 * (no clock, environment or network), so callers pass every input explicitly.
 */

/** An observing location. Coordinates are rounded to ~1 km upstream; the engine does not round. */
export interface Site {
  latitudeDeg: number;
  longitudeDeg: number;
  /** Metres above sea level. Defaults to 0 when omitted. */
  elevationM?: number;
  /** IANA time zone id, e.g. "Europe/Warsaw". Supplied by the caller; the engine never looks it up. */
  timeZone: string;
}

/**
 * The "observing night of date D": from local noon on D to local noon on D+1 in the site's
 * time zone. It always contains exactly one sunset, at most one dark window and one sunrise,
 * and it survives the after-midnight case and the 25-hour DST night without special cases.
 */
export interface ObservingNight {
  /** Evening date, site-local, `YYYY-MM-DD`. */
  date: string;
  timeZone: string;
  /** Local noon on `date`, as a UTC instant. */
  start: Date;
  /** Local noon on the following calendar day, as a UTC instant. */
  end: Date;
}

export interface Interval {
  start: Date;
  end: Date;
}

/**
 * When the sky is dark enough to observe: the sun is below `thresholdDeg` (a Bortle-dependent
 * candidate parameter). `none` means the threshold is never reached that night, which is the
 * "no dark window this season" case (FR-023); it carries the sun's minimum altitude and when
 * it occurs so a caller can explain why.
 */
export type DarkWindow =
  | {
      kind: "window";
      thresholdDeg: number;
      start: Date;
      end: Date;
      /** True when the sun was already below the threshold at the night's start (polar night); `start` is the night's start. */
      clampedToNightStart: boolean;
      /** True when the sun was still below the threshold at the night's end; `end` is the night's end. */
      clampedToNightEnd: boolean;
    }
  | {
      kind: "none";
      thresholdDeg: number;
      minSunAltitudeDeg: number;
      /** Instant of the sun's lower culmination (its lowest point) during the night. */
      at: Date;
    };

/** Where something is in the observer's sky at one instant. Azimuth is degrees clockwise from north. */
export interface HorizontalPosition {
  time: Date;
  altitudeDeg: number;
  azimuthDeg: number;
}

/** J2000 equatorial coordinates of a fixed object, as stored in the catalogue. */
export interface EquatorialJ2000 {
  /** Right ascension in hours, [0, 24). */
  raHours: number;
  /** Declination in degrees, [-90, 90]. */
  decDeg: number;
}

/** One forecast hour, covering `[start, start + 1 h)`. Percentages are 0-100. */
export interface ForecastHour {
  start: Date;
  cloudCoverPct: number;
  humidityPct: number;
}

/**
 * Hourly weather for a site, as the verdict consumes it. Hours start on whole UTC hours; an hour
 * the provider did not report is simply absent (the verdict counts it as not clear).
 */
export interface HourlyForecast {
  hours: ForecastHour[];
}

export type VerdictLevel = "go" | "marginal" | "no-go";

/**
 * Why the verdict came out as it did, with what the UI needs to phrase it. Run lengths count
 * whole forecast hours that overlap the dark window.
 */
export type VerdictReason =
  /** A contiguous run of `runHours` hours cleared the level's cloud threshold; `cloudPct` is the cloudiest hour in it. */
  | { kind: "clear-run"; runHours: number; cloudPct: number }
  /** The clouds allowed a go, but at least one dark hour was above the humidity cap (dew, haze). */
  | { kind: "humidity-cap"; maxHumidityPct: number }
  /**
   * No run was long enough. `bestRunHours` is the longest run below the marginal cloud threshold;
   * `minCloudPct` is the least cloudy dark hour, or null when no dark hour has data.
   */
  | { kind: "cloudy"; bestRunHours: number; minCloudPct: number | null }
  /** No forecast was available; the verdict defaults to marginal. */
  | { kind: "no-weather-data" }
  /** The sun never gets low enough tonight for a dark window. */
  | { kind: "no-darkness" };

export interface Verdict {
  level: VerdictLevel;
  reason: VerdictReason;
}
