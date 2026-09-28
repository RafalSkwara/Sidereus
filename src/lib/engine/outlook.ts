import { moonFreeMinutes, moonState } from "./moon";
import { addDays, observingNight } from "./night";
import { DARK_RETURN_MAX_NIGHTS, DARK_RETURN_STRIDE_NIGHTS, OUTLOOK_NIGHTS, VERDICT_NIGHTS } from "./parameters";
import { darkWindow } from "./sun";
import type { DarkWindow, HourlyForecast, Interval, Site, Verdict } from "./types";
import { cloudOutlook, verdict } from "./verdict";
import type { CloudOutlook } from "./verdict";

/**
 * Forward looks from one observing night: the seven-night strip (FR-011), and, so a no-go or
 * no-darkness night can say what comes next, the next night within the verdict horizon that is not
 * a no-go (FR-020) and the night the dark window returns (FR-023). Pure: the forecast is passed in,
 * as for `verdict`.
 */

type Window = Extract<DarkWindow, { kind: "window" }>;

/**
 * The next night after `date` that is not a no-go, or `none`. `lastJudgedDate` is the last night
 * the search judged from data: the whole horizon when every night is a no-go, the night before a
 * forecast gap, or null when the gap starts on the first night after `date`.
 */
export type NextNight =
  { kind: "found"; date: string; verdict: Verdict } | { kind: "none"; lastJudgedDate: string | null };

export interface NextNightInput {
  site: Site;
  thresholdDeg: number;
  /**
   * The night being explained, `YYYY-MM-DD`. `nextNightNotNoGo` starts on the night after it;
   * `sevenNightOutlook` starts on it (night 1).
   */
  date: string;
  forecast: HourlyForecast | null;
  /** The forecast is a saved copy served because the refresh failed (caps a go at marginal). */
  fallback: boolean;
}

/**
 * Walks nights `date+1` … `date+(VERDICT_NIGHTS-1)` with the same forecast and fallback flag as
 * the night being explained. It never looks past the verdict horizon (invariant 5), and it stops
 * at the first night without weather data rather than guessing past it.
 */
export function nextNightNotNoGo({ site, thresholdDeg, date, forecast, fallback }: NextNightInput): NextNight {
  let lastJudgedDate: string | null = null;
  for (let offset = 1; offset < VERDICT_NIGHTS; offset++) {
    const nightDate = addDays(date, offset);
    const window = darkWindow(site, observingNight(nightDate, site.timeZone), thresholdDeg);
    const nightVerdict = verdict(window, forecast, { fallback });
    if (nightVerdict.reason.kind === "no-weather-data") {
      return { kind: "none", lastJudgedDate };
    }
    if (nightVerdict.level !== "no-go") {
      return { kind: "found", date: nightDate, verdict: nightVerdict };
    }
    lastJudgedDate = nightDate;
  }
  return { kind: "none", lastJudgedDate };
}

/**
 * `nextNightNotNoGo` read off an outlook that is already computed, so a weather no-go's "next night"
 * and the strip's verdict chips come from one value and nights 2-3 are not judged twice. Walks the
 * verdict nights after night 1 with the same rules: stop at the first night without weather data,
 * return the first night that is not a no-go. Outlook nights (past the verdict horizon) are never
 * considered (invariant 5).
 */
export function nextNightInOutlook(nights: readonly OutlookNight[]): NextNight {
  let lastJudgedDate: string | null = null;
  for (const night of nights.slice(1)) {
    if (night.kind !== "verdict") {
      break;
    }
    if (night.verdict.reason.kind === "no-weather-data") {
      return { kind: "none", lastJudgedDate };
    }
    if (night.verdict.level !== "no-go") {
      return { kind: "found", date: night.date, verdict: night.verdict };
    }
    lastJudgedDate = night.date;
  }
  return { kind: "none", lastJudgedDate };
}

