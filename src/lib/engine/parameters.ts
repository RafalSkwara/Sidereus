/**
 * Named home for the PRD's tunable parameters that this engine consumes.
 *
 * Every value below is a CANDIDATE from `context/foundation/prd.md` → Open Questions. They are
 * uncalibrated by design: the PRD records them so the engine can start, and expects them to be
 * revisited once the ranking has been cross-checked against independent references. Nothing
 * downstream should hardcode these numbers.
 */

/**
 * Sun altitude (degrees) below which the sky counts as dark, by Bortle class.
 * Candidate (PRD Open Question 7): -18 for Bortle 1-4, -15 for 5-6, -12 for 7-9.
 */
export function darknessThresholdDegForBortle(bortle: number): -18 | -15 | -12 {
  if (!Number.isInteger(bortle) || bortle < 1 || bortle > 9) {
    throw new RangeError(`Bortle class must be an integer 1..9, got ${bortle}`);
  }
  if (bortle <= 4) {
    return -18;
  }
  if (bortle <= 6) {
    return -15;
  }
  return -12;
}

/** Candidate (PRD Open Question 9): altitude agreement with the planetarium reference, degrees. */
export const ALTITUDE_TOLERANCE_DEG = 1;

/** Candidate (PRD Open Question 9): timing agreement with the planetarium reference, minutes. */
export const TIME_TOLERANCE_MINUTES = 5;

/** Candidate: sampling step for altitude tracks over a night, minutes. Coarsen before optimising code. */
export const DEFAULT_TRACK_STEP_MINUTES = 10;
