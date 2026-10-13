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
  FINDER_PANEL_FIELD_DEG,
  HOP_MAX_STEPS,
  HOP_MAX_STEP_FRACTION,
  HOP_STAR_MAX_MAG,
  REFLEX_RING_DEG,
  START_STAR_CANDIDATES,
  darknessThresholdDegForBortle,
  finderLimitingMagForBortle,
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

describe("parameters", () => {
  it("never starts from a star fainter than the naked-eye limit, for every Bortle class", () => {
    for (let b = 1; b <= 9; b++) {
      expect(startStarMaxMagForBortle(b)).toBeLessThanOrEqual(nakedEyeLimitingMagForBortle(b));
    }
  });

  it("gives the three starting bands and a finder depth of 7.2 to 7.5", () => {
    expect([1, 4, 5, 6, 7, 9].map(startStarMaxMagForBortle)).toEqual([4.5, 4.5, 3.5, 3.5, 2.5, 2.5]);
    for (let b = 1; b <= 9; b++) {
      expect(finderLimitingMagForBortle(b)).toBeGreaterThanOrEqual(7.15);
      expect(finderLimitingMagForBortle(b)).toBeLessThanOrEqual(7.5);
    }
    expect(finderLimitingMagForBortle(1)).toBe(7.5);
    expect(() => startStarMaxMagForBortle(0)).toThrow(RangeError);
  });
});

describe("projectGnomonic", () => {
  it("puts the centre at the origin, a higher point at a smaller y and a point to the right at a larger x", () => {
    const centre = hor(40, 90);
    const up: Vec = [0, 0, 1];
    const origin = projectGnomonic(centre, centre, up);
    expect(origin?.x).toBeCloseTo(0, 9);
    expect(origin?.y).toBeCloseTo(0, 9);
    const above = projectGnomonic(centre, at(centre, 0, 3), up);
    expect(above?.x).toBeCloseTo(0, 9);
    expect(above?.y).toBeCloseTo(-3, 9);
    // Looking east (az 90), the right-hand side is south.
    const south = projectGnomonic(centre, hor(40, 100), up);
    expect(south?.x).toBeGreaterThan(0);
  });

  it("returns null from 85° on and a finite point for a parallel up", () => {
    expect(projectGnomonic([0, 0, 1], [0, 0, -1], [0, 1, 0])).toBeNull();
    expect(allFinite(projectGnomonic([0, 0, 1], [Math.sin(2 * RAD), 0, Math.cos(2 * RAD)], [0, 0, 1]))).toBe(true);
  });
});

