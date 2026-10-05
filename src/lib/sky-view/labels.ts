/**
 * Label placement on the interactive sky (interactive-sky). Body labels (targets, planets, the Moon) always stay;
 * star labels fill in around them, brightest first, dropped when they overlap a placed label or an obstacle (a body
 * marker) or leave the strip, and capped at `MAX_STAR_LABELS`.
 *
 * Each item offers its rectangles in order of preference (right of its dot, then left, …); the first that fits wins.
 * A body whose rectangles all collide keeps its first one inside the bounds. With `bounds.top`, no star label sits
 * above it (the panorama's overlap behind the verdict, which shows stars only).
 *
 * `labelRects` and `bodyLabelRects` build the candidates; `leaderLine` says when a placed body label sits far enough
 * from its dot to need a line back to it (a body high in the overlap, its label clamped below the overlap).
 *
 * Pure and island-safe.
 */

export const MAX_STAR_LABELS = 15;

/** A label's height on the strip: the caption role's line, with a little air. */
export const LABEL_HEIGHT_PX = 14;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelItem {
  id: string;
  kind: "body" | "star";
  /** Stars: the magnitude, brighter (smaller) first. Ignored for bodies. */
  mag?: number;
  /** Candidate rectangles, most preferred first; at least one. */
  rects: readonly Rect[];
}

export interface PlacedLabel {
  id: string;
  kind: "body" | "star";
  rect: Rect;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** The strip a label may sit in: `top` (default 0) keeps labels below a band where only stars are drawn. */
export interface LabelBounds {
  width: number;
  height: number;
  top?: number;
}

function inside(rect: Rect, bounds: LabelBounds): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= (bounds.top ?? 0) &&
    rect.x + rect.width <= bounds.width &&
    rect.y + rect.height <= bounds.height
  );
}

export function placeLabels(
  items: readonly LabelItem[],
  bounds: LabelBounds,
  obstacles: readonly Rect[] = [],
  maxStars = MAX_STAR_LABELS,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const free = (rect: Rect) => !placed.some((label) => overlaps(label.rect, rect));

  for (const item of items) {
    if (item.kind !== "body" || item.rects.length === 0) continue;
    const rect =
      item.rects.find((r) => inside(r, bounds) && free(r)) ??
      item.rects.find((r) => inside(r, bounds)) ??
      item.rects[0];
    placed.push({ id: item.id, kind: "body", rect });
  }

  const stars = items.filter((item) => item.kind === "star").sort((a, b) => (a.mag ?? Infinity) - (b.mag ?? Infinity));
  let starCount = 0;
  for (const item of stars) {
    if (starCount >= maxStars) break;
    const rect = item.rects.find((r) => inside(r, bounds) && free(r) && !obstacles.some((o) => overlaps(o, r)));
    if (rect) {
      placed.push({ id: item.id, kind: "star", rect });
      starCount++;
    }
  }
  return placed;
}

/** A label's candidate rectangles beside a dot at (x, y): right, left, then above and below with `withVertical`. */
export function labelRects(x: number, y: number, width: number, gap: number, withVertical: boolean): Rect[] {
  const middle = y - LABEL_HEIGHT_PX / 2;
  const rects = [
    { x: x + gap, y: middle, width, height: LABEL_HEIGHT_PX },
    { x: x - gap - width, y: middle, width, height: LABEL_HEIGHT_PX },
  ];
  if (withVertical) {
    rects.push(
      { x: x - width / 2, y: y - gap - LABEL_HEIGHT_PX, width, height: LABEL_HEIGHT_PX },
      { x: x - width / 2, y: y + gap, width, height: LABEL_HEIGHT_PX },
    );
  }
  return rects;
}

/** The gap between a body's dot and its label. */
const BODY_GAP_PX = 8;
/** The gap between a high body's sideways label and the centred slot under its dot. */
const SIDE_GAP_PX = 4;

/**
 * A body's label candidates: beside its dot as usual, then below it but never higher than `overlap` (the strip's
 * band behind the verdict, which shows stars only). A dot inside the overlap gets only the clamped row below it:
 * centred on the dot, then just right of that centred slot, then just left of it, so two or three high bodies in one
 * column sit side by side instead of stacking.
 */
export function bodyLabelRects(x: number, y: number, width: number, overlap: number): Rect[] {
  const belowY = Math.max(y + BODY_GAP_PX, overlap);
  const below = { x: x - width / 2, y: belowY, width, height: LABEL_HEIGHT_PX };
  if (y < overlap) {
    return [
      below,
      { x: x + width / 2 + SIDE_GAP_PX, y: belowY, width, height: LABEL_HEIGHT_PX },
      { x: x - width / 2 - SIDE_GAP_PX - width, y: belowY, width, height: LABEL_HEIGHT_PX },
    ];
  }
  return [...labelRects(x, y, width, BODY_GAP_PX, true), below];
}

/** How far from a dot's centre its leader line starts, clear of the largest marker (the Moon's 5.5 px disc). */
const LEADER_START_PX = 7;

/**
 * The line from a dot at (x, y) to the nearest point of its label, when the label sits more than one label height
 * away (so the pair still reads as one); `null` when it is close enough to need none. It starts just outside the dot.
 * Ends are rounded to 0.1 px, as the island's points are, so the server and the browser render the same attributes.
 */
export function leaderLine(
  x: number,
  y: number,
  rect: Rect,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const x2 = Math.min(Math.max(x, rect.x), rect.x + rect.width);
  const y2 = Math.min(Math.max(y, rect.y), rect.y + rect.height);
  const length = Math.hypot(x2 - x, y2 - y);
  if (length <= LABEL_HEIGHT_PX) return null;
  const k = LEADER_START_PX / length;
  const tenth = (value: number) => Math.round(value * 10) / 10;
  return { x1: tenth(x + (x2 - x) * k), y1: tenth(y + (y2 - y) * k), x2: tenth(x2), y2: tenth(y2) };
}
