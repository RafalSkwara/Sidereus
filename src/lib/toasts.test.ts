import { describe, expect, it } from "vitest";

import { CELEBRATION_CLOSED, celebrationHolding, withoutParams } from "./toasts";

describe("withoutParams", () => {
  it("drops the named param and leaves a bare path", () => {
    expect(withoutParams("/gear?saved=telescope", ["saved"])).toBe("/gear");
  });

  it("keeps every other query param and the hash", () => {
    expect(withoutParams("/tonight/targets?site=abc&logged=M31&sort=time#more", ["logged"])).toBe(
      "/tonight/targets?site=abc&sort=time#more",
    );
    expect(withoutParams("/tonight?night=next&skyChecked=1&telescope=t1", ["skyChecked"])).toBe(
      "/tonight?night=next&telescope=t1",
    );
  });

  it("leaves a location without the param as it is", () => {
    expect(withoutParams("/log?page=2", ["saved"])).toBe("/log?page=2");
    expect(withoutParams("/log", ["saved", "updated"])).toBe("/log");
  });

  it("drops several params at once", () => {
    expect(withoutParams("/log?saved=M31&updated=M31&page=2", ["saved", "updated"])).toBe("/log?page=2");
  });
});

describe("celebrationHolding (a milestone celebration holds a toast's timer, impl review F1)", () => {
  const root = (dialog: { attrs: string[] } | null) => ({
    querySelector: (selector: string) => {
      expect(selector).toBe("dialog[data-milestone-celebration]");
      return dialog === null
        ? null
        : ({ hasAttribute: (name: string) => dialog.attrs.includes(name) } as unknown as Element);
    },
  });

  it("holds while the celebration dialog has not closed (open, or about to open on load)", () => {
    expect(celebrationHolding(root({ attrs: [] }))).not.toBeNull();
  });

  it("does not hold once the dialog has closed, or on a page without one", () => {
    expect(celebrationHolding(root({ attrs: [CELEBRATION_CLOSED] }))).toBeNull();
    expect(celebrationHolding(root(null))).toBeNull();
  });
});
