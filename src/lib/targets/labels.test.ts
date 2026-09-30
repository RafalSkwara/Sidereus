import { describe, expect, it } from "vitest";
import { targetLabel } from "./labels";

describe("targetLabel", () => {
  it("names a Messier object by its id and localised common name", () => {
    expect(targetLabel("M31", "en")).toEqual({ id: "M31", name: "Andromeda Galaxy" });
    expect(targetLabel("M31", "pl")).toEqual({ id: "M31", name: "Galaktyka Andromedy" });
  });

  it("leaves the name out for a Messier object without one", () => {
    expect(targetLabel("M3", "pl")).toEqual({ id: "M3", name: null });
  });

  it("names a planet by its localised name alone", () => {
    expect(targetLabel("jupiter", "en")).toEqual({ id: "Jupiter", name: null });
    expect(targetLabel("jupiter", "pl")).toEqual({ id: "Jowisz", name: null });
  });
});
