import { afterAll, beforeAll, expect } from "vitest";

/**
 * TEST-ONLY. Runs a block of tests under several runner (process) time zones, switched in-process.
 *
 * Production code never reads the runner's zone, so every night-boundary expectation must hold in any of
 * these. A helper that touches `process.env` must not sit in scanned engine source; this directory is
 * skipped by the purity guard. Shared by the engine, Tonight and log night-boundary tests.
 *
 * Usage: `describe.each(RUNNER_ZONES)("... (runner zone %s)", (zone) => { useRunnerZone(zone); ... })`.
 * Call every function under test inside `it` or `beforeAll`, never at `describe` scope: a describe body
 * runs at collection under the original zone, and a default-zone `Intl.DateTimeFormat` created before the
 * switch keeps the old zone.
 */
export const RUNNER_ZONES = [
  "UTC",
  "Europe/Warsaw",
  "America/Los_Angeles",
  "Pacific/Kiritimati",
  "Asia/Kolkata",
] as const;

export type RunnerZone = (typeof RUNNER_ZONES)[number];

/** A fixed instant used to prove the zone switch took effect. */
export const RUNNER_ZONE_PROBE_INSTANT = "2026-10-24T18:00:00Z";

/** `new Date(RUNNER_ZONE_PROBE_INSTANT).getHours()` in each zone, written by hand (UTC offsets on 2026-10-24). */
export const RUNNER_ZONE_PROBE_HOUR: Record<RunnerZone, number> = {
  UTC: 18, // +00:00
  "Europe/Warsaw": 20, // CEST +02:00
  "America/Los_Angeles": 11, // PDT -07:00
  "Pacific/Kiritimati": 8, // +14:00, next day
  "Asia/Kolkata": 23, // +05:30, 23:30
};

/** Switches `process.env.TZ` for the enclosing `describe` and restores it (deleting it when it was unset) afterwards. */
export function useRunnerZone(zone: RunnerZone): void {
  let original: string | undefined;
  beforeAll(() => {
    original = process.env.TZ;
    process.env.TZ = zone;
  });
  afterAll(() => {
    if (original === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = original;
    }
  });
}

/** Asserts the switch took effect: the default `Intl` zone and the local getters both follow `zone`. */
export function expectRunnerZoneActive(zone: RunnerZone): void {
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // ICU may report the legacy alias for Kolkata.
  const accepted = zone === "Asia/Kolkata" ? ["Asia/Kolkata", "Asia/Calcutta"] : [zone];
  expect(accepted).toContain(resolved);
  expect(new Date(RUNNER_ZONE_PROBE_INSTANT).getHours()).toBe(RUNNER_ZONE_PROBE_HOUR[zone]);
}
