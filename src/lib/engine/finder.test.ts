import { describe, expect, it } from "vitest";

import { DEEP_SKY, findDeepSky } from "@/lib/catalogue";
import { formatDesignation, loadFinderStars } from "@/lib/catalogue/finder-stars";
import type { FinderStar } from "@/lib/catalogue/finder-stars";
import { Rotation_EQJ_HOR } from "astronomy-engine";

import { finderChart, projectGnomonic } from "./finder";
import type { FinderChartData, FinderChartInput, FinderStarInput, UnitVector } from "./finder";
import { WARSAW } from "./fixtures";
import { FINDER_REFERENCE, KNOWN_DIVERGENCES } from "./fixtures/finder-reference";
import type { RouteStar } from "./fixtures/finder-reference";
import { observingNight } from "./night";
import { bestWindow, objectTrack } from "./objects";
import {
  FINDER_FIELD_DEG,
  FINDER_OVERHEAD_ALT_DEG,
  HOP_MAX_STEPS,
  HOP_MAX_STEP_FRACTION,
  HOP_STAR_MAX_MAG,
  START_STAR_CANDIDATES,
  darknessThresholdDegForBortle,
  nakedEyeLimitingMagForBortle,
  startStarMaxMagForBortle,
} from "./parameters";
import { darkWindow, observerFor } from "./sun";
import type { Site } from "./types";

/**
 * The finder chart's engine (finder-chart Phase 2). Synthetic skies are built around a target in the horizon frame
 * and converted to J2000 with the inverse of the same rotation the engine applies, so every position is exact; the
 * published hops and the 171-object coverage use the real star file (a test-only read, `purity.test.ts` skips tests).
 */

type Vec = [number, number, number];

const SITE = WARSAW;
const TIME = new Date("2026-10-15T20:00:00Z");
const ROT = Rotation_EQJ_HOR(TIME, observerFor(SITE)).rot;
const MIN_ALT = 15;
const STEP_MAX = FINDER_FIELD_DEG * HOP_MAX_STEP_FRACTION;
const STEP_MAX_CENTI = Math.round(STEP_MAX * 100);
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const dot = (a: readonly number[], b: readonly number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec): Vec => {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
};
const sep = (a: Vec, b: Vec): number => Math.atan2(Math.hypot(...cross(a, b)), dot(a, b)) * DEG;
const centi = (deg: number): number => Math.round(deg * 100);

/** A horizon-frame vector (x north, y west, z up) at an altitude and a compass azimuth. */
function hor(altDeg: number, azDeg: number): Vec {
  const alt = altDeg * RAD;
  const az = azDeg * RAD;
  return [Math.cos(alt) * Math.cos(az), -Math.cos(alt) * Math.sin(az), Math.sin(alt)];
}

/** The J2000 vector of a horizon vector: the inverse (transpose) of `toHorizon`'s rotation. */
function toJ2000(h: Vec): UnitVector {
  return [
    ROT[0][0] * h[0] + ROT[0][1] * h[1] + ROT[0][2] * h[2],
    ROT[1][0] * h[0] + ROT[1][1] * h[1] + ROT[1][2] * h[2],
    ROT[2][0] * h[0] + ROT[2][1] * h[1] + ROT[2][2] * h[2],
  ];
}

/** The horizon vector of a J2000 vector. */
function toHor(v: UnitVector): Vec {
  return [0, 1, 2].map((j) => ROT[0][j] * v[0] + ROT[1][j] * v[1] + ROT[2][j] * v[2]) as Vec;
}

/**
 * The point at (`x`, `y`) degrees on the tangent plane at `centre` (x to the right looking at it, y up; gnomonic, so
 * the plane distances are exact): used to lay a sky out around a target with the engine's own geometry.
 */
function at(centre: Vec, x: number, y: number): Vec {
  const right = unit(cross(centre, [0, 0, 1]));
  const up = unit(cross(right, centre));
  return unit([0, 1, 2].map((i) => centre[i] + (x * right[i] + y * up[i]) * RAD) as Vec);
}

interface Spec {
  x: number;
  y: number;
  mag: number;
  index?: number;
}

const CENTRE = hor(50, 180);

function skyOf(specs: readonly Spec[], centre: Vec = CENTRE): FinderStarInput[] {
  return specs.map((spec, i) => ({
    index: spec.index ?? i,
    mag: spec.mag,
    vector: toJ2000(at(centre, spec.x, spec.y)),
  }));
}

function chartOf(overrides: Partial<FinderChartInput> & { stars: readonly FinderStarInput[] }): FinderChartData {
  return finderChart({
    site: SITE,
    time: TIME,
    bortle: 3,
    minAltitudeDeg: MIN_ALT,
    target: { vector: toJ2000(CENTRE), magnitude: null, isPlanet: false, majorAxisArcmin: null },
    eyepieceFieldDeg: null,
    ...overrides,
  });
}

/** Every number in the data is finite. */
function allFinite(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(allFinite);
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).every(allFinite);
  }
  return true;
}

