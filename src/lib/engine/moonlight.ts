import type { MessierObject } from "@/lib/catalogue";

import { BRIGHT_CORE_OFFSET_MAG } from "./parameters";

/**
 * The moonlit sky at an object (moonlight-and-the-verdict), after Krisciunas & Schaefer 1991 (PASP 103, 1033).
 * Pure: every input is explicit. Brightness is in nanolamberts (nL), the model's native unit, and converts to
 * V mag/arcsec² with `nlToMag`.
 *
 * The model is single-scattering and V-band only, and weak near the horizon and within a few degrees of the
 * Moon; the ranking only needs it to tell a faint galaxy beside a bright Moon from a cluster far from a thin one.
 */

export interface SkyBrightnessInput {
  /** Sun–Moon–Earth phase angle, degrees; 0 is full, 180 is new. */
  moonPhaseAngleDeg: number;
  moonAltitudeDeg: number;
  objectAltitudeDeg: number;
  /** Angular separation between the Moon and the object, degrees. */
  separationDeg: number;
  /** The moonless zenith sky, V mag/arcsec² (`darkSkyZenithMagForBortle`). */
  darkZenithMag: number;
  /** V-band extinction, mag per airmass (`EXTINCTION_V`). */
  extinction: number;
}

export interface SkyBrightness {
  /** The moonless sky at the object's altitude, nL. */
  darkNL: number;
  /** The Moon's scattered light at the object, nL; 0 when either body is below the horizon. */
  moonNL: number;
}

const DEG = Math.PI / 180;

/**
 * Below this separation the Mie term is clamped: K&S's `6.2e7 / ρ²` diverges at the Moon's centre, and nothing
 * closer than the Moon's own radius is an object behind the sky.
 */
const MIN_SEPARATION_DEG = 0.25;

/** V mag/arcsec² → nL (K&S eq. 1 inverted). */
export function magToNL(mag: number): number {
  return 34.08 * Math.exp(20.7233 - 0.92104 * mag);
}

/** nL → V mag/arcsec². */
export function nlToMag(nl: number): number {
  return (20.7233 - Math.log(nl / 34.08)) / 0.92104;
}

/** K&S eq. 3: optical path length relative to the zenith at zenith distance `zenithDeg`. */
function airmass(zenithDeg: number): number {
  return 1 / Math.sqrt(1 - 0.96 * Math.sin(zenithDeg * DEG) ** 2);
}

/** K&S eq. 20: the Moon's illuminance outside the atmosphere for phase angle `alphaDeg`, with the opposition surge. */
function moonIlluminance(alphaDeg: number): number {
  const alpha = Math.abs(alphaDeg);
  const istar = 10 ** (-0.4 * (3.84 + 0.026 * alpha + 4e-9 * alpha ** 4));
  return alpha < 7 ? istar * 1.35 : istar;
}

/**
 * K&S eq. 21: the scattering function at separation `rhoDeg`, Rayleigh plus Mie. Within 10° the Mie term is K&S's
 * empirical `6.2e7 / ρ²`, as in Thorstensen's skycalc (`lunskybright`). The model is monotonic within 10° and from
 * 10° to 90°, but not across the 10° seam (a jump of about 15%) nor past 90°, where Rayleigh backscatter rises.
 */
function scattering(rhoDeg: number): number {
  const rho = Math.max(rhoDeg, MIN_SEPARATION_DEG);
  const rayleigh = 10 ** 5.36 * (1.06 + Math.cos(rho * DEG) ** 2);
  const mie = rho < 10 ? 6.2e7 / rho ** 2 : 10 ** (6.15 - rho / 40);
  return rayleigh + mie;
}

/** The sky brightness at an object's position: the moonless sky and the Moon's added light (K&S eqs. 2, 15). */
export function skyBrightnessNL(input: SkyBrightnessInput): SkyBrightness {
  const { moonPhaseAngleDeg, moonAltitudeDeg, objectAltitudeDeg, separationDeg, darkZenithMag, extinction } = input;
  const zenithDeg = 90 - objectAltitudeDeg;
  const x = airmass(zenithDeg);
  const darkNL = magToNL(darkZenithMag) * 10 ** (-0.4 * extinction * (x - 1)) * x;
  if (moonAltitudeDeg <= 0 || objectAltitudeDeg <= 0) {
    return { darkNL, moonNL: 0 };
  }
  const moonNL =
    scattering(separationDeg) *
    moonIlluminance(moonPhaseAngleDeg) *
    10 ** (-0.4 * extinction * airmass(90 - moonAltitudeDeg)) *
    (1 - 10 ** (-0.4 * extinction * x));
  return { darkNL, moonNL };
}

/** How much the Moon brightens the sky, magnitudes: 0 without the Moon, larger the more it adds. */
export function moonBrighteningMag(sky: SkyBrightness): number {
  return 2.5 * Math.log10((sky.darkNL + sky.moonNL) / sky.darkNL);
}

/**
 * The surface brightness of an object's bright core, V mag/arcsec²: its magnitude spread over the catalogue
 * ellipse (π/4·a·b, arcmin² → arcsec²), less `BRIGHT_CORE_OFFSET_MAG`. Without a minor axis the object is taken as
 * round (b = a); without a major axis there is nothing to spread over, so `null`.
 */
export function effectiveSurfaceBrightness(
  object: Pick<MessierObject, "vMag" | "majorAxisArcmin" | "minorAxisArcmin">,
): number | null {
  const a = object.majorAxisArcmin;
  if (a === null) {
    return null;
  }
  const b = object.minorAxisArcmin ?? a;
  return object.vMag + 2.5 * Math.log10((Math.PI / 4) * a * b * 3600) - BRIGHT_CORE_OFFSET_MAG;
}
