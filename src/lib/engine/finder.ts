import { Rotation_EQJ_HOR } from "astronomy-engine";

import {
  FINDER_FIELD_DEG,
  FINDER_OVERHEAD_ALT_DEG,
  FINDER_PANEL_FIELD_DEG,
  HOP_MAX_STEPS,
  HOP_MAX_STEP_FRACTION,
  HOP_STAR_MAX_MAG,
  REFLEX_RING_DEG,
  START_STAR_CANDIDATES,
  finderLimitingMagForBortle,
  startStarMaxMagForBortle,
} from "./parameters";
import { observerFor } from "./sun";
import type { Site } from "./types";

/**
 * The finder chart's maths (M-3 S-03, finder-chart): from the target's direction and a star list, the starting star,
 * the hop to the target and the two projected panels. Pure and deterministic: every input is explicit, the engine
 * never reads the star file (the caller passes the stars), and identical inputs give identical, plain-data output.
 *
 * Geometry: every J2000 vector goes through one `Rotation_EQJ_HOR` at `time` (the `skyFrames` rotation) into the
 * horizon frame (x north, y west, z zenith), unrefracted. An unrefracted altitude is the lower one, so the minimum
 * altitude test errs on the safe side. Panels are gnomonic projections onto the tangent plane at each panel's centre,
 * in degrees (the plane's coordinates scaled by 180/π, so a small angle reads as itself).
 *
 * Lengths that decide a comparison (a step, a distance to the target) are compared as whole hundredths of a degree,
 * so a step of 5.6° is never lost to floating point, and the cost below is made of integers.
 */

/** A unit vector in the J2000 equatorial frame, as `src/lib/catalogue/stars.ts` has them. */
export type UnitVector = readonly [number, number, number];

/** One star as the chart needs it. `FinderStar` (`src/lib/catalogue/finder-stars.ts`) is assignable to it. */
export interface FinderStarInput {
  /** The star's identity in the caller's list; hops are reported by it and the cost's last tie-break compares it. */
  index: number;
  /** Visual magnitude. */
  mag: number;
  vector: UnitVector;
}

export interface FinderTarget {
  /** J2000 direction of the target (a catalogue object's coordinates, or `planetJ2000Vector`). */
  vector: UnitVector;
  /** Visual magnitude; `null` when the catalogue has none. Decides `naked-eye` for a planet. */
  magnitude: number | null;
  isPlanet: boolean;
  /** Carried for the page; the chart marks the target as a point, so the engine does not read it. */
  majorAxisArcmin: number | null;
}

export interface FinderChartInput {
  site: Site;
  /** The moment the chart is drawn for (the object's best time). */
  time: Date;
  bortle: number;
  /** The site's minimum altitude, degrees: no starting or hop star sits below it. */
  minAltitudeDeg: number;
  target: FinderTarget;
  stars: readonly FinderStarInput[];
  /** True field of the finding eyepiece, degrees, or `null` when there is none (no eyepiece circle). */
  eyepieceFieldDeg: number | null;
}

/**
 * - `hop`: from `start`, through `hops`, onto the target, every step within the finder's field.
 * - `direct`: none of the nearest qualifying stars has a hop; `start` is the nearest, `directionDeg` and
 *   `start.distanceDeg` give the way.
 * - `naked-eye`: a planet at least as bright as the starting limit, which is its own starting point.
 * - `no-start`: no star at or above the minimum altitude meets the starting limit.
 */
export type FinderKind = "hop" | "direct" | "naked-eye" | "no-start";

export interface FinderStart {
  index: number;
  mag: number;
  altDeg: number;
  azDeg: number;
  /** Great-circle distance to the target, degrees. */
  distanceDeg: number;
}

export interface FinderHop {
  index: number;
  /** Distance from the previous point (the start, or the previous hop star) to this star, degrees. */
  stepDeg: number;
}

export interface PanelPoint {
  x: number;
  y: number;
}

export interface PanelStar extends PanelPoint {
  index: number;
  mag: number;
}

export interface PanelCircle {
  kind: "finder" | "reflex" | "eyepiece";
  /** Radius on the tangent plane, degrees (`tan` of the angular radius, so the circle is exact). */
  r: number;
}

