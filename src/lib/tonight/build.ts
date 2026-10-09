import { getMessages } from "@/i18n";
import { DEEP_SKY, type DeepSkyObject } from "@/lib/catalogue";
import {
  addDays,
  clearIntervals,
  cloudOutlook,
  darknessThresholdDegForBortle,
  darkWindow,
  darkWindowReturn,
  DEFAULT_TRACK_STEP_MINUTES,
  eyepieceOptics,
  MAX_RANKED_OBJECTS,
  MOON_DISC_STEP_MINUTES,
  moonDiscState,
  moonDiscStates,
  moonState,
  moonTarget,
  moonTrack,
  nextNightInOutlook,
  objectTracks,
  observingNight,
  PLANET_KEYS,
  PLANET_WINDOW_SUN_ALTITUDE_DEG,
  planetTracks,
  rankObjects,
  rankPlanets,
  seenSummaries,
  sevenNightOutlook,
  skyFrames,
  sunEvents,
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
  type MoonState,
  type PlanetKey,
  type RankedEntry,
  type Site,
  type Verdict,
  type VerdictLevel,
} from "@/lib/engine";
import type { ForecastResult } from "@/lib/forecast/service";
import { toEngineSite, type EyepieceRecord, type SiteRecord, type TelescopeRecord } from "@/lib/gear/store";
import { localCommonName } from "@/lib/catalogue/common-names";
import type { TonightSkyBody, TonightSkyView } from "@/lib/sky-view/view";
import { nearestStateIndex } from "@/lib/moon-disc/state";
import type { Locale } from "@/lib/preferences";
import { MOON_TARGET_KEY, type MoonKey } from "@/lib/targets";

import {
  createFormatter,
  zoneLabel as zoneLabelAt,
  type ForecastStatus,
  type MoonUp,
  type SkyHeadline,
} from "./format";
import {
  layoutSessionPlan,
  type SessionPlanMoonEvent,
  type SessionPlanRow,
  type SessionPlanRowInput,
} from "./session-plan";

/**
 * Composes the Tonight view: the stored gear, the forecast and `now` in, a view model the page
 * renders without logic out. Everything here is deterministic for identical inputs; the page reads
 * the clock and the forecast and passes them in.
 */

/** How many ranked objects the "Point here first" summary band lists. */
export const SUMMARY_TARGETS = 3;

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
  /** The objects to rank; the deep-sky catalogue (Messier and Caldwell) unless a test narrows it. */
  catalogue?: readonly DeepSkyObject[];
}

export interface EyepieceLine {
  name: string;
  /** Whole-number magnification with the telescope. */
  magnification: number;
}

export type TonightPair =
  { kind: "pair"; finding: EyepieceLine; detail: EyepieceLine } | { kind: "none-fit"; widestName: string };

