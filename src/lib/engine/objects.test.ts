import { describe, expect, it, test } from "vitest";

import { FIXTURES, WARSAW, circularDeltaDeg, fixtureTimeMs, messierTarget, siteOf } from "./fixtures";
import { observingNight } from "./night";
import { bestWindow, objectPosition, objectTrack, objectTracks } from "./objects";
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

  it("samples inclusive of both ends at the default step", () => {
    const track = objectTrack(WARSAW, night, m31);
    expect(track[0]?.time.getTime()).toBe(night.start.getTime());
    expect(track.at(-1)?.time.getTime()).toBe(night.end.getTime());
    expect(track.length).toBe(24 * 6 + 1);
    const at = new Date(night.start.getTime() + 30 * 60_000);
    expect(track[3]).toEqual(objectPosition(WARSAW, at, m31));
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

  it("keeps azimuth in [0, 360) and altitude in [-90, 90]", () => {
    for (const target of [m31, messierTarget("M13"), messierTarget("M45"), { raHours: 12, decDeg: 89.9 }]) {
      for (const p of objectTrack(WARSAW, night, target, 30)) {
        expect(p.azimuthDeg).toBeGreaterThanOrEqual(0);
        expect(p.azimuthDeg).toBeLessThan(360);
        expect(p.altitudeDeg).toBeGreaterThanOrEqual(-90);
        expect(p.altitudeDeg).toBeLessThanOrEqual(90);
      }
    }
  });

  it("is deterministic", () => {
    expect(objectTrack(WARSAW, night, m31)).toEqual(objectTrack(WARSAW, night, m31));
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

  it("rejects a step below one minute and an inverted interval", () => {
    expect(() => objectTrack(WARSAW, night, m31, 0)).toThrow(RangeError);
    expect(() => objectTrack(WARSAW, night, m31, 0.25)).toThrow(RangeError);
    expect(() => objectTrack(WARSAW, { start: night.end, end: night.start }, m31)).toThrow(RangeError);
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