describe("finderChart: the hop", () => {
  it("accepts a step of exactly 5.6° and refuses one of 5.7°", () => {
    expect(chartOf({ stars: skyOf([{ x: 5.6, y: 0, mag: 3 }]) }).kind).toBe("hop");
    expect(chartOf({ stars: skyOf([{ x: 5.7, y: 0, mag: 3 }]) }).kind).toBe("direct");
  });

  it("only passes through stars within the start's distance plus one step of the target", () => {
    // The one chain from S to T leaves the circle of radius 8 + 5.6 around T at X2 and X3.
    const chain: Spec[] = [
      { x: 8, y: 0, mag: 3 },
      { x: 11.5, y: -3.5, mag: 6 },
      { x: 14, y: -8, mag: 6 },
      { x: 10, y: -11, mag: 6 },
      { x: 5, y: -10.5, mag: 6 },
      { x: 2, y: -6.5, mag: 6 },
      { x: 0, y: -2.5, mag: 6 },
    ];
    const stars = skyOf(chain);
    // Without the bound the chain is a seven-step route...
    expect(bruteForce(stars, 0, false)?.seq).toEqual([1, 2, 3, 4, 5, 6]);
    // ... and with it, two of its stars are out, so there is none: a direct line from the start.
    const chart = chartOf({ stars });
    expect(chart.kind).toBe("direct");
    expect(chart.start?.index).toBe(0);
    expect(chart.start?.distanceDeg).toBeCloseTo(8, 1);
    expect(chart.hops).toEqual([]);
    expect(chart.finalStepDeg).toBeNull();
    // Looking at the target from the start, the way is to the left.
    // (the overview's vertical is the one at its own centre, which leans a few degrees from the target's)
    expect(chart.directionDeg).toBeGreaterThan(260);
    expect(chart.directionDeg).toBeLessThan(280);
  });

  it(`gives up after ${HOP_MAX_STEPS} steps`, () => {
    // A chain of nine steps: 8 intermediates allowed means at most 9 steps... one more is too many.
    const make = (steps: number): Spec[] => [
      { x: steps * 5, y: 0, mag: 3 },
      ...Array.from({ length: steps - 1 }, (_, i) => ({ x: (steps - 1 - i) * 5, y: 0, mag: 6 })),
    ];
    expect(chartOf({ stars: skyOf(make(HOP_MAX_STEPS)) }).kind).toBe("hop");
    expect(chartOf({ stars: skyOf(make(HOP_MAX_STEPS + 1)) }).kind).toBe("direct");
  });

  it("tries only the nearest starting stars, then the next nearest when the first has no hop", () => {
    // The nearest star (index 0, 7° away) has no hop; the second (9° away) does.
    const chart = chartOf({
      stars: skyOf([
        { x: -7, y: 0, mag: 3 },
        { x: 9, y: 0, mag: 3 },
        { x: 4.5, y: 0.5, mag: 6 },
      ]),
    });
    expect(chart.kind).toBe("hop");
    expect(chart.start?.index).toBe(1);
    expect(chart.hops.map((h) => h.index)).toEqual([2]);

    // The 6th-nearest star is never tried: with 5 hop-less stars nearer, the chart is direct from the nearest.
    const nearer = Array.from({ length: START_STAR_CANDIDATES }, (_, i) => ({ x: -(7 + i * 0.5), y: 0, mag: 3 }));
    const sixth = chartOf({
      stars: skyOf([...nearer, { x: 16, y: 0, mag: 3 }, { x: 11, y: 0.4, mag: 6 }, { x: 5.5, y: 0.4, mag: 6 }]),
    });
    expect(sixth.kind).toBe("direct");
    expect(sixth.start?.index).toBe(0);
  });
});

