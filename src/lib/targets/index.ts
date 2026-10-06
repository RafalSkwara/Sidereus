import type { PlanetKey } from "@/lib/engine/planets";

/**
 * Target keys (M-2 S-01, the Moon since S-02, Caldwell objects since deep-sky-beyond-messier): what the observation
 * log, its URLs and the ranking's "seen" tag call an object. The grammar is closed and matches the
 * `observations_target_key` check in the database:
 *
 * - Messier: `M1`…`M110`, the catalogue's `id`;
 * - deep-sky (the Caldwell objects): `NGC1`…`NGC9999` and `IC1`…`IC9999`, the catalogue's `id` (space-free, no
 *   leading zero). The grammar only checks the shape; whether the catalogue lists the object is
 *   `isKnownTarget` in `./labels` (server-side), because this module stays free of the catalogue;
 * - planets: `mercury`, `venus`, `mars`, `jupiter`, `saturn`, `uranus`, `neptune`;
 * - the Moon: `moon`, its own kind (never a Messier key, so it has no Messier number).
 *
 * Keys are fixed-grammar values, so they may appear in URLs (never free text or coordinates).
 *
 * Island-safe: the engine's planet keys are imported as a type only (the engine pulls in astronomy-engine), so
 * the list is declared here: `satisfies` rejects a key the engine lacks, and `index.test.ts` checks it is the
 * engine's list, in the same order. The Moon's key is the literal the engine's `moonTarget` reads its "seen"
 * summary by; `index.test.ts` checks the two agree.
 */

/** Planet target keys in solar order; the same list as the engine's `PLANET_KEYS`. */
export const PLANET_TARGET_KEYS = [
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
] as const satisfies readonly PlanetKey[];

/** The Moon's target key; the same literal as the engine's `moonTarget` uses for its "seen" summary. */
export const MOON_TARGET_KEY = "moon";

export type MessierKey = `M${number}`;
export type MoonKey = typeof MOON_TARGET_KEY;
export type DeepSkyKey = `NGC${number}` | `IC${number}`;
export type TargetKey = MessierKey | DeepSkyKey | PlanetKey | MoonKey;
export type TargetKind = "messier" | "deep-sky" | "planet" | "moon";

const MESSIER_KEY = /^M([1-9]|[1-9][0-9]|10[0-9]|110)$/;
// The same pattern as the database's `observations_target_key` check.
const DEEP_SKY_KEY = /^(NGC|IC)[1-9][0-9]{0,3}$/;
const PLANETS: ReadonlySet<string> = new Set(PLANET_TARGET_KEYS);

export function isTargetKey(value: unknown): value is TargetKey {
  return (
    typeof value === "string" &&
    (MESSIER_KEY.test(value) || isDeepSkyKey(value) || isPlanetKey(value) || isMoonKey(value))
  );
}

/** An NGC or IC key by shape only ("NGC7000", "IC405"); the catalogue decides whether it exists. */
export function isDeepSkyKey(value: unknown): value is DeepSkyKey {
  return typeof value === "string" && DEEP_SKY_KEY.test(value);
}

export function isPlanetKey(value: unknown): value is PlanetKey {
  return typeof value === "string" && PLANETS.has(value);
}

export function isMoonKey(value: unknown): value is MoonKey {
  return value === MOON_TARGET_KEY;
}

/** 31 → "M31". The caller passes a catalogue number; the result is not range-checked. */
export function messierKey(n: number): MessierKey {
  return `M${n}`;
}

/** "M31" → 31; a deep-sky key, a planet key or the Moon's → `null`. */
export function messierNumber(key: TargetKey): number | null {
  return MESSIER_KEY.test(key) ? Number(key.slice(1)) : null;
}

export function targetKind(key: TargetKey): TargetKind {
  if (isPlanetKey(key)) {
    return "planet";
  }
  if (isMoonKey(key)) {
    return "moon";
  }
  if (isDeepSkyKey(key)) {
    return "deep-sky";
  }
  if (MESSIER_KEY.test(key)) {
    return "messier";
  }
  // A `TargetKey` is always one of the four; a value that is not (a cast) must not read as Messier.
  throw new Error("Not a target key");
}

/**
 * A target from a query parameter (`?object=`, `?logged=`, `?saved=`…): a key, or the bare Messier number older
 * links carry ("31" → "M31"). Anything else is `null`.
 */
export function parseTargetParam(value: string | null | undefined): TargetKey | null {
  if (value == null) {
    return null;
  }
  const key = /^\d{1,3}$/.test(value) ? messierKey(Number(value)) : value;
  return isTargetKey(key) ? key : null;
}
