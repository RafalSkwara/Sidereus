/**
 * Pure mapping from a catalogue entry onto form state. Form fields hold strings, so every number is stringified; the
 * AFOV goes through `presetForAfov`, so 50 / 68 / 82 select their named preset and anything else selects `other`.
 * Island-safe: imports only the AFOV presets and the entry types.
 */

import { type AfovPreset, presetForAfov } from "../eyepiece-presets";
import type { EyepieceEntry, TelescopeEntry } from "./types";

export interface TelescopeFill {
  name: string;
  apertureMm: string;
  focalLengthMm: string;
}

export interface EyepieceFill {
  name: string;
  focalLengthMm: string;
  afovPreset: AfovPreset;
  afovDeg: string;
}

export function telescopeFill(entry: TelescopeEntry): TelescopeFill {
  return {
    name: entry.name,
    apertureMm: String(entry.apertureMm),
    focalLengthMm: String(entry.focalLengthMm),
  };
}

export function eyepieceFill(entry: EyepieceEntry): EyepieceFill {
  return {
    name: entry.name,
    focalLengthMm: String(entry.focalLengthMm),
    afovPreset: presetForAfov(entry.afovDeg),
    afovDeg: String(entry.afovDeg),
  };
}

/** The telescope's bundled eyepieces, in the telescope's order. An id with no matching entry is skipped. */
export function bundledEyepieces(telescope: TelescopeEntry, eyepieces: readonly EyepieceEntry[]): EyepieceEntry[] {
  const found: EyepieceEntry[] = [];
  for (const id of telescope.bundledEyepieces ?? []) {
    const entry = eyepieces.find((candidate) => candidate.id === id);
    if (entry) {
      found.push(entry);
    }
  }
  return found;
}
