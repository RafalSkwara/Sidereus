import { describe, expect, it } from "vitest";
import { NEUTRAL_VIEW, POINT_ZOOM, initialMapView, parseCurrent, pickFromMap } from "./map-view";

describe("parseCurrent", () => {
  it("returns the point when both strings are valid numbers in range", () => {
    expect(parseCurrent("50.06", "19.94")).toEqual({ latitudeDeg: 50.06, longitudeDeg: 19.94 });
    expect(parseCurrent("-90", "180")).toEqual({ latitudeDeg: -90, longitudeDeg: 180 });
  });

  it.each([
    ["", ""],
    ["50.06", ""],
    ["  ", "19.94"],
    ["abc", "19.94"],
    ["50.06", "NaN"],
    ["Infinity", "19.94"],
    ["90.01", "19.94"],
    ["50.06", "-180.5"],
  ])("returns null for (%j, %j)", (latitude, longitude) => {
    expect(parseCurrent(latitude, longitude)).toBeNull();
  });
});

describe("initialMapView", () => {
  it("starts at the current point with the pin when there is one", () => {
    expect(initialMapView({ latitudeDeg: 40.42, longitudeDeg: -3.7 })).toEqual({
      latitudeDeg: 40.42,
      longitudeDeg: -3.7,
      zoom: POINT_ZOOM,
      pinned: true,
    });
  });

  it("falls back to the neutral view without a pin", () => {
    expect(initialMapView(null)).toEqual({ ...NEUTRAL_VIEW, pinned: false });
    expect(initialMapView(undefined)).toEqual({ ...NEUTRAL_VIEW, pinned: false });
  });
});

describe("pickFromMap", () => {
  it("rounds to 2 decimals", () => {
    expect(pickFromMap(50.0649, 19.9451)).toEqual({ latitudeDeg: 50.06, longitudeDeg: 19.95 });
  });

  it.each([
    [190, -170],
    [-180, -180],
    [180, -180],
    [-190, 170],
    [540.5, -179.5],
  ])("wraps longitude %d to %d", (longitude, wrapped) => {
    expect(pickFromMap(10, longitude).longitudeDeg).toBe(wrapped);
  });

  it("clamps latitude to ±90", () => {
    expect(pickFromMap(91.3, 0).latitudeDeg).toBe(90);
    expect(pickFromMap(-95, 0).latitudeDeg).toBe(-90);
  });

  it("normalises -0", () => {
    const pick = pickFromMap(-0.001, -0.004);
    expect(Object.is(pick.latitudeDeg, 0)).toBe(true);
    expect(Object.is(pick.longitudeDeg, 0)).toBe(true);
  });
});
