import { describe, expect, it } from "vitest";

import { getMessages, isMessageKey, plural, translateKey } from "./index";
import { en } from "./messages/en";
import { pl } from "./messages/pl";

type Kind = "string" | "function";

/** Every leaf of a catalogue as `dotted.path → kind`. Arrays are walked by index. */
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

/**
 * A plural category English does not need (`few`, `many`) on a branch that is a plural in `en`:
 * the only leaves a translation may add.
 */
function isAddedPluralForm(path: string, enLeaves: Map<string, Kind>): boolean {
  const match = /^(.*)\.(few|many)$/.exec(path);
  return match !== null && enLeaves.has(`${match[1]}.one`) && enLeaves.has(`${match[1]}.other`);
}

describe("catalogue parity", () => {
  it("has every en leaf in pl with the same kind, nothing extra, and every Polish plural form", () => {
    const enLeaves = leaves(en);
    const plLeaves = leaves(pl);
    expect(enLeaves.size).toBeGreaterThan(100);
    for (const [path, kind] of enLeaves) {
      expect({ path, kind: plLeaves.get(path) }).toEqual({ path, kind });
    }
    expect([...plLeaves.keys()].filter((path) => !enLeaves.has(path) && !isAddedPluralForm(path, enLeaves))).toEqual(
      [],
    );

    // A plural is a branch with both `one` and `other` (`eyepiecePresets.other` is not one).
    const bases = [...enLeaves.keys()]
      .filter((path) => path.endsWith(".other"))
      .map((path) => path.slice(0, -".other".length))
      .filter((base) => enLeaves.has(`${base}.one`));
    expect(bases.length).toBeGreaterThan(0);
    for (const base of bases) {
      expect({ base, few: plLeaves.has(`${base}.few`), many: plLeaves.has(`${base}.many`) }).toEqual({
        base,
        few: true,
        many: true,
      });
    }
  });
});

describe("translateKey", () => {
  const messages = getMessages("en");

  it("resolves a dotted key to its string and falls back for anything that is not a string leaf", () => {
    expect(translateKey(messages, "errors.site.latitudeRange", "errors.generic")).toBe(
      "Enter a latitude between -90 and 90 degrees.",
    );
    for (const key of [
      "errors.site.nope", // unknown key
      "Invalid login credentials", // free text
      "errors.site", // a branch, not a leaf
      "tonight.forecast.fresh", // a function message
      "errors.constructor", // a prototype property
      "__proto__.toString", // a prototype path
      "",
    ]) {
      expect(translateKey(messages, key, "errors.generic")).toBe("Something went wrong. Please try again.");
    }
  });

  it("tells keys from free text", () => {
    expect(isMessageKey("errors.checkFields")).toBe(true);
    expect(isMessageKey("Check the highlighted fields.")).toBe(false);
    expect(isMessageKey("errors.auth")).toBe(false);
  });
});

describe("plural", () => {
  it("picks English one/other and Polish one/few/many, falling back to other when a form is missing", () => {
    const forms = { one: "one", few: "few", many: "many", other: "other" };
    expect([1, 2, 5].map((n) => plural("en", n, forms))).toEqual(["one", "other", "other"]);
    expect([1, 2, 5, 22].map((n) => plural("pl", n, forms))).toEqual(["one", "few", "many", "few"]);
    expect(plural("pl", 5, { one: "one", other: "other" })).toBe("other");
  });
});
