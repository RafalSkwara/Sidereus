import { describe, expect, it } from "vitest";

import { expectationView } from "./expectation";

describe("expectationView", () => {
  it("shows the lines on a confirmed full plan, the locked line only on an explicit free read, and neither when the read failed", () => {
    expect([
      expectationView("full", "full"),
      expectationView("free", "free"),
      expectationView("free", "unknown"),
    ]).toEqual(["lines", "locked", "none"]);
  });
});
