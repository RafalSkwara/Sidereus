import { LOG_PENALTY_MIN_RATING } from "./parameters";

/**
 * The observation log as the ranking sees it (roadmap S-06, PRD FR-018): plain entries in, nothing
 * read from storage here. Pure, like the rest of the engine.
 */

/** One log entry, reduced to what the ranking needs. */
export interface LogEntry {
  /** Target key: a Messier catalogue id (`"M31"`) or a planet key (`"jupiter"`). */
  target: string;
  /** Evening date of the observing night, `YYYY-MM-DD`. */
  night: string;
  /** How well it went, 1-5. */
  rating: number;
}

/** What the ranking, the "seen N times – last [date]" tag and the progress page know about an object already seen. */
export interface SeenSummary {
  /** Distinct nights with an entry rated `LOG_PENALTY_MIN_RATING` or above. */
  count: number;
  /** The earliest of those nights, `YYYY-MM-DD`. */
  firstNight: string;
  /** The latest of those nights, `YYYY-MM-DD`. */
  lastNight: string;
}

/**
 * The objects the log counts as seen by the ranked night `onOrBefore` (`YYYY-MM-DD`), keyed by target
 * key. Only entries rated `LOG_PENALTY_MIN_RATING` or above count (invariant 4), each night once,
 * so a duplicate entry never inflates the count; nights after `onOrBefore` are ignored, and with no
 * `onOrBefore` no night is (the progress page asks for "ever"). Objects with no such entry are absent.
 */
export function seenSummaries(entries: readonly LogEntry[], onOrBefore?: string): ReadonlyMap<string, SeenSummary> {
  const nights = new Map<string, Set<string>>();
  for (const { target, night, rating } of entries) {
    // ISO dates compare correctly as strings.
    if (rating < LOG_PENALTY_MIN_RATING || (onOrBefore !== undefined && night > onOrBefore)) {
      continue;
    }
    const seen = nights.get(target) ?? new Set<string>();
    seen.add(night);
    nights.set(target, seen);
  }
  const summaries = new Map<string, SeenSummary>();
  for (const [target, seen] of nights) {
    const sorted = [...seen].sort();
    summaries.set(target, { count: sorted.length, firstNight: sorted[0], lastNight: sorted[sorted.length - 1] });
  }
  return summaries;
}
