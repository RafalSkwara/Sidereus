import { describe, expect, it } from "vitest";

import { seenSummaries } from "./log";
import type { LogEntry } from "./log";

const TONIGHT = "2026-09-26";

describe("seenSummaries (PRD FR-018, invariant 4)", () => {
  it("ignores entries rated 1 and 2, so a failed attempt never counts as seen, moves a count or a date", () => {
    const log: LogEntry[] = [
      // Only failed attempts: never seen.
      { target: "M13", night: "2026-09-20", rating: 1 },
      { target: "M13", night: "2026-09-21", rating: 2 },
      // A later failed attempt neither adds to the count nor moves the last night.
      { target: "M31", night: "2026-08-14", rating: 3 },
      { target: "M31", night: "2026-09-12", rating: 5 },
      { target: "M31", night: "2026-09-02", rating: 4 },
      { target: "M31", night: "2026-09-20", rating: 1 },
      // An earlier failed attempt cannot be the first night.
      { target: "M45", night: "2026-07-01", rating: 2 },
      { target: "M45", night: "2026-09-05", rating: 3 },
      { target: "M45", night: "2026-08-20", rating: 5 },
      // Planets are keyed by target beside the Messier objects.
      { target: "jupiter", night: "2026-09-10", rating: 4 },
      { target: "jupiter", night: "2026-09-18", rating: 5 },
      { target: "saturn", night: "2026-09-12", rating: 2 },
    ];
    const seen = seenSummaries(log, TONIGHT);
    expect(seen.has("M13"), "M13: only ratings 1 and 2").toBe(false);
    expect(seen.has("saturn"), "saturn: rated 2").toBe(false);
    expect(seen.get("M31"), "M31").toEqual({ count: 3, firstNight: "2026-08-14", lastNight: "2026-09-12" });
    expect(seen.get("M45"), "M45").toEqual({ count: 2, firstNight: "2026-08-20", lastNight: "2026-09-05" });
    expect(seen.get("jupiter"), "jupiter").toEqual({ count: 2, firstNight: "2026-09-10", lastNight: "2026-09-18" });
    expect([...seen.keys()].sort(), "exactly the objects that were seen").toEqual(["M31", "M45", "jupiter"]);
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

  it("counts the ranked night itself but no night after it, and excludes no night when the cut-off is omitted", () => {
    const log: LogEntry[] = [
      { target: "M42", night: TONIGHT, rating: 4 },
      { target: "M45", night: "2026-09-27", rating: 4 },
      { target: "M13", night: "2026-09-20", rating: 4 },
      { target: "M13", night: "2027-03-01", rating: 4 },
    ];
    const seen = seenSummaries(log, TONIGHT);
    expect(seen.get("M42"), "the ranked night itself").toEqual({ count: 1, firstNight: TONIGHT, lastNight: TONIGHT });
    expect(seen.has("M45"), "a night after the cut-off").toBe(false);
    // With a cut-off the later night drops out, so first and last coincide.
    expect(seen.get("M13"), "M13 with the cut-off").toEqual({
      count: 1,
      firstNight: "2026-09-20",
      lastNight: "2026-09-20",
    });
    expect(seenSummaries(log).get("M13"), "M13 without the cut-off").toEqual({
      count: 2,
      firstNight: "2026-09-20",
      lastNight: "2027-03-01",
    });
    expect(seenSummaries(log).has("M45"), "M45 without the cut-off").toBe(true);
  });
});
