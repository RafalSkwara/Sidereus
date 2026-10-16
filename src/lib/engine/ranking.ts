import type { DeepSkyObject } from "@/lib/catalogue";

import { pairEyepieces } from "./eyepieces";
import type { SeenSummary } from "./log";
import type { EyepieceOpticsInput, EyepiecePair, NoEyepieceFits, TelescopeOpticsInput } from "./eyepieces";
import { moonSeparationsDeg, moonTrack } from "./moon";
import { objectTracks } from "./objects";
import {
  DEFAULT_TRACK_STEP_MINUTES,
  LOG_PENALTY,
  MAX_RANKED_OBJECTS,
  MESSIER_RANK_BONUS,
  MIN_OBJECT_SCORE,
  REASON_MIN_SPREAD,
  SCORE_WEIGHTS,
} from "./parameters";
import { SCORE_COMPONENTS, scoreObject } from "./score";
import type { ObjectScore, ScoreComponent, ScoreComponents } from "./score";
import type { BestWindow } from "./objects";
import type { DarkWindow, HorizontalPosition, Site } from "./types";

/**
 * Ranks the catalogue for one site, night and telescope (FR-013) and picks each listed object's
 * leading reason. Pure and deterministic: identical inputs give an identical ranking.
 *
 * Tracks are computed once over the dark window (`objectTracks` for every object, `moonTrack` on
 * the same grid) and every score reads those arrays; nothing here samples an object on its own.
 */

/**
 * What the ranking needs about a catalogue object. `DeepSkyObject` (and so `MessierObject` and
 * `CaldwellObject`) is assignable to it. `id` (`"M31"`, `"NGC7000"`) is the object's target key in the
 * log; `messier` is null for a non-Messier object, earns `MESSIER_RANK_BONUS` and breaks ties in the order.
 */
export type RankableObject = Pick<
  DeepSkyObject,
  | "id"
  | "messier"
  | "raHours"
  | "decDeg"
  | "vMag"
  | "surfaceBrightness"
  | "type"
  | "majorAxisArcmin"
  | "minorAxisArcmin"
  | "hubble"
>;

/** A telescope as the ranking needs it. The gear store's `TelescopeRecord` is assignable to it. */
export interface RankTelescope extends TelescopeOpticsInput {
  id: string;
}

export interface RankInput<
  O extends RankableObject = RankableObject,
  E extends EyepieceOpticsInput = EyepieceOpticsInput,
> {
  site: Site;
  bortle: number;
  minAltitudeDeg: number;
  darkWindow: Extract<DarkWindow, { kind: "window" }>;
  telescope: RankTelescope;
  /** The user's eyepieces in `created_at` order (pairing ties go to the earlier one). */
  eyepieces: readonly E[];
  catalogue: readonly O[];
  /**
   * Objects already seen, by target key (`seenSummaries`, looked up by `object.id`); absent means an
   * empty log. A seen object is ordered by its score less `LOG_PENALTY`, but still clears the bar on
   * its own score (FR-018). Likewise the Messier bonus moves the order only, never the bar.
   */
  seen?: ReadonlyMap<string, SeenSummary>;
  /**
   * How many cleared objects get full entries (eyepiece pair, reasons); `clearedCount` always counts them all.
   * Defaults to `MAX_RANKED_OBJECTS` (Tonight's top five); `Infinity` lists every cleared object
   * (tonight-all-objects). Reasons compare each entry against the entries listed.
   */
  limit?: number;
}

export interface RankedEntry<
  O extends RankableObject = RankableObject,
  E extends EyepieceOpticsInput = EyepieceOpticsInput,
> {
  object: O;
  score: ObjectScore;
  /** Where the object is at the highest sample of its best window. */
  peak: HorizontalPosition;
  /** `null` when the kit has no eyepieces. */
  pair: EyepiecePair<E> | NoEyepieceFits<E> | null;
  leadComponent: ScoreComponent;
  /** `null` when fewer than two reasons are named for the object (`reasonComponents`). */
  secondComponent: ScoreComponent | null;
  /**
   * The key the ranking is ordered by: `score.total`, less `LOG_PENALTY` for a seen object, plus
   * `MESSIER_RANK_BONUS` for a Messier object.
   */
  rankScore: number;
  /** `null` unless the log counts the object as seen. */
  seen: SeenSummary | null;
}

/** An object tonight's Moon washes out (`ObjectScore.washedOut`): listed apart, never ranked. */
export interface WashedOutEntry<O extends RankableObject = RankableObject> {
  object: O;
  window: BestWindow;
  /** Where the object is at the highest sample of its best window. */
  peak: HorizontalPosition;
}

