import { describe, expect, it } from "vitest";

import { localCommonName } from "./common-names";
import { MESSIER } from "./index";

describe("localCommonName", () => {
  const named = MESSIER.filter((o) => o.commonName !== null);

  it("covers every Messier object with an English common name in Polish", () => {
    expect(named.length).toBeGreaterThan(0);
    const missing = named
      .filter((o) => localCommonName(o.messier, o.commonName, "pl") === o.commonName)
      .map((o) => o.id);
    expect(missing).toEqual([]);
  });

  it("keeps the catalogue's English name in English", () => {
    for (const o of named) {
      expect(localCommonName(o.messier, o.commonName, "en")).toBe(o.commonName);
    }
  });

  it("gives objects without a common name none in any locale", () => {
    for (const o of MESSIER.filter((x) => x.commonName === null)) {
      expect(localCommonName(o.messier, null, "pl")).toBeNull();
    }
  });

  it("uses the established Polish names", () => {
    expect(localCommonName(1, "Crab Nebula", "pl")).toBe("Mgławica Krab");
    expect(localCommonName(31, "Andromeda Galaxy", "pl")).toBe("Galaktyka Andromedy");
    expect(localCommonName(45, "Pleiades", "pl")).toBe("Plejady");
  });
});
