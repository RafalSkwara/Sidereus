import { describe, expect, it } from "vitest";

import { COMPASS_POINTS, compassPoint, isCardinal } from "./compass";

describe("compassPoint", () => {
  it("maps azimuths to 16 international points, wrapping and splitting at the half-sector boundary", () => {
    expect(compassPoint(0)).toBe("N");
    expect(compassPoint(22.5)).toBe("NNE");
    expect(compassPoint(90)).toBe("E");
    expect(compassPoint(225)).toBe("SW");
    expect(compassPoint(348.75)).toBe("N");
    expect(compassPoint(348.74)).toBe("NNW");
    expect(compassPoint(-45)).toBe("NW");
    expect(compassPoint(720)).toBe("N");
  });

  it("marks only N, E, S and W as cardinal", () => {
    expect(COMPASS_POINTS.filter(isCardinal)).toEqual(["N", "E", "S", "W"]);
  });
});
