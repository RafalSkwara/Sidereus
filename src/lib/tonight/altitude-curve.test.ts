import { describe, expect, it } from "vitest";

import { altitudeCurve, type AltitudeCurveInput } from "./altitude-curve";

// A 1000 × 90 box, so one degree is one unit of height and x reads as tenths of a percent of the axis.
const box = { width: 1000, height: 90 };

function curve(overrides: Partial<AltitudeCurveInput> = {}) {
  return altitudeCurve({
    // Five steps of a fifth of the axis: 0°, 20°, 40°, 30°, 10°, -5° (in tenths of a degree).
    track: [0, 200, 400, 300, 100, -50],
    stepFraction: 0.2,
    minAltitudeDeg: 15,
    window: { from: 0.2, to: 0.7 },
    best: 0.4,
    bestAltitudeDeg: 40,
    ...box,
    ...overrides,
  });
}

/** The (x, y) pairs of a path, in order. */
function pointsOf(path: string): [number, number][] {
  return [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((match) => [Number(match[1]), Number(match[2])]);
}

describe("altitudeCurve", () => {
  it("maps each sample's time to x and its altitude to y, the horizon at the bottom", () => {
    expect(pointsOf(curve().line)).toEqual([
      [0, 90],
      [200, 70],
      [400, 50],
      [600, 60],
      [800, 80],
      // Below the horizon lies on the bottom edge.
      [1000, 90],
    ]);
    expect(curve().line.startsWith("M0 90 L")).toBe(true);
  });

  it("stops x at the axis end when the last step is shorter", () => {
    const points = pointsOf(curve({ track: [0, 100, 200, 300], stepFraction: 0.4 }).line);
    expect(points.map(([x]) => x)).toEqual([0, 400, 800, 1000]);
  });

  it("caps the scale at the zenith", () => {
    const points = pointsOf(curve({ track: [900, 950] }).line);
    expect(points.map(([, y]) => y)).toEqual([0, 0]);
  });

  it("places the minimum-altitude line and the best-time dot", () => {
    const result = curve();
    expect(result.minY).toBe(75);
    expect(result.dot).toEqual({ x: 400, y: 50 });
  });

  it("draws the window from its interpolated edges through the samples inside it", () => {
    // 0.7 lies halfway between 30° (at 0.6) and 10° (at 0.8): 20°.
    expect(pointsOf(curve().window)).toEqual([
      [200, 70],
      [400, 50],
      [600, 60],
      [700, 70],
    ]);
    // An edge between samples is interpolated too: 0.1 is halfway between 0° and 20°.
    expect(pointsOf(curve({ window: { from: 0.1, to: 0.3 } }).window)).toEqual([
      [100, 80],
      [200, 70],
      [300, 60],
    ]);
  });

  it("has no window path for a window without length or an empty track", () => {
    expect(curve({ window: { from: 0.5, to: 0.5 } }).window).toBe("");
    const empty = curve({ track: [] });
    expect(empty.line).toBe("");
    expect(empty.window).toBe("");
  });
});
