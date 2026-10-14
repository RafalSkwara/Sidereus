import {
  Body,
  Equator,
  Horizon,
  HorizonFromVector,
  Observer,
  RotateVector,
  Rotation_EQJ_HOR,
  Spherical,
  VectorFromSphere,
} from "astronomy-engine";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ECLIPSE_MIN_ALTITUDE_DEG,
  EVENT_MIN_ALTITUDE_DEG,
  EVENT_SUN_MAX_ALTITUDE_DEG,
  EVENT_WINDOW_NIGHTS,
  PLANET_WINDOW_SUN_ALTITUDE_DEG,
} from "./parameters";
import { METEOR_SHOWERS } from "@/lib/catalogue/meteor-showers";

import { isNotableEvent, skyEvents, visibleAt } from "./events";
import type { LunarEclipseEvent, SkyEvent } from "./events";
import { darkWindow, sunAltitudeDeg } from "./sun";
import { addDays, observingNight, observingNightDateFor } from "./night";
import type { HorizontalPosition, Site } from "./types";

/**
 * Sky events, Phase 1 (M-3 S-07): the lunar and local solar eclipses, greatest elongations and oppositions
 * astronomy-engine searches directly, and the one rule that decides whether each can be seen from a site.
 *
 * Reference facts. The eclipses below are future ones, computed with astronomy-engine at planning time
 * (2026-10-13), and their dates and kinds match Fred Espenak's eclipse catalogue (NASA GSFC, public-domain
 * facts: "Total Solar Eclipse of 2027 Aug 02", "Penumbral Lunar Eclipse of 2027 Feb 20", "Total Lunar
 * Eclipse of 2028 Dec 31"). The rule is framed for future eclipses; no test relies on a past one. Mercury's
 * greatest elongation of 2026-11-20 (19.6°, morning) and the 2027 oppositions of Jupiter (about
 * 2027-02-11), Mars (2027-02-19) and Saturn (2027-10-18) are the almanac values the engine reproduces.
 * Eclipse obscurations and the Sun's altitude are the engine's own numbers, pinned as regression values.
 *
 * The timing budget is asserted locally only; on CI the measured time is logged but not asserted, because
 * shared runners are too noisy for a wall-clock bound (the `determinism.test.ts` pattern).
 */

const CADIZ: Site = { latitudeDeg: 36.5, longitudeDeg: -6.3, timeZone: "Europe/Madrid" };
const MADRID: Site = { latitudeDeg: 40.42, longitudeDeg: -3.7, elevationM: 650, timeZone: "Europe/Madrid" };
const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 110, timeZone: "Europe/Warsaw" };
const LONDON: Site = { latitudeDeg: 51.51, longitudeDeg: -0.13, timeZone: "Europe/London" };
const BEIJING: Site = { latitudeDeg: 39.9, longitudeDeg: 116.4, timeZone: "Asia/Shanghai" };
const LOS_ANGELES: Site = { latitudeDeg: 34.05, longitudeDeg: -118.24, timeZone: "America/Los_Angeles" };
const SYDNEY: Site = { latitudeDeg: -33.87, longitudeDeg: 151.21, timeZone: "Australia/Sydney" };
const TROMSO: Site = { latitudeDeg: 69.65, longitudeDeg: 18.96, timeZone: "Europe/Oslo" };
/** On the Atlantic, where the 2027-08-02 eclipse is over before the Sun is up: only its last contact is above the horizon. */
const ATLANTIC_AT_DAWN: Site = { latitudeDeg: 10, longitudeDeg: -47, timeZone: "America/Fortaleza" };

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function ofKind<K extends SkyEvent["kind"]>(events: readonly SkyEvent[], kind: K): Extract<SkyEvent, { kind: K }>[] {
  return events.filter((e): e is Extract<SkyEvent, { kind: K }> => e.kind === kind);
}

function only<T>(items: readonly T[]): T {
  expect(items).toHaveLength(1);
  return items[0];
}

/** Independent altitude of a body, from astronomy-engine directly (not through the module under test). */
function altitudeOf(body: Body, site: Site, time: Date): number {
  const observer = new Observer(site.latitudeDeg, site.longitudeDeg, site.elevationM ?? 0);
  const eq = Equator(body, time, observer, true, true);
  return Horizon(time, observer, eq.ra, eq.dec, "normal").altitude;
}

/** Independent altitude of a J2000 radiant, from astronomy-engine's rotation directly (not through the module under test). */
function radiantAltitude(shower: { radiantRaDeg: number; radiantDecDeg: number }, site: Site, time: Date): number {
  const observer = new Observer(site.latitudeDeg, site.longitudeDeg, site.elevationM ?? 0);
  const j2000 = VectorFromSphere(new Spherical(shower.radiantDecDeg, shower.radiantRaDeg, 1), time);
  return HorizonFromVector(RotateVector(Rotation_EQJ_HOR(time, observer), j2000), "normal").lat;
}

