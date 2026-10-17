import { describe, expect, it } from "vitest";

import { getMessages } from "@/i18n";
import type { FinderChartData, FinderPanel } from "@/lib/engine";

import { EXAMPLE_FINDER_CHART, exampleLabels } from "./example-chart";
import { bearingDeg, finderText, wayKey, type FinderChartLabels } from "./steps";

const emptyPanel: FinderPanel = {
  fieldDeg: 10,
  stars: [],
  path: [],
  target: { x: 0, y: 0 },
  zenith: null,
  zenithEdge: null,
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
  it("names the eight ways by sector, from up clockwise, and measures a panel bearing clockwise from up with y running down", () => {
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
    expect(bearingDeg({ x: 0, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(0, 10);
    expect(bearingDeg({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90, 10);
    expect(bearingDeg({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(180, 10);
    expect(bearingDeg({ x: 0, y: 0 }, { x: -1, y: -1 })).toBeCloseTo(315, 10);
  });
});

describe("finderText", () => {
  const t = getMessages("en").tonight.finder;

  it("writes the example's hop as numbered steps (the start, every hop star, the target), with no placeholder in either language", () => {
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
    let lines = 0;
    for (const locale of ["en", "pl"] as const) {
      const localised = finderText(
        EXAMPLE_FINDER_CHART,
        exampleLabels(locale),
        locale,
        getMessages(locale).tonight.finder,
      );
      for (const line of [...localised.steps, localised.overviewAlt ?? "", localised.finderAlt]) {
        expect(line, `${locale}: ${line}`).not.toMatch(/undefined|NaN|\[object/);
        lines += 1;
      }
    }
    expect(lines).toBeGreaterThanOrEqual(2 * (EXAMPLE_FINDER_CHART.hops.length + 4));
  });

  it("words the other chart kinds: a start within one step, an unnamed star, a direct chart, a naked-eye planet and no start", () => {
    // A start within one step goes straight to the target.
    const near = finderText(
      chartOf({
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
      }),
      LABELS,
      "en",
      t,
    );
    expect(near.steps).toEqual([
      "Find Mirach (β And), magnitude 2.1, 45° up in the ENE.",
      "Move 2.5° up and to the right to reach M31.",
    ]);

    // A star with no name is called by its magnitude.
    const unnamed = finderText(
      chartOf({
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
      }),
      LABELS,
      "en",
      t,
    );
    expect(unnamed.steps[0]).toBe("Find the magnitude 3.4 star, magnitude 3.4, 30° up in the S.");

    // A direct chart says why there is no hop.
    const direct = finderText(
      chartOf({
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
      }),
      LABELS,
      "en",
      t,
    );
    expect(direct.steps).toHaveLength(2);
    expect(direct.steps[1]).toBe(
      "M31 lies 12.3° to the right of Mirach (β And). No chain of stars short enough for a finder joins the two, so judge the distance with the circles on the finder view.",
    );
    expect(direct.overviewAlt).toContain("12.3°");

    // A naked-eye planet points to where to look and has no overview.
    const planet = finderText(chartOf({ kind: "naked-eye", start: null }), { ...LABELS, target: "Saturn" }, "en", t);
    expect(planet.steps[0]).toBe("Saturn is bright enough to spot without help. Look SE, 41° up.");
    expect(planet.steps).toHaveLength(2);
    expect(planet.overviewAlt).toBeNull();
    expect(planet.routeStars).toEqual([]);

    // No qualifying star gives a single sentence.
    const none = finderText(chartOf({ kind: "no-start", start: null }), LABELS, "en", t);
    expect(none.steps).toEqual([t.noStart]);
    expect(none.overviewAlt).toBeNull();
  });
});
