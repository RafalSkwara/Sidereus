import { VERDICT_THRESHOLDS } from "./parameters";
import type { DarkWindow, ForecastHour, HourlyForecast, Verdict } from "./types";

/**
 * The go / marginal / no-go verdict for one dark window (PRD Open Question 2). Pure: the forecast
 * is fetched elsewhere and passed in.
 *
 * The dark window is cut into the whole UTC hours that overlap it (forecast hours start on whole
 * UTC hours). An hour the forecast does not cover counts as not clear, so it breaks a run. Short
 * nights scale the required run down to the number of overlapping hours, so a 40-minute window
 * inside one clear hour can still be a go.
 */

const HOUR_MS = 3_600_000;

interface Run {
  hours: number;
  /** Cloudiest hour in the run; 0 for an empty run. */
  cloudPct: number;
}

/** The forecast hour for each whole UTC hour overlapping `[start, end)`, `undefined` where missing. */
function overlappingHours(start: Date, end: Date, forecast: HourlyForecast): (ForecastHour | undefined)[] {
  const byStart = new Map(forecast.hours.map((hour) => [hour.start.getTime(), hour]));
  const slots: (ForecastHour | undefined)[] = [];
  for (let t = Math.floor(start.getTime() / HOUR_MS) * HOUR_MS; t < end.getTime(); t += HOUR_MS) {
    slots.push(byStart.get(t));
  }
  return slots;
}

/** The longest contiguous run of hours with cloud cover strictly below `cloudPct` (the first on a tie). */
function longestRun(slots: readonly (ForecastHour | undefined)[], cloudPct: number): Run {
  let best: Run = { hours: 0, cloudPct: 0 };
  let current: Run = { hours: 0, cloudPct: 0 };
  for (const hour of slots) {
    if (hour === undefined || hour.cloudCoverPct >= cloudPct) {
      current = { hours: 0, cloudPct: 0 };
      continue;
    }
    current = { hours: current.hours + 1, cloudPct: Math.max(current.cloudPct, hour.cloudCoverPct) };
    if (current.hours > best.hours) {
      best = current;
    }
  }
  return best;
}

export function verdict(darkWindow: DarkWindow, forecast: HourlyForecast | null): Verdict {
  if (darkWindow.kind === "none") {
    return { level: "no-go", reason: { kind: "no-darkness" } };
  }
  if (forecast === null) {
    return { level: "marginal", reason: { kind: "no-weather-data" } };
  }

  const t = VERDICT_THRESHOLDS;
  const slots = overlappingHours(darkWindow.start, darkWindow.end, forecast);
  const n = slots.length;
  // At least one hour is always required, so an empty window can never pass.
  const required = (runHours: number): number => Math.max(1, Math.min(runHours, n));
  const present = slots.filter((hour): hour is ForecastHour => hour !== undefined);

  const goRun = longestRun(slots, t.goCloudPct);
  if (goRun.hours >= required(t.goRunHours)) {
    const maxHumidityPct = Math.max(...present.map((hour) => hour.humidityPct));
    if (maxHumidityPct > t.humidityCapPct) {
      return { level: "marginal", reason: { kind: "humidity-cap", maxHumidityPct } };
    }
    return { level: "go", reason: { kind: "clear-run", runHours: goRun.hours, cloudPct: goRun.cloudPct } };
  }

  const marginalRun = longestRun(slots, t.marginalCloudPct);
  if (marginalRun.hours >= required(t.marginalRunHours)) {
    return {
      level: "marginal",
      reason: { kind: "clear-run", runHours: marginalRun.hours, cloudPct: marginalRun.cloudPct },
    };
  }

  const minCloudPct = present.length === 0 ? null : Math.min(...present.map((hour) => hour.cloudCoverPct));
  return { level: "no-go", reason: { kind: "cloudy", bestRunHours: marginalRun.hours, minCloudPct } };
}
