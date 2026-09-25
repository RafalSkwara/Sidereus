import type { HorizontalPosition, ObjectScore, ScoreComponent, Verdict } from "@/lib/engine";

/**
 * Display formatting for the Tonight view: times, directions and the fixed phrase templates. Every
 * time is formatted with an explicit time zone (the site's), never the server's. Each phrase has
 * exactly one template, so the same inputs always read the same way.
 */

const MINUTE_MS = 60_000;

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
