import { describe, expect, it } from "vitest";

import { COMMON_NAMES, localCommonName } from "./common-names";
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

  it("looks a name up by object id and falls back to the English name", () => {
    expect(localCommonName("M31", "Andromeda Galaxy", "pl")).toBe("Galaktyka Andromedy");
    expect(localCommonName("NGC7000", "North America Nebula", "pl")).toBe("Mgławica Ameryka Północna");
    expect(localCommonName("NGC7000", "North America Nebula", "en")).toBe("North America Nebula");
    expect(localCommonName("NGC188", "Some name", "pl")).toBe("Some name");
    expect(localCommonName("NGC7000", null, "pl")).toBeNull();
  });
});
