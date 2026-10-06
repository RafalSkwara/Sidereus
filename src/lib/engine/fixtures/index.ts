import { findDeepSky, findMessier } from "@/lib/catalogue";

import { observingNight } from "../night";
import { darknessThresholdDegForBortle } from "../parameters";
import { PLANET_KEYS } from "../planets";
import type { PlanetKey } from "../planets";
import { darkWindow } from "../sun";
import type { DarkWindow, EquatorialJ2000, Site } from "../types";
import skyfieldMoonWarsaw20261024 from "./skyfield/moon-warsaw-2026-10-24.json";
import skyfieldPlanetsWarsaw20261010 from "./skyfield/planets-warsaw-2026-10-10.json";
import tromso20260621 from "./stellarium/tromso-2026-06-21.json";
import warsaw20261010 from "./stellarium/warsaw-2026-10-10.json";
import warsaw20261024 from "./stellarium/warsaw-2026-10-24.json";

/**
 * TEST-ONLY. Typed access to the hand-read Stellarium fixtures and the generated Skyfield references.
 *
 * This file lives under the engine directory for locality but is not part of the engine: it is
 * excluded from the purity guard and must never be imported by production code. Fixtures are
 * statically imported and validated into a discriminated union per section, so tests narrow on
 * `status` and never touch `any` or non-null assertions.
 */

export type SectionStatus = "pending" | "captured" | "not-applicable";

export interface FixtureSite {
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
  elevationM: number;
  timeZone: string;
}

export interface FixtureSource {
  tool: string;
  version: string;
  capturedBy: string;
  capturedAt: string;
}

interface ThresholdTime {
  thresholdDeg: number;
  /** ISO 8601 with offset, or null when the event does not occur. */
  time: string | null;
}

export interface SunSection {
  status: SectionStatus;
  reason?: string;
  expectNoDarkness: boolean;
  sunset: string | null;
  sunrise: string | null;
  darkStart: ThresholdTime;
  darkEnd: ThresholdTime;
}

export interface MoonSample {
  time: string;
  altitudeDeg: number;
  azimuthDeg: number;
  illuminatedFraction: number;
}

export interface ObjectSample {
  id: string;
  time: string;
  altitudeDeg: number;
  azimuthDeg: number;
}

export type MoonSection =
  { status: "captured"; samples: MoonSample[] } | { status: "pending" | "not-applicable"; reason?: string };

export type ObjectsSection =
  { status: "captured"; samples: ObjectSample[] } | { status: "pending" | "not-applicable"; reason?: string };

export interface StellariumFixture {
  name: string;
  site: FixtureSite;
  night: string;
  source: FixtureSource;
  sun: SunSection;
  moon: MoonSection;
  objects: ObjectsSection;
}

function fail(name: string, message: string): never {
  throw new Error(`fixture ${name}: ${message}`);
}

function asRecord(value: unknown, name: string, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    fail(name, `${what} is not an object`);
  }
  return value as Record<string, unknown>;
}

function str(o: Record<string, unknown>, key: string, name: string): string {
  const v = o[key];
  if (typeof v !== "string") {
    fail(name, `${key} must be a string`);
  }
  return v;
}

function num(o: Record<string, unknown>, key: string, name: string): number {
  const v = o[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    fail(name, `${key} must be a finite number`);
  }
  return v;
}

function status(o: Record<string, unknown>, name: string, section: string): SectionStatus {
  const v = o.status;
  if (v === "pending" || v === "captured" || v === "not-applicable") {
    return v;
  }
  fail(name, `${section}.status must be pending | captured | not-applicable`);
}

/** An ISO 8601 instant with an explicit offset, e.g. 2026-10-10T17:52:00+02:00, or null. */
function isoOrNull(o: Record<string, unknown>, key: string, name: string): string | null {
  const v = o[key];
  if (v === null) {
    return null;
  }
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?[+-]\d{2}:\d{2}$/.test(v)) {
    fail(name, `${key} must be an ISO 8601 time with a numeric offset, or null`);
  }
  if (Number.isNaN(Date.parse(v))) {
    fail(name, `${key} "${v}" does not parse`);
  }
  return v;
}

function iso(o: Record<string, unknown>, key: string, name: string): string {
  const v = isoOrNull(o, key, name);
  if (v === null) {
    fail(name, `${key} must not be null in a captured section`);
  }
  return v;
}

function thresholdTime(o: Record<string, unknown>, key: string, name: string): ThresholdTime {
  const t = asRecord(o[key], name, key);
  return { thresholdDeg: num(t, "thresholdDeg", name), time: isoOrNull(t, "time", name) };
}

function sunSection(raw: unknown, name: string): SunSection {
  const o = asRecord(raw, name, "sun");
  const expectNoDarkness = o.expectNoDarkness;
  if (typeof expectNoDarkness !== "boolean") {
    fail(name, "sun.expectNoDarkness must be a boolean");
  }
  return {
    status: status(o, name, "sun"),
    reason: typeof o.reason === "string" ? o.reason : undefined,
    expectNoDarkness,
    sunset: isoOrNull(o, "sunset", name),
    sunrise: isoOrNull(o, "sunrise", name),
    darkStart: thresholdTime(o, "darkStart", name),
    darkEnd: thresholdTime(o, "darkEnd", name),
  };
}

