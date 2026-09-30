import { describe, expect, it } from "vitest";
import { presetForAfov } from "./eyepiece-presets";

describe("eyepiece presets (FR-009)", () => {
  it("maps an AFOV back to its preset, or to other", () => {
    expect(presetForAfov(82)).toBe("ultrawide");
    expect(presetForAfov(50)).toBe("plossl");
    expect(presetForAfov(60)).toBe("other");
  });
});
