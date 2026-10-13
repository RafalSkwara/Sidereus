import { describe, expect, it } from "vitest";

import type { FinderPanel } from "@/lib/engine";

import { EXAMPLE_FINDER_CHART } from "./example-chart";
import { STAR_RADIUS_MAX, STAR_RADIUS_MIN, labelWidth, panelSvg, starRadius } from "./chart-svg";

/** A 10° panel with the target at the centre, three stars, a two-point path, three circles and a zenith marker. */
const PANEL: FinderPanel = {
  fieldDeg: 10,
  stars: [
    { index: 7, x: 0, y: 0, mag: 3 },
    { index: 8, x: 1, y: -2, mag: 5.5 },
    { index: 9, x: -3.123, y: 2.456, mag: 7.5 },
  ],
  path: [
    { x: -3.123, y: 2.456 },
    { x: 0, y: 0 },
  ],
  target: { x: 0, y: 0 },
  zenith: { x: 2, y: -3 },
  zenithEdge: null,
  circles: [
    { kind: "finder", r: 3.5 },
    { kind: "reflex", r: 0.25 },
    { kind: "eyepiece", r: 0.85 },
  ],
};

const decimals = (value: number): number => (String(value).split(".")[1] ?? "").length;

describe("starRadius", () => {
  it("runs from the largest dot at the brightest magnitude to the smallest at the panel's depth", () => {
    expect(starRadius(-1.5, 7.5)).toBe(STAR_RADIUS_MAX);
    expect(starRadius(7.5, 7.5)).toBe(STAR_RADIUS_MIN);
    expect(starRadius(-5, 7.5)).toBe(STAR_RADIUS_MAX);
    expect(starRadius(9, 7.5)).toBe(STAR_RADIUS_MIN);
  });

  it("never grows for a fainter star and rounds to 0.1", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let mag = -1.5; mag <= 7.5; mag += 0.5) {
      const r = starRadius(mag, 7.5);
      expect(r).toBeLessThanOrEqual(previous);
      expect(decimals(r)).toBeLessThanOrEqual(1);
      previous = r;
    }
  });
});

