import { describe, expect, it } from "vitest";
import { bundledEyepieces, eyepieceFill, telescopeFill } from "./fill";
import type { EyepieceEntry, TelescopeEntry } from "./types";

const telescope: TelescopeEntry = {
  id: "t",
  brand: "B",
  model: "M",
  name: "B M",
  apertureMm: 203.2,
  focalLengthMm: 2032,
  bundledEyepieces: ["e25", "missing", "e10"],
  source: "https://example.com/t",
};

function eyepiece(id: string, focalLengthMm: number, afovDeg: number): EyepieceEntry {
  return { id, brand: "B", line: "L", name: `B ${id}`, focalLengthMm, afovDeg, source: "https://example.com/e" };
}

describe("telescopeFill", () => {
  it("maps an entry onto the form's strings", () => {
    expect(telescopeFill(telescope)).toEqual({ name: "B M", apertureMm: "203.2", focalLengthMm: "2032" });
  });
});

describe("eyepieceFill", () => {
  it("fills 52 degrees as other with the exact value", () => {
    expect(eyepieceFill(eyepiece("a", 9, 52))).toEqual({
      name: "B a",
      focalLengthMm: "9",
      afovPreset: "other",
      afovDeg: "52",
    });
  });

  it("fills a named preset's AFOV as that preset", () => {
    expect(eyepieceFill(eyepiece("a", 9, 68)).afovPreset).toBe("wide");
    expect(eyepieceFill(eyepiece("a", 9, 50)).afovPreset).toBe("plossl");
    expect(eyepieceFill(eyepiece("a", 9, 82)).afovPreset).toBe("ultrawide");
  });
});

describe("bundledEyepieces", () => {
  const eyepieces = [eyepiece("e10", 10, 45), eyepiece("e25", 25, 45), eyepiece("other", 5, 60)];

  it("resolves ids to entries in the telescope's order and skips an unknown id", () => {
    expect(bundledEyepieces(telescope, eyepieces).map((entry) => entry.id)).toEqual(["e25", "e10"]);
  });

  it("returns nothing for a telescope without bundled eyepieces", () => {
    expect(bundledEyepieces({ ...telescope, bundledEyepieces: undefined }, eyepieces)).toEqual([]);
  });
});
