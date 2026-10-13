import { describe, expect, it } from "vitest";

import { en } from "@/i18n/messages/en";
import type { TonightView } from "@/lib/tonight/build";
import { finderHref } from "@/lib/tonight/load";

import { finderBackHref, finderBackLabel, parseFinderFrom } from "./from";

describe("the finder chart's way back", () => {
  it("accepts only the two focused pages the link sits on", () => {
    expect(parseFinderFrom("targets")).toBe("targets");
    expect(parseFinderFrom("planets")).toBe("planets");
    for (const value of ["log", "moon", "", "Targets", null, undefined]) {
      expect(parseFinderFrom(value)).toBeNull();
    }
  });

  it("goes back to that page, else to Tonight", () => {
    expect(finderBackHref("targets")).toBe("/tonight/targets");
    expect(finderBackHref("planets")).toBe("/tonight/planets");
    expect(finderBackHref(null)).toBe("/tonight");
    expect(finderBackLabel("targets", en)).toBe(en.tonight.pages.targets);
    expect(finderBackLabel("planets", en)).toBe(en.tonight.summary.planets);
    expect(finderBackLabel(null, en)).toBe(en.nav.tonight);
  });
});

describe("finderHref", () => {
  const view = { siteId: "site-1", telescopeId: "scope-1" } as TonightView;

  it("carries the target key, the gear ids and the page it sits on, never coordinates", () => {
    expect(finderHref(view, "M31", "targets")).toBe(
      "/tonight/finder?object=M31&site=site-1&telescope=scope-1&from=targets",
    );
  });

  it("adds night=next only when the page shows the next night", () => {
    expect(finderHref(view, "jupiter", "planets", "next")).toBe(
      "/tonight/finder?object=jupiter&site=site-1&telescope=scope-1&from=planets&night=next",
    );
    expect(finderHref(view, "jupiter", "planets", "tonight")).not.toContain("night=");
  });
});
