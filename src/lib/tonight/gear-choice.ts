// Which site and which telescope Tonight is for (PRD FR-012, FR-019), and which selector to show for each.
// Pure and island-safe: the /tonight shell, the TonightContent server island and the tests share these rules.

/** Remembers the last site picked on Tonight, on this device (like theme and language). */
export const SITE_COOKIE = "sidereus-site";

/** Remembers the last telescope picked on Tonight, on this device (like theme and language). */
export const TELESCOPE_COOKIE = "sidereus-telescope";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shape check only (site and telescope ids are uuids). Whether the id is one of the user's own is decided by
 * `chooseOwned` against their own list, so a stale or foreign id is harmless.
 */
export function isGearId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * The requested item when the user owns it, else the oldest (`items` is in `created_at` order), else
 * `undefined` when they own none. A missing, deleted or foreign id falls back silently.
 */
export function chooseOwned<T extends { id: string }>(
  items: readonly T[],
  requestedId: string | undefined,
): T | undefined {
  return items.find((item) => item.id === requestedId) ?? items.at(0);
}

/** FR-012 / FR-019: no selector for a single item; a select from two (the pills were retired in ui-user-adjustments). */
export function selectorKind(count: number): "none" | "select" {
  return count < 2 ? "none" : "select";
}