export interface TonightEntry {
  /** 1-based place in the ranking; kept when the Targets page orders by best time. */
  rank: number;
  /** "M31" | "NGC7000": the catalogue id, space-free, which is also the object's target key in the log and its anchor. */
  id: string;
  /** What a row shows as the object's name: "M31", "NGC 7000", "NGC 869 / 884". */
  label: string;
  /** 14 for a Caldwell object, else `null`. */
  caldwell: number | null;
  /** The catalogue's (English) common name; the page localises it by `id` (`@/lib/catalogue/common-names`). */
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

/** A faint object tonight's Moon washes out (moonlight-and-the-verdict): listed apart on /tonight/targets, never ranked. */
export interface TonightWashedOutEntry {
  /** "M33" | "NGC253": the catalogue id. */
  id: string;
  /** What a row shows as the object's name: "M33", "NGC 253". */
  label: string;
  /** 14 for a Caldwell object, else `null`. */
  caldwell: number | null;
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
  /** "4 faint objects are washed out by the Moon tonight", linking to their group on /tonight/targets; `null` at 0. */
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
  /**
   * The night's clear share for the summary bars, 0-100: 100 minus `CloudOutlook.meanCloudPct`, the mean cloud cover
   * over the dark window's whole forecast hours, rounded. The same hours on all seven nights, verdict or outlook.
   * `null` without a dark window or without forecast hours spanning it.
   */
  clearPct: number | null;
} & (
  | { kind: "verdict"; level: VerdictLevel; headline: SkyHeadline; reasonText: string | null }
  | { kind: "outlook"; cloudText: string | null }
);

/** One target on the Session plan, worded for the page; the layout's fractions place it on the axis. */
export interface TonightSessionPlanRowInput extends SessionPlanRowInput {
  /** "M31", "Jupiter", "Moon": the short name. */
  label: string;
  /** "M31 · Andromeda Galaxy": the full name, as the live sky's markers name it. */
  name: string;
  /** The target's row on its focused page, as the live sky's markers link: Targets, Planets or the Moon page. */
  href: string;
  /** Peak time, `HH:mm` in the site's time zone. */
  bestTime: string;
  /** Best window, "21:40–23:10" in the site's time zone. */
  windowText: string;
  /** Direction at the peak, "SW, 45°". */
  bestDirection: string;
  /**
   * The target's altitude over the plan's axis, in whole tenths of a degree, one sample per `trackStep` from the axis
   * start and the last at its end (ui-user-adjustments: the row's altitude curve).
   */
  track: number[];
  /** The altitude at the peak, degrees to one decimal: where the curve's best-time dot sits. */
  peakAltitudeDeg: number;
}

export type TonightSessionPlanRow = SessionPlanRow<TonightSessionPlanRowInput>;

/**
 * The Session plan (session-plan-timeline): the night from sunset to sunrise (the live sky's range) on one axis, with
 * the dark window, the Moon's rise and set and one row per recommended target (the ranking's entries, the planets and
 * the Moon when it is a target) ordered by best time. Positions are fractions of the axis; every time is the server's.
 */
export interface TonightSessionPlan {
  /**
   * "Sunset 18:47" and "Sunrise 07:48", the axis ends, in the site's time zone; `null` when the axis is the whole
   * observing night instead (polar day or night: no sunset or no sunrise).
   */
  sunsetText: string | null;
  sunriseText: string | null;
  /** The dark window on the axis; `null` without one. */
  dark: { from: number; to: number } | null;
  /** "Dark 21:40–05:10", or the no-dark-window line. */
  darkText: string;
  /** Moonrises and moonsets inside the axis, each with its time, `HH:mm` in the site's time zone. */
  moonEvents: (SessionPlanMoonEvent & { timeText: string })[];
  /** "Moonset 01:30 · Moonrise 04:50", "Moon up all night" or "Moon not up tonight". */
  moonText: string;
  /** The hours as ticks: fraction of the axis and `HH:mm` in the site's time zone. */
  ticks: { at: number; label: string }[];
  /** By best time, earliest first; empty when nothing is recommended tonight. */
  rows: TonightSessionPlanRow[];
  /** The site's minimum altitude, degrees: the curves' dashed line, and what a row's window stays above. */
  minAltitudeDeg: number;
  /** One step of the rows' tracks as a fraction of the axis (the last step may be shorter). */
  trackStep: number;
  /**
   * The tile's "what next" line, decided on the server from `now` (the page reads no clock): before sunset the first
   * row (`first`), during the night the first row, by best time, whose best window has not ended (`next`), and `done`
   * once every window has; `index` is into `rows`. `null` when there are no rows.
   */
  nextUp: { kind: "first" | "next"; index: number } | { kind: "done" } | null;
}

/** The interactive sky's data (interactive-sky); declared island-safe in `@/lib/sky-view/view`. */
export type { TonightSkyBody, TonightSkyView };

export interface TonightView {
  /** The site and telescope the ranking is for; the log form is prefilled with them (FR-016). */
  siteId: string;
  telescopeId: string;
  siteName: string;
  telescopeName: string;
  /** Evening date of the observing night, `YYYY-MM-DD`, site-local. */
  date: string;
  /**
   * When this view stops being the night to show: the night's civil-dawn rollover (the planet window's end, the
   * same -6 degrees as `TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG`), or the observing night's end where there is no civil
   * window (polar summer, where the date changes instead). Offline-night-plan.
   */
  validUntil: Date;
  /** "Saturday, 10 October 2026" */
  dateLabel: string;
  timeZone: string;
  /**
   * The zone's short name at the night's start ("CEST", or "GMT+2" where there is no abbreviation), for the static
   * verdict's dark line. The live sky carries one per frame (`skyView.zoneLabels`), which stays right across a clock change.
   */
  zoneLabel: string;
  verdict: Verdict;
  /** The sky headline from the verdict's level and reason: "Clear", "No forecast", "No dark window", … */
  headline: SkyHeadline;
  verdictText: string;
  /** Formatted in the site's time zone. */
  darkWindow: TonightDarkWindow;
  /**
   * When tonight's dark window starts, `null` without one (verdict-check): a sky check keeps the last headline shown
   * before it. Server-side only; no client island receives the view.
   */
  darkStart: Date | null;
  /** `null` on a no-go night or without a dark window: the verdict stands in its place. */
  ranking: TonightRanking | null;
  /**
   * The summary band's "Point here first": the ranking's best three entries, ordered by best time (`bestAt`)
   * so they read as the night unfolds. Empty when `ranking` is `null`.
   */
  summaryTargets: TonightEntry[];
  hasEyepieces: boolean;
  /** When the forecast behind the view was fetched, `null` without one (offline-night-plan's copy metadata). */
  forecastFetchedAt: Date | null;
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
   * Why there is no solar system (tonight-dashboard), for the Planets page: no window between civil dusk and dawn,
   * clouds over that window (with its clearest hour's cover), or "not available" when working it out failed.
   * `null` whenever `solarSystem` is set.
   */
  planetsAbsentText: string | null;
  /** The Moon card; `null` only when working it out fails, which never takes the rest of the view down. */
  moonCard: TonightMoonCard | null;
  /**
   * The interactive sky (interactive-sky), built only with the `withSkyView` option (the dashboard); `null` without
   * it, or when working it out fails, which never takes the rest of the view down.
   */
  skyView: TonightSkyView | null;
  /**
   * The Session plan (session-plan-timeline), built only with the `withSessionPlan` option; `null` without it, or
   * when working it out fails, which never takes the rest of the view down.
   */
  sessionPlan: TonightSessionPlan | null;
}

type RankedObjects = RankedEntry<DeepSkyObject, EyepieceRecord>[];
type RankedPlanets = ReturnType<typeof rankPlanets>;
type MoonTargetEntry = NonNullable<ReturnType<typeof moonTarget>>;

function eyepieceLine(telescope: TelescopeRecord, eyepiece: EyepieceRecord): EyepieceLine {
  return { name: eyepiece.name, magnification: Math.round(eyepieceOptics(telescope, eyepiece).magnification) };
}

function toPair(
  telescope: TelescopeRecord,
  pair: RankedEntry<DeepSkyObject, EyepieceRecord>["pair"],
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

/** How close, in ms, a refined Moon crossing is bracketed: bisection stops once the bracket is this narrow. */
const MOON_CROSSING_PRECISION_MS = 30_000;

/**
 * The instant the Moon's apparent altitude crosses 0° (`moonState`'s sense: at or above 0° is up) between two samples
 * that disagree on it, found by bisection to `MOON_CROSSING_PRECISION_MS`. Returns the first instant on the later
 * sample's side, so a rise gives the first up instant and a set the first down one.
 */
function refineMoonCrossing(site: Site, earlier: Date, later: Date): Date {
  const upAtLater = moonState(site, later).altitudeDeg >= 0;
  let lo = earlier.getTime();
  let hi = later.getTime();
  while (hi - lo > MOON_CROSSING_PRECISION_MS) {
    const mid = lo + (hi - lo) / 2;
    if (moonState(site, new Date(mid)).altitudeDeg >= 0 === upAtLater) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return new Date(hi);
}

/**
 * When the Moon is up across a track (`moonState`'s sense: its apparent altitude at or above 0°). A span runs from
 * the first sample up to the first sample down again, or to the last sample. Every boundary that is a real crossing
 * (not the track's first or last sample) is refined between its bracketing samples (`refineMoonCrossing`), so the
 * Moon card and the Session plan read the same rise and set whatever grid their tracks use.
 */
function moonUpOf(site: Site, track: readonly Pick<HorizontalPosition, "time" | "altitudeDeg">[]): MoonUp {
  const spans: Interval[] = [];
  let start: Date | null = null;
  for (const [index, sample] of track.entries()) {
    const up = sample.altitudeDeg >= 0;
    if (up && start === null) {
      start = index === 0 ? sample.time : refineMoonCrossing(site, track[index - 1].time, sample.time);
    } else if (!up && start !== null) {
      spans.push({ start, end: refineMoonCrossing(site, track[index - 1].time, sample.time) });
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

/** `x` rounded to `decimals` places; `-0` reads as 0. */
function roundTo(x: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(x * factor) / factor || 0;
}

/** A track's altitudes alone, in whole tenths of a degree (the Session plan's curves). */
function packAltitudes(track: readonly Pick<HorizontalPosition, "altitudeDeg">[]): number[] {
  return track.map((sample) => Math.round(sample.altitudeDeg * 10) || 0);
}

/** A track as interleaved altitude and azimuth in whole tenths of a degree, azimuth in [0, 3600). */
function packTrack(track: readonly Pick<HorizontalPosition, "altitudeDeg" | "azimuthDeg">[]): number[] {
  return track.flatMap((sample) => [
    Math.round(sample.altitudeDeg * 10) || 0,
    ((Math.round(sample.azimuthDeg * 10) % 3600) + 3600) % 3600 || 0,
  ]);
}

/**
 * The live sky's and the Session plan's axis: sunset to sunrise (`fromSun`), or the whole observing night without
 * either.
 */
function skyAxis(site: Site, date: string, timeZone: string): { range: Interval; fromSun: boolean } {
  const night = observingNight(date, timeZone);
  const { sunset, sunrise } = sunEvents(site, night);
  return sunset !== null && sunrise !== null
    ? { range: { start: sunset, end: sunrise }, fromSun: true }
    : { range: night, fromSun: false };
}

/** The index of the time in `times` (epoch ms, ascending) nearest `ms`; the earlier one on a tie. */
function nearestIndex(times: readonly number[], ms: number): number {
  let best = 0;
  for (let i = 1; i < times.length; i++) {
    if (Math.abs(times[i] - ms) < Math.abs(times[best] - ms)) {
      best = i;
    }
  }
  return best;
}

/** Every text field of the view is worded for `locale`; the rest of the view does not depend on it. */
/**
 * `limit`: how many cleared objects get full entries (default: Tonight's top five; `Infinity` for the
 * Targets page). `withSkyView`: also build the interactive sky (the dashboard only); without it `skyView` is
 * `null` and nothing of it is computed. `withSessionPlan`: likewise for the Session plan. `night`: `"next"` builds the
 * evening after the one `tonightDateFor(now)` returns (offline-night-plan), from the same forecast; the forecast's age
 * keeps the real `now`, the time-driven initial selections read as at that night's sunset.
 */
export function buildTonight(
  input: TonightInput,
  locale: Locale,
  options: { limit?: number; withSkyView?: boolean; withSessionPlan?: boolean; night?: "tonight" | "next" } = {},
): TonightView {
  const { site, telescope, eyepieces, forecast, now, log = [], catalogue = DEEP_SKY } = input;
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
  const tonightDate = tonightDateFor(engineSite, now, TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG);
  const date = options.night === "next" ? addDays(tonightDate, 1) : tonightDate;
  // The instant the time-driven initial selections (Moon slider, live sky frame, plan tile) read: the real clock for
  // tonight, the start of the night (sunset, else the observing night's start) for the next night.
  const selectionNow =
    options.night === "next"
      ? (sunEvents(engineSite, observingNight(date, timeZone)).sunset ?? observingNight(date, timeZone).start)
      : now;
  // One computation for the strip and the verdict card: night 1 of the outlook is tonight, so the two
  // can never disagree on the same screen.
  const outlook = sevenNightOutlook({ site: engineSite, thresholdDeg, date, forecast: hourly, fallback });
  const first = outlook.at(0);
  if (first?.kind !== "verdict") {
    throw new Error("The outlook's first night carries no verdict");
  }
  const window = first.darkWindow;
  const tonight = first.verdict;
  // The zone's short name at the observing night's start ("CEST"), for the static verdict's dark line; the live sky
  // reads the zone per frame instead.
  const zoneLabel = zoneLabelAt(observingNight(date, timeZone).start, timeZone);

  const nights = outlook.map((night): TonightNight => {
    // Nights 1-3 carry a verdict, not cloud numbers, so their mean comes from `cloudOutlook` over the same hours.
    const cloud = night.kind === "outlook" ? night.cloud : cloudOutlook(night.darkWindow, hourly);
    const base = {
      date: night.date,
      label: formatShortNightDate(night.date),
      darkText: darkSpanText(night.darkWindow, timeZone),
      moonText: moonLine(night.moon, night.darkWindow),
      clearPct: cloud === null ? null : Math.round(100 - cloud.meanCloudPct),
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
  // Keyed by target key: a deep-sky object's catalogue id ("M31", "NGC7000") or a planet key ("jupiter").
  const seen = seenSummaries(log, date);

  // The verdict card passes the night: a go or marginal verdict over a dark window.
  const cardPasses = (tonight.level === "go" || tonight.level === "marginal") && window.kind === "window";

  // The Session plan's raw inputs, kept as the targets are built; only `options.withSessionPlan` maps them into rows.
  let planObjects: RankedObjects = [];
  let planPlanets: RankedPlanets = [];
  let planMoon: MoonTargetEntry | null = null;

  let ranking: TonightRanking | null = null;
  // The interactive sky's deep-sky targets: the ranking's first `MAX_RANKED_OBJECTS`, the Targets page's top band.
  let skyObjects: DeepSkyObject[] = [];
  if (cardPasses) {
    const ranked = rankObjects({
      site: engineSite,
      bortle: site.bortle,
      minAltitudeDeg: site.minAltitudeDeg,
      darkWindow: window,
      telescope,
      eyepieces,
      catalogue,
      // The ranking looks up `object.id`, which is the object's target key ("M31", "NGC7000").
      seen,
      limit: options.limit,
    });
    skyObjects = ranked.entries.slice(0, MAX_RANKED_OBJECTS).map((entry) => entry.object);
    const context = { apertureMm: telescope.apertureMm, bortle: site.bortle };
    planObjects = ranked.entries;
    ranking = {
      clearedCount: ranked.clearedCount,
      clearedText: clearedLine(ranked.clearedCount),
      entries: ranked.entries.map((entry, i) => ({
        rank: i + 1,
        id: entry.object.id,
        label: entry.object.label,
        caldwell: entry.object.caldwell,
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
        label: object.label,
        caldwell: object.caldwell,
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
  let planetVerdict: Verdict | null = null;
  let gate: { window: Extract<DarkWindow, { kind: "window" }>; verdict: Verdict; clear: Interval[] | null } | null =
    null;
  try {
    planetWindow = darkWindow(engineSite, observingNight(date, timeZone), PLANET_WINDOW_SUN_ALTITUDE_DEG);
    const windowVerdict = verdict(planetWindow, hourly, { fallback });
    planetVerdict = windowVerdict;
    if (planetWindow.kind === "window" && (windowVerdict.level === "go" || windowVerdict.level === "marginal")) {
      gate = {
        window: planetWindow,
        verdict: windowVerdict,
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
      planPlanets = ranked;
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
    planPlanets = [];
  }
  // Why the Planets page has nothing to list: the window, then its weather; anything else is a failure.
  const planetsAbsentText =
    solarSystem !== null
      ? null
      : planetWindow !== null && planetWindow.kind !== "window"
        ? messages.tonight.planets.absent.noWindow
        : planetVerdict?.reason.kind === "cloudy" && planetVerdict.reason.minCloudPct !== null
          ? messages.tonight.planets.absent.cloudy({ cloudPct: String(Math.round(planetVerdict.reason.minCloudPct)) })
          : messages.tonight.planets.absent.unavailable;

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
          planMoon = entry;
        }
      } catch {
        target = null;
        planMoon = null;
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
      const up = moonUpOf(engineSite, moonTrack(engineSite, interval, MOON_DISC_STEP_MINUTES));
      const initialIndex = nearestStateIndex(states, selectionNow.getTime());
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

  // The interactive sky (interactive-sky), on the dashboard only: sunset to sunrise, or the whole observing night
  // when either is missing (polar day or night). Frames and every track share one interval and step, so index `i` is
  // the same instant everywhere. Planets show whatever the planet weather; a failure drops only the sky view.
  // The axis and the Moon's track over it are worked out once, for whichever of the two asks first, and shared.
  let axisMoon: { range: Interval; fromSun: boolean; moon: MoonState[] } | null = null;
  // Tracks over that axis by object id or planet key: the sky view keeps the ones it computes, so the Session plan's
  // curves reuse them on the dashboard instead of tracking the same targets twice.
  const axisTracks = new Map<string, HorizontalPosition[]>();
  const skyAxisWithMoon = (): { range: Interval; fromSun: boolean; moon: MoonState[] } => {
    if (axisMoon === null) {
      const { range, fromSun } = skyAxis(engineSite, date, timeZone);
      axisMoon = { range, fromSun, moon: moonTrack(engineSite, range) };
    }
    return axisMoon;
  };

  let skyView: TonightSkyView | null = null;
  if (options.withSkyView) {
    try {
      const { range, moon } = skyAxisWithMoon();
      const frames = skyFrames(engineSite, range);
      const times = frames.map((frame) => frame.time.getTime());
      const startMs = range.start.getTime();
      const endMs = range.end.getTime();

      let darkSpan: TonightSkyView["darkSpan"] = null;
      if (window.kind === "window") {
        const from = times.findIndex((t) => t >= window.start.getTime());
        const to = times.findLastIndex((t) => t <= window.end.getTime());
        darkSpan = from >= 0 && to >= from ? { from, to } : null;
      }
      // The dark window at its exact edges, as fractions of the slider's track plus the same strings `darkWindow`
      // carries. The slider moves by frame index, so a time's fraction is its continuous index over the last one: a
      // frame's own time then lands exactly under the thumb, and only the last (shorter) step is stretched.
      let dark: TonightSkyView["dark"] = null;
      if (window.kind === "window" && frames.length > 1) {
        const lastIndex = frames.length - 1;
        const stepMs = DEFAULT_TRACK_STEP_MINUTES * 60_000;
        const fractionOf = (ms: number) => roundTo(Math.min(Math.max((ms - startMs) / stepMs / lastIndex, 0), 1), 4);
        const from = fractionOf(window.start.getTime());
        const to = fractionOf(window.end.getTime());
        dark =
          to > from
            ? {
                from,
                to,
                startLabel: formatTime(window.start, timeZone),
                endLabel: formatTime(window.end, timeZone),
              }
            : null;
      }
      const nowMs = selectionNow.getTime();
      const initialIndex = nowMs >= startMs && nowMs <= endMs ? nearestIndex(times, nowMs) : (darkSpan?.from ?? 0);

      const listed = new Set(solarSystem?.entries.map((entry) => entry.key) ?? []);
      const objectBodies = objectTracks(engineSite, range, skyObjects).map((track, i): TonightSkyBody => {
        const object = skyObjects[i];
        axisTracks.set(object.id, track);
        const commonName = localCommonName(object.id, object.commonName, locale);
        return {
          kind: "object",
          key: object.id,
          label: object.label,
          name: commonName ? `${object.label} · ${commonName}` : object.label,
          href: `/tonight/targets#object-${object.id}`,
          track: packTrack(track),
        };
      });
      const planetBodies = planetTracks(engineSite, range, PLANET_KEYS).map((track, i): TonightSkyBody => {
        const key = PLANET_KEYS[i];
        axisTracks.set(key, track);
        return {
          kind: "planet",
          key,
          label: messages.targets.planet[key],
          name: messages.targets.planet[key],
          href: listed.has(key) ? `/tonight/planets#planet-${key}` : "/tonight/planets",
          track: packTrack(track),
        };
      });
      const moonBody: TonightSkyBody = {
        kind: "moon",
        key: MOON_TARGET_KEY,
        label: messages.targets.moon,
        name: messages.targets.moon,
        href: "/tonight/moon",
        track: packTrack(moon),
      };

      skyView = {
        startMs,
        stepMs: DEFAULT_TRACK_STEP_MINUTES * 60_000,
        endMs,
        frameCount: frames.length,
        rotations: frames.flatMap((frame) => frame.rotation.map((value) => roundTo(value, 4))),
        sunAltDeg: frames.map((frame) => roundTo(frame.sunAltitudeDeg, 1)),
        darkSpan,
        dark,
        initialIndex,
        facing: site.latitudeDeg < 0 ? "north" : "south",
        timeLabels: frames.map((frame) => formatTime(frame.time, timeZone)),
        zoneLabels: frames.map((frame) => zoneLabelAt(frame.time, timeZone)),
        startLabel: formatTime(range.start, timeZone),
        endLabel: formatTime(range.end, timeZone),
        bodies: [...objectBodies, ...planetBodies, moonBody],
      };
    } catch {
      skyView = null;
    }
  }

  // The Session plan (session-plan-timeline): the targets above on the live sky's axis. A failure drops only the plan.
  let sessionPlan: TonightSessionPlan | null = null;
  if (options.withSessionPlan) {
    try {
      const { range, fromSun, moon } = skyAxisWithMoon();
      const up = moonUpOf(engineSite, moon);
      const moonSpans = up.kind === "part" ? up.spans : up.kind === "all" ? [range] : [];
      // Each row's altitude over the axis, on the live sky's grid (every `DEFAULT_TRACK_STEP_MINUTES`, both ends):
      // only the targets the sky view hasn't already tracked are tracked here.
      const untrackedObjects = planObjects.map(({ object }) => object).filter((object) => !axisTracks.has(object.id));
      objectTracks(engineSite, range, untrackedObjects).forEach((track, i) => {
        axisTracks.set(untrackedObjects[i].id, track);
      });
      const untrackedPlanets = planPlanets.map((entry) => entry.key).filter((key) => !axisTracks.has(key));
      planetTracks(engineSite, range, untrackedPlanets).forEach((track, i) => {
        axisTracks.set(untrackedPlanets[i], track);
      });
      const altitudesOf = (key: string): number[] => {
        const track = axisTracks.get(key);
        if (track === undefined) {
          throw new Error(`No track over the plan's axis for ${key}`);
        }
        return packAltitudes(track);
      };
      const rowOf = (
        kind: TonightSessionPlanRowInput["kind"],
        key: string,
        label: string,
        name: string,
        href: string,
        window: Interval,
        peak: HorizontalPosition,
        track: number[],
      ): TonightSessionPlanRowInput => ({
        kind,
        key,
        window,
        bestAt: peak.time.getTime(),
        label,
        name,
        href,
        bestTime: formatTime(peak.time, timeZone),
        windowText: `${formatTime(window.start, timeZone)}–${formatTime(window.end, timeZone)}`,
        bestDirection: formatDirection(peak),
        track,
        peakAltitudeDeg: roundTo(peak.altitudeDeg, 1),
      });
      const planRows: TonightSessionPlanRowInput[] = [
        ...(planMoon === null
          ? []
          : [
              rowOf(
                "moon",
                MOON_TARGET_KEY,
                messages.targets.moon,
                messages.targets.moon,
                "/tonight/moon",
                planMoon.window,
                planMoon.peak,
                packAltitudes(moon),
              ),
            ]),
        ...planPlanets.map((entry) => {
          const name = messages.targets.planet[entry.key];
          return rowOf(
            "planet",
            entry.key,
            name,
            name,
            `/tonight/planets#planet-${entry.key}`,
            entry.window,
            entry.peak,
            altitudesOf(entry.key),
          );
        }),
        ...planObjects.map(({ object, score, peak }) => {
          const commonName = localCommonName(object.id, object.commonName, locale);
          return rowOf(
            "object",
            object.id,
            object.label,
            commonName ? `${object.label} · ${commonName}` : object.label,
            `/tonight/targets#object-${object.id}`,
            score.window,
            peak,
            altitudesOf(object.id),
          );
        }),
      ];
      const layout = layoutSessionPlan({
        axis: range,
        dark: window.kind === "window" ? window : null,
        moonSpans,
        rows: planRows,
        isWholeHour: (ms) => formatTime(new Date(ms), timeZone).endsWith(":00"),
      });
      // The tile's line, by the raw window ends (the layout's rows are clamped to the axis and carry no window).
      const windowEnds = new Map(planRows.map((row) => [row.key, row.window.end.getTime()]));
      const nowMs = selectionNow.getTime();
      const nextIndex = layout.rows.findIndex((row) => (windowEnds.get(row.key) ?? 0) > nowMs);
      const nextUp: TonightSessionPlan["nextUp"] =
        layout.rows.length === 0
          ? null
          : nowMs < layout.axis.start
            ? { kind: "first", index: 0 }
            : nextIndex >= 0
              ? { kind: "next", index: nextIndex }
              : { kind: "done" };
      const text = messages.tonight.pages.plan;
      const axisMs = layout.axis.end - layout.axis.start;
      const hourAt = (hour: number): number => (axisMs > 0 ? (hour - layout.axis.start) / axisMs : 0);
      const moonEvents = layout.moonEvents.map((event) => ({
        ...event,
        timeText: formatTime(new Date(event.time), timeZone),
      }));
      sessionPlan = {
        sunsetText: fromSun ? text.sunset({ time: formatTime(range.start, timeZone) }) : null,
        sunriseText: fromSun ? text.sunrise({ time: formatTime(range.end, timeZone) }) : null,
        dark: layout.dark,
        darkText:
          window.kind === "window"
            ? text.dark({ start: formatTime(window.start, timeZone), end: formatTime(window.end, timeZone) })
            : text.noDark,
        moonEvents,
        moonText:
          moonEvents.length > 0
            ? moonEvents
                .map((event) =>
                  event.kind === "rise"
                    ? text.moonrise({ time: event.timeText })
                    : text.moonset({ time: event.timeText }),
                )
                .join(" · ")
            : // No rise or set strictly inside the axis: up at its start means up throughout (a "part" Moon that
              // rises or sets only at the last sample counts as what it was before).
              up.kind === "all" || (up.kind === "part" && up.upAtStart)
              ? text.moonAll
              : text.moonNever,
        ticks: layout.hours.map((hour) => ({
          at: hourAt(hour),
          label: formatTime(new Date(hour), timeZone),
        })),
        rows: layout.rows,
        minAltitudeDeg: site.minAltitudeDeg,
        trackStep: axisMs > 0 ? (DEFAULT_TRACK_STEP_MINUTES * 60_000) / axisMs : 1,
        nextUp,
      };
    } catch (error) {
      // The page says the plan is unavailable; this leaves a trace for us. A fixed line and the error's name only:
      // an engine message or stack could carry the site's coordinates, which never go into logs.
      // eslint-disable-next-line no-console -- a fixed line and the error's name, never its message (see above).
      console.error("buildTonight: the Session plan failed", error instanceof Error ? error.name : typeof error);
      sessionPlan = null;
    }
  }

  return {
    siteId: site.id,
    telescopeId: telescope.id,
    siteName: site.name,
    telescopeName: telescope.name,
    date,
    validUntil: planetWindow?.kind === "window" ? planetWindow.end : observingNight(date, timeZone).end,
    dateLabel: formatNightDate(date),
    timeZone,
    zoneLabel,
    verdict: tonight,
    headline: skyHeadline(tonight),
    verdictText: verdictReasonText(tonight),
    darkWindow:
      window.kind === "window"
        ? { kind: "window", start: formatTime(window.start, timeZone), end: formatTime(window.end, timeZone) }
        : { kind: "none" },
    darkStart: window.kind === "window" ? window.start : null,
    ranking,
    summaryTargets:
      ranking === null
        ? []
        : [...ranking.entries]
            .sort((a, b) => a.rank - b.rank)
            .slice(0, SUMMARY_TARGETS)
            .sort((a, b) => a.bestAt - b.bestAt),
    hasEyepieces: eyepieces.length > 0,
    forecastFetchedAt: forecast?.fetchedAt ?? null,
    forecastStatus: { kind: status.kind, text: forecastStatusText(status) },
    explanation,
    nights,
    solarSystem,
    planetsAbsentText,
    moonCard,
    skyView,
    sessionPlan,
  };
}
