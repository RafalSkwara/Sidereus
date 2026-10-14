import { describe, expect, it } from "vitest";

import { WARSAW } from "@/lib/tonight/test-fixtures";

import { keysWithoutWindow, newKeys, thrownKey } from "./checks";

const NIGHT = "2026-10-10";

describe("newKeys", () => {
  it("is every key when nothing was saved", () => {
    expect(newKeys(null, ["M31", "jupiter"])).toEqual(["M31", "jupiter"]);
  });

  it("leaves out the keys the stored list already had, keeping the posted order", () => {
    expect(newKeys(["M42", "M31"], ["M31", "NGC7000", "M42", "moon"])).toEqual(["NGC7000", "moon"]);
  });

  it("is empty when the list only drops or reorders keys", () => {
    expect(newKeys(["M31", "M42", "jupiter"], ["jupiter", "M31"])).toEqual([]);
    expect(newKeys([], [])).toEqual([]);
  });
});

describe("keysWithoutWindow", () => {
  it("finds no fault with objects and planets that have a window tonight", () => {
    // M31 and the Pleiades are well up from Warsaw on an October night; Jupiter has a window in the planet window.
    expect(keysWithoutWindow(WARSAW, NIGHT, ["M31", "M45", "jupiter"])).toEqual([]);
  });

  it("names an object that never reaches the site's minimum altitude in the dark window", () => {
    // M7 (declination -35 degrees) peaks about 3 degrees above Warsaw's horizon.
    expect(keysWithoutWindow(WARSAW, NIGHT, ["M31", "M7"])).toEqual(["M7"]);
    // Raising the minimum altitude takes the window of an object that had one.
    expect(keysWithoutWindow({ ...WARSAW, minAltitudeDeg: 80 }, NIGHT, ["M31"])).toEqual(["M31"]);
  });

  it("applies the same rule to a key the catalogue lacks (counted as without a window)", () => {
    expect(keysWithoutWindow(WARSAW, NIGHT, ["NGC1"])).toEqual(["NGC1"]);
  });

  it("uses the planet window for a planet and the Moon, so a polar-day site has none", () => {
    // 78 N in mid-June: no civil dusk at all, so neither the planets nor the Moon have a planet window.
    const svalbard = { ...WARSAW, latitudeDeg: 78.2, longitudeDeg: 15.6, timeZone: "Arctic/Longyearbyen" };
    expect(keysWithoutWindow(svalbard, "2026-06-20", ["jupiter", "moon", "M31"])).toEqual(["jupiter", "moon", "M31"]);
  });

  it("does not hold the ice giants to an aperture: the route has no telescope", () => {
    expect(keysWithoutWindow(WARSAW, NIGHT, ["uranus"])).toEqual([]);
  });
});

describe("thrownKey", () => {
  it("passes on a store's fixed key and nothing else", () => {
    expect(
      thrownKey(new Error("errors.load.sites", { cause: new Error("52.23,21.01") }), "errors.save.sessionPlan"),
    ).toBe("errors.load.sites");
    expect(thrownKey(new Error("duplicate key value violates 52.23"), "errors.save.sessionPlan")).toBe(
      "errors.save.sessionPlan",
    );
    expect(thrownKey("errors.load.sites", "errors.save.sessionPlan")).toBe("errors.save.sessionPlan");
  });
});
