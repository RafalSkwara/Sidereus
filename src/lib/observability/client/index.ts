/**
 * The client reporting core (error-visibility Phases 7-9): the barrel the silent-catch guard recognises as
 * `@/lib/observability/client`. It holds the core and the page's reporter (`browser.ts`: `report`, `reportAnd`,
 * `installErrorReporting`). Browser-safe, and for the page only: the service worker never imports this barrel (its
 * reporter is `@/lib/offline/report`, which takes the core from the leaf modules), so no page code reaches the worker.
 */
export * from "./browser";
export * from "./classify";
export * from "./reporter";
export * from "./steps";