/** A lunar eclipse's contacts: the umbral phases' ends, or the penumbral ends of an eclipse with none. */
function lunarContacts(event: LunarEclipseEvent): Date[] {
  const umbral = [event.partial, event.total].flatMap((phase) => (phase === null ? [] : [phase.start, phase.end]));
  return umbral.length > 0 ? umbral : [event.penumbral.start, event.penumbral.end];
}

const BODIES: Record<string, Body> = {
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
};

describe("event parameters", () => {
  it("keeps the eclipse bar below the general one, and the twilight bound at the planet window's", () => {
    expect(ECLIPSE_MIN_ALTITUDE_DEG).toBe(2);
    expect(EVENT_MIN_ALTITUDE_DEG).toBe(10);
    expect(ECLIPSE_MIN_ALTITUDE_DEG).toBeLessThan(EVENT_MIN_ALTITUDE_DEG);
    expect(EVENT_SUN_MAX_ALTITUDE_DEG).toBe(PLANET_WINDOW_SUN_ALTITUDE_DEG);
    expect(EVENT_WINDOW_NIGHTS).toBe(30);
  });
});

describe("the total solar eclipse of 2027-08-02", () => {
  const FROM = "2027-07-20";

  it("is total from Cádiz, with the Sun about 37° up, and visible", () => {
    const eclipse = only(ofKind(skyEvents(CADIZ, FROM), "solar-eclipse"));
    expect(eclipse.eclipseKind).toBe("total");
    expect(eclipse.obscuration).toBe(1);
    expect(eclipse.moment.toISOString().slice(0, 10)).toBe("2027-08-02");
    expect(eclipse.central).not.toBeNull();
    expect(eclipse.visibility.visible).toBe(true);
    if (eclipse.visibility.visible) {
      expect(eclipse.visibility.best).toEqual(eclipse.moment);
      expect(eclipse.visibility.altitudeDeg).toBeGreaterThan(36);
      expect(eclipse.visibility.altitudeDeg).toBeLessThan(38.5);
      expect(eclipse.visibility.altitudeDeg).toBeCloseTo(altitudeOf(Body.Sun, CADIZ, eclipse.moment), 3);
      expect(eclipse.visibility.partly).toBeUndefined();
      expect(eclipse.visibility.lowHorizon).toBeUndefined();
    }
  });

  it("is partial from Madrid (obscuration about 0.86) and from Warsaw (about 0.30), and visible from both", () => {
    const madrid = only(ofKind(skyEvents(MADRID, FROM), "solar-eclipse"));
    expect(madrid.eclipseKind).toBe("partial");
    expect(madrid.obscuration).toBeCloseTo(0.86, 2);
    expect(madrid.central).toBeNull();
    expect(madrid.visibility.visible).toBe(true);

    const warsaw = only(ofKind(skyEvents(WARSAW, FROM), "solar-eclipse"));
    expect(warsaw.eclipseKind).toBe("partial");
    expect(warsaw.obscuration).toBeCloseTo(0.3, 2);
    expect(warsaw.visibility.visible).toBe(true);
  });

  it("puts a daytime eclipse in the observing night that contains it", () => {
    const eclipse = only(ofKind(skyEvents(WARSAW, FROM), "solar-eclipse"));
    // 11:22 CEST on 2 August belongs to the night that began at noon on 1 August.
    expect(eclipse.night).toBe("2027-08-01");
    expect(observingNightDateFor(eclipse.moment, WARSAW.timeZone)).toBe(eclipse.night);
  });

  it("is not visible from a site where the Sun is under the horizon at the local peak and 2° up at no contact", () => {
    const eclipse = only(ofKind(skyEvents(ATLANTIC_AT_DAWN, FROM), "solar-eclipse"));
    expect(altitudeOf(Body.Sun, ATLANTIC_AT_DAWN, eclipse.moment)).toBeLessThan(0);
    expect(eclipse.visibility).toEqual({ visible: false, reason: "too-low" });
    expect(isNotableEvent(eclipse)).toBe(false);
  });

  it("is visible only partly, and low, when the Sun is up at a contact but not at the peak", () => {
    const site: Site = { latitudeDeg: 10, longitudeDeg: -44, timeZone: "America/Fortaleza" };
    const eclipse = only(ofKind(skyEvents(site, FROM), "solar-eclipse"));
    expect(eclipse.visibility.visible).toBe(true);
    if (eclipse.visibility.visible) {
      expect(altitudeOf(Body.Sun, site, eclipse.moment)).toBeLessThan(ECLIPSE_MIN_ALTITUDE_DEG);
      expect(eclipse.visibility.partly).toBe(true);
      expect(eclipse.visibility.best).toEqual(eclipse.partial.end);
      expect(eclipse.visibility.lowHorizon).toBe(true);
    }
  });
});

