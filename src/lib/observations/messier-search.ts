/**
 * Search behind the log's object picker (roadmap S-07, FR-022). The page builds one option per Messier object
 * (localised and English names, designation) and the island filters them as the user types. Island-safe: no
 * imports, so the catalogue JSON never reaches the browser bundle.
 */

export interface MessierOption {
  messier: number;
  /** "M31" */
  id: string;
  /** What the input shows once chosen: "M31 · Andromeda Galaxy", or "M3" for an object without a common name. */
  label: string;
  /** A secondary line in the list: designation and constellation, e.g. "NGC 224 · And". */
  detail: string;
  /** Every name the object can be found by (localised, English, designation). */
  names: readonly string[];
}

/** Lower case, accents stripped (Polish ł has no decomposition, so it is mapped by hand), spaces collapsed. */
export function normalizeQuery(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ł/g, "l").replace(/\s+/g, " ").trim();
}

const NUMBER_QUERY = /^m?\s*(\d{1,3})$/;

/**
 * The options matching `query`, best first. A number ("31", "m31", "M 31") matches objects whose number starts
 * with it, in number order, so the exact one comes first (M3 before M30-M39). Anything else matches names by
 * substring, ignoring case, accents and spaces, with names that start with the query first. An empty query
 * returns every option.
 */
export function filterMessier(options: readonly MessierOption[], query: string): MessierOption[] {
  const q = normalizeQuery(query);
  if (q === "") {
    return [...options];
  }

  const number = NUMBER_QUERY.exec(q);
  if (number) {
    const digits = number[1];
    // In number order the exact match always comes first: it is the shortest number with these leading digits.
    return options.filter((option) => String(option.messier).startsWith(digits)).sort((a, b) => a.messier - b.messier);
  }

  const compact = q.replace(/ /g, "");
  const rank = (option: MessierOption): number => {
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
  return options
    .map((option) => ({ option, rank: rank(option) }))
    .filter(({ rank }) => rank !== Infinity)
    .sort((a, b) => a.rank - b.rank || a.option.messier - b.option.messier)
    .map(({ option }) => option);
}
