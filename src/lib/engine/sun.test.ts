import { describe, expect, it, test } from "vitest";

import { FIXTURES, fixtureTimeMs, minutesBetween } from "./fixtures";
import { observingNight } from "./night";
import { TIME_TOLERANCE_MINUTES, darknessThresholdDegForBortle } from "./parameters";
import { darkWindow, sunAltitudeDeg, sunEvents } from "./sun";
import type { Site } from "./types";

const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 110, timeZone: "Europe/Warsaw" };
const TROMSO: Site = { latitudeDeg: 69.65, longitudeDeg: 18.96, elevationM: 10, timeZone: "Europe/Oslo" };

describe("darkWindow (synthetic)", () => {
  const night = observingNight("2026-10-10", WARSAW.timeZone);

  it("finds an astronomical-darkness window inside the Warsaw night", () => {
    const dw = darkWindow(WARSAW, night, -18);
    expect(dw.kind).toBe("window");
    if (dw.kind !== "window") {
      return;
    }
    expect(dw.start.getTime()).toBeGreaterThan(night.start.getTime());
    expect(dw.end.getTime()).toBeLessThan(night.end.getTime());
    expect(dw.start.getTime()).toBeLessThan(dw.end.getTime());
    expect(dw.clampedToNightEnd).toBe(false);
    expect(sunAltitudeDeg(WARSAW, dw.start)).toBeCloseTo(-18, 1);
    expect(sunAltitudeDeg(WARSAW, dw.end)).toBeCloseTo(-18, 1);
    const midpoint = new Date((dw.start.getTime() + dw.end.getTime()) / 2);
    expect(sunAltitudeDeg(WARSAW, midpoint)).toBeLessThan(-18);
  });

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

  it("reports no darkness at any threshold under the Tromsø midnight sun", () => {
    const june = observingNight("2026-06-21", TROMSO.timeZone);
    for (const threshold of [-18, -15, -12] as const) {
      const dw = darkWindow(TROMSO, june, threshold);
      expect(dw.kind).toBe("none");
      if (dw.kind === "none") {
        expect(dw.minSunAltitudeDeg).toBeGreaterThan(-18);
        expect(dw.minSunAltitudeDeg).toBeGreaterThan(0); // the sun does not set at all
        expect(dw.at.getTime()).toBeGreaterThan(june.start.getTime());
        expect(dw.at.getTime()).toBeLessThan(june.end.getTime());
      }
    }
    expect(sunEvents(TROMSO, june)).toEqual({ sunset: null, sunrise: null });
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

  it("orders sunset, dark window and sunrise within the night", () => {
    const events = sunEvents(WARSAW, night);
    const dw = darkWindow(WARSAW, night, -18);
    if (events.sunset === null || events.sunrise === null || dw.kind !== "window") {
      throw new Error("expected sunset, sunrise and a dark window on 2026-10-10 in Warsaw");
    }
    expect(events.sunset.getTime()).toBeLessThan(dw.start.getTime());
    expect(dw.end.getTime()).toBeLessThan(events.sunrise.getTime());
    expect(events.sunrise.getTime()).toBeLessThan(night.end.getTime());
  });

  it("rejects thresholds outside [-90, 0]", () => {
    expect(() => darkWindow(WARSAW, night, 5)).toThrow(RangeError);
    expect(() => darkWindow(WARSAW, night, -91)).toThrow(RangeError);
  });

  it("is deterministic", () => {
    const a = darkWindow(WARSAW, night, -18);
    const b = darkWindow(WARSAW, night, -18);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("darknessThresholdDegForBortle", () => {
  it("maps Bortle classes to the PRD's candidate thresholds", () => {
    expect([1, 2, 3, 4].map(darknessThresholdDegForBortle)).toEqual([-18, -18, -18, -18]);
    expect([5, 6].map(darknessThresholdDegForBortle)).toEqual([-15, -15]);
    expect([7, 8, 9].map(darknessThresholdDegForBortle)).toEqual([-12, -12, -12]);
    expect(() => darknessThresholdDegForBortle(0)).toThrow(RangeError);
    expect(() => darknessThresholdDegForBortle(10)).toThrow(RangeError);
    expect(() => darknessThresholdDegForBortle(4.5)).toThrow(RangeError);
  });
});

describe("sun events vs Stellarium fixtures", () => {
  for (const fixture of FIXTURES) {
    if (fixture.sun.status !== "captured") {
      test.todo(`${fixture.name}: sun values ${fixture.sun.status} — see src/lib/engine/fixtures/README.md`);
      continue;
    }
    const sun = fixture.sun;
    const site: Site = {
      latitudeDeg: fixture.site.latitudeDeg,
      longitudeDeg: fixture.site.longitudeDeg,
      elevationM: fixture.site.elevationM,
      timeZone: fixture.site.timeZone,
    };
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
      const dw = darkWindow(site, night, sun.darkStart.thresholdDeg);
      if (sun.expectNoDarkness) {
        expect(dw.kind).toBe("none");
        return;
      }
      expect(dw.kind).toBe("window");
      if (dw.kind !== "window") {
        return;
      }
      if (sun.darkStart.time !== null) {
        expect(minutesBetween(dw.start, fixtureTimeMs(sun.darkStart.time))).toBeLessThanOrEqual(TIME_TOLERANCE_MINUTES);
      }
      if (sun.darkEnd.time !== null) {
        expect(minutesBetween(dw.end, fixtureTimeMs(sun.darkEnd.time))).toBeLessThanOrEqual(TIME_TOLERANCE_MINUTES);
      }
    });
  }
});
