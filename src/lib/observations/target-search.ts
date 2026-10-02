/**
 * Search behind the log's object picker (roadmap S-07, FR-022; planets since M-2 S-01, the Moon since S-02). The
 * page builds one option per target (the Messier objects with their localised and English names and designation,
 * then the Moon and the planets with their localised and English names) and the island filters them as the user
 * types. Island-safe: imports only the target key grammar, so the catalogue JSON never reaches the browser bundle.
 */

import { messierNumber, type TargetKey } from "@/lib/targets";

export interface TargetOption {
  /** The target key the form posts: "M31", "moon", "jupiter". */
  key: TargetKey;
  /** What stands for the target: "M31", or the Moon's or a planet's localised name. */
  id: string;
  /** What the input shows once chosen: "M31 · Andromeda Galaxy", "M3", "Księżyc" or "Jowisz". */
  label: string;
  /** A secondary line in the list: designation and constellation ("NGC 224 · And"), "Earth's satellite" or "Planet". */
  detail: string;
  /** Every name the target can be found by (localised, English, designation). */
  names: readonly string[];
}

/** Lower case, accents stripped (Polish ł has no decomposition, so it is mapped by hand), spaces collapsed. */
export function normalizeQuery(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ł/g, "l").replace(/\s+/g, " ").trim();
}

const NUMBER_QUERY = /^m?\s*(\d{1,3})$/;

/**
 * The options matching `query`, best first. A number ("31", "m31", "M 31") matches Messier objects whose number
 * starts with it, in number order, so the exact one comes first (M3 before M30-M39); it never matches the Moon or a
 * planet. Anything else matches names by substring, ignoring case, accents and spaces, with names that start with
 * the query first and ties in the options' order (Messier objects by number, then the Moon, then the planets). An
 * empty query returns every option.
 */
export function filterTargets(options: readonly TargetOption[], query: string): TargetOption[] {
  const q = normalizeQuery(query);
  if (q === "") {
    return [...options];
  }

  const number = NUMBER_QUERY.exec(q);
  if (number) {
    const digits = number[1];
    // In number order the exact match always comes first: it is the shortest number with these leading digits.
    return options
      .map((option) => ({ option, messier: messierNumber(option.key) }))
      .filter((entry): entry is { option: TargetOption; messier: number } => entry.messier !== null)
      .filter(({ messier }) => String(messier).startsWith(digits))
      .sort((a, b) => a.messier - b.messier)
      .map(({ option }) => option);
  }

  const compact = q.replace(/ /g, "");
  const rank = (option: TargetOption): number => {
    let best = Infinity;
    for (const name of [option.label, ...option.names]) {
      const normalized = normalizeQuery(name);
      if (normalized.startsWith(q) || normalized.replace(/ /g, "").startsWith(compact)) {
        return 0;
      }
      if (normalized.includes(q) || normalized.replace(/ /g, "").includes(compact)) {
        best = 1;
      }
    }
    return best;
  };
  // `sort` is stable, so equal ranks keep the options' order.
  return options
    .map((option) => ({ option, rank: rank(option) }))
    .filter(({ rank }) => rank !== Infinity)
    .sort((a, b) => a.rank - b.rank)
    .map(({ option }) => option);
}
