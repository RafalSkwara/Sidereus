/**
 * The closed vocabulary of client reports (error-visibility, Phase 7). Browser-safe: no server import, so the service
 * worker, the page and the route's schema all read the same list.
 */

/** Where a browser posts a report; shared by the route, the middleware's short-circuit, the reporters and the tests. */
export const CLIENT_ERROR_PATH = "/api/client-error";

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
 * the normal case in the field and is not reported (D14, `isRoutineNetworkFault`). Phase 8 confirms the assignment site
 * by site as it wires the worker.
 */
export const NETWORK_STEPS: readonly ClientStep[] = [
  "sw.precache",
  "sw.offline-page",
  "sw.next-night",
  "sw.store-page",
  "sw.navigation",
];

/**
 * What an error's name may look like to travel in a report: a short identifier (`QuotaExceededError`), never a sentence
 * or a value. The reporter filters with it and the route's schema refuses anything else, so the two cannot drift.
 */
export const NAME_SHAPE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