describe("the total lunar eclipse of 2028-12-31", () => {
  const FROM = "2028-12-15";

  it("is listed as total, at about 16:52 UTC", () => {
    const eclipse = only(ofKind(skyEvents(WARSAW, FROM), "lunar-eclipse"));
    expect(eclipse.eclipseKind).toBe("total");
    expect(eclipse.obscuration).toBe(1);
    expect(Math.abs(eclipse.moment.getTime() - Date.parse("2028-12-31T16:52:00Z"))).toBeLessThan(2 * 60_000);
    expect(eclipse.partial).not.toBeNull();
    expect(eclipse.total).not.toBeNull();
    // peak ± semi-durations: the phases nest and are centred on the peak.
    expect(eclipse.total?.start.getTime()).toBeGreaterThan(eclipse.partial?.start.getTime() ?? Infinity);
    expect(eclipse.partial?.start.getTime()).toBeGreaterThan(eclipse.penumbral.start.getTime());
    expect((eclipse.total?.start.getTime() ?? 0) + (eclipse.total?.end.getTime() ?? 0)).toBeCloseTo(
      2 * eclipse.moment.getTime(),
      -2,
    );
  });

  it("follows the Moon's altitude: visible from Beijing with the Moon high, not from Los Angeles where it is down", () => {
    const beijing = only(ofKind(skyEvents(BEIJING, FROM), "lunar-eclipse"));
    expect(beijing.visibility.visible).toBe(true);
    if (beijing.visibility.visible) {
      expect(beijing.visibility.altitudeDeg).toBeCloseTo(altitudeOf(Body.Moon, BEIJING, beijing.moment), 3);
      expect(beijing.visibility.altitudeDeg).toBeGreaterThan(60);
      expect(beijing.visibility.partly).toBeUndefined();
      expect(beijing.visibility.lowHorizon).toBeUndefined();
    }

    const losAngeles = only(ofKind(skyEvents(LOS_ANGELES, FROM), "lunar-eclipse"));
    expect(altitudeOf(Body.Moon, LOS_ANGELES, losAngeles.moment)).toBeLessThan(0);
    expect(losAngeles.visibility).toEqual({ visible: false, reason: "below-horizon" });
    expect(isNotableEvent(losAngeles)).toBe(false);
    // The night is the one that began at noon the day before: it is still the morning of 31 December there.
    expect(losAngeles.night).toBe("2028-12-30");
  });

  it("is visible only partly from Madrid, where the Moon rises during the eclipse", () => {
    const madrid = only(ofKind(skyEvents(MADRID, FROM), "lunar-eclipse"));
    expect(altitudeOf(Body.Moon, MADRID, madrid.moment)).toBeLessThan(ECLIPSE_MIN_ALTITUDE_DEG);
    expect(madrid.visibility.visible).toBe(true);
    if (madrid.visibility.visible) {
      expect(madrid.visibility.partly).toBe(true);
      expect(madrid.visibility.altitudeDeg).toBeGreaterThanOrEqual(ECLIPSE_MIN_ALTITUDE_DEG);
      expect(madrid.visibility.best.getTime()).toBeGreaterThan(madrid.moment.getTime());
    }
  });

  it("is visible with `lowHorizon` when the Moon is between 2° and 10° at the peak", () => {
    // London sees the Moon about 7° up at the peak of the 2028-12-31 eclipse.
    const london = only(ofKind(skyEvents(LONDON, FROM), "lunar-eclipse"));
    const altitude = altitudeOf(Body.Moon, LONDON, london.moment);
    expect(altitude).toBeGreaterThanOrEqual(ECLIPSE_MIN_ALTITUDE_DEG);
    expect(altitude).toBeLessThan(EVENT_MIN_ALTITUDE_DEG);
    expect(london.visibility.visible).toBe(true);
    if (london.visibility.visible) {
      expect(london.visibility.lowHorizon).toBe(true);
      expect(london.visibility.partly).toBeUndefined();
      expect(london.visibility.best).toEqual(london.moment);
      expect(london.visibility.altitudeDeg).toBeCloseTo(altitude, 3);
    }
    // Warsaw sees the same eclipse about 19° up: no low-horizon note.
    const warsaw = only(ofKind(skyEvents(WARSAW, FROM), "lunar-eclipse"));
    expect(warsaw.visibility.visible && warsaw.visibility.lowHorizon).toBeFalsy();
  });
});

describe("the penumbral lunar eclipse of 2027-02-20", () => {
  it("is listed, visible from Warsaw, and not notable", () => {
    const eclipse = only(ofKind(skyEvents(WARSAW, "2027-02-10"), "lunar-eclipse"));
    expect(eclipse.eclipseKind).toBe("penumbral");
    expect(eclipse.obscuration).toBe(0);
    expect(eclipse.partial).toBeNull();
    expect(eclipse.total).toBeNull();
    expect(eclipse.moment.toISOString().slice(0, 10)).toBe("2027-02-20");
    expect(eclipse.visibility.visible).toBe(true);
    expect(isNotableEvent(eclipse)).toBe(false);
  });

  it("makes a visible total eclipse notable and a not-visible one not", () => {
    const visible = only(ofKind(skyEvents(WARSAW, "2028-12-15"), "lunar-eclipse"));
    expect(isNotableEvent(visible)).toBe(true);
    const hidden = only(ofKind(skyEvents(LOS_ANGELES, "2028-12-15"), "lunar-eclipse"));
    expect(isNotableEvent(hidden)).toBe(false);
  });
});

