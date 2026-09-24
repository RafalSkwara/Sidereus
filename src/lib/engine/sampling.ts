import type { Interval } from "./types";

/** Finest grid the engine samples on. Coarser steps are fine; finer ones are a bug, not a feature. */
export const MIN_TRACK_STEP_MINUTES = 1;

/**
 * Sample instants across an interval: `start`, then every `stepMinutes`, and always `end` as the
 * final sample even when it does not fall on the grid, so both ends of the interval are covered.
 * Shared by the moon and object tracks so every track uses the same grid. Instants are computed by
 * integer index (`start + i * step`) so no floating-point drift accumulates.
 */
export function sampleInstants(interval: Interval, stepMinutes: number): Date[] {
  if (!Number.isFinite(stepMinutes) || stepMinutes < MIN_TRACK_STEP_MINUTES) {
    throw new RangeError(`Track step must be at least ${MIN_TRACK_STEP_MINUTES} minute, got ${stepMinutes}`);
  }
  const startMs = interval.start.getTime();
  const endMs = interval.end.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) {
    throw new RangeError("Track interval must have start <= end");
  }
  const stepMs = stepMinutes * 60_000;
  const instants: Date[] = [];
  for (let i = 0; startMs + i * stepMs < endMs; i++) {
    instants.push(new Date(startMs + i * stepMs));
  }
  instants.push(new Date(endMs));
  return instants;
}