describe("finderChart: the hop", () => {
  it("starts from a star one step away with no intermediate hops", () => {
    const chart = chartOf({ stars: skyOf([{ x: 4, y: 0, mag: 3 }]) });
    expect(chart.kind).toBe("hop");
    expect(chart.hops).toEqual([]);
    expect(chart.start).toMatchObject({ index: 0, mag: 3 });
    expect(chart.start?.distanceDeg).toBeCloseTo(4, 1);
    expect(chart.finalStepDeg).toBeCloseTo(4, 1);
    expect(chart.overview?.path).toHaveLength(2);
  });

  it("hops through an intermediate star", () => {
    const chart = chartOf({
      stars: skyOf([
        { x: 11, y: 0, mag: 3 },
        { x: 5.5, y: 0.5, mag: 6 },
      ]),
    });
    expect(chart.kind).toBe("hop");
    expect(chart.start?.index).toBe(0);
    expect(chart.hops.map((h) => h.index)).toEqual([1]);
    expect(chart.hops[0].stepDeg).toBeLessThanOrEqual(5.6);
    expect(chart.finalStepDeg).toBeLessThanOrEqual(5.6);
    expect(chart.overview?.path).toHaveLength(3);
    expect(chart.finder.path).toHaveLength(2);
  });

  it("accepts a step of exactly 5.6° and refuses one of 5.7°", () => {
    expect(chartOf({ stars: skyOf([{ x: 5.6, y: 0, mag: 3 }]) }).kind).toBe("hop");
    expect(chartOf({ stars: skyOf([{ x: 5.7, y: 0, mag: 3 }]) }).kind).toBe("direct");
  });

  describe("cost tie-breaks", () => {
    // Start S at 11°; routes go S -> mid -> T. Index 0 is always the start.
    const start: Spec = { x: 11, y: 0, mag: 3 };

    it("1. fewest steps first: a faint star on a two-step route beats a bright three-step route", () => {
      const chart = chartOf({
        stars: skyOf([
          start,
          { x: 5.5, y: 0.3, mag: 6.4 }, // faint, one hop
          { x: 8.2, y: 3.3, mag: 5.0 }, // bright pair, two hops
          { x: 3, y: 4.5, mag: 5.0 },
        ]),
      });
      expect(chart.hops.map((h) => h.index)).toEqual([1]);
    });

    it("2. then the brightest intermediate stars (smallest sum of magnitude x 10), before length", () => {
      const chart = chartOf({
        stars: skyOf([
          start,
          { x: 5.5, y: 0, mag: 6.0 }, // the shortest route, but fainter
          { x: 5.5, y: 1.0, mag: 5.0 }, // longer steps, brighter
        ]),
      });
      expect(chart.hops.map((h) => h.index)).toEqual([2]);
    });

    it("3. then the shorter total of steps", () => {
      const chart = chartOf({
        stars: skyOf([
          start,
          { x: 5.5, y: 1.0, mag: 5.5 }, // longer
          { x: 5.5, y: 0.4, mag: 5.5 }, // shorter, same magnitude
        ]),
      });
      expect(chart.hops.map((h) => h.index)).toEqual([2]);
    });

    it("4. then the smaller index sequence, whatever the order of the list", () => {
      const stars = skyOf([start, { x: 5.5, y: 1, mag: 5.5, index: 40 }, { x: 5.5, y: -1, mag: 5.5, index: 7 }]);
      expect(chartOf({ stars }).hops.map((h) => h.index)).toEqual([7]);
      expect(chartOf({ stars: [...stars].reverse() }).hops.map((h) => h.index)).toEqual([7]);
    });

    it("keeps a faint prefix of a short route alive against a bright prefix that needs more steps", () => {
      // S -> F (faint) -> T is two steps; S -> B1 (bright) -> B2 (bright) -> T is three. F must survive the brighter
      // prefixes the search also sees at the same star.
      const chart = chartOf({
        stars: skyOf([start, { x: 5.5, y: 0, mag: 6.5 }, { x: 8, y: 4.5, mag: 4.6 }, { x: 2.5, y: 4.5, mag: 4.6 }]),
      });
      expect(chart.hops.map((h) => h.index)).toEqual([1]);
    });

    it("minimises the cost, not the greedy choice: a bright first hop that forces a faint second one loses", () => {
      // Two 3-step routes. Route A: bright first star (4.8) then a faint one (6.4); route B: two middling stars
      // (5.5 + 5.5). 48 + 64 = 112 > 55 + 55 = 110, so B wins although A's first star is brighter.
      const chart = chartOf({
        stars: skyOf([
          { x: 14, y: 0, mag: 3 },
          { x: 9, y: 2, mag: 4.8 },
          { x: 4.5, y: 2.4, mag: 6.4 },
          { x: 9.2, y: -2.5, mag: 5.5 },
          { x: 4.6, y: -2.5, mag: 5.5 },
        ]),
      });
      expect(chart.hops.map((h) => h.index)).toEqual([3, 4]);
    });
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

  it("breaks a distance tie by magnitude, then index", () => {
    const chart = chartOf({
      stars: skyOf([
        { x: 4, y: 0, mag: 4.0, index: 9 },
        { x: -4, y: 0, mag: 3.0, index: 5 },
      ]),
    });
    expect(chart.start?.index).toBe(5);
    const byIndex = chartOf({
      stars: skyOf([
        { x: 4, y: 0, mag: 3.0, index: 9 },
        { x: -4, y: 0, mag: 3.0, index: 5 },
      ]),
    });
    expect(byIndex.start?.index).toBe(5);
  });
});

describe("finderChart: the kinds and the starting limits", () => {
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

  it("draws the finder panel around the target with the stars to the finder's depth and the circles", () => {
    const chart = chartOf({ stars, eyepieceFieldDeg: 1.7, bortle: 3 });
    expect(chart.finder.fieldDeg).toBe(FINDER_PANEL_FIELD_DEG);
    expect(chart.finder.target).toEqual({ x: 0, y: 0 });
    const shown = chart.finder.stars.map((s) => s.index);
    expect(shown).toContain(2);
    expect(shown).not.toContain(4); // 7.6 is fainter than any finder depth
    expect(shown).not.toContain(5); // outside the square
    const half = FINDER_PANEL_FIELD_DEG / 2;
    for (const s of chart.finder.stars) {
      expect(Math.abs(s.x)).toBeLessThanOrEqual(half);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(half);
      expect(s.mag).toBeLessThanOrEqual(finderLimitingMagForBortle(3));
    }
    expect(chart.finder.circles.map((c) => c.kind)).toEqual([
      "finder",
      ...REFLEX_RING_DEG.map(() => "reflex"),
      "eyepiece",
    ]);
    expect(chart.finder.circles[0].r).toBeCloseTo(Math.tan((FINDER_FIELD_DEG / 2) * RAD) * DEG, 3);
    expect(chart.finder.circles.at(-1)?.r).toBeCloseTo(Math.tan(0.85 * RAD) * DEG, 3);
    expect(chartOf({ stars }).finder.circles.map((c) => c.kind)).not.toContain("eyepiece");
  });

  it("draws the faintest stars only where the finder reaches: 7.45 at Bortle 3, not at Bortle 9", () => {
    const at3 = chartOf({ stars, bortle: 3 }).finder.stars.map((s) => s.index);
    const at9 = chartOf({ stars, bortle: 9 }).finder.stars.map((s) => s.index);
    expect(at3).toContain(3);
    expect(at9).not.toContain(3);
    expect(at9).toContain(2);
  });

  it("draws the overview from the start to the target with the hop stars, to the hop depth only", () => {
    const chart = chartOf({ stars });
    const overview = chart.overview;
    expect(overview).not.toBeNull();
    expect(overview?.path).toHaveLength(3);
    expect(overview?.stars.every((s) => s.mag <= HOP_STAR_MAX_MAG)).toBe(true);
    const shown = overview?.stars.map((s) => s.index) ?? [];
    expect(shown).toEqual(expect.arrayContaining([0, 1]));
    const target = overview?.target;
    expect(overview?.path.at(-1)).toEqual(target);
    // The panel is wide enough for the route.
    const half = (overview?.fieldDeg ?? 0) / 2;
    for (const p of overview?.path ?? []) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(half);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(half);
    }
    expect(chart.facing.altDeg).toBeCloseTo(50, 1);
    expect(chart.facing.azDeg).toBeCloseTo(180, 1);
  });

  it("is deterministic: identical inputs give a deep-equal chart", () => {
    const input = { stars, eyepieceFieldDeg: 1.7 };
    expect(chartOf(input)).toEqual(chartOf(input));
    expect(JSON.stringify(chartOf(input))).toBe(JSON.stringify(chartOf(input)));
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

  it("holds the vertical rule for facing panels at several altitudes 10° or more from the zenith, and several azimuths", () => {
    for (const [alt, az] of [
      [20, 10],
      [35, 120],
      [60, 250],
      [78, 330],
    ]) {
      const target = hor(alt, az);
      const stars: FinderStarInput[] = [
        { index: 0, mag: 3, vector: toJ2000(hor(alt, az + 3)) },
        { index: 1, mag: 6, vector: toJ2000(hor(alt + 2, az)) },
        { index: 2, mag: 6, vector: toJ2000(hor(alt - 2, az)) },
      ];
      const chart = chartOf({
        stars,
        target: { vector: toJ2000(target), magnitude: null, isPlanet: false, majorAxisArcmin: null },
      });
      expect(chart.orientation).toBe("facing");
      const upper = chart.finder.stars.find((s) => s.index === 1);
      const lower = chart.finder.stars.find((s) => s.index === 2);
      expect(upper?.y).toBeLessThan(lower?.y ?? Number.NEGATIVE_INFINITY);
    }
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

    it("gives a finite, deterministic chart for a target exactly at the zenith", () => {
      const run = () =>
        chartOf({
          stars: [
            { index: 0, mag: 3, vector: toJ2000(hor(86, 180)) },
            { index: 1, mag: 6, vector: toJ2000(hor(88, 90)) },
          ],
          target: { vector: toJ2000([0, 0, 1]), magnitude: null, isPlanet: false, majorAxisArcmin: null },
        });
      const chart = run();
      expect(chart.orientation).toBe("overhead");
      expect(allFinite(chart)).toBe(true);
      expect(chart.finder.zenith).toEqual({ x: 0, y: 0 });
      expect(chart.facing.altDeg).toBe(90);
      expect(run()).toEqual(chart);
    });

    it("switches at 80°: a centre at 79.9° stays facing and one at 80.0° goes overhead", () => {
      // The start sits 3° lower, so the overview's centre stays below 80° with no zenith inside it.
      const below = withTarget(79.9, 76.9);
      expect(below.orientation).toBe("facing");
      expect(below.finder.zenith).toBeNull();
      const at80 = withTarget(FINDER_OVERHEAD_ALT_DEG, FINDER_OVERHEAD_ALT_DEG - 3);
      expect(at80.orientation).toBe("overhead");
      // Both centres are 10° or more from the zenith, which is outside both 10° panels: no marker.
      expect(at80.finder.zenith).toBeNull();
      expect(at80.overview?.zenith).toBeNull();
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

    it("says which pole is up: north from the equator northwards, south for a southern site, none when facing", () => {
      const zenithAt = (site: Site): FinderChartData => {
        const { rot } = Rotation_EQJ_HOR(TIME, observerFor(site));
        const zenith: UnitVector = [rot[0][2], rot[1][2], rot[2][2]];
        return finderChart({
          site,
          time: TIME,
          bortle: 3,
          minAltitudeDeg: MIN_ALT,
          target: { vector: zenith, magnitude: null, isPlanet: false, majorAxisArcmin: null },
          stars: [],
          eyepieceFieldDeg: null,
        });
      };
      expect(zenithAt(SITE).poleUp).toBe("north");
      expect(zenithAt({ ...SITE, latitudeDeg: 0 }).poleUp).toBe("north");
      expect(
        zenithAt({ latitudeDeg: -33.9, longitudeDeg: 18.4, elevationM: 10, timeZone: "Africa/Johannesburg" }).poleUp,
      ).toBe("south");
      expect(withTarget(60, 57).poleUp).toBeNull();
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
      for (let i = 0; i < 18; i++) {
        specs.push({
          x: (random() - 0.5) * 30,
          y: (random() - 0.5) * 30,
          mag: 5 + Math.floor(random() * 16) / 10,
          index: 100 + Math.floor(random() * 300) + i * 1000,
        });
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
  // Warsaw, 52° N, on the calibration nights. At Bortle 3 the dark window needs the Sun below -18°, which July
  // never gives at this latitude: that night is skipped for Bortle 3.
  const NIGHTS = ["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"] as const;
  const BORTLES = [3, 5, 8] as const;
  /** Measured on the first run: every one of the 373 Bortle 3 object-nights (July has no Bortle 3 dark window) was a hop, a share of 1.0; the gate is 3 percentage points below. */
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
    expect(share(3)).toBeGreaterThanOrEqual(HOP_SHARE_GATE_BORTLE_3);
  }, 120_000);
});
