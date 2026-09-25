import { MESSIER, type MessierObject } from "@/lib/catalogue";
import {
  darknessThresholdDegForBortle,
  darkWindow,
  darkWindowReturn,
  eyepieceOptics,
  nextNightNotNoGo,
  observingNight,
  observingNightDateFor,
  rankObjects,
  verdict,
  type RankedEntry,
  type Verdict,
} from "@/lib/engine";
import type { ForecastResult } from "@/lib/forecast/service";
import { toEngineSite, type EyepieceRecord, type SiteRecord, type TelescopeRecord } from "@/lib/gear/store";

import {
  clearedLine,
  darkReturnText,
  forecastStatusText,
  formatDirection,
  formatNightDate,
  formatTime,
  nextNightText,
  noDarknessCauseText,
  reasonLine,
  verdictReasonText,
  type ForecastStatus,
} from "./format";

/**
 * Composes the Tonight view: the stored gear, the forecast and `now` in, a view model the page
 * renders without logic out. Everything here is deterministic for identical inputs; the page reads
 * the clock and the forecast and passes them in.
 */

export interface TonightInput {
  site: SiteRecord;
  telescope: TelescopeRecord;
  /** In `created_at` order (pairing ties go to the earlier one). */
  eyepieces: readonly EyepieceRecord[];
  /**
   * The forecast service's result, or `null` when no forecast is available (the verdict then
   * defaults to marginal). A `fallback` copy caps the verdict at marginal.
   */
  forecast: ForecastResult | null;
  now: Date;
  /** The objects to rank; the Messier catalogue unless a test narrows it. */
  catalogue?: readonly MessierObject[];
}

export interface EyepieceLine {
  name: string;
  /** Whole-number magnification with the telescope. */
  magnification: number;
}

export type TonightPair =
  { kind: "pair"; finding: EyepieceLine; detail: EyepieceLine } | { kind: "none-fit"; widestName: string };

export interface TonightEntry {
  /** "M31" */
  id: string;
  commonName: string | null;
  /** IAU 3-letter abbreviation. */
  constellation: string;
  /** Best window, `HH:mm` in the site's time zone. */
  windowStart: string;
  windowEnd: string;
  /** Peak time, `HH:mm` in the site's time zone. */
  bestTime: string;
  /** Direction at the peak, "SW, 45°". */
  bestDirection: string;
  /** `null` when the kit has no eyepieces: the page leaves the pair line out. */
  pair: TonightPair | null;
  reason: string;
}

export interface TonightRanking {
  clearedCount: number;
  /** "N objects cleared the bar tonight", or "No object cleared the bar tonight". */
  clearedText: string;
  entries: TonightEntry[];
}

export type TonightDarkWindow = { kind: "window"; start: string; end: string } | { kind: "none" };

export interface TonightForecastStatus {
  kind: ForecastStatus["kind"];
  /** "Forecast updated 20 min ago", the outage wording, or "No weather data — …". */
  text: string;
}

/**
 * What the page shows where the ranking would have been: the next night worth a look after a
 * weather no-go (FR-020), or why there is no darkness and when it returns (FR-023).
 */
export type TonightExplanation =
  { kind: "weather-no-go"; nextText: string } | { kind: "no-darkness"; causeText: string; returnText: string };

export interface TonightView {
  siteName: string;
  telescopeName: string;
  /** Evening date of the observing night, `YYYY-MM-DD`, site-local. */
  date: string;
  /** "Saturday, 10 October 2026" */
  dateLabel: string;
  timeZone: string;
  verdict: Verdict;
  verdictText: string;
  /** Formatted in the site's time zone. */
  darkWindow: TonightDarkWindow;
  /** `null` on a no-go night or without a dark window: the verdict stands in its place. */
  ranking: TonightRanking | null;
  hasEyepieces: boolean;
  /** Always present: how fresh the forecast behind the verdict is. */
  forecastStatus: TonightForecastStatus;
  /** Set on a weather no-go or a no-darkness night, `null` otherwise. */
  explanation: TonightExplanation | null;
}

