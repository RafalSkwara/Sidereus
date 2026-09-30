import { describe, expect, it } from "vitest";

import { seenSummaries } from "./log";
import type { LogEntry } from "./log";

const TONIGHT = "2026-09-26";

describe("seenSummaries (PRD FR-018, invariant 4)", () => {
  it("ignores entries rated 1 and 2, so a failed attempt never counts as seen", () => {
    const log: LogEntry[] = [
      { messier: 13, night: "2026-09-20", rating: 1 },
      { messier: 13, night: "2026-09-21", rating: 2 },
    ];
    expect(seenSummaries(log, TONIGHT).has(13)).toBe(false);
  });

  it("counts the nights rated 3 or above and reports the latest of them", () => {
    const log: LogEntry[] = [
      { messier: 31, night: "2026-08-14", rating: 3 },
      { messier: 31, night: "2026-09-12", rating: 5 },
      { messier: 31, night: "2026-09-02", rating: 4 },
      // A later failed attempt neither adds to the count nor moves the date.
      { messier: 31, night: "2026-09-20", rating: 1 },
    ];
    expect(seenSummaries(log, TONIGHT).get(31)).toEqual({ count: 3, lastNight: "2026-09-12" });
  });

  it("counts two entries on the same night once", () => {
    const log: LogEntry[] = [
      { messier: 57, night: "2026-09-12", rating: 4 },
      { messier: 57, night: "2026-09-12", rating: 5 },
    ];
    expect(seenSummaries(log, TONIGHT).get(57)).toEqual({ count: 1, lastNight: "2026-09-12" });
  });

  it("counts the ranked night itself but no night after it", () => {
    const log: LogEntry[] = [
      { messier: 42, night: TONIGHT, rating: 4 },
      { messier: 45, night: "2026-09-27", rating: 4 },
    ];
    const seen = seenSummaries(log, TONIGHT);
    expect(seen.get(42)).toEqual({ count: 1, lastNight: TONIGHT });
    expect(seen.has(45)).toBe(false);
  });

  it("keeps objects apart", () => {
    const log: LogEntry[] = [
      { messier: 13, night: "2026-09-10", rating: 4 },
      { messier: 92, night: "2026-09-11", rating: 3 },
    ];
    const seen = seenSummaries(log, TONIGHT);
    expect([...seen.keys()].sort((x, y) => x - y)).toEqual([13, 92]);
  });
});