/**
 * Where the zenith lies when it is outside an overhead panel: the point of the panel's edge in its direction, and that
 * direction, so the chart can draw an arrow there (F2).
 */
export interface PanelZenithEdge extends PanelPoint {
  /** Direction from the panel's centre to the zenith, degrees clockwise from up (y down, as a bearing on the panel), 0 to under 360. */
  angleDeg: number;
}

/** One square panel: stars, path, target, zenith marker and circles, in degrees on the tangent plane (x right, y down as in an SVG, so a higher star has the smaller y). */
export interface FinderPanel {
  /** Width and height of the square, degrees on the tangent plane. */
  fieldDeg: number;
  stars: PanelStar[];
  /** The route drawn on this panel: overview, every point from the start to the target; finder, the last step. */
  path: PanelPoint[];
  target: PanelPoint;
  /** The zenith, when the chart is north up and the zenith lies inside this panel. */
  zenith: PanelPoint | null;
  /**
   * The chart is overhead and the zenith lies outside this panel: the point of the panel's edge (a square of `fieldDeg`,
   * the ray from the centre toward the zenith meets it there) and the direction. Never set together with `zenith`;
   * `null` when facing.
   */
  zenithEdge: PanelZenithEdge | null;
  circles: PanelCircle[];
}

export interface FinderChartData {
  kind: FinderKind;
  /** `facing`: up is the vertical through each panel's centre. `overhead`: the visible celestial pole up in both panels (D-6). */
  orientation: "facing" | "overhead";
  /**
   * Which celestial pole is at the top of both panels when `orientation` is `overhead`: `north` for a site at or north
   * of the equator, `south` for a southern one; `null` when facing.
   */
  poleUp: "north" | "south" | null;
  /** Where the target is, unrefracted (the page shows the ranking's refracted `bestDirection`). */
  facing: { azDeg: number; altDeg: number };
  start: FinderStart | null;
  hops: FinderHop[];
  /** Distance from the last point of a `hop` route to the target, degrees; `null` for every other kind. */
  finalStepDeg: number | null;
  /** `direct` only: the way from the start to the target on the overview, degrees clockwise from up. */
  directionDeg: number | null;
  /** From the start to the target; `null` when there is no start (`naked-eye`, `no-start`). */
  overview: FinderPanel | null;
  /** `FINDER_PANEL_FIELD_DEG` wide around the target. */
  finder: FinderPanel;
}

type Vec = readonly [number, number, number];

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
const ZENITH: Vec = [0, 0, 1];
/** Float guard on the overhead rule: a centre built at exactly 80° must count as 80°. */
const ALTITUDE_EPSILON_DEG = 1e-9;
/** Beyond this angle from a panel's centre a point is not drawn (the tangent plane runs off to infinity at 90°). */
const MAX_PANEL_ANGLE_DEG = 85;
/** The overview's field is this much wider than the route needs. */
const OVERVIEW_MARGIN = 1.25;

