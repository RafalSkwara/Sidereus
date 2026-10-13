import type { FinderPanel, PanelCircle } from "@/lib/engine";
import { placeLabels, type Rect } from "@/lib/sky-view/labels";

/**
 * The finder chart's SVG geometry (finder-chart Phase 3): one engine panel (`FinderPanel`, tangent-plane degrees, y
 * running down as in an SVG) mapped to a square viewBox of `size` units, with the star radii, the route as a path, the
 * circles, the zenith marker and the placed labels. Pure and deterministic: no clock, no formatting, no DOM; every
 * coordinate is rounded to 0.1 unit, so the server and a test render the same attributes. Text comes in through the
 * options (the caller formats it); the geometry only decides where it goes.
 *
 * The coordinates encode the site's latitude and the time roughly, like the live sky's rotations: they belong in the
 * HTML the page renders, never in a URL, a `data-*` attribute meant for scripts, or a log.
 */

/** Radius, in viewBox units, of the brightest star the scale reaches (Sirius is about -1.4). */
export const STAR_RADIUS_MAX = 3.2;
/** Radius of a star at the panel's depth. */
export const STAR_RADIUS_MIN = 0.5;
/** The brightest magnitude the radius scale spans. */
const BRIGHTEST_MAG = -1.5;

/** Label type size, in viewBox units; the SVG scales with the panel, so it reads ~13 px at 360 px wide. */
export const LABEL_FONT_UNITS = 8;
const LABEL_HEIGHT = LABEL_FONT_UNITS * 1.25;
/** A character's width in `LABEL_FONT_UNITS` type, with a little air. */
const LABEL_CHAR_WIDTH = LABEL_FONT_UNITS * 0.56;
const LABEL_PADDING = 2;

export type LabelAnchor = "start" | "middle" | "end";

export interface PanelSvgOptions {
  /** The square's side in viewBox units. */
  size: number;
  /** The faintest magnitude the panel was cut at, which gets the smallest dot; default: the faintest star in the panel. */
  depthMag?: number;
  /** Star indices on the route (the start and the hop stars): these get a ring and, when named, a label. */
  routeStars?: readonly number[];
  /** Display designation by star index ("Mirach (β And)"); an index with none goes unlabelled. */
  names?: Readonly<Record<number, string | null>>;
  /** The target's name, labelled beside the marker. */
  targetLabel?: string;
  /** The zenith marker's label, when the panel has one. */
  zenithLabel?: string;
}

export interface SvgStar {
  cx: number;
  cy: number;
  r: number;
  route: boolean;
}

export interface SvgCircle {
  cx: number;
  cy: number;
  r: number;
  kind: PanelCircle["kind"];
}

export interface SvgLabel {
  /** The text's anchor point: its baseline start, middle or end by `anchor`. */
  x: number;
  y: number;
  text: string;
  anchor: LabelAnchor;
}

export interface PanelSvg {
  viewBox: string;
  size: number;
  stars: SvgStar[];
  /** The route as "M x y L x y …"; empty when the panel has none. */
  path: string;
  circles: SvgCircle[];
  /** The target marker's centre. */
  target: { cx: number; cy: number };
  zenith: { cx: number; cy: number } | null;
  labels: SvgLabel[];
}

/** Rounds to 0.1 and turns -0 into 0. */
const tenth = (value: number): number => Math.round(value * 10) / 10 + 0;

/** A star's radius: linear in magnitude from `STAR_RADIUS_MAX` at the brightest to `STAR_RADIUS_MIN` at `depthMag`. */
export function starRadius(mag: number, depthMag: number): number {
  const span = depthMag - BRIGHTEST_MAG;
  const share = span > 0 ? Math.min(1, Math.max(0, (depthMag - mag) / span)) : 0;
  return tenth(STAR_RADIUS_MIN + (STAR_RADIUS_MAX - STAR_RADIUS_MIN) * share);
}

/** The width a label's text takes, estimated from its length (no font metrics on the server). */
export function labelWidth(text: string): number {
  return Math.round((text.length * LABEL_CHAR_WIDTH + LABEL_PADDING * 2) * 10) / 10;
}

interface Candidate {
  rect: Rect;
  anchor: LabelAnchor;
}

