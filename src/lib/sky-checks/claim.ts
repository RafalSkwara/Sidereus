import type { SkyHeadlineId } from "@/lib/tonight/format";

/**
 * The verdict check's match rule (roadmap M-2 S-07, verdict-check). Pure and locale-free: headlines and answers
 * are ids, never text.
 *
 * Tonight's headline makes a claim about the cloud, and the user's answer uses the same three words, so a match is
 * the answer equal to the claim. "Clear, but damp" and "Clear (old forecast)" still claim a clear sky: the cap is
 * about dew and the forecast's age, not cloud. "No forecast" and "No dark window" claim nothing, so they are never
 * asked and never counted.
 */

/** What the user saw, in the headline's own words: Clear, Partly clear, Cloudy. */
export type SkyAnswer = "clear" | "partly" | "cloudy";

export const SKY_ANSWERS = ["clear", "partly", "cloudy"] as const satisfies readonly SkyAnswer[];

/** The headlines a sky check can store: every headline but "No dark window", which is never recorded. */
export type RecordedHeadline = Exclude<SkyHeadlineId, "noDarkness">;

const CLAIMS = {
  go: "clear",
  humidityCap: "clear",
  fallbackCap: "clear",
  marginal: "partly",
  "no-go": "cloudy",
  noForecast: null,
  noDarkness: null,
} as const satisfies Record<SkyHeadlineId, SkyAnswer | null>;

/** The headlines whose claim can be checked, for filtering stored rows. */
export const CHECKABLE_HEADLINES = [
  "go",
  "humidityCap",
  "fallbackCap",
  "marginal",
  "no-go",
] as const satisfies readonly RecordedHeadline[];

export type Outcome = "match" | "optimistic" | "pessimistic";

/** The sky a headline promised, or `null` when it makes no checkable claim. */
export function claimOf(headline: SkyHeadlineId): SkyAnswer | null {
  return CLAIMS[headline];
}

export function isSkyAnswer(value: string): value is SkyAnswer {
  return (SKY_ANSWERS as readonly string[]).includes(value);
}

export function isRecordedHeadline(value: string): value is RecordedHeadline {
  return value in CLAIMS && value !== "noDarkness";
}

/**
 * How an answer compares with the claim. On the scale clear < partly < cloudy, a claim clearer than what the user
 * saw was too optimistic (the PRD's worse failure: a wasted setup), a cloudier one too pessimistic.
 */
export function outcomeOf(claim: SkyAnswer, answer: SkyAnswer): Outcome {
  const rank = SKY_ANSWERS.indexOf(claim) - SKY_ANSWERS.indexOf(answer);
  return rank === 0 ? "match" : rank < 0 ? "optimistic" : "pessimistic";
}

/** One group of answered nights, as `sky_check_tally()` returns it. */
export interface TallyRow {
  headline: string;
  answer: string;
  nights: number;
}

export interface Tally {
  answered: number;
  matched: number;
  optimistic: number;
  pessimistic: number;
  /** Per claimed sky: how many answered nights claimed it, and how many of those matched. */
  byClaim: Record<SkyAnswer, { answered: number; matched: number }>;
}

/** Adds up the answered nights. Rows with no checkable claim, or a value outside the vocabulary, are left out. */
export function tallyOf(rows: readonly TallyRow[]): Tally {
  const tally: Tally = {
    answered: 0,
    matched: 0,
    optimistic: 0,
    pessimistic: 0,
    byClaim: {
      clear: { answered: 0, matched: 0 },
      partly: { answered: 0, matched: 0 },
      cloudy: { answered: 0, matched: 0 },
    },
  };
  for (const row of rows) {
    if (!isRecordedHeadline(row.headline) || !isSkyAnswer(row.answer)) {
      continue;
    }
    const claim = claimOf(row.headline);
    if (claim === null) {
      continue;
    }
    const outcome = outcomeOf(claim, row.answer);
    tally.answered += row.nights;
    tally.byClaim[claim].answered += row.nights;
    if (outcome === "match") {
      tally.matched += row.nights;
      tally.byClaim[claim].matched += row.nights;
    } else {
      tally[outcome] += row.nights;
    }
  }
  return tally;
}
