import { describe, expect, it } from "vitest";
import { noticeFor, noticeHidden, withDescription } from "./page-state";

const UNTIL = "2026-10-06T05:30:00.000Z";
const BEFORE = Date.parse(UNTIL) - 1;
const AT = Date.parse(UNTIL);

describe("noticeFor", () => {
  it("says prepared before tonight's night is over, old forecast for the next-night copy, stale from validUntil on or for a missing or malformed validUntil", () => {
    const rows: [string, Parameters<typeof noticeFor>, string][] = [
      ["tonight's copy before its night is over", ["tonight", UNTIL, BEFORE], "prepared"],
      ["the next-night copy", ["next", UNTIL, BEFORE], "old-forecast"],
      ["tonight's copy from validUntil", ["tonight", UNTIL, AT], "stale"],
      ["the next-night copy after validUntil", ["next", UNTIL, AT + 1], "stale"],
      ["a missing validUntil", ["tonight", undefined, BEFORE], "stale"],
      ["a malformed validUntil", ["tonight", "soon", BEFORE], "stale"],
    ];
    expect(rows).toHaveLength(6);
    for (const [label, args, expected] of rows) {
      expect(noticeFor(...args), label).toBe(expected);
    }
  });
});

describe("noticeHidden", () => {
  it("shows only the wanted notice, hides every notice when none is wanted, and keeps a closed notice hidden", () => {
    const rows: [string, Parameters<typeof noticeHidden>[0], boolean][] = [
      ["the wanted notice", { kind: "prepared", wanted: "prepared", dismissed: false }, false],
      ["another notice than the wanted one", { kind: "stale", wanted: "prepared", dismissed: false }, true],
      ["old forecast when stale is wanted", { kind: "old-forecast", wanted: "stale", dismissed: false }, true],
      ["none wanted", { kind: "prepared", wanted: null, dismissed: false }, true],
      ["none wanted, no kind", { kind: undefined, wanted: null, dismissed: false }, true],
      ["a closed wanted notice", { kind: "prepared", wanted: "prepared", dismissed: true }, true],
      ["a closed unwanted notice", { kind: "stale", wanted: "prepared", dismissed: true }, true],
    ];
    expect(rows).toHaveLength(7);
    for (const [label, input, expected] of rows) {
      expect(noticeHidden(input), label).toBe(expected);
    }
  });
});

describe("withDescription", () => {
  it("adds the id once and keeps the others, and removes only that id, and the attribute when nothing is left", () => {
    const rows: [string, Parameters<typeof withDescription>, string | null][] = [
      ["adds to nothing", [null, "hint", true], "hint"],
      ["adds beside another id", ["own", "hint", true], "own hint"],
      ["adds once", ["own hint", "hint", true], "own hint"],
      ["removes only that id", ["own hint", "hint", false], "own"],
      ["removes the attribute when nothing is left", ["hint", "hint", false], null],
      ["removes from nothing", [null, "hint", false], null],
    ];
    expect(rows).toHaveLength(6);
    for (const [label, args, expected] of rows) {
      expect(withDescription(...args), label).toBe(expected);
    }
  });
});
