import { describe, expect, it } from "vitest";

import { SCENARIOS, fixtureHours, type ScenarioName } from "../../tests/e2e/clock-scenarios.mjs";
import { moonState, observingNight, sunAltitudeDeg, tonightDateFor, darkWindow } from "./engine";
import { PLANET_KEYS, planetTracks } from "./engine/planets";
import { WARSAW } from "./engine/fixtures";
import type { Site } from "./engine/types";

/**
 * The e2e clock scenarios (test-suite-diet Phase 6): each named instant is inside the data the engine and the sky-event
 * catalogue cover, and the engine's own reading agrees with its label, so a retuned rule or a typo in an instant shows
 * up here instead of as a flaky spec. The e2e site is Madrid.
 */
const MADRID: Site = { latitudeDeg: 40.4168, longitudeDeg: -3.7038, elevationM: 0, timeZone: "Europe/Madrid" };
const CIVIL_DAWN_DEG = -6;
const BORTLE_6_DARK_DEG = -15;

const at = (name: ScenarioName): Date => new Date(SCENARIOS[name]);
const names = Object.keys(SCENARIOS) as ScenarioName[];

describe("the e2e clock scenarios", () => {
  it("are six named instants inside the range the engine's data covers (2026-2027)", () => {
    expect(names.sort()).toEqual(["civilDawn", "daytime", "deepNight", "evening", "fullMoonEvening", "noDarkness"]);
    for (const name of names) {
      const ms = at(name).getTime();
      expect(Number.isNaN(ms), name).toBe(false);
      expect(ms, name).toBeGreaterThanOrEqual(Date.UTC(2026, 0, 1));
      expect(ms, name).toBeLessThan(Date.UTC(2028, 0, 1));
    }
  });

  it("read as their labels at Madrid: the Sun, the night, the Moon and a planet", () => {
    const evening = at("evening");
    expect(sunAltitudeDeg(MADRID, evening), "evening: dark").toBeLessThan(BORTLE_6_DARK_DEG);
    expect(tonightDateFor(MADRID, evening, CIVIL_DAWN_DEG), "evening: tonight").toBe("2026-10-17");
    const moon = moonState(MADRID, evening);
    expect(moon.altitudeDeg, "evening: the Moon is up").toBeGreaterThan(10);
    expect(moon.illuminatedFraction, "evening: a waxing Moon, not full").toBeGreaterThan(0.1);
    expect(moon.illuminatedFraction, "evening: a waxing Moon, not full").toBeLessThan(0.8);
    const planets = planetTracks(MADRID, { start: evening, end: evening }, PLANET_KEYS);
    expect(
      planets.filter((track) => track.some((sample) => sample.altitudeDeg > 15)).length,
      "evening: a planet is up",
    ).toBeGreaterThan(0);

    const deep = at("deepNight");
    expect(sunAltitudeDeg(MADRID, deep), "deepNight: dark").toBeLessThan(-18);
    expect(tonightDateFor(MADRID, deep, CIVIL_DAWN_DEG), "deepNight: the night in progress").toBe("2026-10-17");

    const dawn = at("civilDawn");
    const sun = sunAltitudeDeg(MADRID, dawn);
    expect(sun, "civilDawn: after civil dawn").toBeGreaterThan(CIVIL_DAWN_DEG);
    expect(sun, "civilDawn: before sunrise").toBeLessThan(-0.833);
    expect(tonightDateFor(MADRID, dawn, CIVIL_DAWN_DEG), "civilDawn: tonight rolls to the evening ahead").toBe(
      "2026-10-18",
    );

    expect(sunAltitudeDeg(MADRID, at("daytime")), "daytime").toBeGreaterThan(20);

    const full = at("fullMoonEvening");
    expect(sunAltitudeDeg(MADRID, full), "fullMoonEvening: dark").toBeLessThan(BORTLE_6_DARK_DEG);
    expect(moonState(MADRID, full).illuminatedFraction, "fullMoonEvening: a full Moon").toBeGreaterThan(0.95);
  });

  it("noDarkness has no dark window at a 52 N site, and the fixture's hours surround every scenario", () => {
    const instant = at("noDarkness");
    const night = observingNight(tonightDateFor(WARSAW, instant, CIVIL_DAWN_DEG), WARSAW.timeZone);
    expect(darkWindow(WARSAW, night, BORTLE_6_DARK_DEG).kind).toBe("none");

    const hours = new Set(fixtureHours(Date.UTC(2026, 9, 17, 12)));
    for (const name of names) {
      const hour = Math.floor(at(name).getTime() / 3_600_000) * 3600;
      // -24 h .. +96 h is what the forecast service calls a complete series, and the verdict reads the night's hours.
      for (const offsetH of [-24, -1, 0, 1, 12, 36, 96]) {
        expect(hours.has(hour + offsetH * 3600), `${name} ${offsetH} h`).toBe(true);
      }
    }
  });
});