describe("greatest elongations", () => {
  it("finds Mercury's 2026-11-20 morning elongation (about 19.6°) within an hour of the reference", () => {
    const events = ofKind(skyEvents(WARSAW, "2026-11-10"), "elongation");
    const mercury = only(events.filter((e) => e.body === "mercury"));
    expect(Math.abs(mercury.moment.getTime() - Date.parse("2026-11-20T23:35:00Z"))).toBeLessThan(HOUR_MS);
    expect(mercury.apparition).toBe("morning");
    expect(mercury.elongationDeg).toBeCloseTo(19.6, 1);
    expect(mercury.night).toBe("2026-11-20");
  });

  it("finds Venus's 2027-01-03 morning elongation, visible from Sydney with Venus high in the dawn", () => {
    const venus = only(ofKind(skyEvents(SYDNEY, "2026-12-25"), "elongation").filter((e) => e.body === "venus"));
    expect(venus.apparition).toBe("morning");
    expect(venus.elongationDeg).toBeGreaterThan(46);
    expect(venus.visibility.visible).toBe(true);
    if (venus.visibility.visible) {
      expect(venus.visibility.altitudeDeg).toBeGreaterThan(20);
      expect(venus.visibility.altitudeDeg).toBeCloseTo(altitudeOf(Body.Venus, SYDNEY, venus.visibility.best), 3);
      expect(sunAltitudeDeg(SYDNEY, venus.visibility.best)).toBeLessThanOrEqual(EVENT_SUN_MAX_ALTITUDE_DEG + 0.05);
    }
  });

  it("walks every elongation of a long window once, alternating morning and evening, in sensible intervals", () => {
    const events = ofKind(skyEvents(WARSAW, "2026-10-13", 1000), "elongation");
    const mercury = events.filter((e) => e.body === "mercury");
    expect(mercury.length).toBeGreaterThanOrEqual(15);
    mercury.slice(1).forEach((e, i) => {
      const days = (e.moment.getTime() - mercury[i].moment.getTime()) / DAY_MS;
      expect(days).toBeGreaterThan(30);
      expect(days).toBeLessThan(100);
      expect(e.apparition).not.toBe(mercury[i].apparition);
    });
    const venus = events.filter((e) => e.body === "venus");
    expect(venus.length).toBeGreaterThanOrEqual(3);
    // Venus's eastern and western elongations are about 144 and 440 days apart, alternately.
    venus.slice(1).forEach((e, i) => {
      const days = (e.moment.getTime() - venus[i].moment.getTime()) / DAY_MS;
      expect(days).toBeGreaterThan(120);
      expect(days).toBeLessThan(470);
      expect(e.apparition).not.toBe(venus[i].apparition);
    });
  });

  it("never calls a low Mercury elongation in a high-latitude summer visible", () => {
    // Mercury's evening elongation of 2027-05-28: at Tromsø the Sun never gets to -6°, at Warsaw there is no dark window.
    const tromso = ofKind(skyEvents(TROMSO, "2027-05-20"), "elongation").filter((e) => e.body === "mercury");
    const tromsoEvent = only(tromso);
    expect(tromsoEvent.visibility).toEqual({ visible: false, reason: "daylight" });
    const warsaw = only(ofKind(skyEvents(WARSAW, "2027-05-20"), "elongation").filter((e) => e.body === "mercury"));
    expect(warsaw.visibility).toEqual({ visible: false, reason: "too-low", shortNight: true });
  });
});

