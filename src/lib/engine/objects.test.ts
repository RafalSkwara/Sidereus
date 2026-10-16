import { describe, expect, it, test } from "vitest";

import { DEEP_SKY } from "@/lib/catalogue";

import { FIXTURES, WARSAW, circularDeltaDeg, fixtureTimeMs, messierTarget, siteOf, warsawDarkWindow } from "./fixtures";
import { observingNight } from "./night";
import { bestWindow, objectPosition, objectTrack, objectTracks, refinedWindow } from "./objects";
import { ALTITUDE_TOLERANCE_DEG } from "./parameters";
import { darkWindow } from "./sun";
import type { HorizontalPosition } from "./types";

function highest(track: readonly HorizontalPosition[]): HorizontalPosition {
  return track.reduce((top, sample) => (sample.altitudeDeg > top.altitudeDeg ? sample : top));
}

function sample(minutes: number, altitudeDeg: number): HorizontalPosition {
  return { time: new Date(Date.UTC(2026, 9, 10, 20, minutes)), altitudeDeg, azimuthDeg: 180 };
}

describe("objectPosition / objectTrack (synthetic)", () => {
  const night = observingNight("2026-10-10", WARSAW.timeZone);
  const m31 = messierTarget("M31");

  it("peaks within 1° of the upper-culmination altitude 90 − |φ − δ| for M31 at Warsaw", () => {
    const track = objectTrack(WARSAW, night, m31);
    const expected = 90 - Math.abs(WARSAW.latitudeDeg - m31.decDeg);
    expect(Math.abs(highest(track).altitudeDeg - expected)).toBeLessThanOrEqual(1);
  });

  it("transits within 2° of due south (azimuth 180) for M31 at Warsaw", () => {
    // Transit instant from a 1-minute grid: the sampled 10-minute peak is not used because at 79°
    // altitude the azimuth moves about 1° per minute, so a 10-minute grid can sit 5° off.
    const fine = objectTrack(WARSAW, night, m31, 1);
    const transit = highest(fine);
    expect(circularDeltaDeg(transit.azimuthDeg, 180)).toBeLessThanOrEqual(2);
    expect(transit.time.getTime()).toBeGreaterThan(night.start.getTime());
    expect(transit.time.getTime()).toBeLessThan(night.end.getTime());
  });

  it("appends the interval end when it does not fall on the grid", () => {
    const interval = { start: night.start, end: new Date(night.start.getTime() + 25 * 60_000) };
    const track = objectTrack(WARSAW, interval, m31);
    expect(track.map((p) => (p.time.getTime() - night.start.getTime()) / 60_000)).toEqual([0, 10, 20, 25]);
  });

  it("never lifts a δ = −60° object above the horizon at Warsaw", () => {
    const track = objectTrack(WARSAW, night, { raHours: 0.7, decDeg: -60 });
    for (const p of track) {
      expect(p.altitudeDeg).toBeLessThan(0);
    }
    // Refraction is tapered below the horizon, so the culmination sits ~0.6° above the geometric value.
    expect(Math.abs(highest(track).altitudeDeg - (90 - WARSAW.latitudeDeg - 60))).toBeLessThan(1);
  });

  it("objectTracks shares one rotation per instant and matches per-object tracks exactly", () => {
    const targets = [m31, messierTarget("M13"), messierTarget("M45")];
    const shared = objectTracks(WARSAW, night, targets, 30);
    expect(shared).toHaveLength(3);
    targets.forEach((target, i) => {
      expect(shared[i]).toEqual(objectTrack(WARSAW, night, target, 30));
    });
    expect(objectTracks(WARSAW, night, [], 30)).toEqual([]);
  });
});

