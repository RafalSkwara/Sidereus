import { describe, expect, it } from "vitest";
import { DEFAULT_MIN_ALTITUDE_DEG } from "@/lib/engine/parameters";
import { eyepieceInputSchema, SITE_FORM_DEFAULTS, siteInputSchema, telescopeInputSchema } from "./schemas";

/** FormData-shaped input: every value is a string, as a plain HTML POST delivers it. */
const warsaw = {
  name: "Home",
  latitudeDeg: "52.2297",
  longitudeDeg: "21.0122",
  bortle: "7",
  minAltitudeDeg: "15",
  timeZoneMode: "auto",
  timeZone: "",
};

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("siteInputSchema", () => {
  it("accepts a Warsaw site and rounds its coordinates", () => {
    const result = siteInputSchema.safeParse(warsaw);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: "Home",
      latitudeDeg: 52.23,
      longitudeDeg: 21.01,
      bortle: 7,
      minAltitudeDeg: 15,
      timeZoneMode: "auto",
      timeZone: undefined,
    });
  });

  it("trims the name", () => {
    expect(siteInputSchema.parse({ ...warsaw, name: "  Garden  " }).name).toBe("Garden");
  });

  it.each([
    ["latitude 90.5", { latitudeDeg: "90.5" }],
    ["Bortle 0", { bortle: "0" }],
    ["Bortle 10", { bortle: "10" }],
    ["min altitude 61", { minAltitudeDeg: "61" }],
    ["an empty name", { name: "   " }],
    ["a 61-character name", { name: "x".repeat(61) }],
    ["an empty latitude", { latitudeDeg: "" }],
    ["manual mode without a zone", { timeZoneMode: "manual", timeZone: "" }],
    ["manual mode with an invalid zone", { timeZoneMode: "manual", timeZone: "Mars/Olympus" }],
  ])("rejects %s", (_label, override) => {
    expect(siteInputSchema.safeParse({ ...warsaw, ...override }).success).toBe(false);
  });

  it("accepts a 60-character name and manual mode with a valid zone", () => {
    const result = siteInputSchema.safeParse({
      ...warsaw,
      name: "x".repeat(60),
      timeZoneMode: "manual",
      timeZone: "Europe/Warsaw",
    });
    expect(result.success).toBe(true);
    expect(result.data?.timeZone).toBe("Europe/Warsaw");
  });

  it("never echoes a rejected coordinate in its error messages", () => {
    const result = siteInputSchema.safeParse({ ...warsaw, latitudeDeg: "91.2345", longitudeDeg: "-181.9876" });
    expect(result.success).toBe(false);
    const all = messages(result).join(" | ");
    expect(messages(result)).toHaveLength(2);
    expect(all).not.toContain("91.2345");
    expect(all).not.toContain("181.9876");
  });
});

describe("SITE_FORM_DEFAULTS", () => {
  it("starts the form at the PRD's default minimum altitude", () => {
    expect(SITE_FORM_DEFAULTS.minAltitudeDeg).toBe(DEFAULT_MIN_ALTITUDE_DEG);
  });
});

describe("telescopeInputSchema", () => {
  it("accepts a beginner refractor and rejects an aperture below 20 mm", () => {
    expect(telescopeInputSchema.parse({ name: "ST80", apertureMm: "80", focalLengthMm: "400" })).toEqual({
      name: "ST80",
      apertureMm: 80,
      focalLengthMm: 400,
    });
    expect(telescopeInputSchema.safeParse({ name: "Toy", apertureMm: "19", focalLengthMm: "400" }).success).toBe(false);
  });
});

describe("eyepieceInputSchema", () => {
  const base = { name: "25 mm", focalLengthMm: "25" };

  it("resolves the wide preset to 68°", () => {
    expect(eyepieceInputSchema.parse({ ...base, afovPreset: "wide" }).afovDeg).toBe(68);
  });

  it("ignores a stale afovDeg for a preset", () => {
    expect(eyepieceInputSchema.parse({ ...base, afovPreset: "plossl", afovDeg: "abc" }).afovDeg).toBe(50);
  });

  it("rejects other without afovDeg", () => {
    expect(eyepieceInputSchema.safeParse({ ...base, afovPreset: "other", afovDeg: "" }).success).toBe(false);
    expect(eyepieceInputSchema.safeParse({ ...base, afovPreset: "other" }).success).toBe(false);
  });

  it("accepts other with 100°", () => {
    expect(eyepieceInputSchema.parse({ ...base, afovPreset: "other", afovDeg: "100" }).afovDeg).toBe(100);
  });
});
