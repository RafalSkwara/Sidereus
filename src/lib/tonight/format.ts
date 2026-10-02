import { getMessages, plural, type MessageKey, type Messages } from "@/i18n";
import type {
  CloudOutlook,
  DarkWindow,
  HorizontalPosition,
  Interval,
  MoonPhaseBand,
  MoonPlacement,
  NextNight,
  ObjectScore,
  PlanetFacts,
  PlanetKey,
  PlanetPlacement,
  PlanetTiming,
  ScoreComponent,
  SeenSummary,
  Verdict,
} from "@/lib/engine";
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

/** What the planet reason line needs about a ranked planet. The engine's `PlanetEntry` is assignable to it. */
export interface PlanetReasonEntry {
  placement: PlanetPlacement;
  timing: PlanetTiming;
  peak: Pick<HorizontalPosition, "time">;
}

/** What the Moon's reason line needs. The engine's `MoonTargetEntry` is assignable to it. */
export interface MoonReasonEntry {
  placement: MoonPlacement;
  timing: PlanetTiming;
  peak: Pick<HorizontalPosition, "time" | "altitudeDeg">;
}

/** A planet's facts worded for its card; `phaseText` is set for Mercury and Venus, `ringText` for Saturn. */
export interface PlanetFactsText {
  magnitudeText: string;
  sizeText: string;
  phaseText: string | null;
  ringText: string | null;
}

/** The first night after tonight with a dark window, as `darkWindowReturn` finds it, or null. */
export type DarkReturn = { date: string; window: Interval } | null;

/**
 * When the Moon is up in the Moon card's window (moonlight-and-the-verdict), from a track over it: never, at every
 * sample, or for part of it. Each span runs from the first sample with the Moon up to the first sample with it down
 * again, or to the window's end; `upAtStart` is whether the first span starts at the window's start.
 */
export type MoonUp = { kind: "never" } | { kind: "all" } | { kind: "part"; spans: Interval[]; upAtStart: boolean };

/**
 * Which sky headline a verdict gets (moonlight-and-the-verdict): one per row of the plan's headline table. It keys
 * `verdict.inline`, the headlines' lowercase forms.
 */
type SkyHeadlineId = keyof Messages["verdict"]["inline"];

/** The catalogue key of each sky headline; a no-darkness night reuses the card's "No dark window". */
export const SKY_HEADLINE_KEYS = {
  go: "verdict.level.go",
  marginal: "verdict.level.marginal",
  "no-go": "verdict.level.no-go",
  humidityCap: "verdict.sky.humidityCap",
  fallbackCap: "verdict.sky.fallbackCap",
  noForecast: "verdict.sky.noForecast",
  noDarkness: "tonight.card.noDarkWindow",
} as const satisfies Record<SkyHeadlineId, MessageKey>;

export type SkyHeadlineKey = (typeof SKY_HEADLINE_KEYS)[SkyHeadlineId];

/** A verdict's headline: its catalogue key (for tests and `data-sky-headline`) and its text in the locale. */
export interface SkyHeadline {
  key: SkyHeadlineKey;
  text: string;
}

/**
 * The headline row for a verdict, from its level and reason; the thresholds behind them are the verdict's own. A
 * cloudy reason without a single forecast hour in the dark window (`minCloudPct` null) is no forecast, not cloud:
 * nothing says the sky is overcast, only that no hour was forecast.
 */
