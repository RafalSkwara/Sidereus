import type { EyepiecePresetKey } from "@/lib/gear/eyepiece-presets";

/**
 * The named choices the onboarding flow offers (FR-005, FR-006; roadmap Open Question 10): telescope
 * presets, eyepiece kits and plain-language sky scenes that stand in for a Bortle class. Each entry
 * has a stable `id`, which is also its message key: names, titles and descriptions live in the
 * catalogue under `onboarding.telescopes.<id>`, `onboarding.eyepieceKits.<id>` and
 * `onboarding.scenes.<id>` (F-03). The data here is locale-free.
 *
 * Island-safe: plain data, no imports beyond gear types.
 */

// telescopes ------------------------------------------------------------------------------------

export interface TelescopePreset {
  id: string;
  apertureMm: number;
  focalLengthMm: number;
}

export const TELESCOPE_PRESETS = [
  { id: "r102", apertureMm: 102, focalLengthMm: 500 },
  { id: "n130", apertureMm: 130, focalLengthMm: 650 },
  { id: "n150", apertureMm: 150, focalLengthMm: 750 },
  { id: "d200", apertureMm: 200, focalLengthMm: 1200 },
  { id: "m127", apertureMm: 127, focalLengthMm: 1500 },
] as const satisfies readonly TelescopePreset[];

export type TelescopePresetId = (typeof TELESCOPE_PRESETS)[number]["id"];

/** The 150 mm reflector: the calibrated reference kit. */
export const DEFAULT_TELESCOPE_PRESET_ID: TelescopePresetId = "n150";

// eyepiece kits ---------------------------------------------------------------------------------

/**
 * One eyepiece of a kit, shaped like the `/gear` eyepiece form. Its field of view is named by
 * preset key, so the degrees come from `EYEPIECE_PRESETS` and are never repeated here. The name
 * ("25 mm Plössl") is a product designation saved as the eyepiece's name, so it is data, not copy.
 */
export interface EyepieceKitItem {
  name: string;
  focalLengthMm: number;
  afovPreset: EyepiecePresetKey;
}

export interface EyepieceKitPreset {
  id: string;
  eyepieces: readonly EyepieceKitItem[];
}

function plossl(focalLengthMm: number): EyepieceKitItem {
  return { name: `${focalLengthMm} mm Plössl`, focalLengthMm, afovPreset: "plossl" };
}

export const EYEPIECE_KIT_PRESETS = [
  { id: "pair", eyepieces: [plossl(25), plossl(10)] },
  { id: "plossl-set", eyepieces: [plossl(32), plossl(17), plossl(13), plossl(8), plossl(6)] },
  { id: "none", eyepieces: [] },
] as const satisfies readonly EyepieceKitPreset[];

export type EyepieceKitPresetId = (typeof EYEPIECE_KIT_PRESETS)[number]["id"];

export const DEFAULT_EYEPIECE_KIT_ID: EyepieceKitPresetId = "pair";

// sky scenes ------------------------------------------------------------------------------------

/**
 * A plain-language picture of the night sky that stands in for a Bortle class (FR-005). Its title
 * and its description (what you see overhead on a clear, moonless night) are catalogue messages.
 */
export interface SkyScene {
  id: string;
  bortle: number;
}

export const SKY_SCENES = [
  { id: "city", bortle: 8 },
  { id: "suburb", bortle: 6 },
  { id: "town", bortle: 5 },
  { id: "village", bortle: 4 },
  { id: "remote", bortle: 2 },
] as const satisfies readonly SkyScene[];

export type SkySceneId = (typeof SKY_SCENES)[number]["id"];

export const DEFAULT_SKY_SCENE_ID: SkySceneId = "suburb";
