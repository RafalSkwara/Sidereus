import { describe, expect, it } from "vitest";

import { CATALOGUE_META } from "./index";

const PINNED_SHA = "da90466031b0372c896588b85be6016c617e205b";

describe("Messier catalogue", () => {
  it("records the pinned OpenNGC commit and licence", () => {
    expect(CATALOGUE_META.commit).toBe(PINNED_SHA);
    expect(CATALOGUE_META.licence).toBe("CC BY-SA 4.0");
  });
});
