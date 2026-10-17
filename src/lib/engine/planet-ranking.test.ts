import { Body, Equator, Horizon, Rotation_EQJ_HOR } from "astronomy-engine";
import { describe, expect, it } from "vitest";

import { PLANET_REFERENCES, WARSAW, circularDeltaDeg, fixtureTimeMs, siteOf } from "./fixtures";
import { observingNight } from "./night";
import { ICE_GIANT_MIN_APERTURE_MM, PLANET_WINDOW_SUN_ALTITUDE_DEG } from "./parameters";
import { rankPlanets } from "./planet-ranking";
import type { PlanetEntry, PlanetRankInput } from "./planet-ranking";
import { PLANET_KEYS, planetFacts, planetJ2000Vector, planetTracks } from "./planets";
import type { PlanetKey } from "./planets";
import { darkWindow, observerFor } from "./sun";
import type { DarkWindow } from "./types";

type PlanetWindow = Extract<DarkWindow, { kind: "window" }>;

const TELESCOPE = { apertureMm: 150, focalLengthMm: 750 };
const EYEPIECES = [
  { id: "e25", focalLengthMm: 25, afovDeg: 50 },
  { id: "e10", focalLengthMm: 10, afovDeg: 50 },
];
type Eyepiece = (typeof EYEPIECES)[number];

/** Warsaw's civil window (sun below −6°) on 2026-10-10: Saturn, Neptune, Uranus, Mars and Jupiter are up. */
function civilWindow(): PlanetWindow {
  const civil = darkWindow(WARSAW, observingNight("2026-10-10", WARSAW.timeZone), PLANET_WINDOW_SUN_ALTITUDE_DEG);
  if (civil.kind !== "window") {
    throw new Error("expected a civil window on 2026-10-10 in Warsaw");
  }
  return civil;
}

function rank(overrides: Partial<PlanetRankInput<Eyepiece>> = {}): PlanetEntry<Eyepiece>[] {
  return rankPlanets<Eyepiece>({
    site: WARSAW,
    minAltitudeDeg: 15,
    planetWindow: civilWindow(),
    telescope: TELESCOPE,
    eyepieces: EYEPIECES,
    ...overrides,
  });
}

const keysOf = (entries: readonly PlanetEntry[]): PlanetKey[] => entries.map((e) => e.key);

function entryFor(entries: readonly PlanetEntry<Eyepiece>[], key: PlanetKey): PlanetEntry<Eyepiece> {
  const entry = entries.find((e) => e.key === key);
  if (entry === undefined) {
    throw new Error(`${key} is not listed`);
  }
  return entry;
}

