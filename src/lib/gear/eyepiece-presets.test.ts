import { describe, expect, it } from "vitest";
import { getMessages } from "@/i18n";
import { EYEPIECE_PRESETS, presetForAfov } from "./eyepiece-presets";

describe("eyepiece presets (FR-009)", () => {
  it("has the three fixed presets", () => {
    const names = getMessages("en").eyepiecePresets;
    expect(EYEPIECE_PRESETS.plossl).toEqual({ afovDeg: 50 });
    expect(names.plossl).toEqual({ short: "Plössl", long: "Plössl (~50°)" });
    expect(EYEPIECE_PRESETS.wide).toEqual({ afovDeg: 68 });
    expect(names.wide).toEqual({ short: "Wide-field", long: "Wide-field (~68°)" });
    expect(EYEPIECE_PRESETS.ultrawide).toEqual({ afovDeg: 82 });
    expect(names.ultrawide).toEqual({ short: "Ultra-wide", long: "Ultra-wide (~82°)" });
  });

  it("maps an AFOV back to its preset, or to other", () => {
    expect(presetForAfov(82)).toBe("ultrawide");
    expect(presetForAfov(50)).toBe("plossl");
    expect(presetForAfov(60)).toBe("other");
  });
});
