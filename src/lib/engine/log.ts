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
