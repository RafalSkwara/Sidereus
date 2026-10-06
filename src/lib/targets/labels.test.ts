import { describe, expect, it } from "vitest";
import { isKnownTarget, targetLabel } from "./labels";

describe("targetLabel", () => {
  it("names a Messier object by its id and localised common name", () => {
    expect(targetLabel("M31", "en")).toEqual({ id: "M31", name: "Andromeda Galaxy" });
    expect(targetLabel("M31", "pl")).toEqual({ id: "M31", name: "Galaktyka Andromedy" });
  });

  it("leaves the name out for a Messier object without one", () => {
    expect(targetLabel("M3", "pl")).toEqual({ id: "M3", name: null });
  });

  it("names a Caldwell object by its display label and localised common name", () => {
    expect(targetLabel("NGC7000", "en")).toEqual({ id: "NGC 7000", name: "North America Nebula" });
    expect(targetLabel("NGC7000", "pl")).toEqual({ id: "NGC 7000", name: "Mgławica Ameryka Północna" });
    expect(targetLabel("NGC869", "en").id).toBe("NGC 869 / 884");
    expect(targetLabel("IC405", "pl").id).toBe("IC 405");
  });

  it("names a planet by its localised name alone", () => {
    expect(targetLabel("jupiter", "en")).toEqual({ id: "Jupiter", name: null });
    expect(targetLabel("jupiter", "pl")).toEqual({ id: "Jowisz", name: null });
  });

  it("names the Moon by its localised name alone", () => {
    expect(targetLabel("moon", "en")).toEqual({ id: "Moon", name: null });
    expect(targetLabel("moon", "pl")).toEqual({ id: "Księżyc", name: null });
  });
});

describe("isKnownTarget", () => {
  it("accepts planets, the Moon and every catalogue object", () => {
    for (const key of ["jupiter", "neptune", "moon", "M1", "M110", "NGC7000", "NGC869", "IC405"] as const) {
      expect(isKnownTarget(key)).toBe(true);
    }
  });

  it("rejects a well-formed key the catalogue lacks", () => {
    for (const key of ["NGC1", "IC1", "NGC9999"] as const) {
      expect(isKnownTarget(key)).toBe(false);
    }
  });
});
