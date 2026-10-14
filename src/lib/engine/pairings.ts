import { AngleBetween, Body, Equator, Horizon, MakeTime, Vector } from "astronomy-engine";
import type { AstroTime, Observer } from "astronomy-engine";

import { visibleAt } from "./events";
import type { EventVisibility, PairingBody, PairingEvent } from "./events";
import { addDays, observingNight, observingNightDateFor } from "./night";
import { EVENT_MIN_ALTITUDE_DEG, EVENT_SUN_MAX_ALTITUDE_DEG, PAIRING_MAX_SEPARATION_DEG } from "./parameters";
import { observerFor, sunAltitudeDeg } from "./sun";
import type { HorizontalPosition, Interval, Site } from "./types";

/**
 * Close pairings (M-3 S-07): the Moon with each of Mercury, Venus, Mars, Jupiter and Saturn, and the ten
 * pairs among those five planets, found by sampling each observing night and keeping the closest approach
 * the site can actually see. Pure: the site and the window are the only inputs.
 *
 * Everything is topocentric and of date (`Equator(body, t, observer, true, true)` for both bodies of a
 * pair, then `AngleBetween` of the two vectors, never J2000 mixed with of-date): the Moon's parallax moves
 * a Moon-planet separation by up to about 0.94° at 52° N, so the same pairing differs from site to site.
 *
 * A pairing's notable moment is its closest separation while both bodies are at or above
 * `EVENT_MIN_ALTITUDE_DEG` and the Sun is at or below `EVENT_SUN_MAX_ALTITUDE_DEG`, not the geometric
 * minimum. A pairing within the threshold whose every close moment fails that rule is still listed, as
 * not visible, at its geometric closest moment, with the reason `visibleAt` gives for it.
 */

/** The pairing bodies in the order a pair lists them: the Moon first, then the planets from the Sun out. */
export const PAIRING_BODIES = [
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
] as const satisfies readonly PairingBody[];

const BODY_OF: Readonly<Record<PairingBody, Body>> = {
  moon: Body.Moon,
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
};

/** Spacing of the night's samples for a pair that includes the Moon (about 0.55° of the Moon's own motion). */
const MOON_STEP_MINUTES = 60;
/** Planets move far slower against each other, so their pairs are sampled every third sample. */
const PLANET_STEP_MINUTES = 180;
/** Planet pairs use every third hourly sample. */
const PLANET_STRIDE = PLANET_STEP_MINUTES / MOON_STEP_MINUTES;
const MINUTE_MS = 60_000;
/** Coarse grid of the refinement scan, minutes; the fine scan then covers one coarse step each side at 1 minute. */
const COARSE_REFINE_MINUTES = 15;
/**
 * A sampled closest separation is refined only when it is within this many degrees of the threshold: a
 * pair moves less than this between two samples (the Moon about 0.6° an hour), so a sample further out
 * cannot refine to the threshold.
 */
const REFINE_MARGIN_DEG = 1;

/** One body at one instant: its of-date topocentric direction and its refracted horizontal position. */
interface Placed {
  vec: Vector;
  altitudeDeg: number;
  azimuthDeg: number;
}

function place(body: Body, time: AstroTime, observer: Observer): Placed {
  const eq = Equator(body, time, observer, true, true);
  const horizontal = Horizon(time, observer, eq.ra, eq.dec, "normal");
  return { vec: eq.vec, altitudeDeg: horizontal.altitude, azimuthDeg: horizontal.azimuth };
}

/** Topocentric apparent separation of two pairing bodies at `time`, degrees. */
export function pairSeparationDeg(site: Site, a: PairingBody, b: PairingBody, time: Date): number {
  const observer = observerFor(site);
  const t = MakeTime(time);
  return AngleBetween(
    Equator(BODY_OF[a], t, observer, true, true).vec,
    Equator(BODY_OF[b], t, observer, true, true).vec,
  );
}

/** A moment of a pair: when, how far apart, and the lower of the two bodies (what limits the view). */
interface Approach {
  time: Date;
  separationDeg: number;
  lower: HorizontalPosition;
}

