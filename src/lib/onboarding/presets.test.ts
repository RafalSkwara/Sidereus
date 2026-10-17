import { describe, expect, it } from "vitest";
import { getMessages } from "@/i18n";
import { EYEPIECE_PRESETS } from "@/lib/gear/eyepiece-presets";
import { eyepieceInputSchema, telescopeInputSchema } from "@/lib/gear/schemas";
import { EYEPIECE_KIT_PRESETS, TELESCOPE_PRESETS } from "./presets";

const copy = getMessages("en").onboarding;

describe("onboarding presets (FR-006)", () => {
  it("saves every telescope and eyepiece preset through the gear schemas unchanged", () => {
    for (const preset of TELESCOPE_PRESETS) {
      const name = copy.telescopes[preset.id];
      const result = telescopeInputSchema.safeParse({
        name,
        apertureMm: String(preset.apertureMm),
        focalLengthMm: String(preset.focalLengthMm),
      });
      expect(result.data).toEqual({ name, apertureMm: preset.apertureMm, focalLengthMm: preset.focalLengthMm });
    }
    for (const eyepiece of EYEPIECE_KIT_PRESETS.flatMap((kit) => kit.eyepieces)) {
      const result = eyepieceInputSchema.safeParse({
        name: eyepiece.name,
        focalLengthMm: String(eyepiece.focalLengthMm),
        afovPreset: eyepiece.afovPreset,
      });
      expect(result.data?.afovDeg).toBe(EYEPIECE_PRESETS.plossl.afovDeg);
    }
  });
});
