import { describe, expect, it } from "vitest";

import { chooseTelescope, isTelescopeId, selectorKind } from "./telescope-choice";

const OLDEST = { id: "0b6c3f0e-6f1a-4d2b-9a57-1c1f5b2f7a01", name: "Dobson 8" };
const SECOND = { id: "7e2d9c44-3b8a-4f10-8d6e-2a9b4c5d6e02", name: "ETX 90" };
const TELESCOPES = [OLDEST, SECOND];

describe("chooseTelescope", () => {
  it("returns the requested telescope when the user owns it", () => {
    expect(chooseTelescope(TELESCOPES, SECOND.id)).toBe(SECOND);
  });

  it("falls back to the oldest for an unknown, deleted or foreign id", () => {
    expect(chooseTelescope(TELESCOPES, "5f1e2d3c-4b5a-4968-8776-655443322110")).toBe(OLDEST);
  });

  it("falls back to the oldest when nothing is requested", () => {
    expect(chooseTelescope(TELESCOPES, undefined)).toBe(OLDEST);
  });

  it("returns undefined when the user owns no telescope", () => {
    expect(chooseTelescope<typeof OLDEST>([], SECOND.id)).toBeUndefined();
  });
});

describe("isTelescopeId", () => {
  it.each([OLDEST.id, OLDEST.id.toUpperCase()])("accepts the uuid %s", (value) => {
    expect(isTelescopeId(value)).toBe(true);
  });

  it.each(["", "abc", `${OLDEST.id}x`, "0b6c3f0e6f1a4d2b9a571c1f5b2f7a01", "<script>", undefined, 42])(
    "rejects %s",
    (value) => {
      expect(isTelescopeId(value)).toBe(false);
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
  ] as const)("%i telescopes → %s", (count, kind) => {
    expect(selectorKind(count)).toBe(kind);
  });
});
