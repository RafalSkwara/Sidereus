// Ordering for the Targets page (tonight-all-objects, now /tonight/targets since tonight-dashboard): every object that
// cleared the bar, by rank or by the time each is best placed, so the list doubles as a plan for the night.

export type AllObjectsSort = "rank" | "time";

/** `?sort=` value: "time" orders by best time; anything else keeps the ranking. */
export function parseSort(value: string | null): AllObjectsSort {
  return value === "time" ? "time" : "rank";
}

const SORTS: readonly string[] = ["rank", "time"] satisfies AllObjectsSort[];

/**
 * Where the retired /tonight/all sends a request (tonight-dashboard): /tonight/targets, keeping `?sort=` only when it
 * is one of the fixed orders and dropping everything else. No fragment: a browser re-applies the request's own
 * (`#washed-out`) to a redirect whose `Location` has none.
 */
export function targetsRedirectPath(searchParams: URLSearchParams): string {
  const sort = searchParams.get("sort");
  return sort !== null && SORTS.includes(sort) ? `/tonight/targets?sort=${sort}` : "/tonight/targets";
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
