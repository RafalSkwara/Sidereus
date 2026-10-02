import { getMessages } from "@/i18n";
import { MESSIER, type MessierObject } from "@/lib/catalogue";
import {
  clearIntervals,
  darknessThresholdDegForBortle,
  darkWindow,
  darkWindowReturn,
  eyepieceOptics,
  isBrightMoon,
  moonTarget,
  nextNightInOutlook,
  observingNight,
  PLANET_WINDOW_SUN_ALTITUDE_DEG,
  rankObjects,
  rankPlanets,
  seenSummaries,
  sevenNightOutlook,
  TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG,
  tonightDateFor,
  verdict,
  VERDICT_THRESHOLDS,
  type LogEntry,
  type MoonPhaseBand,
  type PlanetEntry,
  type PlanetKey,
  type RankedEntry,
  type Verdict,
  type VerdictLevel,
} from "@/lib/engine";
import type { ForecastResult } from "@/lib/forecast/service";
import { toEngineSite, type EyepieceRecord, type SiteRecord, type TelescopeRecord } from "@/lib/gear/store";
import type { Locale } from "@/lib/preferences";
import { MOON_TARGET_KEY, type MoonKey } from "@/lib/targets";

import { createFormatter, type ForecastStatus, type ShownSolarTargets } from "./format";

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
  log?: readonly LogEntry[];
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
  /** "M31": the catalogue id, which is also the object's target key in the log. */
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

/** The Moon, first in the "Solar system tonight" section (M-2 S-02). */
export interface TonightMoonEntry {
  /** The Moon's target key in the log. */
  key: MoonKey;
  /** The localised name, "Moon" / "Księżyc". */
  name: string;
  /** Best window within the planet window, `HH:mm` in the site's time zone. */
  windowStart: string;
  windowEnd: string;
  /** Peak time, `HH:mm` in the site's time zone. */
  bestTime: string;
  /** Peak instant (epoch ms). */
  bestAt: number;
  /** Direction at the peak, "SE, 42°". */
  bestDirection: string;
  /** The phase band at the peak, which keys `note`. */
  band: MoonPhaseBand;
  /** "Waxing gibbous · 78% lit" */
  phaseText: string;
  /** The eyepiece that frames the whole disc, or the widest when none does (`wholeDiscFits`); `null` for an empty kit. */
  wholeDisc: EyepieceLine | null;
  /** False when no eyepiece frames the whole disc: `wholeDisc` is then the widest, showing part of it. */
  wholeDiscFits: boolean;
  /** The detail eyepiece; `null` for an empty kit or when it would be the whole-disc eyepiece or weaker. */
  detail: EyepieceLine | null;
  /** Highest point and timing, with a warning when the Moon stays low. */
  reason: string;
  /** The phase band's fixed note: what is worth looking at near the shadow line. */
  note: string;
  /** "Seen 2 times – last 12 Sept 2026" when the log counts the Moon as seen, else `null`. */
  seenText: string | null;
}

/** One planet of the "Solar system tonight" section (M-2 S-01). */
export interface TonightPlanetEntry {
  /** "jupiter": the planet's target key in the log. */
  key: PlanetKey;
  /** The localised planet name, "Jupiter" / "Jowisz". */
  name: string;
  /** Best window within the planet window, `HH:mm` in the site's time zone. */
  windowStart: string;
  windowEnd: string;
  /** Peak time, `HH:mm` in the site's time zone. */
  bestTime: string;
  /** Peak instant (epoch ms). */
  bestAt: number;
  /** Direction at the peak, "SW, 45°". */
  bestDirection: string;
  /** "mag −2.4" */
  magnitudeText: string;
  /** "44″" */
  sizeText: string;
  /** "62% lit", Mercury and Venus only. */
  phaseText: string | null;
  /** "rings tilted 4°", Saturn only. */
  ringText: string | null;
  /** The detail eyepiece; `null` when the kit has no eyepieces. */
  eyepiece: EyepieceLine | null;
  /** Placement × timing, with a warning when the planet stays low. */
  reason: string;
  /** The fixed "what you'll see" note. */
  note: string;
  /** "Seen 2 times – last 12 Sept 2026" when the log counts the planet as seen, else `null`. It never reorders. */
  seenText: string | null;
}

