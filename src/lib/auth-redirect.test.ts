import { describe, expect, it } from "vitest";
import { safeNextPath } from "./auth-redirect";

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
  });

  it("returns the normalised URL, never the raw input", () => {
    // Percent-encoded slashes stay a same-origin path segment.
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
    expect(safeNextPath("/log/../tonight")).toBe("/tonight");
  });
});
