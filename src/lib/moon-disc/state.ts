import type { MoonPhaseBand } from "@/lib/engine/parameters";

/**
 * The Moon's appearance at one instant, as plain serialisable data (moonlight-and-the-verdict). The engine computes
 * it on the server (`moonDiscState` in `src/lib/engine/moon-disc.ts`); `moonDiscPaths` draws it, on the server or in
 * a browser island. This module owns the type so the browser side never imports the engine: the engine imports it,
 * never the reverse.
 */
export interface MoonDiscState {
  /** The instant, ISO 8601 in UTC. */
  time: string;
  /** Geocentric illuminated fraction of the disc, [0, 1], rounded to 0.01. */
  illuminatedFraction: number;
  /** True while the Sun–Moon elongation is below 180° (new → full). */
  waxing: boolean;
  band: MoonPhaseBand;
  /**
   * Direction of the bright limb's midpoint, degrees, [0, 360): the position angle of the bright limb less the
   * position angle of the Moon's north pole (θ = χ − P), so it is measured from lunar north towards celestial east.
   * With lunar north up, 90° points left (east in the sky) and 270° right.
   */
  brightLimbAngleDeg: number;
  /** Optical libration in latitude, degrees: the selenographic latitude of the sub-Earth point. */
  librationLatDeg: number;
  /** Optical libration in longitude, degrees: the selenographic longitude of the sub-Earth point, east positive. */
  librationLonDeg: number;
}

/**
 * The index of the state nearest `nowMs` (epoch ms; the earlier on a tie): the first before the window, the last after
 * it, 0 for no states. The server uses it for the page-load moment and the Moon card's "Now" button for the moment of
 * the click, so both pick the same state for the same instant.
 */
export function nearestStateIndex(states: readonly Pick<MoonDiscState, "time">[], nowMs: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  states.forEach((state, i) => {
    const distance = Math.abs(Date.parse(state.time) - nowMs);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}
