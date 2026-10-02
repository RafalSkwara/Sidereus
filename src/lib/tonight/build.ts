import { getMessages } from "@/i18n";
import { MESSIER, type MessierObject } from "@/lib/catalogue";
import {
  clearIntervals,
  darknessThresholdDegForBortle,
  darkWindow,
  darkWindowReturn,
  eyepieceOptics,
  MOON_DISC_STEP_MINUTES,
  moonDiscState,
  moonDiscStates,
  moonTarget,
  moonTrack,
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
  type DarkWindow,
  type HorizontalPosition,
  type Interval,
  type LogEntry,
  type MoonDiscState,
  type MoonPhaseBand,
  type PlanetKey,
  type RankedEntry,
  type Verdict,
  type VerdictLevel,
} from "@/lib/engine";
import type { ForecastResult } from "@/lib/forecast/service";
import { toEngineSite, type EyepieceRecord, type SiteRecord, type TelescopeRecord } from "@/lib/gear/store";
import { nearestStateIndex } from "@/lib/moon-disc/state";
import type { Locale } from "@/lib/preferences";
import { MOON_TARGET_KEY, type MoonKey } from "@/lib/targets";

import { createFormatter, type ForecastStatus, type MoonUp, type SkyHeadline } from "./format";

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

/**
 * The Moon as a target (M-2 S-02): the observing details inside the Moon card, shown when the Moon passes the same
 * gate as the planets (see `TonightSolarSystem`).
 */
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

/** One planet of the "Planets tonight" section (M-2 S-01). */
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
 * The "Planets tonight" section: the planets that clear the site's minimum altitude between civil dusk and civil
 * dawn, best-placed first. On a no-go night or a night without a dark window only the planet window's clear hours
 * count (see `buildTonight`). `entries` is empty when no planet qualifies.
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
  /** The planets. */
  entries: TonightPlanetEntry[];
  /** Why the section is empty, worded for a cloud-limited night where that applies; set only when no planet is. */
  noneText: string | null;
}

/**
 * The Moon card beside the sky card (moonlight-and-the-verdict): the Moon across tonight's window as disc states, at
 * page load first, with when it is up, what it does to faint objects and, when it is a target, the observing details.
 * `states`, `timeLabels` and `initialIndex` are what a time slider needs to redraw the disc in the browser.
 */
