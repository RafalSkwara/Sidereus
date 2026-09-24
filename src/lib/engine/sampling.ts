import type { Interval } from "./types";

/**
 * Sample instants across an interval: `start`, then every `stepMinutes`, and always `end` as the
 * final sample even when it does not fall on the grid, so both ends of the interval are covered.
 * Shared by the moon and object tracks so every track uses the same grid.
 */
export function sampleInstants(interval: Interval, stepMinutes: number): Date[] {
  if (!Number.isFinite(stepMinutes) || stepMinutes <= 0) {
    throw new RangeError(`Track step must be a positive number of minutes, got ${stepMinutes}`);
  }
  const startMs = interval.start.getTime();
  const endMs = interval.end.getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) {
    throw new RangeError("Track interval must have start <= end");
  }
  const stepMs = stepMinutes * 60_000;
  const instants: Date[] = [];
  for (let ms = startMs; ms < endMs; ms += stepMs) {
    instants.push(new Date(ms));
  }
  instants.push(new Date(endMs));
  return instants;
}
