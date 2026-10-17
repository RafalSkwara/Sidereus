import { describe, expect, it } from "vitest";

import { TONIGHT_PAGES } from "@/lib/offline/copies";

import { TONIGHT_NAV } from "./navigation";

describe("TONIGHT_NAV", () => {
  it("holds the same pages as the offline list, so a new Tonight page joins both", () => {
    expect(new Set(TONIGHT_NAV.map((item) => item.href))).toEqual(new Set(TONIGHT_PAGES));
    expect(TONIGHT_NAV).toHaveLength(TONIGHT_PAGES.length);
  });
});
