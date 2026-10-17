import { describe, expect, it } from "vitest";
import { parseCurrent, pickFromMap } from "./map-view";

describe("pickFromMap", () => {
  it("rounds to 2 decimals, wraps longitude, clamps latitude to ±90 and never returns -0", () => {
    const longitudes = [
      [190, -170],
      [-180, -180],
      [180, -180],
      [-190, 170],
      [540.5, -179.5],
    ] as const;
    expect(longitudes).toHaveLength(5);
    for (const [longitude, wrapped] of longitudes) {
      expect(pickFromMap(10, longitude).longitudeDeg, `longitude ${longitude}`).toBe(wrapped);
    }
    expect(pickFromMap(50.0649, 19.9451)).toEqual({ latitudeDeg: 50.06, longitudeDeg: 19.95 });
    expect(pickFromMap(91.3, 0).latitudeDeg).toBe(90);
    expect(pickFromMap(-95, 0).latitudeDeg).toBe(-90);
    const pick = pickFromMap(-0.001, -0.004);
    expect(Object.is(pick.latitudeDeg, 0)).toBe(true);
    expect(Object.is(pick.longitudeDeg, 0)).toBe(true);
  });
});

describe("parseCurrent", () => {
  it("returns the rounded point for numbers in range and null for anything else", () => {
    expect(parseCurrent("50.06", "19.94")).toEqual({ latitudeDeg: 50.06, longitudeDeg: 19.94 });
    expect(parseCurrent("-90", "180")).toEqual({ latitudeDeg: -90, longitudeDeg: 180 });
    expect(parseCurrent("50.0649", "19.9451")).toEqual({ latitudeDeg: 50.06, longitudeDeg: 19.95 });
    const invalid = [
      ["", ""],
      ["50.06", ""],
      ["  ", "19.94"],
      ["abc", "19.94"],
      ["50.06", "NaN"],
      ["Infinity", "19.94"],
      ["90.01", "19.94"],
      ["50.06", "-180.5"],
    ] as const;
    expect(invalid).toHaveLength(8);
    for (const [latitude, longitude] of invalid) {
      expect(
        parseCurrent(latitude, longitude),
        `(${JSON.stringify(latitude)}, ${JSON.stringify(longitude)})`,
      ).toBeNull();
    }
  });
});