const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec): number => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec): Vec => {
  const n = norm(a);
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** Angle between two unit vectors, degrees (`atan2` of the cross and dot products: exact for small angles). */
const angleDeg = (a: Vec, b: Vec): number => Math.atan2(norm(cross(a, b)), dot(a, b)) * DEG;

/** Whole hundredths of a degree, the unit every comparison and every cost term is in. */
const centi = (deg: number): number => Math.round(deg * 100);

/** Rounds to `step` and turns -0 into 0, so plain data compares deep-equal. */
const roundTo = (value: number, step: number): number => {
  // Divide by the reciprocal (10 for 0.1), not multiply by the step: `0.1 * 222` is 22.200000000000003.
  const perUnit = Math.round(1 / step);
  return Math.round(value * perUnit) / perUnit + 0;
};
const round3 = (value: number): number => Math.round(value * 1000) / 1000 + 0;
const round2 = (value: number): number => Math.round(value * 100) / 100 + 0;

const altitudeDegOf = (h: Vec): number => Math.asin(Math.max(-1, Math.min(1, h[2]))) * DEG;
const azimuthDegOf = (h: Vec): number => {
  const az = Math.atan2(-h[1], h[0]) * DEG;
  return az < 0 ? az + 360 : az;
};

/** The horizon-frame vector of a J2000 unit vector under `Rotation_EQJ_HOR`'s matrix (`sky-frames.ts` spells the formula). */
function toHorizon(rot: readonly (readonly number[])[], v: UnitVector): Vec {
  return [
    rot[0][0] * v[0] + rot[1][0] * v[1] + rot[2][0] * v[2],
    rot[0][1] * v[0] + rot[1][1] * v[1] + rot[2][1] * v[2],
    rot[0][2] * v[0] + rot[1][2] * v[1] + rot[2][2] * v[2],
  ];
}

interface Basis {
  centre: Vec;
  up: Vec;
  right: Vec;
}

/**
 * The panel's axes at `centre`: `up` is the given direction made perpendicular to the centre, `right` is
 * centre × up (looking out along the centre, right-hand side). When `up` is parallel to the centre it is undefined,
 * and the axis least aligned with the centre stands in, so the result is always finite.
 */
function basisOf(centre: Vec, up: Vec): Basis {
  const c = unit(centre);
  let u: Vec = [up[0] - dot(up, c) * c[0], up[1] - dot(up, c) * c[1], up[2] - dot(up, c) * c[2]];
  if (norm(u) < 1e-9) {
    const axes: Vec[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const least = axes.reduce((best, axis) => (Math.abs(dot(axis, c)) < Math.abs(dot(best, c)) ? axis : best));
    u = [least[0] - dot(least, c) * c[0], least[1] - dot(least, c) * c[1], least[2] - dot(least, c) * c[2]];
  }
  const upUnit = unit(u);
  return { centre: c, up: upUnit, right: cross(c, upUnit) };
}

function projectWith(basis: Basis, point: Vec): PanelPoint | null {
  const along = dot(point, basis.centre);
  if (along <= Math.cos(MAX_PANEL_ANGLE_DEG * RAD) * norm(point)) {
    return null;
  }
  return { x: (dot(point, basis.right) / along) * DEG, y: (-dot(point, basis.up) / along) * DEG };
}

/**
 * Gnomonic projection of `point` onto the tangent plane at `centre`, in degrees (x right, y down, as an SVG), `up` being the
 * direction that points up on the panel: the local vertical for a facing panel, the way to the visible celestial pole
 * for the overhead one. `null` when `point` is 85° or more from `centre`. Pure: unit or non-unit inputs, the same
 * frame for all three.
 */
export function projectGnomonic(centre: UnitVector, point: UnitVector, up: UnitVector): PanelPoint | null {
  return projectWith(basisOf(centre, up), point);
}

interface HorizonStar {
  index: number;
  mag: number;
  magTenths: number;
  h: Vec;
  altDeg: number;
}

/** A static 3-D grid over the hop stars, so the neighbours of a star are found without comparing all pairs. */
class StarGrid {
  private readonly cells = new Map<number, number[]>();
  /** At least the chord of the longest step, so every neighbour is in an adjacent cell; at least 0.1 keeps the keys unique. */
  private readonly cell: number;

  private static key(ix: number, iy: number, iz: number): number {
    return (ix + 12) * 576 + (iy + 12) * 24 + (iz + 12);
  }

  constructor(
    private readonly stars: readonly HorizonStar[],
    maxStepCenti: number,
  ) {
    this.cell = Math.max(0.1, 2 * Math.sin(((maxStepCenti + 1) / 100) * 0.5 * RAD));
    stars.forEach((star, id) => {
      const key = StarGrid.key(
        Math.floor(star.h[0] / this.cell),
        Math.floor(star.h[1] / this.cell),
        Math.floor(star.h[2] / this.cell),
      );
      const cell = this.cells.get(key);
      if (cell === undefined) {
        this.cells.set(key, [id]);
      } else {
        cell.push(id);
      }
    });
  }

  /** Ids of the stars within `maxCenti` hundredths of a degree of `h` (at most the `maxStepCenti` the grid was built for). */
  near(h: Vec, maxCenti: number): { id: number; stepCenti: number }[] {
    const ix = Math.floor(h[0] / this.cell);
    const iy = Math.floor(h[1] / this.cell);
    const iz = Math.floor(h[2] / this.cell);
    const out: { id: number; stepCenti: number }[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (const id of this.cells.get(StarGrid.key(ix + dx, iy + dy, iz + dz)) ?? []) {
            const stepCenti = centi(angleDeg(h, this.stars[id].h));
            if (stepCenti <= maxCenti) {
              out.push({ id, stepCenti });
            }
          }
        }
      }
    }
    return out;
  }
}

