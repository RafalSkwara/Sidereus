import { describe, expect, it } from "vitest";
import {
  darkWindow,
  DEFAULT_MIN_ALTITUDE_DEG,
  moonTarget,
  observingNight,
  PLANET_KEYS,
  PLANET_WINDOW_SUN_ALTITUDE_DEG,
  seenSummaries,
} from "@/lib/engine";
import { WARSAW } from "@/lib/engine/fixtures";
import { isTargetKey, MOON_TARGET_KEY, parseTargetParam, PLANET_TARGET_KEYS } from "./index";

describe("PLANET_TARGET_KEYS", () => {
  it("is the engine's planet list, in the same order", () => {
    expect(PLANET_TARGET_KEYS).toEqual(PLANET_KEYS);
  });
});

describe("MOON_TARGET_KEY", () => {
  it("is the key the engine's moonTarget reads its seen summary by", () => {
    // 2026-10-24 in Warsaw: the Moon is a target in the civil window (as in the engine's moon-target tests).
    const civil = darkWindow(WARSAW, observingNight("2026-10-24", WARSAW.timeZone), PLANET_WINDOW_SUN_ALTITUDE_DEG);
    if (civil.kind !== "window") {
      throw new Error("expected a civil window on 2026-10-24 in Warsaw");
    }
    const entry = moonTarget({
      site: WARSAW,
      minAltitudeDeg: DEFAULT_MIN_ALTITUDE_DEG,
      window: { start: civil.start, end: civil.end },
      telescope: { apertureMm: 150, focalLengthMm: 750 },
      eyepieces: [{ id: "e25", focalLengthMm: 25, afovDeg: 50 }],
      seen: seenSummaries([{ target: MOON_TARGET_KEY, night: "2026-10-20", rating: 4 }], "2026-10-24"),
    });
    expect(entry?.seen).toEqual({ count: 1, firstNight: "2026-10-20", lastNight: "2026-10-20" });
  });
});

describe("isTargetKey", () => {
  it("accepts M1 to M110, NGC and IC keys, the seven planets and the Moon, and nothing else", () => {
    const accepted = [
      "M1",
      "M9",
      "M10",
      "M99",
      "M100",
      "M109",
      "M110",
      "NGC1",
      "NGC7000",
      "NGC9999",
      "IC405",
      "IC4715",
      ...PLANET_TARGET_KEYS,
      "moon",
    ];
    const rejected = [
      "M0",
      "M111",
      "M01",
      "m31",
      "31",
      "M 31",
      "NGC0",
      "NGC07000",
      "NGC10000",
      "NGC 7000",
      "ngc7000",
      "IC",
      "IC0",
      "Jupiter",
      "pluto",
      "Moon",
      "luna",
      "sun",
      "",
      31,
      null,
    ];
    expect(accepted).toHaveLength(12 + PLANET_TARGET_KEYS.length + 1);
    expect(rejected).toHaveLength(21);
    for (const [i, key] of accepted.entries()) {
      expect(isTargetKey(key), `accepted ${i}: ${key}`).toBe(true);
    }
    for (const [i, value] of rejected.entries()) {
      expect(isTargetKey(value), `rejected ${i}: ${String(value)}`).toBe(false);
    }
  });
});

describe("parseTargetParam", () => {
  it("accepts a key, reads a bare Messier number of an older link as its key, and returns null for anything else", () => {
    for (const key of ["M31", "jupiter", "moon", "NGC869", "IC405"]) {
      expect(parseTargetParam(key), key).toBe(key);
    }
    expect(parseTargetParam("31")).toBe("M31");
    expect(parseTargetParam("110")).toBe("M110");
    const refused = [
      null,
      undefined,
      "",
      "0",
      "111",
      "1234",
      "m31",
      "ngc869",
      "NGC 869",
      "NGC0",
      "Jupiter",
      "Moon",
      "luna",
      "M31 at 52.23N",
      "-1",
    ];
    expect(refused).toHaveLength(15);
    for (const [i, value] of refused.entries()) {
      expect(parseTargetParam(value), `refused ${i}: ${String(value)}`).toBeNull();
    }
  });
});
