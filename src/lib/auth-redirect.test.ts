import { describe, expect, it } from "vitest";
import { isAuthEntryPath, safeNextPath } from "./auth-redirect";

describe("safeNextPath", () => {
  it("treats missing or non-string values as no target", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(42)).toBeNull();
  });

  it("refuses targets on another origin", () => {
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("//evil.example/tonight")).toBeNull();
    expect(safeNextPath("/\\evil.example")).toBeNull();
    expect(safeNextPath("https://evil.example/tonight")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
    expect(safeNextPath("tonight")).toBeNull();
  });

  it("refuses control characters", () => {
    expect(safeNextPath("/tonight\n")).toBeNull();
    expect(safeNextPath("/\t/evil.example")).toBeNull();
  });

  it("refuses API and auth routes", () => {
    expect(safeNextPath("/api/log")).toBeNull();
    expect(safeNextPath("/api/gear/sites")).toBeNull();
    expect(safeNextPath("/auth/signin")).toBeNull();
    expect(safeNextPath("/auth/signup?next=/tonight")).toBeNull();
    expect(safeNextPath("/api")).toBeNull();
    expect(safeNextPath("/auth")).toBeNull();
    // A page whose name only starts with a refused prefix is not under it.
    expect(safeNextPath("/authors")).toBe("/authors");
  });

  it("returns the normalised URL, never the raw input", () => {
    // Percent-encoded slashes stay a same-origin path segment.
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
    expect(safeNextPath("/log/../tonight")).toBe("/tonight");
  });
});

describe("isAuthEntryPath", () => {
  it("is the sign-in and sign-up pages, with or without one trailing slash", () => {
    expect(isAuthEntryPath("/auth/signin")).toBe(true);
    expect(isAuthEntryPath("/auth/signup")).toBe(true);
    expect(isAuthEntryPath("/auth/signin/")).toBe(true);
    expect(isAuthEntryPath("/auth/signup/")).toBe(true);
  });

  it("is no other page", () => {
    expect(isAuthEntryPath("/auth/confirm-email")).toBe(false);
    expect(isAuthEntryPath("/auth/signin//")).toBe(false);
    expect(isAuthEntryPath("/auth")).toBe(false);
    expect(isAuthEntryPath("/")).toBe(false);
    expect(isAuthEntryPath("")).toBe(false);
  });
});
