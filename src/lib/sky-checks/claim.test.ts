import { describe, expect, it } from "vitest";
import type { SkyHeadlineId } from "@/lib/tonight/format";
import { CHECKABLE_HEADLINES, claimOf, outcomeOf, tallyOf, type SkyAnswer } from "./claim";

describe("claimOf", () => {
  it.each<[SkyHeadlineId, SkyAnswer | null]>([
    ["go", "clear"],
    ["humidityCap", "clear"],
    ["fallbackCap", "clear"],
    ["marginal", "partly"],
    ["no-go", "cloudy"],
    ["noForecast", null],
    ["noDarkness", null],
  ])("%s claims %s", (headline, claim) => {
    expect(claimOf(headline)).toBe(claim);
  });

  it("lists exactly the headlines with a claim as checkable", () => {
    expect([...CHECKABLE_HEADLINES].sort()).toEqual(["fallbackCap", "go", "humidityCap", "marginal", "no-go"]);
  });
});

describe("outcomeOf", () => {
  it.each<[SkyAnswer, SkyAnswer, string]>([
    ["clear", "clear", "match"],
    ["clear", "partly", "optimistic"],
    ["clear", "cloudy", "optimistic"],
    ["partly", "clear", "pessimistic"],
    ["partly", "partly", "match"],
    ["partly", "cloudy", "optimistic"],
    ["cloudy", "clear", "pessimistic"],
    ["cloudy", "partly", "pessimistic"],
    ["cloudy", "cloudy", "match"],
  ])("claimed %s, saw %s: %s", (claim, answer, outcome) => {
    expect(outcomeOf(claim, answer)).toBe(outcome);
  });
});

describe("tallyOf", () => {
  it("is all zeros with no answers", () => {
    expect(tallyOf([])).toEqual({
      answered: 0,
      matched: 0,
      optimistic: 0,
      pessimistic: 0,
      byClaim: {
        clear: { answered: 0, matched: 0 },
        partly: { answered: 0, matched: 0 },
        cloudy: { answered: 0, matched: 0 },
      },
    });
  });

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
