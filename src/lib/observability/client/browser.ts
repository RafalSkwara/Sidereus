import { createReporter, type ClientReport, type Reporter } from "./reporter";
import { CLIENT_ERROR_PATH, type ClientStep } from "./steps";

// The page's reporter (error-visibility Phase 9): the one place the browser side of the site reports a failure, from the
// global handlers below and from the islands' own sites (`report`, `reportAnd`). One reporter, so every source shares the
// cap and the dedupe. Browser-only and server-free: it imports the core's leaf modules and nothing else, and the service
// worker never imports it (its own reporter is `@/lib/offline/report`, a separate instance).

/** Reports one page may send (D9): an island that fails in a loop cannot flood the endpoint. */
const MAX_PER_PAGE = 5;

/**
 * Posts the payload to the endpoint: a beacon (a `text/plain` blob keeps it a simple request, and the browser sends it
 * even while the page unloads), or, when `sendBeacon` is missing or refuses the report, a keepalive `fetch` of the same
 * JSON. The reporter core absorbs a throw or a rejection here (a report that cannot be sent has nowhere else to go), so
 * there is no catch of its own.
 */
function send(payload: ClientReport): unknown {
  const body = JSON.stringify(payload);
  if (typeof navigator.sendBeacon === "function") {
    if (navigator.sendBeacon(CLIENT_ERROR_PATH, new Blob([body], { type: "text/plain" }))) return undefined;
  }
  return fetch(CLIENT_ERROR_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  });
}

const reporter = createReporter({ send, maxTotal: MAX_PER_PAGE });

/** Reports a failure at `step`; never throws, never waits. */
export function report(step: ClientStep, error: unknown): void {
  reporter.report(step, error);
}

/**
 * A rejection handler that reports and then returns `fallback`, so `.catch(() => undefined)` becomes
 * `.catch(reportAnd("island.<step>", undefined))` with the same behaviour and a trace.
 */
export function reportAnd<T>(step: ClientStep, fallback: T): (error: unknown) => T {
  return (error) => {
    report(step, error);
    return fallback;
  };
}

/**
 * Hydration problems (D15). React 19 routes a recoverable hydration mismatch, often caused by an extension changing the
 * DOM, through `reportError`, so such an error gets its own step. The message is read only by this test: it is never
 * stored or sent.
 */
const HYDRATION = /hydrat/i;

/** Whether the script that threw is ours: the build's own files live under `/_astro/` (D15), checked here, never sent. */
function isOwnScript(filename: unknown): boolean {
  return typeof filename === "string" && filename.startsWith(`${window.location.origin}/_astro/`);
}

function messageOf(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

/** The windows that already carry the handlers, so installing twice (a second script, a hot reload) adds none. */
const installed = new WeakSet<object>();

/**
 * Registers the page's `error` and `unhandledrejection` handlers, once. An `error` event with no error object (a
 * cross-origin "Script error.", a resource that failed to load) and one from a script that is not ours (an extension,
 * the console) is ignored; a rejection has no file name and is reported as it is (accepted). The report carries the
 * error's name only, through the reporter.
 */
export function installErrorReporting(target: Pick<Reporter, "report"> = reporter): void {
  if (installed.has(window)) return;
  installed.add(window);
  window.addEventListener("error", (event: ErrorEvent) => {
    const error: unknown = event.error;
    if (error === undefined || error === null || !isOwnScript(event.filename)) return;
    target.report(HYDRATION.test(messageOf(error)) ? "island.hydration" : "island.uncaught", error);
  });
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    target.report("island.unhandled-rejection", event.reason);
  });
}
