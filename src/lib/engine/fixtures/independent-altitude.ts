import {
  Body,
  Equator,
  EquatorFromVector,
  Horizon,
  HorizonFromVector,
  RotateVector,
  Rotation_EQJ_EQD,
  Rotation_EQJ_HOR,
  Spherical,
  VectorFromSphere,
} from "astronomy-engine";
import type { Observer } from "astronomy-engine";

import type { PlanetKey } from "../planets";
import type { EquatorialJ2000 } from "../types";

/**
 * TEST-ONLY. The independent altitude oracle for the visibility property suites (Risk #3).
 *
 * Every helper recomputes a position straight from astronomy-engine, by a road the engine does not take, and
 * never reads the engine's own tracks, `bestWindow`, `objectTracks`, `planetTracks`, `moonState` or the
 * thresholds in `parameters.ts`: an oracle built from the code under test would move with it. Imports are
 * astronomy-engine and engine types only. Callers pass an `Observer`, so a suite at elevation 0 (Tonight, which
 * drops the site's elevation) builds `new Observer(lat, lon, 0)` and a suite with elevations uses the site's.
 *
 * Tolerance: the engine and these roads differ by arcseconds (the smallest margin seen was 0.0002 deg), so
 * suites compare with `ALTITUDE_TOLERANCE_DEG`, far under the 1 deg accuracy NFR (prd.md:488).
 */

/** Slack for the engine/oracle model differences, degrees (altitude and sun altitude). */
export const ALTITUDE_TOLERANCE_DEG = 0.05;

/**
 * Sun altitude at or below which the sky counts as dark for deep sky, by Bortle class: the PRD's table (Open
 * Question 7, prd.md:684): -18 for Bortle 1-4, -15 for 5-6, -12 for 7-9. Written out here on purpose: reading
 * `darknessThresholdDegForBortle` would let a production slip in that function move both sides of the check.
 */
export const DARK_THRESHOLD_BY_BORTLE: Readonly<Record<number, number>> = {
  1: -18,
  2: -18,
  3: -18,
  4: -18,
  5: -15,
  6: -15,
  7: -12,
  8: -12,
  9: -12,
};

/** Sun altitude at or below which planets and the Moon are listed (civil twilight, the PRD's -6 deg window). */
export const PLANET_WINDOW_THRESHOLD_DEG = -6;

/** The body of each planet key, written out here rather than taken from `planets.ts`. */
export const PLANET_BODIES: Readonly<Record<PlanetKey, Body>> = {
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
};

/**
 * Refracted altitude (degrees) of a fixed object with J2000 catalogue coordinates. The road: the J2000 unit vector
 * is rotated into the equator of date (`Rotation_EQJ_EQD`), turned into of-date RA/Dec and handed to `Horizon`
 * with "normal" refraction. The engine goes through `Rotation_EQJ_HOR` instead.
 */
export function deepSkyAltitudeDeg(object: EquatorialJ2000, time: Date, observer: Observer): number {
  const j2000 = VectorFromSphere(new Spherical(object.decDeg, object.raHours * 15, 1), time);
  const ofDate = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(time), j2000));
  return Horizon(time, observer, ofDate.ra, ofDate.dec, "normal").altitude;
}

/**
 * Refracted altitude (degrees) of a solar-system body (a planet or the Moon). The road: the body's J2000 vector
 * (`Equator(..., false, true)`) goes through `Rotation_EQJ_HOR` and `HorizonFromVector` with "normal"
 * refraction. The engine takes of-date coordinates into `Horizon` for bodies.
 */
export function bodyAltitudeDeg(body: Body, time: Date, observer: Observer): number {
  const j2000 = Equator(body, time, observer, false, true).vec;
  return HorizonFromVector(RotateVector(Rotation_EQJ_HOR(time, observer), j2000), "normal").lat;
}

/**
 * Geometric altitude (degrees, no refraction) of the Sun's centre, like the engine's twilight convention
 * (`sun.ts`): of-date apparent position, `Horizon` without a refraction model.
 */
export function sunAltitudeGeometricDeg(time: Date, observer: Observer): number {
  const eq = Equator(Body.Sun, time, observer, true, true);
  return Horizon(time, observer, eq.ra, eq.dec).altitude;
}
