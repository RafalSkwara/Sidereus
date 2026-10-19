/**
 * The closed vocabulary of client reports (error-visibility, Phase 7). Browser-safe: no server import, so the service
 * worker, the page and the route's schema all read the same list.
 */

/** Where a browser posts a report; shared by the route, the middleware's short-circuit, the reporters and the tests. */
export const CLIENT_ERROR_PATH = "/api/client-error";

/** Whether `pathname` is the endpoint, with or without a trailing slash (`trailingSlash` is `ignore`, so both reach the route). */
export function isClientErrorPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === CLIENT_ERROR_PATH;
}

/**
 * Every step a client may report, in two families that say where the failure happened: `sw.*` (the service worker,
 * `src/sw.ts`) and `island.*` (the page and its React islands). A step outside this list is refused by the route.
 */
export const CLIENT_STEPS = [
  "sw.index",
  "sw.precache",
  "sw.shell",
  "sw.offline-page",
  "sw.next-night",
  "sw.store-page",
  "sw.asset-note",
  "sw.navigation",
  "sw.island-commit",
  "sw.sweep",
  "sw.purge",
  "island.uncaught",
  "island.unhandled-rejection",
  "island.hydration",
  "island.import",
  "island.sw-register",
  "island.geocode",
] as const;

export type ClientStep = (typeof CLIENT_STEPS)[number];

/**
 * The `sw.*` steps whose guarded operation is a network `fetch`: a `TypeError`, `AbortError` or `TimeoutError` there is
 * the normal case in the field and is not reported (D14, `isRoutineNetworkFault`). Assigned site by site in Phase 8
 * (`src/sw.ts`); the other six steps guard cache, index or storage work, where every error is reported. A cache or
 * storage error (`QuotaExceededError`, `InvalidStateError`) at a network step is still reported, since only those three
 * names are routine; the accepted cost is that a real `TypeError` from a cache call at a network step goes unreported.
 *
 * - `sw.precache`: the `fetch` of an asset the precache does not hold (`keepAssets`); only the fetch is guarded.
 * - `sw.offline-page`: `storeOfflinePage`'s `fetch` of `/offline` (install, after a commit, after an auth POST); its
 *   cache write after the fetch is mixed in, and a storage fault there still reports.
 * - `sw.next-night`: `storeNextCopy`, two fetches (shell, island) before the commit; mixed, same reason.
 * - `sw.store-page`: `storePageRun`, two fetches before the commit, and the message handler around it; mixed.
 * - `sw.navigation`: `afterNavigation`, which fetches the island of a late answer, and the network answer that lost
 *   the race to the stored copy (the stored copy wins because the network failed: the routine case itself); mixed.
 *
 * Not network (a fault there is always reported): `sw.index` (the index's read, parse and write), `sw.shell` (reading
 * a stored or recorded shell, where a network body cut off mid-read can add a `TypeError`, and the stored copy at the
 * navigation timeout), `sw.asset-note` (the client lookup and the index write), `sw.island-commit` (the pair's
 * commit), `sw.sweep` and `sw.purge` (cache deletes and index writes; `purgeSignedOut` ends with a
 * `storeOfflinePage`, so a weak signal can add one `sw.purge` `TypeError` per wake-up, bounded by the dedupe and the
 * cap).
 */
export const NETWORK_STEPS: readonly ClientStep[] = [
  "sw.precache",
  "sw.offline-page",
  "sw.next-night",
  "sw.store-page",
  "sw.navigation",
];

/**
 * What an error's name may look like to travel in a report, or to be logged as a line's `name`: a short identifier
 * (`QuotaExceededError`, `PostgrestError`), never a sentence or a value. The reporter filters with it, the route's schema
 * refuses anything else and `log-failure.ts` reads names through it, so the three cannot drift.
 */
export const NAME_SHAPE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
