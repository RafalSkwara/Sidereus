import { describe, expect, it } from "vitest";
import { formRedirect } from "./redirect";

const SITE = "3f2b8c1e-6d4a-4f7e-9b1c-2a5d8e0f1b3c";
const TELESCOPE = "7a9e4d2c-1b3f-4c8e-a6d5-0e2f9b7c4a1d";

function params(url: string): Record<string, string> {
  const parsed = new URL(url, "https://sidereus.test");
  expect(parsed.pathname).toBe("/log/new");
  return Object.fromEntries(parsed.searchParams);
}

describe("formRedirect", () => {
  it("returns to the form with every valid prefill value and the error key", () => {
    const url = formRedirect(
      { messier: "13", night: "2026-09-26", rating: "7", siteId: SITE, telescopeId: TELESCOPE },
      "errors.observation.ratingRequired",
    );
    expect(params(url)).toEqual({
      object: "13",
      night: "2026-09-26",
      site: SITE,
      telescope: TELESCOPE,
      error: "errors.observation.ratingRequired",
    });
  });

  it("drops any value that is not a Messier number, uuid or calendar date, so free text never reaches the URL", () => {
    const url = formRedirect(
      { messier: "M13 at 52.23N", night: "tomorrow", siteId: "52.23,21.01", telescopeId: "<script>" },
      "errors.observation.objectInvalid",
    );
    expect(params(url)).toEqual({ error: "errors.observation.objectInvalid" });
  });

  it("drops an out-of-range object and a non-calendar night", () => {
    expect(params(formRedirect({ messier: "111", night: "2026-02-30" }, "errors.generic"))).toEqual({
      error: "errors.generic",
    });
  });

  it("ignores non-string form values", () => {
    expect(params(formRedirect({ messier: 13, siteId: null }, "errors.generic"))).toEqual({ error: "errors.generic" });
  });
});