function approachOf(time: Date, a: Placed, b: Placed): Approach {
  const lower = a.altitudeDeg <= b.altitudeDeg ? a : b;
  return {
    time,
    separationDeg: AngleBetween(a.vec, b.vec),
    lower: { time, altitudeDeg: lower.altitudeDeg, azimuthDeg: lower.azimuthDeg },
  };
}

/** The point `fraction` of the way from `a` to `b` (straight line), for directions that differ by a few degrees. */
function lerp(a: Vector, b: Vector, fraction: number): Vector {
  return new Vector(a.x + (b.x - a.x) * fraction, a.y + (b.y - a.y) * fraction, a.z + (b.z - a.z) * fraction, a.t);
}

function bothUp(a: Placed, b: Placed): boolean {
  return a.altitudeDeg >= EVENT_MIN_ALTITUDE_DEG && b.altitudeDeg >= EVENT_MIN_ALTITUDE_DEG;
}

/**
 * The closest approach of a pair within `centre ± halfSpanMinutes`, clipped to `night`: a scan on
 * `COARSE_REFINE_MINUTES`, then a scan of the best coarse step's neighbourhood to the minute. With
 * `visibleOnly` only the minutes where both bodies are up and the Sun is low enough count; `null` when
 * there are none.
 */
function refine(
  site: Site,
  observer: Observer,
  pair: readonly [Body, Body],
  centre: Date,
  halfSpanMinutes: number,
  night: Interval,
  visibleOnly: boolean,
): Approach | null {
  const at = (minutes: number): Approach | null => {
    const time = new Date(centre.getTime() + minutes * MINUTE_MS);
    if (time < night.start || time > night.end) {
      return null;
    }
    const t = MakeTime(time);
    const a = place(pair[0], t, observer);
    const b = place(pair[1], t, observer);
    if (visibleOnly && !(bothUp(a, b) && sunAltitudeDeg(site, time) <= EVENT_SUN_MAX_ALTITUDE_DEG)) {
      return null;
    }
    return approachOf(time, a, b);
  };
  const closest = (offsets: readonly number[]): { approach: Approach; offset: number } | null => {
    let best: { approach: Approach; offset: number } | null = null;
    for (const offset of offsets) {
      const approach = at(offset);
      if (approach !== null && (best === null || approach.separationDeg < best.approach.separationDeg)) {
        best = { approach, offset };
      }
    }
    return best;
  };
  const range = (from: number, to: number, step: number): number[] => {
    const out: number[] = [];
    for (let m = from; m <= to; m += step) {
      out.push(m);
    }
    return out;
  };
  const coarse = closest(range(-halfSpanMinutes, halfSpanMinutes, COARSE_REFINE_MINUTES));
  if (coarse === null) {
    return null;
  }
  const lo = Math.max(coarse.offset - COARSE_REFINE_MINUTES, -halfSpanMinutes);
  const hi = Math.min(coarse.offset + COARSE_REFINE_MINUTES, halfSpanMinutes);
  return closest(range(lo, hi, 1))?.approach ?? coarse.approach;
}

/** What one observing night holds for one pair that is within the threshold. */
interface NightApproach {
  /** Index of the night in the window. */
  index: number;
  /** The closest approach while visible, when it is within the threshold. */
  visible: Approach | null;
  /** The closest approach at any moment of the night, when it is within the threshold. */
  geometric: Approach | null;
}

/** The closer of two approaches (the first on a tie, so the earlier one wins). */
function closer(a: Approach, b: Approach | null): Approach {
  return b !== null && b.separationDeg < a.separationDeg ? b : a;
}

/**
 * Every close pairing of the observing nights in `window` (a whole number of nights, local noon to noon),
 * in time order. A pair within `maxSeparationDeg` (inclusive) on consecutive nights is one event, dated at
 * its closest night; one visible night makes the event visible, and then its moment is the closest visible
 * moment of the closest visible night. An event with no visible night is `visible: false`, its moment the
 * geometric closest moment of its closest night, with the reason `visibleAt` gives for that instant:
 * `daylight` (both bodies up but the Sun above the twilight bound), `below-horizon` (a body under 0°) or
 * `too-low`.
 *
 * A visible event's `altitudeDeg` and `azimuthDeg` are the lower of the two bodies', the one that limits
 * the view. Sampling is hourly when the Moon is in the pair and every three hours between planets, so a
 * night whose Sun stays below the twilight bound for under an hour (high latitudes near midsummer) can be
 * missed as visible and falls back to the not-visible case.
 */
