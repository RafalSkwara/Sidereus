import type { HorizontalPosition, Interval, NextNight, ObjectScore, ScoreComponent, Verdict } from "@/lib/engine";

/**
 * Display formatting for the Tonight view: times, directions and the fixed phrase templates. Every
 * time is formatted with an explicit time zone (the site's), never the server's. Each phrase has
 * exactly one template, so the same inputs always read the same way.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const COMPASS_POINTS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

/** `HH:mm`, 24-hour, as the wall clock reads in `timeZone`. */
export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** The evening date `YYYY-MM-DD` as "Saturday, 10 October 2026". It is a calendar date, not an instant. */
export function formatNightDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** A duration as "5 h 10 min", "5 h" or "40 min", rounded to the minute. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / MINUTE_MS));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/** The 16-wind compass point for an azimuth in degrees clockwise from north. */
export function compassPoint(azimuthDeg: number): string {
  const normalized = ((azimuthDeg % 360) + 360) % 360;
  return COMPASS_POINTS[Math.round(normalized / 22.5) % COMPASS_POINTS.length];
}

/** "SW, 45°": compass point and altitude in whole degrees. */
export function formatDirection(position: Pick<HorizontalPosition, "azimuthDeg" | "altitudeDeg">): string {
  return `${compassPoint(position.azimuthDeg)}, ${Math.round(position.altitudeDeg)}°`;
}

/** What the reason line needs about a ranked entry. The engine's `RankedEntry` is assignable to it. */
export interface ReasonEntry {
  object: { vMag: number };
  score: Pick<ObjectScore, "window" | "components">;
  leadComponent: ScoreComponent;
  secondComponent: ScoreComponent;
}

export interface ReasonContext {
  apertureMm: number;
  bortle: number;
}

