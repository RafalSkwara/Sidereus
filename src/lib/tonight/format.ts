import { getMessages, plural } from "@/i18n";
import type { HorizontalPosition, Interval, NextNight, ObjectScore, ScoreComponent, Verdict } from "@/lib/engine";
import type { Locale } from "@/lib/preferences";

/**
 * Display formatting for the Tonight view: times, directions and the fixed phrase templates. Every
 * time is formatted with an explicit time zone (the site's), never the server's. Each phrase has
 * exactly one template per locale, so the same inputs always read the same way. The wording comes
 * from the message catalogue; this module only picks the message and formats its numbers.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

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

/**
 * Where tonight's weather came from: a fresh forecast, a saved copy served because the refresh
 * failed, or nothing. `ageMs` is how long ago the forecast was fetched.
 */
export type ForecastStatus = { kind: "fresh"; ageMs: number } | { kind: "fallback"; ageMs: number } | { kind: "none" };

export interface NoDarknessCause {
  latitudeDeg: number;
  /** The sun's lowest altitude tonight, from the dark window's `none` variant. */
  minSunAltitudeDeg: number;
  /** The Bortle-dependent darkness threshold, negative degrees. */
  thresholdDeg: number;
  bortle: number;
}

/** The first night after tonight with a dark window, as `darkWindowReturn` finds it, or null. */
export type DarkReturn = { date: string; window: Interval } | null;

/** The BCP 47 tag used for dates, times and numbers. */
export function formatLocaleTag(locale: Locale): string {
  return locale === "pl" ? "pl-PL" : "en-GB";
}

/**
 * The Tonight formatters for one locale. Create one per request and reuse it: the `Intl` formatters
 * are built once here.
 */
