import { HorizonFromVector, MakeTime, Observer, RotateVector, Rotation_EQJ_HOR, Vector } from "astronomy-engine";
import { describe, expect, it } from "vitest";

import { BRIGHT_STARS } from "@/lib/catalogue/stars";
import { bodyLabelRects, leaderLine, placeLabels, type LabelItem } from "@/lib/sky-view/labels";
import { rotateToHorizon } from "@/lib/sky-view/rotate";
import { fractionToX, placeSliderLabels, type SliderLabelId } from "@/lib/sky-view/slider-labels";

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
    expect(stars).toHaveLength(12);
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

describe("the label and slider-label placement rules", () => {
  const bounds = { width: 800, height: 200 };
  const rect = (x: number, y: number, width = 40) => ({ x, y, width, height: 14 });

  it("never drops a body label: star labels yield to it, avoid obstacles, stop at the cap and stay below `top`; high bodies sit side by side below the overlap with a leader", () => {
    // A body label stays and a star label that overlaps it goes.
    const items: LabelItem[] = [
      { id: "vega", kind: "star", mag: 0.03, rects: [rect(100, 50)] },
      { id: "M13", kind: "body", rects: [rect(110, 52)] },
      { id: "deneb", kind: "star", mag: 1.25, rects: [rect(300, 50)] },
    ];
    expect(placeLabels(items, bounds).map((label) => label.id)).toEqual(["M13", "deneb"]);

    // Star labels stop at the cap, brightest first, and avoid an obstacle; a star tries its other rectangle.
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

    // Every label stays below `top`, the overlap behind the verdict that shows stars only.
    const below = placeLabels(
      [
        { id: "M57", kind: "body", rects: [rect(100, 30), rect(100, 90)] },
        { id: "vega", kind: "star", mag: 0.03, rects: [rect(300, 40)] },
        { id: "deneb", kind: "star", mag: 1.25, rects: [rect(400, 40), rect(400, 120)] },
      ],
      { ...bounds, top: 80 },
    );
    expect(below.map((label) => [label.id, label.rect.y])).toEqual([
      ["M57", 90],
      ["deneb", 120],
    ]);

    // Two high bodies in one column go side by side below the overlap, each with a leader back to its dot.
    const overlap = 96;
    const columnBounds = { width: 800, height: 304, top: overlap };
    const column = placeLabels(
      [
        { id: "M31", kind: "body", rects: bodyLabelRects(400, 10, 30, overlap) },
        { id: "M34", kind: "body", rects: bodyLabelRects(402, 30, 30, overlap) },
      ],
      columnBounds,
    );
    const m31 = column.find((label) => label.id === "M31")?.rect;
    const m34 = column.find((label) => label.id === "M34")?.rect;
    expect(m31).toEqual({ x: 385, y: overlap, width: 30, height: 14 });
    expect(m34).toEqual({ x: 421, y: overlap, width: 30, height: 14 });
    expect(bodyLabelRects(400, 10, 30, overlap).map((r) => r.x)).toEqual([385, 419, 351]);
    if (!m31 || !m34) throw new Error("expected both labels placed");
    expect(leaderLine(400, 10, m31)).toEqual({ x1: 400, y1: 17, x2: 400, y2: overlap });
    expect(leaderLine(402, 30, m34)).not.toBeNull();
    // A label beside its dot needs no leader.
    const [beside] = bodyLabelRects(400, 200, 30, overlap);
    expect(beside).toEqual({ x: 408, y: 193, width: 30, height: 14 });
    expect(leaderLine(400, 200, beside)).toBeNull();
  });

  it("places the slider's edge labels: dark ones centred under the span, sunset and sunrise dropped first, merged when they collide, kept inside the track", () => {
    const widths: Record<SliderLabelId, number> = {
      sunset: 40,
      darkStart: 40,
      darkEnd: 40,
      darkMerged: 90,
      sunrise: 40,
    };
    const base = { thumbPx: 20, gapPx: 8, widths };

    // A wide track shows all four labels, the dark ones centred under the span's edges.
    const wide = placeSliderLabels({ ...base, trackWidth: 600, dark: { from: 0.2, to: 0.8 } });
    expect(Object.keys(wide).sort()).toEqual(["darkEnd", "darkStart", "sunrise", "sunset"]);
    expect((wide.darkStart ?? 0) + 20).toBeCloseTo(fractionToX(0.2, 600, 20), 0);
    expect((wide.darkEnd ?? 0) + 20).toBeCloseTo(fractionToX(0.8, 600, 20), 0);
    expect(wide.sunset).toBe(0);
    expect(wide.sunrise).toBe(560);

    // A narrow track drops sunset and sunrise before the dark window's labels.
    const narrow = placeSliderLabels({ ...base, trackWidth: 200, dark: { from: 0.15, to: 0.85 } });
    expect(narrow.sunset).toBeUndefined();
    expect(narrow.sunrise).toBeUndefined();
    expect(narrow.darkStart).toBeDefined();
    expect(narrow.darkEnd).toBeDefined();

    // Colliding dark labels merge into one centred under the span, then the ends are checked again.
    const merged = placeSliderLabels({ ...base, trackWidth: 120, dark: { from: 0.3, to: 0.7 } });
    expect(merged.darkStart).toBeUndefined();
    expect(merged.darkEnd).toBeUndefined();
    expect(merged.darkMerged).toBe(15);
    expect(merged.sunset).toBeUndefined();
    expect(merged.sunrise).toBeUndefined();

    // Without a dark window only sunset and sunrise show, and nothing before the track is measured.
    expect(placeSliderLabels({ ...base, trackWidth: 300, dark: null })).toEqual({ sunset: 0, sunrise: 260 });
    expect(placeSliderLabels({ ...base, trackWidth: 0, dark: { from: 0.2, to: 0.8 } })).toEqual({});

    // A label stays inside the track when its edge is at the end of the axis.
    const edges = placeSliderLabels({ ...base, trackWidth: 300, dark: { from: 0, to: 1 } });
    expect(edges.darkStart).toBe(0);
    expect(edges.darkEnd).toBe(260);
  });
});