function samplesOf(o: Record<string, unknown>, name: string, section: string): Record<string, unknown>[] {
  const v = o.samples;
  if (!Array.isArray(v)) {
    fail(name, `${section}.samples must be an array`);
  }
  return v.map((s: unknown, i) => asRecord(s, name, `${section}.samples[${i}]`));
}

function moonSection(raw: unknown, name: string): MoonSection {
  const o = asRecord(raw, name, "moon");
  const s = status(o, name, "moon");
  if (s !== "captured") {
    return { status: s, reason: typeof o.reason === "string" ? o.reason : undefined };
  }
  const samples = samplesOf(o, name, "moon").map((m) => ({
    time: iso(m, "time", name),
    altitudeDeg: num(m, "altitudeDeg", name),
    azimuthDeg: num(m, "azimuthDeg", name),
    illuminatedFraction: num(m, "illuminatedFraction", name),
  }));
  if (samples.length === 0) {
    fail(name, "moon.samples must not be empty when captured");
  }
  return { status: "captured", samples };
}

function objectsSection(raw: unknown, name: string): ObjectsSection {
  const o = asRecord(raw, name, "objects");
  const s = status(o, name, "objects");
  if (s !== "captured") {
    return { status: s, reason: typeof o.reason === "string" ? o.reason : undefined };
  }
  const samples = samplesOf(o, name, "objects").map((m) => ({
    id: str(m, "id", name),
    time: iso(m, "time", name),
    altitudeDeg: num(m, "altitudeDeg", name),
    azimuthDeg: num(m, "azimuthDeg", name),
  }));
  if (samples.length === 0) {
    fail(name, "objects.samples must not be empty when captured");
  }
  return { status: "captured", samples };
}

export function parseFixture(raw: unknown, name: string): StellariumFixture {
  const o = asRecord(raw, name, "fixture");
  const site = asRecord(o.site, name, "site");
  const source = asRecord(o.source, name, "source");
  return {
    name,
    site: {
      name: str(site, "name", name),
      latitudeDeg: num(site, "latitudeDeg", name),
      longitudeDeg: num(site, "longitudeDeg", name),
      elevationM: num(site, "elevationM", name),
      timeZone: str(site, "timeZone", name),
    },
    night: str(o, "night", name),
    source: {
      tool: str(source, "tool", name),
      version: str(source, "version", name),
      capturedBy: str(source, "capturedBy", name),
      capturedAt: str(source, "capturedAt", name),
    },
    sun: sunSection(o.sun, name),
    moon: moonSection(o.moon, name),
    objects: objectsSection(o.objects, name),
  };
}

export const FIXTURES: readonly StellariumFixture[] = [
  parseFixture(warsaw20261010, "warsaw-2026-10-10"),
  parseFixture(warsaw20261024, "warsaw-2026-10-24"),
  parseFixture(tromso20260621, "tromso-2026-06-21"),
];

export interface PlanetReferenceSample {
  /** ISO 8601 with offset. */
  time: string;
  planet: PlanetKey;
  /** Apparent (refracted) altitude. */
  altitudeDeg: number;
  azimuthDeg: number;
  apparentDiameterArcsec: number;
}

export interface PlanetReference {
  name: string;
  site: FixtureSite;
  night: string;
  samples: PlanetReferenceSample[];
}

function planetKey(o: Record<string, unknown>, name: string): PlanetKey {
  const v = o.planet;
  const key = PLANET_KEYS.find((k) => k === v);
  if (key === undefined) {
    fail(name, `planet must be one of ${PLANET_KEYS.join(", ")}`);
  }
  return key;
}

/** Validates a Skyfield planet reference (`scripts/planet-reference.py`, see the README). */
export function parsePlanetReference(raw: unknown, name: string): PlanetReference {
  const o = asRecord(raw, name, "reference");
  asRecord(o.provenance, name, "provenance");
  const site = asRecord(o.site, name, "site");
  const samples = samplesOf(o, name, "reference").map((m) => ({
    time: iso(m, "time", name),
    planet: planetKey(m, name),
    altitudeDeg: num(m, "altitudeDeg", name),
    azimuthDeg: num(m, "azimuthDeg", name),
    apparentDiameterArcsec: num(m, "apparentDiameterArcsec", name),
  }));
  if (samples.length === 0) {
    fail(name, "samples must not be empty");
  }
  return {
    name,
    site: {
      name: str(site, "name", name),
      latitudeDeg: num(site, "latitudeDeg", name),
      longitudeDeg: num(site, "longitudeDeg", name),
      elevationM: num(site, "elevationM", name),
      timeZone: str(site, "timeZone", name),
    },
    night: str(o, "night", name),
    samples,
  };
}

export const PLANET_REFERENCES: readonly PlanetReference[] = [
  parsePlanetReference(skyfieldPlanetsWarsaw20261010, "planets-warsaw-2026-10-10"),
];