describe("oppositions", () => {
  it("finds none from 2026-10-13, for Mars, Jupiter or Saturn", () => {
    expect(ofKind(skyEvents(WARSAW, "2026-10-13"), "opposition")).toEqual([]);
  });

  it("finds Jupiter's 2027 opposition within a day of 2027-02-11, and Mars's of 2027-02-19", () => {
    const events = ofKind(skyEvents(WARSAW, "2027-01-25"), "opposition");
    const jupiter = only(events.filter((e) => e.body === "jupiter"));
    expect(Math.abs(jupiter.moment.getTime() - Date.parse("2027-02-11T00:00:00Z"))).toBeLessThan(DAY_MS);
    const mars = only(events.filter((e) => e.body === "mars"));
    expect(Math.abs(mars.moment.getTime() - Date.parse("2027-02-19T00:00:00Z"))).toBeLessThan(DAY_MS);
    expect(events.filter((e) => e.body === "saturn")).toEqual([]);
    // Jupiter is up all night, and high: the best moment is in the dark window, near its culmination.
    expect(jupiter.visibility.visible).toBe(true);
    if (jupiter.visibility.visible) {
      expect(jupiter.visibility.altitudeDeg).toBeGreaterThan(50);
      expect(jupiter.visibility.shortNight).toBeUndefined();
      const window = darkWindow(WARSAW, observingNight(jupiter.night, WARSAW.timeZone), -18);
      expect(window.kind).toBe("window");
      if (window.kind === "window") {
        expect(jupiter.visibility.best.getTime()).toBeGreaterThanOrEqual(window.start.getTime());
        expect(jupiter.visibility.best.getTime()).toBeLessThanOrEqual(window.end.getTime());
      }
    }
  });

  it("walks every opposition of a long window once, a synodic period apart", () => {
    const events = ofKind(skyEvents(WARSAW, "2026-10-13", 1000), "opposition");
    const jupiter = events.filter((e) => e.body === "jupiter");
    expect(jupiter).toHaveLength(3);
    jupiter.slice(1).forEach((e, i) => {
      const days = (e.moment.getTime() - jupiter[i].moment.getTime()) / DAY_MS;
      expect(days).toBeGreaterThan(395);
      expect(days).toBeLessThan(405);
    });
    expect(events.filter((e) => e.body === "saturn")).toHaveLength(2);
    expect(events.filter((e) => e.body === "mars")).toHaveLength(2);
  });

  it("uses the twilight span and flags a short night when there is no dark window", () => {
    // Jupiter's opposition of 2029-04-12 at Tromsø: the Sun never gets below -18° that night.
    const jupiter = only(ofKind(skyEvents(TROMSO, "2029-04-05"), "opposition"));
    expect(jupiter.body).toBe("jupiter");
    expect(darkWindow(TROMSO, observingNight(jupiter.night, TROMSO.timeZone), -18).kind).toBe("none");
    expect(jupiter.visibility.visible).toBe(true);
    if (jupiter.visibility.visible) {
      expect(jupiter.visibility.shortNight).toBe(true);
      expect(sunAltitudeDeg(TROMSO, jupiter.visibility.best)).toBeLessThanOrEqual(EVENT_SUN_MAX_ALTITUDE_DEG + 0.05);
    }
  });

  it("is not visible in daylight when the Sun never gets to the twilight bound", () => {
    // Jupiter's opposition of 2030-05-13 at Tromsø: the midnight Sun.
    const jupiter = only(ofKind(skyEvents(TROMSO, "2030-05-06"), "opposition"));
    expect(jupiter.visibility).toEqual({ visible: false, reason: "daylight" });
  });

  it("takes the dark-window threshold the caller passes", () => {
    // Tromsø's night of 2029-04-11: the Sun's lowest point is about -11.7°, so -10° has a dark window and -12° has none.
    const strict = only(ofKind(skyEvents(TROMSO, "2029-04-05", 7, -12), "opposition"));
    const loose = only(ofKind(skyEvents(TROMSO, "2029-04-05", 7, -10), "opposition"));
    expect(strict.visibility.visible && strict.visibility.shortNight).toBe(true);
    expect(loose.visibility.visible).toBe(true);
    expect(loose.visibility.visible && loose.visibility.shortNight).toBeFalsy();
  });

  it("keeps the short-night flag on an opposition that is not visible either", () => {
    // Jupiter's opposition of 2030-05-13 from Reykjavik: no dark window, and Jupiter stays under 10° in the twilight span.
    const reykjavik: Site = { latitudeDeg: 64.15, longitudeDeg: -21.94, timeZone: "Atlantic/Reykjavik" };
    const jupiter = only(ofKind(skyEvents(reykjavik, "2030-05-06"), "opposition"));
    expect(jupiter.visibility).toEqual({ visible: false, reason: "too-low", shortNight: true });
  });
});

describe("the window", () => {
  it("lists events in time order, from every kind", () => {
    const events = skyEvents(WARSAW, "2026-10-13", 1000);
    expect(events.length).toBeGreaterThan(20);
    events.slice(1).forEach((e, i) => {
      expect(e.moment.getTime()).toBeGreaterThanOrEqual(events[i].moment.getTime());
    });
    expect(new Set(events.map((e) => e.kind))).toEqual(
      new Set(["lunar-eclipse", "solar-eclipse", "elongation", "opposition", "pairing", "meteor-shower"]),
    );
  });

  it("holds exactly the events of its nights, noon to noon in the site's zone", () => {
    // Jupiter's opposition falls at 01:17 CET on 2027-02-11: in the night that began on 2027-02-10.
    expect(ofKind(skyEvents(WARSAW, "2027-02-10", 1), "opposition")).toHaveLength(1);
    expect(skyEvents(WARSAW, "2027-02-09", 1)).toEqual([]);
    expect(skyEvents(WARSAW, "2027-02-11", 1)).toEqual([]);
    expect(ofKind(skyEvents(WARSAW, "2027-02-09", 2), "opposition")).toHaveLength(1);
    expect(skyEvents(WARSAW, "2027-02-10", 0)).toEqual([]);
    for (const e of skyEvents(WARSAW, "2027-01-25")) {
      expect(e.night >= "2027-01-25" && e.night <= addDays("2027-01-25", EVENT_WINDOW_NIGHTS - 1)).toBe(true);
    }
  });

  it("defaults to the 30-night window", () => {
    expect(skyEvents(WARSAW, "2027-01-25")).toEqual(skyEvents(WARSAW, "2027-01-25", EVENT_WINDOW_NIGHTS));
  });

  it("rejects a malformed first night and a negative or fractional length", () => {
    expect(() => skyEvents(WARSAW, "2027-13-40")).toThrow(RangeError);
    expect(() => skyEvents(WARSAW, "2027-02-10", -1)).toThrow(RangeError);
    expect(() => skyEvents(WARSAW, "2027-02-10", 1.5)).toThrow(RangeError);
  });
});

