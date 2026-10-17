import { Body, Ecliptic, Equator, GeoVector, Horizon, Illumination, Observer } from "astronomy-engine";
import { describe, expect, it } from "vitest";

import { METEOR_SHOWERS } from "@/lib/catalogue/meteor-showers";
import type { MeteorShower } from "@/lib/catalogue/meteor-showers";

import { skyEvents } from "./events";
import type { MeteorShowerEvent, SkyEvent } from "./events";
import { meteorEvents, sunLongitudeCrossings, sunLongitudeJ2000Deg } from "./meteors";
import { observingNight } from "./night";
import { darkWindow } from "./sun";
import { EVENT_MIN_ALTITUDE_DEG, METEOR_BRIGHT_MOON_FRACTION } from "./parameters";
import type { Interval, Site } from "./types";

/**
 * Meteor-shower peaks (M-3 S-07, Phase 3): the J2000 peak search, the peak night, the radiant's visibility by
 * latitude and the bright-Moon flag.
 *
 * Reference facts. NASA's shower pages (science.nasa.gov, a US government work) give the Geminids' peak night of
 * 2026 as Dec. 13-14 and the Perseids' as Aug. 12-13, which fixes the nights below. The Moon was full on 2025-08-09, so the Perseids' peak of 2025-08-12/13 had a bright waning Moon rising
 * in the evening, while the Moon was new at the peak of 2026-08-12/13 (the total solar eclipse of 2026-08-12).
 */

const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 110, timeZone: "Europe/Warsaw" };
const MADRID: Site = { latitudeDeg: 40.42, longitudeDeg: -3.7, elevationM: 650, timeZone: "Europe/Madrid" };
/** About 60° N: in August the Sun gets no lower than about -15°, so there is no astronomical darkness. */
const HELSINKI: Site = { latitudeDeg: 60.17, longitudeDeg: 24.94, timeZone: "Europe/Helsinki" };

function windowOf(site: Site, fromNight: string, nights: number): Interval {
  return {
    start: observingNight(fromNight, site.timeZone).start,
    end: observingNight(addNights(fromNight, nights - 1), site.timeZone).end,
  };
}

