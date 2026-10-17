import { describe, expect, it } from "vitest";
import { returnTargetSchema } from "./schemas";

describe("returnTargetSchema", () => {
  it("accepts only the log, a focused Tonight page, or nothing", () => {
    for (const value of ["log", "targets", "moon", "planets", undefined]) {
      expect(returnTargetSchema.safeParse(value).success).toBe(true);
    }
    expect(returnTargetSchema.safeParse("https://evil.test").success).toBe(false);
    expect(returnTargetSchema.safeParse("tonight").success).toBe(false);
    expect(returnTargetSchema.safeParse("nights").success).toBe(false);
    expect(returnTargetSchema.safeParse("/tonight/moon").success).toBe(false);
  });
});
