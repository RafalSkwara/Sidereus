import { describe, expect, it, test } from "vitest";

import { FIXTURES, TROMSO, WARSAW, fixtureTimeMs, minutesBetween, siteOf } from "./fixtures";
import { observingNight } from "./night";
import { TIME_TOLERANCE_MINUTES, darknessThresholdDegForBortle } from "./parameters";
import { darkWindow, sunAltitudeDeg, sunEvents, tonightDateFor } from "./sun";
import type { Site } from "./types";

describe("darkWindow (synthetic)", () => {
  const night = observingNight("2026-10-10", WARSAW.timeZone);

  it("gives nested windows for the three Bortle thresholds (wider for brighter skies)", () => {
    const w18 = darkWindow(WARSAW, night, darknessThresholdDegForBortle(3));
    const w15 = darkWindow(WARSAW, night, darknessThresholdDegForBortle(5));
    const w12 = darkWindow(WARSAW, night, darknessThresholdDegForBortle(8));
    if (w18.kind !== "window" || w15.kind !== "window" || w12.kind !== "window") {
      throw new Error("expected windows at every threshold on an October night at 52° N");
    }
    expect(w12.start.getTime()).toBeLessThan(w15.start.getTime());
    expect(w15.start.getTime()).toBeLessThan(w18.start.getTime());
    expect(w18.end.getTime()).toBeLessThan(w15.end.getTime());
    expect(w15.end.getTime()).toBeLessThan(w12.end.getTime());
  });

  it("reports the near-miss case honestly: Warsaw at midsummer never reaches -18 but does reach -12", () => {
    const midsummer = observingNight("2026-06-21", WARSAW.timeZone);
    const deep = darkWindow(WARSAW, midsummer, -18);
    expect(deep.kind).toBe("none");
    if (deep.kind === "none") {
      expect(deep.minSunAltitudeDeg).toBeGreaterThan(-18);
      expect(deep.minSunAltitudeDeg).toBeLessThan(-12);
    }
    const nautical = darkWindow(WARSAW, midsummer, -12);
    expect(nautical.kind).toBe("window");
  });

  // The one case of the old tonightDateFor describe that night-boundaries (USNO sites, no polar one) does not hold.
  it("keeps the noon rule for tonightDateFor on a night without a dark window", () => {
    // Tromsø at midsummer never reaches -18°: 09:00 CEST on 22 June still belongs to 21 June's night.
    expect(tonightDateFor(TROMSO, new Date("2026-06-22T07:00:00Z"), -18)).toBe("2026-06-21");
  });

  it("handles a polar night where the sun is already below the threshold at local noon", () => {
    const svalbardNorth: Site = { latitudeDeg: 80, longitudeDeg: 20, elevationM: 0, timeZone: "Europe/Oslo" };
    const december = observingNight("2026-12-21", svalbardNorth.timeZone);
    // Noon sun altitude ≈ 90 − 80 − 23.4 = −13.4°: already below −12°, never above it all night.
    const nautical = darkWindow(svalbardNorth, december, -12);
    expect(nautical.kind).toBe("window");
    if (nautical.kind === "window") {
      expect(nautical.start.getTime()).toBe(december.start.getTime());
      expect(nautical.end.getTime()).toBe(december.end.getTime());
      expect(nautical.clampedToNightStart).toBe(true);
      expect(nautical.clampedToNightEnd).toBe(true);
    }
    // −18° is crossed after noon and again before the next noon: an ordinary, unclamped window.
    const astronomical = darkWindow(svalbardNorth, december, -18);
    expect(astronomical.kind).toBe("window");
    if (astronomical.kind === "window") {
      expect(astronomical.clampedToNightStart).toBe(false);
      expect(astronomical.clampedToNightEnd).toBe(false);
      expect(astronomical.start.getTime()).toBeGreaterThan(december.start.getTime());
      expect(astronomical.end.getTime()).toBeLessThan(december.end.getTime());
      expect(sunAltitudeDeg(svalbardNorth, astronomical.start)).toBeCloseTo(-18, 1);
      expect(sunAltitudeDeg(svalbardNorth, astronomical.end)).toBeCloseTo(-18, 1);
    }
  });
});

describe("sun events vs Stellarium fixtures", () => {
  for (const fixture of FIXTURES) {
    if (fixture.sun.status !== "captured") {
      test.todo(`${fixture.name}: sun values ${fixture.sun.status} — see src/lib/engine/fixtures/README.md`);
      continue;
    }
    const sun = fixture.sun;
    const site = siteOf(fixture);
    const night = observingNight(fixture.night, site.timeZone);

    it(`${fixture.name}: sunset and sunrise within ${TIME_TOLERANCE_MINUTES} min`, () => {
      const events = sunEvents(site, night);
      if (sun.sunset === null) {
        expect(events.sunset).toBeNull();
      } else {
        expect(events.sunset).not.toBeNull();
        if (events.sunset !== null) {
          expect(minutesBetween(events.sunset, fixtureTimeMs(sun.sunset))).toBeLessThanOrEqual(TIME_TOLERANCE_MINUTES);
        }
      }
      if (sun.sunrise === null) {
        expect(events.sunrise).toBeNull();
      } else {
        expect(events.sunrise).not.toBeNull();
        if (events.sunrise !== null) {
          expect(minutesBetween(events.sunrise, fixtureTimeMs(sun.sunrise))).toBeLessThanOrEqual(
            TIME_TOLERANCE_MINUTES,
          );
        }
      }
    });

    it(`${fixture.name}: dark window at ${sun.darkStart.thresholdDeg}° within ${TIME_TOLERANCE_MINUTES} min`, () => {
      expect(sun.darkEnd.thresholdDeg).toBe(sun.darkStart.thresholdDeg);
      const dw = darkWindow(site, night, sun.darkStart.thresholdDeg);
      if (sun.expectNoDarkness) {
        expect(dw.kind).toBe("none");
        expect(sun.darkStart.time).toBeNull();
        expect(sun.darkEnd.time).toBeNull();
        return;
      }
      // A captured fixture that expects darkness must carry both crossing times, or it asserts nothing.
      expect(sun.darkStart.time).not.toBeNull();
      expect(sun.darkEnd.time).not.toBeNull();
      expect(dw.kind).toBe("window");
      if (dw.kind !== "window" || sun.darkStart.time === null || sun.darkEnd.time === null) {
        return;
      }
      expect(minutesBetween(dw.start, fixtureTimeMs(sun.darkStart.time))).toBeLessThanOrEqual(TIME_TOLERANCE_MINUTES);
      expect(minutesBetween(dw.end, fixtureTimeMs(sun.darkEnd.time))).toBeLessThanOrEqual(TIME_TOLERANCE_MINUTES);
    });
  }
});
