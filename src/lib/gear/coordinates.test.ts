import { describe, expect, it } from "vitest";
import { roundCoordinate } from "./coordinates";

describe("roundCoordinate", () => {
  it("rounds to 2 decimals (~1 km), symmetrically, without a negative zero, keeping the range ends", () => {
    expect(roundCoordinate(52.2297)).toBe(52.23);
    expect(roundCoordinate(-52.2297)).toBe(-52.23);
    expect(Object.is(roundCoordinate(-0.004), 0)).toBe(true);
    expect([90, -90, 180, -180].map(roundCoordinate)).toEqual([90, -90, 180, -180]);
  });
});
