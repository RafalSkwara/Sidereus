import { describe, expect, it } from "vitest";
import { skyCheckActionSchema } from "./schemas";

describe("skyCheckActionSchema", () => {
  it.each([["clear"], ["partly"], ["cloudy"], ["skip"]])("accepts the action %s", (action) => {
    expect(skyCheckActionSchema.parse({ action, from: "tonight" })).toEqual({ action, from: "tonight" });
  });

  it.each([["sunny"], [""], ["Clear"], [undefined]])("rejects the action %j with the save key", (action) => {
    const result = skyCheckActionSchema.safeParse({ action, from: "sky" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("errors.save.skyCheck");
  });

  it("returns to the sky checks page when `from` is missing or unknown", () => {
    expect(skyCheckActionSchema.parse({ action: "clear" }).from).toBe("sky");
    expect(skyCheckActionSchema.parse({ action: "clear", from: "https://evil.example" }).from).toBe("sky");
  });
});