export interface TonightMoonCard {
  /** The window the states cover, `HH:mm` in the site's time zone; `null` without a civil window either. */
  window: { start: string; end: string } | null;
  /** `dark`: the dark window; `civil`: civil dusk to dawn, on a night without a dark window; `none`: neither. */
  windowKind: "dark" | "civil" | "none";
  /** The Moon every `MOON_DISC_STEP_MINUTES` across the window, both ends included; empty when `windowKind` is none. */
  states: MoonDiscState[];
  /** Each state's time, `HH:mm` in the site's time zone. */
  timeLabels: string[];
  /** The state nearest `now`, clamped into the window (0 without states). */
  initialIndex: number;
  /**
   * "Waxing gibbous · 63% lit" for `states[initialIndex]`; without states (no civil window), for local noon at the
   * start of the observing night. The card shows it only without states: with them, the time slider words the state
   * it shows the same way (`moonPhaseLine`).
   */
  phaseText: string;
  /** "Up 22:10–06:58", "Sets 01:30", "Up all night" or "Not up tonight"; `null` without a window. */
  upText: string | null;
  /**
   * What the Moon does to faint objects, set only when the ranking runs (a go or marginal night with a dark window):
   * how many it washes out, or else how long it is up. `null` otherwise.
   */
  faintText: string | null;
  /**
   * The Moon as a target, under the planets' gate (the planet window's own weather, its clear hours on a night the sky
   * card doesn't pass); `null` when it is not up there, too thin a crescent, or working it out fails.
   */
  target: TonightMoonEntry | null;
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
 * - `headline` is `skyHeadline(verdict)`, the verdict card's own words for that night; `level` only
 *   picks the tone.
 * - `reasonText` is `verdictReasonText(verdict)`; `null` on a no-darkness night, where `headline` and
 *   `darkText` already say so (the card's reason wording names "tonight", which would misread on
 *   nights 2-3).
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
  | { kind: "verdict"; level: VerdictLevel; headline: SkyHeadline; reasonText: string | null }
  | { kind: "outlook"; cloudText: string | null }
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
  /** The sky headline from the verdict's level and reason: "Clear", "No forecast", "No dark window", … */
  headline: SkyHeadline;
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
  /** The Moon card; `null` only when working it out fails, which never takes the rest of the view down. */
  moonCard: TonightMoonCard | null;
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

/**
 * When the Moon is up across a track (`moonState`'s sense: its apparent altitude at or above 0°). A span runs from
 * the first sample up to the first sample down again, or to the last sample; times are only as fine as the track.
 */
function moonUpOf(track: readonly Pick<HorizontalPosition, "time" | "altitudeDeg">[]): MoonUp {
  const spans: Interval[] = [];
  let start: Date | null = null;
  for (const sample of track) {
    const up = sample.altitudeDeg >= 0;
    if (up && start === null) {
      start = sample.time;
    } else if (!up && start !== null) {
      spans.push({ start, end: sample.time });
      start = null;
    }
  }
  const last = track.at(-1);
  if (start !== null && last !== undefined) {
    spans.push({ start, end: last.time });
  }
  if (spans.length === 0) {
    return { kind: "never" };
  }
  if (track.every((sample) => sample.altitudeDeg >= 0)) {
    return { kind: "all" };
  }
  return { kind: "part", spans, upAtStart: track[0].altitudeDeg >= 0 };
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
    moonPhaseText,
    moonFaintText,
    moonReasonLine,
    moonUpText,
    nextNightText,
    noDarknessCauseText,
    planetFactsText,
    planetReasonLine,
    planetWeatherText,
    planetWindowText,
    reasonLine,
    seenLine,
    skyHeadline,
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
      return { ...base, kind: "verdict", level: night.verdict.level, headline: skyHeadline(night.verdict), reasonText };
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

  // The planets' and the Moon target's gate (M-2 S-01, S-02): their own window, civil dusk to civil dawn, and that
  // window's own weather, independent of the dark-window verdict, so a planet or the Moon can show on a
  // cloudy-at-night or a no-darkness night. Where the verdict card doesn't pass the night (a no-go or no dark window),
  // the planet window can pass on a single clear twilight hour, so only its clear hours count: each target's best
  // window, peak and facts come from them, and one up only under cloud is left out. On a go or marginal night they are
  // judged over the whole planet window, as the deep-sky ranking is over the whole dark window. `clear` is `null`
  // without forecast hours to judge by (no weather data): the whole planet window counts. A failure here only drops
  // the planets and the Moon target (`null`); nothing is logged.
  let planetWindow: DarkWindow | null = null;
  let gate: { window: Extract<DarkWindow, { kind: "window" }>; verdict: Verdict; clear: Interval[] | null } | null =
    null;
  try {
    planetWindow = darkWindow(engineSite, observingNight(date, timeZone), PLANET_WINDOW_SUN_ALTITUDE_DEG);
    const planetVerdict = verdict(planetWindow, hourly, { fallback });
    if (planetWindow.kind === "window" && (planetVerdict.level === "go" || planetVerdict.level === "marginal")) {
      gate = {
        window: planetWindow,
        verdict: planetVerdict,
        clear: cardPasses ? null : clearIntervals(planetWindow, hourly, VERDICT_THRESHOLDS.marginalCloudPct),
      };
    }
  } catch {
    gate = null;
  }

  // The planets, ranked once per build. A failure only drops the section (`null`), never the verdict, ranking, strip
  // or Moon card; nothing is logged.
  let solarSystem: TonightSolarSystem | null = null;
  try {
    if (gate !== null) {
      const { window: civil, verdict: planetVerdict, clear } = gate;
      const ranked = rankPlanets({
        site: engineSite,
        minAltitudeDeg: site.minAltitudeDeg,
        planetWindow: civil,
        telescope,
        eyepieces,
        seen,
        ...(clear === null ? {} : { visibleIntervals: clear }),
      });
      solarSystem = {
        windowText: planetWindowText(civil, timeZone),
        // The verdict card already speaks for the planet window when it passes the night at the same level.
        weatherText:
          !cardPasses || planetVerdict.level !== tonight.level
            ? planetWeatherText(planetVerdict, clear === null ? null : { intervals: clear, timeZone })
            : null,
        entries: ranked.map((entry) => ({
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
        noneText:
          ranked.length === 0
            ? clear === null
              ? messages.tonight.planets.none
              : messages.tonight.planets.noneInClearHours
            : null,
      };
    }
  } catch {
    solarSystem = null;
  }

  // The Moon card (moonlight-and-the-verdict), on every night: the Moon over the dark window, or civil dusk to dawn
  // without one, or only its phase at local noon without either. Its facts need no weather. A failure drops only the
  // card; a failure in the Moon target drops only the target. Nothing is logged.
  let moonCard: TonightMoonCard | null;
  try {
    let target: TonightMoonEntry | null = null;
    if (gate !== null) {
      try {
        const entry = moonTarget({
          site: engineSite,
          minAltitudeDeg: site.minAltitudeDeg,
          window: gate.window,
          telescope,
          eyepieces,
          seen,
          ...(gate.clear === null ? {} : { visibleIntervals: gate.clear }),
        });
        if (entry !== null) {
          target = {
            key: MOON_TARGET_KEY,
            name: messages.targets.moon,
            windowStart: formatTime(entry.window.start, timeZone),
            windowEnd: formatTime(entry.window.end, timeZone),
            bestTime: formatTime(entry.peak.time, timeZone),
            bestAt: entry.peak.time.getTime(),
            bestDirection: formatDirection(entry.peak),
            band: entry.facts.band,
            wholeDisc: entry.wholeDisc ? eyepieceLine(telescope, entry.wholeDisc.eyepiece) : null,
            wholeDiscFits: entry.wholeDisc?.fits ?? false,
            detail: entry.detail ? eyepieceLine(telescope, entry.detail) : null,
            reason: moonReasonLine(entry, timeZone),
            note: messages.tonight.moon.note[entry.facts.band],
            seenText: entry.seen ? seenLine(entry.seen) : null,
          };
        }
      } catch {
        target = null;
      }
    }

    const cardWindow: { kind: "dark" | "civil"; interval: Interval } | null =
      window.kind === "window"
        ? { kind: "dark", interval: window }
        : planetWindow?.kind === "window"
          ? { kind: "civil", interval: planetWindow }
          : null;
    if (cardWindow === null) {
      // High-latitude summer: no window to sample, so only the phase, at the start of the observing night.
      const noon = moonDiscState(observingNight(date, timeZone).start);
      moonCard = {
        window: null,
        windowKind: "none",
        states: [],
        timeLabels: [],
        initialIndex: 0,
        phaseText: moonPhaseText(noon.band, noon.illuminatedFraction),
        upText: null,
        faintText: null,
        target,
      };
    } else {
      const { interval } = cardWindow;
      const states = moonDiscStates(interval, MOON_DISC_STEP_MINUTES);
      // The same instants as the states, so the up spans read on the slider's own grid.
      const up = moonUpOf(moonTrack(engineSite, interval, MOON_DISC_STEP_MINUTES));
      const initialIndex = nearestStateIndex(states, now.getTime());
      const shown = states[initialIndex];
      moonCard = {
        window: { start: formatTime(interval.start, timeZone), end: formatTime(interval.end, timeZone) },
        windowKind: cardWindow.kind,
        states,
        timeLabels: states.map((state) => formatTime(new Date(state.time), timeZone)),
        initialIndex,
        phaseText: moonPhaseText(shown.band, shown.illuminatedFraction),
        upText: moonUpText(up, timeZone),
        // Only where the ranking runs, so the washed-out count is known. The line carries no percent: the card's
        // phase line gives the % lit of the state shown, while the strip's "Moon N%" is the night's own figure.
        faintText: ranking === null ? null : moonFaintText(up, ranking.washedOutCount, timeZone),
        target,
      };
    }
  } catch {
    moonCard = null;
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
    headline: skyHeadline(tonight),
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
    moonCard,
  };
}
