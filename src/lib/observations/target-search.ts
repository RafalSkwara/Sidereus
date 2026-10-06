/**
 * Search behind the log's object picker (roadmap S-07, FR-022; planets since M-2 S-01, the Moon since S-02,
 * Caldwell objects since deep-sky-beyond-messier). The page builds one option per target (the Messier objects
 * with their localised and English names and designation; then the Moon and the planets with their localised and
 * English names; then the Caldwell objects, also found by "C 20" / "Caldwell 20") and the island filters them as
 * the user types. Island-safe: imports only the target key grammar, so the catalogue JSON never reaches the browser bundle.
 */

import { normalizeQuery } from "@/lib/text/normalize";
import { messierNumber, type TargetKey } from "@/lib/targets";

// The rule moved to `lib/text` so the gear catalogue need not depend on the log; existing imports keep working.
export { normalizeQuery };

export interface TargetOption {
  /** The target key the form posts: "M31", "NGC7000", "moon", "jupiter". */
  key: TargetKey;
  /** What stands for the target: "M31", "NGC 7000", or the Moon's or a planet's localised name. */
  id: string;
  /** What the input shows once chosen: "M31 · Andromeda Galaxy", "M3", "NGC 7000 · North America Nebula", "Księżyc" or "Jowisz". */
  label: string;
  /** A secondary line in the list: designation and constellation ("NGC 224 · And", "Caldwell 20 · Cyg"), "Earth's satellite" or "Planet". */
  detail: string;
  /** Every name the target can be found by (localised, English, designation, and for a Caldwell object "C 20" and "Caldwell 20"). */
  names: readonly string[];
}

const NUMBER_QUERY = /^(m|ngc|ic|c|caldwell)?\s*(\d{1,4})$/;
const DESIGNATION_NAME = /^(ngc|ic) (\d{1,4})(?: \/ (\d{1,4}))?$/;
const CALDWELL_NAME = /^c (\d{1,3})$/;

/**
 * The numbers an option answers to for a number query's prefix. `m` (or none): its Messier number. `ngc` / `ic`:
 * the numbers of its NGC / IC designation names ("NGC 869 / 884" gives both). `c` / `caldwell`: its Caldwell
 * number, read from the "C 20" name. Read from `names`, so an option needs nothing beyond what the page built.
 */
function queryNumbers(option: TargetOption, prefix: string): number[] {
  if (prefix === "" || prefix === "m") {
    const messier = messierNumber(option.key);
    return messier === null ? [] : [messier];
  }
  const numbers: number[] = [];
  for (const name of option.names) {
    const normalized = normalizeQuery(name);
    if (prefix === "c" || prefix === "caldwell") {
      const caldwell = CALDWELL_NAME.exec(normalized);
      if (caldwell) {
        numbers.push(Number(caldwell[1]));
      }
      continue;
    }
    const designation = DESIGNATION_NAME.exec(normalized);
    if (designation?.[1] === prefix) {
      numbers.push(Number(designation[2]));
      if (designation[3]) {
        numbers.push(Number(designation[3]));
      }
    }
  }
  return numbers;
}

/**
 * The options matching `query`, best first. A number query is a number with an optional prefix, matched as a
 * prefix of the object's numbers in ascending order, so the exact one comes first (M3 before M30-M39):
 * - `m` ("m31", "M 31"): Messier numbers; never the Moon, a planet or a Caldwell object;
 * - none ("31", "7000"): Messier numbers too, and only when no Messier number matches ("869", "7000"), NGC and IC
 *   designation numbers, so a bare NGC number still finds its object;
 * - `ngc` / `ic` ("ngc 7000", "IC405"): NGC / IC designation numbers across every option, so "ngc 22" finds M32
 *   (NGC 221), then M31 (NGC 224), then NGC 2237 (C 49), and either number of the Double Cluster ("ngc 884") finds it;
 * - `c` / `caldwell` ("c 20"): Caldwell numbers.
 *
 * Anything else matches names by substring, ignoring case, accents and spaces, with names that start with the
 * query first and ties in the options' order (Messier objects by number, then the Moon, then the planets, then the
 * Caldwell objects by C number). An empty query returns every option.
 */
export function filterTargets(options: readonly TargetOption[], query: string): TargetOption[] {
  const q = normalizeQuery(query);
  if (q === "") {
    return [...options];
  }

  const number = NUMBER_QUERY.exec(q);
  if (number) {
    const prefix = number.at(1) ?? ""; // the prefix group is optional
    const digits = number[2];
    const byNumber = (prefixes: readonly string[]): TargetOption[] =>
      // In number order the exact match always comes first: it is the shortest number with these leading digits.
      options
        .map((option) => ({
          option,
          number: Math.min(
            ...prefixes.flatMap((p) => queryNumbers(option, p)).filter((n) => String(n).startsWith(digits)),
          ),
        }))
        .filter((entry) => Number.isFinite(entry.number))
        .sort((a, b) => a.number - b.number)
        .map(({ option }) => option);
    if (prefix !== "") {
      return byNumber([prefix]);
    }
    const messier = byNumber(["m"]);
    return messier.length > 0 ? messier : byNumber(["ngc", "ic"]);
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
