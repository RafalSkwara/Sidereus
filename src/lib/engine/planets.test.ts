import { describe, expect, it } from "vitest";

import { PLANET_REFERENCES, WARSAW, circularDeltaDeg, fixtureTimeMs, siteOf } from "./fixtures";
import { observingNight } from "./night";
import { objectTracks } from "./objects";
import { PLANET_WINDOW_SUN_ALTITUDE_DEG } from "./parameters";
import { PLANET_KEYS, planetFacts, planetTracks } from "./planets";
import { darkWindow } from "./sun";

/**
 * Refraction models differ near the horizon (Skyfield's depends on temperature and pressure,
 * astronomy-engine's "normal" is fixed), so positions are compared only above this altitude.
 */
const REFERENCE_MIN_ALTITUDE_DEG = 5;

/**
 * Position agreement with Skyfield. Far tighter than the engine's `ALTITUDE_TOLERANCE_DEG` (sized for hand-read
 * Stellarium values): the two libraries agree to ~0.005°, and refraction above 5° is only ~0.1°, so a
 * 1° tolerance could not tell a refracted position from an unrefracted one.
 */
const SKYFIELD_TOLERANCE_DEG = 0.05;

/** Diameter agreement: 1″, or 2% of the reference where that is tighter (Uranus, Neptune, Mars, Mercury). */
const diameterToleranceArcsec = (referenceArcsec: number): number => Math.min(1, 0.02 * referenceArcsec);

describe("planet positions and sizes vs the Skyfield/DE421 reference", () => {
  for (const reference of PLANET_REFERENCES) {
    const site = siteOf(reference);
    const above = reference.samples.filter((s) => s.altitudeDeg > REFERENCE_MIN_ALTITUDE_DEG);

    it(`${reference.name}: ${above.length} samples above ${REFERENCE_MIN_ALTITUDE_DEG}° within ${SKYFIELD_TOLERANCE_DEG}°`, () => {
      // Every planet that is up in the window is checked, not just the easy ones.
      expect(new Set(above.map((s) => s.planet)).size).toBeGreaterThanOrEqual(4);
      for (const s of above) {
        const time = new Date(fixtureTimeMs(s.time));
        const [[position]] = planetTracks(site, { start: time, end: time }, [s.planet]);
        expect(Math.abs(position.altitudeDeg - s.altitudeDeg)).toBeLessThanOrEqual(SKYFIELD_TOLERANCE_DEG);
        expect(circularDeltaDeg(position.azimuthDeg, s.azimuthDeg)).toBeLessThanOrEqual(SKYFIELD_TOLERANCE_DEG);
      }
    });

    it(`${reference.name}: apparent diameters of all ${reference.samples.length} samples within 1″ (2% for the smallest)`, () => {
      expect(new Set(reference.samples.map((s) => s.planet))).toEqual(new Set(PLANET_KEYS));
      for (const s of reference.samples) {
        const facts = planetFacts(s.planet, new Date(fixtureTimeMs(s.time)));
        expect(Math.abs(facts.apparentDiameterArcsec - s.apparentDiameterArcsec)).toBeLessThanOrEqual(
          diameterToleranceArcsec(s.apparentDiameterArcsec),
        );
      }
    });
  }
});

describe("planetTracks", () => {
  const night = observingNight("2026-10-10", WARSAW.timeZone);
  const civil = darkWindow(WARSAW, night, PLANET_WINDOW_SUN_ALTITUDE_DEG);
  if (civil.kind !== "window") {
    throw new Error("expected a civil window on 2026-10-10 in Warsaw");
  }

  it("samples on the same grid as objectTracks, one track per key in the order given", () => {
    const [saturn, jupiter] = planetTracks(WARSAW, civil, ["saturn", "jupiter"]);
    const [fixed] = objectTracks(WARSAW, civil, [{ raHours: 0, decDeg: 0 }]);
    expect(saturn.map((p) => p.time)).toEqual(fixed.map((p) => p.time));
    expect(jupiter.map((p) => p.time)).toEqual(fixed.map((p) => p.time));
    // Different bodies, different tracks.
    expect(saturn[0].altitudeDeg).not.toBe(jupiter[0].altitudeDeg);
  });
});

describe("planetFacts", () => {
  const midnight = new Date("2026-10-11T00:00:00+02:00");

  it("gives a ring tilt for Saturn only", () => {
    for (const key of PLANET_KEYS) {
      const { ringTiltDeg } = planetFacts(key, midnight);
      if (key === "saturn") {
        expect(ringTiltDeg).not.toBeNull();
      } else {
        expect(ringTiltDeg).toBeNull();
      }
    }
  });

  it("shows Venus as a thin crescent near inferior conjunction and Jupiter nearly full", () => {
    // Inferior conjunction of Venus is 2026-10-24: a large, thin disc.
    const venus = planetFacts("venus", midnight);
    expect(venus.phaseFraction).toBeLessThan(0.1);
    expect(venus.apparentDiameterArcsec).toBeGreaterThan(50);
    expect(planetFacts("jupiter", midnight).phaseFraction).toBeGreaterThan(0.98);
  });
});