/** The cost of a route so far: the sum of the intermediate stars' magnitudes in tenths, the sum of the steps in hundredths, and the stars' indices in order. */
interface PathCost {
  mag: number;
  len: number;
  seq: number[];
  /** The same stars as ids into the hop list. */
  ids: number[];
}

/** Lexicographic: lower magnitude sum, then lower length sum, then the smaller index sequence element by element. */
function cheaper(a: PathCost, b: PathCost): boolean {
  if (a.mag !== b.mag) {
    return a.mag < b.mag;
  }
  if (a.len !== b.len) {
    return a.len < b.len;
  }
  for (let i = 0; i < a.seq.length && i < b.seq.length; i++) {
    if (a.seq[i] !== b.seq[i]) {
      return a.seq[i] < b.seq[i];
    }
  }
  return false;
}

interface HopRoute {
  /** Hop stars as ids into the hop list, in order; empty when the start is within one step of the target. */
  ids: number[];
  stepsCenti: number[];
  finalStepCenti: number;
}

/**
 * The exact cheapest route from `start` to the target (D-4). Layered: for k = 1 … `HOP_MAX_STEPS` the cheapest route
 * of exactly k steps is solved by dynamic programming (the cost is additive, so the best prefix to a star is the best
 * prefix of the best route through it), and the first k with a route wins. Stars qualify as hop stars when they are
 * in `hopStars` and no farther from the target than the start plus one step (the candidate bound).
 */
function findRoute(
  start: HorizonStar,
  startDistanceCenti: number,
  hopStars: readonly HorizonStar[],
  grid: StarGrid,
  targetCenti: readonly number[],
  stepMaxCenti: number,
): HopRoute | null {
  if (startDistanceCenti <= stepMaxCenti) {
    return { ids: [], stepsCenti: [], finalStepCenti: startDistanceCenti };
  }
  const bound = startDistanceCenti + stepMaxCenti;
  const admissible = (id: number): boolean => hopStars[id].index !== start.index && targetCenti[id] <= bound;

  let frontier = new Map<number, PathCost>();
  for (const { id, stepCenti } of grid.near(start.h, stepMaxCenti)) {
    if (admissible(id)) {
      frontier.set(id, { mag: hopStars[id].magTenths, len: stepCenti, seq: [hopStars[id].index], ids: [id] });
    }
  }
  for (let k = 2; k <= HOP_MAX_STEPS; k++) {
    let best: { id: number; cost: PathCost } | null = null;
    for (const [id, cost] of frontier) {
      if (targetCenti[id] > stepMaxCenti) {
        continue;
      }
      const total: PathCost = { ...cost, len: cost.len + targetCenti[id] };
      if (best === null || cheaper(total, best.cost)) {
        best = { id, cost: total };
      }
    }
    if (best !== null) {
      return routeOf(best.id, best.cost.ids, hopStars, start, targetCenti);
    }
    if (k === HOP_MAX_STEPS) {
      break;
    }
    const next = new Map<number, PathCost>();
    for (const [id, cost] of frontier) {
      for (const { id: to, stepCenti } of grid.near(hopStars[id].h, stepMaxCenti)) {
        if (!admissible(to)) {
          continue;
        }
        const candidate: PathCost = {
          mag: cost.mag + hopStars[to].magTenths,
          len: cost.len + stepCenti,
          seq: [...cost.seq, hopStars[to].index],
          ids: [...cost.ids, to],
        };
        const existing = next.get(to);
        if (existing === undefined || cheaper(candidate, existing)) {
          next.set(to, candidate);
        }
      }
    }
    frontier = next;
    if (frontier.size === 0) {
      break;
    }
  }
  return null;
}

