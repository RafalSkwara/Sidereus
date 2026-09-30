import { describe, expect, it } from "vitest";
import { getMessages } from "@/i18n";
import { EYEPIECE_PRESETS } from "@/lib/gear/eyepiece-presets";
import { eyepieceInputSchema, telescopeInputSchema } from "@/lib/gear/schemas";
import {
  DEFAULT_EYEPIECE_KIT_ID,
  DEFAULT_SKY_SCENE_ID,
  DEFAULT_TELESCOPE_PRESET_ID,
  EYEPIECE_KIT_PRESETS,
  SKY_SCENES,
  TELESCOPE_PRESETS,
} from "./presets";

const copy = getMessages("en").onboarding;

function ids(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id);
}

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

  it("has unique ids, defaults that exist and sky scenes on distinct Bortle classes within 1-9", () => {
    for (const [items, fallback] of [
      [TELESCOPE_PRESETS, DEFAULT_TELESCOPE_PRESET_ID],
      [EYEPIECE_KIT_PRESETS, DEFAULT_EYEPIECE_KIT_ID],
      [SKY_SCENES, DEFAULT_SKY_SCENE_ID],
    ] as const) {
      expect(new Set(ids(items)).size).toBe(items.length);
      expect(ids(items)).toContain(fallback);
    }
    const bortles = SKY_SCENES.map((scene) => scene.bortle);
    expect(new Set(bortles).size).toBe(bortles.length);
    expect(bortles.every((b) => Number.isInteger(b) && b >= 1 && b <= 9)).toBe(true);
  });
});
