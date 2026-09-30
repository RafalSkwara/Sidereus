import { afterEach, describe, expect, it, vi } from "vitest";

import { planetEyepiece } from "./eyepieces";
import { WARSAW } from "./fixtures";
import { seenSummaries } from "./log";
import { observingNight } from "./night";
import {
  ICE_GIANT_MIN_APERTURE_MM,
  PLANET_LOW_ALTITUDE_DEG,
  PLANET_WINDOW_SUN_ALTITUDE_DEG,
  WELL_PLACED_ALTITUDE_DEG,
} from "./parameters";
import { rankPlanets } from "./planet-ranking";
import type { PlanetEntry, PlanetRankInput } from "./planet-ranking";
import { PLANET_KEYS } from "./planets";
import type { PlanetKey } from "./planets";
import { darkWindow } from "./sun";
import type { DarkWindow } from "./types";

/**
 * Lets a test give every planet the same apparent size, so their totals can tie. `null` (the default)
 * leaves `planetFacts` untouched.
 */
const facts = vi.hoisted(() => ({ diameterArcsec: null as number | null }));

vi.mock("./planets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./planets")>();
  return {
    ...actual,
    planetFacts: (key: PlanetKey, time: Date) => {
      const real = actual.planetFacts(key, time);
      return facts.diameterArcsec === null ? real : { ...real, apparentDiameterArcsec: facts.diameterArcsec };
    },
  };
});

afterEach(() => {
  facts.diameterArcsec = null;
});

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

function windowOf(start: Date, end: Date): PlanetWindow {
  return {
    kind: "window",
    thresholdDeg: PLANET_WINDOW_SUN_ALTITUDE_DEG,
    start,
    end,
    clampedToNightStart: false,
    clampedToNightEnd: false,
  };
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

const MINUTE_MS = 60_000;

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

  it("orders by score, best first", () => {
    const entries = rank();
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1].score.total).toBeGreaterThanOrEqual(entries[i].score.total);
    }
    // A big, high planet beats a tiny one at a similar height.
    expect(keysOf(entries).indexOf("saturn")).toBeLessThan(keysOf(entries).indexOf("neptune"));
  });

  it("breaks a tie on total in solar order", () => {
    // Same size for all, and a site minimum at the well-placed altitude, so every listed planet scores 1.
    facts.diameterArcsec = 40;
    const entries = rank({ minAltitudeDeg: WELL_PLACED_ALTITUDE_DEG });
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.score.total).toBe(1);
    }
    const listed = keysOf(entries);
    expect(listed).toEqual(PLANET_KEYS.filter((key) => listed.includes(key)));
  });

  it(`flags a peak below ${PLANET_LOW_ALTITUDE_DEG}° low, and a peak at ${WELL_PLACED_ALTITUDE_DEG}° or above high`, () => {
    const entries = rank();
    // Saturn culminates just short of the well-placed altitude, Uranus well above it.
    const saturn = entryFor(entries, "saturn");
    expect(saturn.peak.altitudeDeg).toBeLessThan(WELL_PLACED_ALTITUDE_DEG);
    expect(saturn.peak.altitudeDeg).toBeGreaterThanOrEqual(PLANET_LOW_ALTITUDE_DEG);
    expect(saturn.placement).toBe("well");
    const uranus = entryFor(entries, "uranus");
    expect(uranus.peak.altitudeDeg).toBeGreaterThanOrEqual(WELL_PLACED_ALTITUDE_DEG);
    expect(uranus.placement).toBe("high");

    // Cut the window at 19:30 local: Saturn is still rising and peaks low.
    const early = windowOf(civilWindow().start, new Date("2026-10-10T19:30:00+02:00"));
    const lowSaturn = entryFor(rank({ planetWindow: early, minAltitudeDeg: 5 }), "saturn");
    expect(lowSaturn.peak.altitudeDeg).toBeLessThan(PLANET_LOW_ALTITUDE_DEG);
    expect(lowSaturn.placement).toBe("low");
  });

  it("times the peak by the third of the planet window it falls in, a boundary going to the later third", () => {
    // Saturn's peak sample on the full window; windows that keep the same sample grid move it between thirds.
    const peak = entryFor(rank(), "saturn").peak.time.getTime();
    const timingIn = (beforeMin: number, afterMs: number) => {
      const saturn = entryFor(
        rank({ planetWindow: windowOf(new Date(peak - beforeMin * MINUTE_MS), new Date(peak + afterMs)) }),
        "saturn",
      );
      expect(saturn.peak.time.getTime()).toBe(peak);
      return saturn.timing;
    };
    // 20 of 60 minutes in: exactly one third.
    expect(timingIn(20, 40 * MINUTE_MS)).toBe("night");
    expect(timingIn(20, 40 * MINUTE_MS + 1)).toBe("evening");
    // 40 of 60 minutes in: exactly two thirds.
    expect(timingIn(40, 20 * MINUTE_MS)).toBe("morning");
    expect(timingIn(40, 20 * MINUTE_MS + 1)).toBe("night");

    // On the full window, the planets still climbing at dawn are morning planets.
    expect(entryFor(rank(), "jupiter").timing).toBe("morning");
    expect(entryFor(rank(), "saturn").timing).toBe("night");
  });

  it("gives every entry the kit's planet eyepiece, or none for an empty kit", () => {
    const expected = planetEyepiece(TELESCOPE, EYEPIECES);
    expect(expected).not.toBeNull();
    for (const entry of rank()) {
      expect(entry.eyepiece).toBe(expected);
    }
    for (const entry of rank({ eyepieces: [] })) {
      expect(entry.eyepiece).toBeNull();
    }
  });

  it("carries the seen summary by planet key without changing the order", () => {
    const seen = seenSummaries(
      [
        { target: "jupiter", night: "2026-09-12", rating: 4 },
        { target: "jupiter", night: "2026-10-01", rating: 5 },
        // A Messier entry never tags a planet.
        { target: "M31", night: "2026-10-01", rating: 5 },
      ],
      "2026-10-10",
    );
    const unlogged = rank();
    const logged = rank({ seen });
    expect(keysOf(logged)).toEqual(keysOf(unlogged));
    for (const entry of logged) {
      expect(entry.seen).toEqual(entry.key === "jupiter" ? { count: 2, lastNight: "2026-10-01" } : null);
    }
  });
});