function eyepieceLine(telescope: TelescopeRecord, eyepiece: EyepieceRecord): EyepieceLine {
  return { name: eyepiece.name, magnification: Math.round(eyepieceOptics(telescope, eyepiece).magnification) };
}

function toPair(
  telescope: TelescopeRecord,
  pair: RankedEntry<MessierObject, EyepieceRecord>["pair"],
): TonightPair | null {
  if (pair === null) {
    return null;
  }
  if (pair.kind === "none-fit") {
    return { kind: "none-fit", widestName: pair.widest.name };
  }
  return {
    kind: "pair",
    finding: eyepieceLine(telescope, pair.finding),
    detail: eyepieceLine(telescope, pair.detail),
  };
}

function forecastStatusOf(forecast: ForecastResult | null, now: Date): ForecastStatus {
  if (forecast === null) {
    return { kind: "none" };
  }
  const ageMs = now.getTime() - forecast.fetchedAt.getTime();
  return forecast.fallback ? { kind: "fallback", ageMs } : { kind: "fresh", ageMs };
}

export function buildTonight(input: TonightInput): TonightView {
  const { site, telescope, eyepieces, forecast, now, catalogue = MESSIER } = input;
  const { timeZone } = site;
  const engineSite = toEngineSite(site);
  const hourly = forecast?.forecast ?? null;
  const fallback = forecast?.fallback ?? false;

  const date = observingNightDateFor(now, timeZone);
  const thresholdDeg = darknessThresholdDegForBortle(site.bortle);
  const window = darkWindow(engineSite, observingNight(date, timeZone), thresholdDeg);
  const tonight = verdict(window, hourly, { fallback });

  let explanation: TonightExplanation | null = null;
  if (tonight.reason.kind === "cloudy") {
    const next = nextNightNotNoGo({ site: engineSite, thresholdDeg, date, forecast: hourly, fallback });
    explanation = { kind: "weather-no-go", nextText: nextNightText(next) };
  } else if (tonight.reason.kind === "no-darkness" && window.kind === "none") {
    explanation = {
      kind: "no-darkness",
      causeText: noDarknessCauseText({
        latitudeDeg: site.latitudeDeg,
        minSunAltitudeDeg: window.minSunAltitudeDeg,
        thresholdDeg: window.thresholdDeg,
        bortle: site.bortle,
      }),
      returnText: darkReturnText(darkWindowReturn(engineSite, thresholdDeg, date), timeZone),
    };
  }

  const status = forecastStatusOf(forecast, now);

  let ranking: TonightRanking | null = null;
  if ((tonight.level === "go" || tonight.level === "marginal") && window.kind === "window") {
    const ranked = rankObjects({
      site: engineSite,
      bortle: site.bortle,
      minAltitudeDeg: site.minAltitudeDeg,
      darkWindow: window,
      telescope,
      eyepieces,
      catalogue,
    });
    const context = { apertureMm: telescope.apertureMm, bortle: site.bortle };
    ranking = {
      clearedCount: ranked.clearedCount,
      clearedText: clearedLine(ranked.clearedCount),
      entries: ranked.entries.map((entry) => ({
        id: entry.object.id,
        commonName: entry.object.commonName,
        constellation: entry.object.constellation,
        windowStart: formatTime(entry.score.window.start, timeZone),
        windowEnd: formatTime(entry.score.window.end, timeZone),
        bestTime: formatTime(entry.peak.time, timeZone),
        bestDirection: formatDirection(entry.peak),
        pair: toPair(telescope, entry.pair),
        reason: reasonLine(entry, context),
      })),
    };
  }

  return {
    siteName: site.name,
    telescopeName: telescope.name,
    date,
    dateLabel: formatNightDate(date),
    timeZone,
    verdict: tonight,
    verdictText: verdictReasonText(tonight),
    darkWindow:
      window.kind === "window"
        ? { kind: "window", start: formatTime(window.start, timeZone), end: formatTime(window.end, timeZone) }
        : { kind: "none" },
    ranking,
    hasEyepieces: eyepieces.length > 0,
    forecastStatus: { kind: status.kind, text: forecastStatusText(status) },
    explanation,
  };
}
