import { describe, expect, it } from "vitest";
import { recordableVerdict } from "./record";

const DARK_START = new Date("2026-10-10T18:20:00Z");

describe("recordableVerdict", () => {
  it("records nothing without a view", () => {
    expect(recordableVerdict(null)).toBeNull();
  });

  it("records nothing on a night with no dark window", () => {
    expect(
      recordableVerdict({
        siteId: "site-1",
        date: "2026-06-21",
        headline: { id: "noDarkness", key: "tonight.card.noDarkWindow", text: "No dark window" },
        darkStart: null,
      }),
    ).toBeNull();
  });

  it("records nothing without a dark-window start, whatever the headline", () => {
    expect(
      recordableVerdict({
        siteId: "site-1",
        date: "2026-10-10",
        headline: { id: "go", key: "verdict.level.go", text: "Clear" },
        darkStart: null,
      }),
    ).toBeNull();
  });

  it("never records a no-dark-window headline, even if a start were present", () => {
    expect(
      recordableVerdict({
        siteId: "site-1",
        date: "2026-06-21",
        headline: { id: "noDarkness", key: "tonight.card.noDarkWindow", text: "No dark window" },
        darkStart: DARK_START,
      }),
    ).toBeNull();
  });

  it("records the site, night, headline id and dark-window start of a normal night", () => {
    expect(
      recordableVerdict({
        siteId: "site-1",
        date: "2026-10-10",
        headline: { id: "humidityCap", key: "verdict.sky.humidityCap", text: "Clear, but damp" },
        darkStart: DARK_START,
      }),
    ).toEqual({ siteId: "site-1", night: "2026-10-10", headline: "humidityCap", darkStart: DARK_START });
  });

  it("records a night with no forecast, which the check later leaves out", () => {
    expect(
      recordableVerdict({
        siteId: "site-1",
        date: "2026-10-10",
        headline: { id: "noForecast", key: "verdict.sky.noForecast", text: "No forecast" },
        darkStart: DARK_START,
      }),
    ).toMatchObject({ headline: "noForecast" });
  });
});