describe("visibleAt", () => {
  const flat =
    (altitudeDeg: number) =>
    (time: Date): HorizontalPosition => ({ time, altitudeDeg, azimuthDeg: 90 });
  // Warsaw, midwinter night 2027-01-10: the Sun is below -6° from about 17:15 UTC to 05:50 UTC.
  const NIGHT = { start: new Date("2027-01-10T20:00:00Z"), end: new Date("2027-01-10T21:00:00Z") };
  const NOON = { start: new Date("2027-01-10T11:00:00Z"), end: new Date("2027-01-10T12:00:00Z") };

  it("picks the highest moment at or above the minimum", () => {
    const rising = (time: Date): HorizontalPosition => ({
      time,
      altitudeDeg: 5 + (time.getTime() - NIGHT.start.getTime()) / 60_000 / 4,
      azimuthDeg: 180,
    });
    const result = visibleAt(WARSAW, rising, NIGHT);
    expect(result.visible).toBe(true);
    if (result.visible) {
      expect(result.best).toEqual(NIGHT.end);
      expect(result.altitudeDeg).toBeCloseTo(20, 6);
      expect(result.azimuthDeg).toBe(180);
    }
  });

  it("is inclusive at the minimum altitude", () => {
    expect(visibleAt(WARSAW, flat(EVENT_MIN_ALTITUDE_DEG), NIGHT).visible).toBe(true);
    expect(visibleAt(WARSAW, flat(EVENT_MIN_ALTITUDE_DEG - 0.001), NIGHT)).toEqual({
      visible: false,
      reason: "too-low",
    });
  });

  it("says below-horizon for a body under 0° throughout, too-low for the rest, daylight when only the Sun is in the way", () => {
    expect(visibleAt(WARSAW, flat(-5), NIGHT)).toEqual({ visible: false, reason: "below-horizon" });
    expect(visibleAt(WARSAW, flat(0), NIGHT)).toEqual({ visible: false, reason: "too-low" });
    expect(visibleAt(WARSAW, flat(40), NOON)).toEqual({ visible: false, reason: "daylight" });
    expect(visibleAt(WARSAW, flat(40), NIGHT).visible).toBe(true);
  });
});