/**
 * The "Solar system tonight" section: the Moon, then the planets that clear the site's minimum altitude between
 * civil dusk and civil dawn, best-placed first. On a no-go night or a night without a dark window only the planet
 * window's clear hours count (see `buildTonight`). `entries` is empty when no planet qualifies.
 */
export interface TonightSolarSystem {
  /** "From civil dusk to dawn, 19:32–06:51" */
  windowText: string;
  /**
   * The planet window's own weather, set only when the verdict card doesn't already speak for it: on a no-go
   * night, a night without a dark window, or when the planet verdict's level differs from the card's. It names
   * the clear hours when the planets are limited to them. `null` otherwise.
   */
  weatherText: string | null;
  /**
   * `null` when the Moon does not clear the site's minimum altitude in the (clear-hours) window, is lit less than
   * `MOON_MIN_ILLUMINATION`, or working it out fails (that drops only the Moon, never the planets).
   */
  moon: TonightMoonEntry | null;
  /** The planets. */
  entries: TonightPlanetEntry[];
  /**
   * Why the section is empty, worded for a cloud-limited night where that applies; set only when there is neither
   * a Moon entry nor a planet.
   */
  noneText: string | null;
}

/** A faint object tonight's Moon washes out (moonlight-and-the-verdict): listed apart on /tonight/all, never ranked. */
export interface TonightWashedOutEntry {
  /** "M33": the catalogue id. */
  id: string;
  /** 33: the key for a localised common name. */
  messier: number;
  commonName: string | null;
  constellation: string;
  /** Best window and peak, `HH:mm` in the site's time zone. */
  windowStart: string;
  windowEnd: string;
  bestTime: string;
  /** Peak instant (epoch ms). */
  bestAt: number;
  /** Direction at the peak, "SW, 45°". */
  bestDirection: string;
}