function addNights(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function shower(key: string): MeteorShower {
  const found = METEOR_SHOWERS.find((s) => s.key === key);
  if (found === undefined) {
    throw new Error(`no shower ${key}`);
  }
  return found;
}

function showerEvent(events: readonly SkyEvent[], key: string): MeteorShowerEvent {
  const found = events.filter((e): e is MeteorShowerEvent => e.kind === "meteor-shower" && e.shower === key);
  expect(found).toHaveLength(1);
  return found[0];
}

describe("the Sun's J2000 longitude search", () => {
  it("finds the moment the J2000 longitude equals the peak, to 0.001°, where the longitude of date is about 0.37° further on", () => {
    for (const s of METEOR_SHOWERS) {
      const year = s.nasaPeakNight.slice(0, 4);
      const [moment] = sunLongitudeCrossings(s.peakSolarLongitudeJ2000Deg, {
        start: new Date(`${year}-01-01T00:00:00Z`),
        end: new Date(`${Number(year) + 1}-01-01T00:00:00Z`),
      });
      expect(moment, s.key).toBeDefined();
      expect(Math.abs(sunLongitudeJ2000Deg(moment) - s.peakSolarLongitudeJ2000Deg), s.key).toBeLessThan(0.001);
    }
  });

  it("is of the J2000 ecliptic, not of date: the longitude of date is 0.37° further on in 2026 (about 9 hours of the Sun's motion)", () => {
    const perseids = shower("perseids");
    const [moment] = sunLongitudeCrossings(perseids.peakSolarLongitudeJ2000Deg, {
      start: new Date("2026-08-01T00:00:00Z"),
      end: new Date("2026-09-01T00:00:00Z"),
    });
    const ofDate = Ecliptic(GeoVector(Body.Sun, moment, true)).elon;
    expect(ofDate - perseids.peakSolarLongitudeJ2000Deg).toBeGreaterThan(0.35);
    expect(ofDate - perseids.peakSolarLongitudeJ2000Deg).toBeLessThan(0.4);
    // The longitude of date reaches the same number about 9 hours later (the Sun moves about 0.96° a day).
    const [later] = sunLongitudeCrossings(perseids.peakSolarLongitudeJ2000Deg + 0.374, {
      start: new Date("2026-08-01T00:00:00Z"),
      end: new Date("2026-09-01T00:00:00Z"),
    });
    const hours = (later.getTime() - moment.getTime()) / 3_600_000;
    expect(hours).toBeGreaterThan(8);
    expect(hours).toBeLessThan(10);
  });

  it("is wrap-safe across 0°/360° and finds one crossing a year over a long window", () => {
    const crossings = sunLongitudeCrossings(359.8, {
      start: new Date("2026-01-01T00:00:00Z"),
      end: new Date("2029-01-01T00:00:00Z"),
    });
    expect(crossings).toHaveLength(3);
    for (const moment of crossings) {
      expect(Math.abs(((sunLongitudeJ2000Deg(moment) - 359.8 + 540) % 360) - 180)).toBeLessThan(0.001);
    }
    const gapDays = (crossings[1].getTime() - crossings[0].getTime()) / 86_400_000;
    expect(gapDays).toBeGreaterThan(365);
    expect(gapDays).toBeLessThan(366);
  });
});

describe("peak nights", () => {
  it("puts the Geminids of 2026 on the night of 2026-12-13/14, as NASA does", () => {
    for (const site of [WARSAW, MADRID]) {
      const events = skyEvents(site, "2026-12-01");
      const geminids = showerEvent(events, "geminids");
      expect(geminids.night).toBe("2026-12-13");
      expect(geminids.visibility.visible).toBe(true);
      expect(geminids.bestNight).toBe("2026-12-13");
    }
  });

  it("lists the shower in the window only once its peak is in it", () => {
    const events = skyEvents(WARSAW, "2026-12-01", 5);
    expect(events.filter((e) => e.kind === "meteor-shower")).toHaveLength(0);
  });
});

describe("radiant visibility", () => {
  it("judges a night with no dark window on the twilight span and says so: the Perseids at 60° N are a short night, unless the caller's threshold gives Helsinki a dark window", () => {
    const perseids = showerEvent(skyEvents(HELSINKI, "2026-08-08", 8), "perseids");
    expect(perseids.visibility.visible).toBe(true);
    expect(perseids.visibility.shortNight).toBe(true);
    // The same shower from Madrid has real darkness, so it is no short night.
    expect(showerEvent(skyEvents(MADRID, "2026-08-08", 8), "perseids").visibility.shortNight).toBeUndefined();
    // A brighter-sky threshold (-12°) gives Helsinki a dark window in August, so no short night there.
    const events = meteorEvents(HELSINKI, windowOf(HELSINKI, "2026-08-08", 8), -12);
    expect(showerEvent(events, "perseids").visibility.shortNight).toBeUndefined();
  });
});

describe("bright Moon", () => {
  /** Illuminated fraction of the Moon, from astronomy-engine directly, at a UT instant. */
  const fraction = (iso: string): number => Illumination(Body.Moon, new Date(iso)).phase_fraction;

  it("flags the Perseids of 2025, a waning gibbous Moon three days after full that is up before dawn", () => {
    expect(fraction("2025-08-13T00:00:00Z")).toBeGreaterThan(0.7);
    const perseids = showerEvent(skyEvents(WARSAW, "2025-08-05"), "perseids");
    expect(perseids.night).toBe("2025-08-12");
    expect(perseids.brightMoon).toBe(true);
  });

  it("does not flag the Perseids of 2026, at new Moon", () => {
    expect(fraction("2026-08-13T00:00:00Z")).toBeLessThan(0.1);
    expect(showerEvent(skyEvents(WARSAW, "2026-08-05"), "perseids").brightMoon).toBe(false);
  });
});

/**
 * A made-up shower at the Geminids' longitude and a chosen radiant (J2000), to put the radiant exactly where a rule is
 * decided. It borrows the Geminids' key, since the keys are typed.
 */
function invented(radiantRaDeg: number, radiantDecDeg: number): MeteorShower {
  return {
    key: "geminids",
    peakSolarLongitudeJ2000Deg: shower("geminids").peakSolarLongitudeJ2000Deg,
    nasaPeakNight: "2026-12-13",
    radiantRaDeg,
    radiantDecDeg,
    speedKmS: 30,
    rate: 1,
  };
}

describe("the night before or after a peak", () => {
  // At Warsaw a radiant at RA 245°, Dec 0° is a low morning object: the highest it gets in the dark window is
  // about 9.1° on the night of 12/12, 9.7° on 12/13 (the peak night) and 10.3° on 12/14, which clears the 10°
  // minimum (measured with astronomy-engine's own horizontal coordinates when this test was written).
  const window = windowOf(WARSAW, "2026-12-08", 12);

  it("names the night after when the peak night's radiant is too low and the next night's clears the minimum", () => {
    const [event] = meteorEvents(WARSAW, window, undefined, [invented(245, 0)]);
    expect(event.night).toBe("2026-12-13");
    expect(event.bestNight).toBe("2026-12-14");
    expect(event.visibility.visible).toBe(true);
    if (event.visibility.visible) {
      expect(event.visibility.altitudeDeg).toBeGreaterThanOrEqual(EVENT_MIN_ALTITUDE_DEG);
      expect(event.visibility.altitudeDeg).toBeLessThan(EVENT_MIN_ALTITUDE_DEG + 1);
      // The best moment is on the night named, not on the peak night.
      const night = observingNight("2026-12-14", WARSAW.timeZone);
      expect(event.visibility.best.getTime()).toBeGreaterThanOrEqual(night.start.getTime());
      expect(event.visibility.best.getTime()).toBeLessThanOrEqual(night.end.getTime());
    }
  });

  it("still lists a peak that fell the night before the window when its best night is the window's first (sky-events Phase 5)", () => {
    // The peak night is 12/13 and the best night 12/14: a window that starts on 12/14 holds it, one that starts on 12/15 does not.
    const [event, ...rest] = meteorEvents(WARSAW, windowOf(WARSAW, "2026-12-14", 5), undefined, [invented(245, 0)]);
    expect(rest).toEqual([]);
    expect(event.night).toBe("2026-12-13");
    expect(event.bestNight).toBe("2026-12-14");
    expect(meteorEvents(WARSAW, windowOf(WARSAW, "2026-12-15", 5), undefined, [invented(245, 0)])).toEqual([]);
  });

  it("drops a peak from before the window when the peak night itself was the best (it is already past)", () => {
    expect(meteorEvents(WARSAW, windowOf(WARSAW, "2026-12-14", 5), undefined, [invented(242, 0)])).toEqual([]);
  });

  it("keeps the peak night when it passes, even if a neighbouring night is a little higher", () => {
    const [event] = meteorEvents(WARSAW, window, undefined, [invented(242, 0)]);
    expect(event.visibility.visible).toBe(true);
    expect(event.bestNight).toBe(event.night);
  });

  it("lists the shower as not visible when no night clears the minimum: too-low with the peak night's reason, below-horizon when the radiant never rises", () => {
    const [low] = meteorEvents(WARSAW, window, undefined, [invented(255, 0)]);
    expect(low.visibility).toEqual({ visible: false, reason: "too-low" });
    expect(low.bestNight).toBe(low.night);
    const [never] = meteorEvents(WARSAW, window, undefined, [invented(113, -80)]);
    expect(never.visibility).toEqual({ visible: false, reason: "below-horizon" });
  });
});

describe("the bright-Moon flag needs the Moon up in the span, not only a bright phase", () => {
  it("is false on 2026-07-24 at Warsaw, when the Moon is 81% lit but has set before the dark window", () => {
    // A made-up peak in the middle of that night, so the window is the one night.
    const night = observingNight("2026-07-24", WARSAW.timeZone);
    const middle = new Date(night.start.getTime() + 8 * 3_600_000);
    const lambda = sunLongitudeJ2000Deg(middle);
    const event = meteorEvents(WARSAW, night, undefined, [
      { ...invented(0, 60), peakSolarLongitudeJ2000Deg: lambda },
    ])[0];
    expect(event).toBeDefined();
    expect(event.visibility.visible).toBe(true);
    // Independent premise, from astronomy-engine directly: bright phase, Moon under the horizon throughout the dark window.
    const window = darkWindow(WARSAW, night, -18);
    expect(window.kind).toBe("window");
    if (window.kind === "window") {
      const observer = new Observer(WARSAW.latitudeDeg, WARSAW.longitudeDeg, WARSAW.elevationM ?? 0);
      for (let t = window.start.getTime(); t <= window.end.getTime(); t += 300_000) {
        const when = new Date(t);
        const eq = Equator(Body.Moon, when, observer, true, true);
        expect(Horizon(when, observer, eq.ra, eq.dec, "normal").altitude).toBeLessThan(0);
      }
      expect(Illumination(Body.Moon, window.start).phase_fraction).toBeGreaterThanOrEqual(METEOR_BRIGHT_MOON_FRACTION);
    }
    expect(event.brightMoon).toBe(false);
  });
});
