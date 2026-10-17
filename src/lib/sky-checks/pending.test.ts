import { describe, expect, it } from "vitest";
import { nightsBefore, pendingCheck } from "./pending";
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

describe("pendingCheck", () => {
  it("crosses a month boundary", () => {
    expect(pendingCheck([check("2026-09-30")], "home", "2026-10-01")?.night).toBe("2026-09-30");
    expect(pendingCheck([check("2026-09-29")], "home", "2026-10-01")?.night).toBe("2026-09-29");
    expect(pendingCheck([check("2026-09-28")], "home", "2026-10-01")).toBeNull();
  });
});
