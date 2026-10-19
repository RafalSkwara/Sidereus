import { errorName, isRoutineNetworkFault } from "./classify";
import type { ClientStep } from "./steps";

/** What a client may send: a step and, when the error had a shaped name, that name. Nothing else, ever. */
export interface ClientReport {
  step: ClientStep;
  name?: string;
}

export interface ReporterOptions {
  /** Posts the payload; it may throw or reject, which the reporter absorbs. */
  send: (payload: ClientReport) => unknown;
  /** The most reports this reporter sends in its lifetime: one page, or one wake-up of the worker. */
  maxTotal: number;
}

export interface Reporter {
  report: (step: ClientStep, error: unknown) => void;
}

/**
 * The one place a client report is built and bounded (D9, D10, D14). `report(step, error)` sends `{ step, name? }`: the
 * name only when `error.name` looks like an identifier, never the message, stack, file name, line or URL. It drops a
 * routine network fault, a report made while the device is offline (not queued: the next online failure is reported),
 * a repeat of the same step and name, and everything after `maxTotal`. It calls `send` without waiting for it and
 * never throws. Browser-safe: no server import, no DOM.
 */
export function createReporter({ send, maxTotal }: ReporterOptions): Reporter {
  const seen = new Set<string>();

  // One handler for everything the reporter can hit: a reporter that fails cannot report that anywhere else (the
  // silent-catch guard's allowlist says so). It is async so a synchronous throw from `send` and a rejection are the
  // same catch, and so `report` never waits: the sync part below runs before the first await.
  async function run(step: ClientStep, error: unknown): Promise<void> {
    try {
      if (isRoutineNetworkFault(step, error)) {
        return;
      }
      if ((globalThis as { navigator?: { onLine?: boolean } }).navigator?.onLine === false) {
        return;
      }
      const name = errorName(error);
      const key = `${step}\u0000${name ?? ""}`;
      if (seen.size >= maxTotal || seen.has(key)) {
        return;
      }
      seen.add(key);
      await send(name === undefined ? { step } : { step, name });
    } catch {
      // See above.
    }
  }

  return {
    report: (step, error) => {
      void run(step, error);
    },
  };
}