export interface TonightRanking {
  /** Cleared objects only: a washed-out object is never counted here. */
  clearedCount: number;
  /** "N objects cleared the bar tonight", or "No object cleared the bar tonight". */
  clearedText: string;
  entries: TonightEntry[];
  washedOutCount: number;
  /** "4 faint objects are washed out by the Moon tonight", linking to their group on /tonight/all; `null` at 0. */
  washedOutText: string | null;
  /** Every washed-out object, by best time; not capped by the ranking's limit. */
  washedOutEntries: TonightWashedOutEntry[];
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
  /**
   * M-2 S-01: set when the planet window (sun below `PLANET_WINDOW_SUN_ALTITUDE_DEG`) exists and its own weather
   * is go or marginal, whatever the dark-window verdict says; `null` otherwise, and the verdict card explains why.
   * Also `null` when working out the planets fails, so that never takes the rest of the view down.
   */
  solarSystem: TonightSolarSystem | null;
  /**
   * M-2 S-02: the verdict card's bright-Moon line, set only on a go or marginal night with a dark window when
   * `isBrightMoon` holds for night 1 of the outlook (the strip's own Moon values). It points at the Moon and planets
   * only when `solarSystem` shows one of them. `null` otherwise, or when working it out fails.
   */
  brightMoonText: string | null;
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
    brightMoonLine,
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
    moonPhaseText,
    moonReasonLine,
    nextNightText,
    noDarknessCauseText,
    planetFactsText,
    planetReasonLine,
    planetWeatherText,
    planetWindowText,
    reasonLine,
    seenLine,
    verdictReasonText,
    washedOutLine,
  } = createFormatter(locale);
  const messages = getMessages(locale);
  const { timeZone } = site;
  const engineSite = toEngineSite(site);
  const hourly = forecast?.forecast ?? null;
  const fallback = forecast?.fallback ?? false;

  const thresholdDeg = darknessThresholdDegForBortle(site.bortle);
  // Once civil dawn has passed, "tonight" is the evening ahead (see `tonightDateFor`). Until then the night in
  // progress stays on screen, dark window and ranking included, so morning planets and their log date belong to it.
  const date = tonightDateFor(engineSite, now, TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG);
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
  // Keyed by target key: a Messier object's catalogue id ("M31") or a planet key ("jupiter").
  const seen = seenSummaries(log, date);

  // The verdict card passes the night: a go or marginal verdict over a dark window.
  const cardPasses = (tonight.level === "go" || tonight.level === "marginal") && window.kind === "window";

  let ranking: TonightRanking | null = null;
  if (cardPasses) {
    const ranked = rankObjects({
      site: engineSite,
      bortle: site.bortle,
      minAltitudeDeg: site.minAltitudeDeg,
      darkWindow: window,
      telescope,
      eyepieces,
      catalogue,
      // The ranking looks up `object.id`, which is the Messier object's target key.
      seen,
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
      washedOutCount: ranked.washedOutCount,
      washedOutText: washedOutLine(ranked.washedOutCount),
      washedOutEntries: ranked.washedOut.map(({ object, window: best, peak }) => ({
        id: object.id,
        messier: object.messier,
        commonName: object.commonName,
        constellation: object.constellation,
        windowStart: formatTime(best.start, timeZone),
        windowEnd: formatTime(best.end, timeZone),
        bestTime: formatTime(peak.time, timeZone),
        bestAt: peak.time.getTime(),
        bestDirection: formatDirection(peak),
      })),
    };
  }

  // The Moon and planets (M-2 S-01, S-02): their own window, civil dusk to civil dawn, and that window's own weather, independent of
  // the dark-window verdict, so a planet can show on a cloudy-at-night or a no-darkness night. Ranked once per build.
  // A failure here only drops the section (`null`), never the verdict, ranking and strip; nothing is logged.
  let solarSystem: TonightSolarSystem | null = null;
  try {
    const planetWindow = darkWindow(engineSite, observingNight(date, timeZone), PLANET_WINDOW_SUN_ALTITUDE_DEG);
    const planetVerdict = verdict(planetWindow, hourly, { fallback });
    if (planetWindow.kind === "window" && (planetVerdict.level === "go" || planetVerdict.level === "marginal")) {
      // Where the verdict card doesn't pass the night (a no-go or no dark window), the planet window can pass on a
      // single clear twilight hour, so only its clear hours count: each planet's best window, peak and facts come
      // from them, and a planet up only under cloud is left out. On a go or marginal night the planets are ranked
      // over the whole planet window, as the deep-sky ranking is over the whole dark window. `null` without
      // forecast hours to judge by (no weather data): the whole planet window counts.
      const clear = cardPasses ? null : clearIntervals(planetWindow, hourly, VERDICT_THRESHOLDS.marginalCloudPct);
      // The planets and the Moon fail independently: a failure in one drops only that one (nothing is logged).
      // If both fail, the section is dropped rather than claiming nothing is well placed.
      let ranked: PlanetEntry<EyepieceRecord>[] | null = null;
      try {
        ranked = rankPlanets({
          site: engineSite,
          minAltitudeDeg: site.minAltitudeDeg,
          planetWindow,
          telescope,
          eyepieces,
          seen,
          ...(clear === null ? {} : { visibleIntervals: clear }),
        });
      } catch {
        ranked = null;
      }
      // The Moon over the same window and clear hours. A failure here drops only the Moon; nothing is logged.
      let moon: TonightMoonEntry | null = null;
      try {
        const entry = moonTarget({
          site: engineSite,
          minAltitudeDeg: site.minAltitudeDeg,
          window: planetWindow,
          telescope,
          eyepieces,
          seen,
          ...(clear === null ? {} : { visibleIntervals: clear }),
        });
        if (entry !== null) {
          moon = {
            key: MOON_TARGET_KEY,
            name: messages.targets.moon,
            windowStart: formatTime(entry.window.start, timeZone),
            windowEnd: formatTime(entry.window.end, timeZone),
            bestTime: formatTime(entry.peak.time, timeZone),
            bestAt: entry.peak.time.getTime(),
            bestDirection: formatDirection(entry.peak),
            band: entry.facts.band,
            phaseText: moonPhaseText(entry.facts.band, entry.facts.illuminatedFraction),
            wholeDisc: entry.wholeDisc ? eyepieceLine(telescope, entry.wholeDisc.eyepiece) : null,
            wholeDiscFits: entry.wholeDisc?.fits ?? false,
            detail: entry.detail ? eyepieceLine(telescope, entry.detail) : null,
            reason: moonReasonLine(entry, timeZone),
            note: messages.tonight.moon.note[entry.facts.band],
            seenText: entry.seen ? seenLine(entry.seen) : null,
          };
        }
      } catch {
        moon = null;
      }
      if (ranked === null && moon === null) {
        throw new Error("Neither the planets nor the Moon could be computed");
      }
      const planetEntries = ranked ?? [];
      const shown: ShownSolarTargets =
        moon !== null && planetEntries.length === 0
          ? "moon"
          : moon === null && planetEntries.length > 0
            ? "planets"
            : "both";
      const none = clear === null ? messages.tonight.planets.none : messages.tonight.planets.noneInClearHours;
      solarSystem = {
        windowText: planetWindowText(planetWindow, timeZone),
        // The verdict card already speaks for the planet window when it passes the night at the same level.
        weatherText:
          !cardPasses || planetVerdict.level !== tonight.level
            ? planetWeatherText(planetVerdict, clear === null ? null : { intervals: clear, timeZone }, shown)
            : null,
        moon,
        entries: planetEntries.map((entry) => ({
          key: entry.key,
          name: messages.targets.planet[entry.key],
          windowStart: formatTime(entry.window.start, timeZone),
          windowEnd: formatTime(entry.window.end, timeZone),
          bestTime: formatTime(entry.peak.time, timeZone),
          bestAt: entry.peak.time.getTime(),
          bestDirection: formatDirection(entry.peak),
          ...planetFactsText(entry.key, entry.facts),
          eyepiece: entry.eyepiece ? eyepieceLine(telescope, entry.eyepiece) : null,
          reason: planetReasonLine(entry, timeZone),
          note: messages.tonight.planets.note[entry.key],
          seenText: entry.seen ? seenLine(entry.seen) : null,
        })),
        noneText: moon === null && planetEntries.length === 0 ? none : null,
      };
    }
  } catch {
    solarSystem = null;
  }

  // The bright-Moon line (M-2 S-02) speaks about faint deep sky, which ranks only in the dark window, so it is
  // judged there, from night 1 of the outlook: the strip's illumination and moon-free minutes. `moonFreeMinutes`
  // counts whole minutes, so the dark window is counted in whole minutes too, as the strip's line does. A failure
  // only drops the line.
  let brightMoonText: string | null = null;
  try {
    if (cardPasses && first.moon.moonFreeMinutes !== null) {
      const darkMinutes = Math.floor((window.end.getTime() - window.start.getTime()) / 60_000);
      const upFraction = darkMinutes > 0 ? 1 - first.moon.moonFreeMinutes / darkMinutes : 0;
      if (isBrightMoon(first.moon.illuminatedFraction, upFraction)) {
        const hasMoon = solarSystem?.moon != null;
        const hasPlanets = (solarSystem?.entries.length ?? 0) > 0;
        const pointer: ShownSolarTargets | null =
          hasMoon && hasPlanets ? "both" : hasMoon ? "moon" : hasPlanets ? "planets" : null;
        brightMoonText = brightMoonLine(first.moon.illuminatedFraction, { pointer });
      }
    }
  } catch {
    brightMoonText = null;
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
    solarSystem,
    brightMoonText,
  };
}
