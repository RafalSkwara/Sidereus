/**
 * The search behind the gear catalogue's comboboxes (roadmap S-12): "every word matches". Each space-separated word
 * of the query must be part of the entry's name or of one of its aliases, so "heritage 130" finds "Heritage-130P"
 * and "150/750" finds "150 750". Island-safe: imports only the shared text normaliser, never the observation log.
 */

import { normalizeQuery } from "@/lib/text/normalize";

export interface Searchable {
  /** Starts with the brand: "Sky-Watcher Heritage-130P". */
  name: string;
  /** Other ways the entry is written ("Heritage 130", a former name). */
  aliases?: readonly string[];
}

/** `normalizeQuery`, and `-`, `/` and `.` read as spaces, so punctuation in model names never blocks a match. */
function normalize(value: string): string {
  return normalizeQuery(value.replace(/[-/.]/g, " "));
}

/**
 * The entries matching `query`, best first: those whose name, or a word of it (the brand is the name's first word),
 * starts with the query's first word come before the rest, and ties keep the catalogue's order. An empty query
 * returns every entry.
 */
export function searchCatalogue<T extends Searchable>(entries: readonly T[], query: string): T[] {
  const normalized = normalize(query);
  if (normalized === "") {
    return [...entries];
  }
  const tokens = normalized.split(" ");
  const first = tokens[0];

  const ranked: { entry: T; rank: number }[] = [];
  for (const entry of entries) {
    const name = normalize(entry.name);
    // Words never contain a space, so one joined string answers "is this word in the name or an alias" per word.
    const haystack = [name, ...(entry.aliases ?? []).map(normalize)].join(" ");
    if (!tokens.every((token) => haystack.includes(token))) {
      continue;
    }
    ranked.push({ entry, rank: name.split(" ").some((word) => word.startsWith(first)) ? 0 : 1 });
  }
  // `sort` is stable, so equal ranks keep the catalogue's order.
  return ranked.sort((a, b) => a.rank - b.rank).map(({ entry }) => entry);
}
