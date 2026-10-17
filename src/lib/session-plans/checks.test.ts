import { describe, expect, it } from "vitest";

import { newKeys, thrownKey } from "./checks";

describe("newKeys", () => {
  it("leaves out the keys the stored list already had, keeping the posted order", () => {
    expect(newKeys(["M42", "M31"], ["M31", "NGC7000", "M42", "moon"])).toEqual(["NGC7000", "moon"]);
  });

  it("is empty when the list only drops or reorders keys", () => {
    expect(newKeys(["M31", "M42", "jupiter"], ["jupiter", "M31"])).toEqual([]);
    expect(newKeys([], [])).toEqual([]);
  });
});

describe("thrownKey", () => {
  it("passes on a store's fixed key and nothing else", () => {
    expect(
      thrownKey(new Error("errors.load.sites", { cause: new Error("52.23,21.01") }), "errors.save.sessionPlan"),
    ).toBe("errors.load.sites");
    expect(thrownKey(new Error("duplicate key value violates 52.23"), "errors.save.sessionPlan")).toBe(
      "errors.save.sessionPlan",
    );
    expect(thrownKey("errors.load.sites", "errors.save.sessionPlan")).toBe("errors.save.sessionPlan");
  });
});
