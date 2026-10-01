import { eyepieceOptics, planetEyepiece, wholeDiscEyepiece } from "./eyepieces";
import type { EyepieceOpticsInput, TelescopeOpticsInput, WholeDiscEyepiece } from "./eyepieces";
import type { SeenSummary } from "./log";
import { moonElongationDeg, moonPhaseBand, moonState, moonTrack } from "./moon";
import { bestWindow } from "./objects";
import type { BestWindow } from "./objects";
import {
  BRIGHT_MOON_MIN_ILLUMINATION,
  BRIGHT_MOON_MIN_UP_FRACTION,
  DEFAULT_TRACK_STEP_MINUTES,
  MOON_LOW_ALTITUDE_DEG,
  MOON_MIN_ILLUMINATION,
  WELL_PLACED_ALTITUDE_DEG,
} from "./parameters";
import type { MoonPhaseBand } from "./parameters";
import { maskedTrack, timingOf } from "./solar-system-window";
import type { PlanetTiming } from "./solar-system-window";
import type { HorizontalPosition, Interval, Site } from "./types";

/**
 * The Moon as a target (M-2 S-02): the Moon's counterpart of one `rankPlanets` entry, over the same planet
 * window and weather masking, plus the bright-Moon predicate behind the verdict-card line. Pure and
 * deterministic: identical inputs give an identical result.
 */

export interface MoonTargetInput<E extends EyepieceOpticsInput = EyepieceOpticsInput> {
  site: Site;
  minAltitudeDeg: number;
  /** The planet window, `darkWindow(site, night, PLANET_WINDOW_SUN_ALTITUDE_DEG)`. */
  window: Interval;
  telescope: TelescopeOpticsInput;
  /** The user's eyepieces in `created_at` order (ties go to the earlier one). */
  eyepieces: readonly E[];
  /** Targets already seen, by target key (`seenSummaries`); the Moon's key is `moon`. Absent means an empty log. */
  seen?: ReadonlyMap<string, SeenSummary>;
  /**
   * When given, the Moon counts as up only at samples inside one of these intervals (both ends included), e.g.
   * the planet window's clear hours, exactly as for `rankPlanets`. The timing thirds stay relative to the whole
   * window. Absent means the whole window counts.
   */
  visibleIntervals?: readonly Interval[];
}

/** How high the Moon gets: low below `MOON_LOW_ALTITUDE_DEG`, high at `WELL_PLACED_ALTITUDE_DEG` or above. */
export type MoonPlacement = "low" | "well" | "high";

export interface MoonFacts {
  /** Illuminated fraction of the disc at the peak, [0, 1]. */
  illuminatedFraction: number;
  /** Sun–Moon elongation at the peak, [0, 360) (`moonElongationDeg`). */
  elongationDeg: number;
  band: MoonPhaseBand;
}

export interface MoonTargetEntry<E extends EyepieceOpticsInput = EyepieceOpticsInput> {
  /** The longest stretch at or above the site's minimum altitude within the window (and `visibleIntervals`). */
  window: BestWindow;
  /** Where the Moon is at the highest sample of `window`. */
  peak: HorizontalPosition;
  /** At the peak instant. */
  facts: MoonFacts;
  placement: MoonPlacement;
  timing: PlanetTiming;
  /** The eyepiece that frames the whole disc (`wholeDiscEyepiece`); `null` for an empty kit. */
  wholeDisc: WholeDiscEyepiece<E> | null;
  /**
   * The detail eyepiece (`planetEyepiece`); `null` for an empty kit, or when it magnifies no more than the
   * whole-disc eyepiece (its lowest-magnification fallback would read as nonsense next to the whole-disc pick).
   */
  detail: E | null;
  /** `null` unless the log counts the Moon as seen. */
  seen: SeenSummary | null;
}

/** The Moon's target key in the log and in `seen`. */
const MOON_KEY = "moon";

export function moonPlacementOf(peakAltitudeDeg: number): MoonPlacement {
  if (peakAltitudeDeg < MOON_LOW_ALTITUDE_DEG) {
    return "low";
  }
  return peakAltitudeDeg >= WELL_PLACED_ALTITUDE_DEG ? "high" : "well";
}

/**
 * The Moon tonight, or `null` when no sample of the window (masked to `visibleIntervals`) clears the site's
 * minimum altitude, or when it is lit less than `MOON_MIN_ILLUMINATION` at the peak.
 */
export function moonTarget<E extends EyepieceOpticsInput>(input: MoonTargetInput<E>): MoonTargetEntry<E> | null {
  const { site, minAltitudeDeg, window: interval, telescope, eyepieces, seen, visibleIntervals } = input;
  const track = moonTrack(site, interval, DEFAULT_TRACK_STEP_MINUTES);
  const visible = visibleIntervals === undefined ? track : maskedTrack(track, visibleIntervals);
  const best = bestWindow(visible, minAltitudeDeg);
  if (best === null) {
    return null;
  }
  // `bestWindow` is typed on plain positions, so the peak's facts are recomputed at its instant, and the peak
  // is trimmed to a plain position.
  const peak: HorizontalPosition = {
    time: best.peak.time,
    altitudeDeg: best.peak.altitudeDeg,
    azimuthDeg: best.peak.azimuthDeg,
  };
  const { illuminatedFraction } = moonState(site, peak.time);
  if (illuminatedFraction < MOON_MIN_ILLUMINATION) {
    return null;
  }
  const elongationDeg = moonElongationDeg(peak.time);

  const wholeDisc = wholeDiscEyepiece(telescope, eyepieces);
  const detailPick = planetEyepiece(telescope, eyepieces);
  const detail =
    detailPick !== null &&
    wholeDisc !== null &&
    eyepieceOptics(telescope, detailPick).magnification > wholeDisc.optics.magnification
      ? detailPick
      : null;

  return {
    window: { start: best.start, end: best.end, peak },
    peak,
    facts: { illuminatedFraction, elongationDeg, band: moonPhaseBand(elongationDeg) },
    placement: moonPlacementOf(peak.altitudeDeg),
    timing: timingOf(peak.time, interval),
    wholeDisc,
    detail,
    seen: seen?.get(MOON_KEY) ?? null,
  };
}

/**
 * Whether tonight's Moon washes out faint deep sky (the verdict-card line): at least
 * `BRIGHT_MOON_MIN_ILLUMINATION` lit and above the horizon for more than `BRIGHT_MOON_MIN_UP_FRACTION` of the
 * dark window. The caller passes the seven-night outlook's night-1 values (illumination at the dark-window
 * midpoint, and 1 − moon-free minutes ÷ dark-window minutes), so the card and the strip never disagree.
 */
export function isBrightMoon(illuminatedFraction: number, upFraction: number): boolean {
  return illuminatedFraction >= BRIGHT_MOON_MIN_ILLUMINATION && upFraction > BRIGHT_MOON_MIN_UP_FRACTION;
}