function skyHeadlineId(verdict: Verdict): SkyHeadlineId {
  const reason = verdict.reason;
  switch (reason.kind) {
    case "clear-run":
      return verdict.level === "go" ? "go" : "marginal";
    case "humidity-cap":
      return "humidityCap";
    case "fallback-cap":
      return "fallbackCap";
    case "no-weather-data":
      return "noForecast";
    case "cloudy":
      return reason.minCloudPct === null ? "noForecast" : "no-go";
    case "no-darkness":
      return "noDarkness";
  }
}

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
  const shortNightDateFormat = new Intl.DateTimeFormat(tag, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const shortDateFormat = new Intl.DateTimeFormat(tag, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFormats = new Map<string, Intl.DateTimeFormat>();
  // Magnitudes always carry one decimal ("mag 0.0", "mag −2.4").
  const magnitudeFormat = new Intl.NumberFormat(tag, {
    useGrouping: false,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  // "19:00–20:00 and 05:00–06:00" / "19:00–20:00 i 05:00–06:00".
  const listFormat = new Intl.ListFormat(tag, { type: "conjunction" });

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

  /** The evening date `YYYY-MM-DD` as "Sat 24 Oct", for the seven-night strip. A calendar date, like `formatNightDate`. */
  function formatShortNightDate(date: string): string {
    const [year, month, day] = date.split("-").map(Number);
    return shortNightDateFormat.format(new Date(Date.UTC(year, month - 1, day)));
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
        return reason.moon[position];
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
   * The sky headline every surface shows for a verdict (moonlight-and-the-verdict): the verdict card, the strip,
   * the all-objects page. "Clear", "Partly clear", "Clear, but damp", "Clear (old forecast)", "No forecast",
   * "Cloudy" or "No dark window".
   */
  function skyHeadline(verdict: Verdict): SkyHeadline {
    const id = skyHeadlineId(verdict);
    const text: Record<SkyHeadlineId, string> = {
      go: m.verdict.level.go,
      marginal: m.verdict.level.marginal,
      "no-go": m.verdict.level["no-go"],
      humidityCap: m.verdict.sky.humidityCap,
      fallbackCap: m.verdict.sky.fallbackCap,
      noForecast: m.verdict.sky.noForecast,
      noDarkness: m.tonight.card.noDarkWindow,
    };
    return { key: SKY_HEADLINE_KEYS[id], text: text[id] };
  }

  /** The same headline in lowercase, for the middle of a sentence ("Next clearer night: Fri 9 Oct (partly clear)"). */
  function skyInline(verdict: Verdict): string {
    return m.verdict.inline[skyHeadlineId(verdict)];
  }

  /**
   * Why the verdict came out as it did, as a lowercase phrase the page puts after the headline
   * ("No forecast — no weather data").
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

  /** "4 faint objects are washed out by the Moon tonight" (moonlight-and-the-verdict); `null` when none is. */
  function washedOutLine(washedOutCount: number): string | null {
    if (washedOutCount === 0) {
      return null;
    }
    return plural(locale, washedOutCount, m.tonight.washedOut.line)({ count: num(washedOutCount) });
  }

  /**
   * The tag on a ranked object the log counts as seen (FR-018): "Seen 3 times – last 12 Sept 2026".
   * `lastNight` is a calendar date (`YYYY-MM-DD`), read in UTC so no time zone shifts it.
   */
  function seenLine(seen: SeenSummary): string {
    const date = shortDateFormat.format(new Date(`${seen.lastNight}T00:00:00Z`));
    return plural(locale, seen.count, m.tonight.object.seen)({ count: num(seen.count), date });
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

  /**
   * What a weather no-go night suggests next (FR-020), within the verdict horizon: "Next clearer night: Fri 9 Oct
   * (partly clear)". The night found is never a no-go, but it can be partly clear, so it is only "clearer".
   */
  function nextNightText(next: NextNight): string {
    const text = m.tonight.nextNight;
    if (next.kind === "found") {
      return text.found({ date: formatShortNightDate(next.date), sky: skyInline(next.verdict) });
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

  /**
   * A night's dark window as "19:05–04:40" on the wall clock of `timeZone`, or the no-darkness
   * wording. Each end is formatted at its own instant, so across a DST change the span reads as the
   * clock does (the night of 24-25 Oct 2026 in Warsaw starts in CEST and ends in CET).
   */
  function darkSpanText(window: DarkWindow, timeZone: string): string {
    if (window.kind === "none") {
      return m.tonight.nights.noDarkness;
    }
    return `${formatTime(window.start, timeZone)}–${formatTime(window.end, timeZone)}`;
  }

  /**
   * The strip's moon line: illumination in whole percent, then how much of the dark window the Moon
   * is below the horizon ("Moon 62% · 3 h 10 min moon-free"), with its own wording when that is none
   * or all of it. Without a dark window (`moonFreeMinutes` null) only the illumination.
   */
  function moonLine(
    moon: { illuminatedFraction: number; moonFreeMinutes: number | null },
    darkWindow: DarkWindow,
  ): string {
    const text = m.tonight.nights;
    const phase = text.moon({ percent: num(Math.round(moon.illuminatedFraction * 100)) });
    if (moon.moonFreeMinutes === null || darkWindow.kind === "none") {
      return phase;
    }
    // `moonFreeMinutes` counts whole minutes, so a moonless window equals the window's whole minutes.
    const darkMinutes = Math.floor((darkWindow.end.getTime() - darkWindow.start.getTime()) / MINUTE_MS);
    if (moon.moonFreeMinutes <= 0) {
      return text.moonAllNight({ moon: phase });
    }
    if (moon.moonFreeMinutes >= darkMinutes) {
      return text.moonNone({ moon: phase });
    }
    return text.moonFree({ moon: phase, duration: formatDuration(moon.moonFreeMinutes * MINUTE_MS) });
  }

  /** A cloud percentage rounded to the nearest 10%, as the strip shows it: 34 → "30", 35 → "40". */
  function roundedCloud(pct: number): string {
    return num(Math.round(pct / 10) * 10);
  }

  /**
   * The cloud outlook for a night past the verdict horizon: "Cloud ~50%, down to 0%" (mean and the
   * clearest hour), only "Cloud ~40%" when both round alike, or "No cloud outlook yet" without
   * forecast hours spanning the dark window. Call it only for a night with a dark window.
   */
  function cloudOutlookText(cloud: CloudOutlook | null): string {
    const text = m.tonight.nights;
    if (cloud === null) {
      return text.noCloud;
    }
    const mean = roundedCloud(cloud.meanCloudPct);
    const min = roundedCloud(cloud.minCloudPct);
    return mean === min ? text.cloud({ mean }) : text.cloudRange({ mean, min });
  }

  /**
   * A planet's magnitude, apparent size, phase (Mercury and Venus) and ring tilt (Saturn), each worded on its
   * own: "mag −2.4", "44″", "62% lit", "rings tilted 4°". The magnitude takes a true minus sign; a size under
   * 10″ keeps one decimal (Uranus, Neptune), a larger one is whole.
   */
  function planetFactsText(key: PlanetKey, facts: PlanetFacts): PlanetFactsText {
    const text = m.tonight.planets;
    const mag = Math.round(facts.magnitude * 10) / 10;
    const diameter = facts.apparentDiameterArcsec;
    const arcsec = diameter < 10 ? Math.round(diameter * 10) / 10 : Math.round(diameter);
    return {
      magnitudeText: text.magnitude({ mag: magnitudeFormat.format(mag === 0 ? 0 : mag).replace("-", "\u2212") }),
      sizeText: text.size({ arcsec: num(arcsec) }),
      phaseText:
        key === "mercury" || key === "venus"
          ? text.phase({ percent: num(Math.round(facts.phaseFraction * 100)) })
          : null,
      ringText:
        facts.ringTiltDeg === null ? null : text.rings({ degrees: num(Math.round(Math.abs(facts.ringTiltDeg))) }),
    };
  }

  /**
   * Why and when to look at a planet, by its placement and the third of the planet window that holds its peak:
   * "High around 22:10 — best in the middle of the night". Low placements carry the warning that a clear view low
   * down is needed. No direction here: the card's best line already gives the 16-point direction, and an 8-wind
   * phrase beside it could disagree (ESE vs "east").
   */
  function planetReasonLine(entry: PlanetReasonEntry, timeZone: string): string {
    return m.tonight.planets.reason[entry.placement][entry.timing]({ time: formatTime(entry.peak.time, timeZone) });
  }

  /**
   * The planet window, civil dusk to civil dawn, as "From civil dusk to dawn, 19:32–06:51". Each end is
   * formatted at its own instant, as in `darkSpanText`.
   */
  function planetWindowText(window: Interval, timeZone: string): string {
    return m.tonight.planets.window({
      start: formatTime(window.start, timeZone),
      end: formatTime(window.end, timeZone),
    });
  }

  /**
   * The planet window's own weather, for when the verdict card does not cover it (a no-go, no dark window, or a
   * planet verdict of another level), led by its sky headline in lowercase: "For planets: partly clear — 1 h in a
   * row with at most 5% cloud between dusk and dawn". With `clear` (the planets are limited to the planet window's
   * clear hours) the clear hours are named instead of the run, in the site's time zone: "For planets: partly clear
   * — clear 19:00–20:00 and 05:00–06:00".
   * `buildTonight` calls it only for a go or marginal planet window; the no-go reasons fall back to the verdict
   * card's wording.
   */
  function planetWeatherText(
    planetVerdict: Verdict,
    clear: { intervals: readonly Interval[]; timeZone: string } | null = null,
  ): string {
    const text = m.tonight.planets.weather;
    const reason = planetVerdict.reason;
    const hours =
      clear === null
        ? null
        : listFormat.format(
            clear.intervals.map(
              (interval) => `${formatTime(interval.start, clear.timeZone)}–${formatTime(interval.end, clear.timeZone)}`,
            ),
          );
    let phrase: string;
    switch (reason.kind) {
      case "clear-run":
        phrase =
          hours === null
            ? text.clearRun({ hours: num(reason.runHours), cloud: num(reason.cloudPct) })
            : text.clearHours({ hours });
        break;
      case "humidity-cap":
        phrase =
          hours === null
            ? text.humidityCap({ humidity: num(reason.maxHumidityPct) })
            : text.clearHoursHumid({ hours, humidity: num(reason.maxHumidityPct) });
        break;
      case "fallback-cap":
        phrase =
          hours === null
            ? text.fallbackCap({ hours: num(reason.runHours), cloud: num(reason.cloudPct) })
            : text.clearHoursFallback({ hours });
        break;
      case "no-weather-data":
        phrase = text.noWeatherData;
        break;
      case "cloudy":
      case "no-darkness":
        phrase = verdictReasonText(planetVerdict);
        break;
    }
    return text.line({ sky: skyInline(planetVerdict), reason: phrase });
  }

  /** The Moon's phase band and illumination: "Waxing gibbous · 78% lit". `fraction` is [0, 1], shown in whole percent. */
  function moonPhaseText(band: MoonPhaseBand, fraction: number): string {
    const text = m.tonight.moon;
    return text.phaseLine({ phase: text.phase[band], lit: text.lit({ percent: num(Math.round(fraction * 100)) }) });
  }

  /**
   * When to look at the Moon: its highest point in the best window and the third of the window that holds it,
   * "Highest 42° at 23:10 — best in the middle of the night", with the low wording below `MOON_LOW_ALTITUDE_DEG`
   * (the engine's "low" placement). No direction, as for planets: the card's best line already gives it.
   */
  function moonReasonLine(entry: MoonReasonEntry, timeZone: string): string {
    const text = m.tonight.moon.reason;
    const params = {
      // The low wording rounds down, so a peak just under `MOON_LOW_ALTITUDE_DEG` never reads as the threshold itself.
      altitude: num(
        entry.placement === "low" ? Math.floor(entry.peak.altitudeDeg) : Math.round(entry.peak.altitudeDeg),
      ),
      time: formatTime(entry.peak.time, timeZone),
      timing: text.timing[entry.timing],
    };
    return entry.placement === "low" ? text.low(params) : text.line(params);
  }

  /** The Moon's up spans as "22:10–06:58", or "19:05–20:10 and 04:30–06:58", in the site's time zone. */
  function moonSpansText(spans: readonly Interval[], timeZone: string): string {
    return listFormat.format(
      spans.map((span) => `${formatTime(span.start, timeZone)}–${formatTime(span.end, timeZone)}`),
    );
  }

  /**
   * The Moon card's "when it's up" line: "Up all night", "Sets 01:30" (up at the window's start, then down for the
   * rest), "Up 22:10–06:58" for any other part, or "Not up tonight".
   */
  function moonUpText(up: MoonUp, timeZone: string): string {
    const text = m.tonight.moon.card.up;
    switch (up.kind) {
      case "never":
        return text.never;
      case "all":
        return text.all;
      case "part":
        return up.upAtStart && up.spans.length === 1
          ? text.sets({ time: formatTime(up.spans[0].end, timeZone) })
          : text.spans({ spans: moonSpansText(up.spans, timeZone) });
    }
  }

  /**
   * The Moon card's faint-objects line, for a night the ranking runs: "Bright Moon: 4 faint objects washed
   * out tonight" when the Moon washes any out, else by how long the Moon is up: "Moon
   * up 22:10–03:40 · no faint objects washed out", "Moonlit sky · no faint objects lost" or "Dark night: no Moon".
   */
  function moonFaintText(up: MoonUp, washedOutCount: number, timeZone: string): string {
    const text = m.tonight.moon.card.faint;
    if (washedOutCount > 0) {
      return plural(locale, washedOutCount, text.washedOut)({ count: num(washedOutCount) });
    }
    switch (up.kind) {
      case "never":
        return text.dark;
      case "all":
        return text.moonlit;
      case "part":
        return text.unaffected({ spans: moonSpansText(up.spans, timeZone) });
    }
  }

  return {
    formatTime,
    formatNightDate,
    formatShortNightDate,
    darkSpanText,
    moonLine,
    cloudOutlookText,
    formatDuration,
    compassPoint,
    formatDirection,
    reasonLine,
    skyHeadline,
    verdictReasonText,
    clearedLine,
    washedOutLine,
    seenLine,
    formatAge,
    forecastStatusText,
    nextNightText,
    noDarknessCauseText,
    darkReturnText,
    planetFactsText,
    planetReasonLine,
    planetWindowText,
    planetWeatherText,
    moonPhaseText,
    moonReasonLine,
    moonUpText,
    moonFaintText,
  };
}

export type TonightFormatter = ReturnType<typeof createFormatter>;
