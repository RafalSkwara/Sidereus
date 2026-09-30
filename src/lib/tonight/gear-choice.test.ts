import { describe, expect, it } from "vitest";

import { chooseOwned, isGearId, selectorKind } from "./gear-choice";

const OLDEST = { id: "0b6c3f0e-6f1a-4d2b-9a57-1c1f5b2f7a01", name: "Dobson 8" };
const SECOND = { id: "7e2d9c44-3b8a-4f10-8d6e-2a9b4c5d6e02", name: "ETX 90" };
const TELESCOPES = [OLDEST, SECOND];

const HOME = { id: "3a1f0c2d-8e4b-4c6a-9d7e-5f2a1b0c9d01", name: "Garden" };
const DARK_SITE = { id: "9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c02", name: "Teide" };
const SITES = [HOME, DARK_SITE];

describe("chooseOwned", () => {
  it("returns the requested item when the user owns it", () => {
    expect(chooseOwned(TELESCOPES, SECOND.id)).toBe(SECOND);
    expect(chooseOwned(SITES, DARK_SITE.id)).toBe(DARK_SITE);
  });

  it("falls back to the oldest for a missing, stale, foreign or malformed id, and to undefined with nothing owned", () => {
    expect(chooseOwned(TELESCOPES, undefined)).toBe(OLDEST);
    expect(chooseOwned([HOME], DARK_SITE.id)).toBe(HOME); // a site since deleted
    expect(chooseOwned(SITES, "5f1e2d3c-4b5a-4968-8776-655443322110")).toBe(HOME); // another user's
    expect(chooseOwned(SITES, SECOND.id)).toBe(HOME); // a telescope's id
    expect(chooseOwned(SITES, `${DARK_SITE.id}x`)).toBe(HOME);
    expect(chooseOwned<typeof OLDEST>([], SECOND.id)).toBeUndefined();
  });
});

describe("isGearId", () => {
  it("accepts only uuids, so nothing else from a cookie or query reaches a lookup", () => {
    for (const value of [OLDEST.id, OLDEST.id.toUpperCase(), HOME.id]) {
      expect(isGearId(value)).toBe(true);
    }
    for (const value of [
      "",
      "abc",
      `${OLDEST.id}x`,
      "0b6c3f0e6f1a4d2b9a571c1f5b2f7a01",
      "<script>",
      "52.23,21.01",
      undefined,
      42,
    ]) {
      expect(isGearId(value)).toBe(false);
    }
  });
});

describe("selectorKind", () => {
  it("shows no selector for one item, pills for two or three and a dropdown from four", () => {
    expect([0, 1, 2, 3, 4, 7].map(selectorKind)).toEqual(["none", "none", "pills", "pills", "dropdown", "dropdown"]);
  });
});