export function createFormatter(locale: Locale) {
  const m = getMessages(locale);
  const tag = formatLocaleTag(locale);

  // Stored values carry at most one decimal (numeric(6, 1)); no grouping, so 1000 mm stays "1000".
  const numberFormat = new Intl.NumberFormat(tag, { useGrouping: false, maximumFractionDigits: 1 });
  const nightDateFormat = new Intl.DateTimeFormat(tag, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeFormats = new Map<string, Intl.DateTimeFormat>();

  /** A number in the locale's notation; `-0` reads as "0". */
  function num(n: number): string {
    return numberFormat.format(n === 0 ? 0 : n);
  }

  /** `HH:mm`, 24-hour, as the wall clock reads in `timeZone`. */
  function formatTime(date: Date, timeZone: string): string {
    let format = timeFormats.get(timeZone);
    if (!format) {
      format = new Intl.DateTimeFormat(tag, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      timeFormats.set(timeZone, format);
    }
    return format.format(date);
  }

  /** The evening date `YYYY-MM-DD` as "Saturday, 10 October 2026". It is a calendar date, not an instant. */
  function formatNightDate(date: string): string {
    const [year, month, day] = date.split("-").map(Number);
    return nightDateFormat.format(new Date(Date.UTC(year, month - 1, day)));
  }

  /** A duration as "5 h 10 min", "5 h" or "40 min", rounded to the minute. */
  function formatDuration(ms: number): string {
    const totalMinutes = Math.max(0, Math.round(ms / MINUTE_MS));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) {
      return m.tonight.time.minutes({ minutes: num(minutes) });
    }
    return minutes === 0
      ? m.tonight.time.hours({ hours: num(hours) })
      : m.tonight.time.hoursMinutes({ hours: num(hours), minutes: num(minutes) });
  }

  /** The 16-wind compass point for an azimuth in degrees clockwise from north. */
  function compassPoint(azimuthDeg: number): string {
    const normalized = ((azimuthDeg % 360) + 360) % 360;
    return m.compass[Math.round(normalized / 22.5) % m.compass.length];
  }

  /** "SW, 45°": compass point and altitude in whole degrees. */
  function formatDirection(position: Pick<HorizontalPosition, "azimuthDeg" | "altitudeDeg">): string {
    return m.tonight.direction({
      point: compassPoint(position.azimuthDeg),
      altitude: num(Math.round(position.altitudeDeg)),
    });
  }

  function componentPhrase(
    component: ScoreComponent,
    entry: ReasonEntry,
    context: ReasonContext,
    position: "lead" | "follow",
  ): string {
    const reason = m.tonight.reason;
    switch (component) {
      case "duration":
        return reason.duration[position]({
          duration: formatDuration(entry.score.window.end.getTime() - entry.score.window.start.getTime()),
        });
      case "moon":
        return reason.moon[position]({ percent: num(Math.round(entry.score.components.moon * 100)) });
      case "brightness":
        return reason.brightness[position]({ aperture: num(context.apertureMm) });
      case "sky":
        return reason.sky[position]({ bortle: num(context.bortle) });
    }
  }

  /**
   * The FR-015 reason line: the leading component's phrase, then the runner-up's, e.g.
   * "Up for 5 h 10 min of the dark window · bright for your 150 mm".
   */
  function reasonLine(entry: ReasonEntry, context: ReasonContext): string {
    return m.tonight.reason.line({
      lead: componentPhrase(entry.leadComponent, entry, context, "lead"),
      second: componentPhrase(entry.secondComponent, entry, context, "follow"),
    });
  }

  /**
   * Why the verdict came out as it did, as a lowercase phrase the page puts after the level
   * ("marginal — no weather data").
   */
  function verdictReasonText(verdict: Verdict): string {
    const reason = verdict.reason;
    const text = m.tonight.verdictReason;
    switch (reason.kind) {
      case "clear-run":
        return text.clearRun({ hours: num(reason.runHours), cloud: num(reason.cloudPct) });
      case "humidity-cap":
        return text.humidityCap({ humidity: num(reason.maxHumidityPct) });
      case "fallback-cap":
        return text.fallbackCap({ hours: num(reason.runHours), cloud: num(reason.cloudPct) });
      case "cloudy":
        return reason.minCloudPct === null ? text.noForecast : text.cloudy({ cloud: num(reason.minCloudPct) });
      case "no-weather-data":
        return text.noWeatherData;
      case "no-darkness":
        return text.noDarkness;
    }
  }

  /** The ranking headline: how many objects cleared the minimum score (FR-013). */
  function clearedLine(clearedCount: number): string {
    if (clearedCount === 0) {
      return m.tonight.cleared.none;
    }
    return plural(locale, clearedCount, m.tonight.cleared.count)({ count: num(clearedCount) });
  }

  /**
   * How old something is, for "… ago": "less than a minute" under a minute (a negative age, from a
   * clock skew, reads the same), then whole minutes, whole hours under 48 h, and whole days. Every
   * unit is truncated, so an age never reads older than it is.
   */
  function formatAge(ms: number): string {
    const age = m.tonight.age;
    if (ms < MINUTE_MS) {
      return age.lessThanMinute;
    }
    if (ms < HOUR_MS) {
      return age.minutes({ minutes: num(Math.trunc(ms / MINUTE_MS)) });
    }
    if (ms < 2 * DAY_MS) {
      return age.hours({ hours: num(Math.trunc(ms / HOUR_MS)) });
    }
    const days = Math.trunc(ms / DAY_MS);
    return plural(locale, days, age.days)({ count: num(days) });
  }

  /** The forecast line shown under the dark window (NFR forecast outage). */
  function forecastStatusText(status: ForecastStatus): string {
    switch (status.kind) {
      case "fresh":
        return m.tonight.forecast.fresh({ age: formatAge(status.ageMs) });
      case "fallback":
        return m.tonight.forecast.fallback({ age: formatAge(status.ageMs) });
      case "none":
        return m.tonight.forecast.none;
    }
  }

  /** What a weather no-go night suggests next (FR-020), within the verdict horizon. */
  function nextNightText(next: NextNight): string {
    const text = m.tonight.nextNight;
    if (next.kind === "found") {
      return text.found({
        date: formatNightDate(next.date),
        level: text.level[next.verdict.level],
        reason: verdictReasonText(next.verdict),
      });
    }
    return next.lastJudgedDate === null
      ? text.beyondForecast
      : text.noneThrough({ date: formatNightDate(next.lastJudgedDate) });
  }

  /**
   * Why there is no dark window tonight (FR-023): latitude, season and how far the sun sinks against
   * the site's threshold. The latitude is rounded to the whole degree and appears only on the user's
   * own page, never in a URL or a log. The sinking depth is truncated, so it always reads as short of
   * the threshold (−17.8° at −18° reads 17°).
   */
  function noDarknessCauseText({ latitudeDeg, minSunAltitudeDeg, thresholdDeg, bortle }: NoDarknessCause): string {
    const text = m.tonight.noDarkness;
    const latitude = text.latitude({
      degrees: num(Math.round(Math.abs(latitudeDeg))),
      hemisphere: latitudeDeg < 0 ? text.south : text.north,
    });
    if (minSunAltitudeDeg >= 0) {
      return text.sunUp({ latitude });
    }
    return text.shallow({
      latitude,
      depth: num(Math.trunc(Math.abs(minSunAltitudeDeg))),
      threshold: num(Math.abs(thresholdDeg)),
      bortle: num(bortle),
    });
  }

  /** When the dark window comes back (FR-023), with that night's window in the site's time zone. */
  function darkReturnText(result: DarkReturn, timeZone: string): string {
    if (result === null) {
      return m.tonight.darkReturn.never;
    }
    return m.tonight.darkReturn.on({
      date: formatNightDate(result.date),
      start: formatTime(result.window.start, timeZone),
      end: formatTime(result.window.end, timeZone),
    });
  }

  return {
    formatTime,
    formatNightDate,
    formatDuration,
    compassPoint,
    formatDirection,
    reasonLine,
    verdictReasonText,
    clearedLine,
    formatAge,
    forecastStatusText,
    nextNightText,
    noDarknessCauseText,
    darkReturnText,
  };
}

export type TonightFormatter = ReturnType<typeof createFormatter>;
