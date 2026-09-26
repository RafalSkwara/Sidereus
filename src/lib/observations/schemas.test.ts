import { describe, expect, it } from "vitest";
import { getMessages, translateKey } from "@/i18n";
import { observationInputSchema } from "./schemas";

/** FormData-shaped input: every value is a string, as a plain HTML POST delivers it. */
const m13 = {
  messier: "13",
  night: "2026-09-26",
  rating: "4",
  siteId: "3f2b8c1e-6d4a-4f7e-9b1c-2a5d8e0f1b3c",
  telescopeId: "7a9e4d2c-1b3f-4c8e-a6d5-0e2f9b7c4a1d",
};

/** The issues' messages as a viewer reads them: each key translated through the English catalogue. */
function messages(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.error?.issues.map((issue) => translateKey(getMessages("en"), issue.message, "errors.generic")) ?? [];
}

describe("observationInputSchema", () => {
  it("accepts an M13 entry and coerces the numbers", () => {
    expect(observationInputSchema.parse(m13)).toEqual({
      messier: 13,
      night: "2026-09-26",
      rating: 4,
      siteId: m13.siteId,
      telescopeId: m13.telescopeId,
    });
  });

  it.each([
    ["M0", { messier: "0" }],
    ["M111", { messier: "111" }],
    ["a fractional object", { messier: "13.5" }],
    ["a missing rating", { rating: "" }],
    ["rating 0", { rating: "0" }],
    ["rating 6", { rating: "6" }],
    ["a night in the wrong format", { night: "26.09.2026" }],
    ["a night that is not a calendar date", { night: "2026-02-30" }],
    ["an empty night", { night: "" }],
    ["a night before 1900", { night: "0026-09-26" }],
    ["a missing site", { siteId: "" }],
    ["a site that is not a uuid", { siteId: "home" }],
    ["a missing telescope", { telescopeId: "" }],
  ])("rejects %s", (_label, override) => {
    expect(observationInputSchema.safeParse({ ...m13, ...override }).success).toBe(false);
  });

  it("words every rejection from the catalogue, never a submitted value", () => {
    const result = observationInputSchema.safeParse({
      messier: "999",
      night: "2026-02-30",
      rating: "7",
      siteId: "",
      telescopeId: "",
    });
    const en = getMessages("en").errors.observation;
    expect(messages(result).sort()).toEqual(
      [en.objectInvalid, en.nightInvalid, en.ratingRequired, en.siteRequired, en.telescopeRequired].sort(),
    );
  });
});
