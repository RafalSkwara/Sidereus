/**
 * The fixed apparent-field-of-view presets a user picks from when adding an eyepiece (FR-009).
 * Anything else is entered as `other` with an explicit AFOV.
 */

export const EYEPIECE_PRESETS = {
  plossl: { label: "Plössl (~50°)", afovDeg: 50 },
  wide: { label: "Wide-field (~68°)", afovDeg: 68 },
  ultrawide: { label: "Ultra-wide (~82°)", afovDeg: 82 },
} as const;

export type EyepiecePresetKey = keyof typeof EYEPIECE_PRESETS;

/** The values of the eyepiece form's AFOV choice, in display order. */
export const AFOV_PRESET_OPTIONS = ["plossl", "wide", "ultrawide", "other"] as const;

export type AfovPreset = (typeof AFOV_PRESET_OPTIONS)[number];

const PRESET_KEYS = Object.keys(EYEPIECE_PRESETS) as EyepiecePresetKey[];

/** The preset whose AFOV equals `afovDeg`, or `other`, so an edit form preselects the right choice. */
export function presetForAfov(afovDeg: number): AfovPreset {
  return PRESET_KEYS.find((key) => EYEPIECE_PRESETS[key].afovDeg === afovDeg) ?? "other";
}
