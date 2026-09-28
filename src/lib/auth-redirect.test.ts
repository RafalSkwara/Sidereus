import { describe, expect, it } from "vitest";
import { safeNextPath, signInUrl } from "./auth-redirect";

describe("safeNextPath", () => {
  it("accepts a same-origin page path", () => {
    expect(safeNextPath("/tonight")).toBe("/tonight");
    expect(safeNextPath("/gear/sites/new")).toBe("/gear/sites/new");
  });

  it("keeps the query, so a deep link survives sign-in", () => {
    expect(safeNextPath("/log/new?object=31&night=2026-09-27")).toBe("/log/new?object=31&night=2026-09-27");
  });

  it("drops a fragment", () => {
    expect(safeNextPath("/log#latest")).toBe("/log");
  });

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

describe("signInUrl", () => {
  it("is plain sign-in without a safe target", () => {
    expect(signInUrl()).toBe("/auth/signin");
    expect(signInUrl(null)).toBe("/auth/signin");
    expect(signInUrl("//evil.example")).toBe("/auth/signin");
  });

  it("carries a safe target as an encoded next parameter that round-trips", () => {
    const url = signInUrl("/log/new?object=31&night=2026-09-27");
    expect(url).toBe("/auth/signin?next=%2Flog%2Fnew%3Fobject%3D31%26night%3D2026-09-27");
    const next = new URL(url, "http://localhost").searchParams.get("next");
    expect(safeNextPath(next)).toBe("/log/new?object=31&night=2026-09-27");
  });
});