describe("finderChart: the kinds and the starting limits", () => {
  it("never starts from a star fainter than the naked-eye limit, for every Bortle class", () => {
    for (let b = 1; b <= 9; b++) {
      expect(startStarMaxMagForBortle(b), `Bortle ${b}`).toBeLessThanOrEqual(nakedEyeLimitingMagForBortle(b));
    }
  });

  it("is no-start when no star meets the starting limit", () => {
    const chart = chartOf({ stars: skyOf([{ x: 2, y: 0, mag: 4.6 }]) });
    expect(chart.kind).toBe("no-start");
    expect(chart.start).toBeNull();
    expect(chart.hops).toEqual([]);
    expect(chart.overview).toBeNull();
    expect(chart.finder.stars).toHaveLength(1);
    expect(chartOf({ stars: [] }).kind).toBe("no-start");
  });

  it("never starts from a star fainter than the limit, and takes one exactly at it", () => {
    const stars = skyOf([
      { x: 2, y: 0, mag: 3.6 },
      { x: 9, y: 0, mag: 3.5 },
      { x: 4.5, y: 0, mag: 6 },
    ]);
    // Bortle 5: limit 3.5.
    const chart = chartOf({ stars, bortle: 5 });
    expect(chart.start?.index).toBe(1);
    expect(chart.start?.mag).toBeLessThanOrEqual(startStarMaxMagForBortle(5));
    // Bortle 8: limit 2.5, neither qualifies.
    expect(chartOf({ stars, bortle: 8 }).kind).toBe("no-start");
    // Bortle 3: limit 4.5 and the 3.6 star is the nearest.
    expect(chartOf({ stars, bortle: 3 }).start?.index).toBe(0);
  });

  it("never starts from or hops through a star below the minimum altitude", () => {
    const target = hor(18, 180);
    const below = hor(11, 180); // bright, 7° from the target, below the 15° minimum
    const above = hor(26, 180);
    const stars: FinderStarInput[] = [
      { index: 0, mag: 1, vector: toJ2000(below) },
      { index: 1, mag: 3, vector: toJ2000(above) },
    ];
    const chart = chartOf({
      stars,
      target: { vector: toJ2000(target), magnitude: null, isPlanet: false, majorAxisArcmin: null },
    });
    expect(chart.start?.index).toBe(1);
    expect(chart.start?.altDeg).toBeGreaterThanOrEqual(MIN_ALT);
    // A hop star below the minimum is skipped as well: the only link between start and target is below it.
    const onlyLink: FinderStarInput[] = [
      { index: 0, mag: 3, vector: toJ2000(hor(31, 180)) },
      { index: 1, mag: 5, vector: toJ2000(hor(12, 180)) },
    ];
    const noLink = chartOf({
      stars: onlyLink,
      target: { vector: toJ2000(target), magnitude: null, isPlanet: false, majorAxisArcmin: null },
    });
    expect(noLink.kind).toBe("direct");
    expect(noLink.hops).toEqual([]);
  });

  it("is naked-eye for a planet at least as bright as the starting limit, and not otherwise", () => {
    const planet = (magnitude: number | null, isPlanet = true) => ({
      vector: toJ2000(CENTRE),
      magnitude,
      isPlanet,
      majorAxisArcmin: null,
    });
    const stars = skyOf([{ x: 3, y: 0, mag: 3 }]);
    const bright = chartOf({ stars, bortle: 8, target: planet(-2.1) });
    expect(bright.kind).toBe("naked-eye");
    expect(bright.start).toBeNull();
    expect(bright.hops).toEqual([]);
    expect(bright.overview).toBeNull();
    expect(bright.finder.target).toEqual({ x: 0, y: 0 });
    // Exactly at the limit (2.5 at Bortle 8) counts; a tenth fainter does not.
    expect(chartOf({ stars, bortle: 8, target: planet(2.5) }).kind).toBe("naked-eye");
    expect(chartOf({ stars, bortle: 8, target: planet(2.6) }).kind).toBe("no-start");
    expect(chartOf({ stars, bortle: 3, target: planet(5) }).kind).toBe("hop");
    // A deep-sky object never serves as its own start, and a planet without a magnitude does not either.
    expect(chartOf({ stars, bortle: 8, target: planet(-2.1, false) }).kind).toBe("no-start");
    expect(chartOf({ stars, bortle: 3, target: planet(null) }).kind).toBe("hop");
  });
});

describe("finderChart: panels and circles", () => {
  const stars = skyOf([
    { x: 11, y: 0, mag: 3 },
    { x: 5.5, y: 0.5, mag: 6 },
    { x: 1, y: 1, mag: 7.0 },
    { x: -2, y: 2, mag: 7.45 },
    { x: -3, y: -3, mag: 7.6 },
    { x: 20, y: 20, mag: 5 },
  ]);

  it("draws the faintest stars only where the finder reaches: 7.45 at Bortle 3, not at Bortle 9", () => {
    const at3 = chartOf({ stars, bortle: 3 }).finder.stars.map((s) => s.index);
    const at9 = chartOf({ stars, bortle: 9 }).finder.stars.map((s) => s.index);
    expect(at3).toContain(3);
    expect(at9).not.toContain(3);
    expect(at9).toContain(2);
  });
});

