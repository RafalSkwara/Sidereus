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

describe("TELESCOPE_PRESETS", () => {
  it("ships the five named presets in order", () => {
    expect(TELESCOPE_PRESETS.map((p) => [p.id, p.apertureMm, p.focalLengthMm])).toEqual([
      ["r102", 102, 500],
      ["n130", 130, 650],
      ["n150", 150, 750],
      ["d200", 200, 1200],
      ["m127", 127, 1500],
    ]);
  });

  it("names every preset in the catalogue, and nothing else", () => {
    expect(Object.keys(copy.telescopes)).toEqual(ids(TELESCOPE_PRESETS));
  });

  it.each(TELESCOPE_PRESETS)("$id passes the telescope schema once stringified", (preset) => {
    const name = copy.telescopes[preset.id];
    const result = telescopeInputSchema.safeParse({
      name,
      apertureMm: String(preset.apertureMm),
      focalLengthMm: String(preset.focalLengthMm),
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name,
      apertureMm: preset.apertureMm,
      focalLengthMm: preset.focalLengthMm,
    });
  });

  it("has unique ids and a default that exists", () => {
    expect(new Set(ids(TELESCOPE_PRESETS)).size).toBe(TELESCOPE_PRESETS.length);
    expect(ids(TELESCOPE_PRESETS)).toContain(DEFAULT_TELESCOPE_PRESET_ID);
    expect(DEFAULT_TELESCOPE_PRESET_ID).toBe("n150");
  });
});

describe("EYEPIECE_KIT_PRESETS", () => {
  it("ships the supplied pair, a Plössl set and an empty kit", () => {
    expect(EYEPIECE_KIT_PRESETS.map((kit) => [kit.id, kit.eyepieces.map((e) => e.focalLengthMm)])).toEqual([
      ["pair", [25, 10]],
      ["plossl-set", [32, 17, 13, 8, 6]],
      ["none", []],
    ]);
  });

  it("names every kit in the catalogue, and nothing else", () => {
    expect(Object.keys(copy.eyepieceKits)).toEqual(ids(EYEPIECE_KIT_PRESETS));
  });

  const eyepieces = EYEPIECE_KIT_PRESETS.flatMap((kit) => kit.eyepieces.map((eyepiece) => ({ kit: kit.id, eyepiece })));

  it.each(eyepieces)("$kit / $eyepiece.name passes the eyepiece schema once stringified", ({ eyepiece }) => {
    const result = eyepieceInputSchema.safeParse({
      name: eyepiece.name,
      focalLengthMm: String(eyepiece.focalLengthMm),
      afovPreset: eyepiece.afovPreset,
    });
    expect(result.success).toBe(true);
    expect(result.data?.afovDeg).toBe(EYEPIECE_PRESETS.plossl.afovDeg);
  });

  it("has unique ids and a default that exists", () => {
    expect(new Set(ids(EYEPIECE_KIT_PRESETS)).size).toBe(EYEPIECE_KIT_PRESETS.length);
    expect(ids(EYEPIECE_KIT_PRESETS)).toContain(DEFAULT_EYEPIECE_KIT_ID);
    expect(DEFAULT_EYEPIECE_KIT_ID).toBe("pair");
  });
});

describe("SKY_SCENES", () => {
  it("maps the five scenes to Bortle classes in order", () => {
    expect(SKY_SCENES.map((scene) => [scene.id, scene.bortle])).toEqual([
      ["city", 8],
      ["suburb", 6],
      ["town", 5],
      ["village", 4],
      ["remote", 2],
    ]);
  });

  it("uses distinct Bortle classes within 1-9", () => {
    const bortles = SKY_SCENES.map((scene) => scene.bortle);
    expect(new Set(bortles).size).toBe(bortles.length);
    for (const bortle of bortles) {
      expect(Number.isInteger(bortle)).toBe(true);
      expect(bortle).toBeGreaterThanOrEqual(1);
      expect(bortle).toBeLessThanOrEqual(9);
    }
  });

  it("gives every scene a title and a one-sentence description", () => {
    expect(Object.keys(copy.scenes)).toEqual(ids(SKY_SCENES));
    for (const scene of SKY_SCENES) {
      expect(copy.scenes[scene.id].title.trim()).not.toBe("");
      expect(copy.scenes[scene.id].description).toMatch(/^[A-Z][^.]*\.$/);
    }
  });

  it("has unique ids and a default that exists", () => {
    expect(new Set(ids(SKY_SCENES)).size).toBe(SKY_SCENES.length);
    expect(ids(SKY_SCENES)).toContain(DEFAULT_SKY_SCENE_ID);
    expect(DEFAULT_SKY_SCENE_ID).toBe("suburb");
  });
});
