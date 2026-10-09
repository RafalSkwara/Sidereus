import { EYEPIECE_PRESETS } from "@/lib/gear/eyepiece-presets";

import { addDays } from "../night";
import type { Site } from "../types";

/**
 * TEST-ONLY. The seeded generator and the site list shared by the property suites (Risk #3, Risk #4).
 *
 * Replayable: the same seed always yields the same cases, so a failure that names a case index and its inputs can
 * be rerun exactly. Nothing here reads engine output, and it must stay that way (see the README, "Generated
 * cases"). Build the case array at module scope from a seed; run every engine call inside `it` or `beforeAll`.
 */

/** mulberry32: a small seeded generator, so a property run uses the same cases every time. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export interface GeneratedSite extends Site {
  label: string;
  elevationM: number;
}

/**
 * Public reference points (cities and research bases, not anyone's home) spread over the sky the engine must
 * serve: the equator, mid latitudes both sides, the polar edge cases, the far-east zones whose local noon falls
 * on the previous UTC day. Zones are fixed here, so no tz lookup is needed.
 */
export const GENERATED_SITES: readonly GeneratedSite[] = [
  { label: "Quito", latitudeDeg: -0.18, longitudeDeg: -78.47, elevationM: 2850, timeZone: "America/Guayaquil" },
  { label: "Singapore", latitudeDeg: 1.35, longitudeDeg: 103.82, elevationM: 15, timeZone: "Asia/Singapore" },
  { label: "Kolkata", latitudeDeg: 22.57, longitudeDeg: 88.36, elevationM: 10, timeZone: "Asia/Kolkata" },
  {
    label: "Los Angeles",
    latitudeDeg: 34.05,
    longitudeDeg: -118.24,
    elevationM: 90,
    timeZone: "America/Los_Angeles",
  },
  { label: "Denver", latitudeDeg: 39.74, longitudeDeg: -104.99, elevationM: 1600, timeZone: "America/Denver" },
  { label: "Warsaw", latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 110, timeZone: "Europe/Warsaw" },
  { label: "Paris", latitudeDeg: 48.9, longitudeDeg: 2.35, elevationM: 35, timeZone: "Europe/Paris" },
  { label: "Helsinki", latitudeDeg: 60.17, longitudeDeg: 24.94, elevationM: 20, timeZone: "Europe/Helsinki" },
  { label: "Tromsø", latitudeDeg: 69.65, longitudeDeg: 18.96, elevationM: 10, timeZone: "Europe/Oslo" },
  {
    label: "Longyearbyen",
    latitudeDeg: 78.22,
    longitudeDeg: 15.65,
    elevationM: 10,
    timeZone: "Arctic/Longyearbyen",
  },
  { label: "Sydney", latitudeDeg: -33.87, longitudeDeg: 151.21, elevationM: 40, timeZone: "Australia/Sydney" },
  { label: "Santiago", latitudeDeg: -33.45, longitudeDeg: -70.67, elevationM: 520, timeZone: "America/Santiago" },
  { label: "Cape Town", latitudeDeg: -33.92, longitudeDeg: 18.42, elevationM: 25, timeZone: "Africa/Johannesburg" },
  {
    label: "Antarctic Peninsula",
    latitudeDeg: -64.8,
    longitudeDeg: -64.1,
    elevationM: 10,
    timeZone: "Antarctica/Rothera",
  },
  { label: "Auckland", latitudeDeg: -36.85, longitudeDeg: 174.76, elevationM: 20, timeZone: "Pacific/Auckland" },
  { label: "Kiritimati", latitudeDeg: 1.87, longitudeDeg: -157.4, elevationM: 3, timeZone: "Pacific/Kiritimati" },
];

export interface GeneratedTelescope {
  id: string;
  apertureMm: number;
  focalLengthMm: number;
}

export interface GeneratedEyepiece {
  id: string;
  focalLengthMm: number;
  afovDeg: number;
}

export interface GeneratedCase {
  site: GeneratedSite;
  /** The observing night's evening date, any day of 2026, `YYYY-MM-DD`. */
  date: string;
  bortle: number;
  minAltitudeDeg: number;
  telescope: GeneratedTelescope;
  /** 0 to 3 eyepieces in `created_at` order; an empty kit is allowed. */
  eyepieces: GeneratedEyepiece[];
}

const AFOV_PRESETS_DEG = Object.values(EYEPIECE_PRESETS).map((preset) => preset.afovDeg);

/**
 * One case from `random` (a `seeded` generator), in a fixed order of draws so the same seed gives the same cases.
 *
 * Ranges follow the gear schemas (`src/lib/gear/schemas.ts`) with a realistic telescope: aperture 50-400 mm at
 * f/3-f/16; Bortle 1-9; minimum altitude 0-60 with the two ends drawn on purpose about one case in twelve each;
 * eyepieces of 2-60 mm with an AFOV from `EYEPIECE_PRESETS`.
 */
export function generateCase(random: () => number): GeneratedCase {
  const site = GENERATED_SITES[Math.floor(random() * GENERATED_SITES.length)];
  const date = addDays("2026-01-01", Math.floor(random() * 365));
  const bortle = 1 + Math.floor(random() * 9);
  const edge = random();
  const minAltitudeDeg = edge < 0.08 ? 0 : edge < 0.16 ? 60 : Math.floor(random() * 61);
  const apertureMm = 50 + Math.floor(random() * 351);
  const focalRatio = 3 + random() * 13;
  const telescope = { id: "generated-telescope", apertureMm, focalLengthMm: Math.round(apertureMm * focalRatio) };
  const eyepieceCount = Math.floor(random() * 4);
  const eyepieces = Array.from({ length: eyepieceCount }, (_, i) => ({
    id: `generated-eyepiece-${i + 1}`,
    focalLengthMm: 2 + Math.floor(random() * 59),
    afovDeg: AFOV_PRESETS_DEG[Math.floor(random() * AFOV_PRESETS_DEG.length)],
  }));
  return { site, date, bortle, minAltitudeDeg, telescope, eyepieces };
}
