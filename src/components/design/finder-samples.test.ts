import { describe, expect, it } from "vitest";

import { finderSamples } from "./finder-samples";

/** The /design specimens must keep showing the variants they are named for, whatever the engine or the stars do. */
describe("the finder design samples", () => {
  it("draw each variant they stand for", async () => {
    const samples = await finderSamples("en");
    expect(samples.hop.chart.kind).toBe("hop");
    expect(samples.hop.chart.orientation).toBe("facing");
    expect(samples.m31.chart.kind).toBe("hop");
    expect(samples.m31.chart.orientation).toBe("facing");
    expect(samples.m31.chart.poleUp).toBeNull();
    expect(samples.m31.chart.facing.altDeg).toBeLessThan(80);
    expect(Object.values(samples.m31.labels.stars)).toContain("Mirach (β And)");
    expect(samples.overhead.chart.poleUp).toBe("north");
    expect(samples.noEyepiece.chart.finder.circles.some((c) => c.kind === "eyepiece")).toBe(false);
    expect(samples.noEyepiece.labels.eyepiece).toBeNull();
    expect(samples.overhead.chart.kind).toBe("hop");
    expect(samples.overhead.chart.orientation).toBe("overhead");
    // The zenith inside both panels is the cross; outside, each panel has the edge arrow and no cross.
    for (const panel of [samples.overhead.chart.finder, samples.overhead.chart.overview]) {
      expect(panel?.zenith).not.toBeNull();
      expect(panel?.zenithEdge).toBeNull();
    }
    expect(samples.overheadEdge.chart.orientation).toBe("overhead");
    for (const panel of [samples.overheadEdge.chart.finder, samples.overheadEdge.chart.overview]) {
      expect(panel?.zenith).toBeNull();
      expect(panel?.zenithEdge).not.toBeNull();
    }
    expect(samples.direct.chart.kind).toBe("direct");
    expect(samples.nakedEye.chart.kind).toBe("naked-eye");
    expect(samples.nakedEye.chart.overview).toBeNull();
    expect(samples.noStart.chart.kind).toBe("no-start");
  });
});
