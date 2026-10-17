import { describe, expect, it } from "vitest";

import { DEEP_SKY, findDeepSky } from "@/lib/catalogue";
import {
  addDays,
  bestWindow,
  darknessThresholdDegForBortle,
  darkWindow,
  ICE_GIANT_MIN_APERTURE_MM,
  MOON_MIN_ILLUMINATION,
  moonState,
  moonTarget,
  moonTrack,
  observingNight,
  PLANET_KEYS,
  rankObjects,
  rankPlanets,
  type DarkWindow,
} from "@/lib/engine";
import { toEngineSite } from "@/lib/gear/store";
import type { SiteRecord } from "@/lib/gear/store";

import { deepSkyWindow, planetWindowFor, solarSystemWindow } from "./plan-window";
import { EYEPIECES, TELESCOPE, WARSAW } from "./test-fixtures";

const NIGHT = "2026-10-10";
const engineSite = toEngineSite(WARSAW);
const darkOn = (night: string, site: SiteRecord = WARSAW): Extract<DarkWindow, { kind: "window" }> => {
  const window = darkWindow(
    toEngineSite(site),
    observingNight(night, site.timeZone),
    darknessThresholdDegForBortle(site.bortle),
  );
  if (window.kind !== "window") {
    throw new Error("expected a dark window");
  }
  return window;
};

describe("deepSkyWindow", () => {
  it("is the window the ranking scores each reachable object over, for the whole catalogue", () => {
    const ranking = rankObjects({
      site: engineSite,
      bortle: WARSAW.bortle,
      minAltitudeDeg: WARSAW.minAltitudeDeg,
      darkWindow: darkOn(NIGHT),
      telescope: TELESCOPE,
      eyepieces: EYEPIECES,
      catalogue: DEEP_SKY,
    });
    expect(ranking.reachable.length).toBeGreaterThan(50);
    for (const { object, window } of ranking.reachable) {
      expect(deepSkyWindow(WARSAW, NIGHT, object), object.id).toEqual(window);
    }
    // An object the ranking did not score has a window only when the telescope was the limit (a faint one).
    const reachable = new Set(ranking.reachable.map((r) => r.object.id));
    for (const object of DEEP_SKY.filter((o) => !reachable.has(o.id))) {
      const window = deepSkyWindow(WARSAW, NIGHT, object);
      if (window !== null) {
        expect(object.vMag, `${object.id} has a window but is not scored`).toBeGreaterThan(9);
      }
    }
  });

  it("is null for an object that never reaches the site's minimum altitude in the dark window", () => {
    // δ = −60° never rises at 52° N.
    expect(deepSkyWindow(WARSAW, NIGHT, { raHours: 0, decDeg: -60 })).toBeNull();
    // M31 is up in the dark, but not 80° above the horizon from Warsaw (the pole is at 52°).
    const m31 = findDeepSky("M31");
    expect(m31).toBeDefined();
    expect(deepSkyWindow(WARSAW, NIGHT, m31 ?? { raHours: 0, decDeg: 0 })).not.toBeNull();
    expect(deepSkyWindow({ ...WARSAW, minAltitudeDeg: 80 }, NIGHT, m31 ?? { raHours: 0, decDeg: 0 })).toBeNull();
  });

  it("stays at or above the minimum altitude and inside the dark window, whatever the site's minimum", () => {
    const dark = darkOn(NIGHT);
    for (const minAltitudeDeg of [0, 15, 40]) {
      const site = { ...WARSAW, minAltitudeDeg };
      for (const id of ["M31", "M45", "NGC7000"]) {
        const object = findDeepSky(id);
        const window = object === undefined ? null : deepSkyWindow(site, NIGHT, object);
        expect(window, `${id} at ${minAltitudeDeg}`).not.toBeNull();
        expect(window?.start.getTime()).toBeGreaterThanOrEqual(dark.start.getTime());
        expect(window?.end.getTime()).toBeLessThanOrEqual(dark.end.getTime());
        expect(window?.peak.altitudeDeg).toBeGreaterThanOrEqual(minAltitudeDeg);
      }
    }
    // A higher minimum can only narrow the window.
    const m31 = findDeepSky("M31") ?? { raHours: 0, decDeg: 0 };
    const low = deepSkyWindow({ ...WARSAW, minAltitudeDeg: 0 }, NIGHT, m31);
    const high = deepSkyWindow({ ...WARSAW, minAltitudeDeg: 40 }, NIGHT, m31);
    expect((high?.end.getTime() ?? 0) - (high?.start.getTime() ?? 0)).toBeLessThan(
      (low?.end.getTime() ?? 0) - (low?.start.getTime() ?? 0),
    );
  });

  it("is null without a dark window (Tromsø at the June solstice, any Bortle class)", () => {
    const tromso: SiteRecord = {
      ...WARSAW,
      latitudeDeg: 69.65,
      longitudeDeg: 18.96,
      timeZone: "Europe/Oslo",
      bortle: 3,
    };
    expect(darkWindow(toEngineSite(tromso), observingNight("2026-06-21", tromso.timeZone), -18).kind).toBe("none");
    expect(deepSkyWindow(tromso, "2026-06-21", findDeepSky("M31") ?? { raHours: 0, decDeg: 0 })).toBeNull();
  });
});

