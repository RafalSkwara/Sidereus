import { addDays, observingNight } from "./night";
import { DARK_RETURN_MAX_NIGHTS, DARK_RETURN_STRIDE_NIGHTS, VERDICT_NIGHTS } from "./parameters";
import { darkWindow } from "./sun";
import type { DarkWindow, HourlyForecast, Site, Verdict } from "./types";
import { verdict } from "./verdict";

/**
 * Forward searches from one observing night, so a no-go or no-darkness night can say what comes
 * next: the next night within the verdict horizon that is not a no-go (FR-020), and the night the
 * dark window returns (FR-023). Pure: the forecast is passed in, as for `verdict`.
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
  /** The night being explained, `YYYY-MM-DD`; the search starts on the night after it. */
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