describe("finderChart: orientation", () => {
  it("puts the higher of two stars on the panel's vertical at the smaller y, in both panels", () => {
    // Along the vertical through the target (constant azimuth), one star above and one below.
    const target = hor(50, 200);
    const high = hor(53, 200);
    const low = hor(47, 200);
    const stars: FinderStarInput[] = [
      { index: 0, mag: 3, vector: toJ2000(hor(50, 200 + 12)) },
      { index: 1, mag: 6, vector: toJ2000(high) },
      { index: 2, mag: 6, vector: toJ2000(low) },
    ];
    const chart = chartOf({
      stars,
      target: { vector: toJ2000(target), magnitude: null, isPlanet: false, majorAxisArcmin: null },
    });
    expect(chart.orientation).toBe("facing");
    for (const panel of [chart.finder, chart.overview]) {
      const upper = panel?.stars.find((s) => s.index === 1);
      const lower = panel?.stars.find((s) => s.index === 2);
      expect(upper).toBeDefined();
      expect(lower).toBeDefined();
      if (upper !== undefined && lower !== undefined) {
        expect(upper.y).toBeLessThan(lower.y);
      }
    }
    const finderUpper = chart.finder.stars.find((s) => s.index === 1);
    expect(Math.abs(finderUpper?.x ?? 1)).toBeLessThan(0.001);
  });

  it("is the naked-eye view: facing south, east is on the left", () => {
    const target = hor(50, 180);
    const east = hor(50, 175);
    const chart = chartOf({
      stars: [
        { index: 0, mag: 3, vector: toJ2000(hor(50, 185)) },
        { index: 1, mag: 6, vector: toJ2000(east) },
      ],
      target: { vector: toJ2000(target), magnitude: null, isPlanet: false, majorAxisArcmin: null },
    });
    const eastStar = chart.finder.stars.find((s) => s.index === 1);
    expect(eastStar?.x).toBeLessThan(0);
  });

  describe("overhead", () => {
    const withTarget = (altDeg: number, startAltDeg: number, azDeg = 180) =>
      chartOf({
        stars: [{ index: 0, mag: 3, vector: toJ2000(hor(startAltDeg, azDeg)) }],
        target: { vector: toJ2000(hor(altDeg, azDeg)), magnitude: null, isPlanet: false, majorAxisArcmin: null },
      });

    it("switches at 80°: a centre at 79.9° stays facing and one at 80.0° goes overhead", () => {
      // The start sits 3° lower, so the overview's centre stays below 80° with no zenith inside it.
      const below = withTarget(79.9, 76.9);
      expect(below.orientation).toBe("facing");
      expect(below.finder.zenith).toBeNull();
      const at80 = withTarget(FINDER_OVERHEAD_ALT_DEG, FINDER_OVERHEAD_ALT_DEG - 3);
      expect(at80.orientation).toBe("overhead");
      // Both centres are 10° or more from the zenith, which is outside both 10° panels: no cross, an edge arrow instead.
      expect(at80.finder.zenith).toBeNull();
      expect(at80.overview?.zenith).toBeNull();
      expect(at80.finder.zenithEdge).not.toBeNull();
      expect(at80.overview?.zenithEdge).not.toBeNull();
    });

    describe("the zenith's edge marker", () => {
      /** The bearing, degrees clockwise from up, of the zenith on a panel at `centre` with the pole up, by the engine's own projection. */
      const bearingOfZenith = (centre: Vec): number => {
        const p = projectGnomonic(centre, [0, 0, 1], toHor([0, 0, 1]));
        if (p === null) {
          throw new Error("the zenith should project for this case");
        }
        const bearing = Math.atan2(p.x, -p.y) * DEG;
        return bearing < 0 ? bearing + 360 : bearing;
      };
      /** The smallest difference between two bearings, degrees. */
      const apart = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

      it("sits on the rim toward the zenith: straight up for a target on the meridian south of it", () => {
        const chart = withTarget(80, 77);
        expect(chart.orientation).toBe("overhead");
        const half = chart.finder.fieldDeg / 2;
        expect(chart.finder.zenith).toBeNull();
        // The zenith lies between the target and the pole on the meridian: up, to within the precession's tenth of a degree.
        expect(chart.finder.zenithEdge?.y).toBeCloseTo(-half, 1);
        expect(Math.abs(chart.finder.zenithEdge?.x ?? 1)).toBeLessThan(0.1);
        expect(apart(chart.finder.zenithEdge?.angleDeg ?? 90, 0)).toBeLessThan(1.5);
        const overviewHalf = (chart.overview?.fieldDeg ?? 0) / 2;
        expect(chart.overview?.zenithEdge?.y).toBeCloseTo(-overviewHalf, 1);
      });

      it("lies on the square's edge at the zenith's bearing for every compass side of the target", () => {
        for (const az of [0, 45, 90, 135, 180, 225, 270, 315]) {
          const chart = withTarget(83, 80, az);
          expect(chart.orientation, String(az)).toBe("overhead");
          expect(chart.finder.zenith, String(az)).toBeNull();
          const edge = chart.finder.zenithEdge;
          expect(edge, String(az)).not.toBeNull();
          if (edge === null) {
            continue;
          }
          const half = chart.finder.fieldDeg / 2;
          // On the rim: the larger coordinate is the half-side, the other is inside it.
          expect(Math.max(Math.abs(edge.x), Math.abs(edge.y)), String(az)).toBeCloseTo(half, 2);
          // Pointing at the zenith: the edge point and the angle agree, and both match the engine's projection of the zenith.
          expect(apart((Math.atan2(edge.x, -edge.y) * DEG + 360) % 360, edge.angleDeg), String(az)).toBeLessThan(0.1);
          expect(apart(edge.angleDeg, bearingOfZenith(hor(83, az))), String(az)).toBeLessThan(0.2);
        }
      });

      it("falls back to the great-circle bearing when the zenith is 85° or more from the panel's centre", () => {
        // A start at 20° in the north and a target 4° up in the south: the overview is centred about 82° up (so overhead,
        // with the zenith inside it), while the target's panel is 86° from the zenith, where the projection gives up.
        const chart = chartOf({
          stars: [{ index: 0, mag: 3, vector: toJ2000(hor(20, 0)) }],
          target: { vector: toJ2000(hor(4, 180)), magnitude: null, isPlanet: false, majorAxisArcmin: null },
        });
        expect(chart.orientation).toBe("overhead");
        expect(projectGnomonic(hor(4, 180), [0, 0, 1], toHor([0, 0, 1]))).toBeNull();
        expect(chart.finder.zenith).toBeNull();
        expect(chart.finder.zenithEdge?.y).toBeCloseTo(-chart.finder.fieldDeg / 2, 1);
        expect(apart(chart.finder.zenithEdge?.angleDeg ?? 90, 0)).toBeLessThan(2);
        expect(allFinite(chart)).toBe(true);
      });

      it("is set only where the zenith is outside: inside gives the cross and no edge, facing gives neither", () => {
        const zenithTarget = chartOf({
          stars: [{ index: 0, mag: 3, vector: toJ2000(hor(86, 180)) }],
          target: { vector: toJ2000([0, 0, 1]), magnitude: null, isPlanet: false, majorAxisArcmin: null },
        });
        expect(zenithTarget.orientation).toBe("overhead");
        expect(zenithTarget.finder.zenith).toEqual({ x: 0, y: 0 });
        expect(zenithTarget.finder.zenithEdge).toBeNull();
        expect(zenithTarget.overview?.zenithEdge ?? null).toBeNull();
        const wide = chartOf({
          stars: [{ index: 0, mag: 3, vector: toJ2000(hor(30, 180)) }],
          target: { vector: toJ2000(hor(60, 0)), magnitude: null, isPlanet: false, majorAxisArcmin: null },
        });
        // The very wide overview holds the zenith; the finder panel, 30° away, gets the edge arrow instead.
        expect(wide.overview?.zenith).not.toBeNull();
        expect(wide.overview?.zenithEdge).toBeNull();
        expect(wide.finder.zenith).toBeNull();
        expect(wide.finder.zenithEdge).not.toBeNull();
        const facing = withTarget(60, 57);
        expect(facing.orientation).toBe("facing");
        for (const panel of [facing.finder, facing.overview]) {
          expect(panel?.zenith).toBeNull();
          expect(panel?.zenithEdge).toBeNull();
        }
      });
    });

    it("goes overhead when the zenith falls inside a panel although every centre is below 80°", () => {
      // Start 60° up in the south, target 60° up in the north: the overview's centre is 75° up, and the zenith is 15°
      // from it, inside the very wide overview.
      const chart = chartOf({
        stars: [{ index: 0, mag: 3, vector: toJ2000(hor(30, 180)) }],
        target: { vector: toJ2000(hor(60, 0)), magnitude: null, isPlanet: false, majorAxisArcmin: null },
      });
      expect(chart.kind).toBe("direct");
      expect(chart.facing.altDeg).toBeCloseTo(60, 1);
      expect(chart.orientation).toBe("overhead");
      expect(chart.overview?.zenith).not.toBeNull();
      expect(chart.finder.zenith).toBeNull(); // 30° from the finder panel's centre
      // Rounded values carry no float noise (0.1 × 222 would be 22.200000000000003).
      for (const value of [chart.overview?.fieldDeg ?? 0, chart.directionDeg ?? 0]) {
        expect(Number(value.toFixed(1))).toBe(value);
      }
    });

    it("points up to the south celestial pole at a southern site", () => {
      const site: Site = { latitudeDeg: -33.9, longitudeDeg: 18.4, elevationM: 10, timeZone: "Africa/Johannesburg" };
      const { rot } = Rotation_EQJ_HOR(TIME, observerFor(site));
      const zenith: UnitVector = [rot[0][2], rot[1][2], rot[2][2]];
      const southPole: Vec = [0, 0, -1];
      const along = dot(zenith, southPole);
      const perpendicular = unit([0, 1, 2].map((i) => southPole[i] - along * zenith[i]) as Vec);
      const towardPole = unit([0, 1, 2].map((i) => zenith[i] + perpendicular[i] * 0.05) as Vec);
      const chart = finderChart({
        site,
        time: TIME,
        bortle: 3,
        minAltitudeDeg: MIN_ALT,
        target: { vector: zenith, magnitude: null, isPlanet: false, majorAxisArcmin: null },
        stars: [{ index: 1, mag: 6, vector: towardPole }],
        eyepieceFieldDeg: null,
      });
      expect(chart.orientation).toBe("overhead");
      const star = chart.finder.stars.find((s) => s.index === 1);
      expect(star?.y).toBeLessThan(-2);
      expect(Math.abs(star?.x ?? 1)).toBeLessThan(0.05);
    });

    it("points up to the visible celestial pole in both panels, and the same way for each", () => {
      const target = toJ2000([0, 0, 1]);
      const pole: Vec = [0, 0, 1];
      // A star toward the north celestial pole from the target, in J2000.
      const towardPole = (vector: UnitVector): UnitVector => {
        const along = dot(vector, pole);
        const perpendicular = unit([0, 1, 2].map((i) => pole[i] - along * vector[i]) as Vec);
        return unit([0, 1, 2].map((i) => vector[i] + perpendicular[i] * 0.05) as Vec);
      };
      const chart = chartOf({
        stars: [
          { index: 0, mag: 3, vector: toJ2000(hor(88, 90)) },
          { index: 1, mag: 6, vector: towardPole(target) },
        ],
        target: { vector: target, magnitude: null, isPlanet: false, majorAxisArcmin: null },
      });
      expect(chart.orientation).toBe("overhead");
      const star = chart.finder.stars.find((s) => s.index === 1);
      expect(star?.y).toBeLessThan(-2);
      expect(Math.abs(star?.x ?? 1)).toBeLessThan(0.05);
    });
  });
});

