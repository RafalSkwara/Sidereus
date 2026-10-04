import { describe, expect, it } from "vitest";
import { editRedirect, formRedirect, logNotice, parseLogPage, readLogNotice, tonightReturnPath } from "./redirect";

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
      { target: "M13", night: "2026-09-26", rating: "7", siteId: SITE, telescopeId: TELESCOPE },
      "errors.observation.ratingRequired",
    );
    expect(params(url)).toEqual({
      object: "M13",
      night: "2026-09-26",
      site: SITE,
      telescope: TELESCOPE,
      error: "errors.observation.ratingRequired",
    });
  });

  it("carries a planet key", () => {
    expect(params(formRedirect({ target: "jupiter" }, "errors.generic"))).toEqual({
      object: "jupiter",
      error: "errors.generic",
    });
  });

  it("drops any value that is not a target key, uuid or calendar date, so free text never reaches the URL", () => {
    const url = formRedirect(
      { target: "M13 at 52.23N", night: "tomorrow", siteId: "52.23,21.01", telescopeId: "<script>" },
      "errors.observation.objectInvalid",
    );
    expect(params(url)).toEqual({ error: "errors.observation.objectInvalid" });
  });

  it("drops an out-of-range object and a non-calendar night", () => {
    expect(params(formRedirect({ target: "M111", night: "2026-02-30" }, "errors.generic"))).toEqual({
      error: "errors.generic",
    });
  });

  it("ignores non-string form values", () => {
    expect(params(formRedirect({ target: 13, siteId: null }, "errors.generic"))).toEqual({ error: "errors.generic" });
  });
});

describe("formRedirect for manual entry", () => {
  it("carries the log return target so the form comes back in manual mode", () => {
    expect(params(formRedirect({ target: "M31", from: "log" }, "errors.observation.ratingRequired"))).toEqual({
      object: "M31",
      from: "log",
      error: "errors.observation.ratingRequired",
    });
  });

  it("drops any other return target", () => {
    expect(params(formRedirect({ from: "https://evil.test" }, "errors.generic"))).toEqual({ error: "errors.generic" });
  });
});

describe("formRedirect from a focused Tonight page", () => {
  it("keeps the page, so the retried save still returns there", () => {
    expect(params(formRedirect({ target: "moon", from: "moon" }, "errors.observation.ratingRequired"))).toEqual({
      object: "moon",
      from: "moon",
      error: "errors.observation.ratingRequired",
    });
  });
});

describe("tonightReturnPath", () => {
  it("maps each focused page to its path", () => {
    expect(tonightReturnPath("targets")).toBe("/tonight/targets");
    expect(tonightReturnPath("moon")).toBe("/tonight/moon");
    expect(tonightReturnPath("planets")).toBe("/tonight/planets");
  });

  it("returns to Tonight for a missing, unknown or log value", () => {
    for (const from of [undefined, null, "", "log", "nights", "tonight", "https://evil.test", "/tonight/moon"]) {
      expect(tonightReturnPath(from)).toBe("/tonight");
    }
  });
});

describe("editRedirect", () => {
  it("returns to the entry's page with only the error key", () => {
    expect(editRedirect("7a9e4d2c-1b3f-4c8e-a6d5-0e2f9b7c4a1d", "errors.observation.nightInFuture")).toBe(
      "/log/7a9e4d2c-1b3f-4c8e-a6d5-0e2f9b7c4a1d?error=errors.observation.nightInFuture",
    );
  });

  it("encodes a hostile id so it stays one path segment", () => {
    expect(editRedirect("../gear?x=1", "errors.generic")).toBe("/log/..%2Fgear%3Fx%3D1?error=errors.generic");
  });
});

describe("logNotice and readLogNotice", () => {
  it("name the object by its target key", () => {
    expect(logNotice("saved", "M31")).toBe("/log?saved=M31");
    expect(logNotice("deleted", "jupiter")).toBe("/log?deleted=jupiter");
    expect(readLogNotice(new URL(logNotice("updated", "M31"), "https://sidereus.test").searchParams)).toEqual({
      kind: "updated",
      target: "M31",
    });
    expect(readLogNotice(new URLSearchParams({ deleted: "jupiter" }))).toEqual({ kind: "deleted", target: "jupiter" });
  });

  it("reads the bare Messier number of an older link as its key", () => {
    expect(readLogNotice(new URLSearchParams({ saved: "31" }))).toEqual({ kind: "saved", target: "M31" });
  });

  it("ignores anything that is not a target", () => {
    for (const value of ["", "111", "M111", "Jupiter", "52.23,21.01"]) {
      expect(readLogNotice(new URLSearchParams({ saved: value }))).toBeNull();
    }
    expect(readLogNotice(new URLSearchParams({ page: "2" }))).toBeNull();
  });
});

describe("parseLogPage", () => {
  it("reads a positive integer as the page and anything else as page 1", () => {
    expect(parseLogPage("3")).toBe(3);
    for (const param of [null, "", "1", "0", "-2", "2.5", "abc", "9999999"]) {
      expect(parseLogPage(param)).toBe(1);
    }
  });
});
