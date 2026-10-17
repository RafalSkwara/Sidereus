import { describe, expect, it } from "vitest";

import { COMMON_NAMES } from "./common-names";
import { findDeepSky } from "./index";

describe("localised common names", () => {
  it("names only real catalogue ids, each with a non-empty Polish name", () => {
    const entries = Object.entries(COMMON_NAMES.pl);
    expect(entries.length).toBeGreaterThan(40);
    for (const [id, name] of entries) {
      expect(findDeepSky(id), `${id} is not a catalogue id`).toBeDefined();
      expect(name?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});
