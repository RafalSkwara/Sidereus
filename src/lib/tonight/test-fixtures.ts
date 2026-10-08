import type { HourlyForecast } from "@/lib/engine";
import type { ForecastResult } from "@/lib/forecast/service";
import type { EyepieceRecord, SiteRecord, TelescopeRecord } from "@/lib/gear/store";

/**
 * Shared Tonight test fixtures: Warsaw, a 150/750 reflector, two Plössls and an early-evening instant. Test-only;
 * nothing in the app imports this file.
 */

export const WARSAW: SiteRecord = {
  id: "site-1",
  name: "Home",
  latitudeDeg: 52.23,
  longitudeDeg: 21.01,
  bortle: 6,
  minAltitudeDeg: 15,
  timeZone: "Europe/Warsaw",
  timeZoneSource: "auto",
  createdAt: "2026-09-01T00:00:00Z",
};

export const TELESCOPE: TelescopeRecord = {
  id: "scope-1",
  name: "Skywatcher 150P",
  apertureMm: 150,
  focalLengthMm: 750,
  createdAt: "2026-09-01T00:00:00Z",
};

export const EYEPIECES: EyepieceRecord[] = [
  { id: "ep-1", name: "25 mm Plössl", focalLengthMm: 25, afovDeg: 52, createdAt: "2026-09-01T00:00:00Z" },
  { id: "ep-2", name: "10 mm Plössl", focalLengthMm: 10, afovDeg: 52, createdAt: "2026-09-01T00:01:00Z" },
];

/**
 * Early evening in Warsaw on 2026-10-10 (20:00 CEST), already inside night 1's dark window at Bortle 6 (from about
 * 17:25 UTC).
 */
export const NOW = new Date("2026-10-10T18:00:00Z");

const HOUR_MS = 3_600_000;

/** `HH:mm` of the UTC wall clock `offsetHours` ahead of `instant`. */
export function utcWallTime(instant: Date, offsetHours: number): string {
  return new Date(instant.getTime() + offsetHours * HOUR_MS).toISOString().slice(11, 16);
}

/** Hourly forecast from `fromUtc` for `hours` hours, each hour's cloud cover given by `cloudPct`. */
export function hourlyForecast(fromUtc: string, hours: number, cloudPct: (start: Date) => number): HourlyForecast {
  const from = Date.parse(fromUtc);
  return {
    hours: Array.from({ length: hours }, (_, i) => {
      const start = new Date(from + i * HOUR_MS);
      return { start, cloudCoverPct: cloudPct(start), humidityPct: 60 };
    }),
  };
}

/** Hourly forecast from 00:00 UTC on `fromUtc` for 48 h, every hour at `cloudPct`. */
export function uniformForecast(fromUtc: string, cloudPct: number): HourlyForecast {
  return hourlyForecast(fromUtc, 48, () => cloudPct);
}

/** A service result fetched 20 min before `NOW`, fresh unless `fallback`. */
export function result(
  forecast: HourlyForecast,
  fallback = false,
  fetchedAt = new Date(NOW.getTime() - 20 * 60_000),
): ForecastResult {
  return { forecast, fetchedAt, fallback };
}