describe("finderChart: random skies against an exhaustive search", () => {
  function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it("agrees with a brute-force enumeration of every simple route on 150 skies", () => {
    let withRoute = 0;
    let withHops = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const random = mulberry32(seed);
      const specs: Spec[] = [];
      const angle = random() * 2 * Math.PI;
      const distance = 7 + random() * 8;
      specs.push({ x: distance * Math.cos(angle), y: distance * Math.sin(angle), mag: 3, index: 500 });
      // Every third sky is a corridor of six stars along the way from the start to the target, with only four
      // magnitudes: equal magnitude sums are then common, and the oracle's later tie-breaks (total length, index
      // sequence) decide routes too (test-suite-diet: this replaces the cost tie-break cases).
      const corridor = seed % 3 === 0;
      for (let i = 0; i < (corridor ? 6 : 18); i++) {
        const first = random();
        const second = random();
        const along = distance * first;
        const across = (second - 0.5) * 5;
        specs.push({
          x: corridor ? along * Math.cos(angle) - across * Math.sin(angle) : (first - 0.5) * 30,
          y: corridor ? along * Math.sin(angle) + across * Math.cos(angle) : (second - 0.5) * 30,
          mag: corridor ? 5 + Math.floor(random() * 4) / 2 : 5 + Math.floor(random() * 16) / 10,
          index: 100 + Math.floor(random() * 300) + i * 1000,
        });
      }
      if (corridor) {
        // A mirror twin (same magnitude, a larger index) of the first two corridor stars, across the line from the
        // start to the target: a route through the twin costs exactly what the route through the star does.
        for (const spec of specs.slice(1, 3)) {
          const along = spec.x * Math.cos(angle) + spec.y * Math.sin(angle);
          specs.push({
            x: 2 * along * Math.cos(angle) - spec.x,
            y: 2 * along * Math.sin(angle) - spec.y,
            mag: spec.mag,
            index: (spec.index ?? 0) + 7,
          });
        }
      }
      const stars = skyOf(specs);
      const expected = bruteForce(stars, 0, true);
      const chart = chartOf({ stars });
      if (expected === null) {
        expect(chart.kind, `seed ${seed}`).toBe("direct");
        continue;
      }
      withRoute++;
      expect(chart.kind, `seed ${seed}`).toBe("hop");
      expect(chart.start?.index).toBe(500);
      expect(
        chart.hops.map((h) => h.index),
        `seed ${seed}`,
      ).toEqual(expected.seq);
      if (expected.seq.length > 0) {
        withHops++;
      }
    }
    // The skies are dense enough to make the comparison meaningful.
    expect(withRoute).toBeGreaterThan(30);
    expect(withHops).toBeGreaterThan(20);
  });
});

