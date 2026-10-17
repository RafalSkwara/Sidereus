import { describe, expect, it } from "vitest";
import type { SkyHeadlineId } from "@/lib/tonight/format";
import { CHECKABLE_HEADLINES, claimOf, outcomeOf, tallyOf, type SkyAnswer } from "./claim";

describe("claimOf", () => {
  it("maps each headline to the sky it claims, and lists exactly the claiming ones as checkable", () => {
    const table: [SkyHeadlineId, SkyAnswer | null][] = [
      ["go", "clear"],
      ["humidityCap", "clear"],
      ["fallbackCap", "clear"],
      ["marginal", "partly"],
      ["no-go", "cloudy"],
      ["noForecast", null],
      ["noDarkness", null],
    ];
    // Non-vacuity: all seven headlines are tried, five of them with a claim.
    expect(table).toHaveLength(7);
    expect(table.filter(([, claim]) => claim !== null)).toHaveLength(5);
    for (const [headline, claim] of table) {
      expect(claimOf(headline), `headline ${headline}`).toBe(claim);
    }
    expect([...CHECKABLE_HEADLINES].sort()).toEqual(["fallbackCap", "go", "humidityCap", "marginal", "no-go"]);
  });
});

describe("outcomeOf", () => {
  it("is a match on the same sky, optimistic when the sky was worse than claimed, pessimistic when better", () => {
    const table: [SkyAnswer, SkyAnswer, string][] = [
      ["clear", "clear", "match"],
      ["clear", "partly", "optimistic"],
      ["clear", "cloudy", "optimistic"],
      ["partly", "clear", "pessimistic"],
      ["partly", "partly", "match"],
      ["partly", "cloudy", "optimistic"],
      ["cloudy", "clear", "pessimistic"],
      ["cloudy", "partly", "pessimistic"],
      ["cloudy", "cloudy", "match"],
    ];
    // Non-vacuity: every claim and answer pair of the three skies is tried.
    expect(table).toHaveLength(9);
    for (const [claim, answer, outcome] of table) {
      expect(outcomeOf(claim, answer), `claimed ${claim}, saw ${answer}`).toBe(outcome);
    }
  });
});

describe("tallyOf", () => {
  it("adds up matches and misses by direction and by claimed sky", () => {
    const tally = tallyOf([
      { headline: "go", answer: "clear", nights: 4 },
      { headline: "humidityCap", answer: "clear", nights: 1 },
      { headline: "fallbackCap", answer: "cloudy", nights: 1 },
      { headline: "marginal", answer: "partly", nights: 1 },
      { headline: "marginal", answer: "clear", nights: 1 },
      { headline: "no-go", answer: "cloudy", nights: 1 },
    ]);
    expect(tally).toEqual({
      answered: 9,
      matched: 7,
      optimistic: 1,
      pessimistic: 1,
      byClaim: {
        clear: { answered: 6, matched: 5 },
        partly: { answered: 2, matched: 1 },
        cloudy: { answered: 1, matched: 1 },
      },
    });
    expect(tally.matched + tally.optimistic + tally.pessimistic).toBe(tally.answered);
  });

  it("leaves out nights with no checkable claim and values outside the vocabulary", () => {
    const tally = tallyOf([
      { headline: "noForecast", answer: "clear", nights: 3 },
      { headline: "noDarkness", answer: "clear", nights: 1 },
      { headline: "sunny", answer: "clear", nights: 1 },
      { headline: "go", answer: "foggy", nights: 1 },
      { headline: "go", answer: "clear", nights: 2 },
    ]);
    expect(tally.answered).toBe(2);
    expect(tally.matched).toBe(2);
  });
});
