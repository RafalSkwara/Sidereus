import { describe, expect, it } from "vitest";
import { noticeFor, noticeHidden, withDescription } from "./page-state";

const UNTIL = "2026-10-06T05:30:00.000Z";
const BEFORE = Date.parse(UNTIL) - 1;
const AT = Date.parse(UNTIL);

describe("noticeFor", () => {
  it("says prepared for tonight's copy before its night is over", () => {
    expect(noticeFor("tonight", UNTIL, BEFORE)).toBe("prepared");
  });

  it("says old forecast for the next-night copy", () => {
    expect(noticeFor("next", UNTIL, BEFORE)).toBe("old-forecast");
  });

  it("says stale from validUntil on, whatever the kind", () => {
    expect(noticeFor("tonight", UNTIL, AT)).toBe("stale");
    expect(noticeFor("next", UNTIL, AT + 1)).toBe("stale");
  });

  it("treats a missing or malformed validUntil as stale", () => {
    expect(noticeFor("tonight", undefined, BEFORE)).toBe("stale");
    expect(noticeFor("tonight", "soon", BEFORE)).toBe("stale");
  });
});

describe("noticeHidden", () => {
  it("shows only the wanted notice", () => {
    expect(noticeHidden({ kind: "prepared", wanted: "prepared", dismissed: false })).toBe(false);
    expect(noticeHidden({ kind: "stale", wanted: "prepared", dismissed: false })).toBe(true);
    expect(noticeHidden({ kind: "old-forecast", wanted: "stale", dismissed: false })).toBe(true);
  });

  it("hides every notice when none is wanted", () => {
    expect(noticeHidden({ kind: "prepared", wanted: null, dismissed: false })).toBe(true);
    expect(noticeHidden({ kind: undefined, wanted: null, dismissed: false })).toBe(true);
  });

  it("keeps a closed notice hidden, wanted or not", () => {
    expect(noticeHidden({ kind: "prepared", wanted: "prepared", dismissed: true })).toBe(true);
    expect(noticeHidden({ kind: "stale", wanted: "prepared", dismissed: true })).toBe(true);
  });
});

describe("withDescription", () => {
  it("adds the id once and keeps the others", () => {
    expect(withDescription(null, "hint", true)).toBe("hint");
    expect(withDescription("own", "hint", true)).toBe("own hint");
    expect(withDescription("own hint", "hint", true)).toBe("own hint");
  });

  it("removes only that id, and the attribute when nothing is left", () => {
    expect(withDescription("own hint", "hint", false)).toBe("own");
    expect(withDescription("hint", "hint", false)).toBeNull();
    expect(withDescription(null, "hint", false)).toBeNull();
  });
});
