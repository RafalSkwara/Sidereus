import type { MessierObject } from "@/lib/catalogue";

import { pairEyepieces } from "./eyepieces";
import type { SeenSummary } from "./log";
import type { EyepieceOpticsInput, EyepiecePair, NoEyepieceFits, TelescopeOpticsInput } from "./eyepieces";
import { moonSeparationsDeg, moonTrack } from "./moon";
import { objectTracks } from "./objects";
import {
  DEFAULT_TRACK_STEP_MINUTES,
  LOG_PENALTY,
  MAX_RANKED_OBJECTS,
  MIN_OBJECT_SCORE,
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
 * What the ranking needs about a catalogue object. `MessierObject` is assignable to it. `id` (`"M31"`)
 * is the object's target key in the log; `messier` breaks ties in the order.
 */
export type RankableObject = Pick<
  MessierObject,
  | "id"
  | "messier"
  | "raHours"
  | "decDeg"
  | "vMag"
  | "surfaceBrightness"
  | "type"
  | "majorAxisArcmin"
  | "minorAxisArcmin"
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
   * its own score (FR-018).
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
  secondComponent: ScoreComponent;
  /** The key the ranking is ordered by: `score.total`, less `LOG_PENALTY` for a seen object. */
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

export interface Ranking<
  O extends RankableObject = RankableObject,
  E extends EyepieceOpticsInput = EyepieceOpticsInput,
> {
  /** How many objects cleared `MIN_OBJECT_SCORE`, including those beyond the listed ones. Never a washed-out one. */
  clearedCount: number;
  /** The first `limit` cleared objects (default `MAX_RANKED_OBJECTS`), best first. */
  entries: RankedEntry<O, E>[];
  /** Every washed-out object, by best time (ties by Messier number); not capped by `limit`. */
  washedOut: WashedOutEntry<O>[];
  washedOutCount: number;
  telescopeId: string;
}

export interface ReasonComponents {
  lead: ScoreComponent;
  second: ScoreComponent;
}

/**
 * The top two components in `SCORE_COMPONENTS` order of a per-component value; a strictly larger
 * value is needed to overtake, so ties go to the earlier component.
 */
function topTwo(value: (c: ScoreComponent) => number): ReasonComponents {
  const [first, ...rest] = SCORE_COMPONENTS;
  let lead: ScoreComponent = first;
  for (const c of rest) {
    if (value(c) > value(lead)) {
      lead = c;
    }
  }
  let second: ScoreComponent | null = null;
  for (const c of SCORE_COMPONENTS) {
    if (c !== lead && (second === null || value(c) > value(second))) {
      second = c;
    }
  }
  if (second === null) {
    throw new Error("reasonComponents: unreachable, there are four components");
  }
  return { lead, second };
}

/**
 * Each listed entry's leading and runner-up reason: the component c maximising
 * `SCORE_WEIGHTS[c] × (value_c − mean of value_c over the listed entries)`, i.e. what sets this
 * object apart from the others tonight. With a single entry there is nothing to compare against,
 * so the largest weighted value leads, and the same fallback applies to an entry that stands out on
 * no component (every lead ≤ 0). Ties go in the order duration, moon, brightness, sky.
 */
export function reasonComponents(listed: readonly ScoreComponents[]): ReasonComponents[] {
  if (listed.length === 1) {
    const [only] = listed;
    return [topTwo((c) => SCORE_WEIGHTS[c] * only[c])];
  }
  const meanOf = (c: ScoreComponent): number =>
    listed.reduce((sum, components) => sum + components[c], 0) / listed.length;
  const mean: ScoreComponents = {
    duration: meanOf("duration"),
    moon: meanOf("moon"),
    brightness: meanOf("brightness"),
    sky: meanOf("sky"),
  };
  return listed.map((components) => {
    const lead = (c: ScoreComponent): number => SCORE_WEIGHTS[c] * (components[c] - mean[c]);
    const standsOut = SCORE_COMPONENTS.some((c) => lead(c) > 0);
    return standsOut ? topTwo(lead) : topTwo((c) => SCORE_WEIGHTS[c] * components[c]);
  });
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
    if (score?.washedOut) {
      washedOut.push({ object, window: score.window, peak: score.window.peak });
    } else if (score !== null) {
      const seenSummary = seen?.get(object.id) ?? null;
      scored.push({
        object,
        score,
        seen: seenSummary,
        rankScore: seenSummary === null ? score.total : score.total - LOG_PENALTY,
      });
    }
  });
  // The bar reads the object's own score; only the order feels the log.
  scored.sort((a, b) => b.rankScore - a.rankScore || a.object.messier - b.object.messier);

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
  washedOut.sort((a, b) => a.peak.time.getTime() - b.peak.time.getTime() || a.object.messier - b.object.messier);
  return {
    clearedCount: cleared.length,
    entries,
    washedOut,
    washedOutCount: washedOut.length,
    telescopeId: telescope.id,
  };
}
