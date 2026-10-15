import { describe, expect, it } from "vitest";
import { resetPlanSchema, savePlanSchema, SESSION_PLAN_MAX_TARGETS } from "./schemas";

const SITE = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const NIGHT = "2026-10-14";

function parse(overrides: Record<string, unknown> = {}) {
  return savePlanSchema.safeParse({ site: SITE, night: NIGHT, targets: ["M31", "jupiter"], ...overrides });
}

describe("savePlanSchema", () => {
  it("accepts a list in the user's order, keeping the order", () => {
    expect(parse({ targets: ["jupiter", "NGC7000", "M31", "moon", "IC405"] })).toMatchObject({
      success: true,
      data: { site: SITE, night: NIGHT, targets: ["jupiter", "NGC7000", "M31", "moon", "IC405"] },
    });
  });

  it("accepts an empty list (the user removed every row)", () => {
    expect(parse({ targets: [] })).toMatchObject({ success: true, data: { targets: [] } });
  });

  it("accepts exactly the most targets and refuses one more", () => {
    const keys = (n: number) => Array.from({ length: n }, (_, i) => `M${i + 1}`);
    expect(parse({ targets: keys(SESSION_PLAN_MAX_TARGETS) }).success).toBe(true);
    expect(parse({ targets: keys(SESSION_PLAN_MAX_TARGETS + 1) }).success).toBe(false);
  });

  it.each([
    ["a duplicate key", ["M31", "jupiter", "M31"]],
    ["a malformed key", ["M31", "M111"]],
    ["an empty key", ["M31", ""]],
    ["a key with a comma", ["M31,M42"]],
    ["a non-string entry", ["M31", 42]],
    ["a bare Messier number", ["31"]],
  ])("refuses %s with the save key", (_label, targets) => {
    const result = parse({ targets });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("errors.save.sessionPlan");
  });

  it.each([
    ["a missing site", { site: undefined }],
    ["a site that is not a uuid", { site: "home" }],
    ["a missing night", { night: undefined }],
    ["a malformed night", { night: "14/10/2026" }],
    ["a night that is not a date", { night: "2026-02-30" }],
    ["a missing list", { targets: undefined }],
    ["a list that is not an array", { targets: "M31" }],
  ])("refuses %s with the save key", (_label, overrides) => {
    const result = parse(overrides);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("errors.save.sessionPlan");
  });
});

describe("resetPlanSchema", () => {
  it("accepts a site and a night", () => {
    expect(resetPlanSchema.safeParse({ site: SITE, night: NIGHT }).success).toBe(true);
  });

  it.each([
    ["a site that is not a uuid", { site: "x", night: NIGHT }],
    ["a night that is not a date", { site: SITE, night: "tonight" }],
    ["nothing", {}],
  ])("refuses %s with the save key", (_label, input) => {
    const result = resetPlanSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("errors.save.sessionPlan");
  });
});
