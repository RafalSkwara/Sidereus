import { describe, expect, it } from "vitest";

import { moonDiscState } from "@/lib/engine/moon-disc";

import { isLit, litMargin, moonDiscPaths, projectSelenographic } from "./geometry";
import type { DiscPoint } from "./geometry";
import { MARIA } from "./maria";
import type { MoonDiscState } from "./state";

/**
 * Orientation is pinned on real engine states, not synthetic angles, so a sign error shared by the engine's
 * bright-limb angle and the drawing cannot cancel out (plan › Phase 2 › Tests). Synthetic states are used only for the
 * phase-only invariants (k = 0, 0.5, 1), where the angle does not matter.
 */

/** The vertices of a polygonal `M … L … Z` path. */
function verticesOf(path: string): DiscPoint[] {
  const numbers = (path.match(/-?\d+\.\d+/g) ?? []).map(Number);
  const points: DiscPoint[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    points.push({ x: numbers[i], y: numbers[i + 1] });
  }
  return points;
}

/** Signed shoelace area and the area centroid of a closed polygon. */
function areaAndCentroid(points: readonly DiscPoint[]): { area: number; centroid: DiscPoint } {
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    twiceArea += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  return { area: Math.abs(twiceArea / 2), centroid: { x: cx / (3 * twiceArea), y: cy / (3 * twiceArea) } };
}

/** Ray-casting point-in-polygon test. */
function contains(points: readonly DiscPoint[], p: DiscPoint): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function litVertices(state: MoonDiscState): DiscPoint[] {
  const { litPath } = moonDiscPaths(state);
  if (litPath === null) {
    throw new Error(`expected a lit path at ${state.time}`);
  }
  return verticesOf(litPath);
}

function mareCentre(name: string): { latDeg: number; lonDeg: number } {
  const mare = MARIA.find((m) => m.name === name);
  if (mare === undefined) {
    throw new Error(`no mare named ${name}`);
  }
  return mare;
}

function synthetic(illuminatedFraction: number, brightLimbAngleDeg = 270): MoonDiscState {
  return {
    time: "2026-10-15T17:00:00.000Z",
    illuminatedFraction,
    waxing: true,
    band: "waxing-crescent",
    brightLimbAngleDeg,
    librationLatDeg: 0,
    librationLonDeg: 0,
  };
}

const CRISIUM = mareCentre("Mare Crisium");
const IMBRIUM = mareCentre("Mare Imbrium");

/** Polygon area tolerance: 48 segments per half-outline lose under 0.3% of the disc. */
const AREA_TOLERANCE = 0.01;

describe("moonDiscPaths on real engine states", () => {
  // 2026-10-15T17:00Z: waxing crescent, 23.5% lit. Not 2026-10-12 (4.7%), where Crisium is correctly still dark.
  const waxing = moonDiscState(new Date("2026-10-15T17:00:00Z"));
  // 2026-11-02T04:00Z: waning, just under last quarter.
  const waning = moonDiscState(new Date("2026-11-02T04:00:00Z"));

  it("draws a waxing crescent lit on the right (west in the sky, lunar east)", () => {
    expect(waxing.waxing).toBe(true);
    expect(waxing.illuminatedFraction).toBeGreaterThanOrEqual(0.23);
    expect(waxing.illuminatedFraction).toBeLessThanOrEqual(0.24);
    expect(areaAndCentroid(litVertices(waxing)).centroid.x).toBeGreaterThan(0);
  });

  it("puts Crisium's centre inside the waxing crescent's lit path, well clear of the terminator", () => {
    const crisium = projectSelenographic(
      CRISIUM.latDeg,
      CRISIUM.lonDeg,
      waxing.librationLatDeg,
      waxing.librationLonDeg,
    );
    expect(crisium.visible).toBe(true);
    expect(crisium.x).toBeGreaterThan(0);
    expect(contains(litVertices(waxing), crisium)).toBe(true);
    expect(litMargin(waxing, crisium)).toBeGreaterThan(0.25);
  });

  it("draws a waning Moon lit on the left", () => {
    expect(waning.waxing).toBe(false);
    expect(areaAndCentroid(litVertices(waning)).centroid.x).toBeLessThan(0);
  });

  it("puts Imbrium in the upper half", () => {
    const imbriumIndex = MARIA.findIndex((m) => m.name === "Mare Imbrium");
    for (const state of [waxing, waning]) {
      const centre = projectSelenographic(IMBRIUM.latDeg, IMBRIUM.lonDeg, state.librationLatDeg, state.librationLonDeg);
      expect(centre.y).toBeLessThan(0);
      const outline = verticesOf(moonDiscPaths(state).mariaPaths[imbriumIndex]);
      expect(areaAndCentroid(outline).centroid.y).toBeLessThan(0);
    }
  });

  it("lit path and the lit test agree away from the outline", () => {
    for (const state of [waxing, waning]) {
      const outline = litVertices(state);
      for (let gx = -0.95; gx <= 0.95; gx += 0.05) {
        for (let gy = -0.95; gy <= 0.95; gy += 0.05) {
          const p = { x: gx, y: gy };
          if (Math.hypot(gx, gy) > 0.97 || Math.abs(litMargin(state, p)) < 0.02) {
            continue;
          }
          expect(contains(outline, p)).toBe(isLit(state, p));
        }
      }
    }
  });

  it("draws one 24-point outline per mare, on or inside the disc, with four-decimal numbers", () => {
    const { litPath, mariaPaths } = moonDiscPaths(waxing);
    expect(mariaPaths).toHaveLength(MARIA.length);
    for (const path of [litPath ?? "", ...mariaPaths]) {
      for (const n of path.match(/-?[\d.]+/g) ?? []) {
        expect(n).toMatch(/^-?\d+\.\d{4}$/);
      }
    }
    for (const path of mariaPaths) {
      const points = verticesOf(path);
      expect(points).toHaveLength(24);
      for (const p of points) {
        expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(1 + 1e-4);
      }
    }
  });
});

