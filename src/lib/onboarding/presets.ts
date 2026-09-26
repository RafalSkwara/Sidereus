import type { EyepiecePresetKey } from "@/lib/gear/eyepiece-presets";

/**
 * The named choices the onboarding flow offers (FR-005, FR-006; roadmap Open Question 10): telescope
 * presets, eyepiece kits and plain-language sky scenes that stand in for a Bortle class. Each entry
 * has a stable `id` that later becomes its message key when the copy is translated (F-03); the
 * English text lives here until then.
 *
 * Island-safe: plain data, no imports beyond gear types.
 */

// telescopes ------------------------------------------------------------------------------------

export interface TelescopePreset {
  id: string;
  name: string;
  apertureMm: number;
  focalLengthMm: number;
}

export const TELESCOPE_PRESETS = [
  { id: "r102", name: "102 mm refractor", apertureMm: 102, focalLengthMm: 500 },
  { id: "n130", name: "130 mm reflector", apertureMm: 130, focalLengthMm: 650 },
  { id: "n150", name: "150 mm reflector", apertureMm: 150, focalLengthMm: 750 },
  { id: "d200", name: "8-inch Dobsonian", apertureMm: 200, focalLengthMm: 1200 },
  { id: "m127", name: "127 mm Maksutov", apertureMm: 127, focalLengthMm: 1500 },
] as const satisfies readonly TelescopePreset[];

export type TelescopePresetId = (typeof TELESCOPE_PRESETS)[number]["id"];

/** The 150 mm reflector: the calibrated reference kit. */
export const DEFAULT_TELESCOPE_PRESET_ID: TelescopePresetId = "n150";

// eyepiece kits ---------------------------------------------------------------------------------

/**
 * One eyepiece of a kit, shaped like the `/gear` eyepiece form. Its field of view is named by
 * preset key, so the degrees come from `EYEPIECE_PRESETS` and are never repeated here.
 */
export interface EyepieceKitItem {
  name: string;
  focalLengthMm: number;
  afovPreset: EyepiecePresetKey;
}

export interface EyepieceKitPreset {
  id: string;
  name: string;
  eyepieces: readonly EyepieceKitItem[];
}

function plossl(focalLengthMm: number): EyepieceKitItem {
  return { name: `${focalLengthMm} mm Plössl`, focalLengthMm, afovPreset: "plossl" };
}

export const EYEPIECE_KIT_PRESETS = [
  { id: "pair", name: "Supplied pair", eyepieces: [plossl(25), plossl(10)] },
  { id: "plossl-set", name: "Plössl set", eyepieces: [plossl(32), plossl(17), plossl(13), plossl(8), plossl(6)] },
  { id: "none", name: "No eyepieces yet", eyepieces: [] },
] as const satisfies readonly EyepieceKitPreset[];

export type EyepieceKitPresetId = (typeof EYEPIECE_KIT_PRESETS)[number]["id"];

export const DEFAULT_EYEPIECE_KIT_ID: EyepieceKitPresetId = "pair";

// sky scenes ------------------------------------------------------------------------------------

/** A plain-language picture of the night sky that stands in for a Bortle class (FR-005). */
export interface SkyScene {
  id: string;
  title: string;
  /** What you see overhead on a clear, moonless night. */
  description: string;
  bortle: number;
}

export const SKY_SCENES = [
  {
    id: "city",
    title: "City centre",
    description: "The sky glows grey or orange, only the brightest stars and planets show, and there is no Milky Way.",
    bortle: 8,
  },
  {
    id: "suburb",
    title: "Suburb",
    description: "The main constellations are easy to trace, but the Milky Way is at most a faint haze straight up.",
    bortle: 6,
  },
  {
    id: "town",
    title: "Outer suburb or small town",
    description: "Hundreds of stars show, and the Milky Way is visible overhead but fades out towards the horizon.",
    bortle: 5,
  },
  {
    id: "village",
    title: "Village or countryside",
    description: "The Milky Way stretches clearly across the sky, with only a few glows from distant towns low down.",
    bortle: 4,
  },
  {
    id: "remote",
    title: "Remote dark site",
    description: "Stars crowd the whole sky, and the Milky Way is bright enough to show dark lanes and clumps.",
    bortle: 2,
  },
] as const satisfies readonly SkyScene[];

export type SkySceneId = (typeof SKY_SCENES)[number]["id"];

export const DEFAULT_SKY_SCENE_ID: SkySceneId = "suburb";
