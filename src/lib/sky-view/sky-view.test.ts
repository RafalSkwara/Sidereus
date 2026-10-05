import { HorizonFromVector, MakeTime, Observer, RotateVector, Rotation_EQJ_HOR, Vector } from "astronomy-engine";
import { describe, expect, it } from "vitest";

import { BRIGHT_STARS } from "@/lib/catalogue/stars";
import { skyMix, mixPercentages } from "@/lib/sky-view/colour";
import { frameTime, nearestFrame } from "@/lib/sky-view/frames";
import { placeLabels, type LabelItem } from "@/lib/sky-view/labels";
import { project, starRadius } from "@/lib/sky-view/projection";
import { rotateToHorizon } from "@/lib/sky-view/rotate";

/** The interactive sky's browser maths (interactive-sky), pinned where the screenshots can't show it. */

function circularDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

describe("rotateToHorizon", () => {
  it("matches astronomy-engine's HorizonFromVector(RotateVector(rot, v)) within 0.01°", () => {
    const observer = new Observer(52.23, 21.01, 0);
    const times = [
      new Date("2026-10-10T17:00:00Z"),
      new Date("2026-10-10T22:30:00Z"),
      new Date("2026-12-21T03:10:00Z"),
    ];
    const rotations = times.flatMap((time) => {
      const { rot } = Rotation_EQJ_HOR(time, observer);
      return [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => rot[i][j]));
    });
    const stars = BRIGHT_STARS.filter((star) => star.name).slice(0, 12);
    for (const [frame, time] of times.entries()) {
      const matrix = Rotation_EQJ_HOR(time, observer);
      for (const star of stars) {
        const [x, y, z] = star.vector;
        const expected = HorizonFromVector(RotateVector(matrix, new Vector(x, y, z, MakeTime(time))), "");
        const actual = rotateToHorizon(rotations, frame, star.vector);
        expect(Math.abs(actual.altDeg - expected.lat)).toBeLessThan(0.01);
        if (Math.abs(expected.lat) < 89) {
          expect(circularDelta(actual.azDeg, expected.lon)).toBeLessThan(0.01);
        }
      }
    }
  });
});

describe("project", () => {
  it("puts the facing point at the strip's centre and the horizon at the bottom", () => {
    expect(project({ altDeg: 0, azDeg: 180 }, "south", 400, 200)).toEqual({ x: 400, y: 200 });
    expect(project({ altDeg: 90, azDeg: 0 }, "north", 400, 200)).toEqual({ x: 400, y: 0 });
    expect(project({ altDeg: 45, azDeg: 90 }, "south", 400, 200)).toEqual({ x: 200, y: 100 });
    expect(project({ altDeg: 45, azDeg: 270 }, "north", 400, 200).x).toBe(200);
  });

  it("wraps azimuth into [0, 2 × width)", () => {
    expect(project({ altDeg: 10, azDeg: 0 }, "south", 400, 200).x).toBe(0);
    expect(project({ altDeg: 10, azDeg: 359 }, "south", 400, 200).x).toBeCloseTo(800 - 400 / 180, 6);
    expect(project({ altDeg: 10, azDeg: 1 }, "south", 400, 200).x).toBeCloseTo(400 / 180, 6);
  });

  it("sizes stars by brightness", () => {
    expect(starRadius(-1.5)).toBeCloseTo(2.4);
    expect(starRadius(4.5)).toBeCloseTo(0.6);
    expect(starRadius(-3)).toBeCloseTo(2.4);
  });
});

describe("skyMix", () => {
  it("runs from full glow at sunset through full twilight at −6° to night at −18°", () => {
    expect(skyMix(3)).toEqual({ glow: 100, twilight: 0 });
    expect(skyMix(0)).toEqual({ glow: 100, twilight: 0 });
    expect(skyMix(-3)).toEqual({ glow: 50, twilight: 50 });
    expect(skyMix(-6)).toEqual({ glow: 0, twilight: 100 });
    expect(skyMix(-12)).toEqual({ glow: 0, twilight: 50 });
    expect(skyMix(-18)).toEqual({ glow: 0, twilight: 0 });
    expect(skyMix(-40)).toEqual({ glow: 0, twilight: 0 });
  });

  it("nests the percentages so the three colours keep their shares", () => {
    expect(mixPercentages({ glow: 100, twilight: 0 })).toEqual({ outer: "100.0%", inner: "100.0%" });
    expect(mixPercentages({ glow: 50, twilight: 50 })).toEqual({ outer: "50.0%", inner: "100.0%" });
    expect(mixPercentages({ glow: 0, twilight: 25 })).toEqual({ outer: "0.0%", inner: "25.0%" });
  });
});

describe("placeLabels", () => {
  const bounds = { width: 800, height: 200 };
  const rect = (x: number, y: number, width = 40) => ({ x, y, width, height: 14 });

  it("keeps every body label and drops star labels that overlap one", () => {
    const items: LabelItem[] = [
      { id: "vega", kind: "star", mag: 0.03, rects: [rect(100, 50)] },
      { id: "M13", kind: "body", rects: [rect(110, 52)] },
      { id: "deneb", kind: "star", mag: 1.25, rects: [rect(300, 50)] },
    ];
    expect(placeLabels(items, bounds).map((label) => label.id)).toEqual(["M13", "deneb"]);
  });

  it("tries a star's other rectangles, avoids obstacles and stops at the cap, brightest first", () => {
    const stars: LabelItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `s${String(i)}`,
      kind: "star",
      mag: 20 - i,
      rects: [rect(i * 40, 10, 30)],
    }));
    const placed = placeLabels(stars, bounds, [rect(0, 0, 80)]);
    expect(placed).toHaveLength(15);
    expect(placed[0].id).toBe("s19");
    expect(placed.some((label) => label.id === "s0" || label.id === "s1")).toBe(false);

    const flipped = placeLabels(
      [
        { id: "M31", kind: "body", rects: [rect(500, 20)] },
        { id: "altair", kind: "star", mag: 0.8, rects: [rect(510, 20), rect(440, 20)] },
      ],
      bounds,
    );
    expect(flipped.find((label) => label.id === "altair")?.rect.x).toBe(440);
  });

  it("keeps every label below `top`, the overlap behind the verdict that shows stars only", () => {
    const placed = placeLabels(
      [
        { id: "M57", kind: "body", rects: [rect(100, 30), rect(100, 90)] },
        { id: "vega", kind: "star", mag: 0.03, rects: [rect(300, 40)] },
        { id: "deneb", kind: "star", mag: 1.25, rects: [rect(400, 40), rect(400, 120)] },
      ],
      { ...bounds, top: 80 },
    );
    expect(placed.map((label) => [label.id, label.rect.y])).toEqual([
      ["M57", 90],
      ["deneb", 120],
    ]);
  });
});

describe("frames", () => {
  // Three steps and a short last one: 0, 10, 20, then 25 minutes.
  const view = { startMs: 0, stepMs: 600_000, endMs: 1_500_000, frameCount: 4 };

  it("caps the last frame at the range end", () => {
    expect(frameTime(view, 2)).toBe(1_200_000);
    expect(frameTime(view, 3)).toBe(1_500_000);
  });

  it("finds the nearest frame and clamps outside the range", () => {
    expect(nearestFrame(view, -5_000_000)).toBe(0);
    expect(nearestFrame(view, 650_000)).toBe(1);
    expect(nearestFrame(view, 1_400_000)).toBe(3);
    expect(nearestFrame(view, 1_340_000)).toBe(2);
    expect(nearestFrame(view, 9_000_000)).toBe(3);
  });
});
