import { describe, expect, it } from "vitest";
import { DEFAULT_MIN_ALTITUDE_DEG } from "@/lib/engine/parameters";
import { onboardingInputSchema } from "./schemas";

const pair = [
  { name: "25 mm Plössl", focalLengthMm: "25", afovPreset: "plossl" },
  { name: "Wide 8", focalLengthMm: "8", afovPreset: "other", afovDeg: "72" },
];

/** FormData-shaped input: every value is a string, as a plain HTML POST delivers it. */
const form = {
  latitudeDeg: "52.2297",
  longitudeDeg: "21.0122",
  bortle: "6",
  telescopeName: "150 mm reflector",
  apertureMm: "150",
  focalLengthMm: "750",
  eyepieces: JSON.stringify(pair),
};

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

function eyepieceRows(count: number): string {
  return JSON.stringify(
    Array.from({ length: count }, (_, i) => ({ name: `EP ${i + 1}`, focalLengthMm: "10", afovPreset: "plossl" })),
  );
}

describe("onboardingInputSchema", () => {
  it("accepts a full setup, fixes the site name and minimum altitude, and rounds the coordinates", () => {
    const result = onboardingInputSchema.safeParse(form);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      site: {
        name: "Home",
        latitudeDeg: 52.23,
        longitudeDeg: 21.01,
        bortle: 6,
        minAltitudeDeg: DEFAULT_MIN_ALTITUDE_DEG,
      },
      telescope: { name: "150 mm reflector", apertureMm: 150, focalLengthMm: 750 },
      eyepieces: [
        { name: "25 mm Plössl", focalLengthMm: 25, afovPreset: "plossl", afovDeg: 50 },
        { name: "Wide 8", focalLengthMm: 8, afovPreset: "other", afovDeg: 72 },
      ],
    });
  });

  it("accepts a setup with no eyepieces", () => {
    const result = onboardingInputSchema.safeParse({ ...form, eyepieces: "[]" });
    expect(result.success).toBe(true);
    expect(result.data?.eyepieces).toEqual([]);
  });

  it("rounds coordinates half away from zero", () => {
    const result = onboardingInputSchema.parse({ ...form, latitudeDeg: "-33.8651", longitudeDeg: "-151.2099" });
    expect(result.site).toMatchObject({ latitudeDeg: -33.87, longitudeDeg: -151.21 });
  });

  it("accepts exactly ten eyepieces", () => {
    expect(onboardingInputSchema.safeParse({ ...form, eyepieces: eyepieceRows(10) }).success).toBe(true);
  });

  it.each([
    ["latitude 90.5", { latitudeDeg: "90.5" }],
    ["longitude -181", { longitudeDeg: "-181" }],
    ["an empty latitude", { latitudeDeg: "" }],
    ["Bortle 0", { bortle: "0" }],
    ["an empty telescope name", { telescopeName: "  " }],
    ["aperture 10 mm", { apertureMm: "10" }],
    ["an eyepiece with focal length 70 mm", { eyepieces: JSON.stringify([{ ...pair[0], focalLengthMm: "70" }]) }],
    ["an eyepiece of type other without an AFOV", { eyepieces: JSON.stringify([{ ...pair[1], afovDeg: "" }]) }],
  ])("rejects %s", (_label, override) => {
    expect(onboardingInputSchema.safeParse({ ...form, ...override }).success).toBe(false);
  });

  it("rejects out-of-range latitude with the site schema's message", () => {
    const result = onboardingInputSchema.safeParse({ ...form, latitudeDeg: "-91" });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["latitudeDeg"], message: "Enter a latitude between -90 and 90 degrees." }),
    ]);
  });

  it("rejects eleven eyepieces", () => {
    const result = onboardingInputSchema.safeParse({ ...form, eyepieces: eyepieceRows(11) });
    expect(result.success).toBe(false);
    expect(messages(result)).toEqual(["Add at most 10 eyepieces."]);
  });

  it.each([
    ["malformed JSON", "[{name:"],
    ["an empty string", ""],
    ["a JSON object instead of an array", JSON.stringify({ name: "25 mm" })],
    ["an array of strings", JSON.stringify(["25 mm"])],
    ["a missing field", undefined],
  ])("rejects %s with the fixed eyepieces message", (_label, eyepieces) => {
    const result = onboardingInputSchema.safeParse({ ...form, eyepieces });
    expect(result.success).toBe(false);
    expect(messages(result)).toEqual(["Check your eyepieces."]);
  });

  it("never echoes a submitted value in its error messages", () => {
    const result = onboardingInputSchema.safeParse({
      latitudeDeg: "91.2345",
      longitudeDeg: "-181.9876",
      bortle: "13",
      telescopeName: "x".repeat(61),
      apertureMm: "4321",
      focalLengthMm: "98765",
      eyepieces: JSON.stringify([{ name: "Secret 7.77", focalLengthMm: "77.7", afovPreset: "other", afovDeg: "133" }]),
    });
    expect(result.success).toBe(false);
    const all = messages(result).join(" | ");
    expect(messages(result).length).toBeGreaterThanOrEqual(7);
    for (const value of ["91.2345", "181.9876", "13", "xxxx", "4321", "98765", "Secret", "77.7", "133"]) {
      expect(all).not.toContain(value);
    }
  });
});