/**
 * Exhaustive search over simple routes from star `startPos` (a position in `stars`) to the target at `CENTRE`: steps of at
 * most 5.6° (hundredths), intermediate stars at most 6.5 and at or above the minimum altitude, and, when `bounded`, no
 * farther from the target than the start plus one step, at most `HOP_MAX_STEPS` steps. The cheapest by (steps, sum of
 * magnitude x 10, sum of steps in hundredths, index sequence).
 */
function bruteForce(
  stars: readonly FinderStarInput[],
  startPos: number,
  bounded: boolean,
): { seq: number[]; mag: number; len: number } | null {
  const target = CENTRE;
  const points = stars.map((s) => toHor(s.vector));
  const effective = bounded ? centi(sep(points[startPos], target)) + STEP_MAX_CENTI : Number.POSITIVE_INFINITY;
  const usable = (pos: number): boolean =>
    pos !== startPos &&
    stars[pos].mag <= HOP_STAR_MAX_MAG &&
    Math.asin(points[pos][2]) * DEG >= MIN_ALT &&
    centi(sep(points[pos], target)) <= effective;
  let best: { seq: number[]; mag: number; len: number; steps: number } | null = null;
  const consider = (candidate: { seq: number[]; mag: number; len: number; steps: number }): void => {
    if (best === null) {
      best = candidate;
      return;
    }
    const keys: [number, number][] = [
      [candidate.steps, best.steps],
      [candidate.mag, best.mag],
      [candidate.len, best.len],
    ];
    for (const [a, b] of keys) {
      if (a !== b) {
        if (a < b) {
          best = candidate;
        }
        return;
      }
    }
    for (let i = 0; i < candidate.seq.length; i++) {
      if (candidate.seq[i] !== best.seq[i]) {
        if (candidate.seq[i] < best.seq[i]) {
          best = candidate;
        }
        return;
      }
    }
  };
  const walk = (from: number, seq: number[], mag: number, len: number, visited: Set<number>): void => {
    const steps = seq.length + 1;
    const toTarget = centi(sep(points[from], target));
    if (toTarget <= STEP_MAX_CENTI) {
      consider({ seq: seq.map((pos) => stars[pos].index), mag, len: len + toTarget, steps });
    }
    if (steps >= HOP_MAX_STEPS) {
      return;
    }
    stars.forEach((star, pos) => {
      if (visited.has(pos) || !usable(pos)) {
        return;
      }
      const step = centi(sep(points[from], points[pos]));
      if (step > STEP_MAX_CENTI) {
        return;
      }
      visited.add(pos);
      walk(pos, [...seq, pos], mag + Math.round(star.mag * 10), len + step, visited);
      visited.delete(pos);
    });
  };
  walk(startPos, [], 0, 0, new Set([startPos]));
  return best;
}

