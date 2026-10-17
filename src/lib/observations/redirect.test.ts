import { describe, expect, it } from "vitest";
import { editRedirect, formRedirect, readLogNotice, readMilestoneParam, tonightReturnPath } from "./redirect";

function params(url: string): Record<string, string> {
  const parsed = new URL(url, "https://sidereus.test");
  expect(parsed.pathname).toBe("/log/new");
  return Object.fromEntries(parsed.searchParams);
}

describe("formRedirect", () => {
  it("drops any value that is not a target key, uuid or calendar date, so free text never reaches the URL", () => {
    const url = formRedirect(
      { target: "M13 at 52.23N", night: "tomorrow", siteId: "52.23,21.01", telescopeId: "<script>" },
      "errors.observation.objectInvalid",
    );
    expect(params(url)).toEqual({ error: "errors.observation.objectInvalid" });
  });
});

describe("tonightReturnPath", () => {
  it("returns to Tonight for a missing, unknown or log value", () => {
    for (const from of [undefined, null, "", "log", "nights", "tonight", "https://evil.test", "/tonight/moon"]) {
      expect(tonightReturnPath(from)).toBe("/tonight");
    }
  });
});

describe("editRedirect", () => {
  it("encodes a hostile id so it stays one path segment", () => {
    expect(editRedirect("../gear?x=1", "errors.generic")).toBe("/log/..%2Fgear%3Fx%3D1?error=errors.generic");
  });
});

describe("noticeRedirect and readLogNotice", () => {
  it("ignores anything that is not a target", () => {
    for (const value of ["", "111", "M111", "Jupiter", "52.23,21.01"]) {
      expect(readLogNotice(new URLSearchParams({ saved: value }))).toBeNull();
    }
    expect(readLogNotice(new URLSearchParams({ page: "2" }))).toBeNull();
  });
});

describe("readMilestoneParam", () => {
  const at = (query: string) => new URL(`https://sidereus.test/log?${query}`);

  it("drops values that are not milestone keys", () => {
    expect(readMilestoneParam(at("milestone=first-galaxy&milestone=nope&milestone=&milestone=M31"), true)).toEqual([
      "first-galaxy",
    ]);
  });

  it("is empty without the param, and signed out whatever the URL says", () => {
    expect(readMilestoneParam(at("saved=M31"), true)).toEqual([]);
    expect(readMilestoneParam(at("milestone=first-galaxy"), false)).toEqual([]);
  });
});
