/**
 * Lower case, accents stripped (Polish ł has no decomposition, so it is mapped by hand), spaces collapsed. The one
 * rule every search box in the app shares (the log's object picker, the gear catalogue). Island-safe: no imports.
 */
export function normalizeQuery(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ł/g, "l").replace(/\s+/g, " ").trim();
}
