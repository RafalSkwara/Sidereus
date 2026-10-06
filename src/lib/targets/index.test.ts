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
import {
  isDeepSkyKey,
  isTargetKey,
  messierKey,
  messierNumber,
  MOON_TARGET_KEY,
  parseTargetParam,
  PLANET_TARGET_KEYS,
  targetKind,
} from "./index";

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
    expect(entry?.seen).toEqual({ count: 1, lastNight: "2026-10-20" });
  });
});

describe("isTargetKey", () => {
  it("accepts M1 to M110, NGC and IC keys, the seven planets and the Moon", () => {
    for (const key of [
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
    ]) {
      expect(isTargetKey(key)).toBe(true);
    }
  });

  it.each([
    ["M0"],
    ["M111"],
    ["M01"],
    ["m31"],
    ["31"],
    ["M 31"],
    ["NGC0"],
    ["NGC07000"],
    ["NGC10000"],
    ["NGC 7000"],
    ["ngc7000"],
    ["IC"],
    ["IC0"],
    ["Jupiter"],
    ["pluto"],
    ["Moon"],
    ["luna"],
    ["sun"],
    [""],
    [31],
    [null],
  ])("rejects %s", (value) => {
    expect(isTargetKey(value)).toBe(false);
  });
});

describe("messierKey and messierNumber", () => {
  it("convert between a Messier number and its key", () => {
    expect(messierKey(31)).toBe("M31");
    expect(messierNumber("M31")).toBe(31);
    expect(messierNumber("M110")).toBe(110);
    expect(messierNumber("jupiter")).toBeNull();
    expect(messierNumber("moon")).toBeNull();
    expect(messierNumber("NGC7000")).toBeNull();
  });
});

describe("isDeepSkyKey", () => {
  it("checks the NGC / IC shape only, never a Messier key", () => {
    expect(isDeepSkyKey("NGC7000")).toBe(true);
    expect(isDeepSkyKey("IC405")).toBe(true);
    expect(isDeepSkyKey("M31")).toBe(false);
    expect(isDeepSkyKey("NGC0")).toBe(false);
    expect(isDeepSkyKey("ngc7000")).toBe(false);
  });
});

describe("targetKind", () => {
  it("tells Messier keys, deep-sky keys, planet keys and the Moon's key apart", () => {
    expect(targetKind("M31")).toBe("messier");
    expect(targetKind("NGC7000")).toBe("deep-sky");
    expect(targetKind("IC405")).toBe("deep-sky");
    expect(targetKind("saturn")).toBe("planet");
    expect(targetKind("moon")).toBe("moon");
  });
});

describe("parseTargetParam", () => {
  it("accepts a key", () => {
    expect(parseTargetParam("M31")).toBe("M31");
    expect(parseTargetParam("jupiter")).toBe("jupiter");
    expect(parseTargetParam("moon")).toBe("moon");
    expect(parseTargetParam("NGC869")).toBe("NGC869");
    expect(parseTargetParam("IC405")).toBe("IC405");
  });

  it("reads the bare Messier number of an older link as its key", () => {
    expect(parseTargetParam("31")).toBe("M31");
    expect(parseTargetParam("110")).toBe("M110");
  });

  it("returns null for anything else", () => {
    for (const value of [
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
    ]) {
      expect(parseTargetParam(value)).toBeNull();
    }
  });
});
