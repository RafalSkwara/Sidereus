import { MARIA } from "./maria";
import type { MareShape } from "./maria";
import type { MoonDiscState } from "./state";

/**
 * The Moon disc's drawing maths (moonlight-and-the-verdict): pure and browser-safe, with no astronomy-engine or engine
 * import, so the Moon card's time slider can redraw a state in the browser.
 *
 * Every path is on the unit disc centred on the origin, in SVG coordinates (x right, y down) and map orientation:
 * lunar north up, IAU lunar east (the Mare Crisium side) right. A renderer scales it with a `viewBox` such as
 * `-1 -1 2 2`.
 */

/** A point on the unit disc, SVG coordinates. */
export interface DiscPoint {
  x: number;
  y: number;
}

/** A selenographic point projected onto the disc. */
export interface ProjectedPoint extends DiscPoint {
  /** False when the point is on the far side; it is then pushed onto the limb. */
  visible: boolean;
}

export interface MoonDiscPaths {
  /** The lit part of the disc: `null` when nothing is lit, the whole disc when fully lit. */
  litPath: string | null;
  /** One closed outline per entry of `MARIA`, in that order, not clipped to the lit part. */
  mariaPaths: string[];
}

const DEG = Math.PI / 180;

/** Points along each half of the lit outline (the bright limb and the terminator); 48 keeps both smooth. */
const HALF_OUTLINE_SEGMENTS = 48;

/** Points around each mare outline. */
const MARE_OUTLINE_POINTS = 24;

/** Decimal places of every number in a path. */
const PATH_DECIMALS = 4;

/** A path number with `PATH_DECIMALS` places, never "-0.0000". */
function formatNumber(n: number): string {
  const text = n.toFixed(PATH_DECIMALS);
  return Number(text) === 0 ? (0).toFixed(PATH_DECIMALS) : text;
}

