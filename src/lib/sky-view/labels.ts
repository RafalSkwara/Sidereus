/**
 * Label placement on the interactive sky (interactive-sky). Body labels (targets, planets, the Moon) always stay;
 * star labels fill in around them, brightest first, dropped when they overlap a placed label or an obstacle (a body
 * marker) or leave the strip, and capped at `MAX_STAR_LABELS`.
 *
 * Each item offers its rectangles in order of preference (right of its dot, then left, …); the first that fits wins.
 * A body whose rectangles all collide keeps its first one inside the bounds. With `bounds.top`, no star label sits
 * above it (the panorama's overlap behind the verdict, which shows stars only).
 *
 * Pure and island-safe.
 */

export const MAX_STAR_LABELS = 15;

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
