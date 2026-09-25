import { describe, expect, it } from "vitest";
import { resolveTimeZone } from "./timezone";
import { isValidTimeZone } from "./zones";

describe("resolveTimeZone", () => {
  it("auto resolves Warsaw to Europe/Warsaw", () => {
    expect(resolveTimeZone({ mode: "auto", latitudeDeg: 52.23, longitudeDeg: 21.01 })).toEqual({
      timeZone: "Europe/Warsaw",
      source: "auto",
    });
  });

  it("auto resolves Tromsø to Europe/Oslo", () => {
    expect(resolveTimeZone({ mode: "auto", latitudeDeg: 69.65, longitudeDeg: 18.96 })).toEqual({
      timeZone: "Europe/Oslo",
      source: "auto",
    });
  });

  it("manual keeps the given zone even when the coordinates point elsewhere", () => {
    expect(
      resolveTimeZone({ mode: "manual", timeZone: "America/New_York", latitudeDeg: 52.23, longitudeDeg: 21.01 }),
    ).toEqual({ timeZone: "America/New_York", source: "manual" });
  });

  it("manual without a zone is a programming error", () => {
    expect(() => resolveTimeZone({ mode: "manual", latitudeDeg: 52.23, longitudeDeg: 21.01 })).toThrow();
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA ids and rejects unknown or empty ones", () => {
    expect(isValidTimeZone("Europe/Warsaw")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
