import { describe, expect, it } from "vitest";

import { getMessages } from "@/i18n";
import type { FinderChartData, FinderPanel } from "@/lib/engine";

import { EXAMPLE_FINDER_CHART, exampleLabels } from "./example-chart";
import { bearingDeg, degreesFormat, finderText, wayKey, type FinderChartLabels } from "./steps";

const emptyPanel: FinderPanel = {
  fieldDeg: 10,
  stars: [],
  path: [],
  target: { x: 0, y: 0 },
  zenith: null,
  circles: [],
};

const LABELS: FinderChartLabels = {
  target: "M31",
  stars: { 1: "Mirach (β And)", 2: null },
  eyepiece: null,
  direction: "SE, 41°",
  time: "22:40",
};

function chartOf(overrides: Partial<FinderChartData>): FinderChartData {
  return {
    kind: "hop",
    orientation: "facing",
    poleUp: null,
    facing: { azDeg: 130, altDeg: 41 },
    start: { index: 1, mag: 2.1, altDeg: 44.6, azDeg: 70.2, distanceDeg: 12.3 },
    hops: [],
    finalStepDeg: null,
    directionDeg: null,
    overview: null,
    finder: emptyPanel,
    ...overrides,
  };
}

describe("wayKey and bearingDeg", () => {
  it("names the eight ways by sector, from up clockwise", () => {
    const bearings = [0, 22, 23, 67, 68, 90, 135, 180, 225, 270, 315, 337, 338, 360, -45];
    expect(bearings.map((bearing) => wayKey(bearing))).toEqual([
      "up",
      "up",
      "upRight",
      "upRight",
      "right",
      "right",
      "downRight",
      "down",
      "downLeft",
      "left",
      "upLeft",
      "upLeft",
      "up",
      "up",
      "upLeft",
    ]);
  });

  it("measures a panel bearing clockwise from up with y running down", () => {
    expect(bearingDeg({ x: 0, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(0, 10);
    expect(bearingDeg({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90, 10);
    expect(bearingDeg({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(180, 10);
    expect(bearingDeg({ x: 0, y: 0 }, { x: -1, y: -1 })).toBeCloseTo(315, 10);
  });
});

describe("degreesFormat", () => {
  it("writes one decimal at most in the locale's notation", () => {
    expect(degreesFormat("en")(4.76)).toBe("4.8");
    expect(degreesFormat("en")(5)).toBe("5");
    expect(degreesFormat("pl")(4.8)).toBe("4,8");
  });
});

describe("finderText", () => {
  const t = getMessages("en").tonight.finder;

  it("writes the example's hop as numbered steps: the start, every hop star, the target", () => {
    const labels = exampleLabels("en");
    const text = finderText(EXAMPLE_FINDER_CHART, labels, "en", t);
    expect(text.steps).toHaveLength(EXAMPLE_FINDER_CHART.hops.length + 2);
    expect(text.steps[0]).toMatch(/^Find Alphecca \(α CrB\), magnitude 2\.2, 46° up in the WSW\.$/);
    expect(text.steps[1]).toMatch(/^Move 5\.1° .+ to ε CrB\.$/);
    expect(text.steps[text.steps.length - 1]).toMatch(/^Move 4\.8° .+ to reach M13\.$/);
    expect(text.routeStars).toEqual([
      EXAMPLE_FINDER_CHART.start?.index,
      ...EXAMPLE_FINDER_CHART.hops.map((hop) => hop.index),
    ]);
    expect(text.overviewAlt).toBe("Overview chart from Alphecca (α CrB) to M13. Moves: 4.");
    expect(text.finderAlt).toBe("Finder view: 10° of sky around M13.");
    expect(text.reflexRings).toBe("0.5°, 2° and 4°");
  });

  it("gives every step a way and never leaves a placeholder", () => {
    for (const locale of ["en", "pl"] as const) {
      const text = finderText(EXAMPLE_FINDER_CHART, exampleLabels(locale), locale, getMessages(locale).tonight.finder);
      for (const line of [...text.steps, text.overviewAlt ?? "", text.finderAlt]) {
        expect(line).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  it("goes straight to the target when the start is within one step", () => {
    const chart = chartOf({
      hops: [],
      finalStepDeg: 2.5,
      overview: {
        ...emptyPanel,
        path: [
          { x: -2, y: 1 },
          { x: 0, y: 0 },
        ],
        stars: [{ index: 1, x: -2, y: 1, mag: 2.1 }],
      },
    });
    const text = finderText(chart, LABELS, "en", t);
    expect(text.steps).toEqual([
      "Find Mirach (β And), magnitude 2.1, 45° up in the ENE.",
      "Move 2.5° up and to the right to reach M31.",
    ]);
  });

  it("calls a star with no name by its magnitude", () => {
    const chart = chartOf({
      start: { index: 2, mag: 3.4, altDeg: 30, azDeg: 180, distanceDeg: 3 },
      finalStepDeg: 3,
      overview: {
        ...emptyPanel,
        path: [
          { x: 0, y: 3 },
          { x: 0, y: 0 },
        ],
        stars: [{ index: 2, x: 0, y: 3, mag: 3.4 }],
      },
    });
    expect(finderText(chart, LABELS, "en", t).steps[0]).toBe(
      "Find the magnitude 3.4 star, magnitude 3.4, 30° up in the S.",
    );
  });

  it("says why there is no hop for a direct chart", () => {
    const chart = chartOf({
      kind: "direct",
      directionDeg: 90,
      overview: {
        ...emptyPanel,
        path: [
          { x: 0, y: 0 },
          { x: 8, y: 0 },
        ],
        stars: [{ index: 1, x: 0, y: 0, mag: 2.1 }],
      },
    });
    const text = finderText(chart, LABELS, "en", t);
    expect(text.steps).toHaveLength(2);
    expect(text.steps[1]).toBe(
      "M31 lies 12.3° to the right of Mirach (β And). No chain of stars short enough for a finder joins the two, so judge the distance with the circles on the finder view.",
    );
    expect(text.overviewAlt).toContain("12.3°");
  });

  it("points a naked-eye planet to where to look, and has no overview", () => {
    const text = finderText(chartOf({ kind: "naked-eye", start: null }), { ...LABELS, target: "Saturn" }, "en", t);
    expect(text.steps[0]).toBe("Saturn is bright enough to spot without help. Look SE, 41° up.");
    expect(text.steps).toHaveLength(2);
    expect(text.overviewAlt).toBeNull();
    expect(text.routeStars).toEqual([]);
  });

  it("gives a single sentence when no star qualifies", () => {
    const text = finderText(chartOf({ kind: "no-start", start: null }), LABELS, "en", t);
    expect(text.steps).toEqual([t.noStart]);
    expect(text.overviewAlt).toBeNull();
  });
});