describe("panelSvg", () => {
  const svg = panelSvg(PANEL, {
    size: 200,
    routeStars: [9, 7],
    names: { 7: "Mirach (β And)", 9: "μ And", 8: "never labelled" },
    targetLabel: "M31",
    zenithLabel: "Zenith",
  });

  it("maps the tangent plane to the square, y down, the target at the middle", () => {
    expect(svg.viewBox).toBe("0 0 200 200");
    expect(svg.target).toEqual({ cx: 100, cy: 100 });
    expect(svg.stars[0]).toMatchObject({ cx: 100, cy: 100 });
    // 1° east and 2° up on a 10° panel: 20 units per degree, and higher means a smaller y.
    expect(svg.stars[1]).toMatchObject({ cx: 120, cy: 60 });
    expect(svg.stars[2]).toMatchObject({ cx: 37.5, cy: 149.1 });
    expect(svg.zenith).toEqual({ cx: 140, cy: 40 });
  });

  it("draws the route as a path, ringed stars as route stars and every circle round the target", () => {
    expect(svg.path).toBe("M37.5 149.1 L100 100");
    expect(svg.stars.map((star) => star.route)).toEqual([true, false, true]);
    expect(svg.circles).toEqual([
      { cx: 100, cy: 100, r: 70, kind: "finder" },
      { cx: 100, cy: 100, r: 5, kind: "reflex" },
      { cx: 100, cy: 100, r: 17, kind: "eyepiece" },
    ]);
    expect(panelSvg({ ...PANEL, path: [] }, { size: 200 }).path).toBe("");
  });

  it("gives the brightest star the largest dot, and depth defaults to the faintest star", () => {
    expect(svg.stars[0].r).toBeGreaterThan(svg.stars[1].r);
    expect(svg.stars[1].r).toBeGreaterThan(svg.stars[2].r);
    expect(svg.stars[2].r).toBe(STAR_RADIUS_MIN);
  });

  it("rounds every coordinate to 0.1", () => {
    const numbers = [
      ...svg.stars.flatMap((star) => [star.cx, star.cy, star.r]),
      ...svg.circles.flatMap((circle) => [circle.cx, circle.cy, circle.r]),
      ...svg.labels.flatMap((label) => [label.x, label.y]),
      svg.target.cx,
      svg.target.cy,
    ];
    for (const value of numbers) {
      expect(decimals(value), String(value)).toBeLessThanOrEqual(1);
    }
    for (const [, value] of svg.path.matchAll(/(-?\d+(?:\.\d+)?)/g)) {
      expect(decimals(Number(value)), value).toBeLessThanOrEqual(1);
    }
  });

  it("labels the target, the named route stars and the zenith, and no other star", () => {
    expect(svg.labels.map((label) => label.text).sort()).toEqual(["M31", "Mirach (β And)", "Zenith", "μ And"].sort());
  });

  it("keeps every label inside the square and clear of every other label", () => {
    const boxes = svg.labels.map((label) => {
      const width = labelWidth(label.text);
      const x0 =
        label.anchor === "start" ? label.x - 2 : label.anchor === "end" ? label.x - width + 2 : label.x - width / 2;
      return { text: label.text, x0, x1: x0 + width, y0: label.y - 8, y1: label.y + 2 };
    });
    for (const box of boxes) {
      expect(box.x0, box.text).toBeGreaterThanOrEqual(-0.1);
      expect(box.x1, box.text).toBeLessThanOrEqual(200.1);
      expect(box.y0, box.text).toBeGreaterThanOrEqual(-0.1);
      expect(box.y1, box.text).toBeLessThanOrEqual(200.1);
    }
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const apart = a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0;
        expect(apart, `${a.text} / ${b.text}`).toBe(true);
      }
    }
  });

  it("is deterministic and has no zenith when the panel has none", () => {
    expect(panelSvg(PANEL, { size: 200, targetLabel: "M31" })).toEqual(
      panelSvg(PANEL, { size: 200, targetLabel: "M31" }),
    );
    expect(panelSvg({ ...PANEL, zenith: null }, { size: 200, zenithLabel: "Zenith" }).zenith).toBeNull();
    expect(panelSvg({ ...PANEL, zenith: null }, { size: 200, zenithLabel: "Zenith" }).labels).toEqual([]);
  });

  it("keeps a label that has nowhere free inside the square", () => {
    const crowded: FinderPanel = {
      ...PANEL,
      stars: [{ index: 1, x: 4.9, y: 4.9, mag: 2 }],
      path: [],
      zenith: null,
      zenithEdge: null,
    };
    const placed = panelSvg(crowded, { size: 200, routeStars: [1], names: { 1: "A rather long star name (ζ UMa)" } });
    const label = placed.labels[0];
    const width = labelWidth(label.text);
    const x0 =
      label.anchor === "start" ? label.x - 2 : label.anchor === "end" ? label.x - width + 2 : label.x - width / 2;
    expect(x0).toBeGreaterThanOrEqual(-0.1);
    expect(x0 + width).toBeLessThanOrEqual(200.1);
  });
});