describe("solarSystemWindow", () => {
  const planetsOn = (night: string, apertureMm = TELESCOPE.apertureMm) => {
    const planetWindow = planetWindowFor(engineSite, night);
    if (planetWindow.kind !== "window") {
      throw new Error("expected a planet window");
    }
    return rankPlanets({
      site: engineSite,
      minAltitudeDeg: WARSAW.minAltitudeDeg,
      planetWindow,
      telescope: { ...TELESCOPE, apertureMm },
      eyepieces: EYEPIECES,
    });
  };

  it("is the window rankPlanets lists for each planet, and null for one it leaves out", () => {
    const listed = planetsOn(NIGHT);
    expect(listed.length).toBeGreaterThan(3);
    for (const key of PLANET_KEYS) {
      const entry = listed.find((e) => e.key === key);
      expect(solarSystemWindow(WARSAW, NIGHT, key), key).toEqual(entry?.window ?? null);
    }
  });

  it("leaves out Uranus and Neptune under the ice giants' minimum aperture, only when the aperture is given", () => {
    expect(solarSystemWindow(WARSAW, NIGHT, "uranus")).not.toBeNull();
    expect(solarSystemWindow(WARSAW, NIGHT, "uranus", { apertureMm: ICE_GIANT_MIN_APERTURE_MM })).not.toBeNull();
    expect(solarSystemWindow(WARSAW, NIGHT, "uranus", { apertureMm: ICE_GIANT_MIN_APERTURE_MM - 1 })).toBeNull();
    expect(solarSystemWindow(WARSAW, NIGHT, "neptune", { apertureMm: 100 })).toBeNull();
    expect(solarSystemWindow(WARSAW, NIGHT, "jupiter", { apertureMm: 50 })).not.toBeNull();
    // The same answer as the ranking for a small telescope.
    expect(planetsOn(NIGHT, 100).map((e) => e.key)).not.toContain("uranus");
  });

  it("is the Moon target's window, and null where the Moon is no target, over three weeks of Warsaw nights", () => {
    let withWindow = 0;
    let without = 0;
    for (const minAltitudeDeg of [15, 0]) {
      const site = { ...WARSAW, minAltitudeDeg };
      for (let day = 0; day < 22; day++) {
        const night = addDays(NIGHT, day);
        const planetWindow = planetWindowFor(engineSite, night);
        if (planetWindow.kind !== "window") {
          throw new Error("expected a planet window");
        }
        const target = moonTarget({
          site: engineSite,
          minAltitudeDeg,
          window: planetWindow,
          telescope: TELESCOPE,
          eyepieces: EYEPIECES,
        });
        const window = solarSystemWindow(site, night, "moon");
        expect(window, `${night} at ${minAltitudeDeg}`).toEqual(target?.window ?? null);
        if (window === null) {
          without += 1;
        } else {
          withWindow += 1;
        }
      }
    }
    expect(withWindow).toBeGreaterThan(10);
    expect(without).toBeGreaterThan(10);
  });

  it("returns null for a thin crescent above the horizon: the illumination rule alone (minimum altitude 0)", () => {
    const site = { ...WARSAW, minAltitudeDeg: 0 };
    // Two nights found by search: a waning crescent at 2.5% and a waxing one at 1.3%, both up during civil night.
    for (const night of ["2026-10-08", "2026-11-07"]) {
      const planetWindow = planetWindowFor(engineSite, night);
      if (planetWindow.kind !== "window") {
        throw new Error("expected a planet window");
      }
      const geometric = bestWindow(moonTrack(engineSite, planetWindow), 0);
      expect(geometric, night).not.toBeNull();
      expect(moonState(engineSite, geometric?.peak.time ?? new Date(0)).illuminatedFraction).toBeLessThan(
        MOON_MIN_ILLUMINATION,
      );
      expect(solarSystemWindow(site, night, "moon"), night).toBeNull();
    }
  });

  it("is null without a planet window (Tromsø at the June solstice)", () => {
    const tromso: SiteRecord = { ...WARSAW, latitudeDeg: 69.65, longitudeDeg: 18.96, timeZone: "Europe/Oslo" };
    expect(planetWindowFor(toEngineSite(tromso), "2026-06-21").kind).not.toBe("window");
    expect(solarSystemWindow(tromso, "2026-06-21", "jupiter")).toBeNull();
    expect(solarSystemWindow(tromso, "2026-06-21", "moon")).toBeNull();
  });
});