describe("the invariant: nothing is visible that is not up", () => {
  const SITES: Site[] = [
    WARSAW,
    CADIZ,
    LONDON,
    SYDNEY,
    TROMSO,
    { latitudeDeg: 0, longitudeDeg: 36.8, timeZone: "Africa/Nairobi" },
    { latitudeDeg: -33.93, longitudeDeg: 18.42, timeZone: "Africa/Johannesburg" },
    { latitudeDeg: 64.15, longitudeDeg: -21.94, timeZone: "Atlantic/Reykjavik" },
    LOS_ANGELES,
  ];
  const WINDOWS: { from: string; nights: number }[] = [
    { from: "2026-10-13", nights: 1000 },
    { from: "2028-01-01", nights: 366 },
  ];
  const MINUTE_MS = 60_000;

  function bodyOf(event: SkyEvent): Body | null {
    switch (event.kind) {
      case "lunar-eclipse":
        return Body.Moon;
      case "solar-eclipse":
        return Body.Sun;
      case "elongation":
      case "opposition":
        return BODIES[event.body];
      default:
        return null;
    }
  }

  const all: { site: Site; events: SkyEvent[] }[] = [];
  beforeAll(() => {
    for (const site of SITES) {
      for (const window of WINDOWS) {
        all.push({ site, events: skyEvents(site, window.from, window.nights, undefined, { pairings: false }) });
      }
    }
  });

  it("has something to check in every kind", () => {
    const kinds = new Set(all.flatMap(({ events }) => events.map((e) => e.kind)));
    expect(kinds).toEqual(new Set(["lunar-eclipse", "solar-eclipse", "elongation", "opposition", "meteor-shower"]));
    expect(all.flatMap(({ events }) => events).filter((e) => e.visibility.visible).length).toBeGreaterThan(100);
    expect(all.flatMap(({ events }) => events).filter((e) => !e.visibility.visible).length).toBeGreaterThan(100);
  });

  it("holds every visible event to its kind's minimum altitude at its best moment, and the Sun to the twilight bound", () => {
    let checked = 0;
    for (const { site, events } of all) {
      for (const event of events) {
        const body = bodyOf(event);
        if (body === null || !event.visibility.visible) {
          continue;
        }
        checked++;
        const { best, altitudeDeg } = event.visibility;
        const independent = altitudeOf(body, site, best);
        const isEclipse = event.kind === "lunar-eclipse" || event.kind === "solar-eclipse";
        const minimum = isEclipse ? ECLIPSE_MIN_ALTITUDE_DEG : EVENT_MIN_ALTITUDE_DEG;
        const label = `${event.kind} at ${site.timeZone} ${event.moment.toISOString()}`;
        expect(independent, label).toBeGreaterThanOrEqual(minimum);
        expect(altitudeDeg, label).toBeCloseTo(independent, 2);
        if (isEclipse) {
          expect(event.visibility.shortNight, label).toBeUndefined();
          expect(event.visibility.lowHorizon === true, label).toBe(altitudeDeg < EVENT_MIN_ALTITUDE_DEG);
          expect(event.visibility.partly === true, label).toBe(
            event.visibility.best.getTime() !== event.moment.getTime(),
          );
        } else {
          expect(event.visibility.lowHorizon, label).toBeUndefined();
          expect(event.visibility.partly, label).toBeUndefined();
          expect(sunAltitudeDeg(site, best), label).toBeLessThanOrEqual(EVENT_SUN_MAX_ALTITUDE_DEG + 0.05);
          const night = observingNight(event.night, site.timeZone);
          expect(best.getTime(), label).toBeGreaterThanOrEqual(night.start.getTime());
          expect(best.getTime(), label).toBeLessThanOrEqual(night.end.getTime());
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("gives every eclipse that is under the bar at the peak and every contact the reason `below-horizon` or `too-low`", () => {
    let checked = 0;
    for (const { site, events } of all) {
      for (const event of [...ofKind(events, "lunar-eclipse"), ...ofKind(events, "solar-eclipse")]) {
        const body = event.kind === "lunar-eclipse" ? Body.Moon : Body.Sun;
        const contacts =
          event.kind === "solar-eclipse" ? [event.partial.start, event.partial.end] : lunarContacts(event);
        const sampled = [event.moment, ...contacts];
        const altitudes = sampled.map((time) => altitudeOf(body, site, time));
        if (altitudes.some((altitude) => altitude >= ECLIPSE_MIN_ALTITUDE_DEG)) {
          continue;
        }
        checked++;
        expect(event.visibility.visible, `${event.kind} ${event.moment.toISOString()} at ${site.timeZone}`).toBe(false);
        if (!event.visibility.visible) {
          expect(event.visibility.reason).toBe(Math.max(...altitudes) < 0 ? "below-horizon" : "too-low");
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("calls an opposition not visible only when the body stays under 10° through the whole dark span", () => {
    // Fifteen years, so that high-latitude summer oppositions (midnight Sun, a low planet in the twilight) are in.
    let checked = 0;
    for (const site of [TROMSO, WARSAW, { latitudeDeg: 64.15, longitudeDeg: -21.94, timeZone: "Atlantic/Reykjavik" }]) {
      for (const event of ofKind(skyEvents(site, "2026-10-13", 5500, undefined, { pairings: false }), "opposition")) {
        if (event.visibility.visible) {
          continue;
        }
        checked++;
        const night = observingNight(event.night, site.timeZone);
        const dark = darkWindow(site, night, -18);
        const twilight = darkWindow(site, night, EVENT_SUN_MAX_ALTITUDE_DEG);
        const span = dark.kind === "window" ? dark : twilight.kind === "window" ? twilight : null;
        if (span === null) {
          expect(event.visibility, "the Sun never reaches the twilight bound").toEqual({
            visible: false,
            reason: "daylight",
          });
          continue;
        }
        for (let t = span.start.getTime(); t <= span.end.getTime(); t += 2 * MINUTE_MS) {
          expect(
            altitudeOf(BODIES[event.body], site, new Date(t)),
            `${event.body} ${event.night} at ${site.timeZone}`,
          ).toBeLessThan(EVENT_MIN_ALTITUDE_DEG);
        }
      }
    }
    expect(checked).toBeGreaterThan(5);
  }, 60_000);

  it("calls an elongation not visible only when the body stays under 10° through its twilight band", () => {
    let checked = 0;
    for (const { site, events } of all.filter(({ site }) => site === WARSAW || site === SYDNEY || site === TROMSO)) {
      for (const event of ofKind(events, "elongation")) {
        if (event.visibility.visible) {
          continue;
        }
        checked++;
        const night = observingNight(event.night, site.timeZone);
        for (let t = night.start.getTime(); t <= night.end.getTime(); t += 2 * MINUTE_MS) {
          const time = new Date(t);
          const sun = sunAltitudeDeg(site, time);
          const falling = sunAltitudeDeg(site, new Date(t + MINUTE_MS)) < sun;
          // The band of the apparition: the sun between the twilight bound and darkness, falling in the evening, rising in the morning.
          const inBand =
            sun <= EVENT_SUN_MAX_ALTITUDE_DEG - 0.05 &&
            sun >= -18 + 0.05 &&
            (event.apparition === "evening" ? falling : !falling);
          if (inBand) {
            expect(
              altitudeOf(BODIES[event.body], site, time),
              `${event.body} ${event.apparition} ${event.night} at ${site.timeZone}`,
            ).toBeLessThan(EVENT_MIN_ALTITUDE_DEG);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
  }, 60_000);

  /** The span a night event is judged over: the dark window, else the twilight span (short night), else none. */
  function judgedSpan(site: Site, night: string): { start: Date; end: Date } | null {
    const window = observingNight(night, site.timeZone);
    const dark = darkWindow(site, window, -18);
    const twilight = darkWindow(site, window, EVENT_SUN_MAX_ALTITUDE_DEG);
    return dark.kind === "window" ? dark : twilight.kind === "window" ? twilight : null;
  }

  it("holds every visible shower to the minimum altitude and the twilight bound at its best moment, on its best night", () => {
    let checked = 0;
    for (const { site, events } of all) {
      for (const event of ofKind(events, "meteor-shower")) {
        if (!event.visibility.visible) {
          continue;
        }
        checked++;
        const shower = METEOR_SHOWERS.find((s) => s.key === event.shower);
        expect(shower).toBeDefined();
        if (shower === undefined) {
          continue;
        }
        const { best, altitudeDeg } = event.visibility;
        const label = `${event.shower} ${event.night} at ${site.timeZone}`;
        expect(radiantAltitude(shower, site, best), label).toBeGreaterThanOrEqual(EVENT_MIN_ALTITUDE_DEG);
        expect(altitudeDeg, label).toBeCloseTo(radiantAltitude(shower, site, best), 2);
        expect(sunAltitudeDeg(site, best), label).toBeLessThanOrEqual(EVENT_SUN_MAX_ALTITUDE_DEG + 0.05);
        expect(event.visibility.lowHorizon, label).toBeUndefined();
        const night = observingNight(event.bestNight, site.timeZone);
        expect(best.getTime(), label).toBeGreaterThanOrEqual(night.start.getTime());
        expect(best.getTime(), label).toBeLessThanOrEqual(night.end.getTime());
        expect([event.night, addDays(event.night, -1), addDays(event.night, 1)], label).toContain(event.bestNight);
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("calls a shower not visible only when its radiant stays under 10° through the judged span of the peak night and both neighbours", () => {
    let checked = 0;
    for (const { site, events } of all) {
      for (const event of ofKind(events, "meteor-shower")) {
        if (event.visibility.visible) {
          continue;
        }
        checked++;
        const shower = METEOR_SHOWERS.find((s) => s.key === event.shower);
        expect(shower).toBeDefined();
        if (shower === undefined) {
          continue;
        }
        for (const night of [addDays(event.night, -1), event.night, addDays(event.night, 1)]) {
          const span = judgedSpan(site, night);
          if (span === null) {
            continue;
          }
          for (let t = span.start.getTime(); t <= span.end.getTime(); t += 2 * MINUTE_MS) {
            expect(
              radiantAltitude(shower, site, new Date(t)),
              `${event.shower} ${night} at ${site.timeZone}`,
            ).toBeLessThan(EVENT_MIN_ALTITUDE_DEG);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  }, 60_000);
});

describe("determinism and budget", () => {
  // Measured with the pairings in (Phase 2, 2026-10-14): 38-50 ms for the first call in a fresh process, 18-29 ms
  // warm, 15-20 ms inside the whole suite. With the meteor showers in (Phase 3, 2026-10-14) the same windows took
  // 18-40 ms for the first call (Warsaw, windows from 2026-12-01 with the Geminids and 2027-08-05 with the Perseids
  // included: 18 and 31 ms), 15-18 ms warm and inside the suite; the eight crossing searches add about 1-2 ms. The
  // budget is about four times the slowest first call, so it stays.
  const LOCAL_BUDGET_MS = 200;
  let runs: { first: { events: SkyEvent[]; ms: number }; second: { events: SkyEvent[]; ms: number } } | null = null;
  const getRuns = () => {
    if (runs === null) {
      throw new Error("beforeAll did not execute");
    }
    return runs;
  };
  const timed = () => {
    const started = performance.now();
    const events = skyEvents(WARSAW, "2027-01-25");
    return { events, ms: performance.now() - started };
  };

  beforeAll(() => {
    runs = { first: timed(), second: timed() };
  });

  it("yields deep-equal events for two identical calls", () => {
    const { first, second } = getRuns();
    expect(first.events.length).toBeGreaterThan(0);
    expect(second.events).toEqual(first.events);
    const asNumbers = (events: SkyEvent[]): string =>
      JSON.stringify(events, (_key, value: unknown) => (value instanceof Date ? value.getTime() : value));
    expect(asNumbers(second.events)).toBe(asNumbers(first.events));
  });

  it(`finds the events of 30 nights in under ${LOCAL_BUDGET_MS} ms (asserted locally, logged on CI)`, () => {
    const { first, second } = getRuns();
    // eslint-disable-next-line no-console -- timing printed for CI, where the budget is not asserted; no site data.
    console.info(
      `skyEvents 30 nights: ${first.ms.toFixed(1)} ms cold, ${second.ms.toFixed(1)} ms warm (local budget ${LOCAL_BUDGET_MS} ms)`,
    );
    expect(Number.isFinite(second.ms)).toBe(true);
    if (process.env.CI === undefined) {
      expect(first.ms).toBeLessThan(LOCAL_BUDGET_MS);
      expect(second.ms).toBeLessThan(LOCAL_BUDGET_MS);
    }
  });
});