describe("published hops (D-11)", () => {
  const matches = (star: FinderStar, route: RouteStar): boolean => {
    const d = star.designation;
    if (d?.con !== route.con) {
      return false;
    }
    return route.bayer !== undefined ? d.bayer === route.bayer : d.flamsteed === route.flamsteed;
  };

  it.each(FINDER_REFERENCE.map((r) => [r.id, r] as const))(
    "%s: starts from a route star at its band, reaches the target and takes no step over 5.6°",
    async (_id, reference) => {
      const stars = await loadFinderStars();
      const object = findDeepSky(reference.id);
      expect(object, reference.id).toBeDefined();
      if (object === undefined) {
        return;
      }
      const vector = equatorialVector(object.raHours, object.decDeg);
      const input: FinderChartInput = {
        site: SITE,
        time: new Date(reference.time),
        bortle: reference.bortle,
        minAltitudeDeg: MIN_ALT,
        target: { vector, magnitude: object.vMag, isPlanet: false, majorAxisArcmin: object.majorAxisArcmin },
        stars,
        eyepieceFieldDeg: null,
      };
      const chart = finderChart(input);

      // Every route star is in the star file, once.
      const routeIndices = new Set<number>();
      for (const route of reference.routeStars) {
        const found = stars.filter((s) => matches(s, route));
        expect(found.length, `${reference.id}: ${route.label} in the star file`).toBeGreaterThanOrEqual(1);
        found.forEach((s) => routeIndices.add(s.index));
      }

      expect(chart.kind).toBe("hop");
      expect(chart.facing.altDeg).toBeGreaterThan(55);
      expect(chart.orientation).toBe("facing");
      const startIndex = chart.start?.index ?? -1;
      expect(routeIndices.has(startIndex), `${reference.id}: start ${designation(stars, startIndex)}`).toBe(true);

      // The band is the one that makes it so: the nearest qualifying star (computed apart from the engine).
      const limit = startStarMaxMagForBortle(reference.bortle);
      const rot = Rotation_EQJ_HOR(input.time, observerFor(SITE)).rot;
      const targetH = unit(horizonOf(rot, vector));
      const nearest = stars
        .filter((s) => s.mag <= limit && Math.asin(horizonOf(rot, s.vector)[2]) * DEG >= MIN_ALT)
        .map((s) => ({ s, d: centi(sep(unit(horizonOf(rot, s.vector)), targetH)) }))
        .sort((a, b) => a.d - b.d || a.s.mag - b.s.mag || a.s.index - b.s.index)[0];
      expect(routeIndices.has(nearest.s.index), `${reference.id}: nearest qualifying star`).toBe(true);
      expect(nearest.s.index).toBe(startIndex);

      // The path reaches the target, every step within the finder's field.
      const steps = [...chart.hops.map((h) => h.stepDeg), chart.finalStepDeg ?? Number.POSITIVE_INFINITY];
      for (const step of steps) {
        expect(step).toBeLessThanOrEqual(STEP_MAX);
      }
      expect(chart.overview?.path).toHaveLength(chart.hops.length + 2);
      expect(chart.overview?.path.at(-1)).toEqual(chart.overview?.target);
      expect(allFinite(chart)).toBe(true);
    },
  );

  it("names every source and band, and lists no divergence it has not explained", () => {
    for (const reference of FINDER_REFERENCE) {
      expect(reference.source.url.startsWith("https://")).toBe(true);
      expect(reference.source.quote.length).toBeGreaterThan(20);
      expect(reference.bandReason.length).toBeGreaterThan(20);
      expect([3, 5, 8]).toContain(reference.bortle);
    }
    for (const divergence of KNOWN_DIVERGENCES) {
      expect(divergence.computed.length).toBeGreaterThan(0);
    }
  });

  it("prints the computed starts and hops at each band (opt-in, FINDER_REFERENCE_PRINT=1)", async () => {
    if (process.env.FINDER_REFERENCE_PRINT !== "1") {
      return;
    }
    const stars = await loadFinderStars();
    const lines: string[] = [];
    for (const reference of FINDER_REFERENCE) {
      const object = findDeepSky(reference.id);
      if (object === undefined) {
        continue;
      }
      for (const bortle of [3, 5, 8]) {
        const chart = finderChart({
          site: SITE,
          time: new Date(reference.time),
          bortle,
          minAltitudeDeg: MIN_ALT,
          target: {
            vector: equatorialVector(object.raHours, object.decDeg),
            magnitude: object.vMag,
            isPlanet: false,
            majorAxisArcmin: object.majorAxisArcmin,
          },
          stars,
          eyepieceFieldDeg: null,
        });
        const route = chart.hops.map((h) => `${designation(stars, h.index)} (${h.stepDeg}°)`).join(" > ");
        lines.push(
          `${reference.id} Bortle ${bortle}${bortle === reference.bortle ? " *" : ""}: ${chart.kind} from ${chart.start === null ? "-" : designation(stars, chart.start.index)} (${chart.start?.distanceDeg}°)${route === "" ? "" : ` via ${route}`} -> target (${chart.finalStepDeg}°)`,
        );
      }
    }
    // eslint-disable-next-line no-console -- opt-in recording aid (FINDER_REFERENCE_PRINT=1); fixed test nights, no user site.
    console.log(`finder reference routes\n${lines.join("\n")}`);
  });
});

