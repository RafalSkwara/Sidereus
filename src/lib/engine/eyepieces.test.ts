import { describe, expect, it } from "vitest";

import { findMessier } from "@/lib/catalogue";

import { eyepieceOptics, pairEyepieces } from "./eyepieces";
import { FOV_FIT_FRACTION } from "./parameters";

/** Shaped like the gear store's `EyepieceRecord`, to prove it passes through unchanged. */
function eyepiece(id: string, focalLengthMm: number, afovDeg = 50) {
  return { id, name: `${focalLengthMm} mm`, focalLengthMm, afovDeg, createdAt: "2026-09-25T00:00:00Z" };
}

const NEWTONIAN = { id: "t1", name: "150/750", apertureMm: 150, focalLengthMm: 750, createdAt: "2026-09-25T00:00:00Z" };
const PLOSSL_25 = eyepiece("e25", 25);
const PLOSSL_10 = eyepiece("e10", 10);

function majorAxis(messier: number): number | null {
  const object = findMessier(messier);
  if (object === undefined) {
    throw new Error(`M${messier} missing from the catalogue`);
  }
  return object.majorAxisArcmin;
}

describe("eyepieceOptics", () => {
  it("derives magnification, exit pupil and true field", () => {
    const optics = eyepieceOptics(NEWTONIAN, PLOSSL_25);
    expect(optics.magnification).toBe(30);
    expect(optics.exitPupilMm).toBe(5);
    expect(optics.trueFovDeg).toBeCloseTo(50 / 30, 12);
  });
});

describe("pairEyepieces", () => {
  it("picks the 25 mm to find and the 10 mm for detail on a 150/750 with a small object", () => {
    expect(pairEyepieces(NEWTONIAN, [PLOSSL_25, PLOSSL_10], 10)).toEqual({
      kind: "pair",
      finding: PLOSSL_25,
      detail: PLOSSL_10,
    });
    // Order of the kit does not change the choice.
    expect(pairEyepieces(NEWTONIAN, [PLOSSL_10, PLOSSL_25], 10)).toEqual({
      kind: "pair",
      finding: PLOSSL_25,
      detail: PLOSSL_10,
    });
  });

  it("lets a single eyepiece fill both roles", () => {
    expect(pairEyepieces(NEWTONIAN, [PLOSSL_10], 10)).toEqual({ kind: "pair", finding: PLOSSL_10, detail: PLOSSL_10 });
  });

  it("skips a detail eyepiece below the exit-pupil floor and falls back to the finding one when none is left", () => {
    // 3 mm on 150/750: 250×, exit pupil 0.6 mm < 0.7 mm floor.
    const tiny = eyepiece("e3", 3);
    expect(pairEyepieces(NEWTONIAN, [PLOSSL_25, PLOSSL_10, tiny], 1)).toEqual({
      kind: "pair",
      finding: PLOSSL_25,
      detail: PLOSSL_10,
    });
    expect(pairEyepieces(NEWTONIAN, [tiny], 1)).toEqual({ kind: "pair", finding: tiny, detail: tiny });
  });

  it("skips a finding eyepiece above the exit-pupil ceiling unless it is the only one that fits", () => {
    // 40 mm on 150/750: 18.75×, exit pupil 8 mm > 5.5 mm ceiling.
    const long = eyepiece("e40", 40);
    expect(pairEyepieces(NEWTONIAN, [long, PLOSSL_25, PLOSSL_10], 10)).toEqual({
      kind: "pair",
      finding: PLOSSL_25,
      detail: PLOSSL_10,
    });
    // Only the 40 mm's 2.67° field fits a 2° object, so it is the finding eyepiece despite the ceiling.
    expect(pairEyepieces(NEWTONIAN, [long, PLOSSL_25, PLOSSL_10], 120)).toEqual({
      kind: "pair",
      finding: long,
      detail: long,
    });
  });

  it("never recommends an eyepiece the object does not fit", () => {
    // 60′ = 1°: fits the 25 mm (0.8 × 1.67°) but not the 10 mm (0.8 × 0.67°).
    expect(pairEyepieces(NEWTONIAN, [PLOSSL_25, PLOSSL_10], 60)).toEqual({
      kind: "pair",
      finding: PLOSSL_25,
      detail: PLOSSL_25,
    });
    // Just inside and just outside FOV_FIT_FRACTION of the 10 mm's field.
    const edgeArcmin = FOV_FIT_FRACTION * eyepieceOptics(NEWTONIAN, PLOSSL_10).trueFovDeg * 60;
    expect(pairEyepieces(NEWTONIAN, [PLOSSL_25, PLOSSL_10], edgeArcmin - 0.01)).toMatchObject({ detail: PLOSSL_10 });
    expect(pairEyepieces(NEWTONIAN, [PLOSSL_25, PLOSSL_10], edgeArcmin + 0.01)).toMatchObject({ detail: PLOSSL_25 });
  });

  it("returns none-fit with the widest eyepiece for M31 on the 25 mm + 10 mm kit", () => {
    expect(pairEyepieces(NEWTONIAN, [PLOSSL_10, PLOSSL_25], majorAxis(31))).toEqual({
      kind: "none-fit",
      widest: PLOSSL_25,
    });
  });

  it("treats M40, which has no size, as fitting every eyepiece", () => {
    expect(majorAxis(40)).toBeNull();
    expect(pairEyepieces(NEWTONIAN, [PLOSSL_25, PLOSSL_10], majorAxis(40))).toEqual({
      kind: "pair",
      finding: PLOSSL_25,
      detail: PLOSSL_10,
    });
  });

  it("returns null for an empty kit", () => {
    expect(pairEyepieces(NEWTONIAN, [], 10)).toBeNull();
    expect(pairEyepieces(NEWTONIAN, [], null)).toBeNull();
  });

  it("breaks ties by the order the kit is given in", () => {
    const first = eyepiece("a", 25);
    const second = eyepiece("b", 25);
    expect(pairEyepieces(NEWTONIAN, [first, second], 10)).toEqual({ kind: "pair", finding: first, detail: first });
    expect(pairEyepieces(NEWTONIAN, [second, first], 10)).toEqual({ kind: "pair", finding: second, detail: second });
    expect(pairEyepieces(NEWTONIAN, [first, second], 1000)).toEqual({ kind: "none-fit", widest: first });
  });
});