export function pairingEvents(
  site: Site,
  window: Interval,
  maxSeparationDeg = PAIRING_MAX_SEPARATION_DEG,
): PairingEvent[] {
  const observer = observerFor(site);
  const pairs: { bodies: readonly [PairingBody, PairingBody]; astro: readonly [Body, Body]; stride: number }[] = [];
  PAIRING_BODIES.forEach((first, i) => {
    PAIRING_BODIES.slice(i + 1).forEach((second) => {
      pairs.push({
        bodies: [first, second],
        astro: [BODY_OF[first], BODY_OF[second]],
        stride: first === "moon" ? 1 : PLANET_STRIDE,
      });
    });
  });
  const history: NightApproach[][] = pairs.map(() => []);
  // The five planets' topocentric directions at an instant, remembered because a night's end is the next night's start.
  const boundaries = new Map<number, Vector[]>();
  const planetVectors = (time: Date): Vector[] => {
    let vectors = boundaries.get(time.getTime());
    if (vectors === undefined) {
      const t = MakeTime(time);
      vectors = PAIRING_BODIES.slice(1).map((body) => Equator(BODY_OF[body], t, observer, true, true).vec);
      boundaries.set(time.getTime(), vectors);
    }
    return vectors;
  };

  let date = observingNightDateFor(window.start, site.timeZone);
  for (let index = 0; ; index++, date = addDays(date, 1)) {
    const night = observingNight(date, site.timeZone);
    if (night.start >= window.end) {
      break;
    }
    const nightSpan: Interval = { start: night.start, end: night.end < window.end ? night.end : window.end };

    // Positions and Sun altitudes are computed on demand and shared by every pair, so a night in which
    // no pair comes close is answered from the coarse scan alone.
    const times: Date[] = [];
    for (let ms = night.start.getTime(); ms < nightSpan.end.getTime(); ms += MOON_STEP_MINUTES * MINUTE_MS) {
      times.push(new Date(ms));
    }
    const placedCache = PAIRING_BODIES.map(() => new Array<Placed | undefined>(times.length));
    const placedAt = (body: number, s: number): Placed => {
      const cached = placedCache[body][s];
      if (cached !== undefined) {
        return cached;
      }
      const placed = place(BODY_OF[PAIRING_BODIES[body]], MakeTime(times[s]), observer);
      placedCache[body][s] = placed;
      return placed;
    };
    const sunCache = new Array<boolean | undefined>(times.length);
    const sunLowAt = (s: number): boolean => {
      const cached = sunCache[s];
      if (cached !== undefined) {
        return cached;
      }
      const low = sunAltitudeDeg(site, times[s]) <= EVENT_SUN_MAX_ALTITUDE_DEG;
      sunCache[s] = low;
      return low;
    };
    const startVectors = planetVectors(nightSpan.start);
    const endVectors = planetVectors(nightSpan.end);
    const nightMs = nightSpan.end.getTime() - nightSpan.start.getTime();

    pairs.forEach((pair, p) => {
      const [ia, ib] = pair.bodies.map((body) => PAIRING_BODIES.indexOf(body));
      // Coarse scan: the planets barely move in a night, so a planet's direction at any instant is
      // interpolated between the night's two ends, and the Moon is placed every `PLANET_STEP_MINUTES`.
      let coarse = Number.POSITIVE_INFINITY;
      if (ia === 0) {
        for (let s = 0; s < times.length; s += PLANET_STRIDE) {
          const fraction = (times[s].getTime() - nightSpan.start.getTime()) / nightMs;
          coarse = Math.min(
            coarse,
            AngleBetween(placedAt(0, s).vec, lerp(startVectors[ib - 1], endVectors[ib - 1], fraction)),
          );
        }
      } else {
        coarse = Math.min(
          AngleBetween(startVectors[ia - 1], startVectors[ib - 1]),
          AngleBetween(endVectors[ia - 1], endVectors[ib - 1]),
        );
      }
      if (coarse > maxSeparationDeg + REFINE_MARGIN_DEG) {
        return;
      }

      let geometric: Approach | null = null;
      let visible: Approach | null = null;
      for (let s = 0; s < times.length; s += pair.stride) {
        const approach = approachOf(times[s], placedAt(ia, s), placedAt(ib, s));
        geometric = geometric === null ? approach : closer(geometric, approach);
        if (sunLowAt(s) && bothUp(placedAt(ia, s), placedAt(ib, s))) {
          visible = visible === null ? approach : closer(visible, approach);
        }
      }
      const halfSpan = pair.stride * MOON_STEP_MINUTES;
      const refinedVisible =
        visible !== null && visible.separationDeg <= maxSeparationDeg + REFINE_MARGIN_DEG
          ? refine(site, observer, pair.astro, visible.time, halfSpan, nightSpan, true)
          : null;
      const closeVisible =
        refinedVisible !== null && refinedVisible.separationDeg <= maxSeparationDeg ? refinedVisible : null;
      // A geometric minimum only matters to a night with no visible approach within the threshold.
      let closeGeometric: Approach | null = null;
      if (
        closeVisible === null &&
        geometric !== null &&
        geometric.separationDeg <= maxSeparationDeg + REFINE_MARGIN_DEG
      ) {
        const refined = refine(site, observer, pair.astro, geometric.time, halfSpan, nightSpan, false);
        closeGeometric = refined !== null && refined.separationDeg <= maxSeparationDeg ? refined : null;
      }
      if (closeVisible !== null || closeGeometric !== null) {
        history[p].push({ index, visible: closeVisible, geometric: closeGeometric });
      }
    });
  }

  const events: PairingEvent[] = [];
  pairs.forEach((pair, p) => {
    let cluster: NightApproach[] = [];
    const flush = () => {
      if (cluster.length > 0) {
        events.push(eventOf(site, pair.bodies, cluster));
        cluster = [];
      }
    };
    for (const night of history[p]) {
      if (cluster.length > 0 && night.index !== cluster[cluster.length - 1].index + 1) {
        flush();
      }
      cluster.push(night);
    }
    flush();
  });
  return events.sort((a, b) => a.moment.getTime() - b.moment.getTime());
}