/**
 * The first night after `date` with a dark window, looking up to `DARK_RETURN_MAX_NIGHTS` nights
 * ahead, or null when none has one.
 *
 * Checking every night costs up to ~150 dark-window computations at a high-latitude site, too much
 * for one request, so after the first night it checks every `DARK_RETURN_STRIDE_NIGHTS`-th night
 * and, on the first one with a window, scans back through that step night by night. This finds the
 * same night as a full scan because, from a night without a window, the rest of the no-darkness
 * season is one contiguous run (the sun's lowest altitude changes monotonically on each side of the
 * solstice) and the dark season after it is far longer than one step. The first night is checked
 * on its own, so a `date` just before the season starts still returns the night after it.
 */
export function darkWindowReturn(
  site: Site,
  thresholdDeg: number,
  date: string,
): { date: string; window: Window } | null {
  const windowAt = (offset: number): { date: string; window: Window } | null => {
    const nightDate = addDays(date, offset);
    const window = darkWindow(site, observingNight(nightDate, site.timeZone), thresholdDeg);
    return window.kind === "window" ? { date: nightDate, window } : null;
  };

  const first = windowAt(1);
  if (first !== null) {
    return first;
  }
  // Every offset up to `checked` is known to have no window.
  let checked = 1;
  while (checked < DARK_RETURN_MAX_NIGHTS) {
    const probe = Math.min(checked + DARK_RETURN_STRIDE_NIGHTS, DARK_RETURN_MAX_NIGHTS);
    const found = windowAt(probe);
    if (found !== null) {
      for (let offset = checked + 1; offset < probe; offset++) {
        const earlier = windowAt(offset);
        if (earlier !== null) {
          return earlier;
        }
      }
      return found;
    }
    checked = probe;
  }
  return null;
}

/**
 * One night of the seven-night strip. Nights 1..`VERDICT_NIGHTS` carry a verdict and later nights
 * only a cloud outlook, so invariant 5 (no verdict past the horizon) is held by the type.
 */
export type OutlookNight = {
  /** 1-based position; night 1 is the input `date`. */
  index: number;
  /** Evening date, site-local, `YYYY-MM-DD`. */
  date: string;
  darkWindow: DarkWindow;
  moon: {
    /** At the dark window's midpoint, or the observing night's midpoint without one. */
    illuminatedFraction: number;
    /** Whole minutes of the dark window with the Moon below the horizon; `null` without a dark window. */
    moonFreeMinutes: number | null;
  };
} & (
  | { kind: "verdict"; verdict: Verdict }
  /** `null` without a dark window or without forecast hours spanning it (tell them apart by `darkWindow.kind`). */
  | { kind: "outlook"; cloud: CloudOutlook | null }
);

function midpoint(interval: Interval): Date {
  const startMs = interval.start.getTime();
  return new Date(startMs + (interval.end.getTime() - startMs) / 2);
}

/**
 * The `OUTLOOK_NIGHTS` nights from `date` (night 1) onward, each with its dark window and moon.
 * Nights 1..`VERDICT_NIGHTS` are judged by `verdict` with the given forecast and fallback flag,
 * exactly as Tonight judges night 1; later nights get `cloudOutlook` over the same forecast and
 * never a verdict, however clear. Night dates step by calendar day, so a 25-hour DST night is one
 * night, never a gap or a repeat.
 */
export function sevenNightOutlook({ site, thresholdDeg, date, forecast, fallback }: NextNightInput): OutlookNight[] {
  const nights: OutlookNight[] = [];
  for (let index = 1; index <= OUTLOOK_NIGHTS; index++) {
    const nightDate = addDays(date, index - 1);
    const night = observingNight(nightDate, site.timeZone);
    const window = darkWindow(site, night, thresholdDeg);
    const base = {
      index,
      date: nightDate,
      darkWindow: window,
      moon: {
        illuminatedFraction: moonState(site, midpoint(window.kind === "window" ? window : night)).illuminatedFraction,
        moonFreeMinutes: window.kind === "window" ? moonFreeMinutes(site, window) : null,
      },
    };
    nights.push(
      index <= VERDICT_NIGHTS
        ? { ...base, kind: "verdict", verdict: verdict(window, forecast, { fallback }) }
        : { ...base, kind: "outlook", cloud: cloudOutlook(window, forecast) },
    );
  }
  return nights;
}
