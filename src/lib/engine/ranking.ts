import type { MessierObject } from "@/lib/catalogue";

import { pairEyepieces } from "./eyepieces";
import type { EyepieceOpticsInput, EyepiecePair, NoEyepieceFits, TelescopeOpticsInput } from "./eyepieces";
import { moonTrack } from "./moon";
import { objectTracks } from "./objects";
import { DEFAULT_TRACK_STEP_MINUTES, MAX_RANKED_OBJECTS, MIN_OBJECT_SCORE, SCORE_WEIGHTS } from "./parameters";
import { SCORE_COMPONENTS, scoreObject } from "./score";
import type { ObjectScore, ScoreComponent, ScoreComponents } from "./score";
import type { DarkWindow, HorizontalPosition, Site } from "./types";

/**
 * Ranks the catalogue for one site, night and telescope (FR-013) and picks each listed object's
 * leading reason. Pure and deterministic: identical inputs give an identical ranking.
 *
 * Tracks are computed once over the dark window (`objectTracks` for every object, `moonTrack` on
 * the same grid) and every score reads those arrays; nothing here samples an object on its own.
 */

/** What the ranking needs about a catalogue object. `MessierObject` is assignable to it. */
export type RankableObject = Pick<
  MessierObject,
  "messier" | "raHours" | "decDeg" | "vMag" | "surfaceBrightness" | "type" | "majorAxisArcmin"
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
}

export interface Ranking<
  O extends RankableObject = RankableObject,
  E extends EyepieceOpticsInput = EyepieceOpticsInput,
> {
  /** How many objects cleared `MIN_OBJECT_SCORE`, including those beyond the listed ones. */
  clearedCount: number;
  /** The first `MAX_RANKED_OBJECTS` cleared objects, best first. */
  entries: RankedEntry<O, E>[];
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
  const { site, bortle, minAltitudeDeg, darkWindow, telescope, eyepieces, catalogue } = input;
  const interval = { start: darkWindow.start, end: darkWindow.end };
  const tracks = objectTracks(site, interval, catalogue, DEFAULT_TRACK_STEP_MINUTES);
  const moon = moonTrack(site, interval, DEFAULT_TRACK_STEP_MINUTES);

  const scored: { object: O; score: ObjectScore }[] = [];
  catalogue.forEach((object, i) => {
    const score = scoreObject({
      object,
      track: tracks[i],
      moonTrack: moon,
      minAltitudeDeg,
      bortle,
      apertureMm: telescope.apertureMm,
    });
    if (score !== null) {
      scored.push({ object, score });
    }
  });
  scored.sort((a, b) => b.score.total - a.score.total || a.object.messier - b.object.messier);

  const cleared = scored.filter((s) => s.score.total >= MIN_OBJECT_SCORE);
  const listed = cleared.slice(0, MAX_RANKED_OBJECTS);
  const reasons = reasonComponents(listed.map((s) => s.score.components));
  const entries = listed.map(({ object, score }, i): RankedEntry<O, E> => ({
    object,
    score,
    peak: score.window.peak,
    pair: pairEyepieces(telescope, eyepieces, object.majorAxisArcmin),
    leadComponent: reasons[i].lead,
    secondComponent: reasons[i].second,
  }));
  return { clearedCount: cleared.length, entries, telescopeId: telescope.id };
}
