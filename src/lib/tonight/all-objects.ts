// Ordering for the all-objects page (tonight-all-objects): every object that cleared the bar, by rank or by the
// time each is best placed, so the list doubles as a plan for the night.

export type AllObjectsSort = "rank" | "time";

/** `?sort=` value: "time" orders by best time; anything else keeps the ranking. */
export function parseSort(value: string | null): AllObjectsSort {
  return value === "time" ? "time" : "rank";
}

/**
 * A new array in the chosen order. "time" orders by the peak instant (`bestAt`, so correct across midnight);
 * objects peaking at the same instant keep their rank order.
 */
export function sortEntries<T extends { rank: number; bestAt: number }>(
  entries: readonly T[],
  sort: AllObjectsSort,
): T[] {
  const copy = [...entries];
  return sort === "time"
    ? copy.sort((a, b) => a.bestAt - b.bestAt || a.rank - b.rank)
    : copy.sort((a, b) => a.rank - b.rank);
}
