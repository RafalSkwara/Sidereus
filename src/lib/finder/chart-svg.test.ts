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

/** The x-range of a label's box, from its anchor. */
const labelBox = (label: { text: string; x: number; y: number; anchor: string }) => {
  const width = labelWidth(label.text);
  const x0 =
    label.anchor === "start" ? label.x - 2 : label.anchor === "end" ? label.x - width + 2 : label.x - width / 2;
  return { text: label.text, x0, x1: x0 + width, y0: label.y - 8, y1: label.y + 2 };
};

describe("starRadius", () => {
  it("runs from the largest dot at the brightest magnitude to the smallest at the panel's depth, never growing for a fainter star", () => {
    expect(starRadius(-1.5, 7.5)).toBe(STAR_RADIUS_MAX);
    expect(starRadius(7.5, 7.5)).toBe(STAR_RADIUS_MIN);
    expect(starRadius(-5, 7.5)).toBe(STAR_RADIUS_MAX);
    expect(starRadius(9, 7.5)).toBe(STAR_RADIUS_MIN);
    let previous = Number.POSITIVE_INFINITY;
    let steps = 0;
    for (let mag = -1.5; mag <= 7.5; mag += 0.5) {
      const r = starRadius(mag, 7.5);
      expect(r, `mag ${String(mag)}`).toBeLessThanOrEqual(previous);
      expect(decimals(r), `mag ${String(mag)}`).toBeLessThanOrEqual(1);
      previous = r;
      steps += 1;
    }
    expect(steps).toBe(19);
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

  it("maps the tangent plane to the square with y down and the target at the middle, draws the route and the circles, and rounds to 0.1", () => {
    expect(svg.viewBox).toBe("0 0 200 200");
    expect(svg.target).toEqual({ cx: 100, cy: 100 });
    expect(svg.stars[0]).toMatchObject({ cx: 100, cy: 100 });
    // 1° east and 2° up on a 10° panel: 20 units per degree, and higher means a smaller y.
    expect(svg.stars[1]).toMatchObject({ cx: 120, cy: 60 });
    expect(svg.stars[2]).toMatchObject({ cx: 37.5, cy: 149.1 });
    expect(svg.zenith).toEqual({ cx: 140, cy: 40 });
    expect(svg.path).toBe("M37.5 149.1 L100 100");
    expect(svg.stars.map((star) => star.route)).toEqual([true, false, true]);
    expect(svg.circles).toEqual([
      { cx: 100, cy: 100, r: 70, kind: "finder" },
      { cx: 100, cy: 100, r: 5, kind: "reflex" },
      { cx: 100, cy: 100, r: 17, kind: "eyepiece" },
    ]);
    const numbers = [
      ...svg.stars.flatMap((star) => [star.cx, star.cy, star.r]),
      ...svg.circles.flatMap((circle) => [circle.cx, circle.cy, circle.r]),
      ...svg.labels.flatMap((label) => [label.x, label.y]),
      svg.target.cx,
      svg.target.cy,
      ...[...svg.path.matchAll(/(-?\d+(?:\.\d+)?)/g)].map((match) => Number(match[1])),
    ];
    expect(numbers.length).toBeGreaterThan(20);
    for (const value of numbers) {
      expect(decimals(value), String(value)).toBeLessThanOrEqual(1);
    }
  });

  it("labels the target, the named route stars and the zenith and no other star, inside the square and clear of every other label", () => {
    expect(svg.labels.map((label) => label.text).sort()).toEqual(["M31", "Mirach (β And)", "Zenith", "μ And"].sort());
    const boxes = svg.labels.map(labelBox);
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
    // A label with nowhere free to go still stays inside the square.
    const crowded: FinderPanel = {
      ...PANEL,
      stars: [{ index: 1, x: 4.9, y: 4.9, mag: 2 }],
      path: [],
      zenith: null,
      zenithEdge: null,
    };
    const placed = panelSvg(crowded, { size: 200, routeStars: [1], names: { 1: "A rather long star name (ζ UMa)" } });
    expect(placed.labels).toHaveLength(1);
    const box = labelBox(placed.labels[0]);
    expect(box.x0).toBeGreaterThanOrEqual(-0.1);
    expect(box.x1).toBeLessThanOrEqual(200.1);
  });
});

describe("panelSvg: the zenith's arrow on the edge", () => {
  const OUTSIDE: FinderPanel = { ...PANEL, zenith: null, stars: [], path: [] };
  const arrowOf = (x: number, y: number, angleDeg: number) =>
    panelSvg({ ...OUTSIDE, zenithEdge: { x, y, angleDeg } }, { size: 200, zenithLabel: "Zenith" });

  it("points outward along the zenith's direction at every bearing, inside the square, with a 'Zenith' label inside the square and clear of the arrow", () => {
    const bearings = [0, 30, 45, 90, 135, 180, 225, 270, 337.5];
    let checked = 0;
    for (const angleDeg of bearings) {
      const rad = (angleDeg * Math.PI) / 180;
      // The edge point of a 10° square toward this bearing, in degrees.
      const reach = 5 / Math.max(Math.abs(Math.sin(rad)), Math.abs(Math.cos(rad)));
      const svg = arrowOf(Math.sin(rad) * reach, -Math.cos(rad) * reach, angleDeg);
      const arrow = svg.zenithEdge;
      expect(arrow, `bearing ${String(angleDeg)}`).not.toBeNull();
      if (arrow === null) {
        continue;
      }
      const from = (point: { cx: number; cy: number }) => Math.hypot(point.cx - 100, point.cy - 100);
      expect(from(arrow.tip), `bearing ${String(angleDeg)}: tip farther out than tail`).toBeGreaterThan(
        from(arrow.tail),
      );
      const along = Math.atan2(arrow.tip.cx - arrow.tail.cx, arrow.tail.cy - arrow.tip.cy);
      expect(Math.abs(Math.sin(along - rad)), `bearing ${String(angleDeg)}: on the line of angleDeg`).toBeLessThan(
        0.02,
      );
      for (const value of [arrow.tip.cx, arrow.tip.cy, arrow.tail.cx, arrow.tail.cy]) {
        expect(value, `bearing ${String(angleDeg)}`).toBeGreaterThanOrEqual(0);
        expect(value, `bearing ${String(angleDeg)}`).toBeLessThanOrEqual(200);
      }
      const label = svg.labels.find((l) => l.text === "Zenith");
      expect(label, `bearing ${String(angleDeg)}: Zenith label`).toBeDefined();
      if (label === undefined) {
        continue;
      }
      const box = labelBox(label);
      expect(box.x0, `bearing ${String(angleDeg)}`).toBeGreaterThanOrEqual(-0.1);
      expect(box.x1, `bearing ${String(angleDeg)}`).toBeLessThanOrEqual(200.1);
      expect(box.y0, `bearing ${String(angleDeg)}`).toBeGreaterThanOrEqual(-0.1);
      expect(box.y1, `bearing ${String(angleDeg)}`).toBeLessThanOrEqual(200.1);
      // Clear of the shaft: the label's box does not contain the tail or the tip.
      for (const point of [arrow.tail, arrow.tip]) {
        const inBox = point.cx >= box.x0 && point.cx <= box.x1 && point.cy >= box.y0 && point.cy <= box.y1;
        expect(
          inBox,
          `bearing ${String(angleDeg)}: arrow end ${String(point.cx)},${String(point.cy)} under the label`,
        ).toBe(false);
      }
      checked += 1;
    }
    expect(checked).toBe(bearings.length);
    // A panel with no edge marker, or with its zenith inside, draws no arrow.
    expect(panelSvg(PANEL, { size: 200, zenithLabel: "Zenith" }).zenithEdge).toBeNull();
  });
});

describe("the committed example chart", () => {
  it("draws both panels with every label inside the square", () => {
    let labels = 0;
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
        labels += 1;
      }
    }
    expect(labels).toBeGreaterThan(0);
  });
});