export interface MoonReferenceSample {
  /** ISO 8601 with offset. */
  time: string;
  /** Topocentric apparent (refracted) altitude. */
  altitudeDeg: number;
  azimuthDeg: number;
  /** Geocentric illuminated fraction, [0, 1]. */
  illuminatedFraction: number;
  /** Geocentric Sun–Moon ecliptic-longitude difference, [0, 360). */
  elongationDeg: number;
}

export interface MoonReference {
  name: string;
  site: FixtureSite;
  night: string;
  samples: MoonReferenceSample[];
}

/** Validates a Skyfield Moon reference (`scripts/moon-reference.py`, see the README). */
export function parseMoonReference(raw: unknown, name: string): MoonReference {
  const o = asRecord(raw, name, "reference");
  const provenance = asRecord(o.provenance, name, "provenance");
  for (const key of ["tool", "version", "ephemeris", "script"]) {
    str(provenance, key, name);
  }
  const site = asRecord(o.site, name, "site");
  const samples = samplesOf(o, name, "reference").map((m) => ({
    time: iso(m, "time", name),
    altitudeDeg: num(m, "altitudeDeg", name),
    azimuthDeg: num(m, "azimuthDeg", name),
    illuminatedFraction: num(m, "illuminatedFraction", name),
    elongationDeg: num(m, "elongationDeg", name),
  }));
  if (samples.length === 0) {
    fail(name, "samples must not be empty");
  }
  return {
    name,
    site: {
      name: str(site, "name", name),
      latitudeDeg: num(site, "latitudeDeg", name),
      longitudeDeg: num(site, "longitudeDeg", name),
      elevationM: num(site, "elevationM", name),
      timeZone: str(site, "timeZone", name),
    },
    night: str(o, "night", name),
    samples,
  };
}

export const MOON_REFERENCES: readonly MoonReference[] = [
  parseMoonReference(skyfieldMoonWarsaw20261024, "moon-warsaw-2026-10-24"),
];

/** Synthetic-test sites shared across the engine tests (public reference points, not anyone's home). */
export const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 110, timeZone: "Europe/Warsaw" };
export const TROMSO: Site = { latitudeDeg: 69.65, longitudeDeg: 18.96, elevationM: 10, timeZone: "Europe/Oslo" };

/** J2000 coordinates of a catalogue object by fixture id ("M31"); throws for an unknown id. */
export function messierTarget(id: string): EquatorialJ2000 {
  const object = findMessier(Number(id.slice(1)));
  if (object === undefined) {
    throw new Error(`fixture references ${id}, which is not in the Messier catalogue`);
  }
  return { raHours: object.raHours, decDeg: object.decDeg };
}

/** J2000 coordinates of a deep-sky object by catalogue key ("M31", "NGC869"); throws for an unknown key. */
export function deepSkyTarget(id: string): EquatorialJ2000 {
  const object = findDeepSky(id);
  if (object === undefined) {
    throw new Error(`fixture references ${id}, which is not in the deep-sky catalogue`);
  }
  return { raHours: object.raHours, decDeg: object.decDeg };
}

/** A 150/750 telescope, shared by the ranking tests. */
export const TELESCOPE = { id: "t1", apertureMm: 150, focalLengthMm: 750 };

/** A 25 mm and a 10 mm eyepiece (50° apparent field), in `created_at` order. */
export const EYEPIECES = [
  { id: "e25", focalLengthMm: 25, afovDeg: 50 },
  { id: "e10", focalLengthMm: 10, afovDeg: 50 },
];

/** The dark window over Warsaw for the night of `date` at `bortle` (6 unless given); throws when there is none. */
export function warsawDarkWindow(date = "2026-10-10", bortle = 6): Extract<DarkWindow, { kind: "window" }> {
  const dark = darkWindow(WARSAW, observingNight(date, WARSAW.timeZone), darknessThresholdDegForBortle(bortle));
  if (dark.kind !== "window") {
    throw new Error(`expected a dark window on ${date} in Warsaw`);
  }
  return dark;
}

/** The engine `Site` for a fixture (shared by every fixture-driven test). */
export function siteOf(fixture: { site: FixtureSite }): Site {
  return {
    latitudeDeg: fixture.site.latitudeDeg,
    longitudeDeg: fixture.site.longitudeDeg,
    elevationM: fixture.site.elevationM,
    timeZone: fixture.site.timeZone,
  };
}

/** Smallest angle between two azimuths in degrees, wrapping at 360 (shared by every azimuth assertion). */
export function circularDeltaDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/** Parses a fixture time (ISO 8601 with offset) to epoch milliseconds. */
export function fixtureTimeMs(iso8601: string): number {
  return Date.parse(iso8601);
}

/** Absolute difference between two instants, in minutes. */
export function minutesBetween(a: Date | number, b: Date | number): number {
  const aMs = typeof a === "number" ? a : a.getTime();
  const bMs = typeof b === "number" ? b : b.getTime();
  return Math.abs(aMs - bMs) / 60_000;
}
