import { describe, expect, it } from "vitest";

import { en } from "@/i18n/messages/en";
import type { TonightView } from "@/lib/tonight/build";
import { finderHref } from "@/lib/tonight/load";

import { finderBackHref, finderBackLabel, parseFinderFrom } from "./from";

describe("the finder chart's way back", () => {
  it("accepts only the three focused pages the link sits on", () => {
    expect(parseFinderFrom("targets")).toBe("targets");
    expect(parseFinderFrom("planets")).toBe("planets");
    expect(parseFinderFrom("plan")).toBe("plan");
    for (const value of ["log", "moon", "", "Targets", null, undefined]) {
      expect(parseFinderFrom(value)).toBeNull();
    }
  });

  it("goes back to that page, else to Tonight", () => {
    expect(finderBackHref("targets")).toBe("/tonight/targets");
    expect(finderBackHref("planets")).toBe("/tonight/planets");
    expect(finderBackHref("plan")).toBe("/tonight/plan");
    expect(finderBackHref(null)).toBe("/tonight");
    expect(finderBackLabel("targets", en)).toBe(en.tonight.pages.targets);
    expect(finderBackLabel("planets", en)).toBe(en.tonight.summary.planets);
    expect(finderBackLabel("plan", en)).toBe(en.tonight.summary.plan);
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

  it("carries from=plan for a row of the Session plan", () => {
    expect(finderHref(view, "NGC7000", "plan")).toBe(
      "/tonight/finder?object=NGC7000&site=site-1&telescope=scope-1&from=plan",
    );
  });

  it("adds night=next only when the page shows the next night", () => {
    expect(finderHref(view, "jupiter", "planets", "next")).toBe(
      "/tonight/finder?object=jupiter&site=site-1&telescope=scope-1&from=planets&night=next",
    );
    expect(finderHref(view, "jupiter", "planets", "tonight")).not.toContain("night=");
  });
});
