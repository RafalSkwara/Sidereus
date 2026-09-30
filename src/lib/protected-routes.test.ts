import { describe, expect, it } from "vitest";
import { isProtectedPath } from "./protected-routes";

describe("isProtectedPath", () => {
  it("gates every page and API route under the protected prefixes", () => {
    for (const path of [
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
    ]) {
      expect({ path, gated: isProtectedPath(path) }).toEqual({ path, gated: true });
    }
  });

  it("matches whole path segments, leaving look-alike and public paths open", () => {
    for (const path of ["/", "/login", "/logbook", "/auth/signin", "/api/auth/signin", "/gearbox", "/tonightly"]) {
      expect({ path, gated: isProtectedPath(path) }).toEqual({ path, gated: false });
    }
  });
});