describe("bestWindow", () => {
  it("returns null when nothing clears the minimum altitude", () => {
    const track = [sample(0, 10), sample(10, 20), sample(20, 15)];
    expect(bestWindow(track, 30)).toBeNull();
    expect(bestWindow([], 0)).toBeNull();
  });

  it("returns the longest run at or above the threshold with its highest sample", () => {
    const track = [sample(0, 10), sample(10, 35), sample(20, 40), sample(30, 38), sample(40, 20), sample(50, 45)];
    const window = bestWindow(track, 30);
    expect(window).not.toBeNull();
    if (window === null) {
      return;
    }
    expect(window.start).toEqual(track[1].time);
    expect(window.end).toEqual(track[3].time);
    expect(window.peak).toEqual(track[2]);
  });

  it("picks the earlier of two equal-length runs", () => {
    const track = [sample(0, 31), sample(10, 32), sample(20, 5), sample(30, 60), sample(40, 70), sample(50, 5)];
    const window = bestWindow(track, 30);
    expect(window?.start).toEqual(track[0].time);
    expect(window?.end).toEqual(track[1].time);
    expect(window?.peak).toEqual(track[1]);
  });

  it("treats a sample exactly at the threshold as inside the window", () => {
    const track = [sample(0, 29.9), sample(10, 30), sample(20, 29.9)];
    const window = bestWindow(track, 30);
    expect(window?.start).toEqual(track[1].time);
    expect(window?.end).toEqual(track[1].time);
  });

  it("brackets M31's culmination inside the Warsaw dark window", () => {
    const night = observingNight("2026-10-10", WARSAW.timeZone);
    const dark = darkWindow(WARSAW, night, -18);
    if (dark.kind !== "window") {
      throw new Error("expected a dark window on 2026-10-10 in Warsaw");
    }
    const track = objectTrack(WARSAW, dark, messierTarget("M31"));
    const window = bestWindow(track, 30);
    expect(window).not.toBeNull();
    if (window === null) {
      return;
    }
    expect(window.start.getTime()).toBeGreaterThanOrEqual(dark.start.getTime());
    expect(window.end.getTime()).toBeLessThanOrEqual(dark.end.getTime());
    expect(window.peak.time.getTime()).toBeGreaterThanOrEqual(window.start.getTime());
    expect(window.peak.time.getTime()).toBeLessThanOrEqual(window.end.getTime());
    expect(window.peak).toEqual(highest(track));
    expect(window.peak.altitudeDeg).toBeGreaterThan(75);
  });
});