/** The route's step lengths from its star ids. */
function routeOf(
  lastId: number,
  ids: readonly number[],
  hopStars: readonly HorizonStar[],
  start: HorizonStar,
  targetCenti: readonly number[],
): HopRoute {
  const stepsCenti = ids.map((id, i) => {
    const from = i === 0 ? start.h : hopStars[ids[i - 1]].h;
    return centi(angleDeg(from, hopStars[id].h));
  });
  return { ids: [...ids], stepsCenti, finalStepCenti: targetCenti[lastId] };
}

/** Whether the zenith lies inside a facing panel (x = 0 on the vertical, so only y matters). */
function zenithInsideFacing(centre: Vec, fieldDeg: number): boolean {
  const zenithAngle = angleDeg(centre, ZENITH);
  return zenithAngle < MAX_PANEL_ANGLE_DEG && Math.tan(zenithAngle * RAD) * DEG <= fieldDeg / 2;
}

/**
 * Where the great circle from a panel's centre to `point` leaves the square of half-side `half`. The direction is the
 * point's components along the panel's axes, which is what the projection shows while the point is within 85° of the
 * centre and the great-circle bearing beyond it, where the projection gives up. A point on the centre (no direction)
 * reads as up.
 */
function edgeToward(basis: Basis, point: Vec, half: number): PanelZenithEdge {
  const dx = dot(point, basis.right);
  const dy = -dot(point, basis.up);
  const length = Math.hypot(dx, dy);
  const ux = length < 1e-12 ? 0 : dx / length;
  const uy = length < 1e-12 ? -1 : dy / length;
  const reach = half / Math.max(Math.abs(ux), Math.abs(uy));
  const bearing = Math.atan2(ux, -uy) * DEG;
  return {
    x: round3(ux * reach),
    y: round3(uy * reach),
    angleDeg: roundTo(bearing < 0 ? bearing + 360 : bearing, 0.1) % 360,
  };
}

interface PanelRequest {
  centre: Vec;
  up: Vec;
  fieldDeg: number;
  maxMag: number;
  path: readonly Vec[];
  target: Vec;
  showZenith: boolean;
  circleDiametersDeg: readonly { kind: PanelCircle["kind"]; diameterDeg: number }[];
}

function buildPanel(request: PanelRequest, stars: readonly HorizonStar[]): FinderPanel {
  const basis = basisOf(request.centre, request.up);
  const half = request.fieldDeg / 2;
  const inside: PanelStar[] = [];
  for (const star of stars) {
    if (star.altDeg < 0 || star.mag > request.maxMag) {
      continue;
    }
    const p = projectWith(basis, star.h);
    if (p !== null && Math.abs(p.x) <= half && Math.abs(p.y) <= half) {
      inside.push({ index: star.index, x: round3(p.x), y: round3(p.y), mag: star.mag });
    }
  }
  const rounded = (v: Vec): PanelPoint => {
    const p = projectWith(basis, v) ?? { x: 0, y: 0 };
    return { x: round3(p.x), y: round3(p.y) };
  };
  let zenith: PanelPoint | null = null;
  let zenithEdge: PanelZenithEdge | null = null;
  if (request.showZenith) {
    const p = projectWith(basis, ZENITH);
    if (p !== null && Math.abs(p.x) <= half && Math.abs(p.y) <= half) {
      zenith = { x: round3(p.x), y: round3(p.y) };
    } else {
      zenithEdge = edgeToward(basis, ZENITH, half);
    }
  }
  return {
    fieldDeg: roundTo(request.fieldDeg, 0.1),
    stars: inside,
    path: request.path.map(rounded),
    target: rounded(request.target),
    zenith,
    zenithEdge,
    circles: request.circleDiametersDeg.map(({ kind, diameterDeg }) => ({
      kind,
      r: round3(Math.tan((diameterDeg / 2) * RAD) * DEG),
    })),
  };
}