/** A closed SVG path through `points`. */
function closedPath(points: readonly DiscPoint[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${formatNumber(p.x)} ${formatNumber(p.y)}`).join(" ") + " Z";
}

/**
 * The bright limb's unit direction and its perpendicular, SVG coordinates. With θ measured from lunar north (up)
 * towards celestial east (left), the bright limb points to (−sin θ, −cos θ).
 */
function brightFrame(brightLimbAngleDeg: number): { bright: DiscPoint; across: DiscPoint } {
  const theta = brightLimbAngleDeg * DEG;
  return {
    bright: { x: -Math.sin(theta), y: -Math.cos(theta) },
    across: { x: Math.cos(theta), y: -Math.sin(theta) },
  };
}

/**
 * Where the terminator crosses the line `v` from the centre across the bright direction, as a coordinate `u` along
 * the bright direction: the terminator is the half-ellipse u = (1 − 2k)·√(1 − v²), bulging towards the bright limb
 * for a crescent (k < 0.5) and away from it for a gibbous Moon. A point is lit iff its `u` is beyond this.
 */
function terminatorU(illuminatedFraction: number, v: number): number {
  return (1 - 2 * illuminatedFraction) * Math.sqrt(Math.max(0, 1 - v * v));
}

/**
 * Whether a disc point is on the lit part of a state's disc: the point's offset along the bright-limb direction is
 * beyond the terminator (`u > −cos i · √(1 − v²)`, with k = (1 + cos i) / 2).
 */
export function isLit(state: Pick<MoonDiscState, "illuminatedFraction" | "brightLimbAngleDeg">, p: DiscPoint): boolean {
  return litMargin(state, p) > 0;
}

/**
 * How far a disc point lies beyond the terminator along the bright-limb direction, in disc radii: positive when lit,
 * negative when dark.
 */
export function litMargin(
  state: Pick<MoonDiscState, "illuminatedFraction" | "brightLimbAngleDeg">,
  p: DiscPoint,
): number {
  const { bright, across } = brightFrame(state.brightLimbAngleDeg);
  const u = p.x * bright.x + p.y * bright.y;
  const v = p.x * across.x + p.y * across.y;
  return u - terminatorU(state.illuminatedFraction, v);
}

/**
 * The lit part's outline: the bright half of the limb, then the terminator back. Built in the bright-limb frame
 * (u along the bright direction, v across it) and rotated into place. At k = 1 the terminator is the other half of
 * the limb, so the outline is the whole disc; at k = 0.5 it is the straight diameter across the bright direction.
 */
function litOutline(illuminatedFraction: number, brightLimbAngleDeg: number): DiscPoint[] {
  const { bright, across } = brightFrame(brightLimbAngleDeg);
  const toDisc = (u: number, v: number): DiscPoint => ({
    x: u * bright.x + v * across.x,
    y: u * bright.y + v * across.y,
  });
  const points: DiscPoint[] = [];
  for (let i = 0; i <= HALF_OUTLINE_SEGMENTS; i++) {
    const t = (i / HALF_OUTLINE_SEGMENTS) * Math.PI;
    points.push(toDisc(Math.sin(t), Math.cos(t)));
  }
  for (let i = HALF_OUTLINE_SEGMENTS - 1; i >= 1; i--) {
    const t = (i / HALF_OUTLINE_SEGMENTS) * Math.PI;
    const v = Math.cos(t);
    points.push(toDisc(terminatorU(illuminatedFraction, v), v));
  }
  return points;
}

/**
 * A selenographic point (latitude north positive, longitude IAU east positive, degrees) projected orthographically
 * onto the disc as seen from the Earth, for libration (`librationLatDeg` b, `librationLonDeg` l):
 * x = cos φ·sin(λ − l), y_up = sin φ·cos b − cos φ·sin b·cos(λ − l), and z towards the viewer
 * = cos φ·cos b·cos(λ − l) + sin φ·sin b. SVG y is −y_up. A far-side point (z < 0) is pushed out onto the limb.
 */
export function projectSelenographic(
  latDeg: number,
  lonDeg: number,
  librationLatDeg: number,
  librationLonDeg: number,
): ProjectedPoint {
  const phi = latDeg * DEG;
  const dLon = (lonDeg - librationLonDeg) * DEG;
  const b = librationLatDeg * DEG;
  const x = Math.cos(phi) * Math.sin(dLon);
  const yUp = Math.sin(phi) * Math.cos(b) - Math.cos(phi) * Math.sin(b) * Math.cos(dLon);
  const z = Math.cos(phi) * Math.cos(b) * Math.cos(dLon) + Math.sin(phi) * Math.sin(b);
  if (z >= 0) {
    return { x, y: -yUp, visible: true };
  }
  const r = Math.hypot(x, yUp);
  return r === 0 ? { x, y: -yUp, visible: false } : { x: x / r, y: -yUp / r, visible: false };
}

/**
 * A point at angular offsets `eastDeg` and `northDeg` (degrees of arc) from the selenographic point (`latDeg`,
 * `lonDeg`), along the great circle in that direction: the spherical "destination point".
 */
function offsetPoint(latDeg: number, lonDeg: number, eastDeg: number, northDeg: number): { lat: number; lon: number } {
  const phi0 = latDeg * DEG;
  const distance = Math.hypot(eastDeg, northDeg) * DEG;
  const bearing = Math.atan2(eastDeg, northDeg);
  const sinPhi = Math.sin(phi0) * Math.cos(distance) + Math.cos(phi0) * Math.sin(distance) * Math.cos(bearing);
  const phi = Math.asin(Math.max(-1, Math.min(1, sinPhi)));
  const dLon = Math.atan2(
    Math.sin(bearing) * Math.sin(distance) * Math.cos(phi0),
    Math.cos(distance) - Math.sin(phi0) * sinPhi,
  );
  return { lat: phi / DEG, lon: lonDeg + dLon / DEG };
}

/** A mare's outline on the disc: `MARE_OUTLINE_POINTS` points around its ellipse on the sphere, projected. */
function mareOutline(mare: MareShape, librationLatDeg: number, librationLonDeg: number): DiscPoint[] {
  const points: DiscPoint[] = [];
  for (let i = 0; i < MARE_OUTLINE_POINTS; i++) {
    const a = (i / MARE_OUTLINE_POINTS) * 2 * Math.PI;
    const { lat, lon } = offsetPoint(
      mare.latDeg,
      mare.lonDeg,
      mare.eastRadiusDeg * Math.sin(a),
      mare.northRadiusDeg * Math.cos(a),
    );
    const { x, y } = projectSelenographic(lat, lon, librationLatDeg, librationLonDeg);
    points.push({ x, y });
  }
  return points;
}

/**
 * The SVG paths for one Moon-disc state: the lit part and the maria, on the unit disc in map orientation (see the
 * module comment), every number with four decimals.
 *
 * `litPath` is `null` when the rounded illuminated fraction is 0 and the whole disc when it is 1. The maria are
 * returned whole, not intersected with the lit part: the renderer clips them to it by using `litPath` as an SVG
 * `<clipPath>` (with an id unique per page), which keeps this module free of polygon clipping.
 */
export function moonDiscPaths(state: MoonDiscState): MoonDiscPaths {
  const litPath =
    state.illuminatedFraction <= 0
      ? null
      : closedPath(litOutline(Math.min(1, state.illuminatedFraction), state.brightLimbAngleDeg));
  const mariaPaths = MARIA.map((mare) => closedPath(mareOutline(mare, state.librationLatDeg, state.librationLonDeg)));
  return { litPath, mariaPaths };
}
