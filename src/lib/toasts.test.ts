import { describe, expect, it } from "vitest";

import { TOAST_MS, withoutParams } from "./toasts";

describe("withoutParams", () => {
  it("drops the named param and leaves a bare path", () => {
    expect(withoutParams("/gear?saved=telescope", ["saved"])).toBe("/gear");
  });

  it("keeps every other query param and the hash", () => {
    expect(withoutParams("/tonight/targets?site=abc&logged=M31&sort=time#more", ["logged"])).toBe(
      "/tonight/targets?site=abc&sort=time#more",
    );
    expect(withoutParams("/tonight?night=next&skyChecked=1&telescope=t1", ["skyChecked"])).toBe(
      "/tonight?night=next&telescope=t1",
    );
  });

  it("leaves a location without the param as it is", () => {
    expect(withoutParams("/log?page=2", ["saved"])).toBe("/log?page=2");
    expect(withoutParams("/log", ["saved", "updated"])).toBe("/log");
  });

  it("drops several params at once", () => {
    expect(withoutParams("/log?saved=M31&updated=M31&page=2", ["saved", "updated"])).toBe("/log?page=2");
  });
});

describe("TOAST_MS", () => {
  it("is ten seconds", () => {
    expect(TOAST_MS).toBe(10_000);
  });
});
