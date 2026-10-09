import { describe, expect, it } from "vitest";

import { seenSummaries } from "./log";
import type { LogEntry } from "./log";

const TONIGHT = "2026-09-26";

describe("seenSummaries (PRD FR-018, invariant 4)", () => {
  it("ignores entries rated 1 and 2, so a failed attempt never counts as seen", () => {
    const log: LogEntry[] = [
      { target: "M13", night: "2026-09-20", rating: 1 },
      { target: "M13", night: "2026-09-21", rating: 2 },
    ];
    expect(seenSummaries(log, TONIGHT).has("M13")).toBe(false);
  });

  it("counts the nights rated 3 or above and reports the latest of them", () => {
    const log: LogEntry[] = [
      { target: "M31", night: "2026-08-14", rating: 3 },
      { target: "M31", night: "2026-09-12", rating: 5 },
      { target: "M31", night: "2026-09-02", rating: 4 },
      // A later failed attempt neither adds to the count nor moves the date.
      { target: "M31", night: "2026-09-20", rating: 1 },
    ];
    expect(seenSummaries(log, TONIGHT).get("M31")).toEqual({
      count: 3,
      firstNight: "2026-08-14",
      lastNight: "2026-09-12",
    });
  });

  it("counts two entries on the same night once", () => {
    const log: LogEntry[] = [
      { target: "M57", night: "2026-09-12", rating: 4 },
      { target: "M57", night: "2026-09-12", rating: 5 },
    ];
    expect(seenSummaries(log, TONIGHT).get("M57")).toEqual({
      count: 1,
      firstNight: "2026-09-12",
      lastNight: "2026-09-12",
    });
  });

  it("counts the ranked night itself but no night after it", () => {
    const log: LogEntry[] = [
      { target: "M42", night: TONIGHT, rating: 4 },
      { target: "M45", night: "2026-09-27", rating: 4 },
    ];
    const seen = seenSummaries(log, TONIGHT);
    expect(seen.get("M42")).toEqual({ count: 1, firstNight: TONIGHT, lastNight: TONIGHT });
    expect(seen.has("M45")).toBe(false);
  });

  it("keeps objects apart", () => {
    const log: LogEntry[] = [
      { target: "M13", night: "2026-09-10", rating: 4 },
      { target: "M92", night: "2026-09-11", rating: 3 },
    ];
    const seen = seenSummaries(log, TONIGHT);
    expect([...seen.keys()].sort()).toEqual(["M13", "M92"]);
  });

  it("keys Messier objects and planets by target, side by side", () => {
    const log: LogEntry[] = [
      { target: "jupiter", night: "2026-09-10", rating: 4 },
      { target: "jupiter", night: "2026-09-18", rating: 5 },
      { target: "M31", night: "2026-09-11", rating: 3 },
      { target: "saturn", night: "2026-09-12", rating: 2 },
    ];
    const seen = seenSummaries(log, TONIGHT);
    expect(seen.get("jupiter")).toEqual({ count: 2, firstNight: "2026-09-10", lastNight: "2026-09-18" });
    expect(seen.get("M31")).toEqual({ count: 1, firstNight: "2026-09-11", lastNight: "2026-09-11" });
    expect(seen.has("saturn")).toBe(false);
  });

  it("takes the first night from the earliest qualifying entry, not the earliest entry", () => {
    const log: LogEntry[] = [
      // Rated 2: never counts, so it cannot be the first night.
      { target: "M45", night: "2026-07-01", rating: 2 },
      { target: "M45", night: "2026-09-05", rating: 3 },
      { target: "M45", night: "2026-08-20", rating: 5 },
    ];
    expect(seenSummaries(log, TONIGHT).get("M45")).toEqual({
      count: 2,
      firstNight: "2026-08-20",
      lastNight: "2026-09-05",
    });
  });

  it("excludes no night when the cut-off is omitted, and keeps first and last night apart", () => {
    const log: LogEntry[] = [
      { target: "M42", night: "2026-09-20", rating: 4 },
      { target: "M42", night: "2027-03-01", rating: 4 },
      { target: "M45", night: "2027-03-02", rating: 1 },
    ];
    const seen = seenSummaries(log);
    expect(seen.get("M42")).toEqual({ count: 2, firstNight: "2026-09-20", lastNight: "2027-03-01" });
    expect(seen.has("M45")).toBe(false);
    // With a cut-off the later night drops out, so first and last coincide.
    expect(seenSummaries(log, TONIGHT).get("M42")).toEqual({
      count: 1,
      firstNight: "2026-09-20",
      lastNight: "2026-09-20",
    });
  });
});
