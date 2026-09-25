import { describe, expect, it } from "vitest";
import { EYEPIECE_PRESETS, presetForAfov } from "./eyepiece-presets";

describe("eyepiece presets (FR-009)", () => {
  it("has the three fixed presets", () => {
    expect(EYEPIECE_PRESETS.plossl).toEqual({ label: "Plössl (~50°)", afovDeg: 50 });
    expect(EYEPIECE_PRESETS.wide).toEqual({ label: "Wide-field (~68°)", afovDeg: 68 });
    expect(EYEPIECE_PRESETS.ultrawide).toEqual({ label: "Ultra-wide (~82°)", afovDeg: 82 });
  });

  it("maps an AFOV back to its preset, or to other", () => {
    expect(presetForAfov(82)).toBe("ultrawide");
    expect(presetForAfov(50)).toBe("plossl");
    expect(presetForAfov(60)).toBe("other");
  });
});