describe("panelSvg: the zenith's arrow on the edge", () => {
  const OUTSIDE: FinderPanel = { ...PANEL, zenith: null, stars: [], path: [] };
  const arrowOf = (x: number, y: number, angleDeg: number, options: { size: number } = { size: 200 }) =>
    panelSvg({ ...OUTSIDE, zenithEdge: { x, y, angleDeg } }, { ...options, zenithLabel: "Zenith" });

  it("puts the tip just inside the rim, out along the zenith's direction, with the tail back toward the middle", () => {
    // 20 units per degree: the top rim is y = 0, so the tip sits 3 units under it and the tail 16 further down.
    const up = arrowOf(0, -5, 0).zenithEdge;
    expect(up).toEqual({
      tip: { cx: 100, cy: 3 },
      tail: { cx: 100, cy: 19 },
      angleDeg: 0,
      path: "M100 19 L100 3 M102.5 7.3 L100 3 L97.5 7.3",
    });
    const right = arrowOf(5, 0, 90).zenithEdge;
    expect(right?.tip).toEqual({ cx: 197, cy: 100 });
    expect(right?.tail).toEqual({ cx: 181, cy: 100 });
    // A diagonal direction meets the corner: the tip is 3 units back along the diagonal.
    const corner = arrowOf(5, -5, 45).zenithEdge;
    expect(corner?.tip).toEqual({ cx: 197.9, cy: 2.1 });
    expect(corner?.tail).toEqual({ cx: 186.6, cy: 13.4 });
  });

  it("points outward: the tip is farther from the middle than the tail, on the line of angleDeg", () => {
    for (const angleDeg of [0, 30, 90, 135, 180, 225, 270, 337.5]) {
      const rad = (angleDeg * Math.PI) / 180;
      // The edge point of a 10° square toward this bearing, in degrees.
      const reach = 5 / Math.max(Math.abs(Math.sin(rad)), Math.abs(Math.cos(rad)));
      const arrow = arrowOf(Math.sin(rad) * reach, -Math.cos(rad) * reach, angleDeg).zenithEdge;
      expect(arrow, String(angleDeg)).not.toBeNull();
      if (arrow === null) {
        continue;
      }
      const from = (point: { cx: number; cy: number }) => Math.hypot(point.cx - 100, point.cy - 100);
      expect(from(arrow.tip), String(angleDeg)).toBeGreaterThan(from(arrow.tail));
      const along = Math.atan2(arrow.tip.cx - arrow.tail.cx, arrow.tail.cy - arrow.tip.cy);
      expect(Math.abs(Math.sin(along - rad)), String(angleDeg)).toBeLessThan(0.02);
      for (const value of [arrow.tip.cx, arrow.tip.cy, arrow.tail.cx, arrow.tail.cy]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(200);
        expect(decimals(value)).toBeLessThanOrEqual(1);
      }
      for (const [, value] of arrow.path.matchAll(/(-?\d+(?:\.\d+)?)/g)) {
        expect(decimals(Number(value)), value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("labels the arrow 'Zenith' inside the square and clear of the arrow, on every side", () => {
    for (const [x, y, angleDeg] of [
      [0, -5, 0],
      [5, 0, 90],
      [0, 5, 180],
      [-5, 0, 270],
      [5, -5, 45],
      [-5, 5, 225],
    ]) {
      const svg = arrowOf(x, y, angleDeg);
      const label = svg.labels.find((l) => l.text === "Zenith");
      expect(label, String(angleDeg)).toBeDefined();
      if (label === undefined || svg.zenithEdge === null) {
        continue;
      }
      const width = labelWidth(label.text);
      const x0 =
        label.anchor === "start" ? label.x - 2 : label.anchor === "end" ? label.x - width + 2 : label.x - width / 2;
      expect(x0, String(angleDeg)).toBeGreaterThanOrEqual(-0.1);
      expect(x0 + width, String(angleDeg)).toBeLessThanOrEqual(200.1);
      expect(label.y - 8, String(angleDeg)).toBeGreaterThanOrEqual(-0.1);
      expect(label.y + 2, String(angleDeg)).toBeLessThanOrEqual(200.1);
      // Clear of the shaft: the label's box does not contain the tail or the tip.
      for (const point of [svg.zenithEdge.tail, svg.zenithEdge.tip]) {
        const inBox = point.cx >= x0 && point.cx <= x0 + width && point.cy >= label.y - 8 && point.cy <= label.y + 2;
        expect(inBox, `${String(angleDeg)} ${String(point.cx)},${String(point.cy)}`).toBe(false);
      }
    }
  });

  it("has no arrow, and no label for one, when the panel has none or its zenith is inside", () => {
    expect(panelSvg(PANEL, { size: 200, zenithLabel: "Zenith" }).zenithEdge).toBeNull();
    expect(panelSvg({ ...OUTSIDE }, { size: 200, zenithLabel: "Zenith" }).zenithEdge).toBeNull();
  });
});

describe("the committed example chart", () => {
  it("draws both panels with every label inside the square", () => {
    for (const panel of [EXAMPLE_FINDER_CHART.overview, EXAMPLE_FINDER_CHART.finder]) {
      expect(panel).not.toBeNull();
      if (panel === null) {
        continue;
      }
      const route = [EXAMPLE_FINDER_CHART.start?.index ?? -1, ...EXAMPLE_FINDER_CHART.hops.map((hop) => hop.index)];
      const names = Object.fromEntries(route.map((index) => [index, `star ${String(index)} (α Xyz)`]));
      const svg = panelSvg(panel, { size: 200, routeStars: route, names, targetLabel: "M13" });
      expect(svg.stars.length).toBe(panel.stars.length);
      for (const label of svg.labels) {
        expect(label.x).toBeGreaterThanOrEqual(0);
        expect(label.x).toBeLessThanOrEqual(200);
        expect(label.y).toBeGreaterThan(0);
        expect(label.y).toBeLessThanOrEqual(200);
      }
    }
  });
});