describe("moonDiscPaths phase invariants", () => {
  it("returns no lit path at 0%", () => {
    expect(moonDiscPaths(synthetic(0)).litPath).toBeNull();
  });

  it("returns the full disc at 100%", () => {
    const points = verticesOf(moonDiscPaths(synthetic(1)).litPath ?? "");
    for (const p of points) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 3);
    }
    expect(Math.abs(areaAndCentroid(points).area - Math.PI)).toBeLessThan(AREA_TOLERANCE * Math.PI);
  });

  it("draws a straight terminator through the centre at 50%", () => {
    for (const angle of [270, 90, 33]) {
      const state = synthetic(0.5, angle);
      const bright = { x: -Math.sin((angle * Math.PI) / 180), y: -Math.cos((angle * Math.PI) / 180) };
      const points = verticesOf(moonDiscPaths(state).litPath ?? "");
      const inner = points.filter((p) => Math.hypot(p.x, p.y) < 0.99);
      expect(inner.length).toBeGreaterThan(10);
      for (const p of inner) {
        expect(Math.abs(p.x * bright.x + p.y * bright.y)).toBeLessThan(1e-3);
      }
      expect(Math.abs(areaAndCentroid(points).area - Math.PI / 2)).toBeLessThan(AREA_TOLERANCE * Math.PI);
    }
  });

  it("lights k of the disc's area", () => {
    for (const k of [0.05, 0.24, 0.5, 0.76, 0.97]) {
      const area = areaAndCentroid(verticesOf(moonDiscPaths(synthetic(k)).litPath ?? "")).area;
      expect(Math.abs(area / Math.PI - k)).toBeLessThan(AREA_TOLERANCE);
    }
  });

  it("points the bright limb to (−sin θ, −cos θ)", () => {
    for (const angle of [0, 90, 180, 270]) {
      const { centroid } = areaAndCentroid(verticesOf(moonDiscPaths(synthetic(0.2, angle)).litPath ?? ""));
      const theta = (angle * Math.PI) / 180;
      expect(centroid.x * -Math.sin(theta) + centroid.y * -Math.cos(theta)).toBeGreaterThan(0.5);
    }
  });
});

describe("projectSelenographic", () => {
  it("puts the sub-Earth point at the centre and lunar north up", () => {
    const centre = projectSelenographic(0, 0, 0, 0);
    expect(centre.visible).toBe(true);
    expect(Math.hypot(centre.x, centre.y)).toBeLessThan(1e-12);
    const north = projectSelenographic(80, 0, 0, 0);
    expect(north.y).toBeLessThan(-0.9);
    expect(projectSelenographic(0, 60, 0, 0).x).toBeGreaterThan(0.8);
  });

  it("pushes far-side points onto the limb", () => {
    const hidden = projectSelenographic(10, 120, 0, 0);
    expect(hidden.visible).toBe(false);
    expect(Math.hypot(hidden.x, hidden.y)).toBeCloseTo(1, 10);
    expect(hidden.x).toBeGreaterThan(0);
  });

  it("brings the east limb in when the libration in longitude is east", () => {
    const plain = projectSelenographic(17, 59.1, 0, 0);
    const librated = projectSelenographic(17, 59.1, 0, 7);
    expect(librated.x).toBeLessThan(plain.x);
  });
});
