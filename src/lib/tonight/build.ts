import { MESSIER, type MessierObject } from "@/lib/catalogue";
import {
  darknessThresholdDegForBortle,
  darkWindowReturn,
  eyepieceOptics,
  nextNightInOutlook,
  rankObjects,
  seenSummaries,
  sevenNightOutlook,
  tonightDateFor,
  type RankedEntry,
  type Verdict,
  type VerdictLevel,
} from "@/lib/engine";
import type { ForecastResult } from "@/lib/forecast/service";
import { toEngineSite, type EyepieceRecord, type SiteRecord, type TelescopeRecord } from "@/lib/gear/store";
import type { RankingLogEntry } from "@/lib/observations/store";

import type { Locale } from "@/lib/preferences";

import { createFormatter, type ForecastStatus } from "./format";

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
  /** The user's observation log (FR-018); absent means empty. Only what the ranking needs of each entry. */
  log?: readonly RankingLogEntry[];
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
  /** 1-based place in the ranking; kept when the all-objects page orders by best time. */
  rank: number;
  /** "M31" */
  id: string;
  /** 31: the key for a localised common name (`@/lib/catalogue/common-names`). */
  messier: number;
  /** The catalogue's (English) common name; the page localises it by `messier`. */
  commonName: string | null;
  /** IAU 3-letter abbreviation. */
  constellation: string;
  /** Best window, `HH:mm` in the site's time zone. */
  windowStart: string;
  windowEnd: string;
  /** Peak time, `HH:mm` in the site's time zone. */
  bestTime: string;
  /** Peak instant (epoch ms), for ordering by best time across midnight. */
  bestAt: number;
  /** Direction at the peak, "SW, 45°". */
  bestDirection: string;
  /** `null` when the kit has no eyepieces: the page leaves the pair line out. */
  pair: TonightPair | null;
  reason: string;
  /** "Seen 2 times – last 12 Sept 2026" when the log counts the object as seen (FR-018), else `null`. */
  seenText: string | null;
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

/**
 * One night of the seven-night strip (FR-011), worded for the page. Nights 1-3 carry the verdict,
 * nights 4-7 only a cloud outlook, never a level (invariant 5).
 *
 * - `reasonText` is `verdictReasonText(verdict)`, so a no-weather-data marginal is told apart from a
 *   forecast one; `null` on a no-darkness night, where `darkText` already says so (the card's
 *   wording names "tonight", which would misread on nights 2-3).
 * - `cloudText` is `null` on a night without a dark window: there is nothing to judge the cloud
 *   against.
 */
export type TonightNight = {
  /** Evening date, site-local, `YYYY-MM-DD`. */
  date: string;
  /** "Sat 24 Oct" / "sob., 24 paź" */
  label: string;
  /** "19:05–04:40" in the site's time zone, or the no-darkness wording. */
  darkText: string;
  /** "Moon 62% · 3 h 10 min moon-free" */
  moonText: string;
} & (
  { kind: "verdict"; level: VerdictLevel; reasonText: string | null } | { kind: "outlook"; cloudText: string | null }
);

export interface TonightView {
  /** The site and telescope the ranking is for; the log form is prefilled with them (FR-016). */
  siteId: string;
  telescopeId: string;
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
  /** The seven-night strip from tonight (night 1, the night `verdict` and `darkWindow` describe) onward. */
  nights: TonightNight[];
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

/** Every text field of the view is worded for `locale`; the rest of the view does not depend on it. */
/**
 * `limit`: how many cleared objects get full entries (default: Tonight's top five; `Infinity` for the
 * all-objects page).
 */
export function buildTonight(input: TonightInput, locale: Locale, options: { limit?: number } = {}): TonightView {
  const { site, telescope, eyepieces, forecast, now, log = [], catalogue = MESSIER } = input;
  const {
    clearedLine,
    cloudOutlookText,
    darkReturnText,
    darkSpanText,
    forecastStatusText,
    formatDirection,
    formatNightDate,
    formatShortNightDate,
    formatTime,
    moonLine,
    nextNightText,
    noDarknessCauseText,
    reasonLine,
    seenLine,
    verdictReasonText,
  } = createFormatter(locale);
  const { timeZone } = site;
  const engineSite = toEngineSite(site);
  const hourly = forecast?.forecast ?? null;
  const fallback = forecast?.fallback ?? false;

  const thresholdDeg = darknessThresholdDegForBortle(site.bortle);
  // Once last night's darkness is over, "tonight" is the evening ahead (see `tonightDateFor`).
  const date = tonightDateFor(engineSite, now, thresholdDeg);
  // One computation for the strip and the verdict card: night 1 of the outlook is tonight, so the two
  // can never disagree on the same screen.
  const outlook = sevenNightOutlook({ site: engineSite, thresholdDeg, date, forecast: hourly, fallback });
  const first = outlook.at(0);
  if (first?.kind !== "verdict") {
    throw new Error("The outlook's first night carries no verdict");
  }
  const window = first.darkWindow;
  const tonight = first.verdict;

  const nights = outlook.map((night): TonightNight => {
    const base = {
      date: night.date,
      label: formatShortNightDate(night.date),
      darkText: darkSpanText(night.darkWindow, timeZone),
      moonText: moonLine(night.moon, night.darkWindow),
    };
    if (night.kind === "verdict") {
      const reasonText = night.verdict.reason.kind === "no-darkness" ? null : verdictReasonText(night.verdict);
      return { ...base, kind: "verdict", level: night.verdict.level, reasonText };
    }
    return {
      ...base,
      kind: "outlook",
      cloudText: night.darkWindow.kind === "window" ? cloudOutlookText(night.cloud) : null,
    };
  });

  let explanation: TonightExplanation | null = null;
  if (tonight.reason.kind === "cloudy") {
    // Read off the outlook: nights 2-3 are already judged there, so they are not judged twice.
    const next = nextNightInOutlook(outlook);
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
      // The log is still keyed by Messier number; the engine keys it by target (the catalogue id, "M31").
      seen: seenSummaries(
        log.map(({ messier, night, rating }) => ({ target: `M${messier}`, night, rating })),
        date,
      ),
      limit: options.limit,
    });
    const context = { apertureMm: telescope.apertureMm, bortle: site.bortle };
    ranking = {
      clearedCount: ranked.clearedCount,
      clearedText: clearedLine(ranked.clearedCount),
      entries: ranked.entries.map((entry, i) => ({
        rank: i + 1,
        id: entry.object.id,
        messier: entry.object.messier,
        commonName: entry.object.commonName,
        constellation: entry.object.constellation,
        windowStart: formatTime(entry.score.window.start, timeZone),
        windowEnd: formatTime(entry.score.window.end, timeZone),
        bestTime: formatTime(entry.peak.time, timeZone),
        bestAt: entry.peak.time.getTime(),
        bestDirection: formatDirection(entry.peak),
        pair: toPair(telescope, entry.pair),
        reason: reasonLine(entry, context),
        seenText: entry.seen ? seenLine(entry.seen) : null,
      })),
    };
  }

  return {
    siteId: site.id,
    telescopeId: telescope.id,
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
    nights,
  };
}
