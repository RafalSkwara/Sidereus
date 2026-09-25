import { MESSIER, type MessierObject } from "@/lib/catalogue";
import {
  darknessThresholdDegForBortle,
  darkWindow,
  eyepieceOptics,
  observingNight,
  observingNightDateFor,
  rankObjects,
  verdict,
  type HourlyForecast,
  type RankedEntry,
  type Verdict,
} from "@/lib/engine";
import { toEngineSite, type EyepieceRecord, type SiteRecord, type TelescopeRecord } from "@/lib/gear/store";

import { clearedLine, formatDirection, formatNightDate, formatTime, reasonLine, verdictReasonText } from "./format";

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
  /** `null` when no forecast is available: the verdict then defaults to marginal. */
  forecast: HourlyForecast | null;
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

export function buildTonight(input: TonightInput): TonightView {
  const { site, telescope, eyepieces, forecast, now, catalogue = MESSIER } = input;
  const { timeZone } = site;
  const engineSite = toEngineSite(site);

  const date = observingNightDateFor(now, timeZone);
  const window = darkWindow(engineSite, observingNight(date, timeZone), darknessThresholdDegForBortle(site.bortle));
  const tonight = verdict(window, forecast);

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
  };
}
