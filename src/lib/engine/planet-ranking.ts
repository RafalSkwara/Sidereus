import { planetEyepiece } from "./eyepieces";
import type { EyepieceOpticsInput, TelescopeOpticsInput } from "./eyepieces";
import type { SeenSummary } from "./log";
import { bestWindow } from "./objects";
import type { BestWindow } from "./objects";
import {
  DEFAULT_TRACK_STEP_MINUTES,
  ICE_GIANT_MIN_APERTURE_MM,
  PLANET_LOW_ALTITUDE_DEG,
  PLANET_SCORE_WEIGHTS,
  PLANET_SIZE_REFERENCE_ARCSEC,
  WELL_PLACED_ALTITUDE_DEG,
} from "./parameters";
import { PLANET_KEYS, isIceGiant, planetFacts, planetTracks } from "./planets";
import type { PlanetFacts, PlanetKey } from "./planets";
import type { DarkWindow, HorizontalPosition, Site } from "./types";

/**
 * Which planets are worth a look tonight and in what order (M-2 S-01). Pure and deterministic:
 * identical inputs give an identical list.
 *
 * Planets are ranked over the planet window (sun below `PLANET_WINDOW_SUN_ALTITUDE_DEG`), not the dark
 * window, and apart from the deep-sky ranking: there is no score bar and no log penalty, since a
 * planet is worth revisiting every night. The log only adds the "seen" tag.
 */

export interface PlanetRankInput<E extends EyepieceOpticsInput = EyepieceOpticsInput> {
  site: Site;
  minAltitudeDeg: number;
  /** The civil-twilight window, `darkWindow(site, night, PLANET_WINDOW_SUN_ALTITUDE_DEG)`. */
  planetWindow: Extract<DarkWindow, { kind: "window" }>;
  telescope: TelescopeOpticsInput;
  /** The user's eyepieces in `created_at` order (ties go to the earlier one). */
  eyepieces: readonly E[];
  /** Targets already seen, by target key (`seenSummaries`); absent means an empty log. */
  seen?: ReadonlyMap<string, SeenSummary>;
}

export interface PlanetScore {
  /** Peak altitude between the site's minimum (0) and `WELL_PLACED_ALTITUDE_DEG` (1). */
  placement: number;
  /** Apparent diameter over `PLANET_SIZE_REFERENCE_ARCSEC`, capped at 1. */
  size: number;
  /** `PLANET_SCORE_WEIGHTS`-weighted sum, 0-1. */
  total: number;
}

/** How high the planet gets: low below `PLANET_LOW_ALTITUDE_DEG`, high at `WELL_PLACED_ALTITUDE_DEG` or above. */
export type PlanetPlacement = "high" | "well" | "low";

/** Which third of the planet window holds the peak. */
export type PlanetTiming = "evening" | "night" | "morning";

export interface PlanetEntry<E extends EyepieceOpticsInput = EyepieceOpticsInput> {
  key: PlanetKey;
  /** The longest stretch at or above the site's minimum altitude within the planet window. */
  window: BestWindow;
  /** Where the planet is at the highest sample of `window`. */
  peak: HorizontalPosition;
  score: PlanetScore;
  /** At the peak instant. */
  facts: PlanetFacts;
  /** The detail eyepiece (`planetEyepiece`); `null` when the kit has no eyepieces. */
  eyepiece: E | null;
  placement: PlanetPlacement;
  timing: PlanetTiming;
  /** `null` unless the log counts the planet as seen. */
  seen: SeenSummary | null;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/**
 * Placement component. A site minimum at or above `WELL_PLACED_ALTITUDE_DEG` leaves no ramp, and
 * every listed planet already clears that minimum, so it counts as fully placed.
 */
function placementScore(peakAltitudeDeg: number, minAltitudeDeg: number): number {
  const span = WELL_PLACED_ALTITUDE_DEG - minAltitudeDeg;
  return span <= 0 ? 1 : clamp01((peakAltitudeDeg - minAltitudeDeg) / span);
}

function placementOf(peakAltitudeDeg: number): PlanetPlacement {
  if (peakAltitudeDeg < PLANET_LOW_ALTITUDE_DEG) {
    return "low";
  }
  return peakAltitudeDeg >= WELL_PLACED_ALTITUDE_DEG ? "high" : "well";
}

/**
 * Thirds are half-open, [0, ⅓) evening, [⅓, ⅔) night, [⅔, 1] morning, so a peak exactly on a boundary
 * belongs to the later third. Compared in whole milliseconds, so the boundaries are exact.
 */
function timingOf(peak: Date, window: { start: Date; end: Date }): PlanetTiming {
  const length = window.end.getTime() - window.start.getTime();
  const elapsed = peak.getTime() - window.start.getTime();
  if (3 * elapsed < length) {
    return "evening";
  }
  return 3 * elapsed < 2 * length ? "night" : "morning";
}

/**
 * The planets that clear the site's minimum altitude during the planet window, best first. Uranus and
 * Neptune are left out below `ICE_GIANT_MIN_APERTURE_MM`. Ordered by `score.total` descending; ties
 * follow solar order.
 */
export function rankPlanets<E extends EyepieceOpticsInput>(input: PlanetRankInput<E>): PlanetEntry<E>[] {
  const { site, minAltitudeDeg, planetWindow, telescope, eyepieces, seen } = input;
  const keys = PLANET_KEYS.filter((key) => !isIceGiant(key) || telescope.apertureMm >= ICE_GIANT_MIN_APERTURE_MM);
  const interval = { start: planetWindow.start, end: planetWindow.end };
  const tracks = planetTracks(site, interval, keys, DEFAULT_TRACK_STEP_MINUTES);
  // The same for every planet: one detail eyepiece per telescope.
  const eyepiece = planetEyepiece(telescope, eyepieces);

  const entries: PlanetEntry<E>[] = [];
  keys.forEach((key, i) => {
    const window = bestWindow(tracks[i], minAltitudeDeg);
    if (window === null) {
      return;
    }
    const { peak } = window;
    const facts = planetFacts(key, peak.time);
    const placement = placementScore(peak.altitudeDeg, minAltitudeDeg);
    const size = clamp01(facts.apparentDiameterArcsec / PLANET_SIZE_REFERENCE_ARCSEC);
    entries.push({
      key,
      window,
      peak,
      score: {
        placement,
        size,
        total: PLANET_SCORE_WEIGHTS.placement * placement + PLANET_SCORE_WEIGHTS.size * size,
      },
      facts,
      eyepiece,
      placement: placementOf(peak.altitudeDeg),
      timing: timingOf(peak.time, interval),
      seen: seen?.get(key) ?? null,
    });
  });
  return entries.sort(
    (a, b) => b.score.total - a.score.total || PLANET_KEYS.indexOf(a.key) - PLANET_KEYS.indexOf(b.key),
  );
}
