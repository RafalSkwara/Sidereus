import { describe, expect, it } from "vitest";

import { getMessages } from "@/i18n";
import { findDeepSky } from "@/lib/catalogue";
import { EXPECTATION_KEYS, expectationFor } from "@/lib/engine";

import { expectationKeyFor, expectationText, expectationView } from "./expectation";

describe("expectationKeyFor", () => {
  it("is the engine's key for a catalogue object", () => {
    const m13 = findDeepSky("M13");
    expect(m13).toBeDefined();
    expect(expectationKeyFor("M13", 4, 150)).toBe(m13 && expectationFor(m13, 4, 150));
  });

  it("is null for an id the catalogue does not list", () => {
    expect(expectationKeyFor("NGC1", 4, 150)).toBeNull();
  });
});

describe("expectationText", () => {
  it("reads the phrase in the request's language", () => {
    const key = expectationKeyFor("M13", 4, 150);
    expect(key).not.toBeNull();
    if (key === null) {
      return;
    }
    const en = getMessages("en");
    const pl = getMessages("pl");
    expect(expectationText(key, en)).toBe(en.tonight.expect.phrase[key]);
    expect(expectationText(key, pl)).toBe(pl.tonight.expect.phrase[key]);
    expect(expectationText(key, en)).not.toBe(expectationText(key, pl));
  });

  it("has a non-empty phrase for every key in both languages", () => {
    for (const locale of ["en", "pl"] as const) {
      const messages = getMessages(locale);
      for (const key of EXPECTATION_KEYS) {
        expect(expectationText(key, messages).trim(), `${locale} ${key}`).not.toBe("");
      }
      expect(Object.keys(messages.tonight.expect.phrase).sort()).toEqual([...EXPECTATION_KEYS].sort());
    }
  });
});

describe("expectationView", () => {
  it("shows the lines on a confirmed full plan", () => {
    expect(expectationView("full", "full")).toBe("lines");
  });

  it("shows the locked line only on an explicit free read", () => {
    expect(expectationView("free", "free")).toBe("locked");
  });

  it("shows neither when the read failed", () => {
    expect(expectationView("free", "unknown")).toBe("none");
  });
});