describe("refinedWindow", () => {
  const minutesOf = (date: Date): number => (date.getTime() - sample(0, 0).time.getTime()) / 60_000;

  it("returns null when nothing clears the minimum altitude", () => {
    expect(refinedWindow([sample(0, 10), sample(10, 20), sample(20, 15)], 30)).toBeNull();
    expect(refinedWindow([], 0)).toBeNull();
  });

  it("puts the rising and the setting edge where the altitude crosses the minimum between two samples", () => {
    // 20 -> 40 across the minimum 30 is halfway through the first step; 35 -> 25 is halfway through the last.
    const track = [sample(0, 20), sample(10, 40), sample(20, 50), sample(30, 35), sample(40, 25)];
    const window = refinedWindow(track, 30);
    expect(window).not.toBeNull();
    if (window === null) {
      return;
    }
    expect(minutesOf(window.start)).toBeCloseTo(5, 9);
    expect(minutesOf(window.end)).toBeCloseTo(35, 9);
    expect([window.firstIndex, window.lastIndex]).toEqual([1, 3]);
    expect(window.peak).toEqual(track[2]);
    // A crossing three quarters of the way up the step lands three quarters of the way through it.
    const steep = refinedWindow([sample(0, 10), sample(10, 50)], 40);
    expect(minutesOf(steep?.start ?? sample(0, 0).time)).toBeCloseTo(7.5, 9);
  });

  it("keeps the first and last sample's instant when the run touches either end of the track", () => {
    const track = [sample(0, 40), sample(10, 50), sample(20, 45)];
    const window = refinedWindow(track, 30);
    expect(window?.start).toEqual(track[0].time);
    expect(window?.end).toEqual(track[2].time);
    expect([window?.firstIndex, window?.lastIndex]).toEqual([0, 2]);
    // One side refined, the other not.
    const rising = refinedWindow([sample(0, 20), sample(10, 40), sample(20, 45)], 30);
    expect(minutesOf(rising?.start ?? sample(0, 0).time)).toBeCloseTo(5, 9);
    expect(rising?.end).toEqual(sample(20, 0).time);
  });

  it("gives a sample exactly at the minimum, with neighbours below, a window of zero length at that instant", () => {
    const track = [sample(0, 29.9), sample(10, 30), sample(20, 29.9)];
    const window = refinedWindow(track, 30);
    expect(window?.start).toEqual(track[1].time);
    expect(window?.end).toEqual(track[1].time);
    expect([window?.firstIndex, window?.lastIndex]).toEqual([1, 1]);
  });

  it("gives a run of one sample above the minimum a window of positive length that holds the sample", () => {
    const track = [sample(0, 20), sample(10, 40), sample(20, 20)];
    const window = refinedWindow(track, 30);
    expect(window).not.toBeNull();
    if (window === null) {
      return;
    }
    expect([window.firstIndex, window.lastIndex]).toEqual([1, 1]);
    expect(window.end.getTime()).toBeGreaterThan(window.start.getTime());
    expect(window.start.getTime()).toBeLessThan(track[1].time.getTime());
    expect(window.end.getTime()).toBeGreaterThan(track[1].time.getTime());
    expect(window.peak).toEqual(track[1]);
  });

  it("refines the same run as bestWindow (the earlier of two equal runs) and keeps its peak", () => {
    const track = [sample(0, 31), sample(10, 32), sample(20, 5), sample(30, 60), sample(40, 70), sample(50, 5)];
    const plain = bestWindow(track, 30);
    const window = refinedWindow(track, 30);
    expect([window?.firstIndex, window?.lastIndex]).toEqual([0, 1]);
    expect(window?.peak).toEqual(plain?.peak);
    // The run touches the start of the track; its end is refined between 32 and 5.
    expect(window?.start).toEqual(track[0].time);
    expect(minutesOf(window?.end ?? sample(0, 0).time)).toBeCloseTo(10 + (10 * 2) / 27, 4);
  });

  // The refined edge is where the engine's own continuous altitude equals the minimum: within 0.05°, which a 10-minute
  // chord keeps (the curvature of a diurnal track is worst at the horizon, where refraction bends it too).
  it.each([0, 15, 40])(
    "puts every refined edge of the catalogue within 0.05° of a %s° minimum altitude",
    (minAltitudeDeg) => {
      const dark = warsawDarkWindow("2026-10-10", 5);
      const tracks = objectTracks(WARSAW, { start: dark.start, end: dark.end }, DEEP_SKY, 10);
      let edges = 0;
      DEEP_SKY.forEach((object, i) => {
        const window = refinedWindow(tracks[i], minAltitudeDeg);
        if (window === null) {
          return;
        }
        for (const edge of [window.start, window.end]) {
          if (edge.getTime() === dark.start.getTime() || edge.getTime() === dark.end.getTime()) {
            continue;
          }
          edges += 1;
          const altitude = objectPosition(WARSAW, edge, object).altitudeDeg;
          expect(Math.abs(altitude - minAltitudeDeg), `${object.id} at ${edge.toISOString()}`).toBeLessThan(0.05);
        }
      });
      // A property over no edges passes for the wrong reason.
      expect(edges).toBeGreaterThan(40);
    },
  );
});

describe("object positions vs Stellarium fixtures", () => {
  for (const fixture of FIXTURES) {
    if (fixture.objects.status !== "captured") {
      test.todo(`${fixture.name}: object values ${fixture.objects.status} — see src/lib/engine/fixtures/README.md`);
      continue;
    }
    const objects = fixture.objects;
    const site = siteOf(fixture);

    it(`${fixture.name}: ${objects.samples.length} object samples within ${ALTITUDE_TOLERANCE_DEG}°`, () => {
      for (const s of objects.samples) {
        const position = objectPosition(site, new Date(fixtureTimeMs(s.time)), messierTarget(s.id));
        expect(Math.abs(position.altitudeDeg - s.altitudeDeg)).toBeLessThanOrEqual(ALTITUDE_TOLERANCE_DEG);
        expect(circularDeltaDeg(position.azimuthDeg, s.azimuthDeg)).toBeLessThanOrEqual(ALTITUDE_TOLERANCE_DEG);
      }
    });
  }
});
