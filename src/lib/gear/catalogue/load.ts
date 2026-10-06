/**
 * Lazy loaders for the catalogue's data. Each JSON file is its own chunk behind a dynamic `import()`, fetched once per
 * page (the promise is memoised), so a gear form pays for the data only when it asks. Island-safe.
 */

import type { EyepieceEntry, TelescopeEntry } from "./types";

let telescopes: Promise<readonly TelescopeEntry[]> | undefined;
let eyepieces: Promise<readonly EyepieceEntry[]> | undefined;

export function loadTelescopes(): Promise<readonly TelescopeEntry[]> {
  telescopes ??= import("./telescopes.json").then((module) => module.default as unknown as readonly TelescopeEntry[]);
  // A failed fetch must not be remembered, or the page could never retry.
  telescopes.catch(() => {
    telescopes = undefined;
  });
  return telescopes;
}

export function loadEyepieces(): Promise<readonly EyepieceEntry[]> {
  eyepieces ??= import("./eyepieces.json").then((module) => module.default as unknown as readonly EyepieceEntry[]);
  eyepieces.catch(() => {
    eyepieces = undefined;
  });
  return eyepieces;
}
