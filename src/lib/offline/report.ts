import { createReporter, type ClientReport } from "@/lib/observability/client/reporter";
import { CLIENT_ERROR_PATH, type ClientStep } from "@/lib/observability/client/steps";

// The service worker's reporter (error-visibility Phase 8). It imports the core from its leaf modules, never from the
// `@/lib/observability/client` barrel, so the worker bundle holds no page code and no logger (`build-sw.mjs` checks).

/** Reports one wake-up of the worker may send: the browser ends an idle worker, so this bounds a wake-up, not a device (D14). */
const MAX_PER_WAKE_UP = 10;

/**
 * Posts the payload to the endpoint. No credentials beyond the default same-origin, and `keepalive` so the request
 * outlives the worker's task. The reporter core absorbs a throw or rejection here (a report that cannot be sent has
 * nowhere else to go), so there is no catch of its own.
 */
function send(payload: ClientReport): Promise<Response> {
  return fetch(CLIENT_ERROR_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  });
}

const reporter = createReporter({ send, maxTotal: MAX_PER_WAKE_UP });

/** Reports a failure at `step`; never throws, never waits. A routine network fault at a network step is dropped (D14). */
export function report(step: ClientStep, error: unknown): void {
  reporter.report(step, error);
}

/**
 * A rejection handler that reports and then returns `fallback`, so `.catch(() => undefined)` becomes
 * `.catch(reportAnd("sw.<step>", undefined))` with the same behaviour and a trace.
 */
export function reportAnd<T>(step: ClientStep, fallback: T): (error: unknown) => T {
  return (error) => {
    report(step, error);
    return fallback;
  };
}
