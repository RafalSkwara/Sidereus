import { describe, expect, it } from "vitest";
import { nightsBefore, openSkyChecksSince, pendingCheck } from "./pending";
import type { SkyCheckRecord } from "./store";

function check(night: string, overrides: Partial<SkyCheckRecord> = {}): SkyCheckRecord {
  return {
    id: `check-${night}`,
    siteId: "home",
    siteName: "Home",
    night,
    headline: "go",
    answer: null,
    skipped: false,
    ...overrides,
  };
}

describe("nightsBefore", () => {
  it("steps back across a month and a year boundary", () => {
    expect(nightsBefore("2026-10-01", 1)).toBe("2026-09-30");
    expect(nightsBefore("2026-03-01", 2)).toBe("2026-02-27");
    expect(nightsBefore("2027-01-01", 2)).toBe("2026-12-30");
  });
});

describe("openSkyChecksSince", () => {
  it("reads from four days before today's UTC date", () => {
    expect(openSkyChecksSince(new Date("2026-10-03T23:30:00Z"))).toBe("2026-09-29");
  });
});

describe("pendingCheck", () => {
  const tonight = "2026-10-03";

  it("asks about the newest open night of the last two", () => {
    const open = [check("2026-10-01"), check("2026-10-02")];
    expect(pendingCheck(open, "home", tonight)?.night).toBe("2026-10-02");
  });

  it("falls back to the night before last when last night is not open", () => {
    expect(pendingCheck([check("2026-10-01")], "home", tonight)?.night).toBe("2026-10-01");
  });

  it("never asks about tonight itself or three nights back", () => {
    expect(pendingCheck([check("2026-10-03"), check("2026-09-30")], "home", tonight)).toBeNull();
  });

  it("asks only about the shown site", () => {
    expect(pendingCheck([check("2026-10-02", { siteId: "cabin" })], "home", tonight)).toBeNull();
  });

  it("skips answered and skipped nights", () => {
    const open = [check("2026-10-02", { answer: "clear" }), check("2026-10-01", { skipped: true })];
    expect(pendingCheck(open, "home", tonight)).toBeNull();
  });

  it("crosses a month boundary", () => {
    expect(pendingCheck([check("2026-09-30")], "home", "2026-10-01")?.night).toBe("2026-09-30");
    expect(pendingCheck([check("2026-09-29")], "home", "2026-10-01")?.night).toBe("2026-09-29");
    expect(pendingCheck([check("2026-09-28")], "home", "2026-10-01")).toBeNull();
  });
});
