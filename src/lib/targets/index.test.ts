import { describe, expect, it } from "vitest";
import { PLANET_KEYS } from "@/lib/engine";
import { isTargetKey, messierKey, messierNumber, parseTargetParam, PLANET_TARGET_KEYS, targetKind } from "./index";

describe("PLANET_TARGET_KEYS", () => {
  it("is the engine's planet list, in the same order", () => {
    expect(PLANET_TARGET_KEYS).toEqual(PLANET_KEYS);
  });
});

describe("isTargetKey", () => {
  it("accepts M1 to M110 and the seven planets", () => {
    for (const key of ["M1", "M9", "M10", "M99", "M100", "M109", "M110", ...PLANET_TARGET_KEYS]) {
      expect(isTargetKey(key)).toBe(true);
    }
  });

  it.each([["M0"], ["M111"], ["M01"], ["m31"], ["31"], ["M 31"], ["Jupiter"], ["pluto"], ["moon"], [""], [31], [null]])(
    "rejects %s",
    (value) => {
      expect(isTargetKey(value)).toBe(false);
    },
  );
});

describe("messierKey and messierNumber", () => {
  it("convert between a Messier number and its key", () => {
    expect(messierKey(31)).toBe("M31");
    expect(messierNumber("M31")).toBe(31);
    expect(messierNumber("M110")).toBe(110);
    expect(messierNumber("jupiter")).toBeNull();
  });
});

describe("targetKind", () => {
  it("tells Messier keys from planet keys", () => {
    expect(targetKind("M31")).toBe("messier");
    expect(targetKind("saturn")).toBe("planet");
  });
});

describe("parseTargetParam", () => {
  it("accepts a key", () => {
    expect(parseTargetParam("M31")).toBe("M31");
    expect(parseTargetParam("jupiter")).toBe("jupiter");
  });

  it("reads the bare Messier number of an older link as its key", () => {
    expect(parseTargetParam("31")).toBe("M31");
    expect(parseTargetParam("110")).toBe("M110");
  });

  it("returns null for anything else", () => {
    for (const value of [null, undefined, "", "0", "111", "1234", "m31", "Jupiter", "M31 at 52.23N", "-1"]) {
      expect(parseTargetParam(value)).toBeNull();
    }
  });
});
