import tromso20260621 from "./stellarium/tromso-2026-06-21.json";
import warsaw20261010 from "./stellarium/warsaw-2026-10-10.json";
import warsaw20261024 from "./stellarium/warsaw-2026-10-24.json";

/**
 * TEST-ONLY. Typed access to the hand-read Stellarium fixtures.
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
