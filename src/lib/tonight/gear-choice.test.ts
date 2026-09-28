import { describe, expect, it } from "vitest";

import { chooseOwned, isGearId, selectorKind } from "./gear-choice";

const OLDEST = { id: "0b6c3f0e-6f1a-4d2b-9a57-1c1f5b2f7a01", name: "Dobson 8" };
const SECOND = { id: "7e2d9c44-3b8a-4f10-8d6e-2a9b4c5d6e02", name: "ETX 90" };
const TELESCOPES = [OLDEST, SECOND];

const HOME = { id: "3a1f0c2d-8e4b-4c6a-9d7e-5f2a1b0c9d01", name: "Garden" };
const DARK_SITE = { id: "9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c02", name: "Teide" };
const SITES = [HOME, DARK_SITE];

describe("chooseOwned", () => {
  it("returns the requested telescope when the user owns it", () => {
    expect(chooseOwned(TELESCOPES, SECOND.id)).toBe(SECOND);
  });

  it("falls back to the oldest for an unknown, deleted or foreign id", () => {
    expect(chooseOwned(TELESCOPES, "5f1e2d3c-4b5a-4968-8776-655443322110")).toBe(OLDEST);
  });

  it("falls back to the oldest when nothing is requested", () => {
    expect(chooseOwned(TELESCOPES, undefined)).toBe(OLDEST);
  });

  it("returns undefined when the user owns nothing", () => {
    expect(chooseOwned<typeof OLDEST>([], SECOND.id)).toBeUndefined();
  });

  describe("sites", () => {
    it("returns the requested site when the user owns it", () => {
      expect(chooseOwned(SITES, DARK_SITE.id)).toBe(DARK_SITE);
    });

    it("falls back to the oldest site for a stale id (a site since deleted)", () => {
      const afterDelete = [HOME];
      expect(chooseOwned(afterDelete, DARK_SITE.id)).toBe(HOME);
    });

    it("falls back to the oldest site for a foreign id (another user's, or a telescope's)", () => {
      expect(chooseOwned(SITES, "5f1e2d3c-4b5a-4968-8776-655443322110")).toBe(HOME);
      expect(chooseOwned(SITES, SECOND.id)).toBe(HOME);
    });

    it("falls back to the oldest site for a malformed id the shell would not pass on", () => {
      const malformed = `${DARK_SITE.id}x`;
      expect(isGearId(malformed)).toBe(false);
      expect(chooseOwned(SITES, isGearId(malformed) ? malformed : undefined)).toBe(HOME);
      expect(chooseOwned(SITES, malformed)).toBe(HOME);
    });
  });
});

describe("isGearId", () => {
  it.each([OLDEST.id, OLDEST.id.toUpperCase(), HOME.id])("accepts the uuid %s", (value) => {
    expect(isGearId(value)).toBe(true);
  });

  it.each(["", "abc", `${OLDEST.id}x`, "0b6c3f0e6f1a4d2b9a571c1f5b2f7a01", "<script>", "52.23,21.01", undefined, 42])(
    "rejects %s",
    (value) => {
      expect(isGearId(value)).toBe(false);
    },
  );
});

describe("selectorKind", () => {
  it.each([
    [0, "none"],
    [1, "none"],
    [2, "pills"],
    [3, "pills"],
    [4, "dropdown"],
    [7, "dropdown"],
  ] as const)("%i items → %s", (count, kind) => {
    expect(selectorKind(count)).toBe(kind);
  });
});
