import { describe, expect, it } from "vitest";

import { en } from "@/i18n/messages/en";
import { TOAST_PARAMS } from "@/lib/toasts";

import { parsePlanSaved, planErrorRedirect, planSavedRedirect, PLAN_PAGE, PLAN_RESET, PLAN_SAVED } from "./redirect";

const SITE = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

describe("planErrorRedirect", () => {
  it("is the plan page with the site and the fixed key", () => {
    expect(planErrorRedirect(SITE, "errors.accountPlan.needsFull")).toBe(
      `/tonight/plan?site=${SITE}&error=errors.accountPlan.needsFull`,
    );
  });

  it("leaves the site out unless it is shaped like an id, so no submitted value reaches the URL", () => {
    for (const site of [null, undefined, "", "M31", "52.23,21.01", "not-an-id", `${SITE}&x=1`, new File([], "a")]) {
      expect(planErrorRedirect(site, "errors.save.sessionPlan")).toBe("/tonight/plan?error=errors.save.sessionPlan");
    }
  });
});

describe("planSavedRedirect", () => {
  it("names the toast with a fixed value, after the site", () => {
    expect(planSavedRedirect(SITE, PLAN_SAVED)).toBe(`/tonight/plan?site=${SITE}&saved=plan`);
    expect(planSavedRedirect(SITE, PLAN_RESET)).toBe(`/tonight/plan?site=${SITE}&saved=plan-reset`);
  });

  it("starts at the plan page, and `saved` is a param a toast clears", () => {
    expect(planSavedRedirect(SITE, PLAN_SAVED).startsWith(`${PLAN_PAGE}?`)).toBe(true);
    expect(TOAST_PARAMS).toContain("saved");
  });
});

describe("parsePlanSaved", () => {
  it("accepts only the two fixed values", () => {
    expect(parsePlanSaved("plan")).toBe("plan");
    expect(parsePlanSaved("plan-reset")).toBe("plan-reset");
    for (const value of [null, "", "site", "Plan", "plan,plan-reset", "1"]) {
      expect(parsePlanSaved(value)).toBeNull();
    }
  });

  it("has a toast text for each", () => {
    expect(en.tonight.pages.plan.saved).not.toBe("");
    expect(en.tonight.pages.plan.resetDone).not.toBe("");
  });
});