function componentPhrase(component: ScoreComponent, entry: ReasonEntry, context: ReasonContext): string {
  switch (component) {
    case "duration":
      return `up for ${formatDuration(entry.score.window.end.getTime() - entry.score.window.start.getTime())} of the dark window`;
    case "moon":
      return `${Math.round(entry.score.components.moon * 100)}% clear of moonlight`;
    case "brightness":
      return `bright for your ${context.apertureMm} mm`;
    case "sky":
      return `holds up under your Bortle ${context.bortle} sky`;
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The FR-015 reason line: the leading component's phrase, then the runner-up's, e.g.
 * "Up for 5 h 10 min of the dark window · bright for your 150 mm".
 */
export function reasonLine(entry: ReasonEntry, context: ReasonContext): string {
  const lead = capitalize(componentPhrase(entry.leadComponent, entry, context));
  return `${lead} · ${componentPhrase(entry.secondComponent, entry, context)}`;
}

/**
 * Why the verdict came out as it did, as a lowercase phrase the page puts after the level
 * ("marginal — no weather data").
 */
export function verdictReasonText(verdict: Verdict): string {
  const reason = verdict.reason;
  switch (reason.kind) {
    case "clear-run":
      return `${reason.runHours} h in a row with at most ${reason.cloudPct}% cloud in the dark window`;
    case "humidity-cap":
      return `clear enough, but humidity reaches ${reason.maxHumidityPct}%, so expect dew and haze`;
    case "fallback-cap":
      return `the last saved forecast showed ${reason.runHours} h in a row with at most ${reason.cloudPct}% cloud, but it could not be refreshed`;
    case "cloudy":
      return reason.minCloudPct === null
        ? "no forecast covers the dark window"
        : `too cloudy: the clearest dark hour has ${reason.minCloudPct}% cloud`;
    case "no-weather-data":
      return "no weather data";
    case "no-darkness":
      return "the sky never gets dark enough tonight";
  }
}

/** The ranking headline: how many objects cleared the minimum score (FR-013). */
export function clearedLine(clearedCount: number): string {
  if (clearedCount === 0) {
    return "No object cleared the bar tonight";
  }
  return clearedCount === 1 ? "1 object cleared the bar tonight" : `${clearedCount} objects cleared the bar tonight`;
}

/**
 * How old something is, for "… ago": "less than a minute" under a minute (a negative age, from a
 * clock skew, reads the same), then whole minutes, whole hours under 48 h, and whole days. Every
 * unit is truncated, so an age never reads older than it is.
 */
export function formatAge(ms: number): string {
  if (ms < MINUTE_MS) {
    return "less than a minute";
  }
  if (ms < HOUR_MS) {
    return `${Math.trunc(ms / MINUTE_MS)} min`;
  }
  if (ms < 2 * DAY_MS) {
    return `${Math.trunc(ms / HOUR_MS)} h`;
  }
  return `${Math.trunc(ms / DAY_MS)} days`;
}

/**
 * Where tonight's weather came from: a fresh forecast, a saved copy served because the refresh
 * failed, or nothing. `ageMs` is how long ago the forecast was fetched.
 */
export type ForecastStatus = { kind: "fresh"; ageMs: number } | { kind: "fallback"; ageMs: number } | { kind: "none" };

/** The forecast line shown under the dark window (NFR forecast outage). */
export function forecastStatusText(status: ForecastStatus): string {
  switch (status.kind) {
    case "fresh":
      return `Forecast updated ${formatAge(status.ageMs)} ago`;
    case "fallback":
      return `Weather service unreachable — showing the forecast from ${formatAge(status.ageMs)} ago`;
    case "none":
      return "No weather data — the weather service could not be reached and no earlier forecast is saved";
  }
}

/** What a weather no-go night suggests next (FR-020), within the verdict horizon. */
export function nextNightText(next: NextNight): string {
  if (next.kind === "found") {
    return `Next night worth a look: ${formatNightDate(next.date)} — ${next.verdict.level}, ${verdictReasonText(next.verdict)}`;
  }
  return next.lastJudgedDate === null
    ? "The forecast doesn't reach past tonight, so there is no next night to suggest yet"
    : `No clear night in the forecast through ${formatNightDate(next.lastJudgedDate)}`;
}

export interface NoDarknessCause {
  latitudeDeg: number;
  /** The sun's lowest altitude tonight, from the dark window's `none` variant. */
  minSunAltitudeDeg: number;
  /** The Bortle-dependent darkness threshold, negative degrees. */
  thresholdDeg: number;
  bortle: number;
}

/**
 * Why there is no dark window tonight (FR-023): latitude, season and how far the sun sinks against
 * the site's threshold. The latitude is rounded to the whole degree and appears only on the user's
 * own page, never in a URL or a log. The sinking depth is truncated, so it always reads as short of
 * the threshold (−17.8° at −18° reads 17°).
 */
export function noDarknessCauseText({ latitudeDeg, minSunAltitudeDeg, thresholdDeg, bortle }: NoDarknessCause): string {
  const latitude = `${Math.round(Math.abs(latitudeDeg))}° ${latitudeDeg < 0 ? "S" : "N"}`;
  if (minSunAltitudeDeg >= 0) {
    return `At ${latitude} at this time of year the sun stays above the horizon all night`;
  }
  const depth = Math.trunc(Math.abs(minSunAltitudeDeg));
  return `At ${latitude} at this time of year the sun only sinks ${depth}° below the horizon, short of the ${Math.abs(thresholdDeg)}° your Bortle ${bortle} sky needs`;
}

/** The first night after tonight with a dark window, as `darkWindowReturn` finds it, or null. */
export type DarkReturn = { date: string; window: Interval } | null;

/** When the dark window comes back (FR-023), with that night's window in the site's time zone. */
export function darkReturnText(result: DarkReturn, timeZone: string): string {
  if (result === null) {
    return "It does not return within the next year";
  }
  const start = formatTime(result.window.start, timeZone);
  const end = formatTime(result.window.end, timeZone);
  return `The dark window returns on the night of ${formatNightDate(result.date)} (${start}–${end})`;
}