/** One event from a run of consecutive close nights of a pair. */
function eventOf(
  site: Site,
  bodies: readonly [PairingBody, PairingBody],
  cluster: readonly NightApproach[],
): PairingEvent {
  let bestVisible: Approach | null = null;
  let bestGeometric: Approach | null = null;
  for (const night of cluster) {
    if (night.visible !== null) {
      bestVisible = bestVisible === null ? night.visible : closer(bestVisible, night.visible);
    }
    if (night.geometric !== null) {
      bestGeometric = bestGeometric === null ? night.geometric : closer(bestGeometric, night.geometric);
    }
  }
  const chosen = bestVisible ?? bestGeometric;
  if (chosen === null) {
    throw new Error("A pairing cluster has no approach");
  }
  const visibility: EventVisibility =
    bestVisible !== null
      ? {
          visible: true,
          best: bestVisible.time,
          altitudeDeg: bestVisible.lower.altitudeDeg,
          azimuthDeg: bestVisible.lower.azimuthDeg,
        }
      : notVisible(site, chosen);
  return {
    kind: "pairing",
    moment: chosen.time,
    night: observingNightDateFor(chosen.time, site.timeZone),
    visibility,
    bodies,
    separationDeg: chosen.separationDeg,
  };
}

/**
 * Why the pair cannot be seen at its geometric closest moment, by the same rule as every other kind
 * (`visibleAt`): the pair is one "body" whose altitude is the lower of its two, judged at that one instant.
 * `visibleAt` accepts the Sun up to 0.05° above the twilight bound where the sampling above is strict, so
 * a moment it calls visible is one where only that sliver of Sun altitude fails: `daylight`.
 */
function notVisible(site: Site, at: Approach): EventVisibility {
  const result = visibleAt(site, () => at.lower, { start: at.time, end: at.time });
  return result.visible ? { visible: false, reason: "daylight" } : result;
}
