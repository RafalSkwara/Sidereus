import { CALDWELL, MESSIER, type DeepSkyObject, type DeepSkyType } from "@/lib/catalogue";
import { seenSummaries, type LogEntry, type SeenSummary } from "@/lib/engine";
import { MOON_TARGET_KEY, PLANET_TARGET_KEYS } from "@/lib/targets";

/**
 * What the progress page shows (roadmap M-3 S-05, PRD FR-039/FR-040): two checklists over the Messier and
 * Caldwell catalogues and the planets and Moon as "firsts", all from the log through the ranking's own
 * "seen" rule (`seenSummaries`, entries rated `LOG_PENALTY_MIN_RATING` or above, each night once), so the
 * page and the ranking cannot drift. Pure: entries in, plain data out. It imports the catalogue, so it is
 * server-only.
 */

/** One catalogue object on a checklist. */
export interface ChecklistItem {
  /** The log key: "M31", "NGC7000". */
  id: string;
  /** The Messier or Caldwell number the list is ordered by. */
  number: number;
  /** What a row shows as the object's name: "M31", "NGC 7000". */
  label: string;
  /** The catalogue's English common name; the page localises it. */
  commonName: string | null;
  type: DeepSkyType;
  /** The log's summary for the object, or `null` while it has never been logged with a rating of 3 or above. */
  seen: SeenSummary | null;
}

export interface Checklist {
  /** Objects on the list: 110 for Messier, 61 for Caldwell. */
  total: number;
  /** How many of them are seen. */
  seenCount: number;
  /** In catalogue-number order. */
  items: ChecklistItem[];
}

/** A planet or the Moon, and the first night it was logged with a rating of 3 or above. */
export interface First {
  key: string;
  firstNight: string | null;
}

export interface ObservingProgress {
  messier: Checklist;
  caldwell: Checklist;
  /** The seven planets in solar order, then the Moon. */
  firsts: First[];
}

function checklist(
  objects: readonly DeepSkyObject[],
  numberOf: (object: DeepSkyObject) => number,
  seen: ReadonlyMap<string, SeenSummary>,
): Checklist {
  const items = objects
    .map((object) => ({
      id: object.id,
      number: numberOf(object),
      label: object.label,
      commonName: object.commonName,
      type: object.type,
      seen: seen.get(object.id) ?? null,
    }))
    .sort((a, b) => a.number - b.number);
  return { total: items.length, seenCount: items.filter((item) => item.seen !== null).length, items };
}

/**
 * The progress for a log. `entries` are the user's entries that can count as seen (any others are ignored by
 * the rule); keys in neither catalogue, the planets nor the Moon are ignored too.
 */
export function observingProgress(entries: readonly LogEntry[]): ObservingProgress {
  const seen = seenSummaries(entries);
  return {
    messier: checklist(MESSIER, (object) => object.messier ?? 0, seen),
    caldwell: checklist(CALDWELL, (object) => object.caldwell ?? 0, seen),
    firsts: [...PLANET_TARGET_KEYS, MOON_TARGET_KEY].map((key) => ({
      key,
      firstNight: seen.get(key)?.firstNight ?? null,
    })),
  };
}
