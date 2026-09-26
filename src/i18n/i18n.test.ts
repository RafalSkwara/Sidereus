import { describe, expect, it } from "vitest";

import { getMessages, isMessageKey, plural, translateKey } from "./index";
import { en } from "./messages/en";
import { pl } from "./messages/pl";

type Kind = "string" | "function";

/** Every leaf of a catalogue as `dotted.path → kind`. Arrays (the compass) are walked by index. */
function leaves(node: unknown, prefix = ""): Map<string, Kind> {
  const out = new Map<string, Kind>();
  if (typeof node === "string") {
    out.set(prefix, "string");
    return out;
  }
  if (typeof node === "function") {
    out.set(prefix, "function");
    return out;
  }
  if (typeof node === "object" && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      for (const [path, kind] of leaves(value, prefix ? `${prefix}.${key}` : key)) {
        out.set(path, kind);
      }
    }
  }
  return out;
}

describe("catalogue parity", () => {
  it("has every en leaf in pl with the same kind, and nothing extra", () => {
    const enLeaves = leaves(en);
    const plLeaves = leaves(pl);
    expect(enLeaves.size).toBeGreaterThan(100);
    for (const [path, kind] of enLeaves) {
      expect({ path, kind: plLeaves.get(path) }).toEqual({ path, kind });
    }
    expect([...plLeaves.keys()].filter((path) => !enLeaves.has(path))).toEqual([]);
  });

  it("has a 16-point compass", () => {
    expect(en.compass).toHaveLength(16);
    expect(pl.compass).toHaveLength(16);
  });

  it("serves each locale's catalogue", () => {
    expect(getMessages("en")).toBe(en);
    expect(getMessages("pl")).toBe(pl);
  });
});

describe("translateKey", () => {
  const messages = getMessages("en");

  it("resolves a dotted key to its string", () => {
    expect(translateKey(messages, "errors.site.latitudeRange", "errors.generic")).toBe(
      "Enter a latitude between -90 and 90 degrees.",
    );
  });

  it.each([
    ["an unknown key", "errors.site.nope"],
    ["free text", "Invalid login credentials"],
    ["a branch, not a leaf", "errors.site"],
    ["a function message", "tonight.forecast.fresh"],
    ["a prototype property", "errors.constructor"],
    ["a prototype path", "__proto__.toString"],
    ["an empty string", ""],
  ])("falls back for %s", (_label, key) => {
    expect(translateKey(messages, key, "errors.generic")).toBe("Something went wrong. Please try again.");
  });

  it("tells keys from free text", () => {
    expect(isMessageKey("errors.checkFields")).toBe(true);
    expect(isMessageKey("Check the highlighted fields.")).toBe(false);
    expect(isMessageKey("errors.auth")).toBe(false);
  });
});

describe("plural", () => {
  const forms = { one: "one", few: "few", many: "many", other: "other" };

  it("uses English one/other", () => {
    expect(plural("en", 1, forms)).toBe("one");
    expect(plural("en", 2, forms)).toBe("other");
    expect(plural("en", 5, forms)).toBe("other");
  });

  it("uses Polish one/few/many", () => {
    expect(plural("pl", 1, forms)).toBe("one");
    expect(plural("pl", 2, forms)).toBe("few");
    expect(plural("pl", 5, forms)).toBe("many");
    expect(plural("pl", 22, forms)).toBe("few");
  });

  it("falls back to other when a category has no form", () => {
    expect(plural("pl", 5, { one: "one", other: "other" })).toBe("other");
  });
});
