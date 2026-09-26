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

/**
 * A plural category English does not need (`few`, `many`) on a branch that is a plural in `en`:
 * the only leaves a translation may add.
 */
function isAddedPluralForm(path: string, enLeaves: Map<string, Kind>): boolean {
  const match = /^(.*)\.(few|many)$/.exec(path);
  return match !== null && enLeaves.has(`${match[1]}.one`) && enLeaves.has(`${match[1]}.other`);
}

/** Params that render every placeholder as its own name, so a template can be compared as text. */
const PLACEHOLDERS = new Proxy(
  {},
  { get: (_target, key) => (typeof key === "string" ? `{${key}}` : undefined) },
) as Record<string, string>;

/** The leaf at a dotted path; a function leaf is rendered with `PLACEHOLDERS`. */
function render(catalogue: unknown, path: string): string {
  let node: unknown = catalogue;
  for (const part of path.split(".")) {
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "function" ? (node as (p: Record<string, string>) => string)(PLACEHOLDERS) : String(node);
}

describe("catalogue parity", () => {
  it("has every en leaf in pl with the same kind, and nothing extra", () => {
    const enLeaves = leaves(en);
    const plLeaves = leaves(pl);
    expect(enLeaves.size).toBeGreaterThan(100);
    for (const [path, kind] of enLeaves) {
      expect({ path, kind: plLeaves.get(path) }).toEqual({ path, kind });
    }
    expect([...plLeaves.keys()].filter((path) => !enLeaves.has(path) && !isAddedPluralForm(path, enLeaves))).toEqual(
      [],
    );
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

describe("Polish catalogue", () => {
  /** String leaves that are the same in both languages: names and endonyms, never sentences. */
  const SAME_TEXT = new Set([
    "common.appName", // brand
    "landing.footerWork", // title of Galileo's book, Latin
    "eyepiecePresets.plossl.short", // eyepiece design named after Simon Plössl
    "preferences.english", // endonym, shown with lang="en"
    "preferences.polish", // endonym, shown with lang="pl"
  ]);
  /** Templates that hold only placeholders, symbols and units shared by both languages. */
  const SAME_TEMPLATE = new Set([
    "common.pageTitle", // "{title} · Sidereus"
    "siteForm.bortleOption", // "{value} · {label}"
    "gear.eyepieces.focalLength", // "{mm} mm"
    "tonight.object.magnification", // "({magnification}×)"
    "tonight.direction", // "{point}, {altitude}°"
    "tonight.reason.line", // "{lead} · {second}"
    "tonight.time.minutes", // "{minutes} min"
    "tonight.age.minutes", // "{minutes} min"
  ]);

  it("overrides every English leaf outside the invariants", () => {
    const inherited = [...leaves(en)]
      .filter(([path, kind]) => !(kind === "string" ? SAME_TEXT : SAME_TEMPLATE).has(path))
      .filter(([path]) => render(pl, path) === render(en, path))
      .map(([path]) => path);
    expect(inherited).toEqual([]);
  });

  it("keeps the invariants invariant, so the allowlists stay honest", () => {
    for (const path of [...SAME_TEXT, ...SAME_TEMPLATE]) {
      expect({ path, pl: render(pl, path) }).toEqual({ path, pl: render(en, path) });
    }
  });

  it("gives every plural the few and many forms Polish needs", () => {
    const enLeaves = leaves(en);
    // A plural is a branch with both `one` and `other` (`eyepiecePresets.other` is not one).
    const bases = [...enLeaves.keys()]
      .filter((path) => path.endsWith(".other"))
      .map((path) => path.slice(0, -".other".length))
      .filter((base) => enLeaves.has(`${base}.one`));
    expect(bases.length).toBeGreaterThan(0);
    const plLeaves = leaves(pl);
    for (const base of bases) {
      expect({ base, few: plLeaves.has(`${base}.few`), many: plLeaves.has(`${base}.many`) }).toEqual({
        base,
        few: true,
        many: true,
      });
    }
  });

  it.each([
    [1, "1 obiekt wart dziś uwagi"],
    [2, "2 obiekty warte dziś uwagi"],
    [5, "5 obiektów wartych dziś uwagi"],
    [22, "22 obiekty warte dziś uwagi"],
  ])("counts %i object(s) with the Polish plural", (n, text) => {
    expect(plural("pl", n, pl.tonight.cleared.count)({ count: String(n) })).toBe(text);
  });

  it.each([
    [1, "1 dzień"],
    [2, "2 dni"],
    [5, "5 dni"],
    [22, "22 dni"],
  ])("counts %i day(s) with the Polish plural", (n, text) => {
    expect(plural("pl", n, pl.tonight.age.days)({ count: String(n) })).toBe(text);
  });

  it.each([
    [1, "Wpisz jeszcze 1 znak"],
    [2, "Wpisz jeszcze 2 znaki"],
    [5, "Wpisz jeszcze 5 znaków"],
    [22, "Wpisz jeszcze 22 znaki"],
  ])("counts %i missing character(s) with the Polish plural", (n, text) => {
    expect(plural("pl", n, pl.auth.signUp.moreCharacters)({ count: String(n) })).toBe(text);
  });

  it("has the Polish compass, clockwise from north", () => {
    expect(pl.compass).toEqual([
      "Pn",
      "PnPnW",
      "PnW",
      "WPnW",
      "W",
      "WPdW",
      "PdW",
      "PdPdW",
      "Pd",
      "PdPdZ",
      "PdZ",
      "ZPdZ",
      "Z",
      "ZPnZ",
      "PnZ",
      "PnPnZ",
    ]);
  });

  it("names the onboarding site Dom", () => {
    expect(pl.onboarding.homeSiteName).toBe("Dom");
  });

  it("translates a ?error= key", () => {
    expect(translateKey(getMessages("pl"), "errors.site.latitudeRange", "errors.generic")).toBe(
      "Podaj szerokość geograficzną od -90 do 90 stopni.",
    );
    expect(translateKey(getMessages("pl"), "Invalid login credentials", "errors.generic")).toBe(
      "Coś poszło nie tak. Spróbuj ponownie.",
    );
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
