import type { ObservingNight } from "./types";

/**
 * Observing-night model: local noon on the evening date to local noon the next day, expressed
 * as UTC instants. Uses only `Intl` (no time-zone library); both Node and the Workers runtime
 * ship full IANA data.
 */

const DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/**
 * Parses `YYYY-MM-DD` and rejects both malformed strings and impossible calendar days.
 * `Date.UTC` would silently roll "2026-13-40" forward, so the round-trip is checked explicitly.
 */
export function parseCalendarDate(date: string): CalendarDate {
  const match = DATE_SHAPE.exec(date);
  if (match === null) {
    throw new RangeError(`Invalid date "${date}": expected YYYY-MM-DD`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new RangeError(`Invalid date "${date}": not a real calendar day`);
  }
  return { year, month, day };
}

function formatCalendarDate(d: CalendarDate): string {
  const mm = String(d.month).padStart(2, "0");
  const dd = String(d.day).padStart(2, "0");
  return `${d.year}-${mm}-${dd}`;
}

/** Adds `n` calendar days to a `YYYY-MM-DD` string. */
export function addDays(date: string, n: number): string {
  const d = parseCalendarDate(date);
  const shifted = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return formatCalendarDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

/**
 * Reads the wall clock of `instantMs` in `timeZone` and re-encodes it as if it were UTC.
 * The difference to `instantMs` is the zone's UTC offset at that instant.
 * Throws `RangeError` for an unknown zone (from `Intl.DateTimeFormat`).
 */
function wallClockAsUtcMs(instantMs: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(instantMs));
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    if (part === undefined) {
      throw new Error(`Intl.DateTimeFormat returned no "${type}" part for zone ${timeZone}`);
    }
    return Number(part.value);
  };
  return Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
}

/**
 * The UTC instant whose wall clock reads 12:00:00 on `date` in `timeZone`.
 * Noon is never inside a DST transition, so one offset correction suffices; the result is
 * re-checked and corrected once more defensively.
 */
export function localNoon(date: string, timeZone: string): Date {
  const d = parseCalendarDate(date);
  const guessMs = Date.UTC(d.year, d.month - 1, d.day, 12, 0, 0);
  let noonMs = guessMs - (wallClockAsUtcMs(guessMs, timeZone) - guessMs);
  const check = wallClockAsUtcMs(noonMs, timeZone);
  if (check !== guessMs) {
    noonMs -= check - guessMs;
  }
  return new Date(noonMs);
}

/**
 * Builds the observing night of `date` (site-local evening date) in `timeZone`.
 * Throws on a malformed or impossible date and on an unknown zone.
 */
export function observingNight(date: string, timeZone: string): ObservingNight {
  const start = localNoon(date, timeZone);
  const end = localNoon(addDays(date, 1), timeZone);
  return { date, timeZone, start, end };
}
