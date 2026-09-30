import type { PlanetKey } from "@/lib/engine/planets";

/**
 * Target keys (M-2 S-01): what the observation log, its URLs and the ranking's "seen" tag call an object. The
 * grammar is closed and matches the `observations_target_key` check in the database:
 *
 * - Messier: `M1`…`M110`, the catalogue's `id`;
 * - planets: `mercury`, `venus`, `mars`, `jupiter`, `saturn`, `uranus`, `neptune`.
 *
 * Keys are fixed-grammar values, so they may appear in URLs (never free text or coordinates).
 *
 * Island-safe: the engine's planet keys are imported as a type only (the engine pulls in astronomy-engine), so
 * the list is declared here: `satisfies` rejects a key the engine lacks, and `index.test.ts` checks it is the
 * engine's list, in the same order.
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

export type MessierKey = `M${number}`;
export type TargetKey = MessierKey | PlanetKey;
export type TargetKind = "messier" | "planet";

const MESSIER_KEY = /^M([1-9]|[1-9][0-9]|10[0-9]|110)$/;
const PLANETS: ReadonlySet<string> = new Set(PLANET_TARGET_KEYS);

export function isTargetKey(value: unknown): value is TargetKey {
  return typeof value === "string" && (MESSIER_KEY.test(value) || isPlanetKey(value));
}

export function isPlanetKey(value: unknown): value is PlanetKey {
  return typeof value === "string" && PLANETS.has(value);
}

/** 31 → "M31". The caller passes a catalogue number; the result is not range-checked. */
export function messierKey(n: number): MessierKey {
  return `M${n}`;
}

/** "M31" → 31; a planet key → `null`. */
export function messierNumber(key: TargetKey): number | null {
  return MESSIER_KEY.test(key) ? Number(key.slice(1)) : null;
}

export function targetKind(key: TargetKey): TargetKind {
  return isPlanetKey(key) ? "planet" : "messier";
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