/**
 * The finder chart for one target at one moment (FR-037): the starting star, the hop and the two panels.
 *
 * The start is the nearest qualifying star (at or above `minAltitudeDeg`, at most `startStarMaxMagForBortle`
 * bright; distance to the target, ties by magnitude then index) that has a hop, among the `START_STAR_CANDIDATES`
 * nearest; the hop minimises, lexicographically, (steps, Σ magnitude × 10 of the intermediate stars, Σ step lengths
 * × 100, then the index sequence) over stars at or above the minimum altitude and no fainter than `HOP_STAR_MAX_MAG`,
 * each step at most `HOP_MAX_STEP_FRACTION` of the finder's field, at most `HOP_MAX_STEPS` steps.
 *
 * Panels are oriented as the user faces that part of the sky (up = the vertical through the panel's centre). When a
 * panel's centre is at or above `FINDER_OVERHEAD_ALT_DEG`, or the zenith falls inside a panel (judged in the facing
 * orientation), both panels go north up, toward the visible celestial pole, with a zenith marker (a panel that does not
 * contain the zenith gets `zenithEdge`, the point of its edge toward the zenith). Positions are
 * rounded to 0.001° and lengths to 0.01°.
 */
export function finderChart(input: FinderChartInput): FinderChartData {
  const { rot } = Rotation_EQJ_HOR(input.time, observerFor(input.site));
  const startLimitTenths = Math.round(startStarMaxMagForBortle(input.bortle) * 10);
  const hopLimitTenths = Math.round(HOP_STAR_MAX_MAG * 10);
  const finderLimitMag = finderLimitingMagForBortle(input.bortle);
  const maxStarMag = Math.max(HOP_STAR_MAX_MAG, finderLimitMag);
  const stepMaxCenti = centi(FINDER_FIELD_DEG * HOP_MAX_STEP_FRACTION);

  const horizonStars: HorizonStar[] = [];
  for (const star of input.stars) {
    if (star.mag > maxStarMag) {
      continue;
    }
    const h = toHorizon(rot, star.vector);
    horizonStars.push({
      index: star.index,
      mag: star.mag,
      magTenths: Math.round(star.mag * 10),
      h,
      altDeg: altitudeDegOf(h),
    });
  }

  const targetH = unit(toHorizon(rot, input.target.vector));
  const targetAltDeg = altitudeDegOf(targetH);
  const facing = { azDeg: round2(azimuthDegOf(targetH)), altDeg: round2(targetAltDeg) };

  const eligible = (star: HorizonStar): boolean => star.altDeg >= input.minAltitudeDeg;
  const hopStars = horizonStars.filter((star) => star.magTenths <= hopLimitTenths && eligible(star));
  const nakedEye =
    input.target.isPlanet &&
    input.target.magnitude !== null &&
    Math.round(input.target.magnitude * 10) <= startLimitTenths;

  // The start, and the hop from it.
  let kind: FinderKind = "no-start";
  let start: HorizonStar | null = null;
  let route: HopRoute | null = null;
  const targetCenti = hopStars.map((star) => centi(angleDeg(star.h, targetH)));
  if (nakedEye) {
    kind = "naked-eye";
  } else {
    const candidates = horizonStars
      .filter((star) => star.magTenths <= startLimitTenths && eligible(star))
      .map((star) => ({ star, distanceCenti: centi(angleDeg(star.h, targetH)) }))
      .sort(
        (a, b) =>
          a.distanceCenti - b.distanceCenti || a.star.magTenths - b.star.magTenths || a.star.index - b.star.index,
      )
      .slice(0, START_STAR_CANDIDATES);
    if (candidates.length > 0) {
      const grid = new StarGrid(hopStars, stepMaxCenti);
      for (const { star, distanceCenti } of candidates) {
        route = findRoute(star, distanceCenti, hopStars, grid, targetCenti, stepMaxCenti);
        if (route !== null) {
          kind = "hop";
          start = star;
          break;
        }
      }
      if (route === null) {
        kind = "direct";
        start = candidates[0].star;
      }
    }
  }

  const hopIds = route?.ids ?? [];
  const pathVectors: Vec[] = start === null ? [] : [start.h, ...hopIds.map((id) => hopStars[id].h), targetH];

  // The overview's centre and field: the route's mean direction, wide enough for every point and a margin.
  let overviewCentre: Vec | null = null;
  let overviewField = FINDER_PANEL_FIELD_DEG;
  if (pathVectors.length > 0) {
    const centre = unit(pathVectors.reduce<Vec>((sum, v) => [sum[0] + v[0], sum[1] + v[1], sum[2] + v[2]], [0, 0, 0]));
    const reach = Math.max(
      ...pathVectors.map((v) => Math.tan(Math.min(angleDeg(centre, v), MAX_PANEL_ANGLE_DEG) * RAD) * DEG),
    );
    overviewCentre = centre;
    overviewField = Math.max(FINDER_PANEL_FIELD_DEG, Math.ceil(2 * reach * OVERVIEW_MARGIN * 10) / 10);
  }

  // Orientation (D-6), decided once for both panels.
  const centres: { centre: Vec; fieldDeg: number }[] = [{ centre: targetH, fieldDeg: FINDER_PANEL_FIELD_DEG }];
  if (overviewCentre !== null) {
    centres.push({ centre: overviewCentre, fieldDeg: overviewField });
  }
  const overhead = centres.some(
    ({ centre, fieldDeg }) =>
      altitudeDegOf(centre) >= FINDER_OVERHEAD_ALT_DEG - ALTITUDE_EPSILON_DEG || zenithInsideFacing(centre, fieldDeg),
  );
  const poleUp: Vec = toHorizon(rot, [0, 0, input.site.latitudeDeg < 0 ? -1 : 1]);
  const upFor = (): Vec => (overhead ? poleUp : ZENITH);

  const circles: PanelRequest["circleDiametersDeg"] = [
    { kind: "finder", diameterDeg: FINDER_FIELD_DEG },
    ...REFLEX_RING_DEG.map((diameterDeg) => ({ kind: "reflex" as const, diameterDeg })),
    ...(input.eyepieceFieldDeg === null ? [] : [{ kind: "eyepiece" as const, diameterDeg: input.eyepieceFieldDeg }]),
  ];

  const lastPoint = pathVectors.length >= 2 ? pathVectors[pathVectors.length - 2] : null;
  const finder = buildPanel(
    {
      centre: targetH,
      up: upFor(),
      fieldDeg: FINDER_PANEL_FIELD_DEG,
      maxMag: finderLimitMag,
      path: kind === "hop" && lastPoint !== null ? [lastPoint, targetH] : [],
      target: targetH,
      showZenith: overhead,
      circleDiametersDeg: circles,
    },
    horizonStars,
  );
  const overview =
    overviewCentre === null
      ? null
      : buildPanel(
          {
            centre: overviewCentre,
            up: upFor(),
            fieldDeg: overviewField,
            maxMag: HOP_STAR_MAX_MAG,
            path: pathVectors,
            target: targetH,
            showZenith: overhead,
            circleDiametersDeg: [],
          },
          horizonStars,
        );

  let directionDeg: number | null = null;
  if (kind === "direct" && overview !== null && overview.path.length === 2) {
    const [from, to] = overview.path;
    const bearing = Math.atan2(to.x - from.x, from.y - to.y) * DEG;
    directionDeg = roundTo(bearing < 0 ? bearing + 360 : bearing, 0.1);
  }

  return {
    kind,
    orientation: overhead ? "overhead" : "facing",
    poleUp: overhead ? (input.site.latitudeDeg < 0 ? "south" : "north") : null,
    facing,
    start:
      start === null
        ? null
        : {
            index: start.index,
            mag: start.mag,
            altDeg: round2(start.altDeg),
            azDeg: round2(azimuthDegOf(start.h)),
            distanceDeg: round2(angleDeg(start.h, targetH)),
          },
    hops:
      route === null
        ? []
        : route.ids.map((id, i) => ({ index: hopStars[id].index, stepDeg: route.stepsCenti[i] / 100 })),
    finalStepDeg: route === null ? null : route.finalStepCenti / 100,
    directionDeg,
    overview,
    finder,
  };
}