describe("rankPlanets (Warsaw 2026-10-10)", () => {
  it("lists only planets that clear the minimum altitude, each with its best window inside the planet window", () => {
    const window = civilWindow();
    const entries = rank();
    // Venus (near inferior conjunction) and Mercury stay below the horizon all through the window.
    expect(keysOf(entries)).not.toContain("venus");
    expect(keysOf(entries)).not.toContain("mercury");
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.peak.altitudeDeg).toBeGreaterThanOrEqual(15);
      expect(entry.window.start.getTime()).toBeGreaterThanOrEqual(window.start.getTime());
      expect(entry.window.end.getTime()).toBeLessThanOrEqual(window.end.getTime());
    }
    // Nothing reaches 70°, so a site minimum there lists nothing at all.
    expect(rank({ minAltitudeDeg: 70 })).toEqual([]);
  });

  it(`lists Uranus and Neptune from ${ICE_GIANT_MIN_APERTURE_MM} mm of aperture, never below`, () => {
    const small = rank({ telescope: { apertureMm: ICE_GIANT_MIN_APERTURE_MM - 1, focalLengthMm: 650 } });
    expect(keysOf(small)).not.toContain("uranus");
    expect(keysOf(small)).not.toContain("neptune");
    expect(keysOf(small)).toContain("saturn");

    const gate = rank({ telescope: { apertureMm: ICE_GIANT_MIN_APERTURE_MM, focalLengthMm: 650 } });
    expect(keysOf(gate)).toContain("uranus");
    expect(keysOf(gate)).toContain("neptune");
  });

  it("times the peak by the third of the planet window it falls in, a boundary going to the later third", () => {
    // Saturn's peak sample on the full window; windows that keep the same sample grid move it between thirds.
    const peak = entryFor(rank(), "saturn").peak.time.getTime();
    const minuteMs = 60_000;
    const timingIn = (beforeMin: number, afterMs: number) => {
      const window: PlanetWindow = {
        ...civilWindow(),
        start: new Date(peak - beforeMin * minuteMs),
        end: new Date(peak + afterMs),
      };
      const saturn = entryFor(rank({ planetWindow: window }), "saturn");
      expect(saturn.peak.time.getTime()).toBe(peak);
      return saturn.timing;
    };
    // 20 of 60 minutes in: exactly one third.
    expect(timingIn(20, 40 * minuteMs)).toBe("night");
    expect(timingIn(20, 40 * minuteMs + 1)).toBe("evening");
    // 40 of 60 minutes in: exactly two thirds.
    expect(timingIn(40, 20 * minuteMs)).toBe("morning");
    expect(timingIn(40, 20 * minuteMs + 1)).toBe("night");
    // On the full window, the planets still climbing at dawn are morning planets.
    expect(entryFor(rank(), "jupiter").timing).toBe("morning");
    expect(entryFor(rank(), "saturn").timing).toBe("night");
  });

  describe("with visible intervals", () => {
    // 18:00-19:00 and 04:30-06:30 local: the evening and morning twilight, but not the middle of the night.
    const evening = { start: new Date("2026-10-10T18:00:00+02:00"), end: new Date("2026-10-10T19:00:00+02:00") };
    const morning = { start: new Date("2026-10-11T04:30:00+02:00"), end: new Date("2026-10-11T06:30:00+02:00") };
    const inside = (time: Date, intervals: readonly { start: Date; end: Date }[]) =>
      intervals.some((i) => i.start.getTime() <= time.getTime() && time.getTime() <= i.end.getTime());

    it("takes each planet's best window, peak and facts from the visible samples only", () => {
      const intervals = [evening, morning];
      const masked = rank({ visibleIntervals: intervals });
      expect(masked.length).toBeGreaterThan(0);
      for (const entry of masked) {
        expect(inside(entry.window.start, intervals)).toBe(true);
        expect(inside(entry.window.end, intervals)).toBe(true);
        expect(inside(entry.peak.time, intervals)).toBe(true);
        expect(entry.peak.altitudeDeg).toBeGreaterThanOrEqual(15);
      }
      // Jupiter climbs until dawn, so its morning peak is the same; Uranus's midnight peak is not visible.
      const jupiter = entryFor(masked, "jupiter");
      expect(jupiter.peak.time).toEqual(entryFor(rank(), "jupiter").peak.time);
      const uranus = entryFor(masked, "uranus");
      expect(uranus.peak.altitudeDeg).toBeLessThan(entryFor(rank(), "uranus").peak.altitudeDeg);
      expect(uranus.facts).not.toEqual(entryFor(rank(), "uranus").facts);
    });

    it("leaves out a planet never above the minimum altitude inside them", () => {
      // Saturn and Neptune are still low in the evening twilight and set before the morning one.
      const keys = keysOf(rank({ visibleIntervals: [evening, morning] }));
      expect(keysOf(rank())).toEqual(expect.arrayContaining(["saturn", "neptune"]));
      expect(keys).not.toContain("saturn");
      expect(keys).not.toContain("neptune");
      expect(rank({ visibleIntervals: [] })).toEqual([]);
    });

    it("keeps the timing thirds relative to the whole planet window", () => {
      // Saturn peaks in the middle of the night; visible only in the evening twilight, its (low) peak falls in the
      // first third of the whole window, not in the middle of the one-hour interval.
      expect(entryFor(rank(), "saturn").timing).toBe("night");
      const eveningOnly = rank({ visibleIntervals: [evening], minAltitudeDeg: 0 });
      expect(entryFor(eveningOnly, "saturn").timing).toBe("evening");
      for (const entry of eveningOnly) {
        expect(entry.timing).toBe("evening");
      }
      // The same interval as a whole planet window would put every peak in its own thirds.
      expect(rank({ visibleIntervals: [civilWindow()] })).toEqual(rank());
    });
  });
});

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

describe("planetFacts", () => {
  const midnight = new Date("2026-10-11T00:00:00+02:00");

  it("shows Venus as a thin crescent near inferior conjunction and Jupiter nearly full", () => {
    // Inferior conjunction of Venus is 2026-10-24: a large, thin disc.
    const venus = planetFacts("venus", midnight);
    expect(venus.phaseFraction).toBeLessThan(0.1);
    expect(venus.apparentDiameterArcsec).toBeGreaterThan(50);
    expect(planetFacts("jupiter", midnight).phaseFraction).toBeGreaterThan(0.98);
  });
});

describe("planetJ2000Vector (finder chart)", () => {
  const time = new Date("2026-10-15T20:00:00Z");

  it("lands where the of-date apparent position puts the planet, once rotated to the horizon (unrefracted)", () => {
    const observer = observerFor(WARSAW);
    const { rot } = Rotation_EQJ_HOR(time, observer);
    const bodies = { jupiter: Body.Jupiter, saturn: Body.Saturn, mars: Body.Mars, venus: Body.Venus } as const;
    for (const [key, body] of Object.entries(bodies) as [keyof typeof bodies, Body][]) {
      const v = planetJ2000Vector(key, WARSAW, time);
      const h = [0, 1, 2].map((j) => rot[0][j] * v[0] + rot[1][j] * v[1] + rot[2][j] * v[2]);
      const altitude = (Math.asin(h[2]) * 180) / Math.PI;
      const eq = Equator(body, time, observer, true, true);
      const reference = Horizon(time, observer, eq.ra, eq.dec);
      expect(altitude).toBeCloseTo(reference.altitude, 2);
      const azimuth = ((Math.atan2(-h[1], h[0]) * 180) / Math.PI + 360) % 360;
      expect(circularDeltaDeg(azimuth, reference.azimuth)).toBeLessThan(0.02);
    }
  });
});
