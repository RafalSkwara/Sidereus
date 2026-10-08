import { HorizonFromVector, MakeTime, Observer, RotateVector, Rotation_EQJ_HOR, Vector } from "astronomy-engine";
import { describe, expect, it } from "vitest";

import { BRIGHT_STARS } from "@/lib/catalogue/stars";
import { skyMix, mixPercentages } from "@/lib/sky-view/colour";
import { frameTime, nearestFrame } from "@/lib/sky-view/frames";
import { nearestToCentre } from "@/lib/sky-view/compass-marker";
import { bodyLabelRects, leaderLine, placeLabels, type LabelItem } from "@/lib/sky-view/labels";
import { project, starRadius } from "@/lib/sky-view/projection";
import { rotateToHorizon } from "@/lib/sky-view/rotate";
import { fractionToX, placeSliderLabels, samePlacement, type SliderLabelId } from "@/lib/sky-view/slider-labels";

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

describe("bodyLabelRects and leaderLine", () => {
  const overlap = 96;
  const bounds = { width: 800, height: 304, top: overlap };

  it("sets two high bodies in one column side by side below the overlap, each with a leader back to its dot", () => {
    const items: LabelItem[] = [
      { id: "M31", kind: "body", rects: bodyLabelRects(400, 10, 30, overlap) },
      { id: "M34", kind: "body", rects: bodyLabelRects(402, 30, 30, overlap) },
    ];
    const placed = placeLabels(items, bounds);
    const m31 = placed.find((label) => label.id === "M31")?.rect;
    const m34 = placed.find((label) => label.id === "M34")?.rect;
    // M31 takes the centred rect clamped to the overlap's edge; M34 moves to the right of its dot instead of stacking.
    expect(m31).toEqual({ x: 385, y: overlap, width: 30, height: 14 });
    expect(m34).toEqual({ x: 421, y: overlap, width: 30, height: 14 });
    // The left alternative is offered too.
    expect(bodyLabelRects(400, 10, 30, overlap).map((rect) => rect.x)).toEqual([385, 419, 351]);

    if (!m31 || !m34) throw new Error("expected both labels placed");
    expect(leaderLine(400, 10, m31)).toEqual({ x1: 400, y1: 17, x2: 400, y2: overlap });
    expect(leaderLine(402, 30, m34)).not.toBeNull();
  });

  it("needs no leader for a label beside its dot", () => {
    const [beside] = bodyLabelRects(400, 200, 30, overlap);
    expect(beside).toEqual({ x: 408, y: 193, width: 30, height: 14 });
    expect(leaderLine(400, 200, beside)).toBeNull();
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

describe("nearestToCentre (the compass marker)", () => {
  it("picks the label whose x is nearest the middle, the first on a tie, and none for an empty row", () => {
    expect(nearestToCentre([0, 100, 200, 300], 140)).toBe(1);
    expect(nearestToCentre([0, 100, 200, 300], 150)).toBe(1);
    expect(nearestToCentre([0, 100, 200, 300], 151)).toBe(2);
    expect(nearestToCentre([0, 100, 200, 300], -50)).toBe(0);
    expect(nearestToCentre([], 10)).toBe(-1);
  });

  it("lets the copy of the wrap-edge point nearest the middle win", () => {
    // N is drawn at both ends of a 400 px strip; scrolled to the right end, the right copy is nearer the middle.
    expect(nearestToCentre([0, 100, 200, 300, 400], 390)).toBe(4);
    expect(nearestToCentre([0, 100, 200, 300, 400], 10)).toBe(0);
  });
});

describe("placeSliderLabels (the slider's edge labels)", () => {
  const widths: Record<SliderLabelId, number> = { sunset: 40, darkStart: 40, darkEnd: 40, darkMerged: 90, sunrise: 40 };
  const base = { thumbPx: 20, gapPx: 8, widths };

  it("shows all four labels when the track is wide enough, the dark ones centred under the span's edges", () => {
    const placement = placeSliderLabels({ ...base, trackWidth: 600, dark: { from: 0.2, to: 0.8 } });
    expect(Object.keys(placement).sort()).toEqual(["darkEnd", "darkStart", "sunrise", "sunset"]);
    expect((placement.darkStart ?? 0) + 20).toBeCloseTo(fractionToX(0.2, 600, 20), 0);
    expect((placement.darkEnd ?? 0) + 20).toBeCloseTo(fractionToX(0.8, 600, 20), 0);
    expect(placement.sunset).toBe(0);
    expect(placement.sunrise).toBe(560);
  });

  it("drops sunset and sunrise before the dark window's labels", () => {
    // The dark start sits close to the sunset end and the dark end close to the sunrise end of a 200 px track.
    const placement = placeSliderLabels({ ...base, trackWidth: 200, dark: { from: 0.15, to: 0.85 } });
    expect(placement.sunset).toBeUndefined();
    expect(placement.sunrise).toBeUndefined();
    expect(placement.darkStart).toBeDefined();
    expect(placement.darkEnd).toBeDefined();
  });

  it("merges the dark labels into one centred under the span when they collide, then checks the ends again", () => {
    const placement = placeSliderLabels({ ...base, trackWidth: 120, dark: { from: 0.3, to: 0.7 } });
    expect(placement.darkStart).toBeUndefined();
    expect(placement.darkEnd).toBeUndefined();
    expect(placement.darkMerged).toBe(15);
    expect(placement.sunset).toBeUndefined();
    expect(placement.sunrise).toBeUndefined();
  });

  it("shows only sunset and sunrise without a dark window, and nothing before the track is measured", () => {
    expect(placeSliderLabels({ ...base, trackWidth: 300, dark: null })).toEqual({ sunset: 0, sunrise: 260 });
    expect(placeSliderLabels({ ...base, trackWidth: 0, dark: { from: 0.2, to: 0.8 } })).toEqual({});
  });

  it("keeps a label inside the track when its edge is at the end of the axis", () => {
    const placement = placeSliderLabels({ ...base, trackWidth: 300, dark: { from: 0, to: 1 } });
    expect(placement.darkStart).toBe(0);
    expect(placement.darkEnd).toBe(260);
  });

  it("compares placements by label and place", () => {
    expect(samePlacement(null, {})).toBe(false);
    expect(samePlacement({ sunset: 0 }, { sunset: 0 })).toBe(true);
    expect(samePlacement({ sunset: 0 }, { sunset: 1 })).toBe(false);
    expect(samePlacement({ sunset: 0 }, {})).toBe(false);
  });
});
