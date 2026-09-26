import { LOG_PENALTY_MIN_RATING } from "./parameters";

/**
 * The observation log as the ranking sees it (roadmap S-06, PRD FR-018): plain entries in, nothing
 * read from storage here. Pure, like the rest of the engine.
 */

/** One log entry, reduced to what the ranking needs. */
export interface LogEntry {
  /** Messier number, 1-110. */
  messier: number;
  /** Evening date of the observing night, `YYYY-MM-DD`. */
  night: string;
  /** How well it went, 1-5. */
  rating: number;
}

/** What the ranking and the "seen N times – last [date]" tag know about an object already seen. */
export interface SeenSummary {
  /** Distinct nights with an entry rated `LOG_PENALTY_MIN_RATING` or above. */
  count: number;
  /** The latest of those nights, `YYYY-MM-DD`. */
  lastNight: string;
}

/**
 * The objects the log counts as seen by the ranked night `onOrBefore` (`YYYY-MM-DD`), keyed by Messier
 * number. Only entries rated `LOG_PENALTY_MIN_RATING` or above count (invariant 4), each night once,
 * so a duplicate entry never inflates the count; nights after `onOrBefore` are ignored. Objects with
 * no such entry are absent.
 */
export function seenSummaries(entries: readonly LogEntry[], onOrBefore: string): ReadonlyMap<number, SeenSummary> {
  const nights = new Map<number, Set<string>>();
  for (const { messier, night, rating } of entries) {
    // ISO dates compare correctly as strings.
    if (rating < LOG_PENALTY_MIN_RATING || night > onOrBefore) {
      continue;
    }
    const seen = nights.get(messier) ?? new Set<string>();
    seen.add(night);
    nights.set(messier, seen);
  }
  const summaries = new Map<number, SeenSummary>();
  for (const [messier, seen] of nights) {
    const sorted = [...seen].sort();
    summaries.set(messier, { count: sorted.length, lastNight: sorted[sorted.length - 1] });
  }
  return summaries;
}