/**
 * An object the telescope can reach tonight: it has a score, so its best window over the dark window exists. Cleared,
 * washed-out and below-bar objects alike (adjustable-session-plan: what the Session plan's "add" offers).
 */
export interface ReachableEntry<O extends RankableObject = RankableObject> {
  object: O;
  window: BestWindow;
  /** Where the object is at the highest sample of its best window. */
  peak: HorizontalPosition;
  /** Tonight's Moon washes it out (`ObjectScore.washedOut`). */
  washedOut: boolean;
  /** It cleared `MIN_OBJECT_SCORE` and is not washed out: it is, or could be, ranked (below the listed ones, a rank). */
  cleared: boolean;
}

export interface Ranking<
  O extends RankableObject = RankableObject,
  E extends EyepieceOpticsInput = EyepieceOpticsInput,
> {
  /** How many objects cleared `MIN_OBJECT_SCORE`, including those beyond the listed ones. Never a washed-out one. */
  clearedCount: number;
  /** The first `limit` cleared objects (default `MAX_RANKED_OBJECTS`), best first. */
  entries: RankedEntry<O, E>[];
  /** Every washed-out object, by best time (ties: Messier number, then id); not capped by `limit`. */
  washedOut: WashedOutEntry<O>[];
  washedOutCount: number;
  /**
   * Every object with a score (a best window over the dark window, within the telescope's reach), in catalogue order and
   * not capped by `limit`: the cleared, the washed-out and the ones below the bar.
   */
  reachable: ReachableEntry<O>[];
  telescopeId: string;
}

export interface ReasonComponents {
  lead: ScoreComponent;
  /** `null` when fewer than two components are named for the entry: its reason line then carries one phrase. */
  second: ScoreComponent | null;
}

/**
 * Slack, far below any score the engine can tell apart, for an entry that sits exactly on the listed mean: the mean of
 * equal values need not round back to the value itself (0.1 three times averages to 0.10000000000000002).
 */
const AT_MEAN_TOLERANCE = 1e-9;

/**
 * The best of `candidates` (kept in `SCORE_COMPONENTS` order) by the reason key: the largest positive weighted deviation
 * if any candidate has one, else the largest weighted value. A strictly larger key is needed to overtake, so ties go to
 * the earlier component. `null` for no candidates.
 */
function bestOf(
  candidates: readonly ScoreComponent[],
  deviation: (c: ScoreComponent) => number,
  weighted: (c: ScoreComponent) => number,
): ScoreComponent | null {
  const key = candidates.some((c) => deviation(c) > 0) ? deviation : weighted;
  let best: ScoreComponent | null = null;
  for (const c of candidates) {
    if (best === null || key(c) > key(best)) {
      best = c;
    }
  }
  return best;
}

/**
 * Each listed entry's leading and runner-up reason (FR-015): what sets the object apart from the others tonight, and only
 * what is true of it.
 *
 * - Eligible components: `duration` and `brightness` always; `moon` and `sky` only when the listed entries' values for
 *   that component differ (largest minus smallest) by at least `REASON_MIN_SPREAD`, so a moonless night never names the
 *   Moon and a list with no sky penalty never names the sky. One entry has a spread of 0.
 * - Named for an entry: an eligible component whose value is at least the listed mean ("Bright for your N mm" is a
 *   positive claim, so it never labels the entry that is the list's weakest on it).
 * - The lead is the named component with the largest positive weighted deviation, `SCORE_WEIGHTS[c] × (value_c − mean_c)`;
 *   else the largest weighted value among the named; else, with nothing named, the largest weighted value among the
 *   eligible. The second is chosen by the same key among the remaining named components, and is `null` when fewer than two
 *   are named.
 *
 * With a single entry the mean is its own value, so duration and brightness are named. Ties go in the order duration,
 * moon, brightness, sky.
 */
