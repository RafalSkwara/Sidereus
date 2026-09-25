import { describe, expect, it } from "vitest";
import { roundCoordinate } from "./coordinates";

describe("roundCoordinate", () => {
  it("rounds to 2 decimals (~1 km)", () => {
    expect(roundCoordinate(52.2297)).toBe(52.23);
    expect(roundCoordinate(21.0122)).toBe(21.01);
  });

  it("normalises a rounded negative zero to 0", () => {
    expect(Object.is(roundCoordinate(-0.004), 0)).toBe(true);
  });

  it("keeps the range ends in range", () => {
    expect(roundCoordinate(90)).toBe(90);
    expect(roundCoordinate(-90)).toBe(-90);
    expect(roundCoordinate(-180)).toBe(-180);
    expect(roundCoordinate(180)).toBe(180);
  });

  it("rounds negative values symmetrically", () => {
    expect(roundCoordinate(-52.2297)).toBe(-52.23);
  });
});
