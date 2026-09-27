// Which telescope the Tonight ranking is for (PRD FR-019), and which selector to show for it.
// Pure and island-safe: the /tonight shell, the TonightContent server island and the tests share these rules.

/** Remembers the last telescope picked on Tonight, on this device (like theme and language). */
export const TELESCOPE_COOKIE = "sidereus-telescope";

/** Up to this many telescopes are shown as pills; more switch to a dropdown. */
export const SELECTOR_PILL_LIMIT = 3;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shape check only (telescope ids are uuids). Whether the id is one of the user's telescopes is decided
 * by `chooseTelescope` against their own list, so a stale or foreign id is harmless.
 */
export function isTelescopeId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * The requested telescope when the user owns it, else the oldest (`telescopes` is in `created_at` order),
 * else `undefined` when they own none. A missing, deleted or foreign id falls back silently.
 */
export function chooseTelescope<T extends { id: string }>(
  telescopes: readonly T[],
  requestedId: string | undefined,
): T | undefined {
  return telescopes.find((t) => t.id === requestedId) ?? telescopes.at(0);
}

/** FR-019: no selector for a single telescope; pills for a few; a dropdown beyond that. */
export function selectorKind(count: number): "none" | "pills" | "dropdown" {
  if (count < 2) return "none";
  return count <= SELECTOR_PILL_LIMIT ? "pills" : "dropdown";
}
