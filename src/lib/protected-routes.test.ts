import { describe, expect, it } from "vitest";
import { isProtectedPath } from "./protected-routes";

describe("isProtectedPath", () => {
  it.each([
    "/log",
    "/log/",
    "/log/new",
    "/log/3f2b8c1e-6d4a-4f7e-9b1c-2a5d8e0f1b3c",
    "/api/log",
    "/api/log/3f2b8c1e-6d4a-4f7e-9b1c-2a5d8e0f1b3c/delete",
    "/gear",
    "/gear/sites/new",
    "/api/gear/sites",
    "/tonight",
    "/onboarding",
    "/api/onboarding",
  ])("gates %s", (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it.each(["/", "/login", "/logbook", "/auth/signin", "/api/auth/signin", "/gearbox", "/tonightly"])(
    "leaves %s open",
    (path) => {
      expect(isProtectedPath(path)).toBe(false);
    },
  );
});