/** Where a label may sit beside a dot at (x, y): right, left, above, below. */
function candidatesAround(x: number, y: number, width: number, gap: number): Candidate[] {
  const middle = y - LABEL_HEIGHT / 2;
  return [
    { rect: { x: x + gap, y: middle, width, height: LABEL_HEIGHT }, anchor: "start" },
    { rect: { x: x - gap - width, y: middle, width, height: LABEL_HEIGHT }, anchor: "end" },
    { rect: { x: x - width / 2, y: y - gap - LABEL_HEIGHT, width, height: LABEL_HEIGHT }, anchor: "middle" },
    { rect: { x: x - width / 2, y: y + gap, width, height: LABEL_HEIGHT }, anchor: "middle" },
  ];
}

export function panelSvg(panel: FinderPanel, options: PanelSvgOptions): PanelSvg {
  const { size } = options;
  const scale = size / panel.fieldDeg;
  const centre = size / 2;
  const toX = (x: number): number => tenth(centre + x * scale);
  const toY = (y: number): number => tenth(centre + y * scale);

  const depthMag = options.depthMag ?? panel.stars.reduce((faintest, star) => Math.max(faintest, star.mag), 0);
  const route = new Set(options.routeStars ?? []);
  const stars: SvgStar[] = panel.stars.map((star) => ({
    cx: toX(star.x),
    cy: toY(star.y),
    r: starRadius(star.mag, depthMag),
    route: route.has(star.index),
  }));

  const path =
    panel.path.length < 2
      ? ""
      : panel.path.map((p, i) => `${i === 0 ? "M" : "L"}${String(toX(p.x))} ${String(toY(p.y))}`).join(" ");

  const target = { cx: toX(panel.target.x), cy: toY(panel.target.y) };
  const circles: SvgCircle[] = panel.circles.map((circle) => ({
    cx: target.cx,
    cy: target.cy,
    r: tenth(circle.r * scale),
    kind: circle.kind,
  }));
  const zenith = panel.zenith === null ? null : { cx: toX(panel.zenith.x), cy: toY(panel.zenith.y) };

  // Labels: the target first, then the route's named stars in route order, then the zenith. All are "body" labels for
  // `placeLabels`, so none is dropped; each takes its first free spot inside the square.
  const items: { id: string; text: string; candidates: Candidate[] }[] = [];
  if (options.targetLabel !== undefined && options.targetLabel !== "") {
    const width = labelWidth(options.targetLabel);
    items.push({
      id: "target",
      text: options.targetLabel,
      // Past the 0.5° reflex ring, so the text clears the marker.
      candidates: candidatesAround(target.cx, target.cy, width, 7),
    });
  }
  const ordered = [...(options.routeStars ?? [])];
  for (const index of ordered) {
    const name = options.names?.[index];
    const at = panel.stars.findIndex((star) => star.index === index);
    if (name === undefined || name === null || at < 0) {
      continue;
    }
    items.push({
      id: `star-${String(index)}`,
      text: name,
      candidates: candidatesAround(stars[at].cx, stars[at].cy, labelWidth(name), stars[at].r + 2.5),
    });
  }
  if (zenith !== null && options.zenithLabel !== undefined) {
    items.push({
      id: "zenith",
      text: options.zenithLabel,
      candidates: candidatesAround(zenith.cx, zenith.cy, labelWidth(options.zenithLabel), 5),
    });
  }

  const anchors = new Map<Rect, LabelAnchor>();
  const placed = placeLabels(
    items.map((item) => {
      item.candidates.forEach((candidate) => anchors.set(candidate.rect, candidate.anchor));
      return { id: item.id, kind: "body" as const, rects: item.candidates.map((candidate) => candidate.rect) };
    }),
    { width: size, height: size },
  );
  const labels: SvgLabel[] = items.map((item) => {
    const spot = placed.find((label) => label.id === item.id);
    const rect = spot?.rect ?? item.candidates[0].rect;
    const anchor = anchors.get(rect) ?? "start";
    // A label that collided everywhere keeps its first rectangle: slide it back inside the square.
    const left = Math.min(Math.max(rect.x, 0), Math.max(0, size - rect.width));
    const x =
      anchor === "start"
        ? left + LABEL_PADDING
        : anchor === "end"
          ? left + rect.width - LABEL_PADDING
          : left + rect.width / 2;
    const top = Math.min(Math.max(rect.y, 0), Math.max(0, size - rect.height));
    return { x: tenth(x), y: tenth(top + LABEL_FONT_UNITS), text: item.text, anchor };
  });

  return { viewBox: `0 0 ${String(size)} ${String(size)}`, size, stars, path, circles, target, zenith, labels };
}
