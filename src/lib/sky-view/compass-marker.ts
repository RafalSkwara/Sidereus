/**
 * Which compass label is nearest the middle of the panorama's visible part (ui-user-adjustments): the island marks it
 * as the scroller moves. Plain arithmetic over the label positions the island already has; the point opposite `facing`
 * is drawn at both ends of the strip, and the copy nearest the middle wins.
 *
 * Island-safe: pure numbers, no imports.
 */

/** The index of the x nearest `centre` (the first on a tie); `-1` for an empty list. */
export function nearestToCentre(xs: readonly number[], centre: number): number {
  let best = -1;
  let bestDistance = Infinity;
  xs.forEach((x, i) => {
    const distance = Math.abs(x - centre);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}