function equatorialVector(raHours: number, decDeg: number): UnitVector {
  const ra = raHours * 15 * RAD;
  const dec = decDeg * RAD;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

function horizonOf(rot: readonly (readonly number[])[], v: UnitVector): Vec {
  return [0, 1, 2].map((j) => rot[0][j] * v[0] + rot[1][j] * v[1] + rot[2][j] * v[2]) as Vec;
}

function designation(stars: readonly FinderStar[], index: number): string {
  const star = stars.at(index);
  return star === undefined ? `#${index}` : (formatDesignation(star.designation, "en") ?? `#${index} (${star.mag})`);
}

describe("coverage over the catalogue (D-11)", () => {
  // Warsaw, 52° N, on the winter calibration night, the one with the most objects up (test-suite-diet: the April,
  // July and October nights added no new class of case and tripled the run time).
  const NIGHTS = ["2026-01-15"] as const;
  const BORTLES = [3, 5, 8] as const;
  /** Measured on the first run: every Bortle 3 object-night was a hop, a share of 1.0; the gate is 3 percentage points below. */
  const HOP_SHARE_GATE_BORTLE_3 = 0.97;

  it("gives every object above the minimum altitude at its best time one of the four kinds, and enough hops at Bortle 3", async () => {
    const stars = await loadFinderStars();
    const counts = new Map<number, Record<string, number>>();
    for (const bortle of BORTLES) {
      counts.set(bortle, { hop: 0, direct: 0, "naked-eye": 0, "no-start": 0, skipped: 0 });
    }
    const started = Date.now();
    for (const bortle of BORTLES) {
      const tally = counts.get(bortle);
      if (tally === undefined) {
        throw new Error("unreachable");
      }
      for (const date of NIGHTS) {
        const dark = darkWindow(SITE, observingNight(date, SITE.timeZone), darknessThresholdDegForBortle(bortle));
        if (dark.kind !== "window") {
          continue;
        }
        for (const object of DEEP_SKY) {
          const window = bestWindow(
            objectTrack(SITE, { start: dark.start, end: dark.end }, { raHours: object.raHours, decDeg: object.decDeg }),
            MIN_ALT,
          );
          if (window === null) {
            tally.skipped++;
            continue;
          }
          expect(window.peak.altitudeDeg).toBeGreaterThanOrEqual(MIN_ALT);
          const chart = finderChart({
            site: SITE,
            time: window.peak.time,
            bortle,
            minAltitudeDeg: MIN_ALT,
            target: {
              vector: equatorialVector(object.raHours, object.decDeg),
              magnitude: object.vMag,
              isPlanet: false,
              majorAxisArcmin: object.majorAxisArcmin,
            },
            stars,
            eyepieceFieldDeg: 1.7,
          });
          expect(["hop", "direct", "naked-eye", "no-start"], `${object.id} ${date} B${bortle}`).toContain(chart.kind);
          expect(chart.kind).not.toBe("naked-eye"); // a deep-sky object is never its own start
          tally[chart.kind]++;
          if (chart.start !== null) {
            expect(chart.start.mag).toBeLessThanOrEqual(startStarMaxMagForBortle(bortle));
            expect(chart.start.altDeg).toBeGreaterThanOrEqual(MIN_ALT - 0.005);
          }
          if (chart.kind === "hop") {
            expect(chart.hops.length).toBeLessThan(HOP_MAX_STEPS);
            for (const step of [...chart.hops.map((h) => h.stepDeg), chart.finalStepDeg ?? 0]) {
              expect(step).toBeLessThanOrEqual(STEP_MAX);
            }
          }
          expect(allFinite(chart)).toBe(true);
        }
      }
    }
    const share = (bortle: number): number => {
      const t = counts.get(bortle);
      const total = t === undefined ? 0 : t.hop + t.direct + t["naked-eye"] + t["no-start"];
      return total === 0 ? 0 : (t?.hop ?? 0) / total;
    };
    if (process.env.FINDER_COVERAGE_PRINT === "1") {
      // eslint-disable-next-line no-console -- opt-in recording aid (FINDER_COVERAGE_PRINT=1); fixed test nights, no user site.
      console.log(
        `finder coverage ${JSON.stringify(Object.fromEntries(counts))} hop share ${BORTLES.map((b) => `B${b} ${share(b).toFixed(4)}`).join(", ")} in ${Date.now() - started} ms`,
      );
    }
    const bortle3 = counts.get(3);
    const objectNights3 =
      bortle3 === undefined ? 0 : bortle3.hop + bortle3.direct + bortle3["naked-eye"] + bortle3["no-start"];
    expect(objectNights3, "Bortle 3 object-nights charted (never an empty sample)").toBeGreaterThan(100);
    expect(share(3)).toBeGreaterThanOrEqual(HOP_SHARE_GATE_BORTLE_3);
  }, 120_000);
});
