import { describe, expect, it } from "vitest";

import { nearestStateIndex } from "./state";

const at = (iso: string) => ({ time: iso });
const STATES = [at("2026-10-02T19:10:00.000Z"), at("2026-10-02T19:20:00.000Z"), at("2026-10-02T19:30:00.000Z")];

describe("nearestStateIndex", () => {
  it("picks the nearest state, the earlier on a tie", () => {
    expect(nearestStateIndex(STATES, Date.parse("2026-10-02T19:21:00Z"))).toBe(1);
    expect(nearestStateIndex(STATES, Date.parse("2026-10-02T19:25:00Z"))).toBe(1);
    expect(nearestStateIndex(STATES, Date.parse("2026-10-02T19:26:00Z"))).toBe(2);
  });

  it("clamps into the window: the first before it, the last after it", () => {
    expect(nearestStateIndex(STATES, Date.parse("2026-10-02T12:00:00Z"))).toBe(0);
    expect(nearestStateIndex(STATES, Date.parse("2026-10-03T08:00:00Z"))).toBe(2);
  });

  it("returns 0 without states", () => {
    expect(nearestStateIndex([], Date.parse("2026-10-02T19:21:00Z"))).toBe(0);
  });
});