export function reasonComponents(listed: readonly ScoreComponents[]): ReasonComponents[] {
  const meanOf = (c: ScoreComponent): number =>
    listed.reduce((sum, components) => sum + components[c], 0) / listed.length;
  const spreadOf = (c: ScoreComponent): number => {
    const values = listed.map((components) => components[c]);
    return Math.max(...values) - Math.min(...values);
  };
  const mean: ScoreComponents = {
    duration: meanOf("duration"),
    moon: meanOf("moon"),
    brightness: meanOf("brightness"),
    sky: meanOf("sky"),
  };
  const eligible = SCORE_COMPONENTS.filter(
    (c) => c === "duration" || c === "brightness" || spreadOf(c) >= REASON_MIN_SPREAD,
  );
  return listed.map((components) => {
    const deviation = (c: ScoreComponent): number => SCORE_WEIGHTS[c] * (components[c] - mean[c]);
    const weighted = (c: ScoreComponent): number => SCORE_WEIGHTS[c] * components[c];
    const named = eligible.filter((c) => components[c] >= mean[c] - AT_MEAN_TOLERANCE);
    // Duration and brightness are always eligible, so `eligible` and the lead are never empty.
    const lead = bestOf(named.length > 0 ? named : eligible, deviation, weighted) ?? "duration";
    const second =
      named.length > 1
        ? bestOf(
            named.filter((c) => c !== lead),
            deviation,
            weighted,
          )
        : null;
    return { lead, second };
  });
}

/**
 * Deterministic order for objects the key leaves level: the Messier number ascending (a non-Messier
 * object after every Messier one), then the id (`"IC405"` < `"NGC7000"`, plain code-unit order).
 */
function tieBreak(a: Pick<RankableObject, "id" | "messier">, b: Pick<RankableObject, "id" | "messier">): number {
  if (a.messier !== b.messier) {
    if (a.messier === null) {
      return 1;
    }
    if (b.messier === null) {
      return -1;
    }
    return a.messier - b.messier;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function rankObjects<O extends RankableObject, E extends EyepieceOpticsInput>(
  input: RankInput<O, E>,
): Ranking<O, E> {
  const { site, bortle, minAltitudeDeg, darkWindow, telescope, eyepieces, catalogue, seen } = input;
  const limit = input.limit ?? MAX_RANKED_OBJECTS;
  const interval = { start: darkWindow.start, end: darkWindow.end };
  const tracks = objectTracks(site, interval, catalogue, DEFAULT_TRACK_STEP_MINUTES);
  const moon = moonTrack(site, interval, DEFAULT_TRACK_STEP_MINUTES);
  // One Moon vector per sample, dotted with every object's (the tracks share the Moon's grid).
  const separations = moonSeparationsDeg(
    moon.map((state) => state.time),
    catalogue,
  );

  const scored: { object: O; score: ObjectScore; seen: SeenSummary | null; rankScore: number }[] = [];
  const washedOut: WashedOutEntry<O>[] = [];
  const reachable: ReachableEntry<O>[] = [];
  catalogue.forEach((object, i) => {
    const score = scoreObject({
      object,
      track: tracks[i],
      moonTrack: moon,
      moonSeparationsDeg: separations[i],
      minAltitudeDeg,
      bortle,
      apertureMm: telescope.apertureMm,
    });
    if (score !== null) {
      reachable.push({
        object,
        window: score.window,
        peak: score.window.peak,
        washedOut: score.washedOut,
        cleared: !score.washedOut && score.total >= MIN_OBJECT_SCORE,
      });
    }
    if (score?.washedOut) {
      washedOut.push({ object, window: score.window, peak: score.window.peak });
    } else if (score !== null) {
      const seenSummary = seen?.get(object.id) ?? null;
      scored.push({
        object,
        score,
        seen: seenSummary,
        rankScore:
          score.total - (seenSummary === null ? 0 : LOG_PENALTY) + (object.messier === null ? 0 : MESSIER_RANK_BONUS),
      });
    }
  });
  // The bar reads the object's own score; only the order feels the log and the Messier bonus.
  scored.sort((a, b) => b.rankScore - a.rankScore || tieBreak(a.object, b.object));

  const cleared = scored.filter((s) => s.score.total >= MIN_OBJECT_SCORE);
  const listed = cleared.slice(0, limit);
  const reasons = reasonComponents(listed.map((s) => s.score.components));
  const entries = listed.map(({ object, score, seen: seenSummary, rankScore }, i): RankedEntry<O, E> => ({
    object,
    score,
    peak: score.window.peak,
    pair: pairEyepieces(telescope, eyepieces, object.majorAxisArcmin),
    leadComponent: reasons[i].lead,
    secondComponent: reasons[i].second,
    rankScore,
    seen: seenSummary,
  }));
  washedOut.sort((a, b) => a.peak.time.getTime() - b.peak.time.getTime() || tieBreak(a.object, b.object));
  return {
    clearedCount: cleared.length,
    entries,
    washedOut,
    washedOutCount: washedOut.length,
    reachable,
    telescopeId: telescope.id,
  };
}
